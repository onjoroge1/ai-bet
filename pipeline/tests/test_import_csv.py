"""CSV cold-start import: parsing (pure) + end-to-end into the training tables."""
from __future__ import annotations

import csv
import io
import json
import random
from datetime import datetime, timedelta, timezone

import pytest

from snapbet_pipeline.config import SPORTS
from snapbet_pipeline.import_csv import CsvFormatError, import_csv_file, parse_csv, to_decimal_odds
from snapbet_pipeline.teams import NFL, canonical_team
from snapbet_pipeline.train import should_train, train_sport
from snapbet_pipeline.training_sync import sync_training

NFL_KEY = "americanfootball_nfl"
CFG = SPORTS[NFL_KEY]


# ------------------------------------------------------------------ pure parsing
def test_american_and_decimal_odds():
    assert to_decimal_odds("-175") == pytest.approx(1.571, abs=1e-3)
    assert to_decimal_odds("+145") == 2.45
    assert to_decimal_odds("1.57") == 1.57
    assert to_decimal_odds("") is None and to_decimal_odds("NA") is None and to_decimal_odds("0.9") is None


def test_team_normalisation_covers_codes_cities_and_nicknames():
    assert canonical_team(NFL_KEY, "BUF") == "Buffalo Bills"
    assert canonical_team(NFL_KEY, "buffalo") == "Buffalo Bills"
    assert canonical_team(NFL_KEY, "Washington Redskins") == "Washington Commanders"
    assert canonical_team(NFL_KEY, "Oakland Raiders") == "Las Vegas Raiders"
    assert canonical_team("basketball_nba", "LA Lakers") == "Los Angeles Lakers"
    assert canonical_team("icehockey_nhl", "St. Louis Blues") == "St Louis Blues"
    assert canonical_team(NFL_KEY, "Springfield Isotopes") is None
    assert canonical_team(NFL_KEY, "Isotopes", {"Isotopes": "Buffalo Bills"}) == "Buffalo Bills"
    assert len({c for c, _ in NFL}) == 32


def test_parse_csv_aliases_odds_and_report():
    text = (
        "Date,Home,Visitor,home_pts,visitor_score,home_ml,away_ml,spread,ou\n"
        "2025-09-07,BUF,MIA,31,10,-175,+145,-6.5,47.5\n"
        "09/08/2025,Kansas City Chiefs,Ravens,27,20,,,-3,46.5\n"          # no moneyline → no snapshot
        "2025-09-08,SF,SEA,20,20,1.9,1.9,,\n"                             # tie → skipped
        "2025-09-09,Springfield Isotopes,SEA,1,0,,,,\n"                   # unmapped → skipped + reported
    )
    games, report = parse_csv(text, CFG, "unit")
    assert report.rows == 4 and report.parsed == 2 and report.with_odds == 1
    assert len(report.skipped) == 2
    assert report.unmapped_teams == {"Springfield Isotopes": 1}
    g = games[0]
    assert (g.home_team, g.away_team, g.outcome) == ("Buffalo Bills", "Miami Dolphins", "H")
    assert g.home_odds == pytest.approx(1.571, abs=1e-3) and g.away_odds == 2.45
    assert g.home_spread == -6.5 and g.total == 47.5
    assert g.commence_time.tzinfo is not None and g.commence_time.hour == 23   # date-only → default hour
    assert g.event_id.startswith("csv-")
    g2 = games[1]
    assert g2.home_team == "Kansas City Chiefs" and g2.away_team == "Baltimore Ravens" and not g2.has_moneyline
    assert g2.commence_time.date().isoformat() == "2025-09-08"


def test_parse_csv_requires_core_columns():
    with pytest.raises(CsvFormatError):
        parse_csv("date,home_team,away_team\n2025-01-01,BUF,MIA\n", CFG, "x")


def test_event_id_is_deterministic():
    text = "date,home_team,away_team,home_score,away_score\n2025-09-07,BUF,MIA,31,10\n"
    a, _ = parse_csv(text, CFG, "a")
    b, _ = parse_csv(text, CFG, "b")
    assert a[0].event_id == b[0].event_id


