# WhatsApp Commands & Messages Reference

## Current Commands (Implemented)

| Command | Message Format | Data Source |
|---------|---------------|-------------|
| **BTTS** (browse) | `⚽ **BTTS PICKS (Today)**` + list of 5 matches with BTTS Yes/No % | `predictionData.additional_markets.both_teams_score` or `additional_markets_flat.btts_yes/btts_no` |
| **BTTS [Match ID]** | `⚽ **BTTS: [Home] vs [Away]**` + BTTS Yes/No % + recommendation | Same as above, single match |
| **OVERS** (browse) | `📊 **GOAL MARKETS (Over/Under 2.5)**` + list of 5 matches | `predictionData.additional_markets.total_goals` or `additional_markets_flat.totals_over_*` |
| **OVERS [Match ID]** | `📈 **GOALS ANALYSIS**` + ALL goal lines (0.5-4.5) + best market | `additional_markets_flat.totals_over_0_5` through `totals_over_4_5` or `additional_markets_v2.totals` |
| **UNDERS** (browse) | `📉 **UNDER 2.5 PICKS (Today)**` + list of 5 matches | Same as OVERS |
| **UNDERS [Match ID]** | `📉 **UNDER GOALS ANALYSIS**` + ALL under lines (0.5-4.5) + best market | Same as OVERS [Match ID] |
| **BUY** | VIP subscription plans with payment links | Dynamic pricing from `PackageOfferCountryPrice` |
| **VIP** | VIP pricing & plans | Static message |
| **MENU** | Full command list | `lib/whatsapp-messages.ts` |
| **HELP** | How SnapBet works + command guide | `lib/whatsapp-messages.ts` |
| **STATUS** | Account status (plan, expiry) | `WhatsAppUser` + `UserPackage` |
| **PARLAY** | AI parlay picks | `ParlayConsensus` table |

---

## New Commands to Implement

| Command | Proposed Message | Data Source |
|---------|-----------------|-------------|
| **CS** (browse) | See below | `additional_markets_v2.correct_scores` |
| **CS [Match ID]** | See below | Same |
| **REASON [Match ID]** | See below | `comprehensive_analysis.ai_verdict.team_analysis` |
| **RISK [Match ID]** | See below | `comprehensive_analysis.ai_verdict.risk_assessment` + `betting_recommendations` |
| **CONFIDENCE [Match ID]** | See below | `comprehensive_analysis.ml_prediction` + `predictions` |
| **VALUE [Match ID]** | See below | `QuickPurchase.odds` + `valueRating` + `predictions` |
| **ALT [Match ID]** | See below | `additional_markets_v2` (btts, totals, double_chance, dnb) |
| **STATS [Match ID]** | See below | `data_freshness` + `comprehensive_analysis` |
| **MORE [Match ID]** | See below | All available markets aggregated |

---

## Detailed Message Formats

### 1. BTTS (Browse Mode)
```
⚽ BTTS OPPORTUNITIES

Top matches with BTTS YES.

1. Liverpool vs Brighton
   Match ID: 1379122
   ⏰ Dec 13, 03:00 PM
   BTTS Yes: 41% | No: 59%
   Reply: BTTS 1379122 for details

2. West Ham vs Aston Villa
   ...

👉 Want goal lines or score predictions?

Reply with:
OVERS [MATCH ID]
UNDERS [MATCH ID]
```

### 2. OVERS (Browse Mode)
```
📈 OVER 2.5 GOALS

Top goal-heavy matches.

1. Liverpool vs Brighton
   Match ID: 1379122
   ⏰ Dec 13, 03:00 PM
   Over 2.5: 34% | Under 2.5: 66%
   Reply: OVERS 1379122 for details

👉 Want BTTS or under markets?

Reply with:
BTTS [MATCH ID]
UNDERS [MATCH ID]
```

### 3. UNDERS (Browse Mode)
```
📉 UNDER 2.5 GOALS

Top low-scoring matches.

1. Real Sociedad II vs Sporting Gijon
   Match ID: 1391942
   ⏰ Dec 6, 05:30 PM
   Under 2.5: 66% | Over 2.5: 34%
   Reply: UNDERS 1391942 for details

👉 Want BTTS or over markets?

Reply with:
BTTS [MATCH ID]
OVERS [MATCH ID]
```

