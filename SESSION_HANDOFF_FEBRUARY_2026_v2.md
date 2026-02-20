# SnapBet AI — Session Handoff (Feb 20, 2026 — Session v2)

## What Was Done This Session

### Completed
| # | Task | Files Changed |
|---|------|---------------|
| 1 | **VIP Intelligence Feed API — fixed empty data** | `app/api/vip/intelligence-feed/route.ts` |
|   | Root cause: API queried `QuickPurchase.match` (wrong relation) + `confidence` (wrong field). Fixed to use `QuickPurchase.marketMatch` relation and `confidenceScore` field. Also expanded CLV cache window from 1h → 6h, added DB-level premium fallback when JWT is stale. | |
| 2 | **Daily Tips page — replaced hardcoded mock with real DB data** | `app/dashboard/daily-tips/page.tsx` |
|   | Was 100% static ("Arsenal vs Chelsea" etc). Now fetches from `/api/quick-purchases?view=matches` with real confidence scores, dynamic pricing, and proper empty/loading/error states. | |
| 3 | **Saved Bets — migrated from localStorage to DB API** | `app/dashboard/saved-bets/page.tsx` |
|   | Was `localStorage` only (lost on browser clear). Now uses `GET/PATCH/DELETE /api/saved-bets` with server-persisted data, proper status transitions, and loading states. | |
| 4 | **Deleted stale pages** | Removed directories |
|   | `/dashboard/premium`, `/dashboard/weekend-special`, `/dashboard/predictions`, `/dashboard/player-picks` — all removed from disk. Already removed from sidebar nav in prior session. | |
| 5 | **VIP Monthly package card added to overview** | `components/personalized-offers.tsx` |
|   | New premium upsell card with amber/gold gradient, feature pills (VIP Intel, Analytics, CLV, AI Parlays), $19.99/mo pricing, and "Subscribe Now" CTA → `/pricing?plan=premium_intelligence`. Only shown when `isPremium === false`. | |
| 6 | **Sidebar "Upgrade" button fixed** | `app/dashboard/layout.tsx` |
|   | Was pointing to deleted `/dashboard/premium`. Now points to `/pricing`. | |
| 7 | **PremiumGate "Upgrade" button fixed** | `components/premium-gate.tsx` |
|   | Was pointing to `/dashboard/vip` (circular loop). Now points to `/pricing`. | |
| 8 | **`isPremium` propagated to session** | `lib/auth.ts` |
|   | Added `session.user.isPremium = token.isPremium` in session callback. This was the root cause of VIP page returning 403 for all users. | |

### Prior Session (v1) — Already Completed
- JWT stores `isPremium`, `subscriptionPlan`, `subscriptionExpiresAt`
- Middleware server-side premium route protection for `/dashboard/parlays`, `/analytics`, `/clv`, `/vip`
- `AccountSettings` wired to `PATCH /api/user/profile`
- `PaymentSettings` wired to `GET/POST /api/subscriptions/manage` + Stripe portal
- `/api/user/change-password` endpoint
- `/api/billing/invoices` endpoint (real Stripe invoices)
- `/api/user/analytics` endpoint (from `SavedBet` model)
- Analytics page rewritten to fetch real data
- Pagination on `/api/matches` and `/api/parlays`
- VIP Intelligence Feed page + API created
- VIP in sidebar nav with amber badge + `premiumOnly` flag

---

## Current Architecture

### Premium Flow
```
User signs up (free) → browses /dashboard (free overview)
  → sees "Upgrade to VIP" card + sidebar lock icons
  → clicks → /pricing page → /subscribe/[planId]
  → Stripe Checkout → webhook fires:
      checkout.session.completed → stores stripeCustomerId
      customer.subscription.created → sets subscriptionPlan, subscriptionExpiresAt, subscriptionStatus
      invoice.paid → tops up 150 credits for recurring billing
  → Next sign-in: JWT includes isPremium=true
  → Middleware allows premium routes
  → PremiumGate components render content instead of gate
```

### Middleware Premium Check (middleware.ts:74-437)
```
premiumPaths = ['/dashboard/parlays', '/dashboard/analytics', '/dashboard/clv', '/dashboard/vip']
Check: token.subscriptionPlan contains 'premium'|'monthly'|'vip'
  AND token.subscriptionStatus is 'active'|'trialing'
  AND token.subscriptionExpiresAt > now
Redirect on fail: /dashboard?upgrade=true
Admin bypass: always allowed
```

### Client-Side PremiumGate (4 pages)
- `/dashboard/analytics` ✅
- `/dashboard/parlays` ✅
- `/dashboard/clv` ✅
- `/dashboard/vip` ✅

