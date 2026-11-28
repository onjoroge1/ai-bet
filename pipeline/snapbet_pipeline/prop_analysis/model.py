"""Explainable baseline models for props (research, paper only).

Player props: one ridge regression per prop family predicts a player's expected stat from what was
known before the game (recent and season averages, recent minutes or usage, home/away, rest,
opponent's allowance of that stat, and for the NBA the minutes of rotation teammates who are out).
The expected value becomes a full distribution, so every offered threshold (15+, 20+, 25+ points)
is priced from the SAME player-game estimate:
  counts (NBA points/rebounds/assists/threes, NFL receptions): negative binomial, dispersion fit
      on training residuals; anytime TD: Poisson on scoring touchdowns;
  yards (NFL passing/rushing/receiving): the projection plus the scaled misses the model made
      on past games (empirical).
Team markets: a ridge regression per sport predicts each team's points from both teams' recent
scoring and allowing, home and rest; margin, total and team points are normal around those means
(with a continuity correction for whole-number scores).
Uncertainty: the model is refit on BOOTSTRAP resamples of the history; the range is the 5th-95th
percentile of the probability across refits.

Training data for a prediction made on date D only uses games played before D. Teammate absences
are the real ones in past games; at prediction time they come from injury reports seen before the
prediction timestamp.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence, Tuple

import numpy as np
import pandas as pd
from scipy import stats
from sklearn.linear_model import Ridge

BOOTSTRAP = 20
RNG_SEED = 11


def name_key(n: Optional[str]) -> str:
    plain = unicodedata.normalize("NFKD", n or "").encode("ascii", "ignore").decode().lower()
    return "".join(t for t in re.split(r"[^a-z]+", plain) if t and t not in ("jr", "sr", "ii", "iii", "iv"))


def season_of(ts: pd.Series) -> pd.Series:
    """NBA/NFL/NHL seasons start in the autumn: Aug-Dec belongs to that year's season."""
    return np.where(ts.dt.month >= 8, ts.dt.year, ts.dt.year - 1)


@dataclass(frozen=True)
class Family:
    sport: str
    market: str            # Odds API / Kalshi market name
    stat: str              # box-score column
    usage: str             # minutes (NBA) or an NFL volume column
    dist: str              # negbin | poisson | empirical
    label: str
    short: int = 5         # short window (games)
    long: int = 10
    min_usage: float = 0   # eligible when the long-window usage is at least this
    grid_step: float = 1.0


FAMILIES: List[Family] = [
    Family("basketball_nba", "player_points", "points", "minutes", "negbin", "points", min_usage=8),
    Family("basketball_nba", "player_rebounds", "rebounds", "minutes", "negbin", "rebounds", min_usage=8),
    Family("basketball_nba", "player_assists", "assists", "minutes", "negbin", "assists", min_usage=8),
    Family("basketball_nba", "player_threes", "threes_made", "minutes", "negbin", "threes made", min_usage=8),
    Family("americanfootball_nfl", "player_pass_yds", "pass_yds", "pass_att", "empirical", "passing yards",
           3, 6, min_usage=10, grid_step=5),
    Family("americanfootball_nfl", "player_rush_yds", "rush_yds", "rush_att", "empirical", "rushing yards",
           3, 6, min_usage=1.5, grid_step=5),
    Family("americanfootball_nfl", "player_reception_yds", "rec_yds", "targets", "empirical", "receiving yards",
           3, 6, min_usage=1.5, grid_step=5),
    Family("americanfootball_nfl", "player_receptions", "receptions", "targets", "negbin", "receptions",
           3, 6, min_usage=1.5),
    Family("americanfootball_nfl", "player_anytime_td", "scoring_td", "touches", "poisson", "touchdowns",
           3, 6, min_usage=1.5),
]
FAMILY = {(f.sport, f.market): f for f in FAMILIES}

FEATURE_LABELS = {
    "s_short": "recent average (short window)", "s_long": "recent average (long window)",
    "s_season": "season average", "s_prev": "last season's average", "proj_rate": "per-minute rate x recent minutes",
    "u_short": "recent minutes / volume", "u_long": "longer-run minutes / volume", "starter_prev": "started last game",
    "home": "home game", "rest": "days of rest", "opp_factor": "opponent allows this stat",
    "out_min": "rotation teammates out (minutes)", "n_prior": "games of history",
}


