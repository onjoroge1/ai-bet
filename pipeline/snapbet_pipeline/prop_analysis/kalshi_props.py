"""Kalshi player props, market rules and settlements (public API, no key, no credits).

  collect_player_props: open player-prop markets (points, rebounds, assists, threes; NFL yards,
      receptions; NHL goals, points, assists) -> multisport_kalshi_markets (ticker, rules) and a
      quote row in multisport_kalshi_snapshots (market_type = the Odds API market name).
  settle: for games that have finished, read every market of each Kalshi event we hold quotes for
      (game, spread, total, team total, periods, player props) and store Kalshi's own result,
      settlement value and rules. result '' with a settlement value = settled at a fair price.
  backfill: settled player-prop markets since a date, with Kalshi's hourly candles as quotes
      (quote_source = 'candle_1h': the bid/ask at the END of each hour, so a quote with
      ts_recorded <= a prediction time was really available then).
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Callable, Dict, Iterable, List, Optional, Tuple

import requests
from psycopg2.extras import execute_values

from ..kalshi import KALSHI_BASE_URL, REQUEST_SPACING, _num, _ts

logger = logging.getLogger(__name__)

# Kalshi series -> Odds API market name (so Kalshi and sportsbook lines share a statistic name)
PLAYER_SERIES: Dict[str, Dict[str, str]] = {
    "basketball_nba": {"KXNBAPTS": "player_points", "KXNBAREB": "player_rebounds", "KXNBAAST": "player_assists",
                       "KXNBA3PT": "player_threes"},
    "americanfootball_nfl": {"KXNFLPASSYDS": "player_pass_yds", "KXNFLRSHYDS": "player_rush_yds",
                             "KXNFLRECYDS": "player_reception_yds", "KXNFLREC": "player_receptions"},
    "icehockey_nhl": {"KXNHLGOAL": "player_goals", "KXNHLPTS": "player_points", "KXNHLAST": "player_assists"},
}
SETTLE_AFTER = timedelta(hours=4)
CANDLE_BATCH = 50
LIVE_HORIZON = timedelta(hours=27)    # quote only games ending within ~27 h (occurrence time is about the game's end)
CANDLE_WINDOW = timedelta(hours=12)   # candles only for the last 12 h before a market closes (games end ~3 h
                                      # after tip, and predictions are made at most a few hours before tip)


def _get(fetch, path: str, params: Dict, base_url: str = KALSHI_BASE_URL, sleep=time.sleep, timeout: int = 30) -> Dict:
    for attempt in range(5):
        resp = fetch(f"{base_url.rstrip('/')}/{path}", params=params, timeout=timeout)
        if resp.status_code != 429:
            break
        sleep(2 ** attempt)
    if resp.status_code != 200:
        raise RuntimeError(f"Kalshi returned {resp.status_code} for {path}")
    sleep(REQUEST_SPACING)
    return resp.json()


def list_markets(fetch, params: Dict, max_pages: int = 50, sleep=time.sleep) -> List[Dict]:
    out: List[Dict] = []
    cursor = None
    for _ in range(max_pages):
        p = dict(params, limit=1000, **({"cursor": cursor} if cursor else {}))
        data = _get(fetch, "markets", p, sleep=sleep)
        out.extend(data.get("markets") or [])
        cursor = data.get("cursor")
        if not cursor:
            break
    return out


def player_name(market: Dict) -> Optional[str]:
    """'Bones Hyland: 15+ points' -> 'Bones Hyland'."""
    title = market.get("yes_sub_title") or market.get("title") or ""
    if ":" not in title:
        return None
    return title.split(":", 1)[0].strip() or None


def game_key(event_ticker: str) -> Optional[str]:
    return event_ticker.split("-", 1)[1] if "-" in (event_ticker or "") else None


def market_row(m: Dict, sport_key: str, series: str, market_type: str, event_id: Optional[str]) -> tuple:
    result = m.get("result")
    settled = m.get("status") in ("finalized", "settled")
    return (m["ticker"], m["event_ticker"], series, sport_key, event_id, game_key(m["event_ticker"]), market_type,
            player_name(m) if market_type.startswith("player_") else None, None,
            _num(m.get("floor_strike")), m.get("strike_type"), m.get("title"), m.get("yes_sub_title"),
            m.get("rules_primary"), m.get("rules_secondary"), _ts(m.get("open_time")), _ts(m.get("close_time")),
            _ts(m.get("occurrence_datetime")), m.get("status"),
            (result if result is not None else None) if settled else None,
            _num(m.get("settlement_value_dollars")) if settled else None,
            m.get("expiration_value") if settled else None, _ts(m.get("settlement_ts")) if settled else None)


UPSERT_MARKETS = """
    INSERT INTO multisport_kalshi_markets (ticker, event_ticker, series_ticker, sport_key, event_id, game_key,
        market_type, player_name, team_code, strike, strike_type, title, yes_sub_title, rules_primary,
        rules_secondary, open_time, close_time, occurrence_time, status, result, settlement_value,
        expiration_value, settled_at)
    VALUES %s
    ON CONFLICT (ticker) DO UPDATE SET
        event_id = COALESCE(multisport_kalshi_markets.event_id, EXCLUDED.event_id),
        rules_primary = COALESCE(EXCLUDED.rules_primary, multisport_kalshi_markets.rules_primary),
        rules_secondary = COALESCE(EXCLUDED.rules_secondary, multisport_kalshi_markets.rules_secondary),
        close_time = EXCLUDED.close_time, status = EXCLUDED.status,
        result = COALESCE(EXCLUDED.result, multisport_kalshi_markets.result),
        settlement_value = COALESCE(EXCLUDED.settlement_value, multisport_kalshi_markets.settlement_value),
        expiration_value = COALESCE(EXCLUDED.expiration_value, multisport_kalshi_markets.expiration_value),
        settled_at = COALESCE(EXCLUDED.settled_at, multisport_kalshi_markets.settled_at),
        updated_at = NOW()"""


def _event_links(cur, sport_key: str, keys: Iterable[str]) -> Dict[str, str]:
    """Kalshi game_key -> our event_id, from the game-market captures that are already linked."""
    keys = [k for k in set(keys) if k]
    if not keys:
        return {}
    cur.execute("""SELECT DISTINCT ON (game_key) game_key, event_id FROM multisport_kalshi_snapshots
                    WHERE sport_key = %s AND game_key = ANY(%s) AND event_id IS NOT NULL
                    ORDER BY game_key, ts_recorded DESC""", (sport_key, keys))
    return dict(cur.fetchall())


def _store(conn, sport_key: str, items: List[Tuple[Dict, str, str]], now: datetime, quotes: bool) -> Dict[str, int]:
    """items: [(market, series, market_type)]. Upserts the market rows and (when quotes) one live quote each."""
    if not items:
        return {"markets": 0, "quotes": 0}
    with conn.cursor() as cur:
        links = _event_links(cur, sport_key, (game_key(m["event_ticker"]) for m, _, _ in items))
        rows = [market_row(m, sport_key, s, t, links.get(game_key(m["event_ticker"]))) for m, s, t in items]
        execute_values(cur, UPSERT_MARKETS, rows, page_size=500)
        n_quotes = 0
        if quotes:
            q = [(sport_key, links.get(game_key(m["event_ticker"])), m["ticker"], m["event_ticker"],
                  game_key(m["event_ticker"]), t, _num(m.get("floor_strike")), m.get("yes_sub_title"),
                  _num(m.get("yes_bid_dollars")), _num(m.get("yes_ask_dollars")), _num(m.get("last_price_dollars")),
                  _num(m.get("volume_fp")), _num(m.get("volume_24h_fp")), _num(m.get("open_interest_fp")),
                  m.get("status"), _ts(m.get("occurrence_datetime")), now, "live")
                 for m, _, t in items if (_num(m.get("yes_ask_dollars")) or 0) > 0]
            if q:
                n_quotes = len(execute_values(cur, """
                    INSERT INTO multisport_kalshi_snapshots (sport_key, event_id, kalshi_ticker, kalshi_event, game_key,
                        market_type, line, outcome, yes_bid, yes_ask, last_price, volume, volume_24h, open_interest,
                        market_status, occurrence_time, ts_recorded, quote_source)
                    VALUES %s ON CONFLICT (kalshi_ticker, ts_recorded) DO NOTHING RETURNING 1""", q, page_size=500,
                    fetch=True))
    conn.commit()
    return {"markets": len(items), "quotes": n_quotes}


def collect_player_props(conn, sport_keys: Iterable[str], now: Optional[datetime] = None,
                         fetch: Optional[Callable[..., requests.Response]] = None, sleep=time.sleep) -> Dict:
    now = now or datetime.now(timezone.utc)
    fetch = fetch or requests.get
    out: Dict = {}
    for key in sport_keys:
        series = PLAYER_SERIES.get(key)
        if not series:
            continue
        items, errors = [], {}
        for s, mtype in series.items():
            try:
                items.extend((m, s, mtype) for m in list_markets(fetch, {"series_ticker": s, "status": "open"},
                                                                  sleep=sleep))
            except Exception as e:
                errors[s] = str(e)
        soon = [(m, s_, t) for m, s_, t in items
                if (_ts(m.get("occurrence_datetime")) or now + LIVE_HORIZON * 2) <= now + LIVE_HORIZON]
        try:
            res = _store(conn, key, soon, now, quotes=True)
            res["open_markets"] = len(items)
        except Exception as e:
            conn.rollback()
            res = {"status": "error", "error": str(e)}
        if errors:
            res["errors"] = errors
        out[key] = res
    return out


def _series_type(sport_key: str, event_ticker: str, fallback: Optional[str]) -> Tuple[str, str]:
    series = event_ticker.split("-", 1)[0]
    return series, PLAYER_SERIES.get(sport_key, {}).get(series) or fallback or "game"


def settle(conn, now: Optional[datetime] = None, fetch: Optional[Callable[..., requests.Response]] = None,
           sleep=time.sleep, max_events: int = 400) -> Dict:
    """Kalshi's own settlement for every Kalshi event we quoted, once its game is over."""
    now = now or datetime.now(timezone.utc)
    fetch = fetch or requests.get
    with conn.cursor() as cur:
        cur.execute("""
            SELECT s.sport_key, s.kalshi_event, MIN(s.market_type)
              FROM multisport_kalshi_snapshots s
              JOIN multisport_fixtures f ON f.event_id = s.event_id
             WHERE f.commence_time < %s AND f.commence_time > %s
               AND NOT EXISTS (SELECT 1 FROM multisport_kalshi_markets k
                                WHERE k.event_ticker = s.kalshi_event AND k.result IS NOT NULL)
             GROUP BY 1, 2 LIMIT %s""", (now - SETTLE_AFTER, now - timedelta(days=30), max_events))
        todo = cur.fetchall()
    out = {"events": len(todo), "markets": 0, "settled": 0, "errors": 0}
    for sport_key, event_ticker, mtype in todo:
        try:
            ms = list_markets(fetch, {"event_ticker": event_ticker}, max_pages=5, sleep=sleep)
        except Exception as e:
            logger.warning("kalshi settle %s: %s", event_ticker, e)
            out["errors"] += 1
            continue
        series, market_type = _series_type(sport_key, event_ticker, mtype)
        res = _store(conn, sport_key, [(m, series, market_type) for m in ms], now, quotes=False)
        out["markets"] += res["markets"]
        out["settled"] += sum(1 for m in ms if m.get("status") in ("finalized", "settled"))
    return out


