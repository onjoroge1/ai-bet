"""Prop analysis: fees and EV, distributions, no look-ahead in features, Kalshi parsing, the common
record's settlement rules, and storing/settling live estimates."""
from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd
import pytest

from snapbet_pipeline.prop_analysis import model as M
from snapbet_pipeline.prop_analysis import estimates as E
from snapbet_pipeline.prop_analysis import run as R
from snapbet_pipeline.prop_analysis.kalshi_props import market_row, player_name
from snapbet_pipeline.prop_analysis.pricing import (breakeven_price, kalshi_fee, kalshi_quote, side_result,
                                                     sportsbook_quote)


# ----------------------------------------------------------------------------- pricing

def test_kalshi_fee_rounds_up_per_order():
    assert kalshi_fee(0.5, contracts=100) == pytest.approx(0.0175)      # $1.75 on 100 contracts
    assert kalshi_fee(0.5, contracts=1) == pytest.approx(0.02)          # 1.75 cents rounds up to 2
    assert kalshi_fee(0.97, contracts=1) == pytest.approx(0.01)
    assert kalshi_fee(0.0) == 0 and kalshi_fee(1.0) == 0


def test_quotes_breakeven_ev_and_pnl():
    q = sportsbook_quote("yes", 1.91)
    assert q.breakeven_prob == pytest.approx(1 / 1.91)
    assert q.ev(0.55) == pytest.approx(0.55 * 1.91 - 1)
    assert q.pnl("win") == pytest.approx(0.91) and q.pnl("push") == 0 and q.pnl("loss") == -1
    k = kalshi_quote("no", yes_bid=0.40, yes_ask=0.42)                 # No costs 1 - 0.40 = 0.60
    assert k.price == pytest.approx(0.60) and k.cost == pytest.approx(0.60 + kalshi_fee(0.60))
    assert k.ev(0.65) == pytest.approx(0.65 / k.cost - 1)
    assert k.pnl("fair", settlement_value=0.5) == pytest.approx(0.5 / k.cost - 1)
    assert kalshi_quote("yes", None, None) is None and sportsbook_quote("yes", 1.0) is None


def test_breakeven_price_includes_fee():
    a = breakeven_price("kalshi", 0.60)
    assert a + kalshi_fee(a) <= 0.60 and (a + 0.01) + kalshi_fee(a + 0.01) > 0.60
    assert breakeven_price("sportsbook", 0.5) == pytest.approx(2.0)


def test_side_result():
    assert side_result("yes", "yes") == "win" and side_result("yes", "no") == "loss"
    assert side_result("push", "no") == "push" and side_result("fair", "yes") == "fair" and side_result(None, "yes") is None


# ----------------------------------------------------------------------------- distributions

def _ff(dist, r=None, z=None):
    fam = M.Family("basketball_nba", "player_points", "points", "minutes", dist, "points")
    return M.FittedFamily(fam, [], np.zeros(0), np.ones(0), [], r=r, z=z)


def test_threshold_curve_is_one_distribution():
    ff = _ff("negbin", r=6.0)
    mu = np.array([20.0])
    p = [float(ff.sf(t, mu)[0]) for t in (14.5, 19.5, 24.5)]
    assert p[0] > p[1] > p[2]                                           # 15+ > 20+ > 25+ from the same estimate
    assert float(ff.sf(19.5, mu)[0]) == pytest.approx(float(ff.sf(19, mu)[0]))   # P(>19.5) = P(>=20) = P(>19)
    assert float(ff.pmf_at(20.0, mu)[0]) > 0 and float(ff.pmf_at(19.5, mu)[0]) == 0
    emp = _ff("empirical", z=np.sort(np.random.default_rng(0).normal(size=4000)))
    assert float(emp.sf(60, np.array([60.0]))[0]) == pytest.approx(0.5, abs=0.03)


def test_team_distributions():
    assert M.win_prob(np.array([0.0]), 12.0)[0] == pytest.approx(0.5)
    assert M.normal_sf(7.5, 7.5, 10.0) == pytest.approx(0.5)               # P(>=8): continuity cut at 7.5
    assert M.normal_sf(8.5, 7.5, 10.0) == pytest.approx(1 - M.stats.norm.cdf(0.1))
    assert float(M.normal_pmf(7.0, 7.0, 10.0)) > 0 and float(M.normal_pmf(7.5, 7.0, 10.0)) == 0


def test_joint_and_wilson():
    assert M.joint_over(0.4, 0.5, 0.0) == pytest.approx(0.2, abs=1e-3)
    assert M.joint_over(0.4, 0.5, 0.5) > 0.2
    lo, hi = M.wilson(5, 10)
    assert lo < 0.5 < hi and M.wilson(0, 0) == (None, None)