# ----------------------------------------------------------------------------- player data

def load_player_games(conn, sport: str) -> pd.DataFrame:
    """One row per player-game that the player actually played, plus team absences (NBA)."""
    if sport == "basketball_nba":
        df = pd.read_sql("""SELECT espn_event_id, event_id, game_time, team, opponent, is_home, player_id,
                                   player_name, starter, did_not_play, minutes, points, rebounds, assists, threes_made
                              FROM multisport_player_boxscores WHERE sport_key = 'basketball_nba'""", conn)
        df["played"] = (~df["did_not_play"].astype(bool)) & (df["minutes"].fillna(0) > 0)
    else:
        df = pd.read_sql("""SELECT espn_event_id, event_id, game_time, team, opponent, is_home, player_id,
                                   player_name, pass_att, pass_yds, rush_att, rush_yds, receptions, targets, rec_yds,
                                   scoring_td
                              FROM multisport_nfl_player_stats""", conn)
        df["played"] = True
        df["touches"] = df["rush_att"].fillna(0) + df["targets"].fillna(0)
        df["starter"] = np.nan
        df["minutes"] = np.nan
    df["game_time"] = pd.to_datetime(df["game_time"], utc=True)
    df["key"] = df["player_name"].map(name_key)
    df["season"] = season_of(df["game_time"])
    return df.sort_values(["game_time", "espn_event_id"]).reset_index(drop=True)


def _team_absences(df: pd.DataFrame) -> pd.Series:
    """NBA: minutes (recent average) of rotation players who played one of the team's previous 3 games
    with 15+ average minutes but did not play this game. Real absences, so only used for PAST games."""
    out = pd.Series(0.0, index=df.index)
    played = df[df["played"] & ~df.get("synthetic", pd.Series(False, index=df.index)).astype(bool)]
    for team, g in played.groupby("team"):
        games = g.groupby("espn_event_id")["game_time"].first().sort_values()
        order = list(games.index)
        mins = {e: dict(zip(x["key"], x["minutes"])) for e, x in g.groupby("espn_event_id")}
        hist: Dict[str, List[float]] = {}
        for i, e in enumerate(order):
            recent = set()
            for prev in order[max(0, i - 3):i]:
                recent |= set(mins[prev])
            missing = 0.0
            for k in recent - set(mins[e]):
                h = hist.get(k, [])[-10:]
                if h and np.mean(h) >= 15:
                    missing += float(np.mean(h))
            idx = g.index[g["espn_event_id"] == e]
            out.loc[idx] = missing
            for k, m in mins[e].items():
                hist.setdefault(k, []).append(float(m or 0))
    return out


def _opp_factors(df: pd.DataFrame, stat: str) -> pd.Series:
    """How much of `stat` the opponent allowed per game over its previous 10 games, relative to the
    season's average team total (1.0 = average)."""
    synth = df.get("synthetic", pd.Series(False, index=df.index)).astype(bool)
    p = df[df["played"] & ~synth]
    tot = p.groupby(["espn_event_id", "team", "opponent", "season"], as_index=False).agg(
        total=(stat, "sum"), game_time=("game_time", "first"))
    tot = tot.sort_values("game_time")
    # allowed by the DEFENDING team = the opponent row's total
    tot["defense"] = tot["opponent"]
    tot["allowed_prev"] = tot.groupby("defense")["total"].transform(lambda x: x.shift(1).rolling(10, 1).mean())
    league = tot.groupby("season")["total"].transform("mean")
    tot["factor"] = (tot["allowed_prev"] / league).fillna(1.0)
    m = tot.set_index(["espn_event_id", "defense"])["factor"]
    out = pd.Series([m.get((e, o), 1.0) for e, o in zip(df["espn_event_id"], df["opponent"])], index=df.index)
    if synth.any():                       # upcoming games: the defense's last 10 games before tip-off
        season_avg = tot.groupby("season")["total"].mean()
        for i in df.index[synth]:
            prev = tot[(tot["defense"] == df.at[i, "opponent"]) & (tot["game_time"] < df.at[i, "game_time"])]
            if len(prev):
                out.at[i] = float(prev["total"].tail(10).mean() / season_avg.get(prev["season"].iloc[-1], np.nan))
    return out.fillna(1.0)


