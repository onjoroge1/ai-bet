"""Build the labelled training set: finished games + their last pre-game consensus.

Two steps, both idempotent:
  1. sync_training_rows  — insert a row per finished fixture that has a consensus
     snapshot and no training row yet (label = outcome, consensus probs).
  2. build_missing_features — for rows whose `features` is NULL, compute the
     46-feature vector with a leak-safe cutoff at the game's start time.
"""
from __future__ import annotations

import json
import logging
from typing import Dict, Optional

from .config import SPORTS
from .features import FEATURES_VERSION, MultisportFeatureBuilder

logger = logging.getLogger(__name__)


def sync_training_rows(conn, sport_key: str) -> Dict[str, int]:
    cfg = SPORTS[sport_key]
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO multisport_training (sport, sport_key, event_id, home_team, away_team, match_date,
                                             home_score, away_score, outcome,
                                             consensus_home_prob, consensus_away_prob)
            SELECT %s, f.sport_key, f.event_id, f.home_team, f.away_team, (f.commence_time AT TIME ZONE 'UTC')::date,
                   f.home_score, f.away_score, f.outcome, lo.home_prob, lo.away_prob
              FROM multisport_fixtures f
              JOIN LATERAL (
                    SELECT home_prob, away_prob
                      FROM multisport_odds_snapshots o
                     WHERE o.event_id = f.event_id AND o.sport_key = f.sport_key AND o.is_consensus
                       AND o.ts_recorded <= f.commence_time
                     ORDER BY o.ts_recorded DESC LIMIT 1) lo ON TRUE
             WHERE f.sport_key = %s AND f.status = 'finished' AND f.outcome IN ('H','A')
               AND NOT EXISTS (SELECT 1 FROM multisport_training t
                                WHERE t.sport_key = f.sport_key AND t.event_id = f.event_id)
            ON CONFLICT (sport_key, event_id) DO NOTHING
            """,
            (cfg.sport, sport_key),
        )
        inserted = cur.rowcount
        cur.execute("SELECT COUNT(*) FROM multisport_training WHERE sport_key = %s", (sport_key,))
        total = cur.fetchone()[0]
    conn.commit()
    return {"inserted": inserted, "total": total}


def build_missing_features(conn, sport_key: str, limit: Optional[int] = None) -> Dict[str, int]:
    """Fill `features` for rows lacking them (or built with an older version)."""
    builder = MultisportFeatureBuilder(conn)
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT t.event_id, t.home_team, t.away_team, t.match_date, f.commence_time
              FROM multisport_training t
              LEFT JOIN multisport_fixtures f ON f.sport_key = t.sport_key AND f.event_id = t.event_id
             WHERE t.sport_key = %s AND (t.features IS NULL OR t.features_version IS DISTINCT FROM %s)
             ORDER BY t.match_date ASC
             """ + (f" LIMIT {int(limit)}" if limit else ""),
            (sport_key, FEATURES_VERSION),
        )
        rows = cur.fetchall()
    built = errors = 0
    for event_id, home, away, match_date, commence in rows:
        try:
            feats = builder.build_features(sport_key, event_id, home, away, match_date, cutoff_dt=commence)
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE multisport_training SET features = %s::jsonb, features_version = %s "
                    "WHERE sport_key = %s AND event_id = %s",
                    (json.dumps(feats), FEATURES_VERSION, sport_key, event_id),
                )
            built += 1
            if built % 50 == 0:
                conn.commit()
        except Exception as e:
            errors += 1
            logger.warning("feature build failed for %s: %s", event_id, e)
    conn.commit()
    return {"candidates": len(rows), "built": built, "errors": errors}


def sync_training(conn, sport_key: str) -> Dict[str, Dict]:
    rows = sync_training_rows(conn, sport_key)
    feats = build_missing_features(conn, sport_key)
    return {"rows": rows, "features": feats}
