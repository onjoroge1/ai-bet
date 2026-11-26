"""Player box scores from ESPN's public API -> multisport_player_boxscores (free, no key).

  GET site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=YYYYMMDD
  GET site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event={id}
  (NFL: football/nfl, stored in multisport_nfl_player_stats; ESPN lists only players with a stat.)

Only final games are stored, once each (a game already in the table is skipped).
Each game is linked to its multisport_fixtures row (canonical team names, start
within 12h) so props and box scores join on event_id.
"""
from __future__ import annotations

import logging
import time
from datetime import date, datetime, timedelta, timezone
from typing import Callable, Dict, Iterable, List, Optional
from zoneinfo import ZoneInfo

import requests
from psycopg2.extras import execute_values

from .teams import canonical_team

logger = logging.getLogger(__name__)

ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports"
ESPN_PATHS: Dict[str, str] = {"basketball_nba": "basketball/nba", "americanfootball_nfl": "football/nfl"}
NFL = "americanfootball_nfl"
# ESPN NFL block name -> {ESPN key: our column}
_NFL_KEYS = {
    "passing": {"completions/passingAttempts": "cmp_att", "passingYards": "pass_yds", "passingTouchdowns": "pass_td",
                "interceptions": "interceptions"},
    "rushing": {"rushingAttempts": "rush_att", "rushingYards": "rush_yds", "rushingTouchdowns": "rush_td"},
    "receiving": {"receptions": "receptions", "receivingYards": "rec_yds", "receivingTouchdowns": "rec_td",
                  "receivingTargets": "targets"},
    "kickReturns": {"kickReturnTouchdowns": "kr_td"},
    "puntReturns": {"puntReturnTouchdowns": "pr_td"},
    "defensive": {"defensiveTouchdowns": "def_td_a"},
    "interceptions": {"interceptionTouchdowns": "def_td_b"},
}
NFL_COLS = ("pass_cmp", "pass_att", "pass_yds", "pass_td", "interceptions", "rush_att", "rush_yds", "rush_td",
            "receptions", "targets", "rec_yds", "rec_td", "return_td", "def_td", "scoring_td")
ET = ZoneInfo("America/New_York")
LINK_WINDOW = timedelta(hours=12)
_KEY_MAP = {"minutes": "minutes", "points": "points", "rebounds": "rebounds", "assists": "assists",
            "threePointFieldGoalsMade-threePointFieldGoalsAttempted": "threes",
            "fieldGoalsMade-fieldGoalsAttempted": "fg", "freeThrowsMade-freeThrowsAttempted": "ft",
            "offensiveRebounds": "off_rebounds", "defensiveRebounds": "def_rebounds", "steals": "steals",
            "blocks": "blocks", "turnovers": "turnovers", "fouls": "fouls", "plusMinus": "plus_minus"}


def _int(v) -> Optional[int]:
    try:
        return int(str(v).replace("+", ""))
    except (TypeError, ValueError):
        return None


def _pair(v):
    if not v or "-" not in str(v):
        return None, None
    a, b = str(v).split("-", 1)
    return _int(a), _int(b)


def parse_summary(summary: Dict, sport_key: str) -> List[Dict]:
    """ESPN summary JSON -> one dict per player (DNPs included)."""
    comp = ((summary.get("header") or {}).get("competitions") or [{}])[0]
    sides = {c.get("team", {}).get("id"): c for c in comp.get("competitors", [])}
    game_time = comp.get("date")
    out: List[Dict] = []
    teams = (summary.get("boxscore") or {}).get("players") or []
    names = {t["team"]["id"]: t["team"].get("displayName") for t in teams if t.get("team")}
    for t in teams:
        tid = t["team"]["id"]
        team = canonical_team(sport_key, names[tid]) or names[tid]
        opp_raw = next((n for i, n in names.items() if i != tid), "")
        opp = canonical_team(sport_key, opp_raw) or opp_raw
        is_home = (sides.get(tid) or {}).get("homeAway") == "home"
        for block in t.get("statistics", []):
            keys = [_KEY_MAP.get(k) for k in block.get("keys", [])]
            for a in block.get("athletes", []):
                ath = a.get("athlete") or {}
                row = {"team": team, "opponent": opp, "is_home": is_home, "game_time": game_time,
                       "player_id": str(ath.get("id")), "player_name": ath.get("displayName"),
                       "starter": a.get("starter"), "did_not_play": bool(a.get("didNotPlay")),
                       "dnp_reason": a.get("reason") if a.get("didNotPlay") else None}
                stats = dict(zip(keys, a.get("stats") or []))
                row["threes_made"], row["threes_att"] = _pair(stats.get("threes"))
                row["fg_made"], row["fg_att"] = _pair(stats.get("fg"))
                row["ft_made"], row["ft_att"] = _pair(stats.get("ft"))
                for k in ("minutes", "points", "rebounds", "assists", "off_rebounds", "def_rebounds",
                          "steals", "blocks", "turnovers", "fouls", "plus_minus"):
                    row[k] = _int(stats.get(k))
                if row["player_id"] and row["player_name"]:
                    out.append(row)
    return out


