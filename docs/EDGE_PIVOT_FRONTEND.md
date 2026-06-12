# Edge Pivot — Frontend Integration Plan

Companion to the backend "Frontend Manual — The Edge Pivot" (contract:
edge-payload v1, 2026-06-12). This doc tracks **what we've built and what's
left**, and how the edge pivot compounds with the World Cup work and
`/predict-wc`.

---

## The one-line why

Stop leading with "we predict Arsenal, 62% confident" (accuracy rewards
copying the bookmaker). Start leading with **edge** — our probability vs the
de-vigged market price — the only number mathematically tied to a bankroll.
The backend now serves both; the frontend leads with edge and demotes raw
confidence to a detail.

**Hard rule (don't soften):** render value bets / parlay legs as actionable
**only when `model_track_record.edge_validated === true`.** Club V3 is
`false` (failed its holdout 45.3% vs 50.9%); WC ELO is `true` (+15.3pp). When
false → show calibrated probabilities as *information*, never a CTA.

---

## How this compounds with the other in-flight work

| Stream | Relationship |
|--------|--------------|
| **World Cup pages** (shipped) | The WC ELO model is `edge_validated: true` → WC fixtures are where actionable value bets actually surface. The edge components are the natural content for `/world-cup` fixture rows + match pages once `/predict-wc` writes edge blocks. |
| **`/predict-wc`** (scoped) | Reconciled: the endpoint becomes a thin pass-through that persists the four edge blocks + `source:'predict-wc'`. The hand-rolled "calibration" is withdrawn — `edge_validated` does that job. See `docs/PREDICT_WC_SCOPE.md` (reconciliation note at top). |
| **Premium tracker / `/performance`** | `clv.realized_clv` becomes the headline honesty metric (§4.5). Segment WC vs club by `source`. |

---

## Status

### ✅ Phase 1 — foundation (shipped, dark)

Additive, zero visual change, fully behind a flag.

- `lib/edge/types.ts` — exact v1 contract types for the four blocks (`market`,
  `value`, `clv`, `model_track_record`) + `EdgeView`, parlay types.
- `lib/edge/helpers.ts` — pure logic: `extractEdge()` (gating collapsed into
  `actionable`/`noValue`/`edgeValidated`), `ratingFromEv()` tiers, `priceGuard()`,
  `displayStakeFraction()` (5% cap), `edgeMeterRows()`, `parlayMetrics()`,
  formatters, math primitives.
- `lib/feature-flags.ts` — `isEdgePivotEnabled()` (`NEXT_PUBLIC_EDGE_PIVOT_MODE`).
- `__tests__/unit/edge.test.ts` — **33 tests green**, covering the 4-case
  nullability matrix, the `edge_validated` gate, rating tiers, price guard,
  stake cap, parlay eligibility (anchor-favorite poison, unvalidated leg, leg
  count), formatters, CLV passthrough.

### ✅ Phase 1.5 — component library (shipped, dark)

Pure, prop-driven components in `components/edge/` (barrel: `components/edge/index.ts`):

| Component | Manual § | Notes |
|-----------|----------|-------|
| `ValueBadge` | 4.1 | Tier-colored chip + EV; renders null when no value bet. |
| `EdgeMeter` | 4.2 | H/D/A paired market-vs-model bars; annotates the value outcome. Works pre-pivot. |
| `PriceGuard` | 4.3 | "Value while ≥ X"; auto-flips to "edge gone" below `min_acceptable_odds`. |
| `StakeSuggester` | 4.4 | Quarter-Kelly default, 5% cap, full-Kelly behind advanced toggle + variance warning. |
| `NoValueState` | 4.6 | Deliberate empty state; `unvalidated` variant for the club/V3 disclosure. |
| `CLVLedgerSummary` / `CLVLedgerRows` / `aggregateCLV` | 4.5 | Beat-the-close rate + avg CLV + per-pick rows. |
| `TrackRecordNote` | 2.4/5 | The honesty line; green check when validated, plain "no demonstrated edge" when not. |

Verified via `app/edge-demo/page.tsx` (internal harness, not linked/sitemapped)
against the §8 worked-example shapes — all render with correct computed values
(e.g. stake `$36.9` = 3.69% quarter-Kelly × $1000 bankroll).

---

## ▶ Remaining work (Phase 2 — wiring, behind the flag)

Each item reads the new blocks and gates on `edge_validated`. Nothing changes
visually until `NEXT_PUBLIC_EDGE_PIVOT_MODE=true`.

1. **Extend the response type** — add the four blocks to the `/predict` response
   type the frontend consumes (`types/api.ts` `FormattedPrediction` /
   `PredictionPayload`) so `extractEdge()` has typed input. Additive; legacy
   fields untouched.

2. **`PredictionCard`** (`components/predictions/PredictionCard.tsx`) — when the
   flag is on and `extractEdge(prediction).market` is present:
   - swap the confidence pill for `ValueBadge`
   - render `EdgeMeter`
   - if `actionable`: `PriceGuard` + `StakeSuggester` + CTA; else `NoValueState`
     (+ `unvalidated` variant when `!edgeValidated`)
   - always render `TrackRecordNote`
   - keep the legacy confidence block behind `!isEdgePivotEnabled()`.

3. **Match lists** (`/matches`, `/soccer/today`, `/world-cup`, homepage picks) —
   add a **"value only" filter, defaulted on** when the flag is enabled; add an
   `ev` sort; show `ValueBadge` per row. Copy: "2 value bets found today (37
   scanned)" not "5 hot picks".

