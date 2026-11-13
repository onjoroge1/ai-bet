"""Database helpers: connections, migrations, run log."""
from __future__ import annotations

import json
import logging
import os
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Dict, Iterator, Optional

import psycopg2
import psycopg2.extras

logger = logging.getLogger(__name__)

SQL_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sql")


def connect(database_url: str):
    if not database_url:
        raise RuntimeError("DATABASE_URL is not set")
    conn = psycopg2.connect(database_url, connect_timeout=15)
    conn.autocommit = False
    return conn


@contextmanager
def connection(database_url: str) -> Iterator[Any]:
    conn = connect(database_url)
    try:
        yield conn
    finally:
        conn.close()


def migrate(conn) -> list[str]:
    """Apply every sql/*.sql file in name order. Files are idempotent
    (CREATE TABLE IF NOT EXISTS ...), so re-running is safe."""
    applied = []
    for name in sorted(os.listdir(SQL_DIR)):
        if not name.endswith(".sql"):
            continue
        with open(os.path.join(SQL_DIR, name), "r", encoding="utf-8") as f:
            sql = f.read()
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
        applied.append(name)
        logger.info("migrated %s", name)
    return applied


def log_run(conn, job: str, status: str, started_at: datetime,
            metrics: Optional[Dict[str, Any]] = None, error: Optional[str] = None) -> None:
    """Append a row to multisport_pipeline_runs (observability / heartbeat)."""
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO multisport_pipeline_runs (job, status, started_at, finished_at, metrics, error)
                VALUES (%s, %s, %s, %s, %s::jsonb, %s)
                """,
                (job, status, started_at, datetime.now(timezone.utc),
                 json.dumps(metrics or {}, default=str), error),
            )
        conn.commit()
    except Exception as e:  # never let logging break the job
        conn.rollback()
        logger.warning("could not write run log: %s", e)


def dict_cursor(conn):
    return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
