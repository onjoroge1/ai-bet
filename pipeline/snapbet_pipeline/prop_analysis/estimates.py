"""Estimates and priced lines (research, paper only).

For every player-game x prop family and team-game x market that has a quote, build ONE distribution
(model.py) and price every quoted threshold and side against it at the prediction timestamp:

  backtest mode: walk-forward. Games on date D are predicted by models fit only on games before D.
      Player props: prediction time = the sportsbook pull for that game (30-90 min before tip), or
      60 minutes before tip when only Kalshi quoted it. Team markets: 60 minutes before tip.
      Quotes are the ones recorded at or before that time (Kalshi: up to 6 hours earlier).
      Teammates out come from injury reports seen before the prediction time.
  live mode: upcoming games, prediction time = now, quotes = the latest pull.

Results are filled from the common record's settlement; voids and pushes return the stake and
Kalshi fair-price settlements pay their settlement value.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Iterable, List, Optional, Tuple

import numpy as np
import pandas as pd
from psycopg2.extras import execute_values

from . import model as M
from .pricing import breakeven_price, kalshi_quote, side_result, sportsbook_quote

logger = logging.getLogger(__name__)

MODEL_VERSION = "prop-baseline-v1"
PLAYER_SPORTS = ("basketball_nba", "americanfootball_nfl")
TEAM_SPORTS = ("basketball_nba", "americanfootball_nfl", "icehockey_nhl")
KALSHI_LOOKBACK = timedelta(hours=6)
TEAM_LEAD = timedelta(minutes=60)
SMALL_SAMPLE = 15
OUT_STATUSES = ("Out", "Doubtful", "Suspension")


def _f(x) -> Optional[float]:
    try:
        v = float(x)
        return None if np.isnan(v) else v
    except (TypeError, ValueError):
        return None


def _clean(x):
    """JSON-safe: NaN / numpy scalars -> None / plain numbers, recursively."""
    if isinstance(x, dict):
        return {k: _clean(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [_clean(v) for v in x]
    if isinstance(x, (np.floating, float)):
        return None if np.isnan(x) else float(x)
    if isinstance(x, np.integer):
        return int(x)
    if isinstance(x, np.bool_):
        return bool(x)
    return x


def _j(x) -> str:
    return json.dumps(_clean(x), default=str)


def _r(x, n=4):
    v = _f(x)
    return None if v is None else round(v, n)


# ----------------------------------------------------------------------------- quotes

def sportsbook_player_quotes(conn, start: datetime, end: datetime) -> pd.DataFrame:
    q = pd.read_sql("""
        SELECT p.sport_key, p.event_id, p.commence_time, p.home_team, p.away_team, p.bookmaker, p.market,
               p.player_name, p.line::float AS line, p.over_price::float AS over_price,
               p.under_price::float AS under_price, p.ts_recorded, a.actual::float AS actual, a.status AS actual_status
          FROM multisport_player_props p
          LEFT JOIN multisport_prop_actuals a ON a.event_id = p.event_id AND a.market = p.market
                                             AND a.player_name = p.player_name
         WHERE p.commence_time >= %s AND p.commence_time < %s AND p.sport_key = ANY(%s) AND p.line IS NOT NULL""",
                    conn, params=(start, end, list(PLAYER_SPORTS)))
    for c in ("commence_time", "ts_recorded"):
        q[c] = pd.to_datetime(q[c], utc=True)
    q["key"] = q["player_name"].map(M.name_key)
    return q


def kalshi_quotes(conn, start: datetime, end: datetime, player: bool) -> pd.DataFrame:
    cond = "k.player_name IS NOT NULL" if player else "s.market_type IN ('game', 'spread', 'total', 'team_total')"
    q = pd.read_sql(f"""
        SELECT s.sport_key, COALESCE(s.event_id, k.event_id) AS event_id, f.commence_time, f.home_team, f.away_team,
               s.kalshi_ticker, s.market_type, COALESCE(k.strike, s.line)::float AS strike, s.team, k.player_name,
               s.yes_bid::float AS yes_bid, s.yes_ask::float AS yes_ask, s.last_price::float AS last_price,
               s.ts_recorded, s.quote_source, k.result, k.settlement_value::float AS settlement_value
          FROM multisport_kalshi_snapshots s
          LEFT JOIN multisport_kalshi_markets k ON k.ticker = s.kalshi_ticker
          JOIN multisport_fixtures f ON f.event_id = COALESCE(s.event_id, k.event_id)
         WHERE f.commence_time >= %s AND f.commence_time < %s AND s.ts_recorded < f.commence_time AND {cond}""",
                    conn, params=(start, end))
    for c in ("commence_time", "ts_recorded"):
        q[c] = pd.to_datetime(q[c], utc=True)
    if player:
        q["key"] = q["player_name"].map(M.name_key)
    return q


def _latest(df: pd.DataFrame, by: List[str], ts_col: str, cutoff: pd.Series, lookback: timedelta) -> pd.DataFrame:
    ok = (df[ts_col] <= cutoff) & (df[ts_col] >= cutoff - lookback)
    return df[ok].sort_values(ts_col).groupby(by, as_index=False).tail(1)


# ----------------------------------------------------------------------------- injuries

def outs_at(conn, sport: str) -> pd.DataFrame:
    inj = pd.read_sql("""SELECT team, player_name, status, first_seen, last_seen FROM multisport_injuries
                          WHERE sport_key = %s AND status = ANY(%s)""", conn,
                      params=(sport, list(OUT_STATUSES) + ["Questionable", "Injured Reserve"]))
    for c in ("first_seen", "last_seen"):
        inj[c] = pd.to_datetime(inj[c], utc=True)
    inj["key"] = inj["player_name"].map(M.name_key)
    return inj


def status_at(inj: pd.DataFrame, key: str, ts: pd.Timestamp) -> Optional[str]:
    """The player's injury-report status at `ts` (None = not listed)."""
    r = inj[(inj["key"] == key) & (inj["first_seen"] <= ts) & (inj["last_seen"] >= ts - timedelta(hours=3))]
    return None if r.empty else str(r.sort_values("first_seen")["status"].iloc[-1])


