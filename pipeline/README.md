# Snapbet multisport pipeline (NFL · NBA · NCAAB)

Batch jobs that replace the retired Replit backend for 2-way US sports:

```
The Odds API ──collect──▶ multisport_fixtures / multisport_odds_snapshots
             ──results──▶ multisport_match_results (+ fixture scores/outcome)
                 sync  ──▶ multisport_training (label + 46 leak-safe features)
                 train ──▶ multisport_models (source of truth) + models/<sport_key>/ (local cache)
               predict ──▶ "MultisportMatch" (the Prisma table the Next.js app reads)
                settle ──▶ "MultisportMatch".finalResult
```

Everything writes to the **frontend's Postgres** (`DATABASE_URL`). The six
`multisport_*` tables are created by `sql/001_multisport_tables.sql` and are not
managed by Prisma; `"MultisportMatch"` is Prisma's and is written with plain SQL.

## Run locally

```bash
cd pipeline
python -m venv .venv && . .venv/bin/activate
pip install -e ".[dev]"

# Secrets: the process env wins; otherwise pipeline/.env, then the app's ../.env.local and ../.env
# are read (all gitignored). DATABASE_URL_UNPOOLED is preferred over DATABASE_URL, and Prisma-only
# query params (pgbouncer=, connection_limit=) are stripped, so the app's Neon URLs work as-is.
# The app's env files have no ODDS_API_KEY: put it in pipeline/.env (ODDS_API_KEY=...).
export PIPELINE_SPORTS="americanfootball_nfl,basketball_nba,icehockey_nhl"   # default; add basketball_ncaab to opt in

snapbet-pipeline migrate      # create tables (idempotent; every command also runs it)
snapbet-pipeline collect      # odds snapshot for in-season sports
snapbet-pipeline kalshi       # Kalshi game-winner prices (public API, no key, no credits)
snapbet-pipeline results      # finished scores (last 3 days; --days N steps down to your plan's max)
snapbet-pipeline sync         # finished games -> training rows + features
snapbet-pipeline train        # trains only when the policy says so; --force to override, --dry-run to ask
snapbet-pipeline predict      # upcoming slate -> MultisportMatch (cold start = market only, model null)
snapbet-pipeline settle       # copy finals onto MultisportMatch rows
snapbet-pipeline run          # collect + results + sync + predict + settle (what the hourly cron does)
snapbet-pipeline status       # counts, last snapshot, model present, train-policy verdict per sport
```

Add `-v` for debug logging. Each job writes a row to `multisport_pipeline_runs`.

## Training policy (automated)

`train` retrains a sport when **either**: at least `MIN_NEW_GAMES` (20) new
finished games landed since the last train, **or** the model is older than
`MAX_MODEL_AGE_DAYS` (7), **or** the stored model predates the market-anchored
trainer. It refuses to train below `min_train_samples` (NFL 120, NBA/NCAAB 150).
Every trained model is written to the `multisport_models` table (`sql/003`), which
`predict` and `status` load from; `models/<sport_key>/` is a local cache and the
fallback when no row exists. The nightly workflow still commits that folder.

### Model: market-anchored LightGBM

Every game starts at `logit(consensus home probability)` (LightGBM `init_score`)
and the booster learns only a small, heavily regularised correction (4 leaves,
depth 2, L2 = 10) on the 34 features whose training and live distributions match
(`features.MODEL_FEATURE_NAMES`; line-movement, snapshot-count and time-to-game
features are excluded because imported games have one snapshot and finished games
have no time to kickoff). The number of correction rounds is chosen by an inner
temporal CV from `ANCHOR_ROUND_CANDIDATES`; a correction is kept only if it beats
"market only" by ≥ `ANCHOR_MIN_INNER_GAIN` (0.002) log loss per game. With
**0 rounds the model is the market**, and `predict` publishes such a sport like cold
start (`model = null`, mode `market_only_model_adds_nothing`) so a favourite is
never relabelled as a model pick.

