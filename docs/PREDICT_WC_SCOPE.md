# `/predict-wc` — World Cup Prediction Endpoint Scope

**Status:** Scoping draft (not yet built)
**Author:** SnapBet eng
**Depends on:** `/world-cup` hub family (shipped), `lib/world-cup/*`, existing `/api/predictions/predict` pipeline.

---

## ⚠ Reconciliation with edge-payload v1 (2026-06-12)

The edge pivot (see `docs/EDGE_PIVOT_FRONTEND.md`) **supersedes the hand-rolled
calibration layer (D1) below.** The backend now serves `market`, `value`, `clv`,
and `model_track_record` blocks on both `/predict` and `/predict-wc`, and the
honesty gating is done by `model_track_record.edge_validated` — not by a
SnapBet-side confidence shrink.

What this changes for `/predict-wc`:

- **Drop the custom `applyWCCalibration()` shrink** (§4 below is obsolete). The
  WC/international ELO model is `edge_validated: true` (passed temporal holdout
  +15.3pp), so WC value bets **may render CTAs**. The club V3 model is
  `edge_validated: false` and must never render as a pick.
- **`/predict-wc` becomes a thin pass-through**: call the backend, persist the
  prediction + the four edge blocks, mark `source:'predict-wc'`. The endpoint
  does **not** transform confidence.
- **The scope guard (§1.1) still applies** — refuse non-WC leagues.
- **Storage**: persist `market`/`value`/`clv`/`model_track_record` alongside
  `predictionData` so the WC pages + `/performance` can read edge directly.
  Recommend a nullable `edgeData Json?` column on `QuickPurchase` (or reuse
  `predictionData` if the backend already nests them there — confirm shape).
- Sections 1–3, 5–9 below stand. **Section 4 (calibration) is withdrawn.**

---

## 0. Two decisions this scope assumes (override if wrong)

The build forks on two questions. Defaults chosen below; both are isolated so flipping either is a small change.

| # | Decision | Default assumed | Why | If you flip it |
|---|----------|-----------------|-----|----------------|
| **D1** | How predictions are generated | **Reuse existing bet-genius `/predict` backend by `match_id`, plus a thin SnapBet-side calibration layer** for national teams | Honors the "club-trained model, don't overclaim" stance already baked into the WC pages. Calibration is opt-in via a flag — ship plain reuse first, enable later. | If the backend gets a dedicated WC model path, only `callBackendWC()` changes. If no calibration wanted, leave `WC_CALIBRATION_ENABLED=false`. |
| **D2** | Where WC fixtures + match ids come from | **Existing `/market` feed (primary)** + **manual/admin seeding (pre-tournament fallback)** | Lowest friction, matches how every other fixture flows. Zero WC rows exist today, so a seed path is needed until the real feed lights up near June. | If a separate WC source/sync is required, add one ingest cron; `/predict-wc` itself is unaffected (it only consumes `MarketMatch.matchId`). |

---

## 1. What `/predict-wc` is

A POST API route — **`/api/predictions/predict-wc`** — that takes a World Cup match id and produces + persists a prediction for it, mirroring `/api/predictions/predict` but with three WC-specific guarantees:

1. **Scope guard** — refuses to run on a match whose `league` is not a World Cup alias (`isWorldCupLeague()`), so WC predictions can't be accidentally generated for club fixtures and vice-versa.
2. **National-team calibration (D1)** — an optional post-processing layer that discounts confidence and re-tiers the pick before storing, reflecting the higher uncertainty of international fixtures.
3. **WC provenance** — stores a `source: 'predict-wc'` marker on the written model JSON so the tracker, audit, and `/performance` can segment World Cup picks from club picks.

It is **API-first**. WC pages and the match page call it (or read what it already wrote); there is no new user-facing page — `/match/[slug]` continues to render the stored prediction.

### Why a separate endpoint at all (vs. reusing `/predict`)

- **Isolation of the calibration / overclaim risk.** WC picks carry different risk; keeping them on a distinct route means the calibration logic, gating thresholds, and any future dedicated backend model never touch the battle-tested club path.
- **Clean segmentation.** A distinct `source` + route makes "World Cup tracker vs club tracker" trivial in `/performance` and the audit scripts.
- **Future-proofing D1.** If the backend later exposes a real WC model, we swap one function; club predictions are untouched.

