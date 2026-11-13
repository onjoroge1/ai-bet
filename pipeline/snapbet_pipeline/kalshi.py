"""Kalshi game prices -> multisport_kalshi_snapshots (research capture).

Kalshi's market-data API is public (no key, no credits):
  GET {base}/markets?series_ticker=KXNBAGAME&status=open&limit=1000[&cursor=...]

Per sport we read the full-game winner series plus spreads, totals, team totals and
half/quarter/period winners (SERIES below). Every Kalshi series for one game shares a
game key ("26NOV13UTAHOU"): event tickers look like KXNBASPREAD-26NOV13UTAHOU and
market tickers append an outcome code (…-HOU, …-HOU8 = "Houston wins by over 7.5",
…-273 = "Over 272.5", …-TIE).

Each game is linked to its multisport_fixtures row: pro teams via their Kalshi code
(`teams.canonical_team`), college teams via the winner market's name ("Rutgers"
-> "Rutgers Scarlet Knights") — only when exactly one fixture fits. Unmatched games
are still stored (event_id NULL) and backfilled once the books list them.

To keep storage small we capture only pre-game prices for games starting within
CAPTURE_HORIZON, and skip ladder rungs nobody is trading (no quote, or priced
below 3¢ / above 97¢). Nothing here trades or authenticates.
"""
from __future__ import annotations

import logging
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Callable, Dict, Iterable, List, Optional, Tuple

import requests
from psycopg2.extras import execute_values

from .teams import canonical_team

logger = logging.getLogger(__name__)

KALSHI_BASE_URL = "https://api.elections.kalshi.com/trade-api/v2"

# Odds API sport key -> [(Kalshi series, market_type)]; the first entry is the winner market.
SERIES: Dict[str, List[Tuple[str, str]]] = {
    "americanfootball_nfl": [("KXNFLGAME", "game"), ("KXNFLSPREAD", "spread"), ("KXNFLTOTAL", "total"),
                             ("KXNFLTEAMTOTAL", "team_total"), ("KXNFL1H", "1h"), ("KXNFL1Q", "1q")],
    "basketball_nba": [("KXNBAGAME", "game"), ("KXNBASPREAD", "spread"), ("KXNBATOTAL", "total"),
                       ("KXNBATEAMTOTAL", "team_total"), ("KXNBA1H", "1h"), ("KXNBA1Q", "1q")],
    "icehockey_nhl": [("KXNHLGAME", "game"), ("KXNHLSPREAD", "spread"), ("KXNHLTOTAL", "total"),
                      ("KXNHLTEAMTOTAL", "team_total"), ("KXNHL1P", "1p")],
    "basketball_ncaab": [("KXNCAAMBGAME", "game"), ("KXNCAAMBSPREAD", "spread"), ("KXNCAAMBTOTAL", "total")],
}

# Kalshi codes that the shared alias tables don't cover.
CODE_OVERRIDES: Dict[Tuple[str, str], str] = {
    ("icehockey_nhl", "LA"): "Los Angeles Kings",
}
COLLEGE = {"basketball_ncaab"}

# A fixture matches when its commence_time is within this window of Kalshi's
# occurrence_datetime (roughly the expected game end, not the start).
MATCH_WINDOW = timedelta(hours=18)
# Unmatched games: assume they start this long before occurrence_datetime.
ASSUMED_DURATION = timedelta(hours=3)
WEAK_MATCH_WINDOW = timedelta(hours=4)
CAPTURE_HORIZON = timedelta(hours=24)
LADDER_MIN, LADDER_MAX = 0.03, 0.97
# Ladders (spread/total/team-total lines) are the bulk of the rows. Keep the rungs
# nearest 50/50 per ladder (the comparable "main line"), every LADDER_EVERY_HOURS,
# plus every capture in the last CLOSING_WINDOW before the start (the closing price).
LADDER_RUNGS = 3
LADDER_EVERY_HOURS = 3
CLOSING_WINDOW = timedelta(hours=2)
REQUEST_SPACING = 0.25  # seconds between calls; Kalshi rate-limits bursts (429)


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


_TOKEN_MAP = {"mt": "mount", "intl": "international", "univ": "university"}