def out_minutes(inj: pd.DataFrame, hist: pd.DataFrame, team: str, ts: pd.Timestamp) -> Tuple[float, List[str]]:
    """Recent minutes of rotation teammates (played one of the team's last 3 games, 15+ avg) listed out
    at `ts` - the prediction-time version of the training feature."""
    listed = inj[(inj["team"] == team) & (inj["first_seen"] <= ts) & (inj["last_seen"] >= ts - timedelta(hours=3))
                 & inj["status"].isin(OUT_STATUSES + ("Injured Reserve",))]
    if listed.empty:
        return 0.0, []
    h = hist[(hist["team"] == team) & (hist["game_time"] < ts) & hist["played"]]
    last3 = h.drop_duplicates("espn_event_id").tail(3)["espn_event_id"]
    recent = set(h[h["espn_event_id"].isin(last3)]["key"])
    total, names = 0.0, []
    for k, name in zip(listed["key"], listed["player_name"]):
        if k in recent:
            m = h[h["key"] == k]["minutes"].tail(10).mean()
            if m >= 15:
                total += float(m)
                names.append(name)
    return total, sorted(set(names))


# ----------------------------------------------------------------------------- hit rates

def hit_rates(past: pd.DataFrame, t: float, today: Dict, sport: str) -> Dict:
    """How often the stat beat t in the player's (or team's) earlier games, overall and by condition.
    One observation per game, so several thresholds never count as several games."""
    def one(mask, label, applies):
        sub = past[mask] if mask is not None else past
        n = int(len(sub))
        k = int((sub["y"] > t).sum())
        lo, hi = M.wilson(k, n)
        return {"condition": label, "n": n, "hits": k, "rate": round(k / n, 3) if n else None,
                "lo": _r(lo, 3), "hi": _r(hi, 3), "small_sample": n < SMALL_SAMPLE, "applies_today": applies}
    out = {"threshold": t, "overall": one(None, "all games", True),
           "last_10": one(past.index.isin(past.tail(10).index), "last 10 games", True), "by_condition": []}
    conds = [(past["home"] == 1, "home", today.get("home") == 1), (past["home"] == 0, "away", today.get("home") == 0),
             (past["rest"] <= 1.5, "on a back-to-back / short rest", (today.get("rest") or 9) <= 1.5),
             (past["rest"] > 1.5, "with rest", (today.get("rest") or 9) > 1.5)]
    if "opponent" in past and today.get("opponent"):
        conds.append((past["opponent"] == today["opponent"], f"vs {today['opponent']}", True))
    if "u_short" in past and past["u_short"].notna().any():
        med = past["u_short"].median()
        conds += [(past["u_short"] >= med, "higher recent minutes / volume", (today.get("u_short") or 0) >= med),
                  (past["u_short"] < med, "lower recent minutes / volume", (today.get("u_short") or 0) < med)]
    if sport == "basketball_nba" and "starter" in past:
        conds += [(past["starter"] == True, "started", today.get("starter_prev") == 1),  # noqa: E712
                  (past["starter"] == False, "came off the bench", today.get("starter_prev") == 0)]  # noqa: E712
    if "out_min" in past:
        conds += [(past["out_min"] >= 2, "rotation teammates out (20+ min)", (today.get("out_min") or 0) >= 2)]
    out["by_condition"] = [one(m.fillna(False).to_numpy(), lbl, bool(a)) for m, lbl, a in conds]
    return out


# ----------------------------------------------------------------------------- pricing a line

