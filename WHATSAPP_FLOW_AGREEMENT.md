# 📱 WhatsApp Pick Selling - Flow Agreement (Low-Risk Approach)

## ✅ **Core Principle: Zero Risk to Existing System**

- **NO modifications** to `QuickPurchase` table
- **NO modifications** to `Purchase` table  
- **NO modifications** to `User` table
- **ONLY** add 2 new tables: `WhatsAppUser` and `WhatsAppPurchase`
- Use `prisma db push` (not migrations)

---

## 🗄️ **Database Changes (Minimal)**

### **New Table 1: WhatsAppUser**
```prisma
model WhatsAppUser {
  id            String   @id @default(cuid())
  waId          String   @unique  // WhatsApp number: "16783929144" (no +)
  totalSpend    Decimal  @default(0)
  totalPicks    Int      @default(0)
  firstSeenAt   DateTime @default(now())
  lastSeenAt    DateTime @updatedAt
  isActive      Boolean  @default(true)
  
  purchases     WhatsAppPurchase[]
  
  @@index([waId])
}
```

### **New Table 2: WhatsAppPurchase**
```prisma
model WhatsAppPurchase {
  id                String        @id @default(cuid())
  waUserId          String
  quickPurchaseId   String        // Link to existing QuickPurchase
  amount            Decimal
  currency          String        @default("USD")
  paymentSessionId  String        // Stripe Checkout Session ID
  paymentIntentId   String?       // After payment completes
  status            String        // pending, completed, failed
  purchasedAt       DateTime?
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
  
  waUser            WhatsAppUser  @relation(fields: [waUserId], references: [id])
  quickPurchase     QuickPurchase @relation(fields: [quickPurchaseId], references: [id])
  
  @@index([waUserId])
  @@index([quickPurchaseId])
  @@index([paymentSessionId])
  @@index([status])
}
```

### **Add to QuickPurchase (Read-Only Relation)**
```prisma
model QuickPurchase {
  // ... ALL EXISTING FIELDS UNCHANGED ...
  whatsappPurchases WhatsAppPurchase[]  // Just add this relation
}
```

**Risk Level:** ✅ **ZERO** - Only adding a relation, no field changes

---

## 🔄 **User Flow**

### **Step 1: User Sends "1" (View Picks)**
```
User → WhatsApp → "1"
     ↓
Webhook receives message
     ↓
Query QuickPurchase table:
  - type = 'prediction'
  - isActive = true
  - isPredictionActive = true
  - matchId IS NOT NULL
  - Match date is today/upcoming
     ↓
Format picks with matchId
     ↓
Send WhatsApp message with picks
```

**Data Source:** Read-only from `QuickPurchase` table

---

### **Step 2: User Sends "2 123456" (Buy Pick)**
```
User → WhatsApp → "2 123456"
     ↓
Extract matchId: "123456"
     ↓
Find QuickPurchase by matchId
     ↓
Check if WhatsAppUser exists (by waId)
  - If not, create WhatsAppUser
     ↓
Check if already purchased:
  - Query WhatsAppPurchase where:
    - waUserId = user.id
    - quickPurchaseId = found QuickPurchase.id
    - status = 'completed'
  - If exists → "You already bought this pick"
     ↓
Create Stripe Checkout Session:
  - Amount: QuickPurchase.price
  - Metadata: { waId, matchId, quickPurchaseId }
     ↓
Create WhatsAppPurchase record:
  - status = 'pending'
  - paymentSessionId = session.id
     ↓
Send payment link via WhatsApp
```

**Data Source:** 
- Read from `QuickPurchase` (by matchId)
- Write to `WhatsAppUser` (create if needed)
- Write to `WhatsAppPurchase` (new record)

---

### **Step 3: User Clicks Payment Link**
```
User clicks link in WhatsApp
     ↓
Opens Stripe Checkout in WhatsApp webview
     ↓
User completes payment
     ↓
Stripe processes payment
```

**No code changes needed** - Stripe handles this

---

### **Step 4: Stripe Webhook → Send Pick**
```
Stripe → Webhook → /api/payments/webhook
     ↓
Event: checkout.session.completed
     ↓
Extract metadata:
  - waId
  - matchId
  - quickPurchaseId
     ↓
Find WhatsAppPurchase by paymentSessionId
     ↓
Update WhatsAppPurchase:
  - status = 'completed'
  - paymentIntentId = session.payment_intent
  - purchasedAt = now()
     ↓
Update WhatsAppUser:
  - totalSpend += amount
  - totalPicks += 1
     ↓
Get QuickPurchase by quickPurchaseId
     ↓
Extract pick details from:
  - QuickPurchase.predictionData (JSON)
  - QuickPurchase.matchData (JSON)
  - QuickPurchase.confidenceScore
  - QuickPurchase.odds
     ↓
Format pick message
     ↓
Send pick via WhatsApp to waId
```

**Data Source:**
- Read from `QuickPurchase` (by quickPurchaseId)
- Update `WhatsAppPurchase` (status)
- Update `WhatsAppUser` (totals)
- Send via WhatsApp API

