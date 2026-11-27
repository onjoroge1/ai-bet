"""Walk-forward evaluation, market timing and injury event study (research, paper only).

Everything here reads stored BACKTEST estimates, which were made with information available at each
prediction time (estimates.py). Rules:
  * one observation per player-game (or team-game) x family at its main line, so several thresholds
    of one game never count as several games; bootstrap intervals resample GAMES;
  * every strategy places at most one bet per estimate (its best-EV quote), at the executable price
    after fees;
  * the evaluation dates are split in half; a strategy counts as surviving only if it made money in
    the earlier half AND the later half's 90% interval is above zero.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)
RNG = np.random.default_rng(5)
MIN_BETS_TO_JUDGE = 60


def _ll(p, y):
    p = np.clip(np.asarray(p, float), 1e-4, 1 - 1e-4)
    return float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)))


def _brier(p, y):
    return float(np.mean((np.asarray(p, float) - y) ** 2))


def _logit(p):
    p = np.clip(np.asarray(p, float), 1e-4, 1 - 1e-4)
    return np.log(p / (1 - p))


def cluster_ci(values: pd.Series, groups: pd.Series, n: int = 2000, q=(5, 95)) -> List[Optional[float]]:
    df = pd.DataFrame({"v": values.to_numpy(float), "g": groups.to_numpy()})
    agg = df.groupby("g")["v"].agg(["sum", "count"])
    if len(agg) < 3:
        return [None, None]
    idx = RNG.integers(0, len(agg), size=(n, len(agg)))
    s, c = agg["sum"].to_numpy()[idx].sum(1), agg["count"].to_numpy()[idx].sum(1)
    return [round(float(x), 4) for x in np.percentile(s / c, q)]


def load_backtest(conn, start: Optional[datetime] = None) -> pd.DataFrame:
    lines = pd.read_sql("""
        SELECT e.id AS estimate_id, e.sport_key, e.event_id, e.commence_time, e.subject, e.subject_type, e.stat,
               e.mean::float AS mean, e.actual::float AS actual, e.factors, e.combos, e.hit_rate,
               l.source, l.book, l.market_id, l.threshold::float AS threshold, l.side, l.quote_ts, l.price::float AS price,
               l.fee::float AS fee, l.breakeven_prob::float AS breakeven_prob, l.displayed_prob::float AS displayed_prob,
               l.our_prob::float AS our_prob, l.ev::float AS ev, l.result, l.pnl::float AS pnl
          FROM multisport_prop_estimates e JOIN multisport_prop_lines l ON l.estimate_id = e.id
         WHERE e.mode = 'backtest' AND (%s::timestamptz IS NULL OR e.commence_time >= %s)""",
                        conn, params=(start, start))
    lines["commence_time"] = pd.to_datetime(lines["commence_time"], utc=True)
    lines["date"] = lines["commence_time"].dt.tz_convert("America/New_York").dt.date
    return lines


def main_line_table(lines: pd.DataFrame) -> pd.DataFrame:
    """One row per estimate: main threshold (median quoted), the yes-side model probability, the market's
    displayed probability there (no-vig book average, else Kalshi), and the settled outcome."""
    yes = lines[lines["side"] == "yes"]
    rows = []
    for eid, g in yes.groupby("estimate_id"):
        sb = g[g["source"] == "sportsbook"]
        pool = sb if len(sb) else g
        main = float(np.median(pool["threshold"]))
        at = pool[pool["threshold"] == main]
        if at.empty:
            at = pool.iloc[(pool["threshold"] - main).abs().argsort()[:1]]
            main = float(at["threshold"].iloc[0])
        settled = at[at["result"].isin(["win", "loss"])]
        r = g.iloc[0]
        rows.append({"estimate_id": eid, "sport_key": r["sport_key"], "stat": r["stat"], "event_id": r["event_id"],
                     "date": r["date"], "subject": r["subject"], "mean": r["mean"], "actual": r["actual"], "main": main,
                     "market_src": at["source"].iloc[0],
                     "p_model": float(at["our_prob"].iloc[0]),
                     "p_market": float(at["displayed_prob"].dropna().mean()) if at["displayed_prob"].notna().any() else np.nan,
                     "y": (1.0 if settled["result"].iloc[0] == "win" else 0.0) if len(settled) else np.nan})
    return pd.DataFrame(rows)


def family_metrics(mt: pd.DataFrame) -> List[Dict]:
    out = []
    for (sport, stat), g in mt.groupby(["sport_key", "stat"]):
        s = g.dropna(subset=["y", "p_market"])
        err = g.dropna(subset=["actual"])
        row = {"sport": sport, "stat": stat, "estimates": int(len(g)), "games": int(g["event_id"].nunique()),
               "settled_main_lines": int(len(s)), "small_sample": len(s) < 100}
        if len(err) and stat not in ("team_win",):
            row["mae_model"] = round(float(np.mean(np.abs(err["actual"] - err["mean"]))), 3)
            row["mae_market_line"] = round(float(np.mean(np.abs(err["actual"] - err["main"]))), 3)
        if len(s) >= 10:
            blend = 1 / (1 + np.exp(-(0.5 * _logit(s["p_model"]) + 0.5 * _logit(s["p_market"]))))
            row.update({"logloss_model": round(_ll(s["p_model"], s["y"]), 4),
                        "logloss_market": round(_ll(s["p_market"], s["y"]), 4),
                        "logloss_blend": round(_ll(blend, s["y"]), 4),
                        "brier_model": round(_brier(s["p_model"], s["y"]), 4),
                        "brier_market": round(_brier(s["p_market"], s["y"]), 4)})
            d = (s.assign(l_m=-(s["y"] * np.log(np.clip(s["p_model"], 1e-4, 1)) +
                                (1 - s["y"]) * np.log(np.clip(1 - s["p_model"], 1e-4, 1))),
                          l_k=-(s["y"] * np.log(np.clip(s["p_market"], 1e-4, 1)) +
                                (1 - s["y"]) * np.log(np.clip(1 - s["p_market"], 1e-4, 1)))))
            row["logloss_gap_ci"] = cluster_ci(d["l_m"] - d["l_k"], d["event_id"])
        out.append(row)
    return out


def calibration(mt: pd.DataFrame, col: str) -> List[Dict]:
    s = mt.dropna(subset=["y", col])
    s = s.assign(b=np.clip((s[col] * 10).astype(int), 0, 9))
    return [{"bucket": f"{b / 10:.1f}-{(b + 1) / 10:.1f}", "n": int(len(g)), "predicted": round(float(g[col].mean()), 3),
             "actual": round(float(g["y"].mean()), 3)} for b, g in s.groupby("b")]


def _blend_ev(lines: pd.DataFrame) -> pd.Series:
    """EV using the average (in log-odds) of our probability and the market's displayed probability."""
    p = 1 / (1 + np.exp(-(0.5 * _logit(lines["our_prob"]) + 0.5 * _logit(lines["displayed_prob"]))))
    return p / lines["breakeven_prob"] - 1


