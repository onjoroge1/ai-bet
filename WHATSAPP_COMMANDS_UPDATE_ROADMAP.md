# WhatsApp Commands Update Roadmap

## Current State Analysis

### Data Structure
- **Location 1**: `predictionData.additional_markets_flat` - Flat structure with ALL markets
  - `totals_over_0_5`, `totals_over_1_5`, `totals_over_2_5`, `totals_over_3_5`, `totals_over_4_5`
  - `totals_under_0_5`, `totals_under_1_5`, `totals_under_2_5`, `totals_under_3_5`, `totals_under_4_5`
  - `btts_yes`, `btts_no`, `dnb_home`, `dnb_away`, `double_chance_*`, etc.
- **Location 2**: `predictionData.additional_markets_v2.totals` - Nested structure
  - `0_5: { over, under }`, `1_5: { over, under }`, `2_5: { over, under }`, etc.
- **Location 3**: `predictionData.additional_markets_v2.correct_scores` - Array of scores with probabilities
- **Location 4**: `predictionData.comprehensive_analysis` - Team analysis, risk, betting recommendations
- **ALL GOAL LINES ARE AVAILABLE** ✅

### Current Implementation
- ✅ BTTS browse mode - working, reads from QP table
- ✅ OVERS browse mode - working, reads from QP table  
- ✅ UNDERS browse mode - working, reads from QP table
- ✅ BTTS [Match ID] - working
- ✅ OVERS [Match ID] - working (but only shows 2.5)
- ✅ UNDERS [Match ID] - working (but only shows 2.5)

### Issues Identified
1. **Browse mode messages** - Need to update to new format with cross-promotion
2. **Match mode messages** - Need to show ALL goal lines (0.5, 1.5, 2.5, 3.5, etc.) but data doesn't exist yet
3. **13 new commands** - Need to implement: REASON, RISK, CONFIDENCE, VALUE, ALT, STATS, CS, PARLAY, STATUS, MORE

---

## Implementation Roadmap

### Phase 1: Update Existing Commands (BTTS, OVERS, UNDERS)

#### 1.1 BTTS Browse Mode
**Current**: Shows list of matches with BTTS probabilities
**New Format**:
```
⚽ BTTS OPPORTUNITIES

Top matches with BTTS YES.

👉 Want goal lines or score predictions?

Reply with:

OVERS [MATCH ID]

UNDERS [MATCH ID]
```

**Changes Needed**:
- Update message format
- Remove match list (or keep it but add cross-promotion)
- Add cross-promotion to OVERS/UNDERS

#### 1.2 OVERS Browse Mode
**Current**: Shows list of matches with Over 2.5 probabilities
**New Format**:
```
📈 OVER 2.5 GOALS

🎯 ADDITIONAL MARKETS:

Over 2.5 Goals: 40.9%

Under 2.5 Goals: 59.1%

👉 Want goal lines or BTTS?

Reply with:

UNDERS [MATCH ID]

BTTS [MATCH ID]
```

**Changes Needed**:
- Update message format
- Show aggregated probabilities (average of top 5 matches?)
- Add cross-promotion to UNDERS/BTTS

#### 1.3 UNDERS Browse Mode
**New Format** (similar to OVERS):
```
📉 UNDER 2.5 GOALS

🎯 ADDITIONAL MARKETS:

Over 2.5 Goals: 40.9%

Under 2.5 Goals: 59.1%

👉 Want goal lines or BTTS?

Reply with:

OVERS [MATCH ID]

BTTS [MATCH ID]
```

#### 1.4 BTTS [Match ID] Mode
**New Format**:
```
⚽ BTTS ANALYSIS

🎯 ADDITIONAL MARKETS:

Both Teams Score (Yes): 45.2%

Both Teams Score (No): 54.8%

Reply with OVER [Matchid] for over/under

👉 Want goal lines or score predictions?

Reply with:

OVERS [MATCH ID]

CS [MATCH ID]
```

**Changes Needed**:
- Update message format
- Add cross-promotion to OVERS/CS

#### 1.5 OVERS [Match ID] Mode
**Current**: Only shows Over/Under 2.5
**New Format**:
```
📈 GOALS ANALYSIS

🎯 ADDITIONAL MARKETS:

Over 2.5 Goals: 40.9%

Under 2.5 Goals: 59.1%

👉 Want goal lines or score predictions?

Reply with:

UNDERS [MATCH ID]

CS [MATCH ID]
```

**Changes Needed**:
- **CRITICAL**: Show ALL goal lines (0.5, 1.5, 2.5, 3.5, etc.)
- **PROBLEM**: This data doesn't exist in database yet - only `over_2_5` and `under_2_5` are stored
- **SOLUTION**: Need to either:
  - Calculate other lines from available data (if possible)
  - Add data enrichment to store all goal lines
  - Show only 2.5 for now and note that other lines coming soon

#### 1.6 UNDERS [Match ID] Mode
**Similar to OVERS [Match ID]** - show all goal lines

---

### Phase 2: New Commands Implementation

#### 2.1 PARLAY Command
**Format**:
```
🔗 AI PARLAY

High-odds parlay ticket.

👉 Get detailed info:

Type: [matchid]
```

**Implementation**:
- Query `ParlayConsensus` table
- Show top parlay opportunities
- Link to match details

#### 2.2 CS (Correct Score) Command
**Format**:
```
🎯 CORRECT SCORES

High-odds score picks.

👉 Want deeper markets from this score profile?

Reply with:

MORE [MATCH ID]
```

**Implementation**:
- Need to check if correct score data exists in `predictionData`
- If not, this is a placeholder for now

