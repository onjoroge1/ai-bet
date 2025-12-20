# 📱 WhatsApp Integration - Handoff Document

## 🎯 **Project Overview**

This document provides a comprehensive handoff for the WhatsApp integration work completed and the pending issue that needs to be resolved.

---

## 📋 **What We Worked On**

### **1. WhatsApp Integration Implementation**

#### **Core Features Implemented:**
- ✅ WhatsApp webhook endpoint (`/api/whatsapp/webhook`)
- ✅ Menu system (1: picks, 2: buy by matchId, 3: help, 4: purchase history)
- ✅ Today's picks display (Message "1")
- ✅ AI analysis delivery (Message "2" or matchId)
- ✅ Payment integration (Stripe Checkout Sessions)
- ✅ Test endpoints for debugging (`/api/whatsapp/test-command`, `/whatsapp/test`)

#### **Key Files Created/Modified:**

**Core Webhook:**
- `app/api/whatsapp/webhook/route.ts` - Main webhook handler
- `lib/whatsapp-service.ts` - WhatsApp API communication
- `lib/whatsapp-picks.ts` - Pick fetching and formatting
- `lib/whatsapp-payment.ts` - Payment session creation and message formatting

**Payment Integration:**
- `app/api/payments/webhook/route.ts` - Stripe webhook handler
- `app/api/whatsapp/payment/create/route.ts` - Payment session creation
- `app/whatsapp/pay/[sessionId]/route.ts` - Short URL redirect

**Testing:**
- `app/api/whatsapp/test-command/route.ts` - Test command endpoint
- `app/whatsapp/test/page.tsx` - UI test page

**Database:**
- `prisma/schema.prisma` - Added `WhatsAppUser` and `WhatsAppPurchase` models

---

### **2. Data Source Integration**

#### **Hybrid Approach for "Today's Picks":**
- **Primary Source:** Market API (`/api/market?status=upcoming`)
- **Enrichment:** QuickPurchase table (for purchasable matches)
- **Caching:** Redis (10-minute TTL for upcoming matches)
- **Fallback:** QuickPurchase-only if Market API fails

#### **Key Implementation Details:**
- Fetches all upcoming matches from Market API
- Enriches with QuickPurchase data when available
- Displays matches even without QuickPurchase (marked as "Coming soon")
- Limits to 10 picks to stay within WhatsApp's 4096 character limit

---

### **3. Message Formatting**

#### **Message "1" - Today's Picks:**
- Displays match ID, teams, date, league
- Shows consensus odds (H/D/W) from Market API
- Displays pick, confidence, value rating
- Includes clear call-to-action ("Send matchId to buy")
- Dynamic message length reduction if exceeds 4096 characters

#### **Message "2" - AI Analysis:**
- Full AI analysis from `QuickPurchase.predictionData`
- Includes: explanation, team analysis (strengths/weaknesses/injuries), confidence factors
- Asian Handicap information
- Truncated to stay under 4000 characters
- **Header:** "Here's your AI analysis 🤖"

---

### **4. Code Path Alignment (Recent Fix)**

#### **Issue Identified:**
- Test endpoint (`/api/whatsapp/test-command`) was missing critical logic from production webhook
- Payment webhook had orphaned code block

#### **Fixes Applied:**
1. **Message "1" Alignment:**
   - Added message length checking to test endpoint
   - Added dynamic pick reduction logic
   - Added empty picks handling
   - Now identical to production webhook

2. **Message "2" Alignment:**
   - Fixed orphaned `else` block in payment webhook
   - Aligned data extraction logic across all three paths:
     - Production webhook (`handleBuyByMatchId`)
     - Test endpoint
     - Payment webhook (`handleCheckoutSessionCompleted`)

3. **Result:**
   - All three code paths now use identical logic
   - Same `formatPickDeliveryMessage()` function
   - Same data extraction from `QuickPurchase`

---

## 🐛 **Issues Encountered & Resolved**

