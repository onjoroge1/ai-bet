"""Kalshi game-winner prices -> multisport_kalshi_snapshots (research capture).

Kalshi's market-data API is public (no key, no credits):
  GET {base}/markets?series_ticker=KXNBAGAME&status=open&limit=1000[&cursor=...]

Each game is a Kalshi *event* (e.g. KXNBAGAME-26NOV13UTAHOU) with one market per
team (…-HOU = "Houston wins"). The ticker suffix is a team code, which
`teams.canonical_team` resolves to the Odds API name; the market is then linked
to the multisport_fixtures row with both teams and the nearest commence_time.
Unmatched markets are still stored (event_id NULL) so nothing is silently lost.

Nothing here trades or authenticates — it only reads public prices.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Callable, Dict, Iterable, List, Optional, Tuple

import requests

from .teams import canonical_team

logger = logging.getLogger(__name__)

KALSHI_BASE_URL = "https://api.elections.kalshi.com/trade-api/v2"

# Odds API sport key -> Kalshi series for the full-game winner market.
SERIES: Dict[str, str] = {
    "americanfootball_nfl": "KXNFLGAME",
    "basketball_nba": "KXNBAGAME",
    "icehockey_nhl": "KXNHLGAME",
}

# Kalshi codes that the shared alias tables don't cover.
CODE_OVERRIDES: Dict[Tuple[str, str], str] = {
    ("icehockey_nhl", "LA"): "Los Angeles Kings",
}

# A fixture matches when its commence_time is within this window of Kalshi's
# occurrence_datetime (which is roughly the expected game end, not tip-off).
MATCH_WINDOW = timedelta(hours=18)


class KalshiError(RuntimeError):
    pass


def _ts(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _num(value) -> Optional[float]:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def team_for_market(sport_key: str, ticker: str) -> Optional[str]:
    code = ticker.rsplit("-", 1)[-1]
    return CODE_OVERRIDES.get((sport_key, code)) or canonical_team(sport_key, code)


def fetch_markets(series: str, base_url: str = KALSHI_BASE_URL,
                  fetch: Optional[Callable[..., requests.Response]] = None, timeout: int = 30,
                  max_pages: int = 10) -> List[Dict]:
    fetch = fetch or requests.get
    out: List[Dict] = []
    cursor = None
    for _ in range(max_pages):
        params = {"series_ticker": series, "status": "open", "limit": 1000}
        if cursor:
            params["cursor"] = cursor
        resp = fetch(f"{base_url.rstrip('/')}/markets", params=params, timeout=timeout)
        if resp.status_code != 200:
            raise KalshiError(f"Kalshi returned {resp.status_code} for {series}")
        data = resp.json()
        out.extend(data.get("markets") or [])
        cursor = data.get("cursor")
        if not cursor:
            break
    return out


def _find_fixture(cur, sport_key: str, home_or_away: Iterable[str],
                  around: Optional[datetime]) -> Optional[Tuple[str, str, str]]:
    teams = list(home_or_away)
    if len(teams) != 2 or not all(teams) or around is None:
        return None
    cur.execute(
        """SELECT event_id, home_team, away_team FROM multisport_fixtures
            WHERE sport_key = %s AND home_team = ANY(%s) AND away_team = ANY(%s) AND home_team <> away_team
              AND commence_time BETWEEN %s AND %s
            ORDER BY ABS(EXTRACT(EPOCH FROM commence_time - %s)) LIMIT 1""",
        (sport_key, teams, teams, around - MATCH_WINDOW, around + MATCH_WINDOW, around),
    )
    return cur.fetchone()


def store_markets(conn, sport_key: str, markets: List[Dict], now: datetime) -> Dict[str, int]:
    by_event: Dict[str, List[Dict]] = {}
    for m in markets:
        if m.get("ticker") and m.get("event_ticker"):
            by_event.setdefault(m["event_ticker"], []).append(m)
    stored = matched = unmatched_events = 0
    with conn.cursor() as cur:
        for ev_ticker, ms in by_event.items():
            teams = {m["ticker"]: team_for_market(sport_key, m["ticker"]) for m in ms}
            when = _ts(ms[0].get("occurrence_datetime") or ms[0].get("expected_expiration_time"))
            fx = _find_fixture(cur, sport_key, set(teams.values()), when)
            if fx:
                matched += 1
            else:
                unmatched_events += 1
                logger.info("kalshi %s: no fixture for %s (%s)", sport_key, ev_ticker, sorted(map(str, teams.values())))
            for m in ms:
                team = teams[m["ticker"]]
                cur.execute(
                    """INSERT INTO multisport_kalshi_snapshots (
                           sport_key, event_id, kalshi_ticker, kalshi_event, team, is_home,
                           yes_bid, yes_ask, last_price, volume, volume_24h, open_interest,
                           market_status, occurrence_time, ts_recorded)
                       VALUES (%s,%s,%s,%s,%s,%s, %s,%s,%s,%s,%s,%s, %s,%s,%s)
                       ON CONFLICT (kalshi_ticker, ts_recorded) DO NOTHING""",
                    (sport_key, fx[0] if fx else None, m["ticker"], ev_ticker, team,
                     (team == fx[1]) if fx and team else None,
                     _num(m.get("yes_bid_dollars")), _num(m.get("yes_ask_dollars")),
                     _num(m.get("last_price_dollars")), _num(m.get("volume_fp")),
                     _num(m.get("volume_24h_fp")), _num(m.get("open_interest_fp")),
                     m.get("status"), when, now),
                )
                stored += cur.rowcount
            if fx:  # link captures taken before the books listed this game
                cur.execute("""UPDATE multisport_kalshi_snapshots SET event_id = %s, is_home = (team = %s)
                                WHERE kalshi_event = %s AND event_id IS NULL""", (fx[0], fx[1], ev_ticker))
    conn.commit()
    return {"events": len(by_event), "matched": matched, "unmatched": unmatched_events, "snapshots": stored}


def collect_kalshi(conn, sport_keys: Iterable[str], now: Optional[datetime] = None,
                   fetch: Optional[Callable[..., requests.Response]] = None,
                   base_url: str = KALSHI_BASE_URL) -> Dict[str, Dict]:
    """Capture open Kalshi game markets for each sport. A failing sport is
    recorded and skipped so the others still run."""
    now = now or datetime.now(timezone.utc)
    out: Dict[str, Dict] = {}
    for key in sport_keys:
        series = SERIES.get(key)
        if not series:
            out[key] = {"status": "no_kalshi_series"}
            continue
        try:
            res = store_markets(conn, key, fetch_markets(series, base_url, fetch), now)
            res["status"] = "ok"
            out[key] = res
        except Exception as e:
            conn.rollback()
            logger.error("kalshi %s failed: %s", key, e)
            out[key] = {"status": "error", "error": str(e)}
    return out
