"""Hourly results from ESPN's free scoreboard, with The Odds API as a paid safety net.

For each sport, ESPN finals from the last few ET days are matched to our
multisport_fixtures rows (same canonical teams, start within 12h) and stored via
results.store_scores under the fixture's event_id. Only when a fixture that
should be over (started 4h-3d ago) is still unfinished after that pass do we
spend credits on The Odds API /scores for that sport.
"""
from __future__ import annotations

import logging
import re
import unicodedata
from datetime import datetime, timedelta, timezone
from typing import Callable, Dict, Iterable, List, Optional

import requests

from .boxscores import recent_days
from .config import SPORTS
from .history import ESPN_PATHS, espn_games
from .odds_api import OddsApiClient
from .results import fetch_scores_stepdown, store_scores

logger = logging.getLogger(__name__)

MATCH_WINDOW = timedelta(hours=12)
GAME_LENGTH = timedelta(hours=4)        # a fixture this long past its start should have a final
STALE_HORIZON = timedelta(days=3)       # Odds API /scores only reaches back 3 days
WEAK_WINDOW = timedelta(hours=3)
FALLBACK_EVERY_HOURS = 6                # paid fallback at most every 6th hourly run (UTC hour % 6 == 0)


_ABBR = {"mt": "mount", "intl": "international", "n": "north", "s": "south", "se": "southeast"}


def _loose(name: str) -> str:
    """Accent-, case- and punctuation-free name; 'St' -> 'saint' first, 'state' elsewhere."""
    plain = unicodedata.normalize("NFKD", name or "").encode("ascii", "ignore").decode().lower()
    toks = [t for t in re.split(r"[^a-z0-9]+", plain.replace("&", " and ").replace("'", "")) if t]
    out = [("saint" if i == 0 else "state") if t == "st" else _ABBR.get(t, t) for i, t in enumerate(toks)]
    return "".join(out)


def _fixtures(cur, sport_key: str, since: datetime) -> List[tuple]:
    cur.execute("""SELECT event_id, home_team, away_team, commence_time FROM multisport_fixtures
                    WHERE sport_key = %s AND commence_time >= %s""", (sport_key, since))
    return cur.fetchall()


def match_fixture(game: Dict, fixtures: List[tuple]) -> Optional[tuple]:
    """Exact canonical names first, then a punctuation/case-insensitive comparison (college names)."""
    near = [f for f in fixtures if abs(f[3] - game["commence"]) <= MATCH_WINDOW]
    for same in (lambda a, b: a == b, lambda a, b: _loose(a) == _loose(b)):
        hits = [f for f in near if same(f[1], game["home"]) and same(f[2], game["away"])]
        if hits:
            return min(hits, key=lambda f: abs(f[3] - game["commence"]))
    # one side matches, start within WEAK_WINDOW, and it's the only such fixture (e.g. "Texas A&M-CC")
    weak = [f for f in near if abs(f[3] - game["commence"]) <= WEAK_WINDOW
            and (_loose(f[1]) == _loose(game["home"])) != (_loose(f[2]) == _loose(game["away"]))]
    return weak[0] if len(weak) == 1 else None


def _payload(game: Dict, fx: tuple) -> Dict:
    return {"id": fx[0], "home_team": fx[1], "away_team": fx[2], "commence_time": fx[3].isoformat(),
            "completed": True, "scores": [{"name": fx[1], "score": str(game["home_score"])},
                                          {"name": fx[2], "score": str(game["away_score"])}]}


def _stale(cur, sport_key: str, now: datetime) -> int:
    cur.execute("""SELECT COUNT(*) FROM multisport_fixtures
                    WHERE sport_key = %s AND status <> 'finished'
                      AND commence_time BETWEEN %s AND %s""",
                (sport_key, now - STALE_HORIZON, now - GAME_LENGTH))
    return cur.fetchone()[0]


def collect_results_espn(conn, client: Optional[OddsApiClient], sport_keys: Iterable[str],
                         now: Optional[datetime] = None, back_days: int = 3, respect_season: bool = True,
                         fetch: Callable = requests.get, fallback: bool = True) -> Dict[str, Dict]:
    now = now or datetime.now(timezone.utc)
    days = recent_days(now, back=back_days)
    out: Dict[str, Dict] = {}
    for key in sport_keys:
        cfg = SPORTS[key]
        if respect_season and not cfg.in_season(now.month):
            out[key] = {"status": "off_season"}
            continue
        stats: Dict = {"source": "espn", "espn_finals": 0, "matched": 0, "no_fixture": 0, "status": "ok"}
        try:
            if key not in ESPN_PATHS:
                raise RuntimeError(f"no ESPN path for {key}")
            games: List[Dict] = []
            for d in days:
                g, unmapped = espn_games(key, d, fetch=fetch)
                games += g
                stats["no_fixture"] += len(unmapped)
            stats["espn_finals"] = len(games)
            with conn.cursor() as cur:
                fixtures = _fixtures(cur, key, now - timedelta(days=back_days + 2))
            payloads = []
            for g in games:
                fx = match_fixture(g, fixtures)
                if fx:
                    payloads.append(_payload(g, fx))
                else:
                    stats["no_fixture"] += 1
            stats["matched"] = len(payloads)
            stats.update(store_scores(conn, payloads, cfg))
        except Exception as e:
            conn.rollback()
            logger.error("%s ESPN results failed: %s", cfg.name, e)
            stats.update(status="espn_error", error=str(e))

        with conn.cursor() as cur:
            stale = _stale(cur, key, now)
        stats["stale_fixtures"] = stale
        if stale and fallback and client is not None and now.hour % FALLBACK_EVERY_HOURS == 0:
            try:
                odds_games, used = fetch_scores_stepdown(client, key, cfg.results_lookback_days)
                m = store_scores(conn, odds_games, cfg)
                stats.update(source="espn+odds_api", fallback=m, fallback_days=used)
                if stats["status"] == "espn_error":
                    stats["status"] = "ok_fallback"
            except Exception as e:
                conn.rollback()
                logger.error("%s Odds API fallback failed: %s", cfg.name, e)
                stats.update(status="error", fallback_error=str(e))
        out[key] = stats
        logger.info("%s results: %s", cfg.name, stats)
    if client is not None:
        out["_quota"] = client.quota()
    return out
