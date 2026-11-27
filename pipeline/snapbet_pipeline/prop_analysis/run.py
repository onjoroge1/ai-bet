"""Entry points used by the CLI (research, paper only).

  live(conn):      estimates + priced lines for games in the next 36 h that have quotes (hourly, in `run`)
  settle_live:     results and paper P&L for live lines once their games are final
  backtest(conn):  walk-forward estimates for past games (only information known at each prediction time)
  report(conn):    evaluation + market timing + injury event study -> multisport_prop_reports
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional

from psycopg2.extras import execute_values

from . import estimates as E
from . import evaluate as V
from .pricing import kalshi_quote, side_result, sportsbook_quote
from .records import refresh_actuals

logger = logging.getLogger(__name__)
LIVE_HORIZON = timedelta(hours=36)
BACKTEST_START = datetime(2026, 11, 13, tzinfo=timezone.utc)   # first day with stored prop lines


def live(conn, now: Optional[datetime] = None) -> Dict:
    now = now or datetime.now(timezone.utc)
    end = now + LIVE_HORIZON
    out = {}
    for name, fn in (("player", E.build_player), ("team", E.build_team)):
        try:
            est = fn(conn, "live", now - timedelta(hours=1), end, now=now)
            out[name] = E.store(conn, est, "live")
        except Exception as e:                       # research: never block the run
            conn.rollback()
            logger.exception("prop analysis live %s failed", name)
            out[name] = {"status": "error", "error": str(e)}
    return out


def settle_live(conn, now: Optional[datetime] = None) -> Dict:
    """Fill result/pnl on live lines of finished games from the same settlement sources as the record."""
    now = now or datetime.now(timezone.utc)
    with conn.cursor() as cur:
        cur.execute("""
            SELECT l.id, l.source, l.side, l.market_id, l.threshold::float, l.price::float, e.stat, e.subject_type,
                   e.subject, e.event_id, e.is_home, a.actual::float, a.status, k.result, k.settlement_value::float,
                   f.home_score, f.away_score
              FROM multisport_prop_lines l
              JOIN multisport_prop_estimates e ON e.id = l.estimate_id
              LEFT JOIN multisport_prop_actuals a ON a.event_id = e.event_id AND a.market = e.stat
                                                 AND a.player_name = e.subject
              LEFT JOIN multisport_kalshi_markets k ON k.ticker = l.market_id
              LEFT JOIN multisport_fixtures f ON f.event_id = e.event_id
             WHERE e.mode = 'live' AND l.result IS NULL AND e.commence_time < %s""", (now - timedelta(hours=4),))
        rows = cur.fetchall()
        updates = []
        for (lid, src, side, mid, t, price, stat, stype, subject, eid, is_home, actual, astatus, kres, ksv,
             hs, as_) in rows:
            rec = None
            if src == "kalshi" and kres in ("yes", "no"):
                rec = kres
            elif src == "kalshi" and kres == "" and ksv is not None:
                rec = "fair"
            elif stype == "player":
                if astatus == "void":
                    rec = "void"
                elif actual is not None:
                    rec = "yes" if actual > t else ("no" if actual < t else "push")
            elif hs is not None:
                margin = (hs - as_) * (1 if is_home else -1)
                val = {"team_win": (margin > 0) - (margin < 0), "team_margin": margin,
                       "team_points": hs if is_home else as_, "game_total": hs + as_}[stat]
                rec = "yes" if val > t else ("no" if val < t else "push")
            res = side_result(rec, side)
            if res is None:
                continue
            q = sportsbook_quote(side, price) if src == "sportsbook" else None
            if src == "kalshi":
                q = kalshi_quote("yes", None, price) if side == "yes" else kalshi_quote("no", 1 - price, None)
            pnl = q.pnl(res, None if ksv is None else (ksv if side == "yes" else 1 - ksv)) if q else None
            updates.append((lid, res, pnl))
        if updates:
            execute_values(cur, """UPDATE multisport_prop_lines l SET result = v.result, pnl = v.pnl::numeric
                                     FROM (VALUES %s) AS v(id, result, pnl) WHERE l.id = v.id""", updates)
        cur.execute("""UPDATE multisport_prop_estimates e SET actual = a.actual
                         FROM multisport_prop_actuals a
                        WHERE e.mode = 'live' AND e.actual IS NULL AND e.subject_type = 'player'
                          AND a.event_id = e.event_id AND a.market = e.stat AND a.player_name = e.subject""")
    conn.commit()
    return {"lines_settled": len(updates)}


def backtest(conn, start: datetime = BACKTEST_START, end: Optional[datetime] = None,
             team_start: Optional[datetime] = None) -> Dict:
    end = end or datetime.now(timezone.utc)
    refresh_actuals(conn)
    out = {}
    est = E.build_player(conn, "backtest", start, end)
    out["player"] = E.store(conn, est, "backtest")
    est = E.build_team(conn, "backtest", team_start or start, end)
    out["team"] = E.store(conn, est, "backtest")
    return out


def report(conn, start: Optional[datetime] = None) -> Dict:
    rep = V.evaluate(conn, start)
    rep["market_timing"] = V.market_timing(conn)
    rep["injury_events"] = V.injury_events(conn)
    rep["report_id"] = V.save_report(conn, "evaluation", rep)
    return rep
