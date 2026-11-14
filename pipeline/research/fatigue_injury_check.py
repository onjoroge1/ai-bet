"""Do fatigue + missing-player features add anything on top of the NBA closing line?

Walk-forward (6 time-ordered folds, train on the past only), two targets:
  1. home win        -> log loss of market vs. logistic(market logit + new features)
  2. home cover (ATS) -> same, vs. de-vigged closing spread price
Missing-player features use who ACTUALLY sat out (box scores): an optimistic upper bound,
since most absences are announced before tip.
"""
import numpy as np, pandas as pd, psycopg2
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import log_loss
from scipy import stats
from snapbet_pipeline.config import Settings

TZ = {  # home arena UTC offset (standard time) -- for time-zone shifts
    **{t: -5 for t in ["Atlanta Hawks", "Boston Celtics", "Brooklyn Nets", "Charlotte Hornets", "Cleveland Cavaliers",
                       "Detroit Pistons", "Indiana Pacers", "Miami Heat", "New York Knicks", "Orlando Magic",
                       "Philadelphia 76ers", "Toronto Raptors", "Washington Wizards"]},
    **{t: -6 for t in ["Chicago Bulls", "Dallas Mavericks", "Houston Rockets", "Memphis Grizzlies", "Milwaukee Bucks",
                       "Minnesota Timberwolves", "New Orleans Pelicans", "Oklahoma City Thunder", "San Antonio Spurs"]},
    **{t: -7 for t in ["Denver Nuggets", "Phoenix Suns", "Utah Jazz"]},
    **{t: -8 for t in ["Golden State Warriors", "Los Angeles Clippers", "Los Angeles Lakers", "Portland Trail Blazers",
                       "Sacramento Kings"]},
}
ALTITUDE = {"Denver Nuggets", "Utah Jazz"}

c = psycopg2.connect(Settings.from_env().database_url)
box = pd.read_sql("""SELECT espn_event_id, game_time, team, opponent, is_home, player_id, did_not_play,
                            COALESCE(minutes,0) minutes, COALESCE(points,0) points
                       FROM multisport_player_boxscores WHERE sport_key='basketball_nba'""", c)
games = pd.read_sql("""
  SELECT f.event_id, f.commence_time, f.home_team, f.away_team, f.home_score, f.away_score,
         o.home_odds, o.away_odds, o.home_spread, o.home_spread_odds, o.away_spread_odds
    FROM multisport_fixtures f
    JOIN LATERAL (SELECT * FROM multisport_odds_snapshots s WHERE s.event_id=f.event_id AND s.is_consensus
                   AND s.ts_recorded <= f.commence_time ORDER BY s.ts_recorded DESC LIMIT 1) o ON true
   WHERE f.sport_key='basketball_nba' AND f.status='finished' AND f.home_score IS NOT NULL""", c)
for col in ["home_odds", "away_odds", "home_spread", "home_spread_odds", "away_spread_odds"]:
    games[col] = games[col].astype(float)
print(f"box rows {len(box):,}  team-games {box.groupby(['espn_event_id','team']).ngroups:,}  priced games {len(games):,}")

# ---- per team-game schedule (from box scores = complete ESPN schedule)
tg = (box.groupby(["espn_event_id", "team"]).agg(game_time=("game_time", "first"), opponent=("opponent", "first"),
                                                  is_home=("is_home", "first")).reset_index()
        .sort_values(["team", "game_time"]).reset_index(drop=True))
tg["venue"] = np.where(tg.is_home, tg.team, tg.opponent)
feat_rows = []
for team, g in tg.groupby("team"):
    t = g.game_time.values.astype("datetime64[s]").astype(np.int64) / 86400.0
    venues, homes = g.venue.values, g.is_home.values
    road = 0
    for i in range(len(g)):
        prior = t[:i]
        road = 0 if homes[i] else road + 1
        prev_v = venues[i - 1] if i else venues[i]
        feat_rows.append(dict(
            espn_event_id=g.espn_event_id.values[i], team=team,
            g_prev3=int(((t[i] - prior) <= 3.5).sum()),          # games in the 3 nights before -> "3 in 4" if >= 2
            g_prev6=int(((t[i] - prior) <= 6.5).sum()),
            rest=min(t[i] - prior[-1], 10) if i else 10,
            road_trip=road,
            tz_shift=abs(TZ.get(venues[i], -6) - TZ.get(prev_v, -6)),
            altitude=int((not homes[i]) and venues[i] in ALTITUDE)))
fat = pd.DataFrame(feat_rows)
fat["three_in_four"] = (fat.g_prev3 >= 2).astype(int)