Why: a backtest on 729 imported games (Nov 2026) found the previous unanchored
46-feature model 0.01–0.03 log loss *worse* than the market in every sport while
flagging a value bet on ~45 of 47 games. Larger corrections made log loss worse
still: at a few hundred games there is no reliable signal beyond the closing line.

### Honesty gate

Every trained model carries `metadata.edge_gate`, computed on **nested** temporal
out-of-fold predictions (the round count is chosen inside each outer training
fold, so the gate never grades its own selection) against the de-vigged market
probability on the same games. `edge_validated` becomes true only with n ≥ 100,
a log-loss gain ≥ `EDGE_GATE_MIN_LOGLOSS_GAIN` (0.005) **and** a Brier score no
worse than the market's. Accuracy vs "pick the favourite" is still reported
(`model_acc`, `favorite_acc`, `delta`) but decides nothing. The published
`model_track_record.edge_validated` is read from this; nothing can set it by hand.

### Value bets

`value.value_bet` is emitted **only when `edge_validated` is true** (otherwise
`value.gated` says why). The model must beat the de-vigged consensus by
`VALUE_MIN_EDGE` (3pp) and show positive EV at the **consensus** price; the best
single-book price is then reported as where to take it. Selecting on the best
book alone made nearly every game "value", because the best of ~10 noisy quotes
almost always beats the average. The ledger keeps every bet it was given, but
value-bet ROI and CLV in the track record count only bets placed while the gate
had passed (`edge_validated_at_bet`), i.e. bets the site actually offered.

## Cold start

With an empty database the site shows market odds and de-vigged probabilities
with `model = null`, and models appear once `min_train_samples` games have
finished. Live collection alone takes ~3 weeks for NBA/NHL and ~9 for NFL, so
seed history with `import-odds-api-history` (below), or `import-csv` when you
only have a results file.

## Past seasons: `import-odds-api-history`

Real Odds API events with **every bookmaker**, stored exactly like live
collection, plus final scores from ESPN's public scoreboard (The Odds API
`/scores` only reaches back 3 days). Needs a plan with historical access.

```bash
snapbet-pipeline import-odds-api-history --sports basketball_nba --from 2025-12-01 --to 2026-03-19 \
    --cache-dir ~/snapbet-history-cache --dry-run            # ESPN only: games found + estimated credits
snapbet-pipeline import-odds-api-history --sports basketball_nba --from 2025-12-01 --to 2026-03-19 \
    --cache-dir ~/snapbet-history-cache --max-credits 3300 --supersede-csv
snapbet-pipeline sync --sports basketball_nba && snapbet-pipeline train --sports basketball_nba --force
```

- One historical snapshot per `--offsets` hour (default `1`) before each day's **first** kickoff; events
  already started at the snapshot time are dropped, so no in-play price is ever stored. `--offsets 24,1`
  adds an earlier snapshot and gives the line-movement features real values (twice the credits).
- Cost: 10 credits × markets × regions per snapshot = **30 per game day** with the default markets.
  `--max-credits` stops before the cap; `--cache-dir` keeps every raw response so re-runs cost nothing.
- `--supersede-csv` deletes `csv-` rows imported earlier for the same games (same teams, kickoff within
  36h) from every pipeline table, so no game is counted twice.
- ESPN team labels go through `teams.canonical_team`; unknown labels (all-star teams) are listed in
  `unmapped_teams` and skipped. ESPN games with no matching Odds API event are counted as `unmatched`.

## Pick ledger, closing line and CLV

Every `predict` writes `multisport_pick_ledger`: the model pick at **first** publish and the
value bet at the **first** publish that carried one, with the best price available at that moment
(`bet_time_odds`). Later publishes only bump `publish_count`; nothing bet-time is overwritten.
`settle` then records the closing line (last consensus snapshot at or before kickoff, else the latest
available and flagged), the result, whether the pick / value bet won, 1u P&L at the bet-time price, and

```
realized_clv = bet_time_odds × closing_prob_bet − 1
```

