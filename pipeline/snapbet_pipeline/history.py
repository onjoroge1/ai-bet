"""import-odds-api-history: past seasons with REAL Odds API events and every bookmaker.

For each day in [start, end] with completed games:
  1. final scores from ESPN's public scoreboard (The Odds API /scores only reaches
     back 3 days), team names normalised with teams.canonical_team;
  2. one historical /odds snapshot per offset (default 1h) before that day's FIRST
     kickoff — events that had already started at the snapshot time are dropped, so
     no in-play price is ever stored;
  3. matched events are stored exactly like live collection (collect.store_events:
     fixture + consensus + one row per bookmaker, ts_recorded = the API's snapshot
     timestamp) and their scores like live results (results.store_scores).
`sync` + `train` then work unchanged. With --supersede-csv, `csv-` rows imported
earlier for the same games are deleted so nothing is counted twice.

Cost: 10 credits x markets x regions per snapshot (30 for h2h+spreads+totals, us).
--max-credits stops before the budget is exceeded; --cache-dir reuses responses.
"""
from __future__ import annotations

import json
import logging
import os
from datetime import date, datetime, timedelta, timezone
from typing import Callable, Dict, Iterable, List, Optional, Sequence, Tuple

import requests

from .collect import store_events
from .config import SPORTS
from .odds_api import OddsApiClient
from .results import store_scores
from .teams import canonical_team

logger = logging.getLogger(__name__)

ESPN_PATHS = {"americanfootball_nfl": "football/nfl", "basketball_nba": "basketball/nba",
              "icehockey_nhl": "hockey/nhl", "basketball_ncaab": "basketball/mens-college-basketball"}
ESPN_URL = "https://site.api.espn.com/apis/site/v2/sports/{path}/scoreboard"
CREDITS_PER_MARKET = 10
MATCH_WINDOW = timedelta(hours=12)
CSV_MATCH_WINDOW = timedelta(hours=36)


def _parse_ts(s: str) -> datetime:
    return datetime.fromisoformat(str(s).replace("Z", "+00:00"))


class _Cache:
    def __init__(self, directory: Optional[str]):
        self.dir = directory
        if directory:
            os.makedirs(directory, exist_ok=True)

    def get(self, name: str):
        if not self.dir:
            return None
        p = os.path.join(self.dir, name)
        if os.path.exists(p):
            with open(p, "r", encoding="utf-8") as f:
                return json.load(f)
        return None

    def put(self, name: str, data) -> None:
        if self.dir:
            with open(os.path.join(self.dir, name), "w", encoding="utf-8") as f:
                json.dump(data, f)


