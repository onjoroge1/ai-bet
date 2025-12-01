# 📱 WhatsApp-Only Pick Selling System - Implementation Plan

## 🎯 **Goal**
Enable users to buy picks via WhatsApp without website access, using WhatsApp phone number as the account identifier.

---

## 📊 **Database Schema Design**

### **Option A: Separate WhatsAppUser Table (Recommended)**

**Pros:**
- Clean separation between web users and WhatsApp users
- No need to modify existing User table
- Easier to track WhatsApp-specific metrics
- Can link to User later if user signs up on web

**Cons:**
- Two user systems to maintain
- Need to handle potential duplicates if user has both

### **Option B: Extend User Table**

**Pros:**
- Single user system
- Easier to merge accounts later

**Cons:**
- Requires email for User table (WhatsApp users don't have email)
- More complex queries
- Mixes web and WhatsApp users

### **✅ Recommended: Option A - Separate WhatsAppUser Table**

```prisma
model WhatsAppUser {
  id            String   @id @default(cuid())
  waId          String   @unique // WhatsApp number (E.164 format, e.g., "16783929144")
  totalSpend    Decimal  @default(0)
  totalPicks    Int      @default(0)
  firstSeenAt   DateTime @default(now())
  lastSeenAt    DateTime @updatedAt
  countryCode   String?  // Detected from phone number or default
  language      String?  @default("en")
  isActive      Boolean  @default(true)
  
  // Optional: Link to User if they sign up on web later
  userId        String?  @unique
  user          User?    @relation(fields: [userId], references: [id])
  
  purchases     WhatsAppPurchase[]
  
  @@index([waId])
  @@index([lastSeenAt])
}

model WhatsAppPurchase {
  id                String        @id @default(cuid())
  waUserId          String
  quickPurchaseId   String
  matchId           String?       // Store for quick lookup
  amount            Decimal
  currency          String        @default("USD")
  paymentSessionId  String        // Stripe Checkout Session ID
  paymentIntentId   String?       // Stripe Payment Intent ID (after payment)
  status            String        // pending, completed, failed, canceled
  purchasedAt       DateTime?
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
  
  waUser            WhatsAppUser  @relation(fields: [waUserId], references: [id])
  quickPurchase      QuickPurchase @relation(fields: [quickPurchaseId], references: [id])
  
  @@index([waUserId])
  @@index([matchId])
  @@index([paymentSessionId])
  @@index([status])
  @@index([createdAt])
}
```

**Update QuickPurchase relation:**
```prisma
model QuickPurchase {
  // ... existing fields ...
  whatsappPurchases WhatsAppPurchase[]
}
```

**Update User relation (optional):**
```prisma
model User {
  // ... existing fields ...
  whatsappAccount WhatsAppUser?
}
```

---

## 🏗️ **Architecture Overview**

```
WhatsApp Message → Webhook → Menu Handler → Payment Link → Stripe Checkout → Webhook → Send Pick
```

### **Flow Diagram:**
```
1. User sends "1" → Show today's picks with matchIds
2. User sends "2 123456" → Create payment session → Send payment link
3. User clicks link → Opens Stripe Checkout in WhatsApp webview
4. User pays → Stripe webhook → Mark purchase complete → Send pick via WhatsApp
```

---

## 📁 **File Structure**

```
app/api/whatsapp/
├── webhook/
│   └── route.ts              # Existing - enhance with menu system
└── send-test/
    └── route.ts              # Existing - keep for testing

lib/
├── whatsapp-service.ts       # Existing - enhance
├── whatsapp-picks.ts         # NEW - Pick fetching logic
└── whatsapp-payment.ts       # NEW - Payment session creation

prisma/
└── migrations/
    └── YYYYMMDD_add_whatsapp_tables/
        └── migration.sql     # NEW - Database migration
```

---

## 🔧 **Implementation Steps**

### **Phase 1: Database Setup** ✅

1. **Create Prisma migration**
   ```bash
   npx prisma migrate dev --name add_whatsapp_tables
   ```

2. **Update Prisma schema** with WhatsAppUser and WhatsAppPurchase models

3. **Generate Prisma client**
   ```bash
   npx prisma generate
   ```

---

### **Phase 2: Core WhatsApp Functions** ✅

#### **2.1 Create `lib/whatsapp-picks.ts`**

**Purpose:** Fetch picks from QuickPurchase table

**Key Functions:**
- `getTodaysPicks()` - Get active predictions for today
- `getPickByMatchId(matchId: string)` - Get specific pick
- `formatPickForWhatsApp(pick: QuickPurchase)` - Format pick message

**Implementation Notes:**
- Query `QuickPurchase` where:
  - `type = 'prediction'`
  - `isActive = true`
  - `isPredictionActive = true`
  - `matchId` is not null
  - Match date is today or upcoming
- Use `predictionData` JSON field for rich pick details
- Use `matchData` JSON field for match info

#### **2.2 Create `lib/whatsapp-payment.ts`**

**Purpose:** Create Stripe Checkout Sessions for WhatsApp payments

**Key Functions:**
- `createWhatsAppPaymentSession(params)` - Create Stripe Checkout Session
- `getPaymentSessionStatus(sessionId)` - Check payment status

**Implementation Notes:**
- Use **Stripe Checkout Sessions** (not PaymentIntent) for better webview support
- Store `waId` and `matchId` in session metadata
- Set `success_url` to a simple success page
- Set `cancel_url` to a simple cancel page
- Create `WhatsAppPurchase` record with `status: 'pending'`

---

### **Phase 3: Enhanced Webhook Handler** ✅

#### **3.1 Update `app/api/whatsapp/webhook/route.ts`**

**Menu System:**
- `1` or `picks` → Show today's picks
- `2 <matchId>` or `buy <matchId>` → Start purchase flow
- `3` or `help` → Show help
- `menu` or `hi` → Show main menu
- Default → Show menu

**Message Format:**
```
Welcome to SnapBet ⚽🔥

Reply with:
1️⃣ Today's picks
2️⃣ Buy a pick (send: 2 <matchId>)
3️⃣ Help

Example: 2 123456
```

**Pick Display Format:**
```
Here are today's picks 🔥

1) Match ID: 123456
   Arsenal vs Chelsea
   Tip: Arsenal to win
   Confidence: 78%
   Price: $5.00

2) Match ID: 789012
   Barcelona vs Real Madrid
   Tip: Over 2.5 goals
   Confidence: 74%
   Price: $7.50

To buy a pick, reply:
2 <matchId>
Example: 2 123456
```

---

### **Phase 4: Payment Integration** ✅

#### **4.1 Create Payment Session Endpoint**

**New Route:** `app/api/whatsapp/payment/create/route.ts`

**Purpose:** Create Stripe Checkout Session for WhatsApp purchase

**Request:**
```json
{
  "waId": "16783929144",
  "matchId": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "paymentUrl": "https://checkout.stripe.com/pay/cs_...",
  "sessionId": "cs_..."
}
```

**Implementation:**
1. Validate `waId` and `matchId`
2. Get or create `WhatsAppUser` by `waId`
3. Find `QuickPurchase` by `matchId`
4. Check if already purchased (prevent duplicates)
5. Create Stripe Checkout Session with:
   - Amount from `QuickPurchase.price`
   - Metadata: `{ waId, matchId, quickPurchaseId }`
   - Success URL: `https://snapbet.bet/whatsapp/payment/success`
   - Cancel URL: `https://snapbet.bet/whatsapp/payment/cancel`
6. Create `WhatsAppPurchase` record
7. Return payment URL

#### **4.2 Update Stripe Webhook Handler**

**File:** `app/api/payments/webhook/route.ts`

**Add WhatsApp Purchase Handling:**

```typescript
// In handlePaymentSuccess function, add:
if (metadata.waId && metadata.matchId) {
  // This is a WhatsApp purchase
  await handleWhatsAppPaymentSuccess(paymentIntent, metadata);
  return; // Don't process as regular web purchase
}

async function handleWhatsAppPaymentSuccess(
  paymentIntent: Stripe.PaymentIntent,
  metadata: { waId: string; matchId: string; quickPurchaseId: string }
) {
  // 1. Find WhatsAppPurchase by paymentSessionId or paymentIntentId
  // 2. Update status to 'completed'
  // 3. Update WhatsAppUser totalSpend and totalPicks
  // 4. Get pick details from QuickPurchase
  // 5. Send pick via WhatsApp using sendWhatsAppText
}
```

**Alternative:** Use `checkout.session.completed` event (better for Checkout Sessions)

---

### **Phase 5: Pick Delivery** ✅

#### **5.1 Format Pick Message**

**From `QuickPurchase.predictionData` JSON:**
- Extract prediction details
- Format match info from `matchData`
- Include confidence, odds, value rating
- Add stake suggestions

**Message Format:**
```
Payment received ✅

Here is your pick for match 123456:

🏆 Arsenal vs Chelsea
📊 Market: 1X2
💡 Tip: Arsenal to win
📈 Confidence: 78%
💰 Odds: 2.10
⭐ Value Rating: High

📝 Analysis:
[Extract from predictionData.analysis]

💵 Stake suggestion: 1-3% of bankroll
(Not financial advice)

Good luck 🍀
```

---

## 🔐 **Security Considerations**

1. **WhatsApp Number Validation**
   - Validate E.164 format
   - Store without `+` prefix
   - Normalize phone numbers

2. **Payment Session Security**
   - Verify `waId` matches session metadata
   - Prevent duplicate purchases
   - Idempotency keys for payment sessions

3. **Rate Limiting**
   - Limit menu requests per `waId`
   - Prevent spam purchases
   - Cooldown between purchase attempts

4. **Webhook Verification**
   - Verify Stripe webhook signatures
   - Validate payment amounts match QuickPurchase price
   - Check purchase status before sending pick

---

## 📈 **Analytics & Tracking**

### **WhatsAppUser Metrics:**
- Total spend per user
- Total picks purchased
- Average purchase value
- Last activity timestamp
- Country distribution

### **WhatsAppPurchase Metrics:**
- Purchase conversion rate
- Average time to purchase
- Most popular matchIds
- Payment success rate
- Failed payment reasons

---

## 🚀 **Deployment Checklist**

### **Database:**
- [ ] Run Prisma migration
- [ ] Verify indexes created
- [ ] Test queries performance

### **Environment Variables:**
```env
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_VERIFY_TOKEN=snapbet_verify
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
NEXTAUTH_URL=https://snapbet.bet
```

### **Stripe Configuration:**
- [ ] Create Checkout Session webhook endpoint
- [ ] Subscribe to `checkout.session.completed` event
- [ ] Test webhook in Stripe dashboard
- [ ] Configure success/cancel URLs

### **Meta WhatsApp:**
- [ ] Verify webhook URL in Meta dashboard
- [ ] Test webhook verification
- [ ] Subscribe to `messages` events
- [ ] Test message receiving

---

## 🧪 **Testing Plan**

### **Unit Tests:**
- [ ] `getTodaysPicks()` - Returns correct picks
- [ ] `getPickByMatchId()` - Finds correct pick
- [ ] `createWhatsAppPaymentSession()` - Creates valid session
- [ ] Menu parsing - Handles all commands correctly

### **Integration Tests:**
- [ ] Full purchase flow: Menu → Pick → Payment → Delivery
- [ ] Duplicate purchase prevention
- [ ] Invalid matchId handling
- [ ] Payment webhook processing

### **Manual Testing:**
- [ ] Send "1" → Verify picks displayed
- [ ] Send "2 123456" → Verify payment link sent
- [ ] Complete payment → Verify pick delivered
- [ ] Send "3" → Verify help message
- [ ] Send invalid commands → Verify menu shown

---

## 📝 **Code Organization**

### **File Responsibilities:**

**`lib/whatsapp-picks.ts`**
- Database queries for QuickPurchase
- Pick formatting for WhatsApp
- Match data extraction

**`lib/whatsapp-payment.ts`**
- Stripe Checkout Session creation
- Payment session tracking
- Purchase record management

**`lib/whatsapp-service.ts`** (existing)
- WhatsApp API communication
- Message sending
- Error handling

**`app/api/whatsapp/webhook/route.ts`**
- Message routing
- Menu system
- Command parsing
- User interaction flow

**`app/api/whatsapp/payment/create/route.ts`**
- Payment session creation
- Validation
- Purchase record creation

**`app/api/payments/webhook/route.ts`** (existing)
- Stripe webhook handling
- WhatsApp purchase completion
- Pick delivery

---

## 🎯 **Success Metrics**

### **Key Performance Indicators:**
1. **Conversion Rate:** Messages → Purchases
2. **Average Order Value:** Total spend / Total purchases
3. **Time to Purchase:** Menu → Payment completion
4. **Payment Success Rate:** Completed / Attempted
5. **User Retention:** Repeat purchases per `waId`

### **Monitoring:**
- Track all WhatsApp interactions
- Log payment session creation
- Monitor webhook delivery
- Alert on payment failures

---

## 🔄 **Future Enhancements (Post-V1)**

1. **VIP Tiers:** Based on `totalSpend`
2. **Referral System:** WhatsApp-to-WhatsApp referrals
3. **Multi-language Support:** Based on `countryCode`
4. **Payment Methods:** Add Flutterwave/Paystack support
5. **Account Linking:** Link WhatsAppUser to User account
6. **Purchase History:** "4" command to show past purchases
7. **Notifications:** Send match result updates
8. **Interactive Buttons:** Use WhatsApp interactive messages

---

## 📚 **References**

- **Stripe Checkout Sessions:** https://stripe.com/docs/payments/checkout
- **WhatsApp Cloud API:** https://developers.facebook.com/docs/whatsapp/cloud-api
- **QuickPurchase Schema:** See `prisma/schema.prisma`
- **Existing Payment Flow:** See `app/api/payments/webhook/route.ts`

---

## ✅ **Implementation Priority**

### **Must Have (V1):**
1. ✅ Database schema (WhatsAppUser, WhatsAppPurchase)
2. ✅ Menu system (1, 2, 3 commands)
3. ✅ Pick fetching from QuickPurchase
4. ✅ Payment session creation
5. ✅ Stripe webhook integration
6. ✅ Pick delivery via WhatsApp

### **Nice to Have (V2):**
1. Purchase history command
2. VIP tier messaging
3. Multi-language support
4. Payment retry logic
5. Analytics dashboard

---

**Last Updated:** December 1, 2025  
**Status:** Ready for Implementation  
**Estimated Time:** 2-3 days for V1