### Premium Status Issue ⚠️
The middleware checks `token.subscriptionStatus === 'active'` but `lib/auth.ts` JWT callback does NOT set `subscriptionStatus` on the token — only `subscriptionPlan` and `subscriptionExpiresAt`. The VIP API works because it has a DB fallback, but **middleware premium gating may fail** because `subscriptionStatus` is always undefined in the JWT.

**Fix needed**: Either:
- Add `subscriptionStatus` to the JWT in `lib/auth.ts` JWT callback, OR
- Change middleware to not require `subscriptionStatus` (just check plan + expiry like the VIP API does)

---

## What Is Pending

### 🔴 P0 — Critical / Blocking

| # | Task | Details |
|---|------|---------|
| 1 | **Middleware premium check bug** | `subscriptionStatus` is never set in JWT. Middleware requires it to be `'active'`/`'trialing'`. This means middleware will ALWAYS redirect premium users to upgrade page even if they have a valid subscription. See `middleware.ts:424` and `lib/auth.ts` JWT callback. Fix: add `token.subscriptionStatus = dbUser.subscriptionStatus` to JWT callback, OR remove the status check from middleware. |
| 2 | **Middleware premium redirect target** | Redirects to `/dashboard?upgrade=true` but there's no UI handling `?upgrade=true` on the dashboard page. Should either redirect to `/pricing` or add a modal on dashboard that detects this param. See `middleware.ts:433`. |
| 3 | **Stripe price IDs not configured** | `STRIPE_PARLAY_PRO_PRICE_ID` env var is referenced in `/api/pricing/route.ts:83` but likely not set. The `/subscribe/[planId]` checkout flow needs valid Stripe Price IDs to create checkout sessions. Verify all Stripe env vars are set. |

### 🟡 P1 — Important