def price_lines(prob_fn, thresholds: Iterable[float], quotes: List[Dict],
                p_play: float = 1.0) -> Tuple[List[Dict], Dict[float, Tuple]]:
    """prob_fn(t) -> (p_yes array over refits, p_push array), given the player plays. quotes: dicts with source,
    book, market_id, threshold, quote_ts, yes/no prices, displayed probabilities and record result.
    Books void a prop when the player does not play, so book lines use the conditional probability; Kalshi
    settles No when he is inactive, so Kalshi lines use p_play x P(yes | plays)."""
    cache: Dict[float, Tuple] = {}
    for t in set(float(x) for x in thresholds):
        py, pp = prob_fn(t)
        cache[t] = (float(py[0]), float(np.percentile(py, 5)), float(np.percentile(py, 95)), float(pp[0]))
    out = []
    for q in quotes:
        t = float(q["threshold"])
        p_yes, lo, hi, p_push = cache[t]
        if q["source"] == "kalshi" and p_play < 1:
            p_yes, lo, hi, p_push = p_yes * p_play, lo * p_play, hi * p_play, p_push * p_play
        for side in ("yes", "no"):
            if q["source"] == "sportsbook":
                quote = sportsbook_quote(side, q["yes_price"] if side == "yes" else q["no_price"])
            else:
                quote = kalshi_quote(side, q.get("yes_bid"), q.get("yes_ask"))
            if quote is None:
                continue
            p = p_yes if side == "yes" else max(0.0, 1 - p_yes - p_push)
            plo, phi = (lo, hi) if side == "yes" else (max(0.0, 1 - hi - p_push), max(0.0, 1 - lo - p_push))
            disp = q.get("displayed_yes")
            res = side_result(q.get("result"), side)
            sv = q.get("settlement_value")
            pnl = quote.pnl(res, None if sv is None else (sv if side == "yes" else 1 - sv)) if res else None
            out.append({"source": q["source"], "book": q["book"], "market_id": q["market_id"], "threshold": t,
                        "side": side, "quote_ts": q["quote_ts"], "price": round(quote.price, 4),
                        "price_format": "decimal" if q["source"] == "sportsbook" else "dollars",
                        "fee": round(quote.fee, 4), "breakeven_prob": round(quote.breakeven_prob, 4),
                        "displayed_prob": None if disp is None else round(disp if side == "yes" else 1 - disp, 4),
                        "our_prob": round(p, 4), "our_lo": round(plo, 4), "our_hi": round(phi, 4),
                        "ev": round(quote.ev(p, p_push), 4), "result": res, "pnl": None if pnl is None else round(pnl, 4)})
    return out, cache


def curve_points(prob_fn, ts: List[float]) -> List[Dict]:
    pts = []
    for t in ts:
        py, _ = prob_fn(t)
        pts.append({"t": t, "p": round(float(py[0]), 4), "lo": round(float(np.percentile(py, 5)), 4),
                    "hi": round(float(np.percentile(py, 95)), 4)})
    return pts


# ----------------------------------------------------------------------------- player props

def _player_quote_dicts(sb: pd.DataFrame, kq: pd.DataFrame) -> List[Dict]:
    out = []
    for r in sb.itertuples():
        both = r.over_price and r.under_price and r.over_price > 1 and r.under_price > 1
        disp = (1 / r.over_price) / (1 / r.over_price + 1 / r.under_price) if both else None
        res = None
        if r.actual_status == "void":
            res = "void"
        elif r.actual is not None and not np.isnan(r.actual):
            res = "yes" if r.actual > r.line else ("no" if r.actual < r.line else "push")
        out.append({"source": "sportsbook", "book": r.bookmaker, "threshold": r.line, "quote_ts": r.ts_recorded,
                    "market_id": f"{r.event_id}|{r.bookmaker}|{r.market}|{r.player_name}|{r.line:g}",
                    "yes_price": _f(r.over_price), "no_price": _f(r.under_price), "displayed_yes": disp, "result": res})
    for r in kq.itertuples():
        mid = r.last_price if r.last_price and r.last_price > 0 else (
            (r.yes_bid + r.yes_ask) / 2 if r.yes_bid is not None and r.yes_ask else None)
        res = r.result if r.result in ("yes", "no") else ("fair" if r.result == "" and r.settlement_value is not None
                                                          else ("void" if r.result == "" else None))
        out.append({"source": "kalshi", "book": "kalshi", "threshold": r.strike, "quote_ts": r.ts_recorded,
                    "market_id": r.kalshi_ticker, "yes_bid": _f(r.yes_bid), "yes_ask": _f(r.yes_ask),
                    "displayed_yes": _f(mid), "result": res, "settlement_value": _f(r.settlement_value)})
    return out


def _main_line(sb: pd.DataFrame, kq: pd.DataFrame) -> Optional[float]:
    if len(sb):
        return float(np.median(sb["line"]))
    if len(kq):
        k = kq.assign(d=(kq["yes_ask"].fillna(0.5) - 0.5).abs()).sort_values("d")
        return float(k["strike"].iloc[0])
    return None


def _market_main(sb: pd.DataFrame, kq: pd.DataFrame, t: float) -> Dict:
    at = sb[(sb["line"] == t) & (sb["over_price"] > 1) & (sb["under_price"] > 1)]
    if len(at):
        p = ((1 / at["over_price"]) / (1 / at["over_price"] + 1 / at["under_price"])).mean()
        return {"line": t, "prob": round(float(p), 4), "source": "sportsbook no-vig average", "books": int(len(at))}
    k = kq[kq["strike"] == t]
    if len(k):
        r = k.iloc[-1]
        mid = r["last_price"] if r["last_price"] and r["last_price"] > 0 else (r["yes_bid"] + r["yes_ask"]) / 2
        return {"line": t, "prob": round(float(mid), 4), "source": "kalshi last/mid", "books": 1}
    return {"line": t, "prob": None, "source": None, "books": 0}


