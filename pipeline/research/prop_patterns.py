"""Patterns in NBA player props: winning games and game-to-game carry-over (free, read-only).

Questions are fixed up front (so we don't go fishing in a big table):
  Q1 Calibration   - on main lines, does the over hit as often as the no-vig price says? (by market)
  Q2 Winning games - (a) HINDSIGHT: overs for players on the team that won vs lost. Not bettable on its own;
                     it measures how tied props are to the game result (matters for same-game parlays).
                     (b) BETTABLE: overs for players on the pregame moneyline favourite vs the underdog,
                     and on big favourites (>= 70%).
  Q3 Carry-over    - (a) with lines: after a player went over (or under) his last line in this market, does
                     the over beat its price this game? Did the line move enough?
                     (b) box scores only, 2025-26 season: does a player's last game above his own 10-game
                     average predict the next game above it? (Form persisting is not an edge by itself:
                     books set lines from recent form, which is what (a) checks.)
Every test reports the residual = (went over) - (no-vig over probability), averaged; 0 means the
price was right. Confidence intervals are bootstrapped by GAME (props in one game move together).
With a date split, a pattern found in the earlier half must also show in the later half.
Run: python research/prop_patterns.py   (needs multisport_prop_results; `snapbet-pipeline prop-results` builds it)
"""
import re, unicodedata
import numpy as np, pandas as pd, psycopg2
from snapbet_pipeline.config import Settings

RNG = np.random.default_rng(7)
MIN_GAMES = 100            # below this many games a group is reported but marked "too few"


def name_key(n):
    plain = unicodedata.normalize("NFKD", n or "").encode("ascii", "ignore").decode().lower()
    return "".join(t for t in re.split(r"[^a-z]+", plain) if t and t not in ("jr", "sr", "ii", "iii", "iv"))


def cluster_ci(df, col="resid", by="event_id", n=2000):
    g = df.groupby(by)[col].agg(["sum", "count"])
    if len(g) < 2:
        return (np.nan, np.nan)
    idx = RNG.integers(0, len(g), size=(n, len(g)))
    s, c = g["sum"].to_numpy()[idx].sum(1), g["count"].to_numpy()[idx].sum(1)
    return tuple(np.percentile(s / c, [2.5, 97.5]))


def row(label, d):
    games = d["event_id"].nunique()
    lo, hi = cluster_ci(d)
    flag = "" if games >= MIN_GAMES else "  (too few games)"
    roi = np.where(d["over"] == 1, d["best_over"] - 1, -1).mean() if len(d) else np.nan
    print(f"  {label:<38} props {len(d):>6}  games {games:>4}  priced {d['over_prob'].mean():.3f}  "
          f"actual {d['over'].mean():.3f}  resid {d['resid'].mean():+.3f} [{lo:+.3f},{hi:+.3f}]  "
          f"over@best {roi:+.1%}{flag}")


def split_check(label, d):
    """Same comparison in the earlier and later half of dates."""
    cut = d["commence_time"].quantile(0.5)
    for half, part in (("earlier", d[d["commence_time"] <= cut]), ("later", d[d["commence_time"] > cut])):
        row(f"{label} [{half}]", part)


c = psycopg2.connect(Settings.from_env().database_url)
pr = pd.read_sql("""SELECT event_id, commence_time, home_team, away_team, market, player_name, line, is_main_line,
                           n_books, over_prob::float, best_over::float, best_under::float, actual::float, result
                      FROM multisport_prop_results
                     WHERE sport_key = 'basketball_nba' AND result IN ('over','under')""", c)
box = pd.read_sql("""SELECT event_id, game_time, team, opponent, is_home, player_name, did_not_play, starter,
                            minutes, points, rebounds, assists, threes_made
                       FROM multisport_player_boxscores WHERE sport_key = 'basketball_nba'""", c)
odds = pd.read_sql("""
  SELECT f.event_id, f.home_team, f.away_team, f.home_score, f.away_score, o.home_prob::float AS home_prob
    FROM multisport_fixtures f
    JOIN LATERAL (SELECT home_prob FROM multisport_odds_snapshots s WHERE s.event_id = f.event_id AND s.is_consensus
                   AND s.ts_recorded <= f.commence_time ORDER BY s.ts_recorded DESC LIMIT 1) o ON true
   WHERE f.sport_key = 'basketball_nba'""", c)

pr["over"] = (pr["result"] == "over").astype(int)
pr["resid"] = pr["over"] - pr["over_prob"]
pr["key"] = pr["player_name"].map(name_key)
main = pr[pr["is_main_line"]].copy()
print(f"graded NBA props: {len(pr):,} lines, {len(main):,} main lines, {main['event_id'].nunique()} games, "
      f"{main['commence_time'].min():%Y-%m-%d} to {main['commence_time'].max():%Y-%m-%d}")

