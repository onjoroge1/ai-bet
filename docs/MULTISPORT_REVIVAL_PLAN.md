# Revival Plan — Pivot to NFL + NBA (2-way markets)

**Date:** 2026-11-07 · **Status:** assessment, nothing deployed yet
**Scope:** what has to happen before the site serves fresh football (NFL) and basketball (NBA / NCAAB) predictions again, and whether a new odds API is actually needed.

Everything below was verified against the two repos on 2026-11-07:
`onjoroge1/ai-bet` (this repo, Next.js frontend, Vercel) and `onjoroge1/BetGeniusAI`
(FastAPI backend, Replit autoscale). Items marked **ASSUMED** were not verifiable
from this session (the Replit host and the-odds-api.com are outside its network allowlist).

---

## 1. The short version

- **We do not need a new odds API.** The backend already pulls NFL, NBA, NCAAB and NHL
  odds (h2h, spreads, totals, 12 US books) from **The Odds API** via `ODDS_API_KEY`.
  Soccer is the only sport that also leans on RapidAPI / API-Football. Keep The Odds API;
  the open question is only whether the current plan's request quota covers the cadence we want.
- **Everything 2-way is already plumbed end to end**: backend collector → `multisport_fixtures` /
  `multisport_odds_snapshots` → `multisport_training` → per-sport LightGBM (`train_multisport_v3.py`)
  → `POST /predict-multisport` + `GET /predict-multisport/available` → frontend
  `/api/multisport/*` → `MultisportMatch` table → `/sports/[sport]`, `/nba`, picks engine, WhatsApp.
- **The real blockers are operational, not architectural:**
  1. The backend has been dormant since 2026-06-14 (Replit autoscale). Is it up? Is the Neon
     Postgres still there (it was near 6 GB and climbing)? Are the secrets still set?
  2. **The trained V3 multisport models are not in git.** `artifacts/models/v3_basketball`,
     `v3_hockey`, `v3_football` are loaded from disk by `multisport_v3_predictor.py`, but only
     `v2_basketball` is committed. If the Replit filesystem was lost, the models must be retrained
     from `multisport_training` before any prediction endpoint returns anything.
  3. **NFL has never been exposed to the frontend.** The backend supports
     `americanfootball_nfl` (`_SUPPORTED_MULTISPORT`, collector, training config, `/market-multisport`),
     but every frontend sport list is hardcoded to `basketball_nba | icehockey_nhl | basketball_ncaab`
     across ~21 files. There is no evidence an NFL model was ever trained.
  4. Multisport **training is manual** — nothing in `utils/scheduler.py` or `jobs/auto_retrain.py`
     calls `train_multisport_v3.py`. Soccer has auto-retrain; US sports do not.

---

## 2. What exists today (verified)

### Backend — `onjoroge1/BetGeniusAI` (default branch, last commit 2026-06-14)

| Piece | File | State |
|---|---|---|
| Odds collector (NBA/NCAAB/NHL/NFL/MLB/Euroleague) | `models/multisport_collector.py` | The Odds API `/v4/sports/{key}/odds`, `regions=us`, `markets=h2h,spreads,totals`, decimal. Season-gated by month. Hourly via scheduler (`multisport_odds`). |
| Results collector | `models/multisport_data_collector.py` | The Odds API `/scores`. Hourly (`multisport_results`), 2-hourly (`multisport_data`). |
| Season backfills | `scripts/backfill_nfl.py`, `scripts/backfill_ncaab.py` | Step-down `daysFrom` 90→1 depending on plan. |
| Training-data sync | `training/multisport_training_sync.py` | Builds 30 odds-derived features per finished game into `multisport_training`. |
| Trainer | `training/train_multisport_v3.py --sport {basketball_nba,icehockey_nhl,americanfootball_nfl,all}` | LightGBM binary. `min_samples`: NBA 150, NHL 150, NFL 120. Writes `lgbm_model.txt`, `features.json`, `metadata.json`. **Not scheduled; artifacts not committed.** |
| Predictor | `models/multisport_v3_predictor.py` | Loads per-sport dir; NCAAB and Euroleague fall back to the NBA model. Returns `None` if no model file → endpoints degrade (`available` returns fixtures with `model_pick: null`; `predict-multisport` returns 503). |
| Endpoints | `main.py` ~L8084–8550, `routes/multisport_market.py` | `POST /predict-multisport`, `GET /predict-multisport/available?sport=`, `GET /predict-multisport/results`, `GET /market-multisport`. Auth: `Authorization: Bearer $BETGENIUS_API_KEY`. |
| Edge / honesty | `utils/edge.py` `MODEL_REGISTRY` | `v3_multisport_basketball/hockey/baseball/football` registered with `edge_validated: False`. `scripts/validate_multisport_holdout.py` is the gate (needs n≥100 per sport). |
| Pending work | `PENDING.md`, branch `claude/gallant-roentgen-016375` | Mostly merged — only 8 small files still differ from main. P2 item "run per-sport holdout gates" is open. |

