# 📱 WhatsApp Message Examples - Complete User Flow

## 🎯 **Overview**

This document shows all WhatsApp messages users will receive, including the enhanced format with dates, odds, and model predictions. All purchase links use **anchor links** (clickable text) instead of full URLs.

---

## 📋 **Message Types**

1. **Main Menu** - Initial welcome message
2. **Today's Picks** - List of available matches (enhanced format)
3. **Purchase Confirmation** - Payment link with anchor
4. **Pick Delivery** - Full prediction after payment
5. **Help Message** - Instructions and examples
6. **Error Messages** - Various error scenarios
7. **Empty States** - No picks available, etc.

---

## 1️⃣ **Main Menu** (`menu`, `hi`, `hello`, `hey`, `0`)

```
Welcome to SnapBet ⚽🔥

Reply with:
1️⃣ Today's picks
2️⃣ Buy a pick (send matchId directly)
3️⃣ Help

Example: Send '123456' to buy pick with matchId 123456
```

**Character Count:** ~150 chars  
**Purpose:** Initial greeting and navigation

---

## 2️⃣ **Today's Picks** (`1` or `picks`)

### **Format A: Enhanced Format (with Market API data)**

```
Here are today's picks 🔥

1) Match ID: 123456
   Arsenal vs Chelsea
   📅 Jan 15, 2025 6:00 PM UTC
   🏆 Premier League
   📊 Market: 1X2
   💡 Tip: Arsenal to win
   📈 Confidence: 78%
   💰 Price: $9.99
   📊 Odds: Home 2.10 | Draw 3.40 | Away 3.20
   📚 5 bookmakers (bet365, pinnacle, unibet)
   🤖 Model: Home Win (78%)

2) Match ID: 789012
   Barcelona vs Real Madrid
   📅 Jan 15, 2025 8:00 PM UTC
   🏆 La Liga
   📊 Market: Over/Under
   💡 Tip: Over 2.5 goals
   📈 Confidence: 82%
   💰 Price: $12.99
   📊 Odds: Over 1.85 | Under 1.95
   📚 7 bookmakers (bet365, pinnacle, unibet, 1xbet)
   🤖 Model: Over 2.5 (82%)

3) Match ID: 345678
   Bayern Munich vs Dortmund
   📅 Jan 16, 2025 2:30 PM UTC
   🏆 Bundesliga
   📊 Market: Both Teams to Score
   💡 Tip: Yes
   📈 Confidence: 75%
   💰 Price: $8.99
   📊 Odds: Yes 1.75 | No 2.10
   📚 4 bookmakers (bet365, pinnacle)
   🤖 Model: BTTS Yes (75%)

To buy a pick, send the matchId directly:

Example:
123456
```

**Character Count:** ~1,200 chars (3 picks)  
**Note:** If > 4096 chars, split into 2 messages

---

### **Format B: Fallback Format (QuickPurchase-only, no Market API)**

```
Here are today's picks 🔥

1) Match ID: 123456
   Arsenal vs Chelsea
   Market: 1X2
   Tip: Arsenal to win
   Confidence: 78%
   Price: $9.99
   Odds: 2.10
   Value: High

2) Match ID: 789012
   Barcelona vs Real Madrid
   Market: Over/Under
   Tip: Over 2.5 goals
   Confidence: 82%
   Price: $12.99
   Odds: 1.85
   Value: Very High

To buy a pick, send the matchId directly:

Example:
123456
```

**Character Count:** ~600 chars (3 picks)  
**Used when:** Market API unavailable

---

## 3️⃣ **Purchase Confirmation** (User sends matchId: `123456`)

### **Format A: With Anchor Link (Recommended)**

```
You're buying this pick 💰

Match ID: 123456
Arsenal vs Chelsea
📅 Jan 15, 2025 6:00 PM UTC
🏆 Premier League
📊 Market: 1X2
💡 Tip: Arsenal to win
📈 Confidence: 78%
💰 Price: $9.99
📊 Odds: Home 2.10 | Draw 3.40 | Away 3.20

Tap here to pay: [Pay Now →]
https://checkout.stripe.com/pay/cs_test_abc123...

Once payment is confirmed, we'll send your full pick details here in WhatsApp ✅
```

**Character Count:** ~350 chars  
**Anchor Link:** `[Pay Now →]` (clickable text)  
**Full URL:** Hidden but functional

---

### **Format B: Alternative Anchor Link Style**