def player_features(df: pd.DataFrame, fam: Family) -> pd.DataFrame:
    """Features for every played player-game from that player's EARLIER games only."""
    d = df[df["played"]].copy()
    if fam.sport == "basketball_nba":
        d["out_min"] = _team_absences(df).loc[d.index]
        if "out_min_override" in d:       # prediction time: teammates listed out before the prediction
            d["out_min"] = d["out_min_override"].where(d["out_min_override"].notna(), d["out_min"])
    d["opp_factor"] = _opp_factors(df, fam.stat).loc[d.index]
    d = d.sort_values("game_time")
    g = d.groupby("key")
    y = d[fam.stat].astype(float)
    u = d[fam.usage].astype(float) if fam.usage in d else pd.Series(np.nan, index=d.index)
    d["y"] = y
    d["s_short"] = g[fam.stat].transform(lambda x: x.astype(float).shift(1).rolling(fam.short, 1).mean())
    d["s_long"] = g[fam.stat].transform(lambda x: x.astype(float).shift(1).rolling(fam.long, 1).mean())
    d["u_short"] = g[fam.usage].transform(lambda x: x.astype(float).shift(1).rolling(3, 1).mean())
    d["u_long"] = g[fam.usage].transform(lambda x: x.astype(float).shift(1).rolling(fam.long, 1).mean())
    sum_s = g[fam.stat].transform(lambda x: x.astype(float).shift(1).rolling(fam.long, 1).sum())
    sum_u = g[fam.usage].transform(lambda x: x.astype(float).shift(1).rolling(fam.long, 1).sum())
    d["proj_rate"] = (sum_s / sum_u.replace(0, np.nan) * d["u_short"]).fillna(d["s_long"])
    gs = d.groupby(["key", "season"])[fam.stat]
    d["s_season"] = gs.transform(lambda x: x.astype(float).shift(1).expanding().mean())
    prev = d.groupby(["key", "season"])[fam.stat].mean().rename("s_prev").reset_index()
    prev["season"] += 1
    d = d.merge(prev, on=["key", "season"], how="left").set_index(d.index)
    d["s_season"] = d["s_season"].fillna(d["s_prev"]).fillna(d["s_long"])
    d["s_prev"] = d["s_prev"].fillna(d["s_season"])
    d["n_prior"] = np.log1p(g.cumcount())
    d["last_time"] = g["game_time"].shift(1)
    d["rest"] = ((d["game_time"] - d["last_time"]).dt.total_seconds() / 86400).clip(0, 10 if fam.sport ==
                                                                                       "americanfootball_nfl" else 5)
    d["home"] = d["is_home"].astype(float)
    d["starter_prev"] = g["starter"].shift(1).astype(float) if fam.sport == "basketball_nba" else 0.0
    if fam.sport != "basketball_nba":
        d["out_min"] = 0.0
    d["out_min"] = d["out_min"].fillna(0.0) / 10.0
    return d


def feature_names(fam: Family) -> List[str]:
    base = ["s_short", "s_long", "s_season", "s_prev", "proj_rate", "u_short", "u_long", "home", "rest",
            "opp_factor", "n_prior"]
    if fam.sport == "basketball_nba":
        base += ["starter_prev", "out_min"]
    return base


def eligible(d: pd.DataFrame, fam: Family) -> pd.Series:
    return d["s_long"].notna() & (d["u_long"].fillna(0) >= fam.min_usage) & (np.expm1(d["n_prior"]) >= 3)


def appearance_rates(df: pd.DataFrame) -> Dict[str, float]:
    """How often a player on a team's recent roster plays its next game, split by whether he played the team's
    previous game. Kalshi settles a player prop No when the player is inactive (books void it instead), so Kalshi
    prices carry this risk and our Yes probability must too."""
    played = df[df["played"] & ~df.get("synthetic", pd.Series(False, index=df.index)).astype(bool)]
    counts = {"after_played": [0, 0], "after_missed": [0, 0]}
    for team, g in played.groupby("team"):
        order = list(g.groupby("espn_event_id")["game_time"].first().sort_values().index)
        sets = [set(g[g["espn_event_id"] == e]["key"]) for e in order]
        for i in range(5, len(order)):
            roster = set().union(*sets[i - 5:i])
            for k in roster:
                bucket = "after_played" if k in sets[i - 1] else "after_missed"
                counts[bucket][0] += k in sets[i]
                counts[bucket][1] += 1
    return {b: (v[0] / v[1] if v[1] else 0.5) for b, v in counts.items()}


