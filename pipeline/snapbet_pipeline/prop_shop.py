"""Line shopping for player props (research, paper only).

A flag = one book's price on a prop side beats the no-vig median of the OTHER books at the
same line by MIN_EDGE or more. This is price comparison, not prediction: it assumes the other
books' median is the fair price. Flags are stored when props are pulled and graded later
against ESPN box scores (NBA only for now; NFL flags stay ungraded).
"""
from __future__ import annotations

import re
import unicodedata
from collections import defaultdict
from datetime import datetime, timezone
from statistics import median
from typing import Dict, Iterable, List, Optional

from psycopg2.extras import execute_values

MIN_EDGE = 0.03       # 3% expected return at the fair price
MIN_OTHER_BOOKS = 3   # books (with both sides priced) behind the fair price
MAX_EDGE = 0.25       # bigger gaps are almost always a wrong line or stale feed, not value
STAT = {"player_points": "points", "player_rebounds": "rebounds", "player_assists": "assists",
        "player_threes": "threes_made"}


def _novig_over(r: Dict) -> Optional[float]:
    o, u = r.get("over_price"), r.get("under_price")
    if not (o and u and float(o) > 1 and float(u) > 1):
        return None
    return (1 / float(o)) / (1 / float(o) + 1 / float(u))


def best_opposite(rows: Iterable[Dict], flagged_book: str, side: str):
    """(book, price) of the best price on the OTHER side at any book except the flagged one."""
    opp = "under" if side == "over" else "over"
    prices = [(r["bookmaker"], float(r[f"{opp}_price"])) for r in rows
              if r["bookmaker"] != flagged_book and r.get(f"{opp}_price") and float(r[f"{opp}_price"]) > 1]
    return max(prices, key=lambda bp: bp[1]) if prices else (None, None)


def find_flags(rows: Iterable[Dict], min_edge: float = MIN_EDGE, min_other: int = MIN_OTHER_BOOKS,
               max_edge: float = MAX_EDGE) -> List[Dict]:
    """rows: bookmaker, market, player_name, line, over_price, under_price (one pull of one game)."""
    groups: Dict[tuple, List[Dict]] = defaultdict(list)
    for r in rows:
        if r.get("line") is not None:
            groups[(r["market"], r["player_name"], float(r["line"]))].append(r)
    flags = []
    for (market, player, line), rs in groups.items():
        fair = {r["bookmaker"]: _novig_over(r) for r in rs}
        for r in rs:
            others = [p for b, p in fair.items() if b != r["bookmaker"] and p is not None]
            if len(others) < min_other:
                continue
            p_over = median(others)   # median: one off-market book must not move the fair price
            for side, p in (("over", p_over), ("under", 1 - p_over)):
                price = r.get(f"{side}_price")
                if not price or float(price) <= 1:
                    continue
                edge = p * float(price) - 1
                if min_edge <= edge <= max_edge:
                    fade_book, fade_price = best_opposite(rs, r["bookmaker"], side)
                    flags.append({"bookmaker": r["bookmaker"], "market": market, "player_name": player, "line": line,
                                  "side": side, "price": float(price), "fair_prob": round(p, 4),
                                  "edge": round(edge, 4), "n_books": len(others),
                                  "fade_book": fade_book, "fade_price": fade_price})
    return sorted(flags, key=lambda f: -f["edge"])


def store_flags(cur, sport_key: str, ev: Dict, flags: List[Dict], now: datetime) -> int:
    if not flags:
        return 0
    execute_values(cur, """
        INSERT INTO multisport_prop_flags (sport_key, event_id, commence_time, home_team, away_team, bookmaker,
            market, player_name, line, side, price, fair_prob, edge, n_books, ts_recorded, fade_book, fade_price)
        VALUES %s ON CONFLICT DO NOTHING""",
        [(sport_key, ev["event_id"], ev.get("commence_time"), ev.get("home_team"), ev.get("away_team"),
          f["bookmaker"], f["market"], f["player_name"], f["line"], f["side"], f["price"], f["fair_prob"],
          f["edge"], f["n_books"], now, f.get("fade_book"), f.get("fade_price")) for f in flags])
    return cur.rowcount