```
You're buying this pick 💰

Match ID: 123456
Arsenal vs Chelsea
📅 Jan 15, 2025 6:00 PM UTC
🏆 Premier League
📊 Market: 1X2
💡 Tip: Arsenal to win
📈 Confidence: 78%
💰 Price: $9.99

💳 Complete Payment: https://checkout.stripe.com/pay/cs_test_abc123...

Once payment is confirmed, we'll send your full pick details here in WhatsApp ✅
```

**Character Count:** ~320 chars  
**Note:** WhatsApp automatically makes URLs clickable, so this works too

---

## 4️⃣ **Pick Delivery** (After successful payment)

```
Payment received ✅

Here is your premium pick for match 123456:

🏆 Arsenal vs Chelsea
📅 Jan 15, 2025 6:00 PM UTC
🏆 Premier League

📊 PREDICTION:
Market: 1X2
Tip: Arsenal to win
Confidence: 78%
💰 Odds: 2.10
⭐ Value Rating: High

🤖 AI VERDICT:
Recommended: Home Win
Confidence: High
Probabilities:
  Home: 75.0%
  Draw: 15.0%
  Away: 10.0%

📈 ML PREDICTION:
Confidence: 78.0%
Home Win: 75.0%
Draw: 15.0%
Away Win: 10.0%

🧠 DETAILED REASONING:
Form: Arsenal has strong home form with 8 wins in last 10 matches. They've scored 24 goals at home this season.
Tactics: Arsenal's pressing game will disrupt Chelsea's build-up play. Their high line forces opponents into mistakes.
Injuries: No major injuries for Arsenal. Chelsea missing key midfielder.
History: Arsenal won last 3 home matches against Chelsea. Head-to-head favors home team.

💡 BETTING INTELLIGENCE:
Primary Bet: Arsenal to win
Value Bets: Over 2.5 goals, Both teams score
Avoid: Chelsea to win, Under 1.5 goals

⚠️ RISK ANALYSIS:
Overall Risk: Medium
Key Risks: Chelsea's counter-attack, referee decisions, weather conditions
Upset Potential: Low

📊 CONFIDENCE BREAKDOWN:
Strong home form (30%), Tactical advantage (25%), Injury situation (20%), Historical data (15%), Market value (10%)

🎯 ADDITIONAL MARKETS:
Over 2.5 Goals: 65.0%
Under 2.5 Goals: 35.0%
Both Teams Score (Yes): 70.0%
Both Teams Score (No): 30.0%
Home Handicap: -0.5
Away Handicap: +0.5

💵 Stake suggestion: 1-3% of bankroll
(Not financial advice)

Good luck 🍀
```

**Character Count:** ~1,800 chars  
**Note:** This is the full prediction data from QuickPurchase

---

## 5️⃣ **Help Message** (`3` or `help`)

```
Help 📲

1️⃣ Today's picks – see top matches + matchIds
2️⃣ Buy a pick – send matchId directly
3️⃣ Help – you're here 😊

You can type MENU anytime to see options again.

Examples:
Send '1' to see picks
Send '123456' to buy pick with matchId 123456

Need support? Contact us at support@snapbet.bet
```

**Character Count:** ~250 chars

---

## 6️⃣ **Error Messages**

### **6.1: Match Not Found**

```
I couldn't find a pick for matchId 123456.

Please send '1' to see today's available picks.
```

**Character Count:** ~80 chars

---

### **6.2: Invalid MatchId Format**

```
MatchId must be a number.

Please send the matchId directly.
Example: 123456
```

**Character Count:** ~70 chars

---

### **6.3: Already Purchased**

```
You have already purchased this pick.

Send '1' to see other available picks.
```

**Character Count:** ~60 chars

---

### **6.4: Payment Link Creation Failed**

```
Sorry, couldn't create payment link right now.

Please try again in a few moments or contact support.
```

**Character Count:** ~80 chars

---

### **6.5: No Picks Available**

```
No picks available for today yet. Check back later 🔄

We're updating our predictions. Try again in a few hours.
```

**Character Count:** ~90 chars

---

### **6.6: Generic Error**

```
Sorry, something went wrong. Please try again or send 'menu' for options.
```

**Character Count:** ~70 chars

---

## 7️⃣ **Empty States**

### **7.1: No Picks (Market API Empty + QuickPurchase Empty)**

```
No picks available for today yet. Check back later 🔄

We're updating our predictions. Try again in a few hours.
```

**Character Count:** ~90 chars

---

### **7.2: Market API Failed, QuickPurchase Empty**

```
No picks available right now.

Our systems are updating. Please try again in a few minutes.
```

**Character Count:** ~80 chars

---

## 8️⃣ **Purchase Flow Messages**

### **8.1: User Sends MatchId (Valid)**

**Response:** Purchase Confirmation (see section 3)