Secrets the backend needs (from code, not `.env.example`, which is stale):
`DATABASE_URL`, `ODDS_API_KEY`, `RAPIDAPI_KEY` (soccer only), `OPENAI_API_KEY` (AI analysis text),
`BETGENIUS_API_KEY`, Redis (local on Replit), optional `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`
for the cold-archive job.

### Frontend — this repo

| Piece | File(s) | State |
|---|---|---|
| Proxy routes | `app/api/multisport/{sports,market,predict}/route.ts` | Call the backend, cache in `MultisportMatch`. Sport list hardcoded (no NFL). |
| Cron sync | `app/api/admin/multisport/sync/route.ts` (vercel: `0 */2 * * *`) | Upserts fixtures/results, fetches predictions ≤6h old. `SPORTS` hardcoded (no NFL). |
| DB | `prisma/schema.prisma` → `MultisportMatch` | Sport is a free string; `odds`/`spread`/`totalLine`/`model`/`predictionData` JSON. **No schema change needed for NFL.** |
| UI | `app/sports/page.tsx`, `components/multisport/*`, `lib/multisport-hubs/data.ts`, `/nba`, `/nhl` | 2-way cards, hubs. No `/nfl` hub. |
| Picks / premium | `lib/premium-picks-engine.ts`, `lib/whatsapp-multisport-picks.ts`, `lib/predictions/*` | Per-sport confidence gates derived from `scripts/multisport-alpha-analysis.ts` (NBA favours premium-conviction favourites; NHL sweet spot 0.65–0.75). No NFL branch. |
| Edge UI | `lib/edge/*`, `components/edge/*` | Already handles `draw`-absent payloads. Renders probabilities + market panel until backend serves `edge_validated: true`. |
| Soccer pipeline | `/api/admin/market/sync-scheduled` (every minute for live), parlays, additional markets | Still the bulk of the cron budget. Can be left on or throttled — a product decision. |

---

## 3. Steps to get fresh predictions (in order)

### Step 0 — Find out what's still alive (owner, ~30 min)
1. Hit `https://bet-genius-ai-onjoroge1.replit.app/health` and
   `/predict-multisport/available?sport=basketball_nba` with the bearer key.
   Three outcomes: (a) 200 with fixtures + `model_pick` → models survived, skip to Step 3;
   (b) 200 with `model_pick: null` → DB alive, models gone, do Step 2;
   (c) connection refused / 5xx → redeploy first (Step 1).
2. Confirm the Neon database answers and check `SELECT sport_key, count(*) FROM multisport_training GROUP BY 1`
   and the same for `multisport_fixtures` / `multisport_odds_snapshots` in the last 30 days.
   This tells us how much training data each sport already has.
3. Log in to The Odds API dashboard: plan, monthly quota, requests used. Hourly odds pulls for
   NFL + NBA + NCAAB + NHL at 3 markets/1 region is on the order of 4 sports × 24 h × 30 d × ~3 = ~8.6k
   request-credits/month before results calls (**ASSUMED** credit accounting — verify on the dashboard).

### Step 1 — Bring the backend back (if down)
- Redeploy `main` on Replit (or wherever we land after §5). Re-set the secrets above.
- Rotate the leaked SportsData key noted in `PENDING.md` if not already done.
- Confirm the scheduler log shows `MULTISPORT: Starting odds collection...` within an hour.

