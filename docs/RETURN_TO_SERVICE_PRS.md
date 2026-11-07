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

### PR-4 — pipeline: cold-start accelerator (CSV import) ✅ built
NFL reaches 120 games in ~9 weeks from zero, which is most of the remaining season. Decision
2026-11-07: build the **CSV path first** (no plan dependency); The Odds API historical endpoint can
be added later as a second source behind the same tables.
- `snapbet-pipeline import-csv --sports <key> --file games.csv [--source name] [--team-map map.json] [--dry-run]`
  writes finished games into `multisport_fixtures` / `multisport_match_results` / `multisport_schedule`
  and, when the row has a moneyline, ONE consensus snapshot at kickoff − 1h (bookmaker `csv:<source>`).
  `sync` + `train` then work unchanged.
- Team labels are normalised to The Odds API names via `snapbet_pipeline/teams.py` (32 NFL, 30 NBA,
  32 NHL franchises: codes, cities, nicknames, relocations). Unknown labels are refused and listed by
  `--dry-run`; a `--team-map` JSON fixes them. Nothing is guessed.
- Provenance: synthetic `event_id`s start with `csv-`; `metadata.json` gains `n_samples_from_csv`.
  Documented caveat: imported games have a single snapshot (no line movement), ties are skipped,
  odds-less rows feed ELO/form/H2H but are not training rows.
- Tests: parsing (aliases, American odds, normalisation, tie/unmapped handling, deterministic ids) and
  an end-to-end import → sync → train on a 144-game CSV using real NFL names.
- **Owner action:** source a results+closing-line CSV for NFL 2025 (and NBA/NHL 2025-26 to date), run
  `--dry-run`, fix any unmapped labels, import, then `train`. Record the CSV's origin in `--source`.
- Later: `import-odds-api-history` for plans with the historical endpoint (same tables, real snapshots).

### PR-5 — pipeline: pick ledger, closing line + realized CLV ✅ built
- `multisport_pick_ledger` (sql/002): per (sport, event) — model pick + market prob at FIRST publish,
  value bet + `bet_time_odds`/book/EV at the FIRST publish that carried one (never overwritten),
  `publish_count`; at settlement the closing consensus (last snapshot ≤ kickoff, else latest, flagged),
  result, pick/value-bet won, 1u P&L, `realized_clv = bet_time_odds × closing_prob − 1`.
- `publish` writes the ledger; `settle` settles it and mirrors `bet_time_odds / closing_odds /
  closing_prob / realized_clv` into `MultisportMatch.predictionData.clv` (the block
  `lib/edge/extract.ts` already reads).
- `ledger.track_record()` (90d) fills `model_track_record.n_settled`, `median_clv_90d` and a
  `track_record` sub-block on every published row. **CLV veto:** median CLV < 0 over ≥ 50 settled value
  bets publishes `edge_validated: false` even when the training gate passed.
- New `snapbet-pipeline report` command. Tests: bet-time lock across re-publishes, settlement maths,
  frontend mirror, finality after settlement, cold-start rows, veto thresholds.
- Not in scope: frontend rendering of `track_record` (PR-8 admin panel) — the data is already in the row.

### PR-4b — pipeline: `import-odds-api-history` (second cold-start source) — proposed
The Odds API historical endpoint (`/v4/historical/sports/{key}/odds?date=`) was validated by the backend
on 2025-11-18 with the then-current plan (40 books; snapshots since 2020). It has no historical scores
(`/scores` is ≤ 3 days), so results would come from API-Sports season endpoints (key existed) or a public
scoreboard feed. Builds on the same tables as `import-csv`; real multi-snapshot odds instead of a single
closing line. Needs: confirm the current plan includes historical access and its credit multiplier.