STRATEGIES = {
    "model_ev_5": "model EV >= 5% at the best executable quote",
    "model_ev_10": "model EV >= 10% at the best executable quote",
    "blend_ev_3": "50/50 model-market blend EV >= 3%",
    "kalshi_model_ev_5": "Kalshi quotes only, model EV >= 5% after fees",
    "teammate_out_overs": "NBA: over at the main line when rotation teammates are listed out (best book price)",
    "market_all_overs": "baseline: every main-line over at the best price (what the market alone gives)",
}


def strategy_bets(lines: pd.DataFrame, mt: pd.DataFrame) -> Dict[str, pd.DataFrame]:
    L = lines[lines["result"].isin(["win", "loss", "push", "void", "fair"])].copy()
    L["blend_ev"] = _blend_ev(L)
    def best(df, col, thr):
        df = df[df[col] >= thr]
        return df.sort_values(col, ascending=False).groupby("estimate_id").head(1)
    out = {"model_ev_5": best(L, "ev", 0.05), "model_ev_10": best(L, "ev", 0.10),
           "blend_ev_3": best(L[L["displayed_prob"].notna()], "blend_ev", 0.03),
           "kalshi_model_ev_5": best(L[L["source"] == "kalshi"], "ev", 0.05)}
    main = mt.set_index("estimate_id")["main"]
    over = L[(L["side"] == "yes") & (L["source"] == "sportsbook")]
    over = over[over["threshold"] == over["estimate_id"].map(main)]
    over_best = over.sort_values("price", ascending=False).groupby("estimate_id").head(1)
    out["market_all_overs"] = over_best[over_best["subject_type"] == "player"]
    has_out = lines.drop_duplicates("estimate_id").set_index("estimate_id")["factors"].map(
        lambda f: bool((f or {}).get("teammates_out")) if isinstance(f, dict) else bool(json.loads(f or "{}").get("teammates_out")))
    out["teammate_out_overs"] = over_best[(over_best["sport_key"] == "basketball_nba") &
                                          over_best["estimate_id"].map(has_out).fillna(False)]
    return out