def _norm(name: str) -> str:
    """'NC St.' -> 'nc state', 'St. Thomas' -> 'saint thomas', "Florida Int'l" -> 'florida international'."""
    text = re.sub(r"[^a-z0-9 ]", " ", (name or "").lower().replace("&", " and ").replace("'", ""))
    toks = text.split()
    out = []
    for i, t in enumerate(toks):
        if t == "st":
            t = "saint" if i == 0 else "state"
        out.append(_TOKEN_MAP.get(t, t))
    return " ".join(out)


def outcome_code(market: Dict) -> str:
    """Suffix after the event ticker: 'HOU', 'HOU8', '273', 'TIE'."""
    return market["ticker"][len(market["event_ticker"]) + 1:]


def team_code(market: Dict, market_type: str) -> Optional[str]:
    code = outcome_code(market)
    if market_type == "total" or code.upper() == "TIE":
        return None
    if market_type in ("spread", "team_total"):
        code = re.sub(r"\d+$", "", code)
    return code or None


def team_for_code(sport_key: str, code: Optional[str]) -> Optional[str]:
    if not code or sport_key in COLLEGE:
        return None
    return CODE_OVERRIDES.get((sport_key, code)) or canonical_team(sport_key, code)


def team_for_market(sport_key: str, ticker: str) -> Optional[str]:
    """Winner-market ticker -> canonical team (pro sports)."""
    return team_for_code(sport_key, ticker.rsplit("-", 1)[-1])


def _mid(market: Dict) -> Optional[float]:
    bid, ask = _num(market.get("yes_bid_dollars")) or 0.0, _num(market.get("yes_ask_dollars")) or 0.0
    quotes = [p for p in (bid, ask) if p > 0]
    return sum(quotes) / len(quotes) if quotes else None


def is_ladder_quiet(market: Dict) -> bool:
    mid = _mid(market)
    return mid is None or mid < LADDER_MIN or mid > LADDER_MAX


def _is_ladder(market: Dict) -> bool:
    return market.get("strike_type") == "greater" or market.get("floor_strike") is not None


def main_rungs(ms: List[Tuple[Dict, str]], keep: int = LADDER_RUNGS) -> set:
    """Tickers of the `keep` traded rungs nearest 50% in each ladder (market type x team)."""
    ladders: Dict[Tuple[str, Optional[str]], List[Tuple[float, str]]] = {}
    for m, mtype in ms:
        if _is_ladder(m) and not is_ladder_quiet(m):
            ladders.setdefault((mtype, team_code(m, mtype)), []).append((abs(_mid(m) - 0.5), m["ticker"]))
    return {t for rungs in ladders.values() for _, t in sorted(rungs)[:keep]}


def fetch_markets(series: str, base_url: str = KALSHI_BASE_URL,
                  fetch: Optional[Callable[..., requests.Response]] = None, timeout: int = 30,
                  max_pages: int = 10, sleep: Callable[[float], None] = time.sleep) -> List[Dict]:
    fetch = fetch or requests.get
    out: List[Dict] = []
    cursor = None
    for _ in range(max_pages):
        params = {"series_ticker": series, "status": "open", "limit": 1000}
        if cursor:
            params["cursor"] = cursor
        for attempt in range(4):
            resp = fetch(f"{base_url.rstrip('/')}/markets", params=params, timeout=timeout)
            if resp.status_code != 429:
                break
            sleep(2 ** attempt)
        if resp.status_code != 200:
            raise KalshiError(f"Kalshi returned {resp.status_code} for {series}")
        data = resp.json()
        out.extend(data.get("markets") or [])
        cursor = data.get("cursor")
        sleep(REQUEST_SPACING)
        if not cursor:
            break
    return out


def _load_fixtures(cur, sport_key: str, now: datetime, horizon: timedelta) -> List[Tuple[str, str, str, datetime]]:
    cur.execute("""SELECT event_id, home_team, away_team, commence_time FROM multisport_fixtures
                    WHERE sport_key = %s AND commence_time BETWEEN %s AND %s""",
                (sport_key, now - MATCH_WINDOW - ASSUMED_DURATION, now + horizon + MATCH_WINDOW + ASSUMED_DURATION))
    return cur.fetchall()