# ---- missing players: rotation (avg >= 12 min over team's previous 10 games, DNP = 0) who did not play
box = box.sort_values("game_time")
played = box[~box.did_not_play & (box.minutes > 0)]
miss_rows = []
for team, g in tg.groupby("team"):
    ids = list(g.espn_event_id)
    tb = box[box.team == team]
    per_game = {e: d for e, d in tb.groupby("espn_event_id")}
    for i, e in enumerate(ids):
        prev = ids[max(0, i - 10):i]
        if len(prev) < 5:
            miss_rows.append(dict(espn_event_id=e, team=team, miss_min=np.nan, miss_pts=np.nan)); continue
        hist = pd.concat([per_game[p] for p in prev])
        exp_min = hist.groupby("player_id").minutes.sum() / len(prev)
        exp_pts = hist.groupby("player_id").points.sum() / len(prev)
        rot = exp_min[exp_min >= 12].index
        now = per_game[e]
        playing = set(now[~now.did_not_play & (now.minutes > 0)].player_id)
        out = [p for p in rot if p not in playing]
        miss_rows.append(dict(espn_event_id=e, team=team, miss_min=exp_min[out].sum(), miss_pts=exp_pts[out].sum()))
miss = pd.DataFrame(miss_rows)
tf = fat.merge(miss, on=["espn_event_id", "team"]).merge(tg[["espn_event_id", "team", "game_time", "is_home"]])

# ---- join to priced fixtures (same home team, start within 12h)
home = tf[tf.is_home].add_prefix("h_"); away = tf[~tf.is_home].add_prefix("a_")
pair = home.merge(away, left_on="h_espn_event_id", right_on="a_espn_event_id")
games["commence_time"] = pd.to_datetime(games.commence_time, utc=True)
pair["h_game_time"] = pd.to_datetime(pair.h_game_time, utc=True)
df = games.merge(pair, left_on="home_team", right_on="h_team")
df = df[(df.commence_time - df.h_game_time).abs() <= pd.Timedelta(hours=12)]
df = df.dropna(subset=["h_miss_min", "a_miss_min"]).sort_values("commence_time").reset_index(drop=True)
print(f"games with features + closing line: {len(df):,}  ({df.commence_time.min():%Y-%m-%d} .. {df.commence_time.max():%Y-%m-%d})")

df["mkt_home"] = (1 / df.home_odds) / (1 / df.home_odds + 1 / df.away_odds)
df["mkt_cover"] = (1 / df.home_spread_odds) / (1 / df.home_spread_odds + 1 / df.away_spread_odds)
df["home_win"] = (df.home_score > df.away_score).astype(int)
df["ats"] = df.home_score - df.away_score + df.home_spread
FE = {
    "fatigue": ["d_prev3", "d_prev6", "d_rest", "d_three_in_four", "d_road_trip", "d_tz", "h_altitude_dummy"],
    "missing": ["d_miss_min", "d_miss_pts"],
}
df["d_prev3"] = df.h_g_prev3 - df.a_g_prev3; df["d_prev6"] = df.h_g_prev6 - df.a_g_prev6
df["d_rest"] = df.h_rest - df.a_rest; df["d_three_in_four"] = df.h_three_in_four - df.a_three_in_four
df["d_road_trip"] = df.h_road_trip - df.a_road_trip; df["d_tz"] = df.h_tz_shift - df.a_tz_shift
df["h_altitude_dummy"] = df.a_altitude
df["d_miss_min"] = df.h_miss_min - df.a_miss_min; df["d_miss_pts"] = df.h_miss_pts - df.a_miss_pts
FE["both"] = FE["fatigue"] + FE["missing"]

logit = lambda p: np.log(np.clip(p, 1e-4, 1 - 1e-4) / (1 - np.clip(p, 1e-4, 1 - 1e-4)))


def walk(d, y, mcol, cols):
    folds = np.array_split(np.arange(len(d)), 6); oy, om, ox = [], [], []
    for k in range(1, 6):
        tr, te = np.concatenate(folds[:k]), folds[k]
        X = lambda idx: np.column_stack([logit(d.loc[idx, mcol])] + [d.loc[idx, c].astype(float) for c in cols])
        m = LogisticRegression(C=0.5, max_iter=1000).fit(X(tr), y[tr])
        om += list(np.clip(m.predict_proba(X(te))[:, 1], .02, .98)); ox += list(d.loc[te, mcol]); oy += list(y[te])
    oy, om, ox = map(np.array, (oy, om, ox))
    return log_loss(oy, np.clip(ox, .02, .98)), log_loss(oy, om), len(oy)