def build_player(conn, mode: str, start: datetime, end: datetime, now: Optional[datetime] = None) -> List[Dict]:
    """Estimates for every player-game x family with a quote, games starting in [start, end)."""
    now = now or datetime.now(timezone.utc)
    sb_all = sportsbook_player_quotes(conn, start, end)
    kq_all = kalshi_quotes(conn, start, end, player=True)
    if mode == "live":
        sb_all = sb_all[sb_all["commence_time"] > now]
        kq_all = kq_all[kq_all["commence_time"] > now]
    out: List[Dict] = []
    for sport in PLAYER_SPORTS:
        sb_s, kq_s = sb_all[sb_all["sport_key"] == sport], kq_all[kq_all["sport_key"] == sport]
        if sb_s.empty and kq_s.empty:
            continue
        hist = M.load_player_games(conn, sport)
        inj = outs_at(conn, sport)
        fx = pd.concat([sb_s[["event_id", "commence_time", "home_team", "away_team"]],
                        kq_s[["event_id", "commence_time", "home_team", "away_team"]]]).drop_duplicates("event_id")
        # prediction time per game: the sportsbook pull, else 60 min before tip (backtest) / now (live)
        pull = sb_s.groupby("event_id")["ts_recorded"].max()
        fx["prediction_ts"] = [now if mode == "live" else
                               (pull.get(e) if e in pull.index else c - TEAM_LEAD)
                               for e, c in zip(fx["event_id"], fx["commence_time"])]
        subjects = pd.concat([sb_s[["event_id", "key", "player_name", "market"]],
                              kq_s.rename(columns={"market_type": "market"})[["event_id", "key", "player_name", "market"]]]
                             ).drop_duplicates(["event_id", "key", "market"])
        subjects = subjects[subjects["market"].isin([f.market for f in M.FAMILIES if f.sport == sport])]
        if subjects.empty:
            continue
        team_of = hist.drop_duplicates("key", keep="last").set_index("key")["team"]
        sb_groups = {k: g for k, g in sb_s.groupby(["event_id", "key", "market"])}
        kq_groups = {k: g for k, g in kq_s.groupby(["event_id", "key", "market_type"])}
        empty_sb, empty_kq = sb_s.iloc[0:0], kq_s.iloc[0:0]
        fx = fx.set_index("event_id")
        # one synthetic row per (player, game) to be predicted; backtest also uses a synthetic row so a
        # game's own box score never feeds its prediction
        rows = []
        for (eid, key), g in subjects.groupby(["event_id", "key"]):
            team = team_of.get(key)
            if team is None or eid not in fx.index:
                continue
            f = fx.loc[eid]
            if team not in (f["home_team"], f["away_team"]):
                continue                                  # player changed teams or name collision
            rows.append({"espn_event_id": f"pred:{eid}", "event_id": eid, "game_time": f["commence_time"],
                         "team": team, "opponent": f["away_team"] if team == f["home_team"] else f["home_team"],
                         "is_home": team == f["home_team"], "player_id": f"pred:{key}",
                         "player_name": g["player_name"].iloc[0], "key": key, "played": True, "synthetic": True,
                         "prediction_ts": f["prediction_ts"]})
        if not rows:
            continue
        pred = pd.DataFrame(rows)
        pred["season"] = M.season_of(pred["game_time"])
        if sport == "basketball_nba":
            om = [out_minutes(inj, hist, r.team, r.prediction_ts) for r in pred.itertuples()]
            pred["out_min_override"] = [m for m, _ in om]
            pred["outs"] = [n for _, n in om]
        else:
            pred["out_min_override"], pred["outs"] = 0.0, [[] for _ in range(len(pred))]
        # will he play? injury report at prediction time, else whether he played the team's last game
        pred["inj_status"] = [status_at(inj, r.key, r.prediction_ts) for r in pred.itertuples()]
        pred = pred[~pred["inj_status"].isin(OUT_STATUSES + ("Injured Reserve",))]
        if pred.empty:
            continue
        pred["date"] = pred["game_time"].dt.tz_convert("America/New_York").dt.date
        actual_idx = {(e, k): r for e, k, r in zip(hist["event_id"], hist["key"], hist.to_dict("records"))
                      if hist is not None}
        for day, day_rows in pred.groupby("date"):
            cutoff = pd.Timestamp(day, tz="America/New_York").tz_convert("UTC")
            past = hist[hist["game_time"] < cutoff].copy()
            frame = pd.concat([past.assign(synthetic=False), day_rows.drop(columns=["date"])], ignore_index=True)
            fitted, feats = {}, {}
            for fam in [f for f in M.FAMILIES if f.sport == sport]:
                d = M.player_features(frame, fam)
                ff = M.fit_family(d[~d["synthetic"].astype(bool)], fam)
                if ff is not None:
                    fitted[fam.market], feats[fam.market] = ff, d
            rho = _residual_corr(fitted, feats)
            rates = M.appearance_rates(past.assign(synthetic=False))
            team_last = past[past["played"]].sort_values("game_time").groupby("team")["espn_event_id"].last()
            player_last = past[past["played"]].sort_values("game_time").groupby("key")["espn_event_id"].last()
            for fam_market, ff in fitted.items():
                d = feats[fam_market]
                P = d[d["synthetic"].astype(bool)]
                P = P[P["key"].isin(subjects[subjects["market"] == fam_market]["key"])]
                P = P[M.eligible(P, ff.fam)]
                if P.empty:
                    continue
                mus = ff.predict(P)
                contrib = ff.contributions(P)
                real = d[~d["synthetic"].astype(bool)]
                real_by_key = {k: g for k, g in real[real["key"].isin(P["key"])].groupby("key")}
                empty_real = real.iloc[0:0]
                for i, r in enumerate(P.itertuples()):
                    eid, key = r.event_id, r.key
                    sb = sb_groups.get((eid, key, fam_market), empty_sb)
                    if len(sb):                   # the one pull at (or just before) the prediction time
                        sb = sb[sb["ts_recorded"] <= r.prediction_ts]
                        sb = sb[sb["ts_recorded"] == sb["ts_recorded"].max()]
                    kq = kq_groups.get((eid, key, fam_market), empty_kq)
                    if len(kq):
                        kq = _latest(kq, ["kalshi_ticker"], "ts_recorded",
                                     pd.Series(r.prediction_ts, index=kq.index), KALSHI_LOOKBACK)
                    if sb.empty and kq.empty:
                        continue
                    mu = mus[:, i]
                    prob_fn = (lambda t, mu=mu, ff=ff: (ff.sf(t, mu), ff.pmf_at(t, mu)))
                    quotes = _player_quote_dicts(sb, kq)
                    played_last = player_last.get(key) == team_last.get(r.team)
                    p_play = rates["after_played" if played_last else "after_missed"]
                    status = day_rows.set_index("key")["inj_status"].get(key)
                    status = status if isinstance(status, str) else None
                    if status == "Questionable":
                        p_play *= M.QUESTIONABLE_PLAY
                    lines, _ = price_lines(prob_fn, [q["threshold"] for q in quotes], quotes, p_play=p_play)
                    main = _main_line(sb, kq)
                    past_games = real_by_key.get(key, empty_real)
                    today = {"home": float(r.home), "rest": _f(r.rest), "opponent": r.opponent,
                             "u_short": _f(r.u_short), "starter_prev": _f(getattr(r, "starter_prev", None)),
                             "out_min": _f(r.out_min)}
                    act = actual_idx.get((eid, key))
                    out.append({
                        "sport_key": sport, "event_id": eid, "commence_time": r.game_time,
                        "home_team": fx.loc[eid, "home_team"], "away_team": fx.loc[eid, "away_team"],
                        "subject_type": "player", "subject": r.player_name, "team": r.team, "opponent": r.opponent,
                        "is_home": bool(r.is_home), "stat": fam_market, "mode": mode,
                        "prediction_ts": r.prediction_ts, "mean": float(mu[0]), "dist": ff.fam.dist,
                        "dist_params": {**ff.params(), "n_train": ff.n_train, "refits": len(mu) - 1,
                                        "p_play": round(float(p_play), 3), "injury_status": status,
                                        "played_team_last_game": bool(played_last),
                                        "mean_range": [round(float(np.percentile(mu, 5)), 2),
                                                       round(float(np.percentile(mu, 95)), 2)]},
                        "curve": curve_points(prob_fn, M.grid(ff.fam.grid_step, float(mu[0]),
                                                              [q["threshold"] for q in quotes])),
                        "hit_rate": hit_rates(past_games, main, today, sport) if main is not None else None,
                        "factors": {"items": [{"feature": f, "label": M.FEATURE_LABELS.get(f, f),
                                               "value": None if v is None else round(v, 2), "effect": round(e, 2)}
                                              for f, v, e in contrib[i]],
                                    "teammates_out": list(r.outs) if hasattr(r, "outs") and r.outs else [],
                                    "unit": ff.fam.label},
                        "market_main": _market_main(sb, kq, main) if main is not None else None,
                        "actual": _f(act[ff.fam.stat]) if act is not None else None,
                        "lines": lines, "_combo": (key, eid, main, rho, prob_fn),
                    })
        _attach_combos(out)
    return out