def _name_fits(fixture_team: str, kalshi_name: str) -> bool:
    f, k = _norm(fixture_team), _norm(kalshi_name)
    return bool(k) and (f == k or f.startswith(k + " "))


def match_game(fixtures, sport_key: str, codes: Dict[str, Optional[str]], around: Optional[datetime]):
    """codes: {kalshi team code: winner-market name or None}. Returns
    ((event_id, home, away, commence), {code: team}) or (None, {code: team-or-None})."""
    pro = {c: team_for_code(sport_key, c) for c in codes}
    if around is None or len(codes) != 2:
        return None, pro
    nearby = [fx for fx in fixtures if abs(fx[3] - around) <= MATCH_WINDOW]
    if sport_key not in COLLEGE and all(pro.values()):
        cands = [(fx, pro) for fx in nearby if {fx[1], fx[2]} == set(pro.values())]
        cands.sort(key=lambda c: abs((c[0][3] - around).total_seconds()))
        return cands[0] if cands else (None, pro)
    # Names: both teams fit -> strong. One team fits -> accepted only if the start time
    # agrees and that name fits exactly one team on the slate (teams play once a day).
    a, b = list(codes)
    strong, weak = [], []
    for fx in nearby:
        _, home, away, start = fx
        for x, y in ((a, b), (b, a)):
            fits = [bool(codes[x]) and _name_fits(home, codes[x]), bool(codes[y]) and _name_fits(away, codes[y])]
            if all(fits):
                strong.append((fx, {x: home, y: away}))
            elif any(fits) and abs(start - (around - ASSUMED_DURATION)) <= WEAK_MATCH_WINDOW:
                name = codes[x] if fits[0] else codes[y]
                if sum(_name_fits(t, name) for f in nearby for t in (f[1], f[2])) == 1:
                    weak.append((fx, {x: home, y: away}))
    for cands in (strong, weak):
        if len({c[0][0] for c in cands}) == 1:
            return cands[0]
        if cands:
            return None, pro  # ambiguous (e.g. two "Miami"s) — never guess
    return None, pro


