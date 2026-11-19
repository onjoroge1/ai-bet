"""Grade EVERY prop line, not just the line-shopping flags (research, paper only).

`build` summarises each stored pull of multisport_player_props into one row per game x market x
player x line (books that priced both sides): the no-vig over/under probabilities, the best price
on each side and which book had it, and whether it is the main (median) line. `grade` fills the
result from ESPN box scores (NBA only; NFL box scores have no prop stats yet). `report` shows
calibration: for each market and probability bucket, how often the over actually happened.
Costs no API credits. The point is a large, honest dataset to look for patterns in later; pick the
questions before looking, and test any pattern on later dates than it was found on.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Dict, Optional

from psycopg2.extras import execute_values

from .prop_shop import STAT, _name

GRADE_AFTER = timedelta(hours=4)   # game should be over and the box score posted

BUILD = """
    WITH b AS (
        SELECT sport_key, event_id, commence_time, home_team, away_team, market, player_name, line, ts_recorded,
               bookmaker, over_price::float AS o, under_price::float AS u,
               (1 / over_price::float) / (1 / over_price::float + 1 / under_price::float) AS p_over,
               1 / over_price::float + 1 / under_price::float AS over_round
          FROM multisport_player_props
         WHERE line IS NOT NULL AND over_price > 1 AND under_price > 1
           AND (%(since)s::timestamptz IS NULL OR ts_recorded >= %(since)s)),
    med AS (
        SELECT event_id, market, player_name, ts_recorded,
               percentile_disc(0.5) WITHIN GROUP (ORDER BY line) AS med_line
          FROM b GROUP BY event_id, market, player_name, ts_recorded),
    agg AS (
        SELECT sport_key, event_id, commence_time, home_team, away_team, market, player_name, line, ts_recorded,
               COUNT(DISTINCT bookmaker) AS n_books, AVG(p_over) AS p_over, AVG(over_round) AS over_round,
               (ARRAY_AGG(bookmaker ORDER BY o DESC))[1] AS over_book, MAX(o) AS best_over,
               (ARRAY_AGG(bookmaker ORDER BY u DESC))[1] AS under_book, MAX(u) AS best_under
          FROM b
         GROUP BY sport_key, event_id, commence_time, home_team, away_team, market, player_name, line, ts_recorded)
    INSERT INTO multisport_prop_results (sport_key, event_id, commence_time, home_team, away_team, market,
        player_name, line, is_main_line, n_books, over_prob, under_prob, avg_overround, best_over, best_over_book,
        best_under, best_under_book, ts_recorded)
    SELECT a.sport_key, a.event_id, a.commence_time, a.home_team, a.away_team, a.market, a.player_name, a.line,
           a.line = m.med_line, a.n_books, ROUND(a.p_over::numeric, 4), ROUND((1 - a.p_over)::numeric, 4),
           ROUND(a.over_round::numeric, 4), a.best_over, a.over_book, a.best_under, a.under_book, a.ts_recorded
      FROM agg a JOIN med m USING (event_id, market, player_name, ts_recorded)
    ON CONFLICT (event_id, market, player_name, line, ts_recorded) DO NOTHING
"""


def build(conn, since: Optional[datetime] = None) -> int:
    with conn.cursor() as cur:
        cur.execute(BUILD, {"since": since})
        n = cur.rowcount
    conn.commit()
    return n


def outcome(actual: float, line: float) -> str:
    return "push" if actual == line else ("over" if actual > line else "under")


def grade(conn, now: Optional[datetime] = None) -> Dict:
    """Fill actual/result for finished NBA games. Not in the box score or did not play = void."""
    now = now or datetime.now(timezone.utc)
    out = {"graded": 0, "void": 0, "no_boxscore": 0}
    with conn.cursor() as cur:
        cur.execute("""SELECT DISTINCT event_id FROM multisport_prop_results
                        WHERE graded_at IS NULL AND commence_time < %s AND market = ANY(%s)""",
                    (now - GRADE_AFTER, list(STAT)))
        for (eid,) in cur.fetchall():
            cur.execute("""SELECT player_name, did_not_play, points, rebounds, assists, threes_made
                             FROM multisport_player_boxscores WHERE event_id = %s""", (eid,))
            box = {_name(r[0]): r for r in cur.fetchall()}
            if not box:
                out["no_boxscore"] += 1
                continue
            cur.execute("""SELECT id, market, player_name, line FROM multisport_prop_results
                            WHERE event_id = %s AND graded_at IS NULL AND market = ANY(%s)""", (eid, list(STAT)))
            updates = []
            for rid, market, player, line in cur.fetchall():
                r = box.get(_name(player))
                if r is None or r[1]:
                    updates.append((None, "void", rid))
                    out["void"] += 1
                    continue
                actual = r[2 + ("points", "rebounds", "assists", "threes_made").index(STAT[market])]
                if actual is None:
                    continue
                updates.append((actual, outcome(float(actual), float(line)), rid))
                out["graded"] += 1
            if updates:
                execute_values(cur, """UPDATE multisport_prop_results r
                                          SET actual = v.actual::numeric, result = v.result, graded_at = now()
                                         FROM (VALUES %s) AS v(actual, result, id) WHERE r.id = v.id""", updates)
    conn.commit()
    return out


def refresh(conn, now: Optional[datetime] = None) -> Dict:
    now = now or datetime.now(timezone.utc)
    return {"built": build(conn, since=now - timedelta(days=3)), **grade(conn, now)}


def report(conn, now: Optional[datetime] = None) -> Dict:
    """Build everything, grade, then calibration of main lines by market and over-probability bucket."""
    out: Dict = {"built": build(conn), **grade(conn, now)}
    with conn.cursor() as cur:
        cur.execute("""SELECT COUNT(*), COUNT(*) FILTER (WHERE result IN ('over','under')),
                              COUNT(DISTINCT event_id) FILTER (WHERE result IN ('over','under'))
                         FROM multisport_prop_results""")
        n, graded, games = cur.fetchone()
        out["total_rows"], out["total_graded"], out["total_graded_games"] = n, graded, games
        cur.execute("""SELECT market, width_bucket(over_prob, 0, 1, 10) AS b, COUNT(*),
                              AVG(over_prob)::float, AVG((result = 'over')::int)::float
                         FROM multisport_prop_results
                        WHERE is_main_line AND result IN ('over', 'under')
                        GROUP BY 1, 2 ORDER BY 1, 2""")
        cal: Dict = {}
        for market, b, cnt, pred, act in cur.fetchall():
            cal.setdefault(market.replace("player_", ""), []).append(
                {"bucket": f"{(b - 1) / 10:.1f}-{b / 10:.1f}", "n": cnt, "predicted_over": round(pred, 3),
                 "actual_over": round(act, 3)})
        out["calibration_main_lines"] = cal
    return out
