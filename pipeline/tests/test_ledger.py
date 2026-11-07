"""Pick ledger: bet-time lock, closing line, realized CLV, track record, CLV veto."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from snapbet_pipeline.collect import collect_odds
from snapbet_pipeline.edge import model_track_record
from snapbet_pipeline.ledger import CLV_GATE_MIN_N, clv_vetoes_edge, settle_ledger, track_record
from snapbet_pipeline.predict import Prediction
from snapbet_pipeline.publish import publish_predictions
from snapbet_pipeline.results import collect_results

from .factories import FakeOddsApi, odds_event, score_event

NFL = "americanfootball_nfl"
NOW = datetime(2026, 11, 7, 12, 0, tzinfo=timezone.utc)
KICKOFF = NOW + timedelta(days=1)


def _prediction(event_id: str, home: str, away: str, generated_at: datetime, p_home: float,
                value_bet: dict | None, validated: bool, cons: dict, books: dict) -> Prediction:
    pick = "H" if p_home >= 0.5 else "A"
    model_block = {"predictions": {"home_win": p_home, "away_win": 1 - p_home, "pick": pick,
                                   "confidence": max(p_home, 1 - p_home), "conviction_tier": "standard"},
                   "source": "v3_multisport", "no_draw": True, "model_id": "v3_multisport_football"}
    prediction_data = {
        "match_info": {"event_id": event_id, "home_team": home, "away_team": away},
        "predictions": model_block["predictions"], "odds": cons, "books": books,
        "market": {"implied": {"home": cons["home_prob"], "away": cons["away_prob"]}, "overround": 1.04, "n_books": 3},
        "value": {"value_bet": value_bet, "rating": "value" if value_bet else "no_value"},
        "clv": {"bet_time_odds": value_bet["price"] if value_bet else None, "closing_odds": None, "realized_clv": None},
        "model_track_record": {"model": "v3_multisport_football", "edge_validated": validated},
    }
    return Prediction(NFL, event_id, home, away, "NFL", KICKOFF, cons, books, model_block, prediction_data, generated_at)


def _consensus(cur, event_id):
    cur.execute("""SELECT home_odds, away_odds, home_prob, away_prob, n_bookmakers FROM multisport_odds_snapshots
                   WHERE event_id = %s AND is_consensus ORDER BY ts_recorded DESC LIMIT 1""", (event_id,))
    ho, ao, hp, ap, n = cur.fetchone()
    return {"home_odds": float(ho), "away_odds": float(ao), "home_prob": float(hp), "away_prob": float(ap), "n_bookmakers": n}


def test_ledger_locks_bet_time_then_settles_with_closing_line_and_clv(conn):
    api = FakeOddsApi()
    home, away, eid = "Buffalo Bills", "Miami Dolphins", "evt-ledger-1"
    # odds drift: at publish time the home side is 1.90; by kickoff the market has moved to 1.70
    api.odds[NFL] = [odds_event(eid, NFL, home, away, KICKOFF, p_home=0.50, spread=-1.5, total=47.5, jitter=0.0)]
    collect_odds(conn, api.client(), [NFL], now=NOW)
    with conn.cursor() as cur:
        cons_open = _consensus(cur, eid)
    vb = {"outcome": "home", "bet": "home_win", "ev": 0.08, "price": 2.05, "book": "fanduel",
          "min_acceptable_odds": 1.75, "kelly_full": 0.07, "kelly_quarter": 0.0175}
    p1 = _prediction(eid, home, away, NOW, 0.57, vb, False, cons_open, {"fanduel": {"home_odds": 2.05, "away_odds": 1.9}})
    publish_predictions(conn, [p1])

    # second publish 6h later: the model now says 0.60 and the best price has shortened — must NOT overwrite
    p2 = _prediction(eid, home, away, NOW + timedelta(hours=6), 0.60,
                     dict(vb, price=1.85, ev=0.03), False, cons_open, {"fanduel": {"home_odds": 1.85, "away_odds": 2.0}})
    publish_predictions(conn, [p2])

    with conn.cursor() as cur:
        cur.execute("""SELECT publish_count, model_pick, model_prob_pick, market_prob_pick, value_bet_outcome,
                              bet_time_odds, bet_time_book, bet_time_ev, edge_validated_at_bet, settled_at
                         FROM multisport_pick_ledger WHERE event_id = %s""", (eid,))
        row = cur.fetchone()
    assert row[0] == 2 and row[1] == "H" and float(row[2]) == 0.57
    assert float(row[3]) == pytest.approx(cons_open["home_prob"], abs=1e-4)
    assert row[4] == "home" and float(row[5]) == 2.05 and row[6] == "fanduel" and float(row[7]) == 0.08
    assert row[8] is False and row[9] is None

    # market closes at p_home = 0.59 one hour before kickoff; then the game finishes home win 27-20
    api.odds[NFL] = [odds_event(eid, NFL, home, away, KICKOFF, p_home=0.59, spread=-2.5, total=47.5, jitter=0.0)]
    collect_odds(conn, api.client(), [NFL], now=KICKOFF - timedelta(hours=1))
    api.scores[NFL] = [score_event(eid, NFL, home, away, KICKOFF, 27, 20)]
    collect_results(conn, api.client(), [NFL], now=KICKOFF + timedelta(hours=4))

    out = settle_ledger(conn, NFL)
    assert out == {"candidates": 1, "settled": 1, "without_closing_line": 0}
    with conn.cursor() as cur:
        cur.execute("""SELECT closing_prob_bet, closing_method, realized_clv, result, pick_won, value_bet_won,
                              value_bet_pnl_1u FROM multisport_pick_ledger WHERE event_id = %s""", (eid,))
        cp, method, clv, result, pick_won, vb_won, pnl = cur.fetchone()
        cur.execute("""SELECT "predictionData"->'clv' FROM "MultisportMatch" WHERE "eventId" = %s""", (eid,))
        clv_block = cur.fetchone()[0]
    assert method == "last_pre_commence"
    assert float(cp) == pytest.approx(0.59, abs=0.01)
    assert float(clv) == pytest.approx(2.05 * float(cp) - 1, abs=1e-3)     # beat the close -> positive
    assert float(clv) > 0
    assert (result, pick_won, vb_won) == ("H", True, True) and float(pnl) == pytest.approx(1.05)
    assert clv_block["bet_time_odds"] == 2.05 and clv_block["realized_clv"] == pytest.approx(float(clv), abs=1e-4)
    assert clv_block["closing_prob"] == pytest.approx(float(cp), abs=1e-4)

    # settlement is final: a later publish must not reopen the row
    publish_predictions(conn, [p2])
    with conn.cursor() as cur:
        cur.execute("SELECT publish_count, settled_at IS NOT NULL FROM multisport_pick_ledger WHERE event_id = %s", (eid,))
        assert cur.fetchone() == (2, True)
    assert settle_ledger(conn, NFL)["settled"] == 0

    rec = track_record(conn, NFL, now=KICKOFF + timedelta(days=1))
    assert rec["n_settled"] == 1 and rec["pick_hit_rate"] == 1.0
    assert rec["n_value_bets"] == 1 and rec["value_bet_roi_1u"] == pytest.approx(1.05)
    assert rec["median_clv_90d"] == pytest.approx(float(clv), abs=1e-4) and rec["n_clv"] == 1
    assert clv_vetoes_edge(rec) is None                       # far below CLV_GATE_MIN_N
    block = model_track_record("v3_multisport_football", {"edge_validated": True, "validation": "gate ok", "n": 150}, rec)
    assert block["edge_validated"] is True and block["n_settled"] == 1 and block["median_clv_90d"] == rec["median_clv_90d"]


def test_cold_start_publish_creates_ledger_row_without_pick(conn):
    api = FakeOddsApi()
    eid = "evt-cold"
    api.odds[NFL] = [odds_event(eid, NFL, "A Team", "B Team", KICKOFF, 0.55, -1.5, 44.5)]
    collect_odds(conn, api.client(), [NFL], now=NOW)
    with conn.cursor() as cur:
        cons = _consensus(cur, eid)
    p = Prediction(NFL, eid, "A Team", "B Team", "NFL", KICKOFF, cons, {}, None,
                   {"match_info": {}, "predictions": None, "odds": cons, "market": None, "value": None,
                    "clv": None, "model_track_record": {"model": "v3_multisport_football", "edge_validated": False}}, NOW)
    publish_predictions(conn, [p])
    with conn.cursor() as cur:
        cur.execute("SELECT model_pick, value_bet_outcome, model_id FROM multisport_pick_ledger WHERE event_id = %s", (eid,))
        assert cur.fetchone() == (None, None, "v3_multisport_football")
    rec = track_record(conn, NFL)
    assert rec["n_settled"] == 0 and rec["median_clv_90d"] is None


def test_clv_veto_flips_edge_validated_false():
    bad = {"n_clv": CLV_GATE_MIN_N, "median_clv_90d": -0.021, "n_settled": 80}
    reason = clv_vetoes_edge(bad)
    assert reason and "CLV veto" in reason
    block = model_track_record("v3_multisport_basketball", {"edge_validated": True, "validation": "OOF +3pp"}, bad, reason)
    assert block["edge_validated"] is False and "CLV veto" in block["validation"]
    # not enough settled bets -> no veto
    assert clv_vetoes_edge({"n_clv": CLV_GATE_MIN_N - 1, "median_clv_90d": -0.1}) is None
    # positive CLV -> no veto
    assert clv_vetoes_edge({"n_clv": 500, "median_clv_90d": 0.01}) is None