def parse_nfl_summary(summary: Dict, sport_key: str = NFL) -> List[Dict]:
    """ESPN NFL summary JSON -> one dict per player who appears in any stat block.
    Stats a player has no block for are 0 (he played but, say, had no catches)."""
    comp = ((summary.get("header") or {}).get("competitions") or [{}])[0]
    sides = {c.get("team", {}).get("id"): c for c in comp.get("competitors", [])}
    teams = (summary.get("boxscore") or {}).get("players") or []
    names = {t["team"]["id"]: t["team"].get("displayName") for t in teams if t.get("team")}
    out: List[Dict] = []
    for t in teams:
        tid = t["team"]["id"]
        team = canonical_team(sport_key, names[tid]) or names[tid]
        opp_raw = next((n for i, n in names.items() if i != tid), "")
        opp = canonical_team(sport_key, opp_raw) or opp_raw
        players: Dict[str, Dict] = {}
        for block in t.get("statistics", []):
            want = _NFL_KEYS.get(block.get("name"), {})
            keys = block.get("keys", [])
            for a in block.get("athletes", []):
                ath = a.get("athlete") or {}
                pid, name = str(ath.get("id") or ""), ath.get("displayName")
                if not pid or not name:
                    continue
                row = players.setdefault(pid, {"team": team, "opponent": opp, "game_time": comp.get("date"),
                                               "is_home": (sides.get(tid) or {}).get("homeAway") == "home",
                                               "player_id": pid, "player_name": name})
                for k, v in zip(keys, a.get("stats") or []):
                    col = want.get(k)
                    if col == "cmp_att":
                        c, att = (str(v).split("/", 1) + [None])[:2] if v and "/" in str(v) else (None, None)
                        row["pass_cmp"], row["pass_att"] = _int(c), _int(att)
                    elif col:
                        row[col] = _int(v)
        for row in players.values():
            for col in ("pass_yds", "pass_td", "interceptions", "rush_att", "rush_yds", "rush_td", "receptions",
                        "targets", "rec_yds", "rec_td"):
                row[col] = row.get(col) or 0
            row.setdefault("pass_cmp", 0), row.setdefault("pass_att", 0)
            row["return_td"] = (row.pop("kr_td", 0) or 0) + (row.pop("pr_td", 0) or 0)
            # ESPN's defensiveTouchdowns normally already includes interception returns: take the larger
            row["def_td"] = max(row.pop("def_td_a", 0) or 0, row.pop("def_td_b", 0) or 0)
            row["scoring_td"] = row["rush_td"] + row["rec_td"] + row["return_td"] + row["def_td"]
            out.append(row)
    return out


def _insert_nba(cur, key, espn_id, event_id, when, players):
    execute_values(cur, """
        INSERT INTO multisport_player_boxscores (sport_key, espn_event_id, event_id, game_time, team,
            opponent, is_home, player_id, player_name, starter, did_not_play, dnp_reason, minutes,
            points, rebounds, assists, threes_made, threes_att, fg_made, fg_att, ft_made, ft_att,
            off_rebounds, def_rebounds, steals, blocks, turnovers, fouls, plus_minus)
        VALUES %s ON CONFLICT (sport_key, espn_event_id, player_id) DO NOTHING""",
        [(key, espn_id, event_id, when, p["team"], p["opponent"], p["is_home"], p["player_id"],
          p["player_name"], p["starter"], p["did_not_play"], p["dnp_reason"], p["minutes"],
          p["points"], p["rebounds"], p["assists"], p["threes_made"], p["threes_att"], p["fg_made"],
          p["fg_att"], p["ft_made"], p["ft_att"], p["off_rebounds"], p["def_rebounds"], p["steals"],
          p["blocks"], p["turnovers"], p["fouls"], p["plus_minus"]) for p in players])


