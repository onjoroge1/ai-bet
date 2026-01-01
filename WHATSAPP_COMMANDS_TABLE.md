# 📱 WhatsApp Commands Reference Table

## Overview
This document provides a comprehensive list of all WhatsApp commands, their messages, and data sources.

---

## 📊 Commands Table

| Command | Aliases | Access | Message Type | Data Source | Implementation Status |
|---------|---------|--------|--------------|-------------|----------------------|
| **MENU** | `menu`, `hi`, `hello`, `hey`, `0`, `start` | Free | Welcome (new users) or Main Menu | `lib/whatsapp-messages.ts` - `getWelcomeMessage()` or `getMainMenuMessage()` | ✅ Complete |
| **1** | `1`, `picks`, `today` | Free | Today's picks list | `lib/whatsapp-picks.ts` - `getTodaysPicks()` → Market API (`/api/market`) + QuickPurchase table (enhancement) | ✅ Complete |
| **2** | `2`, `popular` | Free | Popular matches/leagues | `prisma.quickPurchase.findMany()` - `isPopular: true` | ✅ Complete |
| **3** | `3`, `help` | Free | Help message | `lib/whatsapp-messages.ts` - `getHelpMessage()` | ✅ Complete |
| **4** | `4`, `history`, `purchases`, `mypicks` | Free | Purchase history | `prisma.whatsAppUser.findUnique()` with `purchases` relation | ✅ Complete |
| **FREE** | `free` | Free | Free tier options | Hardcoded message in `sendFreeTierOptions()` | ✅ Complete |
| **HOW** | `how` | Free | How SnapBet works | Hardcoded message in `sendHowSnapBetWorks()` | ✅ Complete |
| **LEAGUES** | `leagues` | Free | Supported leagues | Hardcoded message in `sendSupportedLeagues()` | ✅ Complete |
| **STATS** | `stats`, `statistics` | Free | Basic team stats | Hardcoded message in `sendBasicStats()` | ✅ Complete |
| **[Match ID]** | Direct numeric input (e.g., `1379099`) | Free | Full AI analysis | `prisma.quickPurchase.findUnique()` by `matchId` → `formatPickDeliveryMessage()` | ✅ Complete |
| **VIP** | `vip` | Free | VIP pricing & plans | Hardcoded message in `sendVIPPricing()` | ✅ Complete |
| **BUY** | `buy` | Free | Payment options with links | `lib/whatsapp-payment.ts` - `createWhatsAppVIPSubscriptionSession()` for each plan + `getDbCountryPricing()` | ✅ Complete |
| **WEEKEND** | `weekend`, `weekend pack` | Free | Weekend pack payment link | `lib/whatsapp-payment.ts` - `createWhatsAppVIPSubscriptionSession("weekend_pass")` | ✅ Complete |
| **WEEKLY** | `weekly`, `weekly pack` | Free | Weekly pack payment link | `lib/whatsapp-payment.ts` - `createWhatsAppVIPSubscriptionSession("weekly_pass")` | ✅ Complete |
| **MONTHLY** | `monthly`, `monthly sub`, `monthly subscription` | Free | Monthly subscription payment link | `lib/whatsapp-payment.ts` - `createWhatsAppVIPSubscriptionSession("monthly_sub")` | ✅ Complete |
| **VIP PICKS** | `vip picks`, `vippicks` | Premium | Premium AI picks | Currently calls `sendTodaysPicks()` (same as command 1) | ⚠️ Placeholder |
| **V2** | `v2` | Premium | High-accuracy ML picks | Hardcoded placeholder message | ⚠️ Placeholder |
| **V3** | `v3` | Premium | Highest-confidence picks | Hardcoded placeholder message | ⚠️ Placeholder |
| **PARLAY** | `parlay`, `parlays` | Premium | AI-built parlays | `prisma.parlayConsensus.findMany()` with `legs` relation | ✅ Complete |
| **CS** | `cs`, `correct score`, `correctscore` | Premium | Correct score predictions | Hardcoded placeholder message | ⚠️ Placeholder |
| **BTTS** | `btts`, `both teams to score` | Premium | Both Teams To Score picks | Hardcoded placeholder message | ⚠️ Placeholder |
| **OVERS** | `overs`, `over under`, `overunder` | Premium | Over/Under goals picks | Hardcoded placeholder message | ⚠️ Placeholder |
| **AUTO** | `auto`, `subscription` | Premium | Auto subscription info | Hardcoded message in `sendAutoSubscriptionInfo()` | ✅ Complete |
| **LIVE** | `live` | Premium | Live in-play predictions | Hardcoded placeholder message | ⚠️ Placeholder |
| **RENEW** | `renew` | Free | Renew VIP access info | `lib/whatsapp-premium.ts` - `getWhatsAppVIPStatus()` | ✅ Complete |
| **STATUS** | `status` | Free | Check VIP status | `lib/whatsapp-premium.ts` - `getWhatsAppVIPStatus()` | ✅ Complete |