QUESTIONABLE_PLAY = 0.75   # assumed chance a player listed Questionable plays (not estimated: too few labels yet)


# ----------------------------------------------------------------------------- fitted model

@dataclass
class FittedFamily:
    fam: Family
    features: List[str]
    mean_: np.ndarray
    scale_: np.ndarray
    models: List[Ridge]                     # [0] = full fit, [1:] = bootstrap refits
    r: Optional[float] = None               # negative-binomial dispersion
    z: Optional[np.ndarray] = None          # empirical scaled residuals
    n_train: int = 0
    resid_corr: Dict = field(default_factory=dict)

    def _x(self, X: pd.DataFrame) -> np.ndarray:
        x = X[self.features].astype(float).to_numpy()
        x = np.where(np.isnan(x), self.mean_, x)
        return (x - self.mean_) / self.scale_

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        """[n_models, n_rows] expected stat (clipped to a small positive number)."""
        x = self._x(X)
        return np.clip(np.vstack([m.predict(x) for m in self.models]), 0.05, None)

    def contributions(self, X: pd.DataFrame) -> List[List[Tuple[str, float, float]]]:
        """Per row: (feature, its value, its push on the estimate in stat units vs an average row)."""
        x = self._x(X)
        coef = self.models[0].coef_
        raw = X[self.features].astype(float).to_numpy()
        out = []
        for i in range(len(X)):
            c = x[i] * coef
            order = np.argsort(-np.abs(c))[:4]
            out.append([(self.features[j], float(raw[i, j]) if not np.isnan(raw[i, j]) else None, float(c[j]))
                        for j in order])
        return out

    def sf(self, t: float, mu: np.ndarray) -> np.ndarray:
        """P(stat > t) for means mu."""
        k = np.floor(t)
        if self.fam.dist == "negbin" and self.r:
            return stats.nbinom.sf(k, self.r, self.r / (self.r + mu))
        if self.fam.dist in ("negbin", "poisson"):
            return stats.poisson.sf(k, mu)
        cut = (t - mu) / np.sqrt(mu + 1.0)
        zs = self.z
        return 1.0 - np.searchsorted(zs, np.atleast_1d(cut), side="right") / len(zs)

    def pmf_at(self, t: float, mu: np.ndarray) -> np.ndarray:
        """P(stat == t) for whole-number thresholds (a push); 0 for half lines."""
        if t != np.floor(t):
            return np.zeros_like(mu)
        return np.clip(self.sf(t - 1, mu) - self.sf(t, mu), 0, 1)

    def params(self) -> Dict:
        if self.fam.dist == "negbin" and self.r:
            return {"r": round(float(self.r), 3)}
        if self.fam.dist == "empirical":
            return {"scaled_residual_quantiles": [round(float(q), 3) for q in np.quantile(self.z, np.linspace(0, 1, 21))]}
        return {}


def fit_family(d: pd.DataFrame, fam: Family, bootstrap: int = BOOTSTRAP, seed: int = RNG_SEED,
               alpha: Optional[float] = None) -> Optional[FittedFamily]:
    train = d[eligible(d, fam) & d["y"].notna()]
    if len(train) < 200:
        return None
    alpha = alpha if alpha is not None else (3.0 if len(train) >= 2000 else 60.0)   # shrink harder on thin history
    feats = feature_names(fam)
    X = train[feats].astype(float).to_numpy()
    mean_ = np.nanmean(X, axis=0)
    X = np.where(np.isnan(X), mean_, X)
    scale_ = X.std(axis=0)
    scale_[scale_ == 0] = 1.0
    Xs = (X - mean_) / scale_
    y = train["y"].astype(float).to_numpy()
    rng = np.random.default_rng(seed)
    models = [Ridge(alpha=alpha).fit(Xs, y)]
    for _ in range(bootstrap):
        idx = rng.integers(0, len(y), len(y))
        models.append(Ridge(alpha=alpha).fit(Xs[idx], y[idx]))
    ff = FittedFamily(fam, feats, mean_, scale_, models, n_train=len(y))
    mu = np.clip(models[0].predict(Xs), 0.05, None)
    if fam.dist == "negbin":
        excess = np.sum((y - mu) ** 2 - mu)
        ff.r = float(np.clip(np.sum(mu ** 2) / excess, 0.5, 500)) if excess > 0 else None
    elif fam.dist == "empirical":
        ff.z = np.sort((y - mu) / np.sqrt(mu + 1.0))
    return ff