def backfill(conn, sport_keys: Iterable[str], since: datetime, now: Optional[datetime] = None,
             fetch: Optional[Callable[..., requests.Response]] = None, sleep=time.sleep) -> Dict:
    """Settled player-prop markets closed since `since`, plus their hourly candles as quotes."""
    now = now or datetime.now(timezone.utc)
    fetch = fetch or requests.get
    out: Dict = {}
    for key in sport_keys:
        stats = {"markets": 0, "candles": 0}
        for s, mtype in PLAYER_SERIES.get(key, {}).items():
            ms = list_markets(fetch, {"series_ticker": s, "status": "settled",
                                      "min_close_ts": int(since.timestamp())}, sleep=sleep)
            _store(conn, key, [(m, s, mtype) for m in ms], now, quotes=False)
            stats["markets"] += len(ms)
            stats["candles"] += _candles(conn, key, s, mtype, ms, fetch, sleep)
        out[key] = stats
    return out


def _candles(conn, sport_key: str, series: str, mtype: str, ms: List[Dict], fetch, sleep) -> int:
    by_event: Dict[str, List[Dict]] = {}
    for m in ms:
        if m.get("open_time") and m.get("close_time"):
            by_event.setdefault(m["event_ticker"], []).append(m)
    n = 0
    with conn.cursor() as cur:
        links = _event_links(cur, sport_key, (game_key(e) for e in by_event))
    for ev, group in by_event.items():
        close = max(_ts(m["close_time"]) for m in group)
        start = int(max(min(_ts(m["open_time"]) for m in group), close - CANDLE_WINDOW).timestamp())
        end = int(close.timestamp())
        for i in range(0, len(group), CANDLE_BATCH):
            chunk = group[i:i + CANDLE_BATCH]
            try:
                data = _get(fetch, "markets/candlesticks", {"market_tickers": ",".join(m["ticker"] for m in chunk),
                                                            "start_ts": start, "end_ts": end, "period_interval": 60},
                            sleep=sleep)
            except Exception as e:
                logger.warning("kalshi candles %s: %s", ev, e)
                continue
            strikes = {m["ticker"]: (_num(m.get("floor_strike")), m.get("yes_sub_title")) for m in chunk}
            rows = []
            for item in data.get("markets") or []:
                t = item.get("market_ticker") or item.get("ticker")
                if t not in strikes:
                    continue
                for c in item.get("candlesticks") or []:
                    ask = _num((c.get("yes_ask") or {}).get("close_dollars"))
                    bid = _num((c.get("yes_bid") or {}).get("close_dollars"))
                    if not ask or ask <= 0 or ask >= 1:
                        continue
                    rows.append((sport_key, links.get(game_key(ev)), t, ev, game_key(ev), mtype, strikes[t][0],
                                 strikes[t][1], bid, ask, _num((c.get("price") or {}).get("close_dollars")),
                                 _num(c.get("volume_fp")), None, _num(c.get("open_interest_fp")), "candle", None,
                                 datetime.fromtimestamp(int(c["end_period_ts"]), timezone.utc), "candle_1h"))
            if rows:
                with conn.cursor() as cur:
                    n += len(execute_values(cur, """
                        INSERT INTO multisport_kalshi_snapshots (sport_key, event_id, kalshi_ticker, kalshi_event,
                            game_key, market_type, line, outcome, yes_bid, yes_ask, last_price, volume, volume_24h,
                            open_interest, market_status, occurrence_time, ts_recorded, quote_source)
                        VALUES %s ON CONFLICT (kalshi_ticker, ts_recorded) DO NOTHING RETURNING 1""", rows,
                        page_size=500, fetch=True))
                conn.commit()
    return n
