"""Write predictions and results into the frontend's Prisma table "MultisportMatch".

The table is owned by prisma/schema.prisma (model MultisportMatch). We write it
with plain SQL using Prisma's column names (camelCase, quoted). Shapes of the
JSON columns match what the Next.js routes/components already read:

  odds          {consensus: {...}, books: {...}, book_count}
  spread        {line, total}
  totalLine     {total, over_odds, under_odds}
  model         {predictions: {home_win, away_win, pick, confidence, conviction_tier, edge_vs_market}, source, no_draw}
  predictionData the full payload incl. market/value/clv/model_track_record (lib/edge/extract.ts)
  finalResult   {score: {home, away}, result: 'H'|'A', result_text, overtime}
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, Iterable, List

from .config import SPORTS
from .predict import Prediction

logger = logging.getLogger(__name__)

TABLE = '"MultisportMatch"'


def _naive_utc(dt: datetime) -> datetime:
    """Prisma stores DateTime as timestamp(3) without tz, in UTC."""
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _new_id() -> str:
    return "msp_" + uuid.uuid4().hex[:21]


def upsert_prediction(cur, p: Prediction) -> None:
    now = _naive_utc(p.generated_at)
    cons = p.consensus or {}
    odds = {"consensus": cons, "books": p.books, "book_count": len(p.books)}
    spread = {"line": cons.get("home_spread"), "total": cons.get("total_line")}
    total_line = {"total": cons.get("total_line"), "over_odds": cons.get("over_odds"),
                  "under_odds": cons.get("under_odds")}
    cur.execute(
        f"""
        INSERT INTO {TABLE} (id, "eventId", sport, status, "homeTeam", "awayTeam", league, "commenceTime",
                             odds, spread, "totalLine", model, "predictionData", "predictionFetchedAt",
                             "modelInfo", "lastSyncedAt", "syncCount", "createdAt", "updatedAt")
        VALUES (%s, %s, %s, 'upcoming', %s, %s, %s, %s,
                %s::jsonb, %s::jsonb, %s::jsonb, %s::jsonb, %s::jsonb, %s,
                %s::jsonb, %s, 1, %s, %s)
        ON CONFLICT ("eventId", sport) DO UPDATE SET
            "homeTeam" = EXCLUDED."homeTeam", "awayTeam" = EXCLUDED."awayTeam", league = EXCLUDED.league,
            "commenceTime" = EXCLUDED."commenceTime",
            odds = EXCLUDED.odds, spread = EXCLUDED.spread, "totalLine" = EXCLUDED."totalLine",
            model = EXCLUDED.model, "predictionData" = EXCLUDED."predictionData",
            "predictionFetchedAt" = EXCLUDED."predictionFetchedAt", "modelInfo" = EXCLUDED."modelInfo",
            "lastSyncedAt" = EXCLUDED."lastSyncedAt", "syncCount" = {TABLE}."syncCount" + 1,
            "updatedAt" = EXCLUDED."updatedAt"
        WHERE {TABLE}.status <> 'finished'
        """,
        (_new_id(), p.event_id, p.sport_key, p.home_team, p.away_team, p.league, _naive_utc(p.commence_time),
         json.dumps(odds), json.dumps(spread), json.dumps(total_line),
         json.dumps(p.model_block) if p.model_block is not None else None,
         json.dumps(p.prediction_data, default=str), now,
         json.dumps(p.prediction_data.get("model_info")) if p.prediction_data.get("model_info") else None,
         now, now, now),
    )


def publish_predictions(conn, predictions: Iterable[Prediction]) -> Dict[str, int]:
    n = 0
    with conn.cursor() as cur:
        for p in predictions:
            upsert_prediction(cur, p)
            n += 1
    conn.commit()
    return {"published": n}


def settle_finished(conn, sport_key: str, since_days: int = 14) -> Dict[str, int]:
    """Copy final scores from multisport_fixtures onto MultisportMatch rows."""
    cfg = SPORTS[sport_key]
    now = _naive_utc(datetime.now(timezone.utc))
    with conn.cursor() as cur:
        cur.execute(
            """SELECT event_id, home_team, away_team, league_name, commence_time, home_score, away_score, outcome
                 FROM multisport_fixtures
                WHERE sport_key = %s AND status = 'finished' AND outcome IN ('H','A')
                  AND commence_time > NOW() - (%s || ' days')::interval""",
            (sport_key, str(since_days)))
        rows = cur.fetchall()
        settled = 0
        for event_id, home, away, league, commence, hs, as_, outcome in rows:
            winner = home if outcome == "H" else away
            final = {"score": {"home": hs, "away": as_}, "result": outcome,
                     "result_text": f"{winner} won {max(hs, as_)}-{min(hs, as_)}", "overtime": False}
            cur.execute(
                f"""
                INSERT INTO {TABLE} (id, "eventId", sport, status, "homeTeam", "awayTeam", league, "commenceTime",
                                     "finalResult", "lastSyncedAt", "syncCount", "createdAt", "updatedAt")
                VALUES (%s, %s, %s, 'finished', %s, %s, %s, %s, %s::jsonb, %s, 1, %s, %s)
                ON CONFLICT ("eventId", sport) DO UPDATE SET
                    status = 'finished', "finalResult" = EXCLUDED."finalResult",
                    "lastSyncedAt" = EXCLUDED."lastSyncedAt", "updatedAt" = EXCLUDED."updatedAt"
                WHERE {TABLE}.status <> 'finished' OR {TABLE}."finalResult" IS NULL
                """,
                (_new_id(), event_id, sport_key, home, away, league or cfg.league_name, _naive_utc(commence),
                 json.dumps(final), now, now, now))
            settled += cur.rowcount
    conn.commit()
    return {"candidates": len(rows), "settled": settled}