### **1. "No picks available" in Production**
**Symptom:** Sending "1" returned "No picks available" despite Market API showing 19 matches.

**Root Cause:**
- `getTodaysPicks()` was too restrictive, requiring `predictionData IS NOT NULL` even when Market API data was available
- Lacked robust fallback if QuickPurchase join returned zero results

**Resolution:**
- Relaxed `predictionData` filter when Market API data is available
- Improved fallback logic to try QuickPurchase-only query
- Added diagnostic logging

---

### **2. Only 1 Pick vs 21 on Homepage**
**Symptom:** WhatsApp showed only 1 pick while homepage showed 21.

**Root Cause:**
- `normalizeMarketMatch()` wasn't robust enough to handle various `id` field names from Market API
- Many matches were being skipped due to invalid `matchId` extraction

**Resolution:**
- Updated `normalizeMarketMatch()` to check multiple ID field names (`match.id`, `match.matchId`, `match._id`, `match.match_id`)
- Enhanced logging for skipped matches
- Fixed example matchId display in `formatPicksList()`

---

### **3. Message Length Exceedance (4096 limit)**
**Symptom:** Error: `Param text['body'] must be at most 4096 characters long`

**Root Cause:**
- Too many picks being displayed (50 initially)
- Message formatting was too verbose

**Resolution:**
- Limited picks to 10
- Made message formatting more compact
- Added dynamic message reduction in `sendTodaysPicks()`:
  - If message exceeds 4096, iteratively reduces picks until it fits
  - Falls back to error message if even 1 pick is too long

---

### **4. Odds Display Issue**
**Symptom:** Showing single odds value instead of Home/Draw/Away format.

**Root Cause:**
- Not correctly prioritizing consensus odds from Market API
- `normalizeMarketMatch()` wasn't extracting consensus probabilities correctly

**Resolution:**
- Updated `normalizeMarketMatch()` to prioritize:
  1. `match.odds.novig_current` (Market API consensus)
  2. `match.models.v1_consensus.probs` (model consensus)
  3. Single bookmaker odds as fallback
- Convert probabilities to odds using `1 / probability`
- Updated `formatPickForWhatsApp()` to display "Consensus Odds (H/D/W)" format

---

### **5. Code Path Discrepancy**
**Symptom:** Different messages between `/whatsapp/test` and production phone.

**Root Cause:**
- Test endpoint missing production logic (length checking, error handling)
- Payment webhook using different data extraction than direct webhook

**Resolution:**
- Aligned all three code paths (webhook, test, payment)
- Ensured identical data extraction and formatting

---

## ⚠️ **PENDING ISSUE: "Payment received ✅" Message**

### **Issue Description**

When a user sends a matchId (e.g., "123456") in WhatsApp, they sometimes receive a message with the header **"Payment received ✅"** instead of **"Here's your AI analysis 🤖"**.

### **Expected Behavior**

All three code paths should produce the same message:
- **Header:** "Here's your AI analysis 🤖"
- **Content:** Full AI analysis from `QuickPurchase.predictionData`

### **Current Behavior**

- ✅ **Direct webhook** (sending matchId directly) → Shows "Here's your AI analysis 🤖" ✅
- ✅ **Test endpoint** (`/whatsapp/test`) → Shows "Here's your AI analysis 🤖" ✅
- ❌ **Payment webhook** (old payment session completing) → Shows "Payment received ✅" ❌

### **Root Cause Analysis**

#### **Investigation Steps:**

1. **Checked Payment Webhook Code:**
   ```typescript
   // app/api/payments/webhook/route.ts
   async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
     // ... purchase status update ...
     
     // Format the full AI analysis message (same format as direct webhook)
     const message = formatPickDeliveryMessage({
       matchId: whatsappPurchase.quickPurchase.matchId!,
       homeTeam,
       awayTeam,
       market,
       tip,
       confidence: whatsappPurchase.quickPurchase.confidenceScore || 75,
       // ... other params ...
       predictionData: predictionData,
     });
     
     await sendWhatsAppText(whatsappPurchase.waUser.waId, message);
   }
   ```

