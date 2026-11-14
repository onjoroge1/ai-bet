"""ESPN injury reports -> multisport_injuries (free, no key).

  GET site.api.espn.com/apis/site/v2/sports/{path}/injuries

Stored as status history: a new row when a player's report or status changes,
otherwise the existing row's last_seen is bumped. "Who was listed before tip"
= rows with first_seen <= tip AND last_seen >= tip - 2h.
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Callable, Dict, Iterable, List, Optional

import requests
from psycopg2.extras import execute_values

from .teams import canonical_team

logger = logging.getLogger(__name__)

ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports"
INJURY_PATHS: Dict[str, str] = {"basketball_nba": "basketball/nba", "icehockey_nhl": "hockey/nhl",
                                "americanfootball_nfl": "football/nfl"}
_ATHLETE_ID = re.compile(r"/(?:id|players/full)/(\d+)")


def _athlete_id(ath: Dict) -> Optional[str]:
    if ath.get("id"):
        return str(ath["id"])
    hrefs = [(ath.get("headshot") or {}).get("href", "")] + [l.get("href", "") for l in ath.get("links", [])]
    for h in hrefs:
        m = _ATHLETE_ID.search(h or "")
        if m:
            return m.group(1)
    return None


def _ts(v):
    try:
        return datetime.fromisoformat(v.replace("Z", "+00:00")) if v else None
    except ValueError:
        return None


def parse_injuries(data: Dict, sport_key: str) -> List[Dict]:
    out = []
    for t in data.get("injuries", []):
        team_raw = t.get("displayName") or ""
        team = canonical_team(sport_key, team_raw) or team_raw
        for i in t.get("injuries", []):
            ath = i.get("athlete") or {}
            pid = _athlete_id(ath)
            if not (pid and ath.get("displayName") and i.get("status")):
                continue
            det = i.get("details") or {}
            rd = det.get("returnDate")
            out.append({"team": team, "player_id": pid, "player_name": ath["displayName"],
                        "position": (ath.get("position") or {}).get("abbreviation"),
                        "status": i["status"], "fantasy_status": (det.get("fantasyStatus") or {}).get("abbreviation"),
                        "injury_type": det.get("type"), "return_date": rd[:10] if rd else None,
                        "short_comment": i.get("shortComment"), "espn_injury_id": str(i.get("id") or ""),
                        "report_time": _ts(i.get("date"))})
    return out


def collect_injuries(conn, sport_keys: Iterable[str], now: Optional[datetime] = None,
                     fetch: Optional[Callable] = None) -> Dict[str, Dict]:
    now = now or datetime.now(timezone.utc)
    fetch = fetch or requests.get
    out: Dict[str, Dict] = {}
    for key in sport_keys:
        path = INJURY_PATHS.get(key)
        if not path:
            continue
        try:
            resp = fetch(f"{ESPN_BASE}/{path}/injuries", params={}, timeout=30)
            resp.raise_for_status()
            rows = parse_injuries(resp.json(), key)
            with conn.cursor() as cur:
                res = execute_values(cur, """
                    INSERT INTO multisport_injuries (sport_key, team, player_id, player_name, position, status,
                        fantasy_status, injury_type, return_date, short_comment, espn_injury_id, report_time,
                        first_seen, last_seen)
                    VALUES %s
                    ON CONFLICT (sport_key, player_id, espn_injury_id, status) DO UPDATE SET
                        last_seen = EXCLUDED.last_seen, short_comment = EXCLUDED.short_comment,
                        fantasy_status = EXCLUDED.fantasy_status, return_date = EXCLUDED.return_date
                    RETURNING (xmax = 0)""",
                    [(key, r["team"], r["player_id"], r["player_name"], r["position"], r["status"],
                      r["fantasy_status"], r["injury_type"], r["return_date"], r["short_comment"],
                      r["espn_injury_id"], r["report_time"], now, now) for r in rows], fetch=True)
            conn.commit()
            new = sum(1 for (inserted,) in res if inserted)
            out[key] = {"listed": len(rows), "new_or_changed": new, "status": "ok"}
        except Exception as e:
            conn.rollback()
            logger.error("injuries %s failed: %s", key, e)
            out[key] = {"status": "error", "error": str(e)}
    return out
