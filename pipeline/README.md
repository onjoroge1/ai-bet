# Snapbet multisport pipeline (NFL · NBA · NCAAB)

Batch jobs that replace the retired Replit backend for 2-way US sports:

```
The Odds API ──collect──▶ multisport_fixtures / multisport_odds_snapshots
             ──results──▶ multisport_match_results (+ fixture scores/outcome)
                 sync  ──▶ multisport_training (label + 46 leak-safe features)
                 train ──▶ models/<sport_key>/{lgbm_model.txt, features.json, metadata.json}
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

export DATABASE_URL="postgresql://..."        # the Neon URL the Vercel app uses
export ODDS_API_KEY="..."                      # https://the-odds-api.com
export PIPELINE_SPORTS="americanfootball_nfl,basketball_nba,basketball_ncaab"   # default

snapbet-pipeline migrate      # create tables (idempotent; every command also runs it)
snapbet-pipeline collect      # odds snapshot for in-season sports
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
`MAX_MODEL_AGE_DAYS` (7). It refuses to train below `min_train_samples`
(NFL 120, NBA/NCAAB 150). Artifacts are committed back to `pipeline/models/`
by the nightly workflow so a lost runner never loses a model again.

### Honesty gate

Every trained model carries `metadata.edge_gate`: out-of-fold accuracy versus
"pick the consensus favorite" on the same games. `edge_validated` becomes true
only with n ≥ 100 and a ≥ 2pp lead over the favorite. The published
`model_track_record.edge_validated` is read from this; the frontend hides
value-bet CTAs while it is false. Nothing in the pipeline can set it by hand.

## Cold start (right now)

The Replit database is gone, so training sets are empty. From the first
`collect` the site shows market odds and de-vigged probabilities with
`model = null`; models appear automatically once enough games have finished:

| sport | min games | realistic ETA from zero |
|---|---|---|
| NBA | 150 | ~3 weeks of nightly collection |
| NCAAB | 150 | ~1 week (30+ games/day) |
| NFL | 120 | ~8–9 weeks (≈14 games/week) — consider importing last season's odds+results |

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