---

## 2. Request / response contract

### Request
```
POST /api/predictions/predict-wc
Authorization: Bearer ${CRON_SECRET}        # OR admin session (same dual-gate as /predict)
Content-Type: application/json

{ "match_id": 123456, "force"?: boolean }
```
- `match_id` — the external id (`MarketMatch.matchId`). Same semantics as `/predict`.
- `force` — bypass the QuickPurchase cache and re-call the backend.

### Response (mirrors `/predict`)
```jsonc
{
  "success": true,
  "data": { /* same predictions/analysis/match_info shape as /predict */ },
  "wc": {
    "calibrated": true,                 // D1 layer ran
    "rawConfidence": 0.71,              // backend's number
    "calibratedConfidence": 0.62,      // what we stored
    "group": "F"                        // resolved from the WC registry, when both teams map
  },
  "message": "World Cup prediction generated and saved"
}
```

### Error cases
| Condition | Status | Body |
|-----------|--------|------|
| `match_id` missing/non-numeric | 400 | `{ success:false, error:'match_id required' }` |
| Match not found in `MarketMatch` | 404 | `{ success:false, error:'Match not found' }` |
| Match exists but **not** a WC league | 422 | `{ success:false, error:'Not a World Cup fixture' }` |
| Backend call fails after retries | 502 | `{ success:false, error:'Prediction service unavailable' }` |

---

## 3. Data flow

```
caller (WC page / match page / cron / admin)
   │  POST { match_id }
   ▼
/api/predictions/predict-wc
   │ 1. load MarketMatch by matchId            ──► 404 if missing
   │ 2. isWorldCupLeague(match.league)?        ──► 422 if not WC
   │ 3. cache check: QuickPurchase.predictionData fresh & !force ──► return cached
   │ 4. callBackend(match_id)  (D1: same /predict + /predict-v3 fallback)
   │ 5. WC_CALIBRATION_ENABLED? applyWCCalibration(prediction)
   │ 6. persist:
   │      • QuickPurchase: predictionData, confidenceScore, lastEnrichmentAt=now, premium* …
   │      • MarketMatch.v3Model = { pick, confidence(calibrated), probs, source:'predict-wc', conviction_tier }
   │ 7. respond { data, wc:{…} }
   ▼
DB (MarketMatch + QuickPurchase)  ──read──►  /world-cup/*, /match/[slug], /performance
```

Steps 1, 3, 4, 6 are lifted almost verbatim from `/api/predictions/predict/route.ts`. Steps 2 and 5 are the only net-new logic.

---

## 4. National-team calibration (D1 layer)

A pure, unit-testable function so it's auditable and easy to tune:

```ts
// lib/world-cup/calibration.ts
export interface WCCalibrationResult {
  confidence: number          // calibrated 0..1
  convictionTier: string      // possibly downgraded
  applied: boolean
}

export function applyWCCalibration(
  raw: { confidence: number; convictionTier: string; pick: string },
  ctx: { group?: string; kickoffDate: Date; now: Date }
): WCCalibrationResult
```

Initial rules (deliberately conservative, all tunable constants):
- **Global shrink** — pull confidence toward 0.5: `c' = 0.5 + (c - 0.5) * SHRINK` with `SHRINK = 0.85`.
- **Early-tournament penalty** — extra shrink for group-stage matches in the first ~10 days (least national-team form data): additional `×0.92`.
- **Tier downgrade** — if calibrated confidence drops below the premium gate, downgrade `conviction_tier` so it can't surface as a premium WC pick on thin evidence.
- Constants live in one block; `WC_CALIBRATION_ENABLED` env flag gates the whole layer (default **off** for v1 so we can ship reuse first and turn calibration on deliberately).

This directly operationalizes the transparency stance already written into the WC page copy.

---

## 5. Auth & middleware

- Add `/api/predictions/predict-wc` to `cronEndpoints` in `middleware.ts` (same dual-gate behavior as `/predict`: Bearer `CRON_SECRET` **or** admin session falls through).
- `/api/predictions/*` is already under `adminPaths`, so the admin-session path is covered with no extra change.

---

## 6. Integration points