# ----------------------------------------------------------------------------- no look-ahead

def _games(n=8, upcoming=False):
    t0 = pd.Timestamp("2026-11-01", tz="UTC")
    rows = []
    for i in range(n):
        for k, pts in (("a", 10 + i), ("b", 20)):
            rows.append({"espn_event_id": f"g{i}", "event_id": f"e{i}", "game_time": t0 + pd.Timedelta(days=2 * i),
                         "team": "A", "opponent": "B", "is_home": i % 2 == 0, "player_id": k, "player_name": k,
                         "key": k, "played": True, "starter": True, "minutes": 30, "points": pts,
                         "rebounds": 5, "assists": 3, "threes_made": 1, "synthetic": False})
            rows.append({"espn_event_id": f"g{i}", "event_id": f"e{i}", "game_time": t0 + pd.Timedelta(days=2 * i),
                         "team": "B", "opponent": "A", "is_home": i % 2 == 1, "player_id": k + "2",
                         "player_name": k + "2", "key": k + "2", "played": True, "starter": True, "minutes": 30,
                         "points": 15, "rebounds": 5, "assists": 3, "threes_made": 1, "synthetic": False})
    df = pd.DataFrame(rows)
    if upcoming:
        df = pd.concat([df, pd.DataFrame([{"espn_event_id": "pred:x", "event_id": "x",
                                           "game_time": t0 + pd.Timedelta(days=2 * n), "team": "A", "opponent": "B",
                                           "is_home": True, "player_id": "pred:a", "player_name": "a", "key": "a",
                                           "played": True, "synthetic": True, "out_min_override": 0.0}])],
                       ignore_index=True)
    df["season"] = M.season_of(df["game_time"])
    return df


def test_features_use_only_earlier_games():
    fam = M.FAMILY[("basketball_nba", "player_points")]
    d = M.player_features(_games(), fam)
    a = d[d["key"] == "a"].sort_values("game_time")
    # player a scored 10, 11, 12, ...: the short-window average before game i must ignore game i itself
    assert a["s_short"].iloc[1] == pytest.approx(10) and a["s_short"].iloc[5] == pytest.approx(np.mean([10, 11, 12, 13, 14]))
    assert pd.isna(a["s_short"].iloc[0])


def test_upcoming_row_does_not_change_history():
    fam = M.FAMILY[("basketball_nba", "player_points")]
    base = M.player_features(_games(), fam)
    with_up = M.player_features(_games(upcoming=True), fam)
    real = with_up[~with_up["synthetic"].astype(bool)]
    assert np.allclose(real.sort_index()["opp_factor"], base.sort_index()["opp_factor"])
    up = with_up[with_up["synthetic"].astype(bool)].iloc[0]
    assert up["s_short"] == pytest.approx(np.mean([13, 14, 15, 16, 17]))       # last 5 real games of player a


# ----------------------------------------------------------------------------- Kalshi

def test_kalshi_market_row_keeps_ticker_rules_and_settlement():
    m = {"ticker": "KXNBAPTS-26NOV25MINOKC-MINBHYLANDPG-15", "event_ticker": "KXNBAPTS-26NOV25MINOKC",
         "floor_strike": 14.5, "strike_type": "greater", "title": "Bones Hyland: 15+ points",
         "yes_sub_title": "Bones Hyland: 15+", "rules_primary": "If Bones Hyland records 15+ points ...",
         "status": "finalized", "result": "", "settlement_value_dollars": "0.5000", "expiration_value": "9",
         "open_time": "2026-11-25T23:06:23Z", "close_time": "2026-11-26T03:11:54Z"}
    row = market_row(m, "basketball_nba", "KXNBAPTS", "player_points", "ev1")
    assert row[0] == m["ticker"] and row[4] == "ev1" and row[5] == "26NOV25MINOKC" and row[7] == "Bones Hyland"
    assert row[9] == 14.5 and row[13].startswith("If Bones")
    assert row[19] == "" and row[20] == 0.5                                     # fair-price settlement kept
    assert player_name({"title": "Phoenix wins"}) is None


# ----------------------------------------------------------------------------- database

