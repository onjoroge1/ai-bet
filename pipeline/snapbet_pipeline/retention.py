"""Storage retention: thin high-frequency snapshots of games that finished long ago.

Training, features, predictions and the pick ledger read only *consensus* odds
snapshots (closing line, line movement), so consensus rows are never deleted.
What grows fast is everything captured hourly per bookmaker and per Kalshi market.
For games that started more than `keep_days` ago, keep per bookmaker (and per
Kalshi market):
  * the first capture (opening price),
  * the last capture before the game started (closing price),
  * the first capture in each `bucket_hours` window (the shape of the move),
and delete the rest, including per-book rows captured after the start.
Player props of games older than `props_keep_days` are collapsed into one
multisport_player_prop_consensus row per game x market x player (median line,
no-vig over probability of the books at that line, book count, best prices) and
the per-book rows are deleted.
Also drops pipeline run logs older than `keep_run_days`.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Dict, Optional

ODDS_DOOMED = """
    WITH ranked AS (
        SELECT id,
               ts_recorded <= commence_time AS pre,
               ROW_NUMBER() OVER (PARTITION BY event_id, bookmaker ORDER BY ts_recorded) AS rn_first,
               ROW_NUMBER() OVER (PARTITION BY event_id, bookmaker, (ts_recorded <= commence_time)
                                  ORDER BY ts_recorded DESC) AS rn_last,
               ROW_NUMBER() OVER (PARTITION BY event_id, bookmaker,
                                  date_bin(%(bucket)s, ts_recorded, TIMESTAMPTZ '2000-01-01')
                                  ORDER BY ts_recorded) AS rn_bucket
          FROM multisport_odds_snapshots
         WHERE NOT is_consensus AND commence_time < %(cutoff)s)
    SELECT id FROM ranked
     WHERE NOT pre OR (rn_first > 1 AND rn_last > 1 AND rn_bucket > 1)
"""

KALSHI_DOOMED = """
    WITH k AS (
        SELECT s.id, s.kalshi_ticker, s.ts_recorded,
               COALESCE(f.commence_time, s.occurrence_time - INTERVAL '3 hours') AS start_time
          FROM multisport_kalshi_snapshots s
          LEFT JOIN multisport_fixtures f ON f.event_id = s.event_id AND f.sport_key = s.sport_key),
    ranked AS (
        SELECT id,
               ts_recorded <= start_time AS pre,
               ROW_NUMBER() OVER (PARTITION BY kalshi_ticker ORDER BY ts_recorded) AS rn_first,
               ROW_NUMBER() OVER (PARTITION BY kalshi_ticker, (ts_recorded <= start_time)
                                  ORDER BY ts_recorded DESC) AS rn_last,
               ROW_NUMBER() OVER (PARTITION BY kalshi_ticker,
                                  date_bin(%(bucket)s, ts_recorded, TIMESTAMPTZ '2000-01-01')
                                  ORDER BY ts_recorded) AS rn_bucket
          FROM k WHERE start_time < %(cutoff)s)
    SELECT id FROM ranked
     WHERE NOT pre OR (rn_first > 1 AND rn_last > 1 AND rn_bucket > 1)
"""


PROPS_CONSOLIDATE = """
    WITH g AS (
        SELECT sport_key, event_id, commence_time, market, player_name, ts_recorded,
               percentile_disc(0.5) WITHIN GROUP (ORDER BY line) AS med
          FROM multisport_player_props
         WHERE commence_time < %(pcut)s AND line IS NOT NULL
         GROUP BY sport_key, event_id, commence_time, market, player_name, ts_recorded)
    INSERT INTO multisport_player_prop_consensus (sport_key, event_id, commence_time, market, player_name, line,
                                                  over_prob, n_books, best_over, best_under, ts_recorded)
    SELECT g.sport_key, g.event_id, g.commence_time, g.market, g.player_name, g.med,
           AVG((1 / p.over_price) / ((1 / p.over_price) + (1 / p.under_price)))
               FILTER (WHERE p.over_price > 1 AND p.under_price > 1),
           COUNT(DISTINCT p.bookmaker), MAX(p.over_price), MAX(p.under_price), g.ts_recorded
      FROM g JOIN multisport_player_props p
        ON p.event_id = g.event_id AND p.market = g.market AND p.player_name = g.player_name
       AND p.ts_recorded = g.ts_recorded AND p.line = g.med
     GROUP BY g.sport_key, g.event_id, g.commence_time, g.market, g.player_name, g.med, g.ts_recorded
    ON CONFLICT (event_id, market, player_name, ts_recorded) DO NOTHING
"""


def prune(conn, keep_days: int = 7, bucket_hours: int = 6, keep_run_days: int = 60, props_keep_days: int = 30,
          now: Optional[datetime] = None, dry_run: bool = False) -> Dict:
    if keep_days < 2:
        raise ValueError("keep_days must be at least 2 (unsettled games need their snapshots)")
    now = now or datetime.now(timezone.utc)
    params = {"cutoff": now - timedelta(days=keep_days), "bucket": timedelta(hours=bucket_hours)}
    out: Dict = {"keep_days": keep_days, "bucket_hours": bucket_hours, "dry_run": dry_run}
    with conn.cursor() as cur:
        for name, table, doomed in (("odds_per_book", "multisport_odds_snapshots", ODDS_DOOMED),
                                    ("kalshi", "multisport_kalshi_snapshots", KALSHI_DOOMED)):
            if dry_run:
                cur.execute(f"SELECT COUNT(*) FROM ({doomed}) d", params)
            else:
                cur.execute(f"DELETE FROM {table} WHERE id IN ({doomed})", params)
            out[name] = cur.fetchone()[0] if dry_run else cur.rowcount
        pcut = {"pcut": now - timedelta(days=props_keep_days)}
        if dry_run:
            cur.execute("SELECT COUNT(*) FROM multisport_player_props WHERE commence_time < %(pcut)s", pcut)
            out["props_per_book"] = cur.fetchone()[0]
        else:
            cur.execute(PROPS_CONSOLIDATE, pcut)
            out["props_consensus_added"] = cur.rowcount
            cur.execute("DELETE FROM multisport_player_props WHERE commence_time < %(pcut)s", pcut)
            out["props_per_book"] = cur.rowcount
        run_cutoff = now - timedelta(days=keep_run_days)
        if dry_run:
            cur.execute("SELECT COUNT(*) FROM multisport_pipeline_runs WHERE started_at < %s", (run_cutoff,))
            out["pipeline_runs"] = cur.fetchone()[0]
        else:
            cur.execute("DELETE FROM multisport_pipeline_runs WHERE started_at < %s", (run_cutoff,))
            out["pipeline_runs"] = cur.rowcount
    if dry_run:
        conn.rollback()
    else:
        conn.commit()
    return out
