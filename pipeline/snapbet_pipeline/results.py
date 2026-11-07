"""Results: The Odds API /scores -> fixtures outcome, multisport_match_results, multisport_schedule.

The Odds API caps `daysFrom` by plan (3 on the standard tiers). `collect_results`
steps the window down on a 4xx so a backfill request for 30 days still works
on a plan that only allows 3.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional

from .config import SPORTS, SportConfig
from .odds_api import OddsApiClient, OddsApiError

logger = logging.getLogger(__name__)

STEP_DOWN = (90, 60, 30, 14, 7, 3, 2, 1)


def _scores_for(game: Dict) -> tuple[Optional[int], Optional[int]]:
    home, away = game.get("home_team"), game.get("away_team")
    hs = as_ = None
    for s in game.get("scores") or []:
        try:
            val = int(float(s.get("score")))
        except (TypeError, ValueError):
            continue
        if s.get("name") == home:
            hs = val
        elif s.get("name") == away:
            as_ = val
    return hs, as_


def store_scores(conn, games: List[Dict], cfg: SportConfig) -> Dict[str, int]:
    finals = schedule = fixtures_updated = 0
    with conn.cursor() as cur:
        for g in games:
            event_id, home, away = g.get("id"), g.get("home_team"), g.get("away_team")
            if not (event_id and home and away):
                continue
            try:
                game_dt = datetime.fromisoformat(str(g.get("commence_time")).replace("Z", "+00:00"))
            except ValueError:
                game_dt = datetime.now(timezone.utc)
            completed = bool(g.get("completed"))
            hs, as_ = _scores_for(g)
            if completed and hs is not None and as_ is not None:
                result = "H" if hs > as_ else ("A" if as_ > hs else None)  # ties (NFL) -> None
                status = "final"
            else:
                result, status = None, ("in_progress" if hs is not None else "scheduled")

            cur.execute(
                """
                INSERT INTO multisport_schedule (sport_key, event_id, home_team, away_team, commence_time, status, updated_at)
                VALUES (%s,%s,%s,%s,%s,%s,NOW())
                ON CONFLICT (sport_key, event_id) DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()
                """,
                (cfg.key, event_id, home, away, game_dt, status),
            )
            schedule += 1

            if status == "final" and result is not None:
                cur.execute(
                    """
                    INSERT INTO multisport_match_results (sport_key, event_id, game_date, home_team, away_team,
                                                          home_score, away_score, result, status, updated_at)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,'final',NOW())
                    ON CONFLICT (sport_key, event_id) DO UPDATE SET
                        home_score = EXCLUDED.home_score, away_score = EXCLUDED.away_score,
                        result = EXCLUDED.result, status = 'final', updated_at = NOW()
                    """,
                    (cfg.key, event_id, game_dt, home, away, hs, as_, result),
                )
                finals += 1
                cur.execute(
                    """
                    UPDATE multisport_fixtures
                       SET status = 'finished', home_score = %s, away_score = %s, outcome = %s, updated_at = NOW()
                     WHERE sport_key = %s AND event_id = %s AND status <> 'finished'
                    """,
                    (hs, as_, result, cfg.key, event_id),
                )
                fixtures_updated += cur.rowcount
    conn.commit()
    return {"games": len(games), "finals": finals, "schedule_rows": schedule,
            "fixtures_finished": fixtures_updated}


def fetch_scores_stepdown(client: OddsApiClient, sport_key: str, days_from: int) -> tuple[List[Dict], int]:
    """Try the requested window, stepping down until the plan accepts it."""
    windows = [d for d in STEP_DOWN if d <= days_from] or [1]
    last_err: Optional[Exception] = None
    for d in windows:
        try:
            return client.get_scores(sport_key, days_from=d), d
        except OddsApiError as e:
            last_err = e
            if "429" in str(e) or "401" in str(e):
                raise
            logger.info("%s: scores window %dd rejected (%s), stepping down", sport_key, d, e)
    raise last_err or OddsApiError("scores fetch failed")


def collect_results(conn, client: OddsApiClient, sport_keys: Iterable[str],
                    days_from: Optional[int] = None, now: Optional[datetime] = None,
                    respect_season: bool = True) -> Dict[str, Dict]:
    now = now or datetime.now(timezone.utc)
    out: Dict[str, Dict] = {}
    for key in sport_keys:
        cfg = SPORTS[key]
        if respect_season and not cfg.in_season(now.month):
            out[key] = {"status": "off_season"}
            continue
        try:
            games, used = fetch_scores_stepdown(client, key, days_from or cfg.results_lookback_days)
            m = store_scores(conn, games, cfg)
            m.update(status="ok", days_from=used)
            out[key] = m
            logger.info("%s: %d games, %d finals", cfg.name, m["games"], m["finals"])
        except Exception as e:
            conn.rollback()
            logger.error("%s results failed: %s", cfg.name, e)
            out[key] = {"status": "error", "error": str(e)}
    out["_quota"] = client.quota()
    return out