def _seed(conn):
    start = datetime(2026, 11, 20, 0, 10, tzinfo=timezone.utc)
    with conn.cursor() as cur:
        cur.execute("""INSERT INTO multisport_fixtures (sport, sport_key, event_id, home_team, away_team, commence_time,
                           home_score, away_score, status)
                       VALUES ('basketball', 'basketball_nba', 'ev1', 'Los Angeles Lakers', 'Sacramento Kings', %s,
                               110, 104, 'finished')""", (start,))
        cur.execute("""INSERT INTO multisport_match_results (sport_key, event_id, game_date, home_team, away_team,
                           home_score, away_score, result, status) VALUES ('basketball_nba', 'ev1', %s,
                           'Los Angeles Lakers', 'Sacramento Kings', 110, 104, 'H', 'finished')""", (start,))
        for book, o, u in (("dk", 1.91, 1.91), ("fd", 2.0, 1.83)):
            cur.execute("""INSERT INTO multisport_player_props (sport_key, event_id, commence_time, home_team, away_team,
                               bookmaker, market, player_name, line, over_price, under_price, ts_recorded)
                           VALUES ('basketball_nba', 'ev1', %s, 'Los Angeles Lakers', 'Sacramento Kings', %s,
                                   'player_points', 'Luka Doncic', 29.5, %s, %s, %s)""",
                        (start, book, o, u, start - timedelta(minutes=45)))
        cur.execute("""INSERT INTO multisport_player_props (sport_key, event_id, commence_time, home_team, away_team,
                           bookmaker, market, player_name, line, over_price, under_price, ts_recorded)
                       VALUES ('basketball_nba', 'ev1', %s, 'Los Angeles Lakers', 'Sacramento Kings', 'dk',
                               'player_rebounds', 'Bench Guy', 2.5, 1.9, 1.9, %s)""", (start, start - timedelta(minutes=45)))
        cur.execute("""INSERT INTO multisport_prop_actuals VALUES
                       ('basketball_nba', 'ev1', 'player_points', 'Luka Doncic', 31, 'played', now()),
                       ('basketball_nba', 'ev1', 'player_rebounds', 'Bench Guy', NULL, 'void', now())""")
        for tk, res, sv in (("KXNBAPTS-X-LAL-30", "yes", 1.0), ("KXNBAPTS-X-LAL-35", "", 0.5)):
            cur.execute("""INSERT INTO multisport_kalshi_markets (ticker, event_ticker, series_ticker, sport_key, event_id,
                               game_key, market_type, player_name, strike, rules_primary, status, result, settlement_value)
                           VALUES (%s, 'KXNBAPTS-X', 'KXNBAPTS', 'basketball_nba', 'ev1', 'X', 'player_points',
                                   'Luka Doncic', %s, 'If Luka Doncic records ...', 'finalized', %s, %s)""",
                        (tk, 29.5 if tk.endswith("30") else 34.5, res, sv))
            cur.execute("""INSERT INTO multisport_kalshi_snapshots (sport_key, event_id, kalshi_ticker, kalshi_event,
                               game_key, market_type, line, yes_bid, yes_ask, last_price, ts_recorded, quote_source)
                           VALUES ('basketball_nba', 'ev1', %s, 'KXNBAPTS-X', 'X', 'player_points', %s, 0.44, 0.47,
                                   0.45, %s, 'candle_1h')""",
                        (tk, 29.5 if tk.endswith("30") else 34.5, start - timedelta(hours=1)))
    conn.commit()
    return start


def test_common_record_settlement(conn):
    _seed(conn)
    with conn.cursor() as cur:
        cur.execute("""SELECT source, book, stat, subject, threshold::float, yes_price::float, no_price::float, result,
                              settlement_status, rules, market_id FROM multisport_prop_records ORDER BY record_id""")
        rows = cur.fetchall()
    by = {(r[0], r[1], r[2], r[3], r[4]): r for r in rows}
    luka = by[("sportsbook", "dk", "player_points", "Luka Doncic", 29.5)]
    assert luka[7] == "yes" and luka[8] == "settled"
    assert by[("sportsbook", "dk", "player_rebounds", "Bench Guy", 2.5)][7:9] == ("void", "void")
    k30 = by[("kalshi", "kalshi", "player_points", "Luka Doncic", 29.5)]
    assert k30[5] == pytest.approx(0.47) and k30[6] == pytest.approx(0.56) and k30[7] == "yes"
    assert k30[9].startswith("If Luka") and k30[10] == "KXNBAPTS-X-LAL-30"
    k35 = by[("kalshi", "kalshi", "player_points", "Luka Doncic", 34.5)]
    assert k35[7:9] == ("fair", "fair_price")