def roi_summary(bets: pd.DataFrame) -> Dict:
    if bets.empty:
        return {"bets": 0}
    return {"bets": int(len(bets)), "games": int(bets["event_id"].nunique()),
            "roi": round(float(bets["pnl"].mean()), 4), "roi_ci90": cluster_ci(bets["pnl"], bets["event_id"]),
            "avg_ev_claimed": round(float(bets["ev"].mean()), 4), "win_rate": round(float((bets["result"] == "win").mean()), 3),
            "sources": bets["source"].value_counts().to_dict()}


def evaluate(conn, start: Optional[datetime] = None) -> Dict:
    lines = load_backtest(conn, start)
    if lines.empty:
        return {"status": "no backtest estimates"}
    mt = main_line_table(lines)
    dates = sorted(mt["date"].unique())
    cut = dates[len(dates) // 2] if len(dates) > 1 else dates[0]
    rep: Dict = {"created_at": datetime.now(timezone.utc).isoformat(),
                 "period": [str(dates[0]), str(dates[-1])], "split_date": str(cut),
                 "estimates": int(len(mt)), "games": int(mt["event_id"].nunique()),
                 "settled_main_lines": int(mt["y"].notna().sum()), "lines": int(len(lines)),
                 "families": family_metrics(mt),
                 "calibration": {}, "strategies": {}, "survivors": []}
    for sport, g in mt.groupby("sport_key"):
        rep["calibration"][sport] = {"model": calibration(g, "p_model"), "market": calibration(g, "p_market")}
    bets = strategy_bets(lines, mt)
    for name, b in bets.items():
        bdates = sorted(b["date"].unique())
        bcut = bdates[len(bdates) // 2] if len(bdates) > 1 else cut      # each strategy split at its own midpoint
        early, late = b[b["date"] < bcut], b[b["date"] >= bcut]
        s = {"description": STRATEGIES[name], "split_date": str(bcut), "all": roi_summary(b),
             "earlier_half": roi_summary(early),
             "later_half": roi_summary(late), "by_sport": {k: roi_summary(v) for k, v in b.groupby("sport_key")}}
        lh = s["later_half"]
        s["by_family_later_half"] = {f"{k[0]}|{k[1]}": roi_summary(v) for k, v in late.groupby(["sport_key", "stat"])}
        s["survives"] = bool(s["earlier_half"].get("roi", -1) > 0 and lh.get("bets", 0) >= MIN_BETS_TO_JUDGE
                             and (lh.get("roi_ci90") or [None])[0] is not None and lh["roi_ci90"][0] > 0)
        rep["strategies"][name] = s
        if s["survives"]:
            rep["survivors"].append(name)
        for (sport, stat), fb in b.groupby(["sport_key", "stat"]):       # same rule inside each family
            fd = sorted(fb["date"].unique())
            if len(fd) < 4:
                continue
            fc = fd[len(fd) // 2]
            fe, fl = roi_summary(fb[fb["date"] < fc]), roi_summary(fb[fb["date"] >= fc])
            ok = (fe.get("roi", -1) > 0 and fl.get("bets", 0) >= MIN_BETS_TO_JUDGE
                  and (fl.get("roi_ci90") or [None])[0] is not None and fl["roi_ci90"][0] > 0)
            rep.setdefault("family_checks", []).append({"strategy": name, "sport": sport, "stat": stat,
                                                        "earlier": fe, "later": fl, "survives": bool(ok)})
            if ok:
                rep["survivors"].append(f"{name}:{sport}:{stat}")
    rep["family_checks_run"] = len(rep.get("family_checks", []))
    rep["combos"] = combo_eval(lines, mt)
    return rep


def combo_eval(lines: pd.DataFrame, mt: pd.DataFrame) -> Dict:
    """Does modelling dependence help? For players with two settled main lines in one game, compare the
    joint 'both over' estimate with the product of the two marginals (log loss), one row per pair."""
    est = lines.drop_duplicates("estimate_id").set_index("estimate_id")
    mtk = mt.set_index(["event_id", "subject", "stat"])
    rows = []
    for eid, r in est.iterrows():
        combos = r["combos"] if isinstance(r["combos"], list) else json.loads(r["combos"] or "[]")
        for c in combos:
            if c["with"] <= r["stat"]:
                continue                                   # count each pair once
            a, b = (r["event_id"], r["subject"], r["stat"]), (r["event_id"], r["subject"], c["with"])
            if a not in mtk.index or b not in mtk.index:
                continue
            ya, yb = mtk.loc[a, "y"], mtk.loc[b, "y"]
            if isinstance(ya, pd.Series) or isinstance(yb, pd.Series) or np.isnan(ya) or np.isnan(yb):
                continue
            rows.append({"event_id": r["event_id"], "pair": f"{r['stat']}+{c['with']}", "y": ya * yb,
                         "joint": c["p_joint"], "indep": c["p_if_independent"]})
    if not rows:
        return {"pairs": 0, "note": "no settled pairs"}
    d = pd.DataFrame(rows)
    out = {"pairs": int(len(d)), "games": int(d["event_id"].nunique()), "both_hit_rate": round(float(d["y"].mean()), 3),
           "mean_joint": round(float(d["joint"].mean()), 3), "mean_independent": round(float(d["indep"].mean()), 3),
           "logloss_joint": round(_ll(d["joint"], d["y"]), 4), "logloss_independent": round(_ll(d["indep"], d["y"]), 4),
           "by_pair": [], "prices": "no combo prices collected (same-game parlay prices are not in our feeds)"}
    for pair, g in d.groupby("pair"):
        out["by_pair"].append({"pair": pair, "n": int(len(g)), "both_hit": round(float(g["y"].mean()), 3),
                               "joint": round(float(g["joint"].mean()), 3), "independent": round(float(g["indep"].mean()), 3)})
    return out


def market_timing(conn) -> Dict:
    """Kalshi: are quotes further from tip-off less accurate? One quote per market per time bucket,
    settled by Kalshi's result; intervals resample games."""
    q = pd.read_sql("""
        SELECT s.kalshi_ticker, COALESCE(s.event_id, k.event_id) AS event_id, s.sport_key, s.market_type,
               s.yes_bid::float AS yes_bid, s.yes_ask::float AS yes_ask, s.ts_recorded, f.commence_time, k.result
          FROM multisport_kalshi_snapshots s
          JOIN multisport_kalshi_markets k ON k.ticker = s.kalshi_ticker AND k.result IN ('yes', 'no')
          JOIN multisport_fixtures f ON f.event_id = COALESCE(s.event_id, k.event_id)
         WHERE s.ts_recorded < f.commence_time AND s.yes_bid > 0 AND s.yes_ask < 1""", conn)
    if q.empty:
        return {"quotes": 0}
    q["hours"] = (pd.to_datetime(q["commence_time"], utc=True) - pd.to_datetime(q["ts_recorded"], utc=True)
                  ).dt.total_seconds() / 3600
    q["bucket"] = pd.cut(q["hours"], [0, 1, 3, 6, 12, 24, 1e9], labels=["0-1h", "1-3h", "3-6h", "6-12h", "12-24h", "24h+"])
    q["mid"] = (q["yes_bid"] + q["yes_ask"]) / 2
    q["y"] = (q["result"] == "yes").astype(float)
    q["family"] = np.where(q["market_type"].str.startswith("player_"), "player props", "game markets")
    q = q.sort_values("ts_recorded").groupby(["kalshi_ticker", "bucket"], observed=True).tail(1)
    out = []
    for (fam, b), g in q.groupby(["family", "bucket"], observed=True):
        sq = (g["mid"] - g["y"]) ** 2
        out.append({"family": fam, "hours_before": str(b), "quotes": int(len(g)), "games": int(g["event_id"].nunique()),
                    "brier": round(float(sq.mean()), 4), "brier_ci90": cluster_ci(sq, g["event_id"]),
                    "mean_price": round(float(g["mid"].mean()), 3), "hit_rate": round(float(g["y"].mean()), 3),
                    "avg_spread": round(float((g["yes_ask"] - g["yes_bid"]).mean()), 3)})
    return {"quotes": int(len(q)), "by_bucket": out}


def injury_events(conn, key_minutes: float = 28.0) -> Dict:
    """NBA: a rotation player (28+ recent minutes, played the team's previous game) first listed Out or
    Doubtful within 36 h of a game. How did the team's win price move, and was it right after it had
    an hour to react? Also teammates' Kalshi points markets around the same news."""
    inj = pd.read_sql("""SELECT team, player_name, status, first_seen FROM multisport_injuries
                          WHERE sport_key = 'basketball_nba' AND status IN ('Out', 'Doubtful')""", conn)
    if inj.empty:
        return {"events": 0}
    from .model import load_player_games, name_key
    hist = load_player_games(conn, "basketball_nba")
    inj["first_seen"] = pd.to_datetime(inj["first_seen"], utc=True)
    inj["key"] = inj["player_name"].map(name_key)
    fx = pd.read_sql("""SELECT event_id, commence_time, home_team, away_team, home_score, away_score
                          FROM multisport_fixtures WHERE sport_key = 'basketball_nba' AND home_score IS NOT NULL
                           AND commence_time > now() - interval '60 days'""", conn)
    fx["commence_time"] = pd.to_datetime(fx["commence_time"], utc=True)
    snaps = pd.read_sql("""SELECT event_id, home_prob::float AS home_prob, ts_recorded FROM multisport_odds_snapshots
                            WHERE is_consensus AND sport_key = 'basketball_nba'
                              AND commence_time > now() - interval '60 days'""", conn)
    snaps["ts_recorded"] = pd.to_datetime(snaps["ts_recorded"], utc=True)
    snaps = {e: g.sort_values("ts_recorded") for e, g in snaps.groupby("event_id")}
    rows = []
    played = hist[hist["played"]]
    for r in inj.drop_duplicates(["key", "first_seen"]).itertuples():
        g = fx[((fx["home_team"] == r.team) | (fx["away_team"] == r.team)) &
               (fx["commence_time"] > r.first_seen) & (fx["commence_time"] <= r.first_seen + timedelta(hours=36))]
        if g.empty:
            continue
        game = g.sort_values("commence_time").iloc[0]
        ph = played[(played["key"] == r.key) & (played["game_time"] < r.first_seen)]
        team_games = played[(played["team"] == r.team) & (played["game_time"] < r.first_seen)]
        if ph.empty or team_games.empty:
            continue
        if ph["espn_event_id"].iloc[-1] != team_games["espn_event_id"].iloc[-1]:
            continue                                     # not newly out: missed the previous game too
        if ph["minutes"].tail(10).mean() < key_minutes:
            continue
        s = snaps.get(game["event_id"])
        if s is None:
            continue
        home = game["home_team"] == r.team
        p = s["home_prob"] if home else 1 - s["home_prob"]
        before = p[s["ts_recorded"] <= r.first_seen]
        after = p[(s["ts_recorded"] >= r.first_seen + timedelta(minutes=45)) & (s["ts_recorded"] < game["commence_time"])]
        if before.empty or after.empty:
            continue
        won = float((game["home_score"] > game["away_score"]) == home)
        rows.append({"event_id": game["event_id"], "player": r.player_name, "team": r.team,
                     "hours_before_tip": round((game["commence_time"] - r.first_seen).total_seconds() / 3600, 1),
                     "p_before": float(before.iloc[-1]), "p_after_1h": float(after.iloc[0]), "p_close": float(after.iloc[-1]),
                     "won": won})
    if not rows:
        return {"events": 0}
    d = pd.DataFrame(rows)
    d["initial_move"] = d["p_after_1h"] - d["p_before"]
    d["later_move"] = d["p_close"] - d["p_after_1h"]
    d["resid_after_1h"] = d["won"] - d["p_after_1h"]
    d["resid_close"] = d["won"] - d["p_close"]
    summ = {"events": int(len(d)), "games": int(d["event_id"].nunique()), "small_sample": len(d) < 40}
    for c in ("initial_move", "later_move", "resid_after_1h", "resid_close"):
        summ[c] = {"mean": round(float(d[c].mean()), 4), "ci90": cluster_ci(d[c], d["event_id"])}
    summ["reading"] = ("initial_move: how the injured player's team price changed in the first hour; later_move: "
                       "drift after that; resid_*: result minus price (0 = priced right). A pattern that remains after "
                       "the market reacted would show as a later_move or resid_after_1h interval away from 0.")
    summ["examples"] = d.sort_values("initial_move").head(8).round(3).to_dict("records")
    summ["prop_lines_gap"] = ("Sportsbook prop lines are pulled once per game (30-90 min before tip), so they cannot "
                              "show the move around injury news; Kalshi player-prop candles can (see kalshi_moves).")
    summ["kalshi_moves"] = _kalshi_teammate_moves(conn, d)
    return summ


def _kalshi_teammate_moves(conn, events: pd.DataFrame) -> Dict:
    if events.empty:
        return {"events": 0}
    q = pd.read_sql("""
        SELECT s.kalshi_ticker, k.event_id, k.player_name, s.yes_bid::float AS yes_bid, s.yes_ask::float AS yes_ask,
               s.ts_recorded, k.result
          FROM multisport_kalshi_snapshots s JOIN multisport_kalshi_markets k ON k.ticker = s.kalshi_ticker
         WHERE k.market_type = 'player_points' AND k.event_id = ANY(%s) AND s.yes_bid > 0""",
                    conn, params=(list(events["event_id"].unique()),))
    if q.empty:
        return {"events": 0, "note": "no Kalshi player-points quotes for these games"}
    q["ts_recorded"] = pd.to_datetime(q["ts_recorded"], utc=True)
    inj_time = pd.read_sql("""SELECT team, player_name, first_seen FROM multisport_injuries
                               WHERE sport_key = 'basketball_nba' AND status IN ('Out','Doubtful')""", conn)
    rows = []
    for e in events.itertuples():
        seen = inj_time[(inj_time["player_name"] == e.player)]["first_seen"]
        if seen.empty:
            continue
        t0 = pd.to_datetime(seen.min(), utc=True)
        for tk, g in q[q["event_id"] == e.event_id].groupby("kalshi_ticker"):
            g = g.sort_values("ts_recorded")
            b, a = g[g["ts_recorded"] <= t0], g[g["ts_recorded"] >= t0 + timedelta(minutes=45)]
            if b.empty or a.empty or g["player_name"].iloc[0] == e.player:
                continue
            mid_b = (b["yes_bid"].iloc[-1] + b["yes_ask"].iloc[-1]) / 2
            mid_a = (a["yes_bid"].iloc[0] + a["yes_ask"].iloc[0]) / 2
            y = float(g["result"].iloc[-1] == "yes") if g["result"].iloc[-1] in ("yes", "no") else np.nan
            rows.append({"event_id": e.event_id, "move": mid_a - mid_b, "resid_after": y - mid_a})
    if not rows:
        return {"events": 0, "note": "Kalshi props opened after the news for these games"}
    d = pd.DataFrame(rows).dropna()
    return {"markets": int(len(d)), "games": int(d["event_id"].nunique()),
            "move": {"mean": round(float(d["move"].mean()), 4), "ci90": cluster_ci(d["move"], d["event_id"])},
            "resid_after": {"mean": round(float(d["resid_after"].mean()), 4),
                            "ci90": cluster_ci(d["resid_after"], d["event_id"])}}


def save_report(conn, kind: str, report: Dict) -> int:
    with conn.cursor() as cur:
        cur.execute("INSERT INTO multisport_prop_reports (kind, report) VALUES (%s, %s::jsonb) RETURNING id",
                    (kind, json.dumps(report, default=str)))
        rid = cur.fetchone()[0]
    conn.commit()
    return rid