4. **Parlay builder** (`components/parlays/match-selection.tsx`) — leg pool =
   `value_bet != null` from `edge_validated` models only; refuse EV≤0 legs; show
   compounded EV + `fair_odds` vs offered via `parlayMetrics()`; 2–3 leg cap;
   ticket quarter-Kelly. Prefer the backend `utils/edge.parlay_metrics` verbatim
   when a parlay endpoint serves it.

5. **`/predict-wc` endpoint** — build per `docs/PREDICT_WC_SCOPE.md` (reconciled):
   thin pass-through persisting the edge blocks + `source:'predict-wc'`.

6. **Bankroll** (optional, for Stake Suggester money amounts) — add nullable
   `bankroll Decimal?` to `User` + a settings input. Until then `StakeSuggester`
   shows the % only (already handles `bankroll=null`).

7. **CLV ledger surface** — wire `CLVLedgerSummary` into `/performance` +
   `/dashboard/clv`, sourced from settled `clv` blocks (the existing settlement
   sync fills `realized_clv`).

## ▶ Phase 3 — deprecate confidence-led UI

Once Phase 2 is validated with the flag on: retire the confidence pill and any
agreement-based "conviction" badges (agreeing with the market = zero edge);
demote `predictions.recommended_bet` to a debug field.

---

## Nullability matrix (must stay green) — all four occur in prod

| Case | `market` | `value.value_bet` | Render |
|------|----------|-------------------|--------|
| a | null | — | legacy/info only; no edge UI |
| b | present | (no value block) | `NoValueState` + `EdgeMeter` |
| c | present | null | `NoValueState` + `EdgeMeter` |
| d | present | set (+ validated) | full actionable stack |

`extractEdge()` collapses these into `actionable` / `noValue`; the unit tests pin
all four.

---

## Copy guardrails (from the manual §5)

- "Market prices Arsenal at 49% — we make it 54%" — not "we predict Arsenal (62%)".
- "+5.8% EV at 2.10 (bet365) · value at ≥1.85" — not "high confidence ✅".
- "2 value bets found today (37 scanned)" — not "5 hot picks".
- "Our picks beat the close by +2.1% (90d median)" — not "73% accurate".
- Never "guaranteed / lock / can't miss". EV is long-run; single bets lose often.
- Anywhere a club/V3 pick would have shown, the payload says
  `edge_validated: false` → show market info + calibrated probs, **not a pick.
  Do not work around the flag.**