| Surface | Change |
|---------|--------|
| `/world-cup`, `/world-cup/group/[letter]`, `/world-cup/team/[country]` | No change to render path — they already read `v3Model` via `wcFixtures()`. Once `/predict-wc` writes WC `v3Model`s, fixtures light up automatically. |
| `/match/[slug]` (WC fixtures) | When the stored prediction's `source==='predict-wc'`, optionally show a small "International fixture — confidence calibrated" note (reuses existing transparency copy). |
| `/admin/matches` | Add a **"Predict WC"** action (or auto-route: if `isWorldCupLeague(match.league)`, the existing Predict button calls `/predict-wc` instead of `/predict`). |
| Premium tracker / `/performance` | `source:'predict-wc'` lets the capture cron + audit segment WC picks. Recommend a separate "World Cup" filter rather than blending into club ROI. |
| Cron | New `/api/cron/predict-wc-scheduled` (mirrors the existing predict refresh cron) that walks UPCOMING WC fixtures within a window and calls `/predict-wc`. Heartbeat: `predict-wc:refresh`. Gated behind D2 (only useful once fixtures exist). |

---

## 7. Files

| File | Action |
|------|--------|
| `app/api/predictions/predict-wc/route.ts` | **NEW** — the endpoint. ~70% copied from `predict/route.ts`; adds WC guard + calibration hook + `source` marker. |
| `lib/world-cup/calibration.ts` | **NEW** — `applyWCCalibration()` pure helper + constants + env flag. |
| `lib/world-cup/predict-client.ts` | **NEW (thin)** — `callBackendWC(match_id)` wrapping the same bet-genius `/predict` + `/predict-v3` fallback. Single seam for D1 if a dedicated WC model arrives. |
| `__tests__/unit/wc-calibration.test.ts` | **NEW** — shrink math, early-tournament penalty, tier downgrade, flag-off passthrough. |
| `middleware.ts` | Add route to `cronEndpoints`. |
| `app/admin/matches/page.tsx` | Route WC matches' predict action to `/predict-wc` (or add a button). |
| `app/api/cron/predict-wc-scheduled/route.ts` | **NEW (D2-gated)** — scheduled WC refresh. |
| `vercel.json` | Cron entry for the above (deferred until fixtures exist). |
| `lib/cron-heartbeat.ts` interval map | Register `predict-wc:refresh`. |

---

## 8. Phasing

- **Phase 1 — endpoint (½ day).** Route + WC guard + `source` marker + middleware. Calibration flag **off** (pure reuse). Unit + manual test against a seeded WC fixture.
- **Phase 2 — calibration (½ day).** `applyWCCalibration()` + tests; flip flag on after eyeballing real numbers.
- **Phase 3 — admin + cron (½ day).** Admin routing, scheduled refresh, heartbeat. Only meaningful once D2 produces fixtures.
- **Phase 4 — tracker segmentation (½ day).** WC filter on `/performance` + audit, keyed on `source:'predict-wc'`.

---

## 9. Verification

- Seed one WC `MarketMatch` (real or placeholder id) → `POST /predict-wc {match_id}` → 200, `MarketMatch.v3Model.source === 'predict-wc'`, `QuickPurchase.lastEnrichmentAt` set.
- `POST /predict-wc` against a **club** match id → 422.
- Flag on: stored `confidence` < backend `rawConfidence`; `wc.calibrated === true`.
- `/world-cup/group/<that group>` now shows the fixture's pick badge.
- `npx jest __tests__/unit/wc-calibration.test.ts` green.

---

## 10. Open questions (surface before Phase 2/3)

1. **D1 confirmation** — is the bet-genius backend returning meaningful numbers for WC `match_id`s today, or do we wait for a dedicated WC model? (Affects whether calibration is a stopgap or permanent.)
2. **D2 confirmation** — will the `/market` feed carry WC fixtures, or do we need a dedicated WC fixtures sync? (Affects Phase 3 cron + whether we build an admin seeder.)
3. **Premium WC picks** — do we *ever* surface a WC pick as premium during the group stage, or hold all WC picks to "informational only" until the knockouts? (Product call; calibration tier-downgrade can enforce either.)
4. **Placeholder draw** — the registry draw in `lib/world-cup/tournament.ts` is provisional. Real FIFA draw must replace it before any of this is advertised.