def _residual_corr(fitted: Dict[str, M.FittedFamily], feats: Dict[str, pd.DataFrame]) -> Dict[Tuple[str, str], float]:
    """Correlation of the model's misses for two families of the SAME player-game (Gaussian copula),
    from training games only."""
    rng = np.random.default_rng(3)
    z = {}
    for m, ff in fitted.items():
        d = feats[m]
        d = d[~d["synthetic"].astype(bool) & M.eligible(d, ff.fam) & d["y"].notna()]
        mu = ff.predict(d)[0]
        z[m] = pd.Series(M.pit_normal(ff, d["y"].to_numpy(float), mu, rng),
                         index=pd.MultiIndex.from_arrays([d["espn_event_id"], d["key"]]))
    out = {}
    ms = sorted(z)
    for i, a in enumerate(ms):
        for b in ms[i + 1:]:
            j = pd.concat([z[a], z[b]], axis=1, join="inner").dropna()
            if len(j) > 200:
                out[(a, b)] = out[(b, a)] = float(np.corrcoef(j.iloc[:, 0], j.iloc[:, 1])[0, 1])
    return out


def _attach_combos(estimates: List[Dict]) -> None:
    by_player: Dict[Tuple, List[Dict]] = {}
    for e in estimates:
        if "_combo" in e:
            key, eid, main, rho, fn = e["_combo"]
            by_player.setdefault((eid, key), []).append(e)
    for group in by_player.values():
        for e in group:
            combos = []
            _, _, main_a, rho, fn_a = e["_combo"]
            for o in group:
                if o is e or main_a is None or o["_combo"][2] is None:
                    continue
                r = rho.get((e["stat"], o["stat"]))
                if r is None:
                    continue
                pa = float(fn_a(main_a)[0][0])
                pb = float(o["_combo"][4](o["_combo"][2])[0][0])
                combos.append({"with": o["stat"], "line": main_a, "with_line": o["_combo"][2], "rho": round(r, 3),
                               "p_this": round(pa, 4), "p_with": round(pb, 4),
                               "p_joint": round(M.joint_over(pa, pb, r), 4), "p_if_independent": round(pa * pb, 4),
                               "price": None, "note": "no combo price collected"})
            e["combos"] = combos
    for e in estimates:
        e.pop("_combo", None)


