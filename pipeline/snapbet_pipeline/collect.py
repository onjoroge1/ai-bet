"""Odds collection: The Odds API /odds -> multisport_fixtures + multisport_odds_snapshots."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional

from .config import SPORTS, SportConfig
from .consensus import calculate_consensus, parse_bookmaker
from .odds_api import OddsApiClient

logger = logging.getLogger(__name__)


def _parse_ts(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def store_events(conn, events: List[Dict], cfg: SportConfig, now: datetime) -> Dict[str, int]:
    """Upsert fixtures and insert one consensus + one per-book snapshot per event."""
    fixtures_new = fixtures_seen = snapshots = 0
    with conn.cursor() as cur:
        for ev in events:
            event_id, home, away = ev.get("id"), ev.get("home_team"), ev.get("away_team")
            commence = _parse_ts(ev.get("commence_time"))
            if not (event_id and home and away and commence):
                continue
            league = ev.get("sport_title") or cfg.league_name or cfg.name
            cur.execute(
                """
                INSERT INTO multisport_fixtures (sport, sport_key, event_id, home_team, away_team,
                                                 commence_time, league_name, status, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, 'scheduled', NOW())
                ON CONFLICT (sport, event_id) DO UPDATE SET
                    home_team = EXCLUDED.home_team, away_team = EXCLUDED.away_team,
                    commence_time = EXCLUDED.commence_time,
                    league_name = COALESCE(EXCLUDED.league_name, multisport_fixtures.league_name),
                    updated_at = NOW()
                RETURNING (xmax = 0) AS inserted
                """,
                (cfg.sport, cfg.key, event_id, home, away, commence, league),
            )
            row = cur.fetchone()
            fixtures_seen += 1
            if row and row[0]:
                fixtures_new += 1

            cons = calculate_consensus(ev)
            rows = []
            if cons:
                rows.append(("consensus", True, cons, cons.get("n_bookmakers")))
            for bm in ev.get("bookmakers", []):
                parsed = parse_bookmaker(bm, home, away)
                if parsed and bm.get("key"):
                    rows.append((bm["key"], False, parsed, 1))
            for bookmaker, is_cons, d, n_books in rows:
                cur.execute(
                    """
                    INSERT INTO multisport_odds_snapshots (
                        sport, sport_key, event_id, home_team, away_team, commence_time,
                        home_odds, away_odds, draw_odds, home_prob, away_prob, draw_prob,
                        home_spread, home_spread_odds, away_spread_odds,
                        total_line, over_odds, under_odds, overround, n_bookmakers,
                        bookmaker, is_consensus, ts_recorded)
                    VALUES (%s,%s,%s,%s,%s,%s, %s,%s,NULL,%s,%s,NULL, %s,%s,%s, %s,%s,%s,%s,%s, %s,%s,%s)
                    ON CONFLICT (event_id, bookmaker, ts_recorded) DO NOTHING
                    """,
                    (cfg.sport, cfg.key, event_id, home, away, commence,
                     d.get("home_odds"), d.get("away_odds"), d.get("home_prob"), d.get("away_prob"),
                     d.get("spread"), d.get("spread_home_odds"), d.get("spread_away_odds"),
                     d.get("total"), d.get("over_odds"), d.get("under_odds"), d.get("overround"), n_books,
                     bookmaker, is_cons, now),
                )
                snapshots += cur.rowcount
    conn.commit()
    return {"events": len(events), "fixtures_seen": fixtures_seen, "fixtures_new": fixtures_new,
            "snapshots": snapshots}


def collect_odds(conn, client: OddsApiClient, sport_keys: Iterable[str],
                 now: Optional[datetime] = None, respect_season: bool = True) -> Dict[str, Dict]:
    """Fetch and store current odds for each sport. Off-season sports are skipped
    (no API credit spent) unless respect_season=False."""
    now = now or datetime.now(timezone.utc)
    results: Dict[str, Dict] = {}
    for key in sport_keys:
        cfg = SPORTS[key]
        if respect_season and not cfg.in_season(now.month):
            results[key] = {"status": "off_season"}
            continue
        try:
            events = client.get_odds(key, markets=cfg.markets, regions=cfg.regions)
            metrics = store_events(conn, events, cfg, now)
            metrics["status"] = "ok"
            results[key] = metrics
            logger.info("%s: %d events, %d snapshots", cfg.name, metrics["events"], metrics["snapshots"])
        except Exception as e:  # keep going for the other sports
            conn.rollback()
            logger.error("%s odds collection failed: %s", cfg.name, e)
            results[key] = {"status": "error", "error": str(e)}
    results["_quota"] = client.quota()
    return results