print("\nQ1 calibration (main lines)")
row("all markets", main)
for m, d in main.groupby("market"):
    row(m.replace("player_", ""), d)
for lo_, hi_ in ((0, .4), (.4, .5), (.5, .6), (.6, 1.01)):
    row(f"priced over {lo_:.1f}-{min(hi_, 1):.1f}", main[(main["over_prob"] >= lo_) & (main["over_prob"] < hi_)])

# attach each player's team (from the box score) and the game's result and pregame favourite
box["key"] = box["player_name"].map(name_key)
team = box.dropna(subset=["event_id"]).drop_duplicates(["event_id", "key"])[["event_id", "key", "team", "starter"]]
m2 = main.merge(team, on=["event_id", "key"], how="inner").merge(
    odds[["event_id", "home_score", "away_score", "home_prob"]], on="event_id", how="left")
m2["is_home_team"] = m2["team"] == m2["home_team"]
m2["team_won"] = np.where(m2["is_home_team"], m2["home_score"] > m2["away_score"], m2["away_score"] > m2["home_score"])
m2["team_prob"] = np.where(m2["is_home_team"], m2["home_prob"], 1 - m2["home_prob"])

print("\nQ2a winning games (HINDSIGHT, not bettable)")
for mk in ["all"] + sorted(m2["market"].unique()):
    d = m2 if mk == "all" else m2[m2["market"] == mk]
    row(f"{mk.replace('player_', '')}: team won", d[d["team_won"]])
    row(f"{mk.replace('player_', '')}: team lost", d[~d["team_won"]])

print("\nQ2b pregame favourite (bettable)")
row("team was favourite", m2[m2["team_prob"] >= 0.5])
row("team was underdog", m2[m2["team_prob"] < 0.5])
row("team was a 70%+ favourite", m2[m2["team_prob"] >= 0.7])
row("starters on 70%+ favourite", m2[(m2["team_prob"] >= 0.7) & (m2["starter"] == True)])
split_check("team was favourite", m2[m2["team_prob"] >= 0.5])

print("\nQ3a carry-over with lines (same player and market, previous graded game)")
seq = main.sort_values("commence_time").copy()
grp = seq.groupby(["key", "market"])
seq["prev_over"] = grp["over"].shift(1)
seq["prev_line"] = grp["line"].shift(1)
seq["prev_margin"] = grp["actual"].shift(1) - seq["prev_line"]
s3 = seq.dropna(subset=["prev_over"])
row("went OVER last game", s3[s3["prev_over"] == 1])
row("went UNDER last game", s3[s3["prev_over"] == 0])
row("cleared last line by 25%+", s3[s3["prev_margin"] >= 0.25 * s3["prev_line"]])
row("missed last line by 25%+", s3[s3["prev_margin"] <= -0.25 * s3["prev_line"]])
if len(s3):
    mv = s3.assign(line_move=s3["line"] - s3["prev_line"]).groupby("prev_over")["line_move"].mean()
    print("  average line change after over / under:", {("over" if k else "under"): round(v, 2) for k, v in mv.items()})
split_check("went OVER last game", s3[s3["prev_over"] == 1])

print("\nQ3b form carry-over, box scores only (no lines; whether form persists at all)")
b = box[(~box["did_not_play"]) & (box["minutes"].fillna(0) >= 10)].sort_values("game_time").copy()
for stat in ("points", "rebounds", "assists", "threes_made"):
    g = b.groupby("key")[stat]
    avg10 = g.transform(lambda x: x.shift(1).rolling(10, min_periods=5).mean())
    above = (b[stat] - avg10)
    prev_above = above.groupby(b["key"]).shift(1)
    ok = avg10.notna() & prev_above.notna()
    x, y = prev_above[ok], above[ok]
    r = np.corrcoef(x, y)[0, 1] if ok.sum() > 2 else np.nan
    hit_after_hot = (y[x > 0] > 0).mean()
    hit_after_cold = (y[x < 0] > 0).mean()
    print(f"  {stat:<12} games {ok.sum():>6}  corr(last vs next, both vs own 10-game avg) {r:+.3f}  "
          f"next above avg: after above {hit_after_hot:.3f}, after below {hit_after_cold:.3f}")
print("\nRead: 'resid' is how much more often the over hit than priced; an interval that includes 0 means no"
      " evidence. Trust a pattern only if it holds in both halves, has 100+ games, and survives the number of"
      " rows above (about 30 tests -> expect 1-2 false alarms at 95%).")
