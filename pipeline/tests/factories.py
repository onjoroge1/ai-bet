"""SYNTHETIC test data shaped like The Odds API v4 responses.

Used only to exercise pipeline mechanics (parsing, storage, feature building,
training plumbing, publishing). Team names, odds and scores are made up; the
"model" trained on them in tests proves the code path runs, not that any model
has predictive value.
"""
from __future__ import annotations

import math
import random
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Tuple

from snapbet_pipeline.odds_api import OddsApiClient

BOOKS = [("draftkings", "DraftKings"), ("fanduel", "FanDuel"), ("betmgm", "BetMGM")]


class FakeResponse:
    def __init__(self, payload, status=200, remaining=4900, used=100):
        self._payload, self.status_code = payload, status
        self.headers = {"x-requests-remaining": str(remaining), "x-requests-used": str(used)}

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


class FakeOddsApi:
    """Routes /sports/{key}/odds, /scores and /historical/... to canned payloads; records calls."""

    def __init__(self):
        self.odds: Dict[str, List[Dict]] = {}
        self.scores: Dict[str, List[Dict]] = {}
        self.historical: Dict[str, List[Dict]] = {}
        self.calls: List[Tuple[str, Dict]] = []
        self.max_days_from = 3   # emulate a plan that rejects larger windows

    def fetch(self, url, params=None, timeout=None):
        self.calls.append((url, dict(params or {})))
        sport = url.rsplit("/sports/", 1)[1].split("/")[0]
        if "/historical/" in url:
            # snapshot = every canned event for the sport, stamped at the requested time
            return FakeResponse({"timestamp": params["date"], "previous_timestamp": None, "next_timestamp": None,
                                 "data": self.historical.get(sport, [])})
        if url.endswith("/odds"):
            return FakeResponse(self.odds.get(sport, []))
        if url.endswith("/scores"):
            if int(params.get("daysFrom", 1)) > self.max_days_from:
                return FakeResponse({"message": "daysFrom too large"}, status=422)
            return FakeResponse(self.scores.get(sport, []))
        return FakeResponse({"message": "not found"}, status=404)

    def client(self) -> OddsApiClient:
        return OddsApiClient("test-key", fetch=self.fetch)


def odds_event(event_id: str, sport_key: str, home: str, away: str, commence: datetime,
               p_home: float, spread: float, total: float, vig: float = 0.045, jitter: float = 0.02,
               rng: random.Random | None = None, sport_title: str = "NFL") -> Dict:
    rng = rng or random.Random(event_id)
    books = []
    for key, title in BOOKS:
        ph = min(max(p_home + rng.uniform(-jitter, jitter), 0.05), 0.95)
        pa = 1.0 - ph
        scale = 1.0 + vig
        books.append({
            "key": key, "title": title, "last_update": commence.isoformat(),
            "markets": [
                {"key": "h2h", "outcomes": [{"name": home, "price": round(1 / (ph * scale), 2)},
                                            {"name": away, "price": round(1 / (pa * scale), 2)}]},
                {"key": "spreads", "outcomes": [{"name": home, "price": 1.91, "point": spread},
                                                {"name": away, "price": 1.91, "point": -spread}]},
                {"key": "totals", "outcomes": [{"name": "Over", "price": 1.91, "point": total},
                                               {"name": "Under", "price": 1.91, "point": total}]},
            ],
        })
    return {"id": event_id, "sport_key": sport_key, "sport_title": sport_title,
            "commence_time": commence.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "home_team": home, "away_team": away, "bookmakers": books}


def score_event(event_id: str, sport_key: str, home: str, away: str, commence: datetime,
                home_score: int, away_score: int, completed: bool = True) -> Dict:
    return {"id": event_id, "sport_key": sport_key, "sport_title": "NFL", "completed": completed,
            "commence_time": commence.strftime("%Y-%m-%dT%H:%M:%SZ"), "home_team": home, "away_team": away,
            "scores": [{"name": home, "score": str(home_score)}, {"name": away, "score": str(away_score)}]
            if completed else None, "last_update": commence.isoformat()}


def synthetic_season(sport_key: str = "americanfootball_nfl", n_teams: int = 20, n_weeks: int = 16,
                     start: datetime = datetime(2026, 9, 13, 17, 0, tzinfo=timezone.utc), seed: int = 7):
    """Deterministic fake season: hidden team strengths -> fair probs -> books -> outcomes.

    Returns list of dicts: {event_id, home, away, commence, p_home, spread, total, home_score, away_score}
    """
    rng = random.Random(seed)
    teams = [f"Synthetic Team {chr(65 + i)}" for i in range(n_teams)]
    strength = {t: rng.gauss(0, 1) for t in teams}
    games = []
    for w in range(n_weeks):
        order = teams[:]
        rng.shuffle(order)
        for i in range(0, n_teams - 1, 2):
            home, away = order[i], order[i + 1]
            diff = strength[home] - strength[away] + 0.25  # home advantage
            p_home = 1 / (1 + math.exp(-1.1 * diff))
            spread = round(-diff * 3.0 * 2) / 2
            total = round(44 + rng.uniform(-6, 6) * 2) / 2
            margin = rng.gauss(diff * 3.0, 10)
            home_score = max(0, int(round(24 + margin / 2)))
            away_score = max(0, int(round(24 - margin / 2)))
            if home_score == away_score:
                home_score += 3  # no ties in the synthetic set
            commence = start + timedelta(days=7 * w) + timedelta(hours=rng.choice([0, 3, 7]))
            games.append({"event_id": f"syn{seed}-w{w:02d}-g{i // 2:02d}", "sport_key": sport_key,
                          "home": home, "away": away, "commence": commence, "p_home": p_home,
                          "spread": spread, "total": total, "home_score": home_score, "away_score": away_score})
    return games