### 4. BTTS [Match ID]
```
⚽ BTTS ANALYSIS

Real Sociedad II vs Sporting Gijon
Match ID: 1391942

🎯 ADDITIONAL MARKETS:

Both Teams Score (Yes): 41.3%
Both Teams Score (No): 58.7%

💡 Recommendation: BTTS No

👉 Want goal lines or score predictions?

Reply with:
OVERS 1391942
CS 1391942
```

### 5. OVERS [Match ID]
```
📈 GOALS ANALYSIS

Real Sociedad II vs Sporting Gijon
Match ID: 1391942

🎯 GOAL MARKETS:

Over 0.5: 87% | Under 0.5: 13%
Over 1.5: 61% | Under 1.5: 39%
Over 2.5: 34% | Under 2.5: 66%
Over 3.5: 16% | Under 3.5: 84%
Over 4.5: 6% | Under 4.5: 94%

💡 Best Market: Under 2.5 (66%)

👉 Want other markets?

Reply: UNDERS 1391942
Reply: CS 1391942
```

### 6. UNDERS [Match ID]
```
📉 UNDER GOALS ANALYSIS

Real Sociedad II vs Sporting Gijon
Match ID: 1391942

🎯 UNDER MARKETS:

Under 4.5: 94% | Over 4.5: 6%
Under 3.5: 84% | Over 3.5: 16%
Under 2.5: 66% | Over 2.5: 34%
Under 1.5: 39% | Over 1.5: 61%
Under 0.5: 13% | Over 0.5: 87%

💡 Best Under Market: Under 3.5 (84%)

👉 Want other markets?

Reply: OVERS 1391942
Reply: CS 1391942
```

### 7. CS (Correct Score - Browse)
```
🎯 CORRECT SCORES

High-odds score picks.

1. Real Sociedad II vs Sporting Gijon
   Match ID: 1391942
   Top Score: 0-1 (14.1%)
   Reply: CS 1391942 for details

👉 Want deeper markets?

Reply with:
MORE [MATCH ID]
```

### 8. CS [Match ID]
```
🎯 CORRECT SCORE ANALYSIS

Real Sociedad II vs Sporting Gijon
Match ID: 1391942

📊 TOP PREDICTED SCORES:

1. 0-1: 14.1%
2. 1-1: 13.4%
3. 0-0: 12.6%
4. 1-0: 12.0%
5. 0-2: 7.9%

Other: 13.8%

💡 Best Value: 0-1 (Away win by 1)

👉 Want other markets?

Reply: BTTS 1391942
Reply: OVERS 1391942
```

### 9. REASON [Match ID]
```
🧠 WHY THIS PICK

Real Sociedad II vs Sporting Gijon

🏠 Real Sociedad II:
✅ Strengths: Strong head-to-head performance, Ability to win close matches
⚠️ Weaknesses: Inconsistent performance, Defensive vulnerabilities
🏥 Injuries: No significant injuries reported

✈️ Sporting Gijon:
✅ Strengths: Solid defensive performances, Potential to capitalize on lapses
⚠️ Weaknesses: Struggle to convert draws into wins, Away losses
🏥 Injuries: No significant injuries reported

👉 Want to understand the risk?

Reply with:
RISK 1391942
ALT 1391942
```

### 10. RISK [Match ID]
```
⚠️ RISK CHECK

Real Sociedad II vs Sporting Gijon
Match ID: 1391942

Risk Level: Medium
Suggested Stake: Moderate

Main Risks:
• Real Sociedad II's strong head-to-head record
• Sporting Gijon's inability to secure wins

👉 Want lower-risk options?

Reply with:
ALT 1391942
BTTS 1391942
OVERS 1391942
```

### 11. CONFIDENCE [Match ID]
```
📊 CONFIDENCE BREAKDOWN

Real Sociedad II vs Sporting Gijon
Match ID: 1391942

Home Win: 30.7%
Draw: 30.1%
Away Win: 39.3%

Model: pre_computed_consensus
Quality Score: 17.4%

💡 Lean: Away Win (small stake)

👉 Want value analysis?

Reply: VALUE 1391942
```

