"""Can we predict where the moneyline will CLOSE from what we see hours earlier?

Target (per game, per look-ahead bucket): close - now, in logit(home win prob) of the de-vigged
book consensus. The close is the last consensus snapshot within 90 minutes before start.
Signals at "now":
  kalshi_gap  = logit(Kalshi home mid) - logit(consensus)   (does the book price drift toward Kalshi?)
  momentum    = logit(consensus now) - logit(first snapshot) (do moves continue or revert?)
  book_lean   = logit(mean of the single books' no-vig home prob) - logit(consensus)
One observation per game per bucket, so games are not double counted inside a bucket.
Usage: python research/line_move_check.py   (reads DATABASE_URL / pipeline .env; free, read-only)
"""
import numpy as np, pandas as pd, psycopg2
from scipy import stats
from snapbet_pipeline.config import Settings

BUCKETS = [("2-6h", 2, 6), ("6-12h", 6, 12), ("12-30h", 12, 30)]
CLOSE_WITHIN_H = 1.5


def logit(p):
    p = np.clip(np.asarray(p, dtype=float), 0.01, 0.99)
    return np.log(p / (1 - p))


c = psycopg2.connect(Settings.from_env().database_url)
snap = pd.read_sql("""SELECT sport_key, event_id, commence_time, ts_recorded, is_consensus, home_prob::float
                        FROM multisport_odds_snapshots
                       WHERE ts_recorded < commence_time AND commence_time < now() AND home_prob IS NOT NULL
                         AND bookmaker NOT LIKE 'csv:%%'""", c)
kal = pd.read_sql("""SELECT event_id, ts_recorded, ((yes_bid + yes_ask) / 2.0)::float mid
                       FROM multisport_kalshi_snapshots
                      WHERE market_type = 'game' AND is_home AND event_id IS NOT NULL
                        AND yes_bid > 0 AND yes_ask > 0 AND yes_ask - yes_bid <= 0.06""", c)
for d in (snap, kal):
    d["ts_recorded"] = pd.to_datetime(d["ts_recorded"], utc=True)
snap["commence_time"] = pd.to_datetime(snap["commence_time"], utc=True)
snap["hours_out"] = (snap["commence_time"] - snap["ts_recorded"]).dt.total_seconds() / 3600
cons = snap[snap.is_consensus].sort_values("ts_recorded")
books = snap[~snap.is_consensus].groupby(["event_id", "ts_recorded"]).home_prob.mean().rename("book_mean").reset_index()

rows = []
for eid, g in cons.groupby("event_id"):
    close = g.iloc[-1]
    if close.hours_out > CLOSE_WITHIN_H:
        continue
    first = g.iloc[0]
    k = kal[kal.event_id == eid].sort_values("ts_recorded")
    for name, lo, hi in BUCKETS:
        b = g[(g.hours_out >= lo) & (g.hours_out < hi)]
        if b.empty:
            continue
        now = b.iloc[0]                                   # earliest look in the bucket
        kk = k[(k.ts_recorded <= now.ts_recorded + pd.Timedelta(minutes=20)) &
               (k.ts_recorded >= now.ts_recorded - pd.Timedelta(hours=2))]
        bm = books[(books.event_id == eid) & (books.ts_recorded == now.ts_recorded)]
        rows.append({"sport": close.sport_key, "event_id": eid, "bucket": name,
                     "target": float(logit(close.home_prob) - logit(now.home_prob)),
                     "kalshi_gap": float(logit(kk.mid.iloc[-1]) - logit(now.home_prob)) if len(kk) else np.nan,
                     "momentum": float(logit(now.home_prob) - logit(first.home_prob))
                                 if first.ts_recorded < now.ts_recorded - pd.Timedelta(hours=1) else np.nan,
                     "book_lean": float(logit(bm.book_mean.iloc[0]) - logit(now.home_prob)) if len(bm) else np.nan})
df = pd.DataFrame(rows)
print(f"games with a usable close: {df.event_id.nunique()}  observations: {len(df)}")
print(df.groupby(["bucket", "sport"]).size().unstack(fill_value=0).to_string(), "\n")
print("typical move to close (|logit|, ~4x in probability points near 50%):")
print(df.groupby("bucket").target.agg(lambda s: s.abs().median()).round(3).to_string(), "\n")

print(f"{'bucket':8} {'signal':11} {'n':>4} {'slope':>7} {'r':>6} {'p':>7} {'same-direction':>15}")
for name, _, _ in BUCKETS:
    for sig in ("kalshi_gap", "momentum", "book_lean"):
        d = df[(df.bucket == name) & df[sig].notna() & (df[sig].abs() > 1e-9)]
        if len(d) < 12:
            print(f"{name:8} {sig:11} {len(d):4d}   too few games")
            continue
        r, p = stats.pearsonr(d[sig], d.target)
        slope = float((d[sig] * d.target).sum() / (d[sig] ** 2).sum())    # through the origin
        moved = d[d.target.abs() > 1e-9]
        agree = float((np.sign(moved[sig]) == np.sign(moved.target)).mean()) if len(moved) else float("nan")
        print(f"{name:8} {sig:11} {len(d):4d} {slope:7.2f} {r:6.2f} {p:7.3f} {agree:14.0%}")
print("\nRead: slope 1 = the consensus closes the whole gap; 0 = the signal says nothing; negative momentum = moves revert."
      "\nNothing here is usable until it holds on a few hundred games per bucket, out of sample.")