def test_store_and_settle_live(conn):
    start = _seed(conn)
    quotes = E._player_quote_dicts(
        pd.DataFrame([{"over_price": 1.91, "under_price": 1.91, "actual": np.nan, "actual_status": None,
                       "line": 29.5, "bookmaker": "dk", "ts_recorded": start - timedelta(minutes=45),
                       "event_id": "ev1", "market": "player_points", "player_name": "Luka Doncic"}]),
        pd.DataFrame(columns=["last_price", "yes_bid", "yes_ask", "result", "settlement_value", "strike",
                              "ts_recorded", "kalshi_ticker"]))
    ff = _ff("negbin", r=8.0)
    lines, _ = E.price_lines(lambda t: (ff.sf(t, np.array([31.0, 30.0, 32.0])), ff.pmf_at(t, np.array([31.0] * 3))),
                             [29.5], quotes)
    est = {"sport_key": "basketball_nba", "event_id": "ev1", "commence_time": start, "home_team": "Los Angeles Lakers",
           "away_team": "Sacramento Kings", "subject_type": "player", "subject": "Luka Doncic",
           "team": "Los Angeles Lakers", "opponent": "Sacramento Kings", "is_home": True, "stat": "player_points",
           "prediction_ts": start - timedelta(minutes=30), "mean": 31.0, "dist": "negbin", "dist_params": {"r": 8},
           "curve": [], "hit_rate": None, "factors": {"items": []}, "market_main": {"line": 29.5, "prob": 0.5},
           "actual": None, "lines": lines, "combos": []}
    assert E.store(conn, [est], "live") == {"estimates": 1, "lines": 2, "games": 1, "subjects": 1}
    assert R.settle_live(conn, now=start + timedelta(hours=6))["lines_settled"] == 2
    with conn.cursor() as cur:
        cur.execute("""SELECT l.side, l.result, l.pnl::float, e.actual::float, jsonb_array_length(e.history)
                         FROM multisport_prop_lines l JOIN multisport_prop_estimates e ON e.id = l.estimate_id
                        ORDER BY l.side DESC""")
        rows = cur.fetchall()
    assert rows[0][:3] == ("yes", "win", pytest.approx(0.91)) and rows[1][:3] == ("no", "loss", -1.0)
    assert rows[0][3] == 31 and rows[0][4] == 1


def test_team_store_keeps_player_estimates_of_the_same_game(conn):
    start = _seed(conn)
    base = {"sport_key": "basketball_nba", "event_id": "ev1", "commence_time": start, "home_team": "Los Angeles Lakers",
            "away_team": "Sacramento Kings", "team": "Los Angeles Lakers", "opponent": "Sacramento Kings", "is_home": True,
            "prediction_ts": start - timedelta(hours=1), "mean": 3.0, "dist": "normal", "dist_params": {}, "curve": [],
            "hit_rate": None, "factors": {"items": []}, "market_main": None, "actual": None, "lines": [], "combos": []}
    E.store(conn, [dict(base, subject_type="player", subject="Luka Doncic", stat="player_points")], "backtest")
    E.store(conn, [dict(base, subject_type="team", subject="Los Angeles Lakers", stat="team_margin")], "backtest")
    with conn.cursor() as cur:
        cur.execute("SELECT subject_type FROM multisport_prop_estimates ORDER BY 1")
        assert [r[0] for r in cur.fetchall()] == ["player", "team"]
    with pytest.raises(ValueError):
        E.store(conn, [dict(base, subject_type="player", subject="X", stat="player_points"),
                       dict(base, subject_type="team", subject="Y", stat="team_win")], "backtest")


def test_kalshi_lines_carry_the_risk_the_player_sits_but_book_lines_do_not():
    quotes = [{"source": "sportsbook", "book": "dk", "threshold": 19.5, "quote_ts": None, "market_id": "a",
               "yes_price": 2.0, "no_price": 2.0, "displayed_yes": 0.5, "result": None},
              {"source": "kalshi", "book": "kalshi", "threshold": 19.5, "quote_ts": None, "market_id": "k",
               "yes_bid": 0.45, "yes_ask": 0.47, "displayed_yes": 0.46, "result": None}]
    fn = lambda t: (np.array([0.6, 0.58, 0.62]), np.zeros(3))
    lines, _ = E.price_lines(fn, [19.5], quotes, p_play=0.9)
    p = {(l["source"], l["side"]): l["our_prob"] for l in lines}
    assert p[("sportsbook", "yes")] == pytest.approx(0.6) and p[("kalshi", "yes")] == pytest.approx(0.54)
    assert p[("kalshi", "no")] == pytest.approx(0.46)


def test_appearance_rates():
    df = _games(10)
    df.loc[(df["key"] == "a") & df["espn_event_id"].isin(["g6"]), "played"] = False
    r = M.appearance_rates(df)
    assert 0 < r["after_missed"] <= 1 and r["after_played"] > 0.9