### PR-6 — web: soccer demotion / cron budget ✅ step 1 built (dead crons disabled)
Decision 2026-11-07: minimal safe step only — take every cron that depends on the retired Replit
backend off the Vercel schedule. Nothing else about soccer changes yet.
- Removed from `vercel.json` (routes kept on disk so they can be re-enabled against a new upstream):
  `market/sync-scheduled` ×3 (live every minute, upcoming, completed), `market/zombie-sweep`,
  `clv/sync-scheduled`, `predictions/refresh-progressive`, `parlays/sync-backend-scheduled`
  (→ `/api/parlays` → `lib/parlays/sync`), `predictions/sync-from-availability-scheduled`
  (→ `lib/predictionAvailability` + `/predict`). The multisport sync cron went in PR-2.
- Kept: the 22 DB-only crons (parlay scoring/generation, additional markets, social, blogs, email,
  premium trackers, team stats, settle-saved-bets). They run against whatever is in the DB; the soccer
  ones will simply find nothing new. Worth watching: `social/twitter/*`, `template-blogs`,
  `nightly-briefing` so they do not post stale soccer content — a follow-up if they do.
- Guard: `__tests__/unit/vercel-crons.test.ts` fails if a scheduled cron (or a lib it imports)
  references the backend, or if any of the dead paths is re-added.
- Still open (needs a product call): the soccer tab on `/`, `/sports` and the WhatsApp soccer
  commands still call `/api/market` → backend and show errors; `/api/predictions/*`, `/api/parlays`,
  `/api/premium/*` CLV calls and Live Edge proxies still point at the dead host (PR-7 removes them).

### PR-7 — repo: unification cleanup ✅ code side built (archive click is the owner's)
- `lib/backend-config.ts`: the legacy backend is opt-in only. `BACKEND_URL`/`BACKEND_API_KEY` come from
  env with **no defaults**; `backendUnavailable()` (503 + `paused: true`) and `backendPausedEmpty()`
  (200 + empty shape + `paused: true`) for routes that still proxy it.
- Stripped every hardcoded Replit host (11 routes + `lib/parlays/sync.ts`) and every hardcoded default
  API key (34 files) from `app/`, `lib/`, `scripts/`. Those routes now fail fast when the env is unset
  instead of hanging on a dead host for 15–45s.
- `/api/market` (soccer) returns an empty slate with `paused: true` when no backend is configured, so the
  soccer tab on `/` and `/sports` shows "no matches" rather than an error.
- Deleted backend-only debug surfaces: `app/api/predictions/test-backend`, `scripts/test-backend-parlay-api.ts`,
  `scripts/test-api-response.ts`, `scripts/test-manual-sync.ts`.
- `env.example` / README: backend variables removed (commented, documented as paused); pipeline secrets
  live in GitHub Actions, never the web app.
- `docs/legacy-backend/`: 14 still-relevant backend docs copied verbatim with an index README.
- Guard: `__tests__/unit/backend-config.test.ts` fails on any hardcoded Replit host / default key in
  `app|lib|scripts|components|hooks` or in `env.example`.
- **Owner:** archive `onjoroge1/BetGeniusAI` on GitHub (Settings → Archive) with a README pointer to this repo.
- Deliberately NOT deleted: the soccer/parlay/player-prop/CLV-club/Live Edge routes and pages. They are
  paused via env, not removed, so a future soccer upstream can be wired in without resurrecting code.

### PR-8 — ops: pipeline health on `/admin`
- Read `multisport_pipeline_runs` into the existing CronHeartbeat panel; alert (email/Twitter summary
  off) when an in-season sport has no snapshot for >3h or the nightly train errored.

## What this does *not* fix
- **No model until data accumulates.** PR-1 ships a site that shows market lines and probabilities,
  honestly labelled. Picks return when `train` passes its minimum and the gate decides what's
  actionable. PR-4 is how to shorten that.
- Soccer, parlays, player props, Live Edge, CLV club: all still wired to the dead backend. They are
  out of scope for the pivot and are addressed by PR-6/PR-7 only to the extent of switching them off cleanly.
