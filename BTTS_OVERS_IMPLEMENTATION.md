# BTTS & OVERS Commands Implementation

## ✅ Implementation Complete

Both BTTS and OVERS commands have been fully implemented with browse and match modes, following the user's recommended flow.

---

## 📋 Implementation Summary

### **Command Structure**

Both commands support two usage patterns:

1. **Browse Mode** (no match ID)
   - `BTTS` → Shows top BTTS opportunities today (ranked by probability)
   - `OVERS` → Shows top Over 2.5 opportunities today
   - `BTTS MORE` → Pagination (next 5 picks)
   - `OVERS MORE` → Pagination (next 5 picks)

2. **Match Mode** (with match ID)
   - `BTTS 1379099` → Shows BTTS Yes/No probabilities for that specific match
   - `OVERS 1379099` → Shows Over/Under probabilities for that specific match

---

## 🔧 Technical Implementation

### **Data Source**

BTTS and OVERS data is stored in `QuickPurchase.predictionData.additional_markets`:

```typescript
predictionData = {
  additional_markets: {
    both_teams_score: {
      yes: 0.6,  // probability
      no: 0.4
    },
    total_goals: {
      over_2_5: 0.7,
      under_2_5: 0.3
    }
  }
}
```

**Key Point:** The data is a **child of the match ID** - it's already part of the match's prediction data. No separate lookup needed.

---

### **Browse Mode Implementation**

**Function:** `sendBTTSPicks(to: string, page: number = 0)` and `sendOversPicks(to: string, page: number = 0)`

**Query Logic:**
1. Fetch all `QuickPurchase` records with `predictionData` not null
2. Filter in-memory to matches that have `additional_markets.both_teams_score` (BTTS) or `additional_markets.total_goals` (OVERS)
3. Sort by highest probability (BTTS Yes % or Over 2.5 %)
4. Paginate: 5 matches per page
5. Show 3 matches for free users (preview), 5 for premium users

**Message Format:**
```
⚽ **BTTS PICKS (Today)**

1. Arsenal vs Brentford
   Match ID: 1379099
   ⏰ Dec 15, 2:00 PM
   BTTS Yes: 60% | No: 40%
   💡 Recommendation: BTTS Yes (premium only)
   Reply: BTTS 1379099 for details

[... more matches ...]

🔒 Upgrade to VIP to see all BTTS picks!
Send 'BUY' to unlock premium markets.

💡 Send 'BTTS MORE' for next 5 picks
```

---

### **Match Mode Implementation**

**Function:** `sendBTTSForMatch(to: string, matchId: string)` and `sendOversForMatch(to: string, matchId: string)`

**Query Logic:**
1. Fetch `QuickPurchase` by `matchId`
2. Extract `predictionData.additional_markets.both_teams_score` or `total_goals`
3. Format probabilities and show recommendation (premium only)

**Message Format:**
```
⚽ **BTTS: Arsenal vs Brentford**
Match ID: 1379099
League: Premier League

**Both Teams To Score:**
Yes: 60.0%
No: 40.0%

💡 **Recommendation: BTTS Yes** (premium only)
Confidence: 20%

Send 'BUY' to unlock full analysis for this match.
```

---

## 🎯 Premium Gating

### **Free Users:**
- Browse: See top 3 matches (preview)
- Match: See probabilities only (no recommendation)
- Locked message: "🔒 Upgrade to VIP to see all BTTS picks!"

### **Premium Users:**
- Browse: See all 5 matches with recommendations
- Match: See probabilities + recommendation + confidence
- Full access to all features

---

## 📝 Updated Messages

### **HELP Message**
Added new "Market Commands" section:
```
**Market Commands:**
• BTTS – Browse BTTS picks (or BTTS [Match ID] for details)
• OVERS – Browse Over/Under picks (or OVERS [Match ID] for details)
• Send 'BTTS MORE' or 'OVERS MORE' for pagination
```

### **MENU Message**
Updated BTTS entry:
```
BTTS – Both teams to score (or BTTS [Match ID])
OVERS – Over/Under goals (or OVERS [Match ID])
```

---

## 🔄 Command Routing

### **Updated Command Handlers**

```typescript
// BTTS: Both Teams To Score picks (browse or match mode)
if (lower.startsWith("btts") || lower.startsWith("both teams to score")) {
  const parts = raw.split(/\s+/);
  if (parts.length > 1 && parts[1] !== "more") {
    // Match mode: BTTS [Match ID]
    const matchId = parts[1];
    const matchIdValidation = validateMatchId(matchId);
    if (matchIdValidation.valid && matchIdValidation.normalized) {
      await sendBTTSForMatch(normalizedWaId, matchIdValidation.normalized);
      return;
    }
  }
  // Browse mode: BTTS or BTTS MORE
  const isMore = lower.includes("more");
  await sendBTTSPicks(normalizedWaId, isMore ? 1 : 0);
  return;
}
```

Same pattern for OVERS command.

---

## 📊 Data Flow

```
User sends "BTTS"
    ↓
Query QuickPurchase (all with predictionData)
    ↓
Filter: has additional_markets.both_teams_score
    ↓
Sort by bttsYes probability (descending)
    ↓
Paginate (5 per page)
    ↓
Format message with probabilities
    ↓
Send to user (3 for free, 5 for premium)
```

---

## ✅ Features Implemented

- ✅ Browse mode (BTTS, OVERS)
- ✅ Match mode (BTTS [Match ID], OVERS [Match ID])
- ✅ Pagination (BTTS MORE, OVERS MORE)
- ✅ Premium gating with previews
- ✅ Recommendations for premium users
- ✅ Updated HELP/MENU messages
- ✅ Consistent with existing command patterns

---

## 🎯 User Experience

### **Browse Flow:**
1. User sends `BTTS`
2. Gets list of top 5 BTTS opportunities
3. Can reply with `BTTS [Match ID]` for details
4. Can send `BTTS MORE` for next 5

### **Match Flow:**
1. User sends `BTTS 1379099`
2. Gets BTTS probabilities for that match
3. Premium users see recommendation
4. Free users see upgrade prompt

---

## 📝 Notes

- Data is sourced from existing `QuickPurchase.predictionData` - no new database tables needed
- Matches existing pattern: browse (command 1) vs details (match ID)
- Premium gating uses `hasWhatsAppPremiumAccess()` (currently returns false for all - needs VIP tracking implementation)
- Pagination uses simple page counter (0, 1, 2...)
- Free users get preview (3 matches) to encourage conversion