rows = []
for target, ycol, mcol, sub in (("win", "home_win", "mkt_home", df),
                                ("cover", "ats", "mkt_cover", df[df.ats.notna() & (df.ats != 0) & df.mkt_cover.notna()])):
    d = sub.reset_index(drop=True)
    y = (d[ycol] > 0).astype(int).values if ycol == "ats" else d[ycol].values
    for name, cols in FE.items():
        lm, lx, n = walk(d, y, mcol, cols)
        rows.append(dict(target=target, features=name, tested=n, ll_market=round(lm, 4), ll_with_feats=round(lx, 4),
                         better=lx < lm))
print(pd.DataFrame(rows).to_string(index=False))

# ---- does any single feature explain the result the market missed? (ATS margin residual)
d = df[df.ats.notna()]
print("\nCorrelation with points-vs-spread (home margin + spread); |r|>~0.06 needed at this sample size:")
for col in FE["both"]:
    r, p = stats.pearsonr(d[col].astype(float), d.ats)
    print(f"  {col:18s} r={r:+.3f}  p={p:.3f}  nonzero={int((d[col]!=0).sum())}")
print("\nhow often: away 3-in-4", int(df.a_three_in_four.sum()), " home 3-in-4", int(df.h_three_in_four.sum()),
      " games with >=20 missing rotation min (either side)", int(((df.h_miss_min >= 20) | (df.a_miss_min >= 20)).sum()))


# ---- market fixed, learn only "points per missing minute" (walk-forward), then paper-bet at real prices
from scipy.stats import norm
SIGMA = 12.0                                      # NBA margin-vs-spread SD
d = df[df.ats.notna() & (df.ats != 0) & df.mkt_cover.notna()].reset_index(drop=True)
y = (d.ats > 0).astype(int).values
folds = np.array_split(np.arange(len(d)), 6)
for col in ["d_miss_min", "d_miss_pts"]:
    oy, om, ox, shifts, py, pn = [], [], [], [], [], []
    for k in range(1, 6):
        tr, te = np.concatenate(folds[:k]), folds[k]
        x_tr = d.loc[tr, col].astype(float).values
        slope = float(np.dot(x_tr, d.loc[tr, "ats"].values) / max(np.dot(x_tr, x_tr), 1e-9))   # no intercept
        sh = slope * d.loc[te, col].astype(float).values
        mk = d.loc[te, "mkt_cover"].values
        om += list(np.clip(norm.cdf(norm.ppf(mk) + sh / SIGMA), .02, .98)); ox += list(mk); oy += list(y[te])
        shifts += list(sh); py += list(d.loc[te, "home_spread_odds"]); pn += list(d.loc[te, "away_spread_odds"])
        if col == "d_miss_min": print(f"  fold {k}: {slope*10:+.2f} pts per 10 missing minutes (train n={len(tr)})")
    oy, om, ox, shifts, py, pn = map(np.array, (oy, om, ox, shifts, py, pn))
    print(f"{col}: ATS log loss market {log_loss(oy, ox):.4f}  market+adjust {log_loss(oy, om):.4f}  (n={len(oy)})")
    for thr in (1.0, 2.0, 3.0):
        pick = np.where(shifts >= thr, 1, np.where(shifts <= -thr, 0, -1)); bet = pick >= 0
        won = (pick == oy) & bet; price = np.where(pick == 1, py, pn)
        roi = (np.where(won, price - 1, 0).sum() - (bet.sum() - won.sum())) / max(bet.sum(), 1)
        print(f"   bet when adjustment >= {thr} pts: {int(bet.sum())} bets, win {won.sum()/max(bet.sum(),1):.3f}, ROI {roi:+.3f}")
# moneyline version
d2 = df.reset_index(drop=True); y2 = d2.home_win.values; folds = np.array_split(np.arange(len(d2)), 6)
oy, om, ox = [], [], []
for k in range(1, 6):
    tr, te = np.concatenate(folds[:k]), folds[k]
    x_tr = d2.loc[tr, "d_miss_min"].astype(float).values
    resid = d2.loc[tr, "home_score"].values - d2.loc[tr, "away_score"].values + d2.loc[tr, "home_spread"].fillna(0).values
    slope = float(np.dot(x_tr, resid) / max(np.dot(x_tr, x_tr), 1e-9))
    sh = slope * d2.loc[te, "d_miss_min"].astype(float).values
    om += list(np.clip(norm.cdf(norm.ppf(d2.loc[te, "mkt_home"].values) + sh / SIGMA), .02, .98))
    ox += list(d2.loc[te, "mkt_home"]); oy += list(y2[te])
print(f"WIN log loss market {log_loss(oy, ox):.4f}  market+adjust {log_loss(oy, om):.4f}")