### 12. VALUE [Match ID]
```
💰 VALUE CHECK

Real Sociedad II vs Sporting Gijon
Match ID: 1391942

Market: Away Win
AI Probability: 39.3%
Consensus Odds: 3.72
Value Rating: Medium

💡 Moderate value detected

👉 Want confidence breakdown?

Reply: CONFIDENCE 1391942
```

### 13. ALT [Match ID]
```
🔁 ALTERNATIVE BETS

Real Sociedad II vs Sporting Gijon
Match ID: 1391942

• BTTS: No (58.7%)
• Over/Under 2.5: Under (65.8%)
• Double Chance 1X: 60.7%
• Double Chance X2: 69.3%
• DNB Away: 56.1%

👉 Want probabilities for these?

Reply with:
BTTS 1391942
OVERS 1391942
```

### 14. STATS [Match ID]
```
📈 MATCH STATS SNAPSHOT

Real Sociedad II vs Sporting Gijon
Match ID: 1391942

• H2H Matches: 3
• Form Window: 5 matches
• Home Injuries: 0
• Away Injuries: 0

Home Form: Mixed (2W, 1D, 2L)
Away Form: Struggling (0W, 3D, 2L)

👉 Want value analysis?

Reply: CONFIDENCE 1391942
```

### 15. MORE [Match ID]
```
📊 ALL MARKETS

Real Sociedad II vs Sporting Gijon
Match ID: 1391942

**1X2:**
Home: 30.7% | Draw: 30.1% | Away: 39.3%

**BTTS:**
Yes: 41.3% | No: 58.7%

**Total Goals:**
Over 2.5: 34.2% | Under 2.5: 65.8%

**Double Chance:**
1X: 60.7% | X2: 69.3% | 12: 69.9%

**DNB:**
Home: 43.9% | Away: 56.1%

**Win to Nil:**
Home: 20.0% | Away: 26.1%

👉 Get specific analysis:

Reply: BTTS 1391942
Reply: OVERS 1391942
Reply: CS 1391942
```

### 16. STATUS
```
📊 ACCOUNT STATUS

Phone: +1234567890
Plan: Monthly VIP
Expires: Dec 31, 2025

✅ VIP Active

👉 Renew or upgrade:

Reply: BUY
```

### 17. PARLAY
```
🔗 AI PARLAY

High-odds parlay ticket.

Leg 1: Liverpool vs Brighton - Draw (4.15)
Leg 2: West Ham vs Aston Villa - Home (3.72)

Combined Odds: 15.43
Confidence: High
Edge: 25.4%

👉 Get match details:

Reply: 1379122
Reply: 1379126
```

---

## Data Source Reference

| Field | Location in predictionData |
|-------|---------------------------|
| Goal Lines (0.5-4.5) | `additional_markets_flat.totals_over_*` / `additional_markets_v2.totals` |
| BTTS | `additional_markets_flat.btts_yes/btts_no` / `additional_markets_v2.btts` |
| Correct Scores | `additional_markets_v2.correct_scores` |
| Double Chance | `additional_markets_flat.double_chance_*` / `additional_markets_v2.double_chance` |
| DNB | `additional_markets_flat.dnb_*` / `additional_markets_v2.dnb` |
| Asian Handicap | `additional_markets_flat.ah_*` / `additional_markets_v2.asian_handicap` |
| Win to Nil | `additional_markets_flat.win_to_nil_*` / `additional_markets_v2.win_to_nil` |
| Clean Sheet | `additional_markets_flat.clean_sheet_*` / `additional_markets_v2.clean_sheet` |
| Team Analysis | `comprehensive_analysis.ai_verdict.team_analysis` |
| Risk Assessment | `comprehensive_analysis.ai_verdict.risk_assessment` |
| Betting Recommendations | `comprehensive_analysis.ai_verdict.betting_recommendations` |
| ML Predictions | `comprehensive_analysis.ml_prediction` / `predictions` |
| Data Freshness | `data_freshness` (h2h_matches, form_matches, injuries) |
| Match Info | `match_info` (date, venue, league) |