# ----------------------------------------------------------------------------- team markets

def sportsbook_game_quotes(conn, start: datetime, end: datetime) -> pd.DataFrame:
    q = pd.read_sql("""
        SELECT o.sport_key, o.event_id, o.commence_time, o.home_team, o.away_team, o.bookmaker, o.ts_recorded,
               o.home_odds::float AS home_odds, o.away_odds::float AS away_odds, o.home_spread::float AS home_spread,
               o.home_spread_odds::float AS home_spread_odds, o.away_spread_odds::float AS away_spread_odds,
               o.total_line::float AS total_line, o.over_odds::float AS over_odds, o.under_odds::float AS under_odds
          FROM multisport_odds_snapshots o
         WHERE NOT o.is_consensus AND o.commence_time >= %s AND o.commence_time < %s AND o.sport_key = ANY(%s)
           AND o.ts_recorded < o.commence_time AND o.ts_recorded >= o.commence_time - interval '8 hours'""",
                    conn, params=(start, end, list(TEAM_SPORTS)))
    for c in ("commence_time", "ts_recorded"):
        q[c] = pd.to_datetime(q[c], utc=True)
    return q


def _game_quote_dicts(g: pd.DataFrame, kq: pd.DataFrame, team: str, home: str, stat: str,
                      score: Optional[Tuple[float, float]]) -> List[Dict]:
    """Quotes for one team-level estimate. Sportsbook game markets are stated for the home team, so they
    attach to the home team's estimates (No = the away side)."""
    out = []
    is_home = team == home
    margin = None if score is None else (score[0] - score[1]) * (1 if is_home else -1)
    pts = None if score is None else (score[0] if is_home else score[1])
    total = None if score is None else score[0] + score[1]
    def res(actual, t):
        if actual is None:
            return None
        return "yes" if actual > t else ("no" if actual < t else "push")
    if is_home or stat == "game_total":
        ok = lambda *xs: all(_f(x) is not None for x in xs)   # noqa: E731  (pandas blanks are NaN)
        for r in g.itertuples():
            if stat == "team_win" and ok(r.home_odds, r.away_odds):
                yp, np_, t, a = r.home_odds, r.away_odds, 0.0, (None if margin is None else np.sign(margin))
            elif stat == "team_margin" and ok(r.home_spread, r.home_spread_odds, r.away_spread_odds):
                yp, np_, t, a = r.home_spread_odds, r.away_spread_odds, -r.home_spread, margin
            elif stat == "game_total" and ok(r.total_line, r.over_odds, r.under_odds):
                yp, np_, t, a = r.over_odds, r.under_odds, r.total_line, total
            else:
                continue
            both = yp and np_ and yp > 1 and np_ > 1
            out.append({"source": "sportsbook", "book": r.bookmaker, "threshold": t, "quote_ts": r.ts_recorded,
                        "market_id": f"{r.event_id}|{r.bookmaker}|{stat}|{t:g}", "yes_price": yp, "no_price": np_,
                        "displayed_yes": (1 / yp) / (1 / yp + 1 / np_) if both else None, "result": res(a, t)})
    kt = {"team_win": "game", "team_margin": "spread", "team_points": "team_total", "game_total": "total"}[stat]
    k = kq[kq["market_type"] == kt]
    if stat != "game_total":
        k = k[k["team"] == team]
    for r in k.itertuples():
        t = 0.0 if stat == "team_win" else _f(r.strike)
        if t is None:
            continue
        mid = r.last_price if r.last_price and r.last_price > 0 else (
            (r.yes_bid + r.yes_ask) / 2 if r.yes_bid is not None and r.yes_ask else None)
        kr = r.result if r.result in ("yes", "no") else None
        if kr is None:          # Kalshi settlement not stored yet: derive from the final score
            a = {"team_win": None if margin is None else np.sign(margin), "team_margin": margin,
                 "team_points": pts, "game_total": total}[stat]
            kr = res(a, t)
            kr = None if kr == "push" else kr
        out.append({"source": "kalshi", "book": "kalshi", "threshold": t, "quote_ts": r.ts_recorded,
                    "market_id": r.kalshi_ticker, "yes_bid": _f(r.yes_bid), "yes_ask": _f(r.yes_ask),
                    "displayed_yes": _f(mid), "result": kr, "settlement_value": _f(r.settlement_value)})
    return out


