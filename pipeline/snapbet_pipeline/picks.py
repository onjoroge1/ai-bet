"""Daily paper picks: the strongest market favourites of one US/Eastern day (tracking only, no bets).

Rule (from the 2026-11-17 per-sport review): rank every published sport's favourites on the
same scale, the latest de-vigged consensus win probability, and keep only those at or above
`min_prob`. Slots are never filled with weaker games, so NHL (whose favourites rarely pass
~75%) only appears when it earns a place. The output matches tracking/grade_picks.py.
"""
from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Dict, Iterable, List, Optional
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")
SHORT = {"basketball_nba": "nba", "icehockey_nhl": "nhl", "americanfootball_nfl": "nfl"}
MIN_PROB = 0.70


def latest_favourites(conn, sport_keys: Iterable[str], day: date) -> List[Dict]:
    start = datetime.combine(day, time(4, 0), ET)          # 4 AM ET .. 4 AM ET next day
    end = start + timedelta(days=1)
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT DISTINCT ON (event_id) sport_key, event_id, home_team, away_team, commence_time, ts_recorded,
                   home_prob::float, away_prob::float, home_odds::float, away_odds::float,
                   home_spread::float, n_bookmakers
              FROM multisport_odds_snapshots
             WHERE is_consensus AND sport_key = ANY(%s) AND commence_time >= %s AND commence_time < %s
               AND ts_recorded <= commence_time AND home_prob IS NOT NULL
             ORDER BY event_id, ts_recorded DESC
            """,
            (list(sport_keys), start, end),
        )
        rows = cur.fetchall()
    out = []
    for sk, eid, home, away, start_t, ts, hp, ap, ho, ao, sp, nb in rows:
        fav_home = hp >= ap
        out.append({
            "sport": SHORT.get(sk, sk), "sport_key": sk, "event_id": eid,
            "pick": home if fav_home else away, "opponent": away if fav_home else home,
            "home": fav_home, "prob": round(hp if fav_home else ap, 3), "odds": ho if fav_home else ao,
            "spread": (sp if fav_home else -sp) if sp is not None else None,
            "commence_time": start_t.isoformat(), "odds_at": ts.isoformat(), "n_books": nb,
        })
    return sorted(out, key=lambda r: r["prob"], reverse=True)


def select_picks(favs: List[Dict], n: int = 5, min_prob: float = MIN_PROB) -> List[Dict]:
    return [f for f in favs if f["prob"] >= min_prob][:n]


def build_picks(conn, sport_keys: Iterable[str], day: date, n: int = 5, min_prob: float = MIN_PROB) -> Dict:
    favs = latest_favourites(conn, sport_keys, day)
    picks = select_picks(favs, n, min_prob)
    names = [p["pick"] for p in picks]
    tickets = {}
    if len(names) >= 3:
        tickets["strongest_3"] = names[:3]
    if len(names) >= 5:
        tickets["extended_5"] = names[:5]
    odds_at = max((p["odds_at"] for p in picks), default=None)
    return {
        "date": day.isoformat(), "espn_date": day.strftime("%Y%m%d"),
        "source": f"market favourite >= {min_prob:.0%}, sportsbook consensus (latest snapshot {odds_at})",
        "rule": {"min_prob": min_prob, "max_picks": n, "sports": sorted({SHORT.get(k, k) for k in sport_keys})},
        "tickets": tickets,
        "picks": picks,
        "next_best": [f for f in favs if f not in picks][:3],
    }


def parse_day(value: Optional[str]) -> date:
    return date.fromisoformat(value) if value else datetime.now(ET).date()