---

## 📊 **Data Flow Diagram**

```
┌─────────────┐
│ QuickPurchase│  (READ-ONLY - No changes)
│  - matchId   │
│  - price     │
│  - predictionData │
│  - matchData │
└──────┬──────┘
       │
       │ (lookup by matchId)
       │
       ▼
┌──────────────────┐
│ WhatsAppUser     │  (NEW - Write only)
│  - waId          │
│  - totalSpend    │
│  - totalPicks    │
└──────┬───────────┘
       │
       │ (relation)
       │
       ▼
┌──────────────────┐
│ WhatsAppPurchase │  (NEW - Write only)
│  - quickPurchaseId│ → Links to QuickPurchase
│  - paymentSessionId│
│  - status        │
└──────────────────┘
```

---

## 🔍 **Key Lookups**

### **Finding Picks (Menu "1")**
```typescript
// Query QuickPurchase - READ ONLY
const picks = await prisma.quickPurchase.findMany({
  where: {
    type: 'prediction',
    isActive: true,
    isPredictionActive: true,
    matchId: { not: null },
    // Add date filter for today/upcoming
  },
  select: {
    matchId: true,
    name: true,
    price: true,
    confidenceScore: true,
    predictionData: true,
    matchData: true,
  }
})
```

### **Finding Pick by MatchId (Menu "2")**
```typescript
// Query QuickPurchase - READ ONLY
const pick = await prisma.quickPurchase.findUnique({
  where: { matchId: "123456" },
  select: {
    id: true,              // For WhatsAppPurchase.quickPurchaseId
    matchId: true,
    price: true,
    predictionData: true,
    matchData: true,
    confidenceScore: true,
  }
})
```

### **Checking if Already Purchased**
```typescript
// Query WhatsAppPurchase - READ ONLY
const existing = await prisma.whatsAppPurchase.findFirst({
  where: {
    waUserId: waUser.id,
    quickPurchaseId: pick.id,
    status: 'completed'
  }
})
```

---

## 🛡️ **Risk Mitigation**

### **What We're NOT Touching:**
- ✅ `QuickPurchase` table structure (only adding relation)
- ✅ `Purchase` table (completely separate)
- ✅ `User` table (completely separate)
- ✅ Existing payment flow (completely separate)

### **What We're Adding:**
- ✅ `WhatsAppUser` table (new, isolated)
- ✅ `WhatsAppPurchase` table (new, isolated)
- ✅ One relation on `QuickPurchase` (read-only, no risk)

### **Separation:**
- Web purchases → `Purchase` table → `User` table
- WhatsApp purchases → `WhatsAppPurchase` table → `WhatsAppUser` table
- **No overlap, no conflicts**

---

## 📝 **Implementation Checklist**

### **Database (db push):**
- [ ] Add `WhatsAppUser` model to schema
- [ ] Add `WhatsAppPurchase` model to schema
- [ ] Add `whatsappPurchases` relation to `QuickPurchase`
- [ ] Run `npx prisma db push`
- [ ] Verify tables created correctly

### **Code (New Files Only):**
- [ ] `lib/whatsapp-picks.ts` - Read from QuickPurchase
- [ ] `lib/whatsapp-payment.ts` - Create payment sessions
- [ ] `app/api/whatsapp/payment/create/route.ts` - Payment endpoint
- [ ] Update `app/api/whatsapp/webhook/route.ts` - Menu system
- [ ] Update `app/api/payments/webhook/route.ts` - WhatsApp purchase handling

### **No Changes To:**
- ❌ `QuickPurchase` table structure
- ❌ `Purchase` table
- ❌ `User` table
- ❌ Existing payment endpoints
- ❌ Existing webhook handlers (except adding WhatsApp case)

---

## 🎯 **Success Criteria**

1. ✅ User can view picks via "1"
2. ✅ User can buy pick via "2 <matchId>"
3. ✅ Payment link opens in WhatsApp
4. ✅ After payment, pick is delivered via WhatsApp
5. ✅ No impact on existing web purchase flow
6. ✅ No database conflicts or data loss risk

---

## ❓ **Questions to Confirm**

1. **Payment Provider:** Using Stripe Checkout Sessions? (assumed yes)
2. **Currency:** Default to USD or detect from QuickPurchase.countryId?
3. **Duplicate Prevention:** Block if already purchased, or allow re-purchase?
4. **Pick Format:** Use `predictionData` JSON as-is, or format specific fields?
5. **Error Handling:** What if matchId not found? What if payment fails?

---

## ✅ **Agreement Points**

- [ ] Use `db push` (not migrations)
- [ ] Only add 2 new tables
- [ ] Don't modify QuickPurchase structure
- [ ] Read-only access to QuickPurchase
- [ ] Separate WhatsApp flow from web flow
- [ ] Use matchId for lookup
- [ ] Use quickPurchaseId for linking

---

**Status:** Ready for Agreement  
**Risk Level:** ✅ **MINIMAL**  
**Estimated Implementation:** 2-3 days