def pit_normal(ff: FittedFamily, y: np.ndarray, mu: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Normal scores of the probability-integral transform of y under the model (randomised for counts):
    used to estimate how two props' misses move together (Gaussian copula)."""
    lo = 1 - ff.sf(y - 1, mu) if ff.fam.dist != "empirical" else 1 - ff.sf(y, mu)
    hi = 1 - ff.sf(y, mu)
    u = lo + rng.random(len(y)) * np.clip(hi - lo, 0, 1)
    return stats.norm.ppf(np.clip(u, 1e-4, 1 - 1e-4))


def joint_over(p1: float, p2: float, rho: float) -> float:
    """P(A and B) for two overs whose normal scores correlate rho (Gaussian copula)."""
    if not (0 < p1 < 1 and 0 < p2 < 1):
        return p1 * p2
    a, b = stats.norm.ppf(1 - p1), stats.norm.ppf(1 - p2)
    cov = [[1, rho], [rho, 1]]
    # P(Z1 > a, Z2 > b) = P(-Z1 < -a, -Z2 < -b)
    return float(stats.multivariate_normal(mean=[0, 0], cov=cov).cdf([-a, -b]))


# ----------------------------------------------------------------------------- team model

TEAM_FEATURES = ["pf_l10", "pa_l10", "pf_season", "pa_season", "opp_pf_l10", "opp_pa_l10", "home", "rest", "n_prior"]
TEAM_LABELS = {"pf_l10": "team's scoring, last 10", "pa_l10": "team's points allowed, last 10",
               "pf_season": "team's season scoring", "pa_season": "team's season points allowed",
               "opp_pf_l10": "opponent's scoring, last 10", "opp_pa_l10": "opponent's points allowed, last 10",
               "home": "home game", "rest": "days of rest", "n_prior": "games of history"}


def load_team_games(conn, sport: str) -> pd.DataFrame:
    g = pd.read_sql("""SELECT event_id, commence_time, home_team, away_team, home_score, away_score
                         FROM multisport_fixtures WHERE sport_key = %s AND home_score IS NOT NULL""",
                    conn, params=(sport,))
    g["commence_time"] = pd.to_datetime(g["commence_time"], utc=True)
    rows = []
    for r in g.itertuples():
        rows.append((r.event_id, r.commence_time, r.home_team, r.away_team, 1.0, r.home_score, r.away_score))
        rows.append((r.event_id, r.commence_time, r.away_team, r.home_team, 0.0, r.away_score, r.home_score))
    t = pd.DataFrame(rows, columns=["event_id", "game_time", "team", "opponent", "home", "pf", "pa"])
    t["season"] = season_of(t["game_time"])
    return t.sort_values("game_time").reset_index(drop=True)


def team_features(t: pd.DataFrame, upcoming: Optional[pd.DataFrame] = None) -> pd.DataFrame:
    """Rolling team form from earlier games. `upcoming` rows (no scores) get the same features."""
    d = pd.concat([t, upcoming], ignore_index=True) if upcoming is not None and len(upcoming) else t.copy()
    d = d.sort_values("game_time").reset_index(drop=True)
    g = d.groupby("team")
    d["pf_l10"] = g["pf"].transform(lambda x: x.shift(1).rolling(10, 1).mean())
    d["pa_l10"] = g["pa"].transform(lambda x: x.shift(1).rolling(10, 1).mean())
    gs = d.groupby(["team", "season"])
    d["pf_season"] = gs["pf"].transform(lambda x: x.shift(1).expanding().mean()).fillna(d["pf_l10"])
    d["pa_season"] = gs["pa"].transform(lambda x: x.shift(1).expanding().mean()).fillna(d["pa_l10"])
    d["rest"] = (d["game_time"] - g["game_time"].shift(1)).dt.total_seconds().div(86400).clip(0, 10)
    d["n_prior"] = np.log1p(g.cumcount())
    form = d[["event_id", "team", "pf_l10", "pa_l10"]].rename(
        columns={"team": "opponent", "pf_l10": "opp_pf_l10", "pa_l10": "opp_pa_l10"})
    return d.merge(form, on=["event_id", "opponent"], how="left")


@dataclass
class FittedTeam:
    sport: str
    mean_: np.ndarray
    scale_: np.ndarray
    models: List[Ridge]
    sd_points: float
    sd_margin: float
    sd_total: float
    n_train: int

    def _x(self, X: pd.DataFrame) -> np.ndarray:
        x = X[TEAM_FEATURES].astype(float).to_numpy()
        x = np.where(np.isnan(x), self.mean_, x)
        return (x - self.mean_) / self.scale_

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        return np.clip(np.vstack([m.predict(self._x(X)) for m in self.models]), 0.1, None)

    def contributions(self, X: pd.DataFrame) -> List[List[Tuple[str, float, float]]]:
        x, coef = self._x(X), self.models[0].coef_
        raw = X[TEAM_FEATURES].astype(float).to_numpy()
        return [[(TEAM_FEATURES[j], None if np.isnan(raw[i, j]) else float(raw[i, j]), float(x[i, j] * coef[j]))
                 for j in np.argsort(-np.abs(x[i] * coef))[:4]] for i in range(len(X))]


def fit_team(d: pd.DataFrame, sport: str, bootstrap: int = BOOTSTRAP, seed: int = RNG_SEED) -> Optional[FittedTeam]:
    train = d[d["pf"].notna() & d["pf_l10"].notna() & d["opp_pf_l10"].notna() & (np.expm1(d["n_prior"]) >= 3)]
    if train["event_id"].nunique() < 150:
        return None
    X = train[TEAM_FEATURES].astype(float).to_numpy()
    mean_ = np.nanmean(X, axis=0)
    X = np.where(np.isnan(X), mean_, X)
    scale_ = X.std(axis=0)
    scale_[scale_ == 0] = 1
    Xs = (X - mean_) / scale_
    y = train["pf"].astype(float).to_numpy()
    rng = np.random.default_rng(seed)
    models = [Ridge(alpha=3.0).fit(Xs, y)]
    for _ in range(bootstrap):
        idx = rng.integers(0, len(y), len(y))
        models.append(Ridge(alpha=3.0).fit(Xs[idx], y[idx]))
    tr = train.assign(mu=models[0].predict(Xs))
    pair = tr.merge(tr[["event_id", "team", "pf", "mu"]].rename(columns={"team": "opponent", "pf": "opf", "mu": "omu"}),
                    on=["event_id", "opponent"])
    pair = pair[pair["home"] == 1]
    sd_m = float(np.std((pair["pf"] - pair["opf"]) - (pair["mu"] - pair["omu"])))
    sd_t = float(np.std((pair["pf"] + pair["opf"]) - (pair["mu"] + pair["omu"])))
    return FittedTeam(sport, mean_, scale_, models, float(np.std(y - tr["mu"])), sd_m, sd_t, len(y))


def normal_sf(t: float, mu, sd: float):
    """P(whole-number score > t) with a continuity correction."""
    return 1 - stats.norm.cdf((np.floor(t) + 0.5 - np.asarray(mu)) / sd)


def normal_pmf(t: float, mu, sd: float):
    if t != np.floor(t):
        return np.zeros_like(np.asarray(mu, dtype=float))
    return stats.norm.cdf((t + 0.5 - np.asarray(mu)) / sd) - stats.norm.cdf((t - 0.5 - np.asarray(mu)) / sd)


def win_prob(margin_mu, sd: float):
    """P(win) with ties (rare, or decided in overtime) split out and renormalised."""
    up = normal_sf(0, margin_mu, sd)
    down = stats.norm.cdf((-0.5 - np.asarray(margin_mu)) / sd)
    return up / (up + down)


def wilson(k: int, n: int, z: float = 1.96) -> Tuple[Optional[float], Optional[float]]:
    if n == 0:
        return None, None
    p = k / n
    den = 1 + z * z / n
    c = (p + z * z / (2 * n)) / den
    h = z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den
    return float(max(0, c - h)), float(min(1, c + h))


def grid(fam_step: float, mu_hi: float, offered: Sequence[float]) -> List[float]:
    top = max([mu_hi * 2 + 2 * fam_step] + [float(x) for x in offered])
    pts = list(np.arange(0.5, top + fam_step, fam_step)) if fam_step == 1 else \
        list(np.arange(fam_step - 0.5, top + fam_step, fam_step))
    return sorted(set([round(float(x), 2) for x in pts] + [float(x) for x in offered]))
