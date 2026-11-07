# Return to service — PR list (NFL + NBA/NCAAB, no Replit)

**Date:** 2026-11-07 · **Supersedes** the "redeploy Replit" steps in `MULTISPORT_REVIVAL_PLAN.md` §3.
**Decision taken:** Replit (backend + its Postgres) is gone for cost reasons. Compute moves to
GitHub Actions and/or a laptop; all state lives in the frontend's Neon Postgres. The prediction
pipeline now lives in **this repo** under `pipeline/` (Python), which also answers "unify the repos".

```
GitHub Actions (hourly / nightly)  or  laptop
   └─ pipeline/ (Python)  ──►  frontend Postgres  ◄──  Next.js on Vercel (reads only)
        The Odds API ──┘
```

## Owner actions (not PRs, needed before anything shows on the site)

1. **The Odds API key + plan.** Hourly collection for 3 sports ≈ 4.4k requests/month incl. results.
   The free tier (500/month) is not enough; the first paid tier is. Confirm `daysFrom` limit for scores.
2. **GitHub secrets** on `onjoroge1/ai-bet`: `DATABASE_URL` (the Neon URL Vercel uses, with
   `sslmode=require`), `ODDS_API_KEY`. Optional repo variable `PIPELINE_SPORTS`.
3. After PR-1 merges: run workflow `pipeline-backfill` (days=30) once, then `pipeline-hourly`
   manually, then check `snapbet-pipeline status` output in the run log.
4. Decide soccer's fate (PR-6) and whether to archive `BetGeniusAI` (PR-7).

## The PRs, in order

### PR-1 — `pipeline/`: collect · results · train · predict · publish (this branch) ✅ built
Branch `claude/football-basketball-odds-api-cio966`.
- Python package ported from BetGeniusAI (collector, results, 46-feature builder, LightGBM trainer,
  2-way edge math) rewritten to run as idempotent batch commands against the frontend DB.
- `sql/001_multisport_tables.sql` recreates the six backend tables (they only ever existed on Replit).
- **Automated training**: `train` runs on a policy (≥20 new finished games or model >7 days old),
  refuses below the per-sport minimum, and writes an **honesty gate** (`edge_gate`) comparing
  out-of-fold accuracy with "pick the consensus favorite". `edge_validated` can only come from there.
- **Publish** upserts `MultisportMatch` rows in the exact JSON shapes the app already reads
  (`odds.consensus`, `model.predictions`, `predictionData` with `market/value/clv/model_track_record`).
  Cold start publishes market data with `model = null`.
- Workflows: `pipeline-hourly` (run), `pipeline-nightly-train` (sync + train, commits `pipeline/models/`),
  `pipeline-backfill` (manual).
- Tests: 24 passing — unit (consensus, edge contract, gate) + an end-to-end replay of a synthetic
  160-game season on a real Postgres 16 (collect → results → sync → train → predict → publish → settle).
- **Not proven here:** a live call to The Odds API (host blocked in this sandbox) and a write to the
  real Neon DB. First real run = `pipeline-backfill` + `pipeline-hourly` after secrets are set.

### PR-2 — web: DB-only multisport routes + NFL wiring + cold-start rendering ✅ built (NBA + NFL only)
Scope decision 2026-11-07: concentrate on **NBA and NFL**. NCAAB/NHL stay defined in the registry
(`display: false`) so old rows and links keep working, but are off the selector, homepage and pipeline defaults.
- New `lib/multisport/sports.ts` registry (keys = The Odds API sport_keys = `pipeline/config.py`);
  every UI list reads from it.
- `app/api/multisport/{sports,market,predict}/route.ts`: read `MultisportMatch` only; backend proxy
  and fallbacks deleted (the old `predict` returned 500 "Backend not configured" before checking its cache).
- NFL wired: selector, homepage tabs (NBA · NFL · Soccer, default NBA), `/sports` default NBA,
  `/nfl` + `/nfl/today` + `/nfl/tomorrow` hubs, footer link, team-stats slug prefix, blog generator,
  social scheduler, admin leaderboard/training-status/matches.
- Cold-start UI: `SportMatchCard` shows "Market line only" under the odds bar; the event page swaps the
  confidence ring for a "Market line only" badge, titles the card "Market Probabilities", hides the pick
  row and shows the honesty status instead of model info. Selector tabs get a "Market only" badge.
- Removed the superseded `/api/admin/multisport/sync` route and its `vercel.json` cron.
- Tests: `__tests__/unit/multisport-sports.test.ts`, `__tests__/integration/multisport-api.test.ts`
  (routes against a mocked Prisma: DB-only, cold-start payloads, 400/404, stale flag).
