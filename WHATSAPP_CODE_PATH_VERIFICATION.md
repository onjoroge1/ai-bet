# ✅ WhatsApp Code Path Verification

## Summary

Both the **production webhook** (`/api/whatsapp/webhook`) and **test endpoint** (`/api/whatsapp/test-command`) now use **identical code paths** for all messages.

---

## 📋 **Message "1" - Today's Picks**

### **Production Webhook:**
```typescript
// app/api/whatsapp/webhook/route.ts
if (lower === "1" || lower === "picks") {
  await sendTodaysPicks(normalizedWaId);
}

async function sendTodaysPicks(to: string) {
  const picks = await getTodaysPicks();
  const message = formatPicksList(picks);
  await sendWhatsAppText(to, message);
}
```

### **Test Endpoint:**
```typescript
// app/api/whatsapp/test-command/route.ts
if (lowerCommand === "1" || lowerCommand === "picks") {
  const picks = await getTodaysPicks();
  messageToSend = formatPicksList(picks);
}
```

**✅ Status:** **IDENTICAL** - Both use `getTodaysPicks()` and `formatPicksList()`

---

## 📋 **Message "2" or MatchId - AI Analysis**

### **Production Webhook:**
```typescript
// app/api/whatsapp/webhook/route.ts
async function handleBuyByMatchId(waId: string, matchId: string) {
  const quickPurchase = await prisma.quickPurchase.findUnique({
    where: { matchId },
    include: { country: { select: { currencyCode: true, currencySymbol: true } } },
  });

  const matchData = quickPurchase.matchData as {
    homeTeam?: { name?: string };
    awayTeam?: { name?: string };
    league?: { name?: string };
    startTime?: string;
  } | null;

  const predictionData = quickPurchase.predictionData as any;

  const homeTeam = matchData?.homeTeam?.name || quickPurchase.name.split(" vs ")[0] || "Team A";
  const awayTeam = matchData?.awayTeam?.name || quickPurchase.name.split(" vs ")[1] || "Team B";
  const market = predictionData?.market || quickPurchase.predictionType || "1X2";
  const tip = predictionData?.tip || predictionData?.prediction || quickPurchase.predictionType || "Win";

  const message = formatPickDeliveryMessage({
    matchId: quickPurchase.matchId!,
    homeTeam,
    awayTeam,
    market,
    tip,
    confidence: quickPurchase.confidenceScore || 75,
    odds: quickPurchase.odds ? Number(quickPurchase.odds) : undefined,
    valueRating: quickPurchase.valueRating || undefined,
    consensusOdds: undefined,
    isConsensusOdds: false,
    primaryBook: undefined,
    booksCount: undefined,
    predictionData: predictionData,
  });

  await sendWhatsAppText(waId, message);
}
```

### **Test Endpoint:**
```typescript
// app/api/whatsapp/test-command/route.ts
const quickPurchase = await prisma.quickPurchase.findUnique({
  where: { matchId: matchIdToUse },
  include: {
    country: { select: { currencyCode: true, currencySymbol: true } },
  },
});

const matchData = quickPurchase.matchData as {
  homeTeam?: { name?: string };
  awayTeam?: { name?: string };
  league?: { name?: string };
  startTime?: string;
} | null;

const predictionData = quickPurchase.predictionData as any;

const homeTeam = matchData?.homeTeam?.name || quickPurchase.name.split(" vs ")[0] || "Team A";
const awayTeam = matchData?.awayTeam?.name || quickPurchase.name.split(" vs ")[1] || "Team B";
const market = predictionData?.market || quickPurchase.predictionType || "1X2";
const tip = predictionData?.tip || predictionData?.prediction || quickPurchase.predictionType || "Win";

messageToSend = formatPickDeliveryMessage({
  matchId: quickPurchase.matchId!,
  homeTeam,
  awayTeam,
  market,
  tip,
  confidence: quickPurchase.confidenceScore || 75,
  odds: quickPurchase.odds ? Number(quickPurchase.odds) : undefined,
  valueRating: quickPurchase.valueRating || undefined,
  consensusOdds: undefined,
  isConsensusOdds: false,
  primaryBook: undefined,
  booksCount: undefined,
  predictionData: predictionData,
});
```

**✅ Status:** **IDENTICAL** - Both use the same extraction logic and `formatPickDeliveryMessage()`

---

## 📋 **Payment Webhook (if old payment session completes)**

### **Before Fix:**
```typescript
// app/api/payments/webhook/route.ts (OLD)
const pick = await getPickByMatchId(matchId);
const pickWithData = { ...pick, predictionData };
const message = formatPickDeliveryMessage(pickWithData);
```

**❌ Issue:** Used `getPickByMatchId()` which returns a different structure

### **After Fix:**
```typescript
// app/api/payments/webhook/route.ts (NEW)
// Extract match and prediction data (same as handleBuyByMatchId)
const matchData = whatsappPurchase.quickPurchase.matchData as {
  homeTeam?: { name?: string };
  awayTeam?: { name?: string };
  league?: { name?: string };
  startTime?: string;
} | null;

const predictionData = whatsappPurchase.quickPurchase.predictionData as any;

const homeTeam = matchData?.homeTeam?.name || whatsappPurchase.quickPurchase.name.split(" vs ")[0] || "Team A";
const awayTeam = matchData?.awayTeam?.name || whatsappPurchase.quickPurchase.name.split(" vs ")[1] || "Team B";
const market = predictionData?.market || whatsappPurchase.quickPurchase.predictionType || "1X2";
const tip = predictionData?.tip || predictionData?.prediction || whatsappPurchase.quickPurchase.predictionType || "Win";

const message = formatPickDeliveryMessage({
  matchId: whatsappPurchase.quickPurchase.matchId!,
  homeTeam,
  awayTeam,
  market,
  tip,
  confidence: whatsappPurchase.quickPurchase.confidenceScore || 75,
  odds: whatsappPurchase.quickPurchase.odds ? Number(whatsappPurchase.quickPurchase.odds) : undefined,
  valueRating: whatsappPurchase.quickPurchase.valueRating || undefined,
  consensusOdds: undefined,
  isConsensusOdds: false,
  primaryBook: undefined,
  booksCount: undefined,
  predictionData: predictionData,
});
```

**✅ Status:** **NOW IDENTICAL** - Uses same extraction logic as direct webhook

---

## 🔍 **Why You Saw "Payment received ✅"**

The "Payment received ✅" message you saw was from an **old payment session** that was completing. This happens when:

1. **Old payment session exists** - A Stripe Checkout Session was created before we removed payment
2. **Session completes** - User completes payment (or session expires/auto-completes)
3. **Payment webhook fires** - Stripe sends `checkout.session.completed` event
4. **Old code runs** - Payment webhook was using different extraction logic

**Solution:** I've updated the payment webhook to use the **same extraction logic** as the direct webhook, so all three paths now produce identical messages.

---

## ✅ **Verification Checklist**

- [x] Message "1" uses same `getTodaysPicks()` and `formatPicksList()` in both paths
- [x] Message "2"/matchId uses same extraction logic in both paths
- [x] Payment webhook uses same extraction logic as direct webhook
- [x] All paths use same `formatPickDeliveryMessage()` function
- [x] All paths extract data from `QuickPurchase` the same way
- [x] Type definitions are identical (no more `as any` differences)

---

## 🎯 **Result**

**All three code paths now produce identical messages:**
1. ✅ Direct webhook (`/api/whatsapp/webhook`)
2. ✅ Test endpoint (`/api/whatsapp/test-command`)
3. ✅ Payment webhook (`/api/payments/webhook`)

The message format is now consistent across all entry points!