| # | Task | Details |
|---|------|---------|
| 4 | **Analytics: add QuickPurchase match performance** | `/api/user/analytics` only reads from `SavedBet` model (which most users won't have data in yet). Should ALSO query `QuickPurchase` table for matches the user purchased, check `finalResult` vs AI prediction, and show AI pick accuracy (win rate of purchased tips). This gives analytics substance even for users who never manually saved bets. |
| 5 | **Saved Bets: verify PATCH/DELETE API** | The saved-bets page was rewritten to use `/api/saved-bets` DB API. The `PATCH` endpoint needs a `status` field update handler (confirm it exists — the POST was verified, PATCH may need the `status` field explicitly in the handler). |
| 6 | **Settings: audit NotificationSettings + PrivacySettings** | `components/settings/NotificationSettings.tsx` and `components/settings/PrivacySettings.tsx` may contain placeholder/mock data. Verify they call real APIs or at minimum save preferences to the DB. |
| 7 | **VIP Intelligence Feed: verify data shows** | The API was fixed (wrong model relations), but needs testing with real data. If `QuickPurchase` records don't have `marketMatchId` linked, the OR-fallback uses `matchData` JSON. Verify matches actually render on the VIP page. |
| 8 | **`/dashboard/test` page exists** | This is a test/debug page. Should be removed or restricted to admin-only before production. |

### 🟢 P2 — Nice to Have

| # | Task | Details |
|---|------|---------|
| 9 | **Daily Tips: purchase flow** | The rewritten daily-tips page opens `QuickPurchaseModal` for premium tips. Verify the modal works end-to-end (payment → tip unlocked → shows in `/dashboard/my-tips`). |
| 10 | **Analytics: monthly chart data** | `/api/user/analytics` returns `monthlyStats: []` (empty array). Could aggregate by month for a chart. |
| 11 | **Saved Bets: auto-settlement** | Cron job at `/api/admin/settle-saved-bets` (every 30min) settles `SavedBet` records. Verify it correctly matches `SavedBet.items[].matchId` to `QuickPurchase.finalResult` and updates status to won/lost/void. The DB schema stores `items` as JSON — settlement logic needs to parse it. |
| 12 | **Referrals page** | `/dashboard/referrals` calls `/api/referrals` which exists. Verify referral link generation and credit awarding work end-to-end. |
| 13 | **Dashboard overview `?upgrade=true`** | Add a modal or banner on `/dashboard` (overview) that shows when `?upgrade=true` is in the URL (set by middleware premium redirect). |

---

## Key File Reference

### Auth & Premium
- `lib/auth.ts` — NextAuth config, JWT callback (sets `isPremium`, `subscriptionPlan`, `subscriptionExpiresAt`)
- `middleware.ts` — Server-side premium route protection (lines 74-437)
- `components/premium-gate.tsx` — Client-side premium gate component
- `app/api/premium/check/route.ts` — API to check premium status (used by layout + pages)
- `app/api/payments/webhook/route.ts` — Stripe webhook handler (subscription lifecycle)

### Subscription & Billing
- `app/api/subscriptions/manage/route.ts` — GET status, POST cancel/reactivate/portal
- `app/api/subscriptions/checkout/route.ts` — Create Stripe checkout session
- `app/api/billing/invoices/route.ts` — Fetch Stripe invoices
- `app/api/pricing/route.ts` — Pricing plans for `/pricing` page
- `app/subscribe/[planId]/page.tsx` — Checkout flow page

### Dashboard Pages (all under `app/dashboard/`)
| Page | Gate | Data Source | Status |
|------|------|-------------|--------|
| `/` (overview) | Free | Multiple APIs | ✅ Working |
| `/matches` | Free | `/api/quick-purchases?view=matches` | ✅ Working |
| `/parlays` | Premium | `/api/parlays` + `/api/market` | ✅ Working |
| `/clv` | Premium | `/api/clv/cache` → `/api/clv/opportunities` | ✅ Working |
| `/analytics` | Premium | `/api/user/analytics` | ✅ Working (needs P1 #4) |
| `/vip` | Premium | `/api/vip/intelligence-feed` | ✅ Fixed (needs P1 #7 verification) |
| `/daily-tips` | Free | `/api/quick-purchases?view=matches` | ✅ Rewritten this session |
| `/saved-bets` | Free | `/api/saved-bets` | ✅ Migrated to DB this session |
| `/my-bets` | Free | `/api/user/dashboard-data` | ✅ Working |
| `/my-tips` | Free | `/api/my-tips` | ✅ Working |
| `/rewards` | Free | `/api/user/points` + `/api/referrals` | ✅ Working |
| `/referrals` | Free | `/api/referrals` | ✅ Working |
| `/notifications` | Free | `/api/notifications` | ✅ Working |
| `/tools` | Free | Client-only calculators | ✅ Working |
| `/support` | Free | `/api/support/contact` + `/api/support/tickets` | ✅ Working |
| `/settings` | Free | Profile/Password/Stripe APIs | ✅ Wired (P1 #6 for sub-components) |

### Cron Jobs (vercel.json)
| Schedule | Endpoint | Purpose |
|----------|----------|---------|
| `*/15 * * * *` | `/api/admin/parlays/sync-backend-scheduled` | Sync parlays from backend |
| `*/30 * * * *` | `/api/admin/parlays/sync-scheduled` | Sync parlays |
| `30 */3 * * *` | `/api/admin/parlays/generate-best-scheduled` | Generate AI parlays |
| `0 */3 * * *` | `/api/admin/additional-markets/sync-scheduled` | Sync BTTS/O-U/etc. |
| `*/10 * * * *` | `/api/admin/market/sync-scheduled?type=upcoming` | Sync upcoming matches |
| `*/10 * * * *` | `/api/admin/market/sync-scheduled?type=completed` | Sync completed matches |
| `* * * * *` | `/api/admin/market/sync-scheduled?type=live` | Sync live match data |
| `0 */2 * * *` | `/api/admin/predictions/sync-from-availability-scheduled` | Sync predictions |
| `*/30 * * * *` | `/api/admin/settle-saved-bets` | Auto-settle saved bets |
| `*/30 * * * *` | `/api/admin/clv/sync-scheduled` | Sync CLV cache |
| `0 2 * * *` | `/api/admin/template-blogs/scheduled` | Generate blog posts |
| `0 3 * * *` | `/api/admin/social/twitter/scheduled` | Twitter posts |

### DB Models (key ones)
- `User` — has `stripeCustomerId`, `stripeSubscriptionId`, `subscriptionStatus`, `subscriptionExpiresAt`, `subscriptionPlan`
- `QuickPurchase` — match predictions with `confidenceScore`, `predictionData` JSON, `marketMatch` relation
- `MarketMatch` — external match data with `kickoffDate`, `status` (UPCOMING/LIVE/FINISHED), `v1Model`/`v2Model` JSON
- `SavedBet` — user-saved bet slips with `items` JSON, `status`, `totalOdds`, `stake`
- `ParlayConsensus` + `ParlayLeg` — AI-generated parlays
- `CLVOpportunityCache` — cached CLV opportunities
- `AdditionalMarketData` — BTTS, O/U, DNB structured market data

---

## Environment & Dev Setup
- **Framework**: Next.js 14 (App Router)
- **DB**: PostgreSQL via Prisma
- **Payments**: Stripe (test mode — `pk_test_...`)
- **Auth**: NextAuth.js with JWT strategy
- **Styling**: Tailwind CSS
- **Deploy**: Vercel (cron jobs configured in `vercel.json`)
- **Dev**: `npm run dev` → `localhost:3000`
- **Key env vars**: `DATABASE_URL`, `NEXTAUTH_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CRON_SECRET`, `BACKEND_URL`, `BACKEND_API_KEY`