- Acceptance still to observe in production: `/sports` shows NFL rows written by PR-1 once secrets are set.

### PR-3 — picks engine + WhatsApp: NFL/NHL, cold-start gate, edge-first value picks ✅ built
Scope update 2026-11-07: **NHL retained** alongside NBA and NFL (registry `display: true`, pipeline
default sports, homepage tab, WhatsApp commands). NCAAB remains defined but hidden.
- `lib/premium-picks-engine.ts`: multisport picks iterate the registry; new pure
  `evaluateMultisportPick(sport, row)` — (0) no model block → never a pick; (1) an edge-validated
  `value_bet` in `predictionData` → 'value' pick on the bet outcome at the best price (Criterion 0
  mirror; only the pipeline's honesty gate can enable it); (2) otherwise the per-sport confidence
  buckets. NFL gates are **provisional** (≥0.65 standard, ≥0.75 strong favourite, never premium,
  no underdog calls) and labelled so in the reasons until the alpha analysis covers NFL.
- `lib/whatsapp-multisport-picks.ts`: `SPORT_CONFIG` from the registry (NBA/NFL/NHL commands),
  `hasModel` on each pick, cold-start formatting ("Market line only — no NFL model pick yet"),
  honesty + value-bet lines in VIP analysis. Webhook command parsing is now registry-driven; help
  text swaps NCAAB for NFL.
- `components/snapbet-picks/SnapBetPicksSection.tsx` tabs from the registry.
- `scripts/multisport-alpha-analysis.ts` (`--sport nba|nfl|nhl|ncaab`) and
  `scripts/full-sport-performance-audit.ts` include NFL.
- Tests: `__tests__/unit/premium-picks-engine-multisport.test.ts`,
  `__tests__/unit/whatsapp-multisport-picks.test.ts`.
- Still to observe: the first real NFL alpha analysis once ≥50 settled NFL games exist; replace the
  provisional gates with measured ones.

### PR-4 — pipeline: cold-start accelerator (data import)
NFL reaches 120 games in ~9 weeks from zero, which is most of the remaining season. Options, in
order of preference: (a) The Odds API **historical** endpoint for last season's odds + `/scores`
(paid add-on, verify on the dashboard); (b) `snapbet-pipeline import-csv` for a public
odds+results CSV (document provenance; results-only rows still feed ELO/form features).
Acceptance: `status` shows `training_rows ≥ min` for NFL and NBA; `train --dry-run` says "would train".

### PR-5 — pipeline: closing line + CLV settlement (edge plan Phase B)
- At first `results` after a game: store the last pre-game consensus as `closing_odds`; for rows that
  had a `value_bet`, compute `realized_clv = bet_odds / closing_odds − 1`; write into
  `predictionData.clv` and roll `median_clv_90d` / `n_settled` into `model_track_record`.
- Acceptance: `clv` block non-null on settled rows; CLV history visible in `/predict-multisport/results`
  equivalents (`/api/admin/multisport/reports`).

### PR-6 — web: soccer demotion / cron budget (product decision)
Turn off or slow the per-minute soccer live sync, reorder the homepage, hide soccer from the picks
engine. Everything soccer still points at the dead Replit backend, so today those crons fail silently;
at minimum they should be disabled to stop error noise. Needs your call on how far to go.

### PR-7 — repo: unification cleanup
- Archive `onjoroge1/BetGeniusAI` on GitHub with a README pointer here; copy its still-relevant docs
  into `docs/legacy-backend/`.
- Delete or feature-flag frontend routes that only proxied the backend (`/api/predictions/*`,
  `/api/parlays/*`, `/api/premium/*` CLV calls, live-edge proxies) so the app has no dead upstreams.
- Remove `BACKEND_API_URL` / `NEXT_PUBLIC_MARKET_KEY` from `env.example` and Vercel.

### PR-8 — ops: pipeline health on `/admin`
- Read `multisport_pipeline_runs` into the existing CronHeartbeat panel; alert (email/Twitter summary
  off) when an in-season sport has no snapshot for >3h or the nightly train errored.

## What this does *not* fix
- **No model until data accumulates.** PR-1 ships a site that shows market lines and probabilities,
  honestly labelled. Picks return when `train` passes its minimum and the gate decides what's
  actionable. PR-4 is how to shorten that.
- Soccer, parlays, player props, Live Edge, CLV club: all still wired to the dead backend. They are
  out of scope for the pivot and are addressed by PR-6/PR-7 only to the extent of switching them off cleanly.
