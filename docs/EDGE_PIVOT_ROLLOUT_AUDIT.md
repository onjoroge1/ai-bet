# Edge Pivot Rollout Audit — old (confidence-led) vs new (edge-led) state

**Date:** 2026-06-12 · **Flag:** `NEXT_PUBLIC_EDGE_PIVOT_MODE`
**Companion docs:** `EDGE_PIVOT_FRONTEND.md` (the manual), `PREDICT_WC_SCOPE.md`

App-wide scan for surfaces still leading with confidence/accuracy/win-rate.
"Converted" = renders edge UI when the flag is on, legacy when off.

---

## ✅ Already converted (commit `140945e`)

| Surface | What changed |
|---|---|
| `components/predictions/PredictionCard.tsx` (match page, my-tips) | Edge hero: EdgeMeter + PriceGuard + StakeSuggester / NoValueState; ValueBadge in preview+compact |
| `app/matches/page.tsx` | Value-only default filter, EV sort, EdgeChip, "Value Bets (N scanned)" stat |
| `app/dashboard/matches/page.tsx` | Same pattern (chip via server-side `edge` summary) |
| `components/featured-predictions.tsx` (homepage cards) | "Confidence" → "Model probability", neutral styling |
| `components/soccer-hub/FixturesByLeague.tsx` + `components/world-cup/WCFixtureRow.tsx` | EdgeChip replaces confidence badge when edge data exists |
| `app/admin/matches/page.tsx` + upcoming API | Edge column (validated/unvalidated + rating), ungated |
| Data plumbing | predict route persists edge keys to `v3Model`; `/api/quick-purchases` + admin API serve summaries |

---

## 🔴 P0 — Hardcoded fake numbers (violate honesty rules with the flag OFF or ON; delete, don't flag-gate)

| Number | Where | Context |
|---|---|---|
| "92% accuracy" + "win streak: 15/18" | `components/marquee-ticker.tsx:26,29` | Homepage live ticker default items — pure fiction |
| "87% AI Accuracy" | `components/responsive-hero.tsx:197`, `components/hero-section.tsx:140`, `components/mobile-hero.tsx:65`, `components/mobile-swipe-cards.tsx:156` | Hero stat bars |
| "92%" success/confidence | `components/weekly-stats.tsx:8`, `components/specials/weekly-stats.tsx:8`, `components/mobile-dashboard.tsx:69`, `components/pay-as-you-go.tsx:46`, `components/mobile-hero.tsx:113` | Stat cards |
| "91% Live Accuracy" | `components/live-stats.tsx:8`, `components/live/live-stats.tsx:8`, `components/live/live-predictions-header.tsx:74` | /live-predictions hero |
| "89% / 85% / 23" demo stats | `components/tips/tips-stats.tsx:8-27` | /daily-tips sidebar |
| "2.3× AVG ROI" | homepage hero stat strip | Unverified marketing claim |

**Action:** replace with real numbers from the premium tracker (`/api/premium-tracker/stats`)
or the CLV ledger, or delete. The manual's copy table: "Our picks beat the closing line
by +2.1% (90d median)" is the approved replacement claim shape.

## 🟠 P1 — High-traffic bet-decision surfaces still confidence-led (flag-gate to edge UI)

| Surface | File(s) | What shows today | Recommended |
|---|---|---|---|
| Homepage hero stats | `app/page.tsx:102-200` | "AVG CONFIDENCE" live stat | Flag on → "Value bets today (N of M scanned)" from edge summaries |
| /daily-tips cards + sort | `components/tips/todays-predictions.tsx:153,315`, `tips-filters.tsx:37-50` | Confidence % per card, "Sort by Confidence", 90%+ filter | Flag on → ValueBadge/EdgeChip per card, EV sort, value-rating filter |
| /dashboard/daily-tips | `app/dashboard/daily-tips/page.tsx:209-318` | "Avg Confidence" widget + per-card bars | Same pattern as dashboard/matches |
| /dashboard/parlays | `app/dashboard/parlays/page.tsx:127-131,248,463` | Confidence-tier badges + ConfidenceRing | Edge gating per manual §4.7 (also blocked on backend parlay edge payload) |
| /dashboard/vip | `app/dashboard/vip/page.tsx:89-105,333,381` | "AI-curated high-confidence picks" + rings | Relabel "edge opportunities"; EdgeChip |
| /dashboard/my-tips | `app/dashboard/my-tips/page.tsx:187-257` | ConfidenceRing per tip | PredictionCard already converted; convert the list wrapper |
| /dashboard/clv | `app/dashboard/clv/page.tsx:153,328` | ConfidenceRing on CLV cards | Show EV/CLV% (it already computes them) — confidence ring is redundant here |
| Match page (outside PredictionCard) | `app/match/[slug]/page.tsx:914,1403,1728,1794,1855` | Multiple confidence renders (v1/v2 sections) | Flag-gate; show market vs model rows instead |
| /weekly-specials | `components/specials/special-predictions.tsx` | Inherits confidence card layout | Same treatment as daily-tips |
| ConfidenceRing itself | `components/match/shared.tsx:94-150` | The shared ring + color helper (12+ call sites) | Add an edge-aware sibling (`EdgeRing` or reuse EdgeChip); migrate call sites behind flag |

## 🟡 P2 — Copy/metadata/templates (relabel, lower urgency)

| Surface | File | Action |
|---|---|---|
| Match page SEO/OG | `app/match/[slug]/layout.tsx:35-50,244,355`, `opengraph-image.tsx` | Meta + OG images bake in confidence % — emit edge/EV when flag on |
| Twitter generator | `lib/social/twitter-generator.ts:60-92` | "{AI_CONF}% win probability" template → "market X% vs our Y%" shape |
| Email footer copy | `types/email-templates.ts:550,584` | "hot picks" → "value picks" |
| Odds table explainer | `components/ui/odds-prediction-table.tsx:661` | "80-100%: Very high confidence" → model-probability language |
| FAQ schema answers | `components/schema-markup.tsx`, soccer-hub FAQ (`lib/soccer-hubs/faq.ts`) | References to confidence/82% hit rate → align with CLV-led claims |
| Smart notifications | `components/smart-notifications.tsx:35` | "5-win streak! Consider our accumulator" — encourages chasing; replace with CLV framing |

## ⚪ Leave as-is

- `/dashboard/edge-finder` — already edge-native (EV scanner, arb, line shop)
- `/performance` tracker — already audited-results-led
- Dashboard "accuracy"/streak on `app/dashboard/page.tsx` — user-earned record, not an AI claim (but consider CLV aggregates beside it per manual §6)
- Admin internals — admins see everything

---

## Suggested sequencing

1. **P0 fake numbers** — independent of the flag, pure honesty fix, ~2h. Do first.
2. **P1 in two passes:** (a) shared lever — edge-aware ring/chip in `components/match/shared.tsx` + tips card/filter components, which converts daily-tips/weekly-specials/vip/my-tips mostly for free; (b) page-specific stats widgets (homepage hero, dashboard widgets, match-page sections).
3. **P2 copy/templates** — batch with the flag-flip release so external surfaces (OG images, tweets, emails) switch in lockstep.
4. Parlay surfaces last — blocked on backend parlay edge payload anyway.