#### 2.3 STATUS Command
**Format**:
```
📊 Account STATUS

Plan & expiry shown.

👉 Renew or upgrade:

Type: BUY
```

**Implementation**:
- Use existing `getWhatsAppVIPStatus()` function
- Format status message

#### 2.4 REASON [Match ID] Command
**Format**: Shows team strengths, weaknesses, injuries
**Data Source**: `predictionData.comprehensive_analysis.detailed_reasoning`
**Implementation**:
- Extract team analysis from predictionData
- Format as shown in example

#### 2.5 RISK [Match ID] Command
**Format**: Shows risk level, stake suggestion, main risks
**Data Source**: `predictionData.comprehensive_analysis.risk_analysis`
**Implementation**:
- Extract risk data from predictionData
- Format risk message

#### 2.6 CONFIDENCE [Match ID] Command
**Format**: Shows probability breakdown (home/draw/away), model type, quality score
**Data Source**: `predictionData.comprehensive_analysis.ml_prediction` and `ai_verdict`
**Implementation**:
- Extract ML prediction probabilities
- Show model type and quality

#### 2.7 VALUE [Match ID] Command
**Format**: Shows market, AI prob, consensus odds, value rating
**Data Source**: `QuickPurchase.odds`, `predictionData`, `valueRating`
**Implementation**:
- Calculate value from odds vs probability
- Show value rating

#### 2.8 ALT [Match ID] Command
**Format**: Shows alternative bets (BTTS, Over/Under, Double Chance)
**Data Source**: `predictionData.additional_markets`
**Implementation**:
- Extract BTTS and Over/Under from additional_markets
- Suggest Double Chance / DNB options

#### 2.9 STATS [Match ID] Command
**Format**: Shows injuries, form, H2H stats
**Data Source**: `predictionData.comprehensive_analysis` and `matchData`
**Implementation**:
- Extract injury data
- Calculate form window
- Show H2H matches

#### 2.10 MORE [Match ID] Command
**Format**: Shows deeper markets for a match
**Implementation**:
- Show all available markets (BTTS, Over/Under lines, Asian Handicap, etc.)

---

## Data Availability Analysis

### ✅ Available in Database
- `over_2_5` and `under_2_5` in `total_goals`
- `both_teams_score.yes` and `both_teams_score.no`
- `comprehensive_analysis.detailed_reasoning` (for REASON command)
- `comprehensive_analysis.risk_analysis` (for RISK command)
- `comprehensive_analysis.ml_prediction` (for CONFIDENCE command)
- `comprehensive_analysis.ai_verdict` (for CONFIDENCE command)
- `QuickPurchase.odds` and `valueRating` (for VALUE command)

### ✅ ALSO Available (in `additional_markets_flat` and `additional_markets_v2`)
- All goal lines (0.5, 1.5, 2.5, 3.5, 4.5) in `additional_markets_flat.totals_over_*` and `additional_markets_v2.totals`
- Correct score predictions in `additional_markets_v2.correct_scores` array
- DNB, Double Chance, Win to Nil, Clean Sheet, Asian Handicap, Winning Margin
- Team totals (home/away) in `additional_markets_v2.team_totals`
- Team analysis (strengths, weaknesses, injuries) in `comprehensive_analysis.ai_verdict.team_analysis`
- Form assessment in team analysis
- H2H matches count in `data_freshness.h2h_matches`

---

## Implementation Priority

### High Priority (Core Functionality)
1. ✅ Update BTTS browse message format
2. ✅ Update OVERS browse message format  
3. ✅ Update UNDERS browse message format
4. ✅ Update BTTS [Match ID] message format
5. ⚠️ Update OVERS [Match ID] to show all goal lines (BLOCKED - data doesn't exist)
6. ⚠️ Update UNDERS [Match ID] to show all goal lines (BLOCKED - data doesn't exist)

### Medium Priority (New Commands - Data Available)
7. REASON [Match ID] - data exists
8. RISK [Match ID] - data exists
9. CONFIDENCE [Match ID] - data exists
10. VALUE [Match ID] - data exists
11. ALT [Match ID] - data exists
12. STATUS - data exists

### Low Priority (New Commands - Data May Not Exist)
13. CS (Correct Score) - need to check
14. STATS [Match ID] - may need data enrichment
15. MORE [Match ID] - can aggregate existing data
16. PARLAY - data exists in ParlayConsensus table

---

## Critical Decision: Goal Lines Data

**Problem**: User wants `OVERS [Match ID]` to show ALL goal lines (0.5, 1.5, 2.5, 3.5, etc.), but database only has `over_2_5` and `under_2_5`.

**Options**:
1. **Show only 2.5 for now** - Quick fix, but doesn't meet requirement
2. **Calculate other lines from 2.5** - Mathematical approximation (not accurate)
3. **Add data enrichment** - Store all goal lines in database (best solution, but requires backend work)
4. **Fetch from Market API** - If available, could get real-time goal lines

**Recommendation**: 
- For now: Show 2.5 only with note "More goal lines coming soon"
- Long-term: Add data enrichment to store all goal lines in `predictionData`

---

## Next Steps

1. **Immediate**: Update message formats for BTTS, OVERS, UNDERS (browse and match modes)
2. **Short-term**: Implement REASON, RISK, CONFIDENCE, VALUE, ALT, STATUS commands
3. **Medium-term**: Check CS data availability, implement STATS, MORE, PARLAY
4. **Long-term**: Add goal lines data enrichment (0.5, 1.5, 3.5, etc.)