def build_team(conn, mode: str, start: datetime, end: datetime, now: Optional[datetime] = None) -> List[Dict]:
    now = now or datetime.now(timezone.utc)
    sbq = sportsbook_game_quotes(conn, start, end)
    kq_all = kalshi_quotes(conn, start, end, player=False)
    out: List[Dict] = []
    for sport in TEAM_SPORTS:
        sb_s, kq_s = sbq[sbq["sport_key"] == sport], kq_all[kq_all["sport_key"] == sport]
        games = pd.concat([sb_s[["event_id", "commence_time", "home_team", "away_team"]],
                           kq_s[["event_id", "commence_time", "home_team", "away_team"]]]).drop_duplicates("event_id")
        if mode == "live":
            games = games[games["commence_time"] > now]
        if games.empty:
            continue
        hist = M.load_team_games(conn, sport)
        scores = hist[hist["home"] == 1].set_index("event_id")[["pf", "pa"]]
        games["prediction_ts"] = now if mode == "live" else games["commence_time"] - TEAM_LEAD
        games["date"] = games["commence_time"].dt.tz_convert("America/New_York").dt.date
        for day, day_games in games.groupby("date"):
            cutoff = pd.Timestamp(day, tz="America/New_York").tz_convert("UTC")
            past = hist[hist["game_time"] < cutoff]
            up = []
            for r in day_games.itertuples():
                for team, opp, h in ((r.home_team, r.away_team, 1.0), (r.away_team, r.home_team, 0.0)):
                    up.append({"event_id": r.event_id, "game_time": r.commence_time, "team": team, "opponent": opp,
                               "home": h, "pf": np.nan, "pa": np.nan, "synthetic": True})
            upd = pd.DataFrame(up)
            upd["season"] = M.season_of(upd["game_time"])
            feats = M.team_features(past.assign(synthetic=False), upd)
            ft = M.fit_team(feats[~feats["synthetic"].astype(bool)], sport)
            if ft is None:
                continue
            P = feats[feats["synthetic"].astype(bool)].reset_index(drop=True)
            past_t = feats[~feats["synthetic"].astype(bool)]
            mus = ft.predict(P)
            contrib = ft.contributions(P)
            idx = {(e, t): i for i, (e, t) in enumerate(zip(P["event_id"], P["team"]))}
            for r in day_games.itertuples():
                ih, ia = idx.get((r.event_id, r.home_team)), idx.get((r.event_id, r.away_team))
                if ih is None or ia is None:
                    continue
                mh, ma = mus[:, ih], mus[:, ia]
                sb = _latest(sb_s[sb_s["event_id"] == r.event_id], ["bookmaker"], "ts_recorded",
                             pd.Series(r.prediction_ts, index=sb_s[sb_s["event_id"] == r.event_id].index),
                             timedelta(hours=8))
                kq = kq_s[kq_s["event_id"] == r.event_id]
                if len(kq):
                    kq = _latest(kq, ["kalshi_ticker"], "ts_recorded", pd.Series(r.prediction_ts, index=kq.index),
                                 KALSHI_LOOKBACK)
                score = tuple(scores.loc[r.event_id]) if r.event_id in scores.index else None
                for team, i_self, m_self, m_opp in ((r.home_team, ih, mh, ma), (r.away_team, ia, ma, mh)):
                    margin, pts = m_self - m_opp, m_self
                    specs = [("team_win", margin, lambda t, m=margin: (M.win_prob(m, ft.sd_margin), np.zeros_like(m)),
                              ft.sd_margin, "margin"),
                             ("team_margin", margin, lambda t, m=margin: (M.normal_sf(t, m, ft.sd_margin),
                                                                          M.normal_pmf(t, m, ft.sd_margin)),
                              ft.sd_margin, "margin"),
                             ("team_points", pts, lambda t, m=pts: (M.normal_sf(t, m, ft.sd_points),
                                                                    M.normal_pmf(t, m, ft.sd_points)),
                              ft.sd_points, "pf")]
                    if team == r.home_team:
                        tot = mh + ma
                        specs.append(("game_total", tot, lambda t, m=tot: (M.normal_sf(t, m, ft.sd_total),
                                                                            M.normal_pmf(t, m, ft.sd_total)),
                                      ft.sd_total, "total"))
                    tp = past_t[past_t["team"] == team].copy()
                    tp["margin"] = tp["pf"] - tp["pa"]
                    for stat, mu, fn, sd, ycol in specs:
                        quotes = _game_quote_dicts(sb, kq, team, r.home_team, stat, score)
                        if not quotes:
                            continue
                        quotes = [q for q in quotes if _f(q["threshold"]) is not None]
                        if not quotes or not np.isfinite(mu).all():
                            continue
                        lines, _ = price_lines(fn, [q["threshold"] for q in quotes], quotes)
                        ths = [q["threshold"] for q in quotes]
                        main = float(np.median(ths))
                        if stat == "game_total":
                            hp = past_t[past_t["home"] == 1].assign(y=lambda x: x["pf"] + x["pa"])
                            hp = hp[(hp["team"] == team) | (hp["opponent"] == team)]
                        else:
                            hp = tp.assign(y=tp["margin"] if ycol == "margin" else tp["pf"])
                        today = {"home": 1.0 if team == r.home_team else 0.0, "rest": _f(P.loc[i_self, "rest"]),
                                 "opponent": r.away_team if team == r.home_team else r.home_team}
                        lo_t = float(np.floor(min(ths + [float(mu[0]) - 2.5 * sd])))
                        hi_t = float(np.ceil(max(ths + [float(mu[0]) + 2.5 * sd])))
                        step = max(1.0, round((hi_t - lo_t) / 40))
                        actual = None
                        if score is not None:
                            m_act = (score[0] - score[1]) * (1 if team == r.home_team else -1)
                            actual = {"team_win": float(np.sign(m_act)), "team_margin": float(m_act),
                                      "team_points": float(score[0] if team == r.home_team else score[1]),
                                      "game_total": float(score[0] + score[1])}[stat]
                        out.append({
                            "sport_key": sport, "event_id": r.event_id, "commence_time": r.commence_time,
                            "home_team": r.home_team, "away_team": r.away_team,
                            "subject_type": "game" if stat == "game_total" else "team",
                            "subject": "game" if stat == "game_total" else team, "team": team,
                            "opponent": today["opponent"], "is_home": team == r.home_team, "stat": stat,
                            "mode": mode, "prediction_ts": r.prediction_ts, "mean": float(mu[0]), "dist": "normal",
                            "dist_params": {"sd": round(float(sd), 2), "n_train": ft.n_train, "refits": len(mu) - 1,
                                            "mean_range": [round(float(np.percentile(mu, 5)), 2),
                                                           round(float(np.percentile(mu, 95)), 2)]},
                            "curve": [] if stat == "team_win" else
                            curve_points(fn, [round(x + 0.5, 1) for x in np.arange(lo_t, hi_t, step)]),
                            "hit_rate": hit_rates(hp, main if stat != "team_win" else 0.0, today, sport)
                            if len(hp) else None,
                            "factors": {"items": [{"feature": f, "label": M.TEAM_LABELS.get(f, f),
                                                   "value": None if v is None else round(v, 2), "effect": round(e, 2)}
                                                  for f, v, e in contrib[i_self]],
                                        "unit": "points for this team", "teammates_out": []},
                            "market_main": None, "actual": actual, "lines": lines, "combos": []})
    return out


