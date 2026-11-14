from datetime import datetime, timedelta, timezone

import pytest

from snapbet_pipeline.retention import prune

NOW = datetime(2026, 11, 30, 12, 0, tzinfo=timezone.utc)
OLD_TIP = datetime(2026, 11, 10, 0, 0, tzinfo=timezone.utc)   # 20 days ago
NEW_TIP = datetime(2026, 11, 28, 0, 0, tzinfo=timezone.utc)   # 2.5 days ago


def _odds(cur, event_id, tip, bookmaker, ts):
    cur.execute("""INSERT INTO multisport_odds_snapshots (sport, sport_key, event_id, commence_time, home_odds, away_odds,
                       bookmaker, is_consensus, ts_recorded)
                   VALUES ('basketball', 'basketball_nba', %s, %s, 1.5, 2.6, %s, %s, %s)""",
                (event_id, tip, bookmaker, bookmaker == "consensus", ts))


def _seed(conn):
    with conn.cursor() as cur:
        for event_id, tip in (("old", OLD_TIP), ("new", NEW_TIP)):
            cur.execute("""INSERT INTO multisport_fixtures (sport, sport_key, event_id, home_team, away_team, commence_time)
                           VALUES ('basketball', 'basketball_nba', %s, 'H', 'A', %s)""", (event_id, tip))
            # hourly from 30h before tip to 2h after, for one book + consensus
            for h in range(-30, 3):
                ts = tip + timedelta(hours=h)
                for bm in ("draftkings", "consensus"):
                    _odds(cur, event_id, tip, bm, ts)
                cur.execute("""INSERT INTO multisport_kalshi_snapshots (sport_key, event_id, kalshi_ticker, kalshi_event,
                                   game_key, market_type, ts_recorded, occurrence_time)
                               VALUES ('basketball_nba', %s, %s, 'E-G', 'G', 'game', %s, %s)""",
                            (event_id, f"E-G-{event_id}", ts, tip + timedelta(hours=3)))
        cur.execute("""INSERT INTO multisport_pipeline_runs (job, status, started_at)
                       VALUES ('collect', 'ok', %s), ('collect', 'ok', %s)""", (NOW - timedelta(days=90), NOW))
    conn.commit()


def _count(conn, sql, args=()):
    with conn.cursor() as cur:
        cur.execute(sql, args)
        return cur.fetchone()[0]


def test_dry_run_counts_without_deleting(conn):
    _seed(conn)
    before = _count(conn, "SELECT COUNT(*) FROM multisport_odds_snapshots")
    res = prune(conn, keep_days=7, now=NOW, dry_run=True)
    assert res["odds_per_book"] > 0 and res["kalshi"] > 0 and res["pipeline_runs"] == 1
    assert _count(conn, "SELECT COUNT(*) FROM multisport_odds_snapshots") == before


def test_prune_keeps_consensus_recent_games_open_close_and_buckets(conn):
    _seed(conn)
    prune(conn, keep_days=7, bucket_hours=6, now=NOW)
    # consensus untouched for both games; recent game untouched entirely
    assert _count(conn, "SELECT COUNT(*) FROM multisport_odds_snapshots WHERE is_consensus") == 2 * 33
    assert _count(conn, "SELECT COUNT(*) FROM multisport_odds_snapshots WHERE event_id='new'") == 2 * 33
    assert _count(conn, "SELECT COUNT(*) FROM multisport_kalshi_snapshots WHERE event_id='new'") == 33
    with conn.cursor() as cur:
        cur.execute("""SELECT ts_recorded FROM multisport_odds_snapshots
                        WHERE event_id='old' AND bookmaker='draftkings' ORDER BY ts_recorded""")
        kept = [r[0] for r in cur.fetchall()]
    assert kept[0] == OLD_TIP - timedelta(hours=30)          # opening
    assert OLD_TIP in kept                                    # closing (last at/before tip)
    assert all(t <= OLD_TIP for t in kept)                    # in-play rows dropped
    assert len(kept) <= 8                                     # ~6-hourly in between, not 33
    assert _count(conn, "SELECT COUNT(*) FROM multisport_kalshi_snapshots WHERE event_id='old'") == len(kept)
    assert _count(conn, "SELECT COUNT(*) FROM multisport_pipeline_runs") == 1


def test_prune_is_idempotent_and_guards_short_windows(conn):
    _seed(conn)
    prune(conn, keep_days=7, now=NOW)
    again = prune(conn, keep_days=7, now=NOW)
    assert again["odds_per_book"] == 0 and again["kalshi"] == 0
    with pytest.raises(ValueError):
        prune(conn, keep_days=1, now=NOW)


def test_old_props_collapse_to_consensus(conn):
    old = NOW - timedelta(days=40)
    with conn.cursor() as cur:
        for bm, line, o, u in (("dk", 26.5, 1.87, 1.95), ("fd", 26.5, 1.91, 1.91), ("mgm", 27.5, 2.05, 1.78)):
            cur.execute("""INSERT INTO multisport_player_props (sport_key, event_id, commence_time, bookmaker, market,
                               player_name, line, over_price, under_price, ts_recorded)
                           VALUES ('basketball_nba', 'e-old', %s, %s, 'player_points', 'Jalen Brunson', %s, %s, %s, %s)""",
                        (old, bm, line, o, u, old - timedelta(hours=1)))
        cur.execute("""INSERT INTO multisport_player_props (sport_key, event_id, commence_time, bookmaker, market,
                           player_name, line, over_price, under_price, ts_recorded)
                       VALUES ('basketball_nba', 'e-new', %s, 'dk', 'player_points', 'X', 10.5, 1.9, 1.9, %s)""",
                    (NOW - timedelta(days=2), NOW - timedelta(days=2)))
    conn.commit()
    res = prune(conn, keep_days=7, now=NOW)
    assert res["props_consensus_added"] == 1 and res["props_per_book"] == 3
    with conn.cursor() as cur:
        cur.execute("SELECT line, over_prob, n_books, best_over, best_under FROM multisport_player_prop_consensus")
        line, prob, n, bo, bu = cur.fetchone()
        cur.execute("SELECT event_id FROM multisport_player_props")
        left = cur.fetchall()
    assert float(line) == 26.5 and n == 2 and float(bo) == 1.91 and float(bu) == 1.95
    expected = ((1 / 1.87) / (1 / 1.87 + 1 / 1.95) + 0.5) / 2
    assert abs(float(prob) - expected) < 1e-3
    assert left == [("e-new",)]
