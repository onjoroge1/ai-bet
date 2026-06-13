# Multisport Edge Backend — Requirements from the Frontend

**Status:** request to backend team · 2026-06-12
**Context:** edge-payload v1 is live on `/predict` (soccer + WC). The frontend edge UI is
built and flag-gated; the **multisport predict API (`/api/multisport/predict` → backend
multisport predict) does not serve the edge blocks yet**, so NBA/NHL/NCAAB pages cannot
join the pivot. This doc is the exact contract the frontend needs.

## What the frontend already handles (no backend work needed)

- 2-way payloads: our edge types/components treat `draw` as optional everywhere. A payload
  with `{home, away}` only renders a 2-outcome edge grid automatically.
- Nullability: every block (`market`, `value`, `clv`, `model_track_record`) may be null —
  the UI degrades to probabilities-as-information.
- Honesty gating: CTAs render only when `model_track_record.edge_validated === true`. Ship
  the blocks with `edge_validated: false` and the UI will show the market panel + calibrated
  probabilities with no value claims — that is correct and safe to ship immediately.
- Stale-price outliers: the frontend independently suppresses value bets with EV > +250% or
  best price > 25.0 (observed trap quotes). Backend-side outlier filtering is still welcome.

## What we need served (mirror of soccer's `build_value_payload`)

On the multisport predict response, four additive top-level blocks:

```jsonc
"market": {
  "implied":   { "home": 0.587, "away": 0.413 },        // de-vigged, sums to 1.0 ±0.001 — NO draw key
  "overround": 1.041,
  "n_books":   12,
  "best_price": {                                        // NO draw key
    "home": { "odds": 1.78, "book": "fanduel" },
    "away": { "odds": 2.46, "book": "draftkings" }
  }
},
"value": {
  "edge":       { "home": -0.021, "away": 0.021 },       // 2 outcomes
  "ev_at_best": { "home": -0.045, "away": 0.052 },
  "value_bet":  { ... } | null,                          // same shape as soccer; bet ∈ {home_win, away_win}
  "rating":     "no_value" | "marginal" | "value" | "strong_value",
  "min_acceptable_odds": { "home": 1.86, "away": 2.34 }
},
"clv": { "bet_time_odds": null, "closing_odds": null, "realized_clv": null },
"model_track_record": {
  "model": "nba_v1",                                     // whatever the real model id is
  "segment": "efficient_market",
  "edge_validated": false,                               // ← honest until a temporal holdout passes
  "validation": "not yet validated against holdout",
  "median_clv_90d": null, "n_settled": null
}
```

### Hard requirements (frontend contract tests will check these)

1. `market.implied` sums to 1.0 ±0.001 across the 2 outcomes; `draw` key **absent**, not null.
2. `value.value_bet.bet` ∈ {`home_win`, `away_win`} and equals the argmax-EV outcome.
3. Non-null `value_bet` ⇒ `ev > 0` strictly.
4. `kelly_quarter == kelly_full / 4`, both ≥ 0.
5. `edge_validated` stays `false` until a temporal holdout beats baseline — same bar as
   `wc_elo` (+15.3pp). The frontend renders "no demonstrated edge" copy off this flag;
   never flip it for marketing reasons.
6. Legacy fields (`predictions.*`, `confidence`, `pick`) unchanged — old clients must not break.

### Data plumbing (per the QA plan §8)

- Generalize `utils/edge.py` outcome handling from hardcoded H/D/A to the event's outcome set.
- Best-price + de-vig source: the `multisport_odds_snapshots` fetcher (or equivalent
  consensus read) — soccer uses `odds_consensus`; multisport needs the same per-book
  snapshot at predict time and a closing sample at tip-off for CLV.
- CLV settlement rides the existing multisport result sync — populate `closing_odds` and
  `realized_clv` exactly like soccer's closing sampler (`method_used='last_prekickoff'`).

## Rollout sequence (so nothing dishonest ships)

1. **Phase A (ship anytime):** serve `market` + `value` + `model_track_record` with
   `edge_validated: false`. Frontend shows the market panel + probabilities, no CTAs.
   This alone kills the accuracy-era confidence framing on multisport pages.
2. **Phase B:** closing sampler + CLV fields → ledger starts accumulating evidence.
3. **Phase C:** when a model passes its holdout, flip `edge_validated: true` with the
   `validation` string → value bets become actionable in the UI automatically. No
   frontend deploy needed.

## Frontend status (for reference)

| Piece | Status |
|---|---|
| 2-way types + edge meter | ✅ shipped (`draw` optional end-to-end) |
| Conviction badges on `/sports/[sport]/[eventId]` | ✅ neutralized to "Model pick" under the flag |
| Contract test harness | ✅ `scripts/qa-edge-contract.ts` — extend `take` once multisport rows carry blocks |
| Multisport picks engine criterion | ⏳ will mirror soccer's Criterion 0 once blocks arrive |