---

## 📋 Detailed Data Sources

### **1. Today's Picks (Command 1)**
**Function:** `getTodaysPicks()` in `lib/whatsapp-picks.ts`

**Data Sources:**
1. **Primary:** Market API (`/api/market?status=upcoming&limit=50`)
   - Fetched via `fetchUpcomingMatchesFromMarket()`
   - Cached in Redis (10-minute TTL)
   - Returns: match data, odds, model predictions, kickoff dates
2. **Enhancement:** QuickPurchase table
   - Matched by `matchId`
   - Adds: price, confidence score, value rating, prediction data
3. **Fallback:** If Market API fails, uses QuickPurchase-only

**Message Format:** `formatPicksList()` in `lib/whatsapp-picks.ts`
- Shows: Match ID, teams, league, kickoff date, tip, confidence, price (if available)

---

### **2. Popular Matches (Command 2)**
**Function:** `sendPopularMatches()` in `app/api/whatsapp/webhook/route.ts`

**Data Source:**
- `prisma.quickPurchase.findMany()`
  - Where: `isActive: true`, `isPredictionActive: true`, `isPopular: true`
  - Grouped by league from `matchData.league.name`
  - Limited to 10 matches

**Message Format:** Hardcoded template with league grouping

---

### **3. Purchase History (Command 4)**
**Function:** `sendPurchaseHistory()` in `app/api/whatsapp/webhook/route.ts`

**Data Source:**
- `prisma.whatsAppUser.findUnique()` with `purchases` relation
  - Where: `status: 'completed'`
  - Includes: `quickPurchase` (matchId, name, predictionType)
  - Ordered by: `purchasedAt: 'desc'`
  - Limited to: 10 purchases

**Message Format:** Lists purchases with match name, Match ID, and purchase date

---

### **4. Match ID Analysis (Direct Input)**
**Function:** `handleBuyByMatchId()` in `app/api/whatsapp/webhook/route.ts`

**Data Source:**
- `prisma.quickPurchase.findUnique()` by `matchId`
  - Includes: `country` (currency info)
  - Extracts: `matchData` (homeTeam, awayTeam, league, startTime)
  - Extracts: `predictionData` (market, tip, analysis, team_analysis, etc.)

**Message Format:** `formatPickDeliveryMessage()` in `lib/whatsapp-payment.ts`
- Full AI analysis with: prediction, confidence, team analysis, Asian Handicap, betting intelligence, etc.

---

### **5. Payment Options (BUY Command)**
**Function:** `sendPaymentOptions()` in `app/api/whatsapp/webhook/route.ts`

**Data Sources:**
1. **User Country:** `prisma.whatsAppUser.findUnique()` → `countryCode`
2. **Pricing:** `getDbCountryPricing()` from `lib/server-pricing-service.ts`
   - Fetches: `weekend_pass`, `weekly_pass`, `monthly_sub` pricing
   - From: `PackageOfferCountryPrice` table
3. **Payment Sessions:** `createWhatsAppVIPSubscriptionSession()` for each plan
   - Creates Stripe Checkout Session
   - Returns: `/whatsapp/pay/[sessionId]` URL

**Message Format:** Shows all 3 plans with prices and payment links

---

### **6. Parlay Picks (PARLAY Command)**
**Function:** `sendParlayPicks()` in `app/api/whatsapp/webhook/route.ts`

**Data Source:**
- `prisma.parlayConsensus.findMany()`
  - Where: `status: 'active'`, `confidenceTier: ['high', 'medium']`
  - Includes: `legs` relation (ordered by `legOrder`)
  - Ordered by: `edgePct: 'desc'`
  - Limited to: 5 parlays, 6 legs each

**Message Format:** Shows parlay details with legs, edge, confidence, implied odds

---

### **7. VIP Subscription Payment (WEEKEND/WEEKLY/MONTHLY)**
**Function:** `createVIPSubscriptionPayment()` in `app/api/whatsapp/webhook/route.ts`

**Data Sources:**
1. **Package Offer:** `prisma.packageOffer.findFirst()` by `packageType`
2. **Country Pricing:** `getDbCountryPricing()` or `PackageOfferCountryPrice` table
3. **Payment Session:** `createWhatsAppVIPSubscriptionSession()` in `lib/whatsapp-payment.ts`
   - Creates Stripe Checkout Session
   - Metadata: `waId`, `packageType`, `packageOfferId`, `purchaseType: 'vip_subscription'`

**Message Format:** Shows package name and payment link

---

### **8. VIP Status (STATUS/RENEW Commands)**
**Function:** `sendVIPStatus()` / `sendRenewVIPInfo()` in `app/api/whatsapp/webhook/route.ts`