def backfill_fades(conn) -> int:
    """Fill fade_book/fade_price for flags stored before 011 from the same pull's stored prices."""
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE multisport_prop_flags f SET fade_book = b.bookmaker, fade_price = b.price
              FROM (SELECT DISTINCT ON (f2.id) f2.id, p.bookmaker,
                           (CASE WHEN f2.side = 'over' THEN p.under_price ELSE p.over_price END) AS price
                      FROM multisport_prop_flags f2
                      JOIN multisport_player_props p
                        ON p.event_id = f2.event_id AND p.market = f2.market AND p.player_name = f2.player_name
                       AND p.line = f2.line AND p.ts_recorded = f2.ts_recorded AND p.bookmaker <> f2.bookmaker
                     WHERE f2.fade_price IS NULL
                       AND (CASE WHEN f2.side = 'over' THEN p.under_price ELSE p.over_price END) > 1
                     ORDER BY f2.id, price DESC) b
             WHERE f.id = b.id""")
        n = cur.rowcount
    conn.commit()
    return n


def backfill(conn, now: Optional[datetime] = None) -> int:
    """Flag every stored pull that has no flags yet (covers props collected before this existed)."""
    now = now or datetime.now(timezone.utc)
    added = 0
    with conn.cursor() as cur:
        cur.execute("""SELECT DISTINCT p.sport_key, p.event_id, p.commence_time, p.home_team, p.away_team, p.ts_recorded
                         FROM multisport_player_props p
                        WHERE NOT EXISTS (SELECT 1 FROM multisport_prop_flags f WHERE f.event_id = p.event_id)""")
        for sport, eid, start, home, away, ts in cur.fetchall():
            cur.execute("""SELECT bookmaker, market, player_name, line, over_price, under_price
                             FROM multisport_player_props WHERE event_id = %s AND ts_recorded = %s""", (eid, ts))
            rows = [dict(zip(("bookmaker", "market", "player_name", "line", "over_price", "under_price"), r))
                    for r in cur.fetchall()]
            added += store_flags(cur, sport, {"event_id": eid, "commence_time": start, "home_team": home,
                                              "away_team": away}, find_flags(rows), ts)
    conn.commit()
    return added


def _name(n: str) -> str:
    plain = unicodedata.normalize("NFKD", n or "").encode("ascii", "ignore").decode().lower()
    toks = [t for t in re.split(r"[^a-z]+", plain) if t and t not in ("jr", "sr", "ii", "iii", "iv")]
    return "".join(toks)


def grade(conn, now: Optional[datetime] = None) -> Dict:
    """Fill actual/won from box scores for flags of finished games. Equal to the line = push (won NULL)."""
    now = now or datetime.now(timezone.utc)
    out = {"graded": 0, "no_boxscore": 0}
    with conn.cursor() as cur:
        cur.execute("""SELECT id, event_id, market, player_name, line, side FROM multisport_prop_flags
                        WHERE graded_at IS NULL AND commence_time < %s""", (now,))
        todo = cur.fetchall()
        box: Dict[str, Dict[str, tuple]] = {}
        for fid, eid, market, player, line, side in todo:
            stat = STAT.get(market)
            if not stat:
                continue
            if eid not in box:
                cur.execute("""SELECT player_name, did_not_play, points, rebounds, assists, threes_made
                                 FROM multisport_player_boxscores WHERE event_id = %s""", (eid,))
                box[eid] = {_name(r[0]): r for r in cur.fetchall()}
            if not box[eid]:
                out["no_boxscore"] += 1
                continue
            r = box[eid].get(_name(player))
            if r is None or r[1]:          # not in the box score / did not play -> void
                cur.execute("UPDATE multisport_prop_flags SET graded_at = %s WHERE id = %s", (now, fid))
                continue
            actual = r[2 + ("points", "rebounds", "assists", "threes_made").index(stat)]
            if actual is None:
                continue
            diff = float(actual) - float(line)
            won = None if diff == 0 else (diff > 0) == (side == "over")
            cur.execute("UPDATE multisport_prop_flags SET actual = %s, won = %s, graded_at = %s WHERE id = %s",
                        (actual, won, now, fid))
            out["graded"] += 1
    conn.commit()
    return out


def report(conn, now: Optional[datetime] = None, top: int = 15) -> Dict:
    """Backfill + grade, then: open flags for games not started, and the running record."""
    now = now or datetime.now(timezone.utc)
    out: Dict = {"backfilled": backfill(conn, now), "fades_backfilled": backfill_fades(conn), **grade(conn, now)}
    with conn.cursor() as cur:
        cur.execute("""SELECT away_team || ' at ' || home_team, bookmaker, player_name, market, side, line, price,
                              fair_prob, edge, n_books
                         FROM multisport_prop_flags WHERE commence_time > %s ORDER BY edge DESC LIMIT %s""", (now, top))
        out["open"] = [{"game": g, "book": b, "prop": f"{p} {s} {float(l):g} {m.replace('player_', '')}",
                        "price": float(pr), "fair_prob": float(fp), "edge": float(e), "other_books": n}
                       for g, b, p, m, s, l, pr, fp, e, n in cur.fetchall()]
        cur.execute("""SELECT COUNT(*), COUNT(won), COALESCE(SUM(won::int), 0), AVG(fair_prob) FILTER (WHERE won IS NOT NULL),
                              AVG(CASE WHEN won THEN price - 1 ELSE -1 END) FILTER (WHERE won IS NOT NULL),
                              AVG(edge) FILTER (WHERE won IS NOT NULL)
                         FROM multisport_prop_flags""")
        n, graded, wins, exp, roi, edge = cur.fetchone()
        out["record"] = {"flags": n, "graded": graded, "won": int(wins),
                         "win_rate": round(wins / graded, 3) if graded else None,
                         "expected_win_rate": round(float(exp), 3) if exp is not None else None,
                         "roi_per_unit": round(float(roi), 3) if roi is not None else None,
                         "expected_roi": round(float(edge), 3) if edge is not None else None}
        # Paper fade: the opposite side at the best other book; it wins exactly when the flag loses.
        cur.execute("""SELECT COUNT(*), COALESCE(SUM((NOT won)::int), 0), AVG(1 - fair_prob),
                              AVG(CASE WHEN NOT won THEN fade_price - 1 ELSE -1 END), AVG(fade_price)
                         FROM multisport_prop_flags WHERE won IS NOT NULL AND fade_price IS NOT NULL""")
        n, wins, exp, roi, avg_price = cur.fetchone()
        out["fade_record"] = {"graded": n, "won": int(wins),
                              "win_rate": round(wins / n, 3) if n else None,
                              "expected_win_rate": round(float(exp), 3) if exp is not None else None,
                              "roi_per_unit": round(float(roi), 3) if roi is not None else None,
                              "avg_price": round(float(avg_price), 3) if avg_price is not None else None,
                              "note": "paper only; review at ~200 graded"}
    return out
