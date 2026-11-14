"""Player prop lines (The Odds API event odds) -> multisport_player_props.

Each game is pulled ONCE, in the hourly run that falls PULL_WINDOW before tip-off
(normally 30-90 minutes out), so the stored line is close to the closing line.
Cost: 1 credit per market per region per game (4 markets x us = 4 credits; an NBA
night of ~7 games is ~28 credits). The free /events endpoint finds the games.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Iterable, List, Optional, Tuple

from psycopg2.extras import execute_values

from .odds_api import OddsApiClient

logger = logging.getLogger(__name__)

PROP_MARKETS: Dict[str, Tuple[str, ...]] = {
    "basketball_nba": ("player_points", "player_rebounds", "player_assists", "player_threes"),
}
PULL_WINDOW = timedelta(minutes=90)


def _ts(v: Optional[str]) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(v.replace("Z", "+00:00")) if v else None
    except ValueError:
        return None


def parse_event_props(event: Dict) -> List[Dict]:
    """Event-odds JSON -> one row per book x market x player x line, Over and Under paired."""
    rows: Dict[tuple, Dict] = {}
    for bm in event.get("bookmakers", []):
        for mk in bm.get("markets", []):
            for o in mk.get("outcomes", []):
                player, side = o.get("description"), (o.get("name") or "").lower()
                if not (player and side in ("over", "under") and o.get("price")):
                    continue
                k = (bm.get("key"), mk.get("key"), player, o.get("point"))
                r = rows.setdefault(k, {"bookmaker": k[0], "market": k[1], "player_name": player, "line": k[3],
                                        "over_price": None, "under_price": None,
                                        "book_update": _ts(mk.get("last_update") or bm.get("last_update"))})
                r[f"{side}_price"] = float(o["price"])
    return list(rows.values())


def due_events(events: List[Dict], already: set, now: datetime, window: timedelta = PULL_WINDOW) -> List[Dict]:
    out = []
    for ev in events:
        start = _ts(ev.get("commence_time"))
        if start and now < start <= now + window and ev.get("id") not in already:
            out.append(ev)
    return sorted(out, key=lambda e: e["commence_time"])


def collect_props(conn, client: OddsApiClient, sport_keys: Iterable[str], now: Optional[datetime] = None,
                  max_credits: Optional[int] = None, window: timedelta = PULL_WINDOW) -> Dict:
    now = now or datetime.now(timezone.utc)
    out: Dict = {}
    spent = 0
    for key in sport_keys:
        markets = PROP_MARKETS.get(key)
        if not markets:
            continue
        stats = {"due": 0, "pulled": 0, "rows": 0, "status": "ok"}
        try:
            events = client.get_events(key)
            with conn.cursor() as cur:
                ids = [e["id"] for e in events if e.get("id")]
                cur.execute("SELECT DISTINCT event_id FROM multisport_player_props WHERE event_id = ANY(%s)", (ids,))
                already = {r[0] for r in cur.fetchall()}
                for ev in due_events(events, already, now, window):
                    stats["due"] += 1
                    if max_credits is not None and spent + len(markets) > max_credits:
                        stats["status"] = "credit_cap"
                        break
                    data = client.get_event_odds(key, ev["id"], markets)
                    spent += len(markets)
                    rows = parse_event_props(data)
                    if rows:
                        execute_values(cur, """
                            INSERT INTO multisport_player_props (sport_key, event_id, commence_time, home_team, away_team,
                                bookmaker, market, player_name, line, over_price, under_price, book_update, ts_recorded)
                            VALUES %s ON CONFLICT DO NOTHING""",
                            [(key, ev["id"], _ts(ev.get("commence_time")), ev.get("home_team"), ev.get("away_team"),
                              r["bookmaker"], r["market"], r["player_name"], r["line"], r["over_price"],
                              r["under_price"], r["book_update"], now) for r in rows])
                    conn.commit()
                    stats["pulled"] += 1
                    stats["rows"] += len(rows)
        except Exception as e:
            conn.rollback()
            logger.error("props %s failed: %s", key, e)
            stats.update(status="error", error=str(e))
        out[key] = stats
    out["_credits_spent_estimate"] = spent
    out["_quota"] = client.quota()
    return out