2. **Checked `formatPickDeliveryMessage()` Function:**
   ```typescript
   // lib/whatsapp-payment.ts
   export function formatPickDeliveryMessage(params: {
     matchId: string | number;
     homeTeam: string;
     awayTeam: string;
     // ... other params ...
   }): string {
     const lines: string[] = [];
     lines.push("Here's your AI analysis 🤖"); // ✅ Correct header
     // ... rest of formatting ...
   }
   ```

3. **Possible Causes:**
   - **Old payment sessions:** User might be completing a payment session created before we removed payment flow
   - **Cached code:** Production might be running an older version of the code
   - **Different code path:** There might be another code path we haven't identified
   - **Message template:** Meta might be using a cached message template

### **Debugging Steps for New Agent**

1. **Check Production Logs:**
   ```bash
   # Look for "Payment received" in logs
   grep -r "Payment received" logs/
   
   # Check webhook logs for payment completion
   grep -r "checkout.session.completed" logs/
   ```

2. **Verify Code Deployment:**
   - Confirm latest code is deployed to production
   - Check if `formatPickDeliveryMessage()` is being called correctly
   - Verify `handleCheckoutSessionCompleted()` is using the updated code

3. **Check for Old Payment Sessions:**
   ```sql
   -- Find pending WhatsApp purchases
   SELECT * FROM "WhatsAppPurchase" 
   WHERE status = 'pending' 
   AND "createdAt" < NOW() - INTERVAL '1 hour';
   ```

4. **Add Debugging:**
   ```typescript
   // In handleCheckoutSessionCompleted()
   logger.info("Payment webhook - message header", {
     sessionId: session.id,
     matchId,
     messageHeader: message.split('\n')[0], // First line of message
   });
   ```

5. **Check Meta Message Templates:**
   - Verify no message templates are configured in Meta dashboard
   - Check if Meta is caching old message formats

### **Recommended Fix**

1. **Immediate:**
   - Add logging to `handleCheckoutSessionCompleted()` to capture the exact message being sent
   - Verify production deployment includes latest code changes
   - Check for any old payment sessions that might be completing

2. **Long-term:**
   - Add a version check or timestamp to messages to identify which code path generated them
   - Consider adding a message ID or hash to track message generation
   - Implement message versioning to ensure consistency

### **Files to Review**

- `app/api/payments/webhook/route.ts` - Payment webhook handler (lines 350-487)
- `lib/whatsapp-payment.ts` - Message formatting function `formatPickDeliveryMessage()`
- Production logs - Check for "Payment received" occurrences
- Stripe webhook logs - Verify webhook payloads

---

## 📁 **Key Files Reference**

### **Core WhatsApp Files:**
- `app/api/whatsapp/webhook/route.ts` - Main webhook handler
- `lib/whatsapp-service.ts` - WhatsApp API wrapper
- `lib/whatsapp-picks.ts` - Pick fetching and formatting
- `lib/whatsapp-payment.ts` - Payment and message formatting
- `lib/whatsapp-market-fetcher.ts` - Market API integration
- `lib/whatsapp-market-cache.ts` - Redis caching

### **Payment Integration:**
- `app/api/payments/webhook/route.ts` - Stripe webhook (⚠️ **PENDING ISSUE HERE**)
- `app/api/whatsapp/payment/create/route.ts` - Payment session creation

### **Testing:**
- `app/api/whatsapp/test-command/route.ts` - Test command endpoint
- `app/whatsapp/test/page.tsx` - UI test page

### **Documentation:**
- `WHATSAPP_CODE_PATH_VERIFICATION.md` - Code path verification
- `WHATSAPP_MESSAGE_1_COMPREHENSIVE_ANALYSIS.md` - Message 1 analysis
- `WHATSAPP_MESSAGE_EXAMPLES.md` - Message format examples
- `WHATSAPP_PRODUCTION_DEBUGGING.md` - Debugging guide