# ----------------------------------------------------------------------------- storage

def store(conn, estimates: List[Dict], mode: str) -> Dict[str, int]:
    """Replace the estimates (and their lines) for these games and mode. Live estimates keep a short
    history of earlier runs so price/estimate changes can be tracked."""
    if not estimates:
        return {"estimates": 0, "lines": 0}
    events = sorted({e["event_id"] for e in estimates})
    with conn.cursor() as cur:
        hist: Dict[Tuple, list] = {}
        if mode == "live":
            cur.execute("""SELECT event_id, subject, stat, history FROM multisport_prop_estimates
                            WHERE mode = 'live' AND event_id = ANY(%s)""", (events,))
            hist = {(e, s, st): h or [] for e, s, st, h in cur.fetchall()}
        keys = {(e["event_id"], e["subject"], e["stat"]) for e in estimates}
        # player and team estimates for one game are stored by separate builds: replace only this kind
        player = [e["subject_type"] == "player" for e in estimates]
        if any(player) and not all(player):
            raise ValueError("store player and team estimates in separate calls")
        cur.execute("""DELETE FROM multisport_prop_estimates WHERE mode = %s AND event_id = ANY(%s)
                          AND (subject_type = 'player') = %s""", (mode, events, all(player)))
        rows = []
        for e in estimates:
            h = hist.get((e["event_id"], e["subject"], e["stat"]), [])
            if mode == "live":
                mm = e.get("market_main") or {}
                h = (h + [{"ts": pd.Timestamp(e["prediction_ts"]).isoformat(), "mean": round(e["mean"], 3),
                           "market_main": mm.get("prob"), "line": mm.get("line")}])[-48:]
            rows.append((e["sport_key"], e["event_id"], e["commence_time"], e["home_team"], e["away_team"],
                         e["subject_type"], e["subject"], e["team"], e["opponent"], e["is_home"], e["stat"], mode,
                         MODEL_VERSION, e["prediction_ts"], round(e["mean"], 3), e["dist"],
                         _j(e["dist_params"]), _j(e["curve"]), _j(e["hit_rate"]),
                         _j(e["factors"]), _j(e.get("combos") or []), _j(h),
                         e.get("actual")))
        seen, uniq = set(), []
        for row, e in zip(rows, estimates):
            k = (e["event_id"], e["subject"], e["stat"])
            if k in seen:
                continue
            seen.add(k)
            uniq.append((row, e))
        ids = execute_values(cur, """
            INSERT INTO multisport_prop_estimates (sport_key, event_id, commence_time, home_team, away_team,
                subject_type, subject, team, opponent, is_home, stat, mode, model_version, prediction_ts, mean, dist,
                dist_params, curve, hit_rate, factors, combos, history, actual)
            VALUES %s RETURNING id""", [r for r, _ in uniq], page_size=500, fetch=True)
        line_rows = []
        for (rid,), (_, e) in zip(ids, uniq):
            seen_l = set()
            for ln in e["lines"]:
                k = (ln["book"], ln["market_id"], ln["side"])
                if k in seen_l:
                    continue
                seen_l.add(k)
                line_rows.append((rid, ln["source"], ln["book"], ln["market_id"], ln["threshold"], ln["side"],
                                  ln["quote_ts"], ln["price"], ln["price_format"], ln["fee"], ln["breakeven_prob"],
                                  ln["displayed_prob"], ln["our_prob"], ln["our_lo"], ln["our_hi"], ln["ev"],
                                  ln["result"], ln["pnl"]))
        if line_rows:
            execute_values(cur, """
                INSERT INTO multisport_prop_lines (estimate_id, source, book, market_id, threshold, side, quote_ts,
                    price, price_format, fee, breakeven_prob, displayed_prob, our_prob, our_lo, our_hi, ev, result, pnl)
                VALUES %s""", line_rows, page_size=1000)
    conn.commit()
    return {"estimates": len(uniq), "lines": len(line_rows), "games": len(events), "subjects": len(keys)}
