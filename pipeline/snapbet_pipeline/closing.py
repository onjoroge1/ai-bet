"""Odds as close to the start as we can afford.

Two captures, both run from `snapbet-pipeline run`:

* Closing moneyline/spread/total. The hourly pull is skipped when odds are under
  --min-collect-gap minutes old, so the last snapshot before a game could be up to an
  hour (often several, when GitHub drops runs) before the start. `sports_needing_close`
  finds sports with a game starting within CLOSE_WINDOW whose latest consensus is older
  than CLOSE_STALE; `run` then re-pulls just those sports (3 credits a sport).
* NHL regulation-time 3-way (home / draw / away after 60 minutes), `h2h_3_way`. It is an
  event-odds market (one call per game, 1 credit), pulled once per game in the run that
  falls within REG_WINDOW before puck drop -> multisport_regulation_odds.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from statistics import mean
from typing import Dict, Iterable, List, Optional

from .config import SPORTS
from .odds_api import OddsApiClient

logger = logging.getLogger(__name__)

CLOSE_WINDOW = timedelta(minutes=45)
CLOSE_STALE = timedelta(minutes=20)
REG_WINDOW = timedelta(minutes=60)
REG_SPORTS = ("icehockey_nhl",)
REG_MARKET = "h2h_3_way"


def sports_needing_close(conn, sport_keys: Iterable[str], now: Optional[datetime] = None,
                         window: timedelta = CLOSE_WINDOW, stale: timedelta = CLOSE_STALE) -> List[str]:
    """Sports with a game starting in (now, now + window] whose latest consensus is older than `stale`."""
    now = now or datetime.now(timezone.utc)
    keys = list(sport_keys)
    if not keys:
        return []
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT DISTINCT f.sport_key
              FROM multisport_fixtures f
             WHERE f.sport_key = ANY(%s) AND f.commence_time > %s AND f.commence_time <= %s
               AND COALESCE((SELECT MAX(o.ts_recorded) FROM multisport_odds_snapshots o
                              WHERE o.event_id = f.event_id AND o.is_consensus), '-infinity') < %s
            """,
            (keys, now, now + window, now - stale),
        )
        found = {r[0] for r in cur.fetchall()}
    return [k for k in keys if k in found]


def parse_three_way(event: Dict) -> Dict[str, Dict]:
    """Event-odds JSON -> {book_key: {home_odds, draw_odds, away_odds, *_prob, overround}} plus 'consensus'."""
    home, away = event.get("home_team"), event.get("away_team")
    books: Dict[str, Dict] = {}
    for bm in event.get("bookmakers", []):
        for mk in bm.get("markets", []):
            if mk.get("key") != REG_MARKET:
                continue
            oc = {o.get("name"): o.get("price") for o in mk.get("outcomes", [])}
            h, d, a = oc.get(home), oc.get("Draw"), oc.get(away)
            if bm.get("key") and all(p and p > 1 for p in (h, d, a)):
                books[bm["key"]] = _devig(float(h), float(d), float(a))
    if books:
        cons = _devig(mean(b["home_odds"] for b in books.values()), mean(b["draw_odds"] for b in books.values()),
                      mean(b["away_odds"] for b in books.values()))
        cons["n_bookmakers"] = len(books)
        books["consensus"] = cons
    return books


def _devig(h: float, d: float, a: float) -> Dict:
    inv = (1 / h, 1 / d, 1 / a)
    over = sum(inv)
    return {"home_odds": round(h, 3), "draw_odds": round(d, 3), "away_odds": round(a, 3),
            "home_prob": round(inv[0] / over, 4), "draw_prob": round(inv[1] / over, 4),
            "away_prob": round(inv[2] / over, 4), "overround": round(over, 4)}


def due_regulation_games(conn, sport_key: str, now: datetime, window: timedelta = REG_WINDOW) -> List[tuple]:
    """(event_id, home, away, commence) for games starting within `window` with no regulation odds yet."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT f.event_id, f.home_team, f.away_team, f.commence_time
              FROM multisport_fixtures f
             WHERE f.sport_key = %s AND f.status <> 'finished'
               AND f.commence_time > %s AND f.commence_time <= %s
               AND NOT EXISTS (SELECT 1 FROM multisport_regulation_odds r WHERE r.event_id = f.event_id)
             ORDER BY f.commence_time
            """,
            (sport_key, now, now + window),
        )
        return cur.fetchall()


def collect_regulation(conn, client: OddsApiClient, sport_keys: Iterable[str], now: Optional[datetime] = None,
                       window: timedelta = REG_WINDOW) -> Dict:
    now = now or datetime.now(timezone.utc)
    out: Dict = {}
    for key in (k for k in sport_keys if k in REG_SPORTS):
        if not SPORTS[key].in_season(now.month):
            out[key] = {"status": "off_season"}
            continue
        stats = {"due": 0, "pulled": 0, "rows": 0, "status": "ok"}
        try:
            games = due_regulation_games(conn, key, now, window)
            stats["due"] = len(games)
            for event_id, home, away, commence in games:
                ev = client.get_event_odds(key, event_id, [REG_MARKET])
                stats["pulled"] += 1
                books = parse_three_way(dict(ev, home_team=ev.get("home_team") or home,
                                             away_team=ev.get("away_team") or away))
                with conn.cursor() as cur:
                    for book, d in books.items():
                        cur.execute(
                            """
                            INSERT INTO multisport_regulation_odds (
                                sport_key, event_id, commence_time, home_team, away_team, bookmaker, is_consensus,
                                home_odds, draw_odds, away_odds, home_prob, draw_prob, away_prob, overround,
                                n_bookmakers, ts_recorded)
                            VALUES (%s,%s,%s,%s,%s,%s,%s, %s,%s,%s,%s,%s,%s,%s, %s,%s)
                            ON CONFLICT (event_id, bookmaker, ts_recorded) DO NOTHING
                            """,
                            (key, event_id, commence, home, away, book, book == "consensus",
                             d["home_odds"], d["draw_odds"], d["away_odds"], d["home_prob"], d["draw_prob"],
                             d["away_prob"], d["overround"], d.get("n_bookmakers", 1), now),
                        )
                        stats["rows"] += cur.rowcount
                conn.commit()
        except Exception as e:  # keep going; this is a research capture
            conn.rollback()
            logger.error("%s regulation odds failed: %s", key, e)
            stats.update(status="error", error=str(e))
        out[key] = stats
    out["_quota"] = client.quota()
    return out