def _insert_nfl(cur, key, espn_id, event_id, when, players):
    execute_values(cur, f"""
        INSERT INTO multisport_nfl_player_stats (sport_key, espn_event_id, event_id, game_time, team, opponent,
            is_home, player_id, player_name, {", ".join(NFL_COLS)})
        VALUES %s ON CONFLICT (espn_event_id, player_id) DO NOTHING""",
        [(key, espn_id, event_id, when, p["team"], p["opponent"], p["is_home"], p["player_id"], p["player_name"],
          *[p[c] for c in NFL_COLS]) for p in players])


# sport -> (parser, table that marks a game as stored, insert)
_SPORT = {"basketball_nba": (parse_summary, "multisport_player_boxscores", _insert_nba),
          NFL: (parse_nfl_summary, "multisport_nfl_player_stats", _insert_nfl)}


def _get(fetch, url, params=None, timeout=30, sleep=time.sleep):
    for attempt in range(3):
        resp = fetch(url, params=params or {}, timeout=timeout)
        if resp.status_code == 200:
            return resp.json()
        sleep(2 ** attempt)
    raise RuntimeError(f"ESPN returned {resp.status_code} for {url}")


def _link(cur, sport_key: str, home: str, away: str, when: datetime) -> Optional[str]:
    cur.execute("""SELECT event_id FROM multisport_fixtures
                    WHERE sport_key = %s AND home_team = %s AND away_team = %s
                      AND commence_time BETWEEN %s AND %s
                    ORDER BY ABS(EXTRACT(EPOCH FROM commence_time - %s)) LIMIT 1""",
                (sport_key, home, away, when - LINK_WINDOW, when + LINK_WINDOW, when))
    r = cur.fetchone()
    return r[0] if r else None


def collect_boxscores(conn, sport_keys: Iterable[str], days: Iterable[date],
                      fetch: Optional[Callable[..., requests.Response]] = None,
                      sleep: Callable[[float], None] = time.sleep) -> Dict[str, Dict]:
    fetch = fetch or requests.get
    out: Dict[str, Dict] = {}
    days = list(days)
    for key in sport_keys:
        path = ESPN_PATHS.get(key)
        if not path or key not in _SPORT:
            continue
        parse, table, insert = _SPORT[key]
        stats = {"final_games": 0, "new_games": 0, "linked": 0, "players": 0, "status": "ok"}
        try:
            with conn.cursor() as cur:
                for d in days:
                    sb = _get(fetch, f"{ESPN_BASE}/{path}/scoreboard", {"dates": d.strftime("%Y%m%d")}, sleep=sleep)
                    for ev in sb.get("events", []):
                        if ((ev.get("status") or {}).get("type") or {}).get("name") != "STATUS_FINAL":
                            continue
                        stats["final_games"] += 1
                        cur.execute(f"SELECT 1 FROM {table} WHERE sport_key=%s AND espn_event_id=%s LIMIT 1",
                                    (key, str(ev["id"])))
                        if cur.fetchone():
                            continue
                        try:
                            summary = _get(fetch, f"{ESPN_BASE}/{path}/summary", {"event": ev["id"]}, sleep=sleep)
                        except RuntimeError as e:             # one missing summary must not end the run
                            logger.warning("boxscores %s %s skipped: %s", key, ev["id"], e)
                            stats["skipped"] = stats.get("skipped", 0) + 1
                            continue
                        sleep(0.2)
                        players = parse(summary, key)
                        if not players:
                            continue
                        when = datetime.fromisoformat((players[0]["game_time"] or ev["date"]).replace("Z", "+00:00"))
                        home = next((p["team"] for p in players if p["is_home"]), None)
                        away = next((p["team"] for p in players if not p["is_home"]), None)
                        event_id = _link(cur, key, home, away, when) if home and away else None
                        insert(cur, key, str(ev["id"]), event_id, when, players)
                        conn.commit()
                        stats["new_games"] += 1
                        stats["linked"] += bool(event_id)
                        stats["players"] += len(players)
        except Exception as e:
            conn.rollback()
            logger.error("boxscores %s failed: %s", key, e)
            stats.update(status="error", error=str(e))
        out[key] = stats
    return out


def recent_days(now: Optional[datetime] = None, back: int = 2) -> List[date]:
    """ET calendar days from `back` days ago to today."""
    today = (now or datetime.now(timezone.utc)).astimezone(ET).date()
    return [today - timedelta(days=i) for i in range(back, -1, -1)]
