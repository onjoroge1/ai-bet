"""import-odds-api-history: real event ids, every book, ESPN scores, no in-play prices, CSV superseding."""
from __future__ import annotations

import csv
from datetime import date, datetime, timedelta, timezone

from snapbet_pipeline.history import _match, _snapshot_time, espn_games, import_history
from snapbet_pipeline.import_csv import import_csv_file
from snapbet_pipeline.training_sync import sync_training

from .factories import FakeOddsApi, FakeResponse, odds_event

NBA = "basketball_nba"
DAY = date(2026, 1, 10)
T1 = datetime(2026, 1, 11, 0, 0, tzinfo=timezone.utc)      # 7pm ET tip-off, ESPN date Jan 10
T2 = datetime(2026, 1, 11, 3, 0, tzinfo=timezone.utc)


def _espn_event(commence, home, away, hs, as_, completed=True, season_type=2):
    return {"date": commence.strftime("%Y-%m-%dT%H:%MZ"), "season": {"type": season_type},
            "competitions": [{"date": commence.strftime("%Y-%m-%dT%H:%MZ"),
                              "status": {"type": {"completed": completed}},
                              "competitors": [{"homeAway": "home", "score": str(hs), "team": {"displayName": home}},
                                              {"homeAway": "away", "score": str(as_), "team": {"displayName": away}}]}]}


class FakeEspn:
    def __init__(self, by_day):
        self.by_day, self.calls = by_day, 0

    def __call__(self, url, params=None, timeout=None):
        self.calls += 1
        return FakeResponse({"events": self.by_day.get(params["dates"], [])})


def _setup():
    espn = FakeEspn({DAY.strftime("%Y%m%d"): [
        _espn_event(T1, "Boston Celtics", "LA Clippers", 110, 101),          # ESPN label -> canonical
        _espn_event(T2, "Denver Nuggets", "Phoenix Suns", 99, 104),
        _espn_event(T2, "Team LeBron", "Team Durant", 150, 140, season_type=4),  # all-star: skipped
    ]})
    api = FakeOddsApi()
    api.historical = {NBA: [
        odds_event("evt-bos", NBA, "Boston Celtics", "Los Angeles Clippers", T1, 0.62, -5.5, 224.5, sport_title="NBA"),
        odds_event("evt-den", NBA, "Denver Nuggets", "Phoenix Suns", T2, 0.58, -3.5, 230.5, sport_title="NBA"),
        # a game already in progress at snapshot time must never be stored
        odds_event("evt-live", NBA, "Miami Heat", "Chicago Bulls", T1 - timedelta(hours=3), 0.5, 0, 220, sport_title="NBA"),
    ]}
    return espn, api


def test_espn_parsing_normalises_and_filters():
    espn, _ = _setup()
    games, unmapped = espn_games(NBA, DAY, fetch=espn)
    assert [(g["home"], g["away"]) for g in games] == [("Boston Celtics", "Los Angeles Clippers"),
                                                       ("Denver Nuggets", "Phoenix Suns")]
    assert unmapped == [] and games[0]["home_score"] == 110


def test_match_drops_started_events_and_far_kickoffs():
    games = [{"home": "A", "away": "B", "commence": T1}]
    snap = _snapshot_time(games, 1.0)
    assert snap == T1 - timedelta(hours=1)
    started = {"id": "x", "home_team": "A", "away_team": "B", "commence_time": (snap - timedelta(minutes=5)).isoformat()}
    far = {"id": "y", "home_team": "A", "away_team": "B", "commence_time": (T1 + timedelta(days=2)).isoformat()}
    ok = {"id": "z", "home_team": "A", "away_team": "B", "commence_time": T1.isoformat()}
    assert [ev["id"] for _, ev in _match(games, [started, far, ok], snap)] == ["z"]


def test_import_history_stores_real_ids_books_and_scores(conn, tmp_path):
    espn, api = _setup()
    rep = import_history(conn, api.client(), NBA, DAY, DAY, cache_dir=str(tmp_path / "cache"), espn_fetch=espn)
    assert rep["games"] == 2 and rep["matched"] == 2 and rep["unmatched"] == 0
    assert rep["snapshots_requested"] == 1 and rep["credits_spent"] == 30
    assert rep["rows"]["finals"] == 2
    with conn.cursor() as cur:
        cur.execute("SELECT event_id, status, outcome FROM multisport_fixtures ORDER BY event_id")
        assert cur.fetchall() == [("evt-bos", "finished", "H"), ("evt-den", "finished", "A")]
        cur.execute("""SELECT COUNT(*) FILTER (WHERE is_consensus), COUNT(*) FILTER (WHERE NOT is_consensus),
                              MIN(ts_recorded) FROM multisport_odds_snapshots""")
        n_cons, n_books, ts = cur.fetchone()
        assert (n_cons, n_books) == (2, 6) and ts == T1 - timedelta(hours=1)      # API snapshot time
        cur.execute("SELECT COUNT(*) FROM multisport_odds_snapshots WHERE event_id = 'evt-live'")
        assert cur.fetchone()[0] == 0                                               # no in-play prices
    s = sync_training(conn, NBA)
    assert s["rows"]["inserted"] == 2 and s["features"]["built"] == 2

    # re-run comes entirely from the cache and writes nothing new
    calls = len(api.calls)
    rep2 = import_history(conn, api.client(), NBA, DAY, DAY, cache_dir=str(tmp_path / "cache"), espn_fetch=espn)
    assert len(api.calls) == calls and rep2["snapshots_from_cache"] == 1 and rep2["credits_spent"] == 0
    assert rep2["rows"]["snapshots"] == 0


def test_dry_run_and_credit_cap(conn):
    espn, api = _setup()
    dry = import_history(conn, None, NBA, DAY, DAY + timedelta(days=1), dry_run=True, espn_fetch=espn)
    assert dry["estimated_credits"] == 30 and dry["days_with_games"] == 1 and api.calls == []
    capped = import_history(conn, api.client(), NBA, DAY, DAY, max_credits=10, espn_fetch=espn)
    assert capped["stopped_early"] and capped["credits_spent"] == 0 and api.calls == []


def test_supersede_csv_replaces_earlier_import(conn, tmp_path):
    path = tmp_path / "nba.csv"
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["commence_time", "home_team", "away_team", "home_score", "away_score", "home_odds", "away_odds"])
        w.writerow([T1.strftime("%Y-%m-%dT%H:%M:%SZ"), "Boston Celtics", "Los Angeles Clippers", 110, 101, 1.6, 2.4])
        w.writerow(["2026-01-05T00:00:00Z", "Boston Celtics", "Phoenix Suns", 100, 90, 1.5, 2.6])   # not superseded
    import_csv_file(conn, NBA, str(path), source="old")
    sync_training(conn, NBA)
    espn, api = _setup()
    rep = import_history(conn, api.client(), NBA, DAY, DAY, supersede=True, espn_fetch=espn)
    assert rep["csv_superseded"] == 1
    with conn.cursor() as cur:
        cur.execute("SELECT event_id FROM multisport_fixtures WHERE event_id LIKE 'csv-%%'")
        assert len(cur.fetchall()) == 1
        cur.execute("SELECT COUNT(*) FROM multisport_training WHERE event_id LIKE 'csv-%%'")
        assert cur.fetchone()[0] == 1
        cur.execute("SELECT COUNT(*) FROM multisport_odds_snapshots WHERE bookmaker = 'csv:old'")
        assert cur.fetchone()[0] == 1
