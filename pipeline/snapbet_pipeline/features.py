"""MultisportFeatureBuilder — 46 leak-safe features per game (2-way, no draw).

Port of BetGeniusAI features/multisport_feature_builder.py. Differences:
  * takes an open psycopg2 connection instead of opening one per call
  * every historical query is bounded by `cutoff_dt` (game start) so training
    features never see the game's own closing line or result
  * per-sport ELO home advantage comes from config.SPORTS

Groups: ODDS(13) SPREAD/TOTALS(10) REST(6) FORM(9) ELO(4) H2H(2) SEASON(2) = 46
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Optional

from .config import B2B_HOURS, ELO_K, ELO_START, SPORTS

logger = logging.getLogger(__name__)

FEATURES_VERSION = "v3.1"

ODDS_FEATURE_NAMES = [
    "prob_home", "prob_away", "open_home_prob", "open_away_prob",
    "home_prob_drift", "away_prob_drift", "home_odds_volatility",
    "overround", "n_bookmakers", "n_snapshots", "odds_diff", "prob_diff", "home_is_favorite",
]
SPREAD_FEATURE_NAMES = [
    "spread_line", "spread_drift", "home_spread_odds", "away_spread_odds", "open_spread",
    "total_line", "total_drift", "over_odds", "under_odds", "open_total",
]
REST_FEATURE_NAMES = ["home_rest_days", "away_rest_days", "home_is_b2b", "away_is_b2b",
                      "rest_advantage", "b2b_disadvantage"]
FORM_FEATURE_NAMES = ["home_win_rate_l10", "away_win_rate_l10", "home_season_win_rate",
                      "away_season_win_rate", "home_home_win_rate", "away_away_win_rate",
                      "home_pts_diff_avg", "away_pts_diff_avg", "form_advantage"]
ELO_FEATURE_NAMES = ["home_elo", "away_elo", "elo_diff", "elo_home_win_prob"]
H2H_FEATURE_NAMES = ["h2h_home_win_rate", "h2h_matches_used"]
SEASON_FEATURE_NAMES = ["season_progress", "time_to_game_hours"]

ALL_FEATURE_NAMES: List[str] = (ODDS_FEATURE_NAMES + SPREAD_FEATURE_NAMES + REST_FEATURE_NAMES +
                                FORM_FEATURE_NAMES + ELO_FEATURE_NAMES + H2H_FEATURE_NAMES +
                                SEASON_FEATURE_NAMES)
assert len(ALL_FEATURE_NAMES) == 46


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _to_cutoff(game_date, cutoff_dt: Optional[datetime]) -> datetime:
    if cutoff_dt is not None:
        return _aware(cutoff_dt)
    if isinstance(game_date, datetime):
        return _aware(game_date)
    return datetime.combine(game_date, datetime.min.time()).replace(tzinfo=timezone.utc)


class MultisportFeatureBuilder:
    def __init__(self, conn):
        self.conn = conn

    @classmethod
    def get_feature_names(cls) -> List[str]:
        return list(ALL_FEATURE_NAMES)

    # ------------------------------------------------------------------ public
    def build_features(self, sport_key: str, event_id: str, home_team: str, away_team: str,
                       game_date, cutoff_dt: Optional[datetime] = None) -> Dict[str, float]:
        cutoff = _to_cutoff(game_date, cutoff_dt)
        with self.conn.cursor() as cur:
            feats: Dict[str, float] = {}
            feats.update(self._odds(cur, sport_key, event_id, cutoff))
            feats.update(self._rest(cur, sport_key, home_team, away_team, cutoff))
            feats.update(self._form(cur, sport_key, home_team, away_team, cutoff.date()))
            feats.update(self._elo(cur, sport_key, home_team, away_team, cutoff.date()))
            feats.update(self._h2h(cur, sport_key, home_team, away_team, cutoff.date()))
            feats.update(self._season(sport_key, game_date, cutoff))
        return {k: float(feats.get(k, 0.0)) for k in ALL_FEATURE_NAMES}

    # ------------------------------------------------------------ group 1 + 2
    def _odds(self, cur, sport_key: str, event_id: str, cutoff: datetime) -> Dict[str, float]:
        zeros = {k: 0.0 for k in ODDS_FEATURE_NAMES + SPREAD_FEATURE_NAMES}
        cur.execute(
            """
            WITH cons AS (
                SELECT * FROM multisport_odds_snapshots
                 WHERE event_id = %s AND sport_key = %s AND is_consensus AND ts_recorded <= %s
            )
            SELECT (ARRAY_AGG(home_prob ORDER BY ts_recorded DESC))[1],
                   (ARRAY_AGG(away_prob ORDER BY ts_recorded DESC))[1],
                   (ARRAY_AGG(overround ORDER BY ts_recorded DESC))[1],
                   (ARRAY_AGG(n_bookmakers ORDER BY ts_recorded DESC))[1],
                   (ARRAY_AGG(home_spread ORDER BY ts_recorded DESC))[1],
                   (ARRAY_AGG(total_line ORDER BY ts_recorded DESC))[1],
                   (ARRAY_AGG(home_spread_odds ORDER BY ts_recorded DESC))[1],
                   (ARRAY_AGG(away_spread_odds ORDER BY ts_recorded DESC))[1],
                   (ARRAY_AGG(over_odds ORDER BY ts_recorded DESC))[1],
                   (ARRAY_AGG(under_odds ORDER BY ts_recorded DESC))[1],
                   (ARRAY_AGG(home_prob ORDER BY ts_recorded ASC))[1],
                   (ARRAY_AGG(away_prob ORDER BY ts_recorded ASC))[1],
                   (ARRAY_AGG(home_spread ORDER BY ts_recorded ASC))[1],
                   (ARRAY_AGG(total_line ORDER BY ts_recorded ASC))[1],
                   STDDEV(home_prob), COUNT(*)
              FROM cons
            """,
            (event_id, sport_key, cutoff),
        )
        row = cur.fetchone()
        if not row or row[0] is None:
            return zeros
        (ph, pa, overround, n_books, spread, total, hso, aso, oo, uo,
         open_hp, open_ap, open_spread, open_total, vol, n_snap) = row
        ph, pa = float(ph or 0.5), float(pa or 0.5)
        open_hp, open_ap = float(open_hp or ph), float(open_ap or pa)
        spread, total = float(spread or 0.0), float(total or 0.0)
        open_spread = float(open_spread) if open_spread is not None else spread
        open_total = float(open_total) if open_total is not None else total
        return {
            "prob_home": ph, "prob_away": pa, "open_home_prob": open_hp, "open_away_prob": open_ap,
            "home_prob_drift": ph - open_hp, "away_prob_drift": pa - open_ap,
            "home_odds_volatility": float(vol or 0.0), "overround": float(overround or 1.0),
            "n_bookmakers": float(n_books or 1), "n_snapshots": float(n_snap or 0),
            "odds_diff": spread, "prob_diff": ph - pa, "home_is_favorite": 1.0 if ph > 0.5 else 0.0,
            "spread_line": spread, "spread_drift": spread - open_spread,
            "home_spread_odds": float(hso or 0.0), "away_spread_odds": float(aso or 0.0),
            "open_spread": open_spread, "total_line": total, "total_drift": total - open_total,
            "over_odds": float(oo or 0.0), "under_odds": float(uo or 0.0), "open_total": open_total,
        }

    # ---------------------------------------------------------------- group 3
    def _rest(self, cur, sport_key: str, home: str, away: str, cutoff: datetime) -> Dict[str, float]:
        def last_game(team: str) -> Optional[datetime]:
            cur.execute(
                """
                SELECT MAX(commence_time) FROM multisport_fixtures
                 WHERE sport_key = %s AND (home_team = %s OR away_team = %s)
                   AND status = 'finished' AND commence_time < %s
                """,
                (sport_key, team, team, cutoff),
            )
            r = cur.fetchone()
            return _aware(r[0]) if r and r[0] else None

        def rest_hours(last: Optional[datetime]) -> float:
            if last is None:
                return 240.0
            return max((cutoff - last).total_seconds() / 3600.0, 0.0)

        hh, ah = rest_hours(last_game(home)), rest_hours(last_game(away))
        hd, ad = min(hh / 24.0, 14.0), min(ah / 24.0, 14.0)
        hb, ab = (1.0 if hh <= B2B_HOURS else 0.0), (1.0 if ah <= B2B_HOURS else 0.0)
        return {"home_rest_days": hd, "away_rest_days": ad, "home_is_b2b": hb, "away_is_b2b": ab,
                "rest_advantage": hd - ad, "b2b_disadvantage": ab - hb}

    # ---------------------------------------------------------------- group 4
    def _form(self, cur, sport_key: str, home: str, away: str, cutoff_date: date) -> Dict[str, float]:
        def team_form(team: str, as_home: Optional[bool], n: int):
            if as_home is True:
                cur.execute(
                    """SELECT outcome, home_score - away_score FROM multisport_training
                        WHERE sport_key = %s AND home_team = %s AND match_date < %s
                        ORDER BY match_date DESC LIMIT %s""",
                    (sport_key, team, cutoff_date, n))
                rows = [("H" if r[0] == "H" else "L", r[1]) for r in cur.fetchall()]
            elif as_home is False:
                cur.execute(
                    """SELECT outcome, away_score - home_score FROM multisport_training
                        WHERE sport_key = %s AND away_team = %s AND match_date < %s
                        ORDER BY match_date DESC LIMIT %s""",
                    (sport_key, team, cutoff_date, n))
                rows = [("H" if r[0] == "A" else "L", r[1]) for r in cur.fetchall()]
            else:
                cur.execute(
                    """SELECT CASE WHEN home_team = %s THEN outcome
                                   WHEN outcome = 'H' THEN 'A' ELSE 'H' END,
                              CASE WHEN home_team = %s THEN home_score - away_score
                                   ELSE away_score - home_score END
                         FROM multisport_training
                        WHERE sport_key = %s AND (home_team = %s OR away_team = %s) AND match_date < %s
                        ORDER BY match_date DESC LIMIT %s""",
                    (team, team, sport_key, team, team, cutoff_date, n))
                rows = [("H" if r[0] == "H" else "L", r[1]) for r in cur.fetchall()]
            if not rows:
                return 0.5, 0.0
            wins = sum(1 for o, _ in rows if o == "H")
            diffs = [float(d) for _, d in rows if d is not None]
            return wins / len(rows), (sum(diffs) / len(diffs) if diffs else 0.0)

        def season_wr(team: str) -> float:
            cur.execute(
                """SELECT COUNT(*), SUM(CASE WHEN (home_team = %s AND outcome = 'H')
                                              OR (away_team = %s AND outcome = 'A') THEN 1 ELSE 0 END)
                     FROM multisport_training
                    WHERE sport_key = %s AND (home_team = %s OR away_team = %s) AND match_date < %s""",
                (team, team, sport_key, team, team, cutoff_date))
            n, w = cur.fetchone()
            return float(w) / float(n) if n else 0.5

        h10, hpts = team_form(home, None, 10)
        a10, apts = team_form(away, None, 10)
        hh, _ = team_form(home, True, 20)
        aa, _ = team_form(away, False, 20)
        return {
            "home_win_rate_l10": h10, "away_win_rate_l10": a10,
            "home_season_win_rate": season_wr(home), "away_season_win_rate": season_wr(away),
            "home_home_win_rate": hh, "away_away_win_rate": aa,
            "home_pts_diff_avg": max(min(hpts, 30.0), -30.0), "away_pts_diff_avg": max(min(apts, 30.0), -30.0),
            "form_advantage": h10 - a10,
        }

    # ---------------------------------------------------------------- group 5
    def _elo(self, cur, sport_key: str, home: str, away: str, cutoff_date: date) -> Dict[str, float]:
        cur.execute(
            """SELECT home_team, away_team, outcome FROM multisport_training
                WHERE sport_key = %s AND match_date < %s ORDER BY match_date ASC, id ASC""",
            (sport_key, cutoff_date))
        ratings: Dict[str, float] = {}
        for h, a, outcome in cur.fetchall():
            hr, ar = ratings.get(h, ELO_START), ratings.get(a, ELO_START)
            exp_h = 1.0 / (1.0 + 10 ** ((ar - hr) / 400.0))
            act_h = 1.0 if outcome == "H" else 0.0
            ratings[h] = hr + ELO_K * (act_h - exp_h)
            ratings[a] = ar + ELO_K * ((1 - act_h) - (1 - exp_h))
        he, ae = ratings.get(home, ELO_START), ratings.get(away, ELO_START)
        adv = SPORTS[sport_key].elo_home_adv if sport_key in SPORTS else 35.0
        diff = he + adv - ae
        return {"home_elo": he, "away_elo": ae, "elo_diff": diff,
                "elo_home_win_prob": 1.0 / (1.0 + 10 ** (-diff / 400.0))}

    # ---------------------------------------------------------------- group 6
    def _h2h(self, cur, sport_key: str, home: str, away: str, cutoff_date: date) -> Dict[str, float]:
        cur.execute(
            """SELECT outcome, home_team FROM multisport_training
                WHERE sport_key = %s AND ((home_team = %s AND away_team = %s) OR (home_team = %s AND away_team = %s))
                  AND match_date < %s ORDER BY match_date DESC LIMIT 15""",
            (sport_key, home, away, away, home, cutoff_date))
        rows = cur.fetchall()
        if not rows:
            return {"h2h_home_win_rate": 0.5, "h2h_matches_used": 0.0}
        wins = sum(1 for o, ht in rows if (ht == home and o == "H") or (ht == away and o == "A"))
        return {"h2h_home_win_rate": wins / len(rows), "h2h_matches_used": float(len(rows))}

    # ---------------------------------------------------------------- group 7
    def _season(self, sport_key: str, game_date, cutoff: datetime) -> Dict[str, float]:
        gd = game_date.date() if isinstance(game_date, datetime) else game_date
        cfg = SPORTS.get(sport_key)
        (sm, sd), (em, ed) = (cfg.season_start, cfg.season_end) if cfg else ((10, 1), (4, 30))
        if gd.month >= sm:
            start, end = date(gd.year, sm, sd), date(gd.year + 1, em, ed)
        else:
            start, end = date(gd.year - 1, sm, sd), date(gd.year, em, ed)
        progress = min(max((gd - start).days, 0) / max((end - start).days, 1), 1.0)
        hours = max((cutoff - datetime.now(timezone.utc)).total_seconds() / 3600.0, 0.0)
        return {"season_progress": progress, "time_to_game_hours": min(hours, 168.0)}
