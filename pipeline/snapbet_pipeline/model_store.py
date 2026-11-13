"""Trained-model storage in Postgres (multisport_models, sql/003).

The database is the source of truth so a lost runner or laptop never loses a
model; files under models/<sport_key>/ are still written as a local cache and
as the fallback when no database row exists (tests, old deployments).
"""
from __future__ import annotations

import json
import logging
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


def save_model(conn, sport_key: str, model_text: Optional[str], feature_names: List[str], metadata: Dict) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO multisport_models (sport_key, trained_at, model_kind, model_text, features, metadata)
               VALUES (%s, %s, %s, %s, %s::jsonb, %s::jsonb) RETURNING id""",
            (sport_key, metadata["trained_at"], metadata.get("model_kind"), model_text,
             json.dumps(feature_names), json.dumps(metadata)))
        row_id = int(cur.fetchone()[0])
    conn.commit()
    return row_id


def load_latest(conn, sport_key: str) -> Optional[Tuple[Optional[str], List[str], Dict]]:
    """(model_text or None, feature_names, metadata) of the newest model, or None."""
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT model_text, features, metadata FROM multisport_models
                    WHERE sport_key = %s ORDER BY trained_at DESC, id DESC LIMIT 1""", (sport_key,))
            row = cur.fetchone()
    except Exception as e:  # table missing on an un-migrated database
        logger.warning("model store unavailable: %s", e)
        conn.rollback()
        return None
    if not row:
        return None
    text, feats, meta = row
    feats = json.loads(feats) if isinstance(feats, str) else feats
    meta = json.loads(meta) if isinstance(meta, str) else meta
    return text, list(feats), dict(meta)
