"""Thin client for The Odds API v4 (https://the-odds-api.com).

Endpoints used:
  GET /sports/{sport_key}/odds             -> upcoming events with per-bookmaker markets
  GET /sports/{sport_key}/scores           -> recent/completed games with scores
  GET /historical/sports/{sport_key}/odds  -> a past /odds snapshot (import-odds-api-history)

The client records the quota headers The Odds API returns on every response
(x-requests-remaining / x-requests-used) so each job can log how much of the
monthly budget it consumed. `fetch` is injectable so tests never hit the network.
"""
from __future__ import annotations

import logging
from typing import Callable, Dict, List, Optional

import requests

from .config import ODDS_API_BASE_URL

logger = logging.getLogger(__name__)


class OddsApiError(RuntimeError):
    pass


class OddsApiClient:
    def __init__(self, api_key: str, base_url: str = ODDS_API_BASE_URL,
                 fetch: Optional[Callable[..., requests.Response]] = None, timeout: int = 30):
        if not api_key:
            raise OddsApiError("ODDS_API_KEY is not set")
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self._fetch = fetch or requests.get
        self.timeout = timeout
        self.calls = 0
        self.requests_remaining: Optional[int] = None
        self.requests_used: Optional[int] = None

    # ------------------------------------------------------------------ core
    def _request(self, path: str, params: Dict, empty):
        url = f"{self.base_url}{path}"
        params = dict(params, apiKey=self.api_key)
        resp = self._fetch(url, params=params, timeout=self.timeout)
        self.calls += 1
        self._record_quota(resp)
        if resp.status_code == 404:
            # no events for this sport right now (off-season / nothing scheduled)
            return empty
        if resp.status_code == 401:
            raise OddsApiError("The Odds API rejected the key (401)")
        if resp.status_code == 429:
            raise OddsApiError("The Odds API quota exhausted (429)")
        if resp.status_code != 200:
            raise OddsApiError(f"The Odds API returned {resp.status_code} for {path}")
        return resp.json()

    def _get(self, path: str, params: Dict) -> List[Dict]:
        data = self._request(path, params, [])
        if not isinstance(data, list):
            raise OddsApiError(f"unexpected payload for {path}: {type(data).__name__}")
        return data

    def _record_quota(self, resp) -> None:
        headers = getattr(resp, "headers", {}) or {}
        try:
            if "x-requests-remaining" in headers:
                self.requests_remaining = int(headers["x-requests-remaining"])
            if "x-requests-used" in headers:
                self.requests_used = int(headers["x-requests-used"])
        except (TypeError, ValueError):
            pass

    # -------------------------------------------------------------- endpoints
    def get_odds(self, sport_key: str, markets=("h2h", "spreads", "totals"),
                 regions: str = "us", odds_format: str = "decimal") -> List[Dict]:
        return self._get(f"/sports/{sport_key}/odds", {
            "regions": regions,
            "markets": ",".join(markets),
            "oddsFormat": odds_format,
        })

    def get_events(self, sport_key: str) -> List[Dict]:
        """Upcoming events (ids, teams, start). Free: costs no credits."""
        return self._get(f"/sports/{sport_key}/events", {})

    def get_event_odds(self, sport_key: str, event_id: str, markets, regions: str = "us",
                       odds_format: str = "decimal") -> Dict:
        """One event's odds for any markets (player props etc.).
        Costs 1 credit per market returned per region."""
        data = self._request(f"/sports/{sport_key}/events/{event_id}/odds", {
            "regions": regions, "markets": ",".join(markets), "oddsFormat": odds_format,
        }, {})
        if not isinstance(data, dict):
            raise OddsApiError(f"unexpected event-odds payload for {event_id}: {type(data).__name__}")
        return data

    def get_scores(self, sport_key: str, days_from: int = 3) -> List[Dict]:
        # daysFrom max depends on plan (3 on most tiers). Caller handles step-down.
        return self._get(f"/sports/{sport_key}/scores", {"daysFrom": max(1, int(days_from))})

    def get_historical_odds(self, sport_key: str, date_iso: str, markets=("h2h", "spreads", "totals"),
                            regions: str = "us", odds_format: str = "decimal") -> Dict:
        """Snapshot at or before `date_iso`: {"timestamp", "previous_timestamp",
        "next_timestamp", "data": [events in /odds shape]}. Paid plans only;
        costs 10 credits per market per region."""
        data = self._request(f"/historical/sports/{sport_key}/odds", {
            "regions": regions, "markets": ",".join(markets), "oddsFormat": odds_format, "date": date_iso,
        }, {"timestamp": None, "data": []})
        if not isinstance(data, dict) or not isinstance(data.get("data"), list):
            raise OddsApiError(f"unexpected historical payload for {sport_key}: {type(data).__name__}")
        return data

    def quota(self) -> Dict[str, Optional[int]]:
        return {"calls": self.calls, "requests_remaining": self.requests_remaining,
                "requests_used": self.requests_used}