---

## 🔧 **Environment Variables Required**

```env
# WhatsApp Configuration
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_WABA_ID=your_waba_id
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_VERIFY_TOKEN=your_verify_token
WHATSAPP_APP_SECRET=your_app_secret  # For webhook signature verification

# Stripe (for payments)
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# Redis (for caching)
REDIS_URL=your_redis_url
```

---

## 🧪 **Testing Guide**

### **Local Testing:**
1. Use `ngrok` to expose local server
2. Configure Meta webhook with ngrok URL
3. Use `/whatsapp/test` page to test commands
4. Use `/api/whatsapp/test-command` endpoint for API testing

### **Production Testing:**
1. Send "1" to get today's picks
2. Send a matchId (e.g., "123456") to get AI analysis
3. Verify message format matches expected format
4. Check logs for any errors

### **Test Commands:**
- `1` or `picks` - Today's picks
- `matchId` (e.g., `123456`) - AI analysis
- `menu` or `0` - Main menu
- `3` or `help` - Help message
- `4` - Purchase history

---

## 📊 **Database Schema**

### **WhatsAppUser:**
```prisma
model WhatsAppUser {
  id          String   @id @default(cuid())
  waId        String   @unique // WhatsApp phone number
  countryCode String?  // Detected from phone number
  totalSpend  Decimal  @default(0)
  totalPicks  Int      @default(0)
  firstSeenAt DateTime @default(now())
  lastSeenAt  DateTime @updatedAt
  purchases   WhatsAppPurchase[]
}
```

### **WhatsAppPurchase:**
```prisma
model WhatsAppPurchase {
  id              String   @id @default(cuid())
  waUserId        String
  waUser          WhatsAppUser @relation(fields: [waUserId], references: [id])
  quickPurchaseId String
  quickPurchase   QuickPurchase @relation(fields: [quickPurchaseId], references: [id])
  matchId         String
  amount          Decimal
  currency        String
  status          String   // pending, completed, failed
  paymentSessionId String? // Stripe Checkout Session ID
  paymentIntentId String?
  purchasedAt     DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

---

## 🚀 **Next Steps for New Agent**

1. **Immediate Priority:**
   - ✅ Investigate "Payment received ✅" message issue
   - ✅ Add comprehensive logging to payment webhook
   - ✅ Verify production deployment includes latest code

2. **Short-term:**
   - Monitor production logs for any discrepancies
   - Test all three code paths in production
   - Verify message consistency across all entry points

3. **Long-term:**
   - Consider re-enabling payment flow (currently disabled for free access)
   - Implement message versioning
   - Add analytics for message delivery success rates

---

## 📝 **Additional Notes**

- **Payment Flow:** Currently disabled (free access). Payment code is preserved for future use.
- **Pricing:** Set to $0.00 for all picks (pricing logic preserved for future use).
- **Rate Limiting:** Implemented (10 messages/minute, 50 messages/hour per user).
- **Input Validation:** MatchId validation (4-10 digits, numeric only).
- **Webhook Verification:** Implemented using `X-Hub-Signature-256` header.

---

## 🔗 **Related Documentation**

- `WHATSAPP_IMPLEMENTATION_PLAN.md` - Original implementation plan
- `WHATSAPP_MARKET_API_IMPLEMENTATION_PLAN.md` - Market API integration details
- `WHATSAPP_MESSAGE_EXAMPLES.md` - All message format examples
- `WHATSAPP_PRODUCTION_DEBUGGING.md` - Production debugging guide
- `WHATSAPP_APP_SECRET_SETUP.md` - App secret configuration guide

---

**Last Updated:** December 2, 2025  
**Status:** ✅ Code paths aligned, ⚠️ Pending issue with "Payment received" message