def store_markets(conn, sport_key: str, markets: List[Tuple[Dict, str]], now: datetime,
                  horizon: timedelta = CAPTURE_HORIZON, ladders: Optional[bool] = None) -> Dict[str, int]:
    """markets: [(kalshi market, market_type)] for one sport. `ladders` (default: on
    the LADDER_EVERY_HOURS cadence) says whether ladder rungs are captured this run;
    games inside CLOSING_WINDOW always get them."""
    if ladders is None:
        ladders = now.hour % LADDER_EVERY_HOURS == 0
    games: Dict[str, List[Tuple[Dict, str]]] = {}
    for m, mtype in markets:
        if m.get("ticker") and m.get("event_ticker") and "-" in m["event_ticker"]:
            games.setdefault(m["event_ticker"].split("-", 1)[1], []).append((m, mtype))
    stats = {"games": 0, "matched": 0, "unmatched": 0, "skipped_ladder": 0, "snapshots": 0}
    rows: List[tuple] = []
    links: List[tuple] = []
    with conn.cursor() as cur:
        fixtures = _load_fixtures(cur, sport_key, now, horizon)
        for game_key, ms in games.items():
            when = next((_ts(m.get("occurrence_datetime") or m.get("expected_expiration_time"))
                         for m, _ in ms if m.get("occurrence_datetime") or m.get("expected_expiration_time")), None)
            codes: Dict[str, Optional[str]] = {}
            for m, mtype in ms:
                c = team_code(m, mtype)
                if c:
                    codes.setdefault(c, None)
                    if mtype == "game":
                        codes[c] = m.get("yes_sub_title")
            fx, teams = match_game(fixtures, sport_key, codes, when)
            start = fx[3] if fx else (when - ASSUMED_DURATION if when else None)
            if start is None or start <= now or start > now + horizon:
                continue  # in play, finished, or too far out
            stats["games"] += 1
            stats["matched" if fx else "unmatched"] += 1
            keep = main_rungs(ms) if (ladders or start - now <= CLOSING_WINDOW) else set()
            for m, mtype in ms:
                ladder = _is_ladder(m)
                if ladder and m["ticker"] not in keep:
                    stats["skipped_ladder"] += 1
                    continue
                code = team_code(m, mtype)
                team = teams.get(code) if code else None
                rows.append(
                    (sport_key, fx[0] if fx else None, m["ticker"], m["event_ticker"], game_key, mtype,
                     _num(m.get("floor_strike")) if ladder else None, m.get("yes_sub_title"),
                     team, (team == fx[1]) if fx and team else None,
                     _num(m.get("yes_bid_dollars")), _num(m.get("yes_ask_dollars")),
                     _num(m.get("last_price_dollars")), _num(m.get("volume_fp")),
                     _num(m.get("volume_24h_fp")), _num(m.get("open_interest_fp")),
                     m.get("status"), when, now))
            if fx:
                links.append((fx[0], game_key, fx[1], teams))
        if rows:
            inserted = execute_values(
                cur,
                """INSERT INTO multisport_kalshi_snapshots (
                       sport_key, event_id, kalshi_ticker, kalshi_event, game_key, market_type, line, outcome,
                       team, is_home, yes_bid, yes_ask, last_price, volume, volume_24h, open_interest,
                       market_status, occurrence_time, ts_recorded)
                   VALUES %s ON CONFLICT (kalshi_ticker, ts_recorded) DO NOTHING RETURNING 1""",
                rows, page_size=500, fetch=True)
            stats["snapshots"] = len(inserted)
        # Link captures taken before the books listed a game (only rows still unlinked).
        for event_id, game_key, home, teams in links:
            cur.execute("""SELECT 1 FROM multisport_kalshi_snapshots
                            WHERE sport_key = %s AND game_key = %s AND event_id IS NULL LIMIT 1""",
                        (sport_key, game_key))
            if not cur.fetchone():
                continue
            cur.execute("""UPDATE multisport_kalshi_snapshots SET event_id = %s
                            WHERE sport_key = %s AND game_key = %s AND event_id IS NULL""",
                        (event_id, sport_key, game_key))
            for code, team in teams.items():
                if team:
                    cur.execute("""UPDATE multisport_kalshi_snapshots SET team = %s, is_home = %s
                                    WHERE sport_key = %s AND game_key = %s AND team IS NULL
                                      AND market_type <> 'total' AND kalshi_ticker ~ %s""",
                                (team, team == home, sport_key, game_key, r"-" + re.escape(code) + r"\d*$"))
            cur.execute("""UPDATE multisport_kalshi_snapshots SET is_home = (team = %s)
                            WHERE sport_key = %s AND game_key = %s AND team IS NOT NULL AND is_home IS NULL""",
                        (home, sport_key, game_key))
    conn.commit()
    return stats


def collect_kalshi(conn, sport_keys: Iterable[str], now: Optional[datetime] = None,
                   fetch: Optional[Callable[..., requests.Response]] = None,
                   base_url: str = KALSHI_BASE_URL, sleep: Callable[[float], None] = time.sleep) -> Dict[str, Dict]:
    """Capture open Kalshi markets for each sport. A failing series is recorded and
    skipped; a failing sport never stops the others."""
    now = now or datetime.now(timezone.utc)
    out: Dict[str, Dict] = {}
    for key in sport_keys:
        series = SERIES.get(key)
        if not series:
            out[key] = {"status": "no_kalshi_series"}
            continue
        markets: List[Tuple[Dict, str]] = []
        errors: Dict[str, str] = {}
        for s, mtype in series:
            try:
                markets.extend((m, mtype) for m in fetch_markets(s, base_url, fetch, sleep=sleep))
            except Exception as e:
                errors[s] = str(e)
                logger.error("kalshi %s failed: %s", s, e)
        try:
            res = store_markets(conn, key, markets, now)
        except Exception as e:
            conn.rollback()
            logger.error("kalshi %s store failed: %s", key, e)
            out[key] = {"status": "error", "error": str(e)}
            continue
        res["status"] = "ok" if not errors else ("error" if len(errors) == len(series) else "partial")
        if errors:
            res["errors"] = errors
        out[key] = res
    return out