---

### **8.2: User Sends MatchId (Invalid Format)**

```
To buy a pick 💰

Send the matchId directly:
Example: 123456

Or send '1' to see available picks.
```

**Character Count:** ~80 chars

---

### **8.3: User Sends MatchId (Missing)**

```
MatchId is required.

Please send the matchId directly.
Example: 123456
```

**Character Count:** ~60 chars

---

## 9️⃣ **Payment Status Messages**

### **9.1: Payment Successful (Webhook)**

**Response:** Pick Delivery (see section 4)

---

### **9.2: Payment Canceled (User cancels in Stripe)**

```
Payment was canceled.

You can try again by sending the matchId, or send 'menu' for options.
```

**Character Count:** ~80 chars

---

### **9.3: Payment Failed (Stripe webhook)**

```
Payment failed.

Please try again or contact support if the issue persists.
```

**Character Count:** ~60 chars

---

## 🔟 **Message Length Considerations**

### **WhatsApp Limits:**
- **Single Message:** 4,096 characters max
- **Recommended:** Keep under 3,000 chars for readability

### **Splitting Strategy:**

If picks list exceeds 4,096 chars:

**Message 1:**
```
Here are today's picks 🔥 (Part 1/2)

1) Match ID: 123456
   [Full pick details...]

2) Match ID: 789012
   [Full pick details...]

... (continue until ~3,500 chars)
```

**Message 2:**
```
Here are today's picks 🔥 (Part 2/2)

6) Match ID: 345678
   [Full pick details...]

... (remaining picks)

To buy a pick, send the matchId directly.
```

---

## 📊 **Message Statistics**

| Message Type | Avg Length | Max Length | Frequency |
|-------------|------------|------------|-----------|
| Main Menu | 150 | 200 | High |
| Picks List (3 picks) | 1,200 | 4,000 | High |
| Purchase Confirmation | 350 | 400 | Medium |
| Pick Delivery | 1,800 | 2,500 | Medium |
| Help | 250 | 300 | Low |
| Error Messages | 70 | 100 | Low |

---

## 🎨 **Formatting Guidelines**

### **Emojis Used:**
- ⚽ 🔥 - Welcome/Energy
- 📅 - Date/Time
- 🏆 - League
- 📊 - Market/Stats
- 💡 - Tip
- 📈 - Confidence
- 💰 - Price
- 📚 - Bookmakers
- 🤖 - AI/Model
- ✅ - Success
- ⚠️ - Warning
- 💳 - Payment
- 🍀 - Good luck

### **Text Formatting:**
- **Bold:** Not supported in WhatsApp (use *asterisks* for emphasis)
- **Line Breaks:** Use `\n` for spacing
- **Lists:** Use numbers (1), 2), 3)) or emojis (1️⃣, 2️⃣, 3️⃣)
- **Links:** WhatsApp auto-detects URLs, or use anchor text

---

## 🔗 **Anchor Link Implementation**

### **Option 1: WhatsApp-Style Link (Recommended)**

```
Tap here to pay: https://checkout.stripe.com/pay/cs_test_abc123...
```

**How it works:**
- WhatsApp automatically makes URLs clickable
- Short, clean message
- User sees full URL (but it's clickable)

---

### **Option 2: Descriptive Link**

```
💳 Complete Payment: https://checkout.stripe.com/pay/cs_test_abc123...
```

**How it works:**
- Emoji + descriptive text before URL
- Still clickable
- More user-friendly

---

### **Option 3: Shortened URL (If Available)**

```
Tap here to pay: https://snapbet.bet/pay/abc123
```

**How it works:**
- Shorter, cleaner URL
- Redirects to Stripe Checkout
- More professional appearance

---

## 📱 **Complete User Flow Example**

### **Scenario: User buys a pick**

**1. User sends:** `menu`
**Response:** Main Menu

**2. User sends:** `1`
**Response:** Today's Picks (enhanced format)

**3. User sends:** `123456`
**Response:** Purchase Confirmation with anchor link

**4. User clicks link, completes payment**
**Response:** Pick Delivery (full prediction)

---

## ✅ **Implementation Notes**

1. **Anchor Links:** Use descriptive text + URL (WhatsApp auto-makes clickable)
2. **Message Length:** Monitor and split if > 4,000 chars
3. **Emojis:** Use sparingly for readability
4. **Formatting:** Consistent spacing and structure
5. **Error Handling:** Clear, actionable error messages
6. **Fallbacks:** Graceful degradation if data missing

---

**Status:** 📋 **READY FOR IMPLEMENTATION**

**Next Action:** Review examples, confirm format preferences, then implement.