# ------------------------------------------------------------------ end to end
def _write_season_csv(path, n_weeks=9, seed=3):
    """Real NFL names (abbreviations in the CSV), fake scores/odds. 16 games/week."""
    rng = random.Random(seed)
    teams = [(c, a[0]) for c, a in NFL]  # (canonical, abbreviation)
    strength = {c: rng.gauss(0, 1) for c, _ in teams}
    start = datetime(2025, 9, 7, 17, 0, tzinfo=timezone.utc)
    rows = []
    for w in range(n_weeks):
        order = teams[:]
        rng.shuffle(order)
        for i in range(0, 32, 2):
            (hc, ha), (ac, aa) = order[i], order[i + 1]
            diff = strength[hc] - strength[ac] + 0.25
            # clamp so both sides keep a quotable price (odds > 1.0 after vig)
            p_home = min(max(1 / (1 + 2.718 ** (-1.1 * diff)), 0.08), 0.92)
            home_odds = round(1 / (p_home * 1.045), 2)
            away_odds = round(1 / ((1 - p_home) * 1.045), 2)
            margin = rng.gauss(diff * 3, 10)
            hs, as_ = max(0, int(round(24 + margin / 2))), max(0, int(round(24 - margin / 2)))
            if hs == as_:
                hs += 3
            day = (start + timedelta(days=7 * w)).strftime("%Y-%m-%d")
            # mix representations: abbreviations for home, full names for away
            rows.append([day, ha, ac, hs, as_, home_odds, away_odds, round(-diff * 3 * 2) / 2, 44.5])
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["date", "home_team", "away_team", "home_score", "away_score", "home_odds", "away_odds", "home_spread", "total"])
        w.writerows(rows)
    return len(rows)


def _count(conn, sql, *params):
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchone()[0]


def test_import_then_sync_then_train(conn, tmp_path):
    path = tmp_path / "nfl_2025.csv"
    n = _write_season_csv(path, n_weeks=9)          # 144 games ≥ NFL min 120
    assert n == 144

    dry = import_csv_file(conn, NFL_KEY, str(path), source="test-season", dry_run=True)
    assert dry["dry_run"] is True and dry["parsed"] == 144 and dry["unmapped_teams"] == {}
    assert _count(conn, "SELECT COUNT(*) FROM multisport_fixtures") == 0     # dry run wrote nothing

    rep = import_csv_file(conn, NFL_KEY, str(path), source="test-season")
    assert rep["fixtures_new"] == 144 and rep["snapshots"] == 144 and rep["results"] == 144
    assert _count(conn, "SELECT COUNT(*) FROM multisport_odds_snapshots WHERE bookmaker = 'csv:test-season' AND is_consensus") == 144
    assert _count(conn, "SELECT COUNT(DISTINCT home_team) FROM multisport_fixtures") == 32   # names normalised

    # idempotent re-import
    rep2 = import_csv_file(conn, NFL_KEY, str(path), source="test-season")
    assert rep2["fixtures_new"] == 0 and rep2["fixtures_updated"] == 144 and rep2["snapshots"] == 0

    s = sync_training(conn, NFL_KEY)
    assert s["rows"]["inserted"] == 144 and s["features"]["built"] == 144 and s["features"]["errors"] == 0

    ok, reason = should_train(conn, NFL_KEY, str(tmp_path / "models"))
    assert ok, reason
    t = train_sport(conn, NFL_KEY, str(tmp_path / "models"))
    assert t["status"] == "ok" and t["n_samples"] == 144
    meta = json.load(open(tmp_path / "models" / NFL_KEY / "metadata.json"))
    assert meta["n_samples_from_csv"] == 144                       # provenance is visible
    assert isinstance(meta["edge_gate"]["edge_validated"], bool)


def test_import_rows_without_odds_feed_history_but_not_training(conn, tmp_path):
    path = tmp_path / "scores_only.csv"
    with open(path, "w", newline="") as f:
        f.write("date,home_team,away_team,home_score,away_score\n")
        f.write("2025-09-07,BUF,MIA,31,10\n2025-09-14,MIA,BUF,20,27\n")
    rep = import_csv_file(conn, NFL_KEY, str(path), source="scores")
    assert rep["fixtures_new"] == 2 and rep["snapshots"] == 0 and rep["with_odds"] == 0
    s = sync_training(conn, NFL_KEY)
    assert s["rows"]["inserted"] == 0          # no market probability → not a training row
    assert _count(conn, "SELECT COUNT(*) FROM multisport_fixtures WHERE status = 'finished'") == 2
