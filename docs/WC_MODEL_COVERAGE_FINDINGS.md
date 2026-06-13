# World Cup model-coverage findings (for the backend team)

**Date:** 2026-06-12 · **Reporter:** frontend
**TL;DR:** The WC group pages surfaced a data-pipeline gap — **60 of 72 World Cup
fixtures have no real model run**, so the model "favourite" rankings were nonsense
(e.g. Jordan over Argentina). The frontend now gates its advancement chart on real
model coverage and shows nothing until the predictions land. The backend needs to
run the model on the remaining fixtures and confirm which model is used.

## What we observed

Probed `MarketMatch.v3Model` for all 72 WC fixtures:

| | count |
|---|---|
| Fixtures with a real model source (`v3Model.source` set) | **12** |
| Fixtures with only a generic fallback prior (no source) | **60** |
| Fixtures with real `consensusOdds` (market data) | 15 |
| `v3Model.source` breakdown | `v3_sharp`: 12, `(none)`: 60 |

The 60 fallback fixtures carry a flat home/away prior with **no team-strength
signal** — the same "H 43% / D 20% / A 37%" repeats verbatim across unrelated
fixtures, and Argentina shows a featureless 39/22/39 even versus Jordan. Our
group-advancement simulation faithfully aggregated those priors, which is why
weak teams "topped" groups.

## Two things to check on the backend

1. **Run the model on the other 60 fixtures.** Only 12/72 WC fixtures have been
   predicted. Backfill `/predict` (or `/predict-wc`) across the WC slate so each
   fixture gets real probabilities. (Same staleness/refresh path as club matches.)

2. **Confirm the model used for WC.** The 12 predicted fixtures report
   `source: 'v3_sharp'` — the **club** model that **failed its holdout**
   (`edge_validated: false`). The edge manual specifies international fixtures
   should use **`wc_elo`** (the validated model, `edge_validated: true`). Note the
   edge `model_track_record.model` says `wc_elo` while `v3Model.source` says
   `v3_sharp` on the same rows — please reconcile which model actually generated
   the probabilities, and ensure WC fixtures route to `wc_elo`.

## What the frontend already did (so nothing dishonest ships)

- `WCFixture.modelSource` now distinguishes a real model run from a fallback prior.
- The group-advancement chart (`/world-cup/group/[letter]`) trusts probabilities
  **only** from fixtures with a real source, computes honest `coverage`, and is
  **withheld** entirely below 50% real coverage — replaced by a "forecast coming
  soon for this group" note. Right now that means **all 12 groups withhold the
  chart**; they appear automatically once ~4+ of each group's 6 fixtures are
  predicted.
- The WC blog-idea engine applies the same gate, so it won't surface
  "X favoured" angles built on priors.

## Verification hook

`npx tsx` against `lib/world-cup/data.ts` → count fixtures where
`v3Model.source` is set. When that climbs from 12 toward 72, the charts and blog
angles light up with no frontend change.