### Step 2 — Models
- Backfill the current seasons so training has enough rows:
  `python scripts/backfill_nfl.py --days 90` (NFL season started September; ~130 games so far ≈ `min_samples` 120 — borderline, may need last season's data too),
  `python scripts/backfill_ncaab.py --days 90`, and run `multisport_training_sync.sync_training_data()`.
- Train: `python training/train_multisport_v3.py --sport all`. Expect NFL to be the weakest
  (one game per team per week → tiny n, high variance). NBA should train cleanly.
- **Commit the artifacts** (`artifacts/models/v3_*/`) or push them to object storage so a Replit
  disk loss can't erase them again. `.gitignore` only excludes `*_backup_*` dirs, so this is just
  `git add`.
- Run `scripts/validate_multisport_holdout.py --sport <key>`. Leave `edge_validated: false`
  until it passes; the frontend already copes.
- Add a scheduler task (weekly) that re-runs sync + train per sport. Today nothing does.

### Step 3 — Frontend: add NFL, re-point defaults
Small, mechanical, no schema change:
- Add `americanfootball_nfl` to the sport lists in: `app/api/multisport/sports/route.ts`,
  `app/api/multisport/market/route.ts` (`getSportName`), `app/api/admin/multisport/sync/route.ts`
  (`SPORTS`, `daysLookback`), `components/multisport/SportSelector.tsx` (`DISPLAY_SPORTS`, `SPORT_CONFIG`),
  `lib/premium-picks-engine.ts` (new `'nfl'` branch with a conservative gate until alpha analysis exists),
  `lib/whatsapp-multisport-picks.ts`, `lib/team-stats/slug.ts` + `multisport-cron-impl.ts`,
  `lib/blog/multisport-blog-generator.ts`, `app/api/admin/social/multisport/scheduled/route.ts`,
  `lib/multisport-hubs/data.ts` + a `/nfl` hub page mirroring `/nba`.
- Change the `/sports` default tab from `soccer` to `basketball_nba` (or NFL on Sundays).
- Extend `scripts/multisport-alpha-analysis.ts` and `full-sport-performance-audit.ts` to include NFL
  once ≥50 settled games exist; set the picks gate from that, not from a guess.
- Tests: extend `__tests__/unit/edge.test.ts` (2-way already covered) with an NFL fixture through
  `lib/multisport-hubs/data.ts` and the picks-engine gate.

### Step 4 — Decide what happens to soccer
Not required for new predictions, but the cron budget and the homepage are soccer-first.
Options: leave as is; demote soccer to a secondary tab; or disable the per-minute live sync.
This is a product call.

---

## 4. Odds API — recommendation

Keep **The Odds API**. Reasons: it is the only source the multisport pipeline knows; sport keys,
event IDs, and the `multisport_odds_snapshots` schema are built around it; it covers NFL/NBA/NCAAB
with the same 12 US books; and the backfill scripts already handle its `daysFrom` plan limits.
What to check rather than replace: the plan tier (quota vs. hourly cadence across 4 sports), and
whether we want `regions=us,us2` for more books. Only consider a second provider for live/in-play
US odds, which The Odds API covers less well (**ASSUMED**; verify on their docs).

---

## 5. Unifying the repos

Two repos, two runtimes (Node/Next.js on Vercel, Python/FastAPI on Replit), one shared contract
(the JSON shapes in `lib/edge/types.ts` ↔ `utils/edge.py`, and `MultisportMatch` ↔ `multisport_*` tables).
A monorepo is reasonable and low-risk if done as a *move*, not a rewrite:

```
snapbet/
  apps/web/      ← this repo, unchanged (Vercel "Root Directory" = apps/web)
  apps/api/      ← BetGeniusAI, unchanged (.replit run → cd apps/api && python main.py)
  packages/contracts/   ← later: shared JSON schemas for /predict-multisport etc.
  docs/
```

Do it with `git subtree add` (or `git filter-repo` to keep history) so neither history is lost.
Immediate wins: one place for docs and plans, one PR per feature across both sides, shared contract
tests (`tests/edge/test_multisport_payload.py` ↔ `scripts/qa-edge-contract.ts`). Costs: Replit and
Vercel both need a root-directory setting; CI (none today) would need per-app jobs.
**Recommendation:** do Steps 0–3 first in the two repos as they are — the pipeline is already wired
and we want predictions flowing — then unify once the backend is confirmed healthy, so we are not
debugging deployment and repo surgery at the same time.

---

## 6. Open questions for the owner

1. Is the Replit deployment and the Neon DB still running / paid for?
2. Which The Odds API plan are we on (quota)?
3. Do we keep soccer live, demote it, or switch it off?
4. Is the target "football" NFL only, or NFL + NCAAF? (`americanfootball_ncaaf` exists at the
   provider but nothing in either repo supports it yet.)
5. Replit vs. another host for the backend going forward? (`PENDING.md` flags Replit cost as unresolved.)