**Data Source:**
- `lib/whatsapp-premium.ts` - `getWhatsAppVIPStatus()` / `hasWhatsAppPremiumAccess()`
  - Currently checks: `prisma.whatsAppUser` (basic check)
  - TODO: Add VIP fields to `WhatsAppUser` schema or link to `UserPackage`

**Message Format:** Shows VIP status, expiry date, or upgrade prompt

---

## 🔄 Payment Flow Data Sources

### **Payment Confirmation (Stripe Webhook)**
**Function:** `handleWhatsAppVIPSubscription()` in `app/api/payments/webhook-handle-vip.ts`

**Data Sources:**
1. **Stripe Session:** `stripe.checkout.sessions.retrieve(sessionId)`
2. **WhatsAppUser:** `prisma.whatsAppUser.findUnique()` by `waId`
3. **PackageOffer:** `prisma.packageOffer.findFirst()` by `packageType`
4. **UserPackage:** Creates `prisma.userPackage.create()` (requires User, not WhatsAppUser - TODO: fix)

**Message Format:** Confirmation message with package details and VIP access info

---

## 📝 Message Templates Location

| Template | Location | Function |
|----------|----------|----------|
| Main Menu | `lib/whatsapp-messages.ts` | `getMainMenuMessage()` |
| Help | `lib/whatsapp-messages.ts` | `getHelpMessage()` |
| Welcome | `lib/whatsapp-messages.ts` | `getWelcomeMessage()` |
| Picks List | `lib/whatsapp-picks.ts` | `formatPicksList()` |
| Pick Delivery | `lib/whatsapp-payment.ts` | `formatPickDeliveryMessage()` |
| All Others | `app/api/whatsapp/webhook/route.ts` | Individual functions |

---

## ⚠️ Placeholder Commands (Not Fully Implemented)

| Command | Status | Notes |
|---------|--------|-------|
| **VIP PICKS** | ⚠️ Placeholder | Currently just calls `sendTodaysPicks()` |
| **V2** | ⚠️ Placeholder | Hardcoded message, no data fetching |
| **V3** | ⚠️ Placeholder | Hardcoded message, no data fetching |
| **CS** | ⚠️ Placeholder | Hardcoded message, no data fetching |
| **BTTS** | ⚠️ Placeholder | Hardcoded message, no data fetching |
| **OVERS** | ⚠️ Placeholder | Hardcoded message, no data fetching |
| **LIVE** | ⚠️ Placeholder | Hardcoded message, no data fetching |

---

## 🔗 External APIs

| API Endpoint | Purpose | Used By |
|--------------|---------|---------|
| `/api/market?status=upcoming&limit=50` | Fetch upcoming matches | `getTodaysPicks()` |
| Stripe Checkout API | Create payment sessions | `createWhatsAppVIPSubscriptionSession()` |
| Stripe Webhook | Payment confirmation | `handleWhatsAppVIPSubscription()` |

---

## 🗄️ Database Tables Used

| Table | Purpose | Commands |
|-------|---------|----------|
| `WhatsAppUser` | User data, country, totals | All commands |
| `WhatsAppPurchase` | Purchase history | Command 4 (History) |
| `QuickPurchase` | Match data, predictions, pricing | Commands 1, 2, Match ID |
| `ParlayConsensus` | Parlay data | PARLAY command |
| `PackageOffer` | Subscription packages | BUY, WEEKEND, WEEKLY, MONTHLY |
| `PackageOfferCountryPrice` | Country-specific pricing | BUY, WEEKEND, WEEKLY, MONTHLY |
| `UserPackage` | User subscriptions | STATUS, RENEW (TODO: link to WhatsAppUser) |

---

## 📊 Summary Statistics

- **Total Commands:** 26
- **Fully Implemented:** 19
- **Placeholder/Partial:** 7
- **Free Commands:** 13
- **Premium Commands:** 13 (7 require VIP access, 6 are payment-related)

---

## 🔧 Implementation Notes

1. **VIP Access Check:** Currently uses `hasWhatsAppPremiumAccess()` which returns `false` for all users. Need to implement proper VIP tracking (add fields to `WhatsAppUser` or create `WhatsAppUserPackage` model).

2. **Payment Confirmation:** VIP subscription purchases create `UserPackage` records, but `UserPackage` requires a `User` (not `WhatsAppUser`). This needs to be fixed.

3. **Placeholder Commands:** V2, V3, CS, BTTS, OVERS, LIVE need backend API integration or database queries to fetch actual data.

4. **Data Caching:** Market API data is cached in Redis for 10 minutes to reduce API calls.

5. **Message Length:** All messages are checked against WhatsApp's 4096 character limit and truncated if needed.



