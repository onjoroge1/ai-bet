"""End-to-end on a real Postgres: collect -> results -> sync -> train -> predict -> publish -> settle.

Data is SYNTHETIC (tests/factories.py). The assertions are about plumbing and
contract shapes, not predictive quality.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

import pytest

from snapbet_pipeline.collect import collect_odds
from snapbet_pipeline.config import SPORTS
from snapbet_pipeline.predict import Predictor, predict_upcoming
from snapbet_pipeline.publish import publish_predictions, settle_finished
from snapbet_pipeline.results import collect_results
from snapbet_pipeline.train import should_train, train_sport
from snapbet_pipeline.training_sync import sync_training

from .factories import FakeOddsApi, odds_event, score_event, synthetic_season

NFL = "americanfootball_nfl"


def _count(conn, sql, *params):
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchone()[0]


def load_season(conn, api: FakeOddsApi, games, snapshots_per_game=3):
    """Replay a past season through collect + results the way the cron would."""
    client = api.client()
    by_week = {}
    for g in games:
        by_week.setdefault(g["commence"].date(), []).append(g)
    for day, week_games in sorted(by_week.items()):
        for hours_before in (72, 24, 2)[:snapshots_per_game]:
            api.odds[NFL] = [odds_event(g["event_id"], NFL, g["home"], g["away"], g["commence"],
                                        g["p_home"], g["spread"], g["total"]) for g in week_games]
            now = min(g["commence"] for g in week_games) - timedelta(hours=hours_before)
            collect_odds(conn, client, [NFL], now=now)
        api.scores[NFL] = [score_event(g["event_id"], NFL, g["home"], g["away"], g["commence"],
                                       g["home_score"], g["away_score"]) for g in week_games]
        collect_results(conn, client, [NFL], now=max(g["commence"] for g in week_games) + timedelta(hours=4))
    api.odds[NFL] = []


def test_collect_is_idempotent_and_stores_consensus_plus_books(conn):
    api = FakeOddsApi()
    g = synthetic_season(n_teams=4, n_weeks=1)[0]
    api.odds[NFL] = [odds_event(g["event_id"], NFL, g["home"], g["away"], g["commence"], g["p_home"],
                                g["spread"], g["total"])]
    now = g["commence"] - timedelta(hours=5)
    r1 = collect_odds(conn, api.client(), [NFL], now=now)
    r2 = collect_odds(conn, api.client(), [NFL], now=now)     # same timestamp -> no duplicates
    assert r1[NFL]["fixtures_new"] == 1 and r1[NFL]["snapshots"] == 4  # consensus + 3 books
    assert r2[NFL]["fixtures_new"] == 0 and r2[NFL]["snapshots"] == 0
    assert _count(conn, "SELECT COUNT(*) FROM multisport_odds_snapshots WHERE is_consensus") == 1
    assert r1["_quota"]["requests_remaining"] == 4900
    league = _count(conn, "SELECT league_name FROM multisport_fixtures LIMIT 1")
    assert league == "NFL"


def test_off_season_sport_spends_no_api_calls(conn):
    api = FakeOddsApi()
    july = datetime(2026, 7, 1, tzinfo=timezone.utc)
    r = collect_odds(conn, api.client(), [NFL, "basketball_nba"], now=july)
    assert r[NFL]["status"] == "off_season" and r["basketball_nba"]["status"] == "off_season"
    assert api.calls == []


def test_results_step_down_to_plan_limit(conn):
    api = FakeOddsApi()
    api.max_days_from = 3
    g = synthetic_season(n_teams=4, n_weeks=1)[0]
    api.odds[NFL] = [odds_event(g["event_id"], NFL, g["home"], g["away"], g["commence"], g["p_home"],
                                g["spread"], g["total"])]
    collect_odds(conn, api.client(), [NFL], now=g["commence"] - timedelta(hours=2))
    api.scores[NFL] = [score_event(g["event_id"], NFL, g["home"], g["away"], g["commence"], 27, 20)]
    r = collect_results(conn, api.client(), [NFL], days_from=30, now=g["commence"] + timedelta(hours=4))
    assert r[NFL]["days_from"] == 3 and r[NFL]["finals"] == 1 and r[NFL]["fixtures_finished"] == 1
    row = conn.cursor()
    row.execute("SELECT status, home_score, away_score, outcome FROM multisport_fixtures")
    assert row.fetchone() == ("finished", 27, 20, "H")


def test_full_pipeline_train_predict_publish_settle(conn, tmp_path):
    api = FakeOddsApi()
    games = synthetic_season(n_teams=20, n_weeks=16)          # 160 finished games
    load_season(conn, api, games)
    assert _count(conn, "SELECT COUNT(*) FROM multisport_fixtures WHERE status='finished'") == 160

    # --- sync: training rows + leak-safe features
    s = sync_training(conn, NFL)
    assert s["rows"]["inserted"] == 160 and s["features"]["built"] == 160 and s["features"]["errors"] == 0
    feats = conn.cursor()
    feats.execute("SELECT features FROM multisport_training ORDER BY match_date DESC LIMIT 1")
    f = feats.fetchone()[0]
    assert len(f) == 46 and 0 < f["prob_home"] < 1 and f["n_snapshots"] == 3.0
    assert f["home_elo"] != 1500.0 or f["away_elo"] != 1500.0   # ELO saw earlier games

    # --- policy + train
    ok, reason = should_train(conn, NFL, str(tmp_path))
    assert ok and "no model yet" in reason
    t = train_sport(conn, NFL, str(tmp_path))
    assert t["status"] == "ok" and t["n_samples"] == 160
    meta = json.load(open(tmp_path / NFL / "metadata.json"))
    assert meta["edge_gate"]["n"] > 0 and isinstance(meta["edge_gate"]["edge_validated"], bool)
    assert 0 <= meta["oof_metrics"]["accuracy"] <= 1
    assert meta["model_kind"] == "market_anchored_lgbm" and meta["anchor_rounds"] in (0, 10, 25, 50, 100, 200)
    assert meta["edge_gate"]["criterion"] == "logloss_vs_market"
    # the database is the source of truth: a predictor loads with no files on disk
    assert _count(conn, "SELECT COUNT(*) FROM multisport_models WHERE sport_key = 'americanfootball_nfl'") == 1
    assert Predictor.load(str(tmp_path / "no-such-dir"), NFL, conn) is not None
    ok2, reason2 = should_train(conn, NFL, str(tmp_path))
    assert not ok2 and "fresh" in reason2                       # policy: nothing new -> skip

    # --- upcoming slate: collect odds, predict, publish
    last = max(g["commence"] for g in games)
    now = last + timedelta(days=4)
    upcoming = synthetic_season(n_teams=20, n_weeks=1, start=now + timedelta(days=3), seed=99)
    api.odds[NFL] = [odds_event(g["event_id"], NFL, g["home"], g["away"], g["commence"], g["p_home"],
                                g["spread"], g["total"]) for g in upcoming]
    collect_odds(conn, api.client(), [NFL], now=now)
    predictor = Predictor.load(str(tmp_path), NFL)
    assert predictor is not None
    preds = predict_upcoming(conn, NFL, predictor, now=now)
    assert len(preds) == 10
    p = preds[0]
    assert p.model_block["predictions"]["pick"] in ("H", "A")
    assert abs(p.model_block["predictions"]["home_win"] + p.model_block["predictions"]["away_win"] - 1) < 1e-6
    pd_ = p.prediction_data
    assert abs(pd_["market"]["implied"]["home"] + pd_["market"]["implied"]["away"] - 1) < 1e-3
    assert "draw" not in pd_["market"]["implied"]
    assert pd_["model_track_record"]["model"] == "v3_multisport_football"
    assert pd_["model_track_record"]["edge_validated"] == meta["edge_gate"]["edge_validated"]
    vb = (pd_["value"] or {}).get("value_bet")
    if vb:
        assert vb["ev"] > 0 and vb["bet"] in ("home_win", "away_win")
        assert vb["kelly_quarter"] == pytest.approx(vb["kelly_full"] / 4, abs=1e-4)

    # a market-only model (trainer chose 0 rounds) publishes like cold start: no model pick
    market_only = Predictor(NFL, None, predictor.feature_names, predictor.metadata)
    mo = predict_upcoming(conn, NFL, market_only, now=now)
    assert market_only.is_market_only and len(mo) == 10
    assert all(x.model_block is None and x.prediction_data["value"] is None for x in mo)
    assert mo[0].prediction_data["model_info"]["kind"] == "market_anchored_lgbm"

    r = publish_predictions(conn, preds)
    assert r["published"] == 10
    cur = conn.cursor()
    cur.execute('SELECT sport, status, league, odds, model, "predictionData", "syncCount" FROM "MultisportMatch"')
    rows = cur.fetchall()
    assert len(rows) == 10
    sport, status, league, odds, model, pdata, sync_count = rows[0]
    assert (sport, status, league, sync_count) == (NFL, "upcoming", "NFL", 1)
    assert odds["consensus"]["home_prob"] and odds["book_count"] == 3
    assert model["predictions"]["confidence"] >= 0.5 and model["no_draw"] is True
    assert pdata["match_info"]["home_team"] and pdata["predictions"]["pick"] == model["predictions"]["pick"]

    # re-publish bumps syncCount instead of duplicating rows
    publish_predictions(conn, predict_upcoming(conn, NFL, predictor, now=now))
    assert _count(conn, 'SELECT COUNT(*) FROM "MultisportMatch"') == 10
    assert _count(conn, 'SELECT MIN("syncCount") FROM "MultisportMatch"') == 2

    # --- settle: results arrive -> finalResult on the frontend rows
    api.scores[NFL] = [score_event(g["event_id"], NFL, g["home"], g["away"], g["commence"],
                                   g["home_score"], g["away_score"]) for g in upcoming]
    collect_results(conn, api.client(), [NFL], now=upcoming[-1]["commence"] + timedelta(hours=4))
    # settle() filters by NOW(); synthetic dates may be far away, so widen the window.
    # Finished fixtures never published as predictions are inserted too (results tab),
    # so 160 historical + the 10 we predicted are settled.
    st = settle_finished(conn, NFL, since_days=100000)
    assert st["settled"] == 170
    assert _count(conn, 'SELECT COUNT(*) FROM "MultisportMatch"') == 170
    cur.execute('SELECT status, "finalResult", model FROM "MultisportMatch" WHERE "eventId" = %s',
                (upcoming[0]["event_id"],))
    status, final, model = cur.fetchone()
    assert status == "finished" and final["result"] in ("H", "A") and final["score"]["home"] == upcoming[0]["home_score"]
    assert model["predictions"]["pick"] in ("H", "A")           # prediction kept alongside the result
    assert settle_finished(conn, NFL, since_days=100000)["settled"] == 0   # idempotent


def test_cold_start_publishes_market_only(conn, tmp_path):
    api = FakeOddsApi()
    now = datetime(2026, 11, 7, 12, 0, tzinfo=timezone.utc)
    g = synthetic_season(n_teams=4, n_weeks=1, start=now + timedelta(days=1))[0]
    api.odds[NFL] = [odds_event(g["event_id"], NFL, g["home"], g["away"], g["commence"], g["p_home"],
                                g["spread"], g["total"])]
    collect_odds(conn, api.client(), [NFL], now=now)
    assert Predictor.load(str(tmp_path), NFL) is None
    preds = predict_upcoming(conn, NFL, None, now=now)
    assert len(preds) == 1 and preds[0].model_block is None
    pdata = preds[0].prediction_data
    assert pdata["market"] is not None and pdata["value"] is None and pdata["predictions"] is None
    assert pdata["model_track_record"]["edge_validated"] is False
    publish_predictions(conn, preds)
    cur = conn.cursor()
    cur.execute('SELECT model, odds FROM "MultisportMatch"')
    model, odds = cur.fetchone()
    assert model is None and odds["consensus"]["n_bookmakers"] == 3