Positive CLV = we beat the close. `snapbet-pipeline report` prints the 90-day settled record per sport
(hit rate, value-bet ROI, median CLV, CLV-positive rate). The same numbers fill
`model_track_record.{n_settled, median_clv_90d, track_record}` on every published row, and a sport whose
median CLV is negative over ≥ 50 settled value bets is published as `edge_validated: false` even if its
training gate passed (the CLV veto). The realized CLV is also mirrored into the frontend row's
`predictionData.clv` block.

## Kalshi prices (research)

`snapbet-pipeline kalshi` (also part of `run`, right after `collect`) stores the bid/ask/last price,
volume and open interest of every open Kalshi game-winner market (KXNFLGAME, KXNBAGAME, KXNHLGAME)
in `multisport_kalshi_snapshots`. Each Kalshi game is linked to its `multisport_fixtures` row by team
codes and time; games the books haven't listed yet are stored unlinked and backfilled on a later run.
It only reads public market data (no account, no trading), and a Kalshi failure never stops `run`.
Purpose: compare Kalshi with the no-vig book consensus at the same moment, across many games.

## Cold-start accelerator: `import-csv`

Import last season's finished games (and closing lines, if you have them) so
`train` reaches its minimum on day one instead of weeks from now:

```bash
snapbet-pipeline import-csv --sports americanfootball_nfl --file nfl_2025.csv --source kaggle-nfl-2025 --dry-run
snapbet-pipeline import-csv --sports americanfootball_nfl --file nfl_2025.csv --source kaggle-nfl-2025
snapbet-pipeline sync --sports americanfootball_nfl && snapbet-pipeline train --sports americanfootball_nfl
```

- Columns (case-insensitive, common aliases accepted): `date`, `home_team`, `away_team`, `home_score`,
  `away_score`; optional `home_odds`, `away_odds` (decimal or American), `home_spread`, `total`,
  `spread_home_odds`, `spread_away_odds`, `over_odds`, `under_odds`. Template: `samples/results_template.csv`.
- Team labels are normalised to The Odds API names (`BUF` / `Buffalo` / `Bills` → `Buffalo Bills`) so
  imported history connects to live rows. Unknown labels are **refused and listed** by `--dry-run`;
  fix them with `--team-map map.json` (`{"CSV label": "Canonical Name"}`), never guessed.
- Rows **with** a moneyline become training rows (one consensus snapshot at kickoff − 1h, bookmaker
  `csv:<source>`). Rows **without** odds still import and feed ELO / form / H2H features but cannot be
  trained on. Ties are skipped (2-way label undefined).
- Provenance: synthetic `event_id`s start with `csv-`; `metadata.json` records `n_samples_from_csv`.
  Imported games carry a single snapshot (opening = closing, no drift), so a model trained mostly on
  CSV rows has seen less line-movement signal than live-collected data — the gate still applies.

## Tests

```bash
# unit tests (no DB)
pytest tests/test_consensus.py tests/test_edge.py tests/test_train_policy.py
# full suite incl. the end-to-end run against a local Postgres
TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5433/snapbet_test pytest
```

The integration test replays a **synthetic** 160-game season through every
step and asserts the `MultisportMatch` JSON shapes the app reads. Synthetic
data proves the plumbing, not model quality.

## GitHub Actions

See `.github/workflows/pipeline-*.yml`:

| workflow | schedule | command |
|---|---|---|
| `pipeline-hourly` | `17 * * * *` | `run` (collect, results, sync, predict, settle) |
| `pipeline-nightly-train` | `23 9 * * *` UTC | `sync` + `train`, commits `pipeline/models/` if changed |
| `pipeline-backfill` | manual | `results --days N --ignore-season` |

Secrets required on the repo: `DATABASE_URL`, `ODDS_API_KEY`. The repository is
public, so the workflows never echo payloads; only the JSON summary is printed.

## Odds API budget

One `collect` = one request per in-season sport (3 markets, 1 region). Hourly
for three sports ≈ 2,200 requests/month plus ~2,200 for `results`.
Check the quota headers in each run's output (`_quota.requests_remaining`).
