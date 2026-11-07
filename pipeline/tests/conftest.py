"""Test fixtures.

DB-backed tests need a Postgres reachable at TEST_DATABASE_URL (default: the
local instance used in CI/dev: postgresql://postgres@127.0.0.1:5433/snapbet_test).
They are skipped, not failed, when no database answers.
"""
from __future__ import annotations

import os

import psycopg2
import pytest

from snapbet_pipeline import db

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "postgresql://postgres@127.0.0.1:5433/snapbet_test")

# Mirror of prisma/schema.prisma `model MultisportMatch` (Prisma owns this table
# in production; tests create it here so publish.py can be exercised).
MULTISPORT_MATCH_DDL = """
CREATE TABLE IF NOT EXISTS "MultisportMatch" (
    id                  TEXT PRIMARY KEY,
    "eventId"           TEXT NOT NULL,
    sport               TEXT NOT NULL,
    status              TEXT NOT NULL,
    "homeTeam"          TEXT NOT NULL,
    "awayTeam"          TEXT NOT NULL,
    "homeTeamId"        INTEGER,
    "awayTeamId"        INTEGER,
    league              TEXT NOT NULL,
    "commenceTime"      TIMESTAMP(3) NOT NULL,
    odds                JSONB,
    spread              JSONB,
    "totalLine"         JSONB,
    model               JSONB,
    "predictionData"    JSONB,
    "predictionFetchedAt" TIMESTAMP(3),
    "finalResult"       JSONB,
    "teamContext"       JSONB,
    "modelInfo"         JSONB,
    "lastSyncedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncCount"         INTEGER NOT NULL DEFAULT 0,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MultisportMatch_eventId_sport_key" UNIQUE ("eventId", sport)
);
"""

PIPELINE_TABLES = ["multisport_pick_ledger", "multisport_fixtures", "multisport_odds_snapshots", "multisport_match_results",
                   "multisport_schedule", "multisport_training", "multisport_pipeline_runs"]


def _db_available() -> bool:
    try:
        c = psycopg2.connect(TEST_DATABASE_URL, connect_timeout=3)
        c.close()
        return True
    except Exception:
        return False


@pytest.fixture(scope="session")
def database_url():
    if not _db_available():
        pytest.skip(f"no test database at {TEST_DATABASE_URL}")
    return TEST_DATABASE_URL


@pytest.fixture
def conn(database_url):
    c = db.connect(database_url)
    db.migrate(c)
    with c.cursor() as cur:
        cur.execute(MULTISPORT_MATCH_DDL)
        for t in PIPELINE_TABLES:
            cur.execute(f"TRUNCATE {t} RESTART IDENTITY")
        cur.execute('TRUNCATE "MultisportMatch"')
    c.commit()
    yield c
    c.rollback()
    c.close()