def espn_games(sport_key: str, day: date, fetch: Callable = requests.get, cache: Optional[_Cache] = None,
               team_map: Optional[Dict[str, str]] = None) -> Tuple[List[Dict], List[Tuple[str, str]]]:
    """Completed regular/post-season games on `day` (US scoreboard date).
    Returns (games, unmapped label pairs). Ties are kept; store_scores skips them."""
    cache = cache or _Cache(None)
    name = f"espn_{sport_key}_{day:%Y%m%d}.json"
    data = cache.get(name)
    if data is None:
        resp = fetch(ESPN_URL.format(path=ESPN_PATHS[sport_key]),
                     params={"dates": f"{day:%Y%m%d}", "limit": 300}, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        cache.put(name, data)
    games, unmapped = [], []
    for ev in data.get("events", []):
        if (ev.get("season") or {}).get("type") not in (2, 3):
            continue                                        # preseason / all-star
        comp = (ev.get("competitions") or [{}])[0]
        if not ((comp.get("status") or {}).get("type") or {}).get("completed"):
            continue
        side = {c.get("homeAway"): c for c in comp.get("competitors", [])}
        if "home" not in side or "away" not in side:
            continue
        raw_h, raw_a = side["home"]["team"]["displayName"], side["away"]["team"]["displayName"]
        h, a = canonical_team(sport_key, raw_h, team_map), canonical_team(sport_key, raw_a, team_map)
        if not h or not a:
            unmapped.append((raw_h, raw_a))
            continue
        try:
            hs, as_ = int(float(side["home"]["score"])), int(float(side["away"]["score"]))
        except (KeyError, TypeError, ValueError):
            continue
        games.append({"commence": _parse_ts(comp.get("date") or ev["date"]), "home": h, "away": a,
                      "home_score": hs, "away_score": as_})
    return games, unmapped


def _snapshot_time(games: List[Dict], offset_hours: float) -> datetime:
    t = min(g["commence"] for g in games) - timedelta(hours=offset_hours)
    return t.replace(minute=(t.minute // 5) * 5, second=0, microsecond=0)


def _match(games: List[Dict], events: List[Dict], snapshot_ts: datetime) -> List[Tuple[Dict, Dict]]:
    """(game, event) pairs: same teams, kickoff within MATCH_WINDOW, event not yet started."""
    by_teams: Dict[Tuple[str, str], List[Dict]] = {}
    for ev in events:
        try:
            ct = _parse_ts(ev["commence_time"])
        except (KeyError, ValueError):
            continue
        if ct <= snapshot_ts:
            continue                                        # already started: never use in-play prices
        by_teams.setdefault((ev.get("home_team"), ev.get("away_team")), []).append(ev)
    pairs = []
    for g in games:
        cands = [e for e in by_teams.get((g["home"], g["away"]), [])
                 if abs(_parse_ts(e["commence_time"]) - g["commence"]) <= MATCH_WINDOW]
        if cands:
            pairs.append((g, min(cands, key=lambda e: abs(_parse_ts(e["commence_time"]) - g["commence"]))))
    return pairs


def _score_payload(g: Dict, ev: Dict) -> Dict:
    return {"id": ev["id"], "home_team": g["home"], "away_team": g["away"], "commence_time": ev["commence_time"],
            "completed": True, "scores": [{"name": g["home"], "score": str(g["home_score"])},
                                          {"name": g["away"], "score": str(g["away_score"])}]}


CSV_TABLES = ("multisport_odds_snapshots", "multisport_match_results", "multisport_schedule", "multisport_training",
              "multisport_pick_ledger")


def supersede_csv(conn, sport_key: str, pairs: Iterable[Tuple[Dict, Dict]]) -> int:
    """Delete earlier `csv-` imports of the same games (same teams, kickoff within 36h)."""
    removed = 0
    with conn.cursor() as cur:
        for g, _ev in pairs:
            cur.execute(
                """SELECT event_id FROM multisport_fixtures
                    WHERE sport_key = %s AND event_id LIKE 'csv-%%' AND home_team = %s AND away_team = %s
                      AND commence_time BETWEEN %s AND %s""",
                (sport_key, g["home"], g["away"], g["commence"] - CSV_MATCH_WINDOW, g["commence"] + CSV_MATCH_WINDOW))
            for (eid,) in cur.fetchall():
                for t in CSV_TABLES:
                    cur.execute(f"DELETE FROM {t} WHERE sport_key = %s AND event_id = %s", (sport_key, eid))
                cur.execute('DELETE FROM "MultisportMatch" WHERE sport = %s AND "eventId" = %s', (sport_key, eid))
                cur.execute("DELETE FROM multisport_fixtures WHERE sport_key = %s AND event_id = %s", (sport_key, eid))
                removed += 1
    conn.commit()
    return removed


def import_history(conn, client: Optional[OddsApiClient], sport_key: str, start: date, end: date,
                   offsets_hours: Sequence[float] = (1.0,), max_credits: Optional[int] = None,
                   cache_dir: Optional[str] = None, dry_run: bool = False, supersede: bool = False,
                   espn_fetch: Callable = requests.get, team_map: Optional[Dict[str, str]] = None) -> Dict:
    cfg = SPORTS[sport_key]
    markets = cfg.markets
    cost = CREDITS_PER_MARKET * len(markets) * len(cfg.regions.split(","))
    cache = _Cache(cache_dir)
    offsets = sorted({float(o) for o in offsets_hours}, reverse=True)   # earliest snapshot first
    rep = {"sport_key": sport_key, "range": [start.isoformat(), end.isoformat()], "dry_run": dry_run,
           "offsets_hours": offsets, "days_with_games": 0, "games": 0, "matched": 0, "unmatched": 0,
           "snapshots_requested": 0, "snapshots_from_cache": 0, "credits_spent": 0, "estimated_credits": 0,
           "rows": {"events": 0, "snapshots": 0, "finals": 0}, "csv_superseded": 0, "unmapped_teams": [],
           "stopped_early": None}
    unmapped = set()
    day = start
    while day <= end:
        games, um = espn_games(sport_key, day, fetch=espn_fetch, cache=cache, team_map=team_map)
        unmapped.update(um)
        day_ = day
        day += timedelta(days=1)
        if not games:
            continue
        rep["days_with_games"] += 1
        rep["games"] += len(games)
        matched: Dict[int, Tuple[Dict, Dict]] = {}
        for off in offsets:
            snap = _snapshot_time(games, off)
            name = f"odds_{sport_key}_{snap:%Y%m%dT%H%M}.json"
            hist = cache.get(name)
            if hist is None:
                rep["estimated_credits"] += cost
                if dry_run:
                    continue
                if max_credits is not None and rep["credits_spent"] + cost > max_credits:
                    rep["stopped_early"] = f"credit cap {max_credits} reached before {day_.isoformat()}"
                    break
                hist = client.get_historical_odds(sport_key, snap.strftime("%Y-%m-%dT%H:%M:%SZ"), markets=markets,
                                                  regions=cfg.regions)
                rep["snapshots_requested"] += 1
                rep["credits_spent"] += cost
                cache.put(name, hist)
            else:
                rep["snapshots_from_cache"] += 1
            if dry_run or not hist.get("timestamp"):
                continue
            snap_ts = _parse_ts(hist["timestamp"])
            pairs = _match(games, hist.get("data", []), snap_ts)
            if pairs:
                m = store_events(conn, [ev for _, ev in pairs], cfg, now=snap_ts)
                rep["rows"]["events"] += m["fixtures_new"]
                rep["rows"]["snapshots"] += m["snapshots"]
            for g, ev in pairs:
                matched.setdefault(id(g), (g, ev))
        if rep["stopped_early"]:
            break
        if dry_run:
            continue
        pairs = list(matched.values())
        rep["matched"] += len(pairs)
        rep["unmatched"] += len(games) - len(pairs)
        if pairs:
            if supersede:
                rep["csv_superseded"] += supersede_csv(conn, sport_key, pairs)
            r = store_scores(conn, [_score_payload(g, ev) for g, ev in pairs], cfg)
            rep["rows"]["finals"] += r["finals"]
    rep["unmapped_teams"] = sorted(unmapped)
    if client is not None:
        rep["_quota"] = client.quota()
    return rep
