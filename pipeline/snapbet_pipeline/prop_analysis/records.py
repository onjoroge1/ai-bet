"""Settle player props for the common record (multisport_prop_records): each player's stat per
game and prop market, from ESPN box scores (free). A player missing from the box score, or listed
as did-not-play, is 'void'. NBA from multisport_player_boxscores, NFL from multisport_nfl_player_stats.
NHL has no player box scores yet; NHL player props settle only through Kalshi's own result."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Dict, Optional

from psycopg2.extras import execute_values

from ..prop_shop import ALL_STAT, _name, box_lookup

GRADE_AFTER = timedelta(hours=4)
SPORTS = ("basketball_nba", "americanfootball_nfl")


def refresh_actuals(conn, now: Optional[datetime] = None) -> Dict:
    now = now or datetime.now(timezone.utc)
    out = {"games": 0, "rows": 0, "no_boxscore": 0}
    with conn.cursor() as cur:
        cur.execute("""
            WITH wanted AS (
                SELECT sport_key, event_id, market, player_name FROM multisport_player_props
                 WHERE commence_time < %(cut)s AND sport_key = ANY(%(sports)s)
                UNION
                SELECT k.sport_key, k.event_id, k.market_type, k.player_name FROM multisport_kalshi_markets k
                  JOIN multisport_fixtures f ON f.event_id = k.event_id
                 WHERE k.player_name IS NOT NULL AND f.commence_time < %(cut)s AND k.sport_key = ANY(%(sports)s))
            SELECT w.sport_key, w.event_id, w.market, w.player_name FROM wanted w
             WHERE w.market = ANY(%(markets)s) AND NOT EXISTS (
                   SELECT 1 FROM multisport_prop_actuals a
                    WHERE a.event_id = w.event_id AND a.market = w.market AND a.player_name = w.player_name)""",
                    {"cut": now - GRADE_AFTER, "sports": list(SPORTS), "markets": list(ALL_STAT)})
        todo: Dict[str, list] = {}
        for sport, eid, market, player in cur.fetchall():
            todo.setdefault(eid, []).append((sport, market, player))
        rows = []
        for eid, items in todo.items():
            box = box_lookup(cur, eid)
            if not box:
                out["no_boxscore"] += 1
                continue
            out["games"] += 1
            for sport, market, player in items:
                r = box.get(_name(player))
                actual = None if r is None else r.get(ALL_STAT[market])
                rows.append((sport, eid, market, player, actual, "played" if actual is not None else "void"))
        if rows:
            execute_values(cur, """INSERT INTO multisport_prop_actuals (sport_key, event_id, market, player_name,
                                       actual, status) VALUES %s ON CONFLICT DO NOTHING""", rows, page_size=1000)
        out["rows"] = len(rows)
    conn.commit()
    return out
