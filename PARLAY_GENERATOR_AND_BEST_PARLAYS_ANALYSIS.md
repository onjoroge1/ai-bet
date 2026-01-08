# 🎯 Parlay Generator & Best Parlays Identification - Comprehensive Analysis

**Date**: January 2025  
**Status**: 📋 **ANALYSIS COMPLETE**  
**Purpose**: Comprehensive analysis of identifying best parlays from AdditionalMarketData and designing user-facing parlay generator

---

## 📋 **Executive Summary**

This analysis covers:
1. **Best Parlay Identification**: Strategies to find optimal parlay combinations from AdditionalMarketData table
2. **Algorithm Design**: How to generate high-quality parlays for ParlayConsensus table
3. **User Parlay Builder**: Complete design for user-facing parlay generator in `/dashboard/parlays`
4. **Quality Metrics**: Enhanced scoring and filtering criteria
5. **UX/UI Flow**: Step-by-step user experience design

**Key Finding**: ✅ **HIGHLY FEASIBLE** - The AdditionalMarketData table provides rich, structured data that enables both automated best-parlay generation and user-customizable parlay building with superior edge calculation.

**CRITICAL DESIGN PRINCIPLE**: 
- ✅ **Multi-Game Parlays**: Use legs from **DIFFERENT matches** (1 leg per match) - This provides optimal diversification, lower correlation, and better risk distribution
- ✅ **Single-Game Parlays (SGPs)**: Can use multiple markets from **SAME match** (2-3 legs from same match) - Acceptable for SGPs only, but higher correlation penalty
- ✅ **Match Diversification Priority**: For multi-game parlays, match diversity is MORE important than market diversity

---

## 🔍 **Part 1: Identifying Best Parlays from AdditionalMarketData**

### **1.1 Data Availability Analysis**

**What We Have in AdditionalMarketData Table**:

```
For Each Market:
├── matchId: Links to MarketMatch
├── marketType: 1X2, BTTS, TOTALS, DNB, DOUBLE_CHANCE, etc.
├── marketSubtype: HOME, AWAY, OVER, UNDER, YES, NO, etc.
├── line: 2.5, 1.5, -0.5, +1.5, etc.
├── V1/V2 Model Data:
│   ├── v1ModelProb, v1Confidence, v1Pick
│   └── v2ModelProb, v2Confidence, v2Pick
├── Consensus Calculations:
│   ├── consensusProb (weighted average)
│   ├── consensusConfidence
│   └── modelAgreement (0-1 score)
├── Edge Calculations:
│   ├── edgeV1, edgeV2
│   └── edgeConsensus (best for decision making)
├── Quality Indicators:
│   ├── correlationTags: ["GOALS_LOW", "TOTALS", "HOME_WIN"]
│   ├── riskLevel: "low" | "medium" | "high"
│   └── settleType: "WIN_LOSE", "WIN_LOSE_PUSH", etc.
└── Metadata:
    └── dataSource: "additional_markets_v2"
```

**Key Advantages**:
- ✅ **Structured & Queryable**: All markets in normalized table
- ✅ **Dual Model Support**: V1 + V2 probabilities available
- ✅ **Consensus Edge**: Pre-calculated best edge
- ✅ **Model Agreement**: Know which markets both models agree on
- ✅ **Correlation Tags**: Easy to filter correlated markets
- ✅ **Risk Assessment**: Pre-calculated risk levels

---

### **1.2 Best Parlay Identification Strategy**

#### **Strategy 1: High Edge + High Agreement (RECOMMENDED)**

**Criteria**:
- Minimum `edgeConsensus >= 8%` (strong edge)
- Minimum `modelAgreement >= 0.75` (both models agree)
- Minimum `consensusProb >= 0.60` per leg (high probability)
- Maximum `riskLevel = "low"` or `"medium"` (manageable risk)

**Query Logic**:
```sql
-- Find high-quality individual legs
SELECT * FROM additional_market_data
WHERE 
  edgeConsensus >= 8.0  -- Strong edge
  AND modelAgreement >= 0.75  -- Models agree
  AND consensusProb >= 0.60  -- High probability
  AND riskLevel IN ('low', 'medium')  -- Manageable risk
  AND matchId IN (
    SELECT matchId FROM market_match 
    WHERE status = 'UPCOMING' AND kickoffDate >= NOW()
  )
ORDER BY edgeConsensus DESC, modelAgreement DESC, consensusProb DESC
```

**Advantages**:
- ✅ High confidence (models agree)
- ✅ Strong edge (better value)
- ✅ High probability (more likely to win)
- ✅ Lower risk (more reliable)

**Use Case**: Best for "Safe Builder" parlays (2-3 legs, high probability)

---

#### **Strategy 2: Maximum Edge Strategy**

**Criteria**:
- Sort by `edgeConsensus DESC`
- Minimum `edgeConsensus >= 10%` (exceptional edge)
- Minimum `consensusProb >= 0.50` per leg (reasonable probability)
- Accept any `modelAgreement` (models may disagree but edge is strong)

**Query Logic**:
```sql
-- Find maximum edge opportunities
SELECT * FROM additional_market_data
WHERE 
  edgeConsensus >= 10.0  -- Exceptional edge
  AND consensusProb >= 0.50  -- Reasonable probability
  AND matchId IN (
    SELECT matchId FROM market_match 
    WHERE status = 'UPCOMING' AND kickoffDate >= NOW()
  )
ORDER BY edgeConsensus DESC
LIMIT 20  -- Top 20 by edge
```

**Advantages**:
- ✅ Maximum value (highest edge)
- ✅ Good for aggressive strategies
- ✅ Finds undervalued markets

**Disadvantages**:
- ⚠️ Lower agreement may mean higher risk
- ⚠️ Lower probabilities may mean lower win rate

**Use Case**: Best for "Value Builder" parlays (2-4 legs, balanced risk/reward)

---

#### **Strategy 3: High Agreement + Balanced Probability**

**Criteria**:
- Minimum `modelAgreement >= 0.85` (very high agreement)
- Minimum `consensusProb >= 0.55` per leg (moderate-high probability)
- Accept `edgeConsensus >= 5%` (decent edge)
- Prefer `riskLevel = "low"`

**Query Logic**:
```sql
-- Find high-agreement, balanced markets
SELECT * FROM additional_market_data
WHERE 
  modelAgreement >= 0.85  -- Very high agreement
  AND consensusProb >= 0.55  -- Moderate-high probability
  AND edgeConsensus >= 5.0  -- Decent edge
  AND riskLevel = 'low'  -- Low risk preferred
  AND matchId IN (
    SELECT matchId FROM market_match 
    WHERE status = 'UPCOMING' AND kickoffDate >= NOW()
  )
ORDER BY modelAgreement DESC, consensusProb DESC
```

**Advantages**:
- ✅ Very high confidence (models strongly agree)
- ✅ Balanced probability (not too low, not too high)
- ✅ Lower risk

**Use Case**: Best for "Confidence Builder" parlays (3-4 legs, conservative approach)

---

#### **Strategy 4: Diverse Matches + Diverse Markets (RECOMMENDED FOR MULTI-GAME)**

**Criteria**:
- **CRITICAL**: Use legs from DIFFERENT matches (match diversification)
- Mix of market types: 1X2, BTTS, Totals, DNB
- Minimum `edgeConsensus >= 6%` per leg
- Minimum `consensusProb >= 0.50` per leg
- Avoid correlated markets (use correlationTags)

**Query Logic**:
```sql
-- Find diverse, high-quality markets from DIFFERENT matches
SELECT 
  matchId,
  marketType,
  COUNT(*) as count,
  AVG(edgeConsensus) as avg_edge,
  AVG(consensusProb) as avg_prob,
  AVG(modelAgreement) as avg_agreement
FROM additional_market_data
WHERE 
  edgeConsensus >= 6.0
  AND consensusProb >= 0.50
  AND matchId IN (
    SELECT matchId FROM market_match 
    WHERE status = 'UPCOMING' AND kickoffDate >= NOW()
  )
GROUP BY matchId, marketType
ORDER BY avg_edge DESC
```

**Strategy**:
- **Match Diversification** (PRIMARY):
  - Select 1 leg per match (different matches)
  - For 3-leg parlay: 3 different matches
  - For 4-leg parlay: 4 different matches
  - For 5-leg parlay: 5 different matches
- **Market Diversification** (SECONDARY):
  - Mix of market types across matches
  - Match 1: Home Win (1X2)
  - Match 2: Over 2.5 Goals (Totals)
  - Match 3: BTTS Yes
  - Match 4: Draw No Bet (DNB)
- **No Correlation**:
  - Different matches = no correlation
  - Diverse market types = lower correlation
  - Balance probabilities across matches

**Example Multi-Game Parlay**:
```
Leg 1: Man City vs Liverpool (Match A)
  → Home Win (1X2) - 66.5% prob, +12.3% edge

Leg 2: Arsenal vs Chelsea (Match B)
  → Over 2.5 Goals (Totals) - 60.0% prob, +15.8% edge

Leg 3: Brighton vs Tottenham (Match C)
  → BTTS Yes - 58.0% prob, +10.2% edge

Combined Probability: 23.2%
Adjusted Probability: 19.7% (correlation penalty for different matches is minimal)
Edge: +28.0%
Quality Score: 75/100 ⭐⭐⭐
```

**Advantages**:
- ✅ **Match Diversification** - Not dependent on single match outcome
- ✅ **Market Diversification** - Mix of market types for variety
- ✅ **Lower Correlation** - Different matches have minimal correlation
- ✅ **Better Risk Distribution** - Spreads risk across multiple matches
- ✅ **More Interesting** - Multi-game parlays are more engaging

**Use Case**: Best for "Diversified Builder" parlays (3-5 legs, **multi-game**, diverse markets)

**Important Note**: 
- ✅ **Multi-game parlays**: Use 1 leg per match (different matches)
- ✅ **Single-game parlays (SGPs)**: Can use multiple markets from same match (2-3 legs from Match A only)

---

### **1.3 Parlay Combination Algorithm**

#### **Algorithm: Find Best Parlay Combinations**

**CRITICAL DESIGN PRINCIPLE**: 
- ✅ **Multi-Game Parlays**: **MUST use legs from DIFFERENT matches** (1 leg per match)
- ✅ **Single-Game Parlays (SGPs)**: Can use multiple markets from SAME match (2-3 legs from same match)
- ✅ **Match Diversification**: For multi-game parlays, this is MORE important than market type diversification

**Step 1: Candidate Leg Pool Generation**

```
Input: Match set M, Market criteria C, Parlay type T (multi-game or single-game)
Output: Candidate legs L

For each match m in M:
  For each market in AdditionalMarketData where matchId = m.matchId:
    If market meets criteria C:
      Add to candidate pool L with matchId marker

Sort L by:
  1. Primary: edgeConsensus DESC
  2. Secondary: modelAgreement DESC
  3. Tertiary: consensusProb DESC

If T == "multi-game":
  // For multi-game parlays: Take top 1-2 legs per match
  Group L by matchId
  For each match group:
    Take top 1-2 legs by edgeConsensus
  Return: Top legs per match (ensures match diversification)
Else:
  // For single-game parlays: All legs from same match
  Return: Top 50 legs (L_top50)
```

**Step 2: Correlation Filtering**

```
Input: Candidate legs L_top50, parlay_type (multi-game or single-game)
Output: Filtered legs L_filtered

For each leg in L_top50:
  For each existing leg in current_parlay:
    
    If parlay_type == "multi-game":
      // CRITICAL: Multi-game parlays must use different matches
      If leg.matchId == existing_leg.matchId:
        Skip leg (same match - not allowed for multi-game)
    
    If areLegsCorrelated(leg, existing_leg):
      Skip leg (correlated markets)
    
    If same matchId AND conflicting outcomes:
      Skip leg (contradictory - e.g., Over 2.5 + Under 2.5)
  
  Add to L_filtered

Return: L_filtered
```

**Step 3: Combination Generation**

```
Input: Filtered legs L_filtered, leg_count (2-5), parlay_type (multi-game or single-game)
Output: Parlay combinations P

If parlay_type == "multi-game":
  // CRITICAL: Multi-game parlays must use different matches
  Group L_filtered by matchId
  unique_match_ids = unique matchIds from L_filtered
  
  For leg_count in [2, 3, 4, 5]:
    If unique_match_ids.length < leg_count:
      Skip (not enough different matches)
    
    // Generate combinations ensuring different matches
    Generate combinations where:
      - Each leg comes from a different matchId
      - Leg 1 from Match A, Leg 2 from Match B, etc.
      - All matches are different
    
    For each combination:
      Verify all legs have different matchIds
      Calculate:
        - combinedProb = product of all leg consensusProb
        - combinedEdge = weighted average of leg edgeConsensus
        - correlationPenalty = 0.90 (different matches = minimal correlation)
        - adjustedProb = combinedProb * correlationPenalty
        - impliedOdds = 1 / adjustedProb
        - parlayEdge = (impliedOdds - (1/combinedProb)) / (1/combinedProb) * 100
      
      If parlayEdge >= 5% AND adjustedProb >= 0.05:
        Add to P

Else:
  // Single-game parlays: All legs from same match
  Group L_filtered by matchId
  
  For each match group:
    match_legs = legs from this match
    For leg_count in [2, 3]:
      Generate combinations of leg_count legs from match_legs
      
      For each combination:
        Check correlation (same match = higher correlation risk)
        Calculate:
          - combinedProb = product of all leg consensusProb
          - hasCorrelation = checkCorrelation(legs)
          - correlationPenalty = calculateCorrelationPenalty(leg_count, hasCorrelation)
          - adjustedProb = combinedProb * correlationPenalty
          - impliedOdds = 1 / adjustedProb
          - parlayEdge = (impliedOdds - (1/combinedProb)) / (1/combinedProb) * 100
        
        If parlayEdge >= 5% AND adjustedProb >= 0.05:
          Add to P

Sort P by:
  1. Primary: parlayEdge DESC
  2. Secondary: adjustedProb DESC
  3. Tertiary: qualityScore DESC
  4. Quaternary: match_diversity_score DESC (prefer more different matches)

Return: Top 20 parlays (P_top20)
```

**Step 4: Quality Scoring**

```
For each parlay in P_top20:
  qualityScore = (
    (parlayEdge * 0.40) +
    (adjustedProb * 100 * 0.30) +
    (average_modelAgreement * 0.20) +
    (leg_diversity_score * 0.10)
  )
  
  confidenceTier = 
    IF qualityScore >= 70: "high"
    ELSE IF qualityScore >= 50: "medium"
    ELSE: "low"
  
  riskLevel = getRiskLevel(adjustedProb)

Return: Scored parlays with quality metrics
```

---

### **1.4 Filtering Criteria for Best Parlays**

#### **Minimum Thresholds**:

**Conservative (Safe Builder)**:
- `edgeConsensus >= 8%` per leg
- `consensusProb >= 0.60` per leg
- `modelAgreement >= 0.75` per leg
- `riskLevel = "low"` preferred
- Combined probability: 20-40%
- Parlay edge: >= 10%

**Balanced (Value Builder)**:
- `edgeConsensus >= 6%` per leg
- `consensusProb >= 0.55` per leg
- `modelAgreement >= 0.65` per leg
- `riskLevel IN ("low", "medium")`
- Combined probability: 15-35%
- Parlay edge: >= 8%

**Aggressive (Edge Builder)**:
- `edgeConsensus >= 10%` per leg
- `consensusProb >= 0.50` per leg
- `modelAgreement >= 0.50` per leg
- Any risk level
- Combined probability: 10-30%
- Parlay edge: >= 12%

**Longshot (High Reward)**:
- `edgeConsensus >= 5%` per leg
- `consensusProb >= 0.40` per leg
- `modelAgreement >= 0.40` per leg
- Any risk level
- Combined probability: 5-20%
- Parlay edge: >= 15%

---

### **1.5 Correlation Detection & Avoidance**

#### **Correlation Rules from AdditionalMarketData**:

**Same Match Correlations** (HIGH RISK):
- Home Win (1X2/DNB) + Over 2.5 Totals → **Strongly Correlated** (same match)
- Home Win (1X2/DNB) + BTTS Yes → **Strongly Correlated** (same match)
- Over 2.5 Totals + BTTS Yes → **Strongly Correlated** (same match)
- Home Win + Clean Sheet Home → **Strongly Correlated** (same match)
- Over 1.5 Totals + BTTS Yes → **Moderately Correlated** (same match)

**Correlation Penalty for Same Match**:
- Same match + correlated markets: -20% to -30% penalty
- Same match + non-correlated markets: -15% to -20% penalty

**Different Match Correlations** (LOW RISK):
- **Different matches → Minimal correlation (preferred)**
- Same league, different teams → Very low correlation (negligible)
- Same day, different leagues → No correlation (ideal)
- Same time slot, different matches → No correlation (ideal)

**Correlation Penalty for Different Matches**:
- Different matches (any markets): -5% to -10% penalty (minimal)
- Different leagues: -5% penalty (almost no correlation)
- Different days: -5% penalty (no correlation)

**KEY INSIGHT**: 
- ✅ **Multi-game parlays** (different matches) = Lower correlation penalty = Better value
- ⚠️ **Single-game parlays** (same match) = Higher correlation penalty = Acceptable for SGPs only

**Using correlationTags for Detection**:
```sql
-- Find non-correlated legs
SELECT * FROM additional_market_data leg1
WHERE NOT EXISTS (
  SELECT 1 FROM additional_market_data leg2
  WHERE 
    leg2.matchId = leg1.matchId
    AND (
      -- Home Win + Over 2.5 correlation
      (leg1.marketType = '1X2' AND leg1.marketSubtype = 'HOME' 
       AND leg2.marketType = 'TOTALS' AND leg2.marketSubtype = 'OVER' AND leg2.line >= 2.5)
      OR
      -- Home Win + BTTS Yes correlation
      (leg1.marketType = '1X2' AND leg1.marketSubtype = 'HOME'
       AND leg2.marketType = 'BTTS' AND leg2.marketSubtype = 'YES')
    )
)
```

**Correlation Penalty Calculation**:

**For Multi-Game Parlays (Different Matches)**:
- Base penalty by leg count:
  - 2 legs: 0.92 (8% penalty) - **Lower penalty, different matches**
  - 3 legs: 0.90 (10% penalty) - **Lower penalty, different matches**
  - 4 legs: 0.88 (12% penalty) - **Lower penalty, different matches**
  - 5+ legs: 0.85 (15% penalty) - **Lower penalty, different matches**

**For Single-Game Parlays (Same Match)**:
- Base penalty by leg count:
  - 2 legs: 0.85 (15% penalty) - **Higher penalty, same match**
  - 3 legs: 0.80 (20% penalty) - **Higher penalty, same match**
  - 4 legs: 0.75 (25% penalty) - **Higher penalty, same match**
  - 5+ legs: 0.70 (30% penalty) - **Higher penalty, same match**

- Additional penalty for correlated markets (same match):
  - Same match + correlated markets: -10% additional
  - Same match + non-correlated markets: -5% additional

**KEY INSIGHT**: 
- ✅ **Multi-game parlays** (different matches) = Lower correlation penalty = Better value
- ⚠️ **Single-game parlays** (same match) = Higher correlation penalty = Acceptable for SGPs only

---

### **1.6 Parlay Quality Scoring Formula**

**Enhanced Quality Score** (0-100 scale):

```
qualityScore = (
  (parlayEdge * 0.35) +                    // Edge weight: 35%
  (adjustedProb * 100 * 0.25) +            // Probability weight: 25%
  (average_modelAgreement * 100 * 0.20) +  // Agreement weight: 20%
  (leg_diversity_score * 100 * 0.10) +     // Diversity weight: 10%
  (risk_adjustment * 0.10)                 // Risk weight: 10%
)

Where:
- parlayEdge: Parlay-level edge percentage (capped at 50%)
- adjustedProb: Correlation-adjusted combined probability
- average_modelAgreement: Average model agreement across all legs
- leg_diversity_score: 
  - 1.0 if all legs from different matches (PREFERRED - best diversification)
  - 0.8 if 2+ matches, some same match (partial diversification)
  - 0.5 if all legs same match (SGP - acceptable for single-game parlays only)
  - Bonus: +0.2 if diverse market types (1X2, Totals, BTTS, DNB, etc.)
  - **Match diversity is more important than market diversity for multi-game parlays**
- risk_adjustment:
  - 1.0 if all legs riskLevel = "low"
  - 0.8 if mix of "low" and "medium"
  - 0.6 if any "high" risk
  - 0.4 if any "very_high" risk
```

**Quality Tiers**:
- **Excellent** (70-100): Premium parlays, highest confidence
- **Good** (50-69): High quality, recommended
- **Fair** (30-49): Acceptable, use with caution
- **Poor** (<30): Not recommended

---

## 🛠️ **Part 2: Automated Best Parlay Generation System**

### **2.1 System Architecture**

```
┌─────────────────────────────────────────┐
│ AdditionalMarketData Table              │
│ - All markets with V1/V2 data          │
│ - Pre-calculated edges & consensus      │
│ - Correlation tags & risk levels        │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│ Best Parlay Generator Service           │
│                                          │
│ 1. Candidate Leg Pool Generation        │
│    - Query by criteria (edge, prob, etc)│
│    - Filter by match status (UPCOMING)  │
│    - Sort by quality metrics            │
│                                          │
│ 2. Correlation Filtering                │
│    - Check correlationTags              │
│    - Avoid same-match correlations      │
│    - Prefer diverse markets             │
│                                          │
│ 3. Combination Generation               │
│    - Generate 2-5 leg combinations      │
│    - Calculate combined probabilities   │
│    - Apply correlation penalties        │
│    - Calculate parlay-level edges       │
│                                          │
│ 4. Quality Scoring & Ranking            │
│    - Calculate quality scores           │
│    - Rank by edge, probability, quality │
│    - Filter by minimum thresholds       │
│                                          │
│ 5. Deduplication                        │
│    - Check against existing parlays     │
│    - Remove duplicates                  │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│ ParlayConsensus Table                   │
│ - Store generated parlays               │
│ - Link to ParlayLeg records             │
│ - Track quality metrics                 │
└─────────────────────────────────────────┘
```

---

### **2.2 Generation Strategies**

#### **Strategy A: Daily Top Multi-Game Parlays (Recommended)**

**Schedule**: Run once daily (morning)

**Approach**:
1. Find top 100 legs by edgeConsensus (across all market types and matches)
2. **Ensure match diversification**: Group by matchId, take top 1-2 legs per match
3. Generate 2-leg, 3-leg, 4-leg combinations where **each leg is from a different match**
4. Filter by quality thresholds
5. Keep top 20 parlays per leg count (60 total)
6. Store in ParlayConsensus with `parlayType = "multi_game"`

**Parameters**:
- Minimum leg edge: 8%
- Minimum parlay edge: 10%
- Minimum combined prob: 15%
- Maximum leg count: 4
- **Match diversification**: 1 leg per match (different matches required)

**Example Output**:
```
3-Leg Multi-Game Parlay:
  Leg 1: Man City vs Liverpool (Match A) → Home Win (1X2) - 66.5%, +12.3%
  Leg 2: Arsenal vs Chelsea (Match B) → Over 2.5 (Totals) - 60.0%, +15.8%
  Leg 3: Brighton vs Tottenham (Match C) → BTTS Yes - 58.0%, +10.2%
  
  Combined: 23.2% | Edge: +28.0% | Quality: 75/100
```

**Advantages**:
- ✅ **Match Diversification** - Spreads risk across multiple matches
- ✅ Highest quality parlays (diverse matches and markets)
- ✅ Manageable volume (60 parlays/day)
- ✅ Fresh daily recommendations
- ✅ Lower correlation (different matches)

---

#### **Strategy B: Real-Time Opportunity Detection**

**Schedule**: Run every 30 minutes

**Approach**:
1. Find legs with exceptional edge (>= 15%)
2. Check model agreement (>= 0.80)
3. Generate quick 2-leg parlays
4. Store only if parlay edge >= 15%

**Parameters**:
- Minimum leg edge: 15%
- Minimum parlay edge: 15%
- Maximum leg count: 2
- Maximum results: 10 per run

**Advantages**:
- ✅ Catches time-sensitive opportunities
- ✅ High-value parlays
- ✅ Low volume (manageable)

---

#### **Strategy C: Match-Specific SGP Generation (Single-Game Only)**

**Schedule**: When new matches added or prediction data updated

**Approach**:
1. For each UPCOMING match with AdditionalMarketData:
2. Find all markets for **that single match**
3. Generate 2-3 leg SGP combinations (all legs from same match)
4. Filter correlated markets (same match = higher correlation risk)
5. Apply higher correlation penalty (same match = 0.75-0.80 penalty)
6. Keep top 5 SGPs per match

**Parameters**:
- Single match only (SGP) - **all legs from same match**
- Minimum leg prob: 60%
- Minimum combined prob: 20%
- Maximum leg count: 3
- Higher correlation penalty (same match = riskier)

**Example Output**:
```
3-Leg Single-Game Parlay (Match A only):
  Leg 1: Man City vs Liverpool → Home Win (1X2) - 66.5%, +12.3%
  Leg 2: Man City vs Liverpool → BTTS No - 71.7%, +8.5%
  Leg 3: Man City vs Liverpool → Under 3.5 Goals - 65.0%, +11.2%
  
  Combined: 31.0% | Correlation Penalty: -20% (same match) | Adjusted: 24.8% | Edge: +18.5%
```

**Advantages**:
- ✅ Rich single-game parlays
- ✅ Higher probability (same match legs are more predictable)
- ✅ User-friendly (simpler to understand - one match to watch)
- ✅ Good for users who want to focus on one match

**Note**: SGPs use multiple markets from same match, while multi-game parlays use different matches

---

### **2.3 Storage in ParlayConsensus Table**

**Fields to Set**:
```typescript
{
  parlayId: UUID(),                    // Generate new UUID
  apiVersion: "local",                 // Mark as locally generated
  legCount: number,                    // 2, 3, 4, or 5
  combinedProb: calculated,            // Product of leg probabilities
  correlationPenalty: calculated,      // Based on correlation
  adjustedProb: calculated,            // combinedProb * penalty
  impliedOdds: calculated,             // 1 / adjustedProb
  edgePct: calculated,                 // Parlay-level edge
  confidenceTier: calculated,          // Based on quality score
  parlayType: "auto_generated",        // or "single_game", "multi_game"
  earliestKickoff: min(leg.kickoffDate),
  latestKickoff: max(leg.kickoffDate),
  kickoffWindow: calculated,           // "today", "tomorrow", "this_week"
  status: "active",
  syncedAt: NOW()
}
```

**ParlayLeg Records**:
```typescript
For each leg:
{
  parlayId: parlayConsensus.id,       // Internal Prisma ID
  matchId: leg.matchId,
  outcome: convert_to_H_D_A,          // Based on market type
  homeTeam: from MarketMatch,
  awayTeam: from MarketMatch,
  modelProb: leg.consensusProb,       // Use consensus
  decimalOdds: 1 / leg.consensusProb, // Fair odds
  edge: leg.edgeConsensus,            // Use consensus edge
  legOrder: 1, 2, 3, ...
  additionalMarketId: leg.id          // Link to AdditionalMarketData
}
```

---

## 🎨 **Part 3: User Parlay Generator Design**

### **3.1 User Flow Overview**

```
┌─────────────────────────────────────────┐
│ /dashboard/parlays                      │
│                                          │
│ [Tab 1: Browse Pre-Generated]          │
│ [Tab 2: Build Your Own] ← NEW          │
└──────────────┬──────────────────────────┘
               │
               ↓ (User clicks "Build Your Own")
┌─────────────────────────────────────────┐
│ Step 1: Match Selection                 │
│ - Browse upcoming matches               │
│ - Filter by league, date, team          │
│ - Select match(s)                       │
└──────────────┬──────────────────────────┘
               │
               ↓ (User selects match)
┌─────────────────────────────────────────┐
│ Step 2: Market Selection                │
│ - See all available markets for match   │
│ - Filter by market type, edge, prob     │
│ - View V1/V2 comparison                │
│ - Select market(s)                      │
└──────────────┬──────────────────────────┘
               │
               ↓ (User selects markets)
┌─────────────────────────────────────────┐
│ Step 3: Real-Time Parlay Builder        │
│ - See selected legs                     │
│ - Real-time combined probability        │
│ - Real-time edge calculation            │
│ - Correlation warnings                  │
│ - Quality indicators                    │
│ - Add/remove legs                       │
└──────────────┬──────────────────────────┘
               │
               ↓ (User confirms parlay)
┌─────────────────────────────────────────┐
│ Step 4: Review & Save                   │
│ - Final probability & edge              │
│ - Risk assessment                       │
│ - Quality score                         │
│ - Save to account                       │
│ - Share with friends                    │
│ - Export to betting platform            │
└─────────────────────────────────────────┘
```

---

### **3.2 UI/UX Design - Match Selection Page**

#### **Layout Structure**:

```
┌─────────────────────────────────────────────────────────┐
│ 🎯 Build Your Own Parlay                                │
│                                                         │
│ [Step 1 of 4: Select Matches]                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Filters:                                                │
│ [League: All ▼] [Date: Today ▼] [Search: ...]          │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Match Card 1                                        │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ Man City vs Liverpool                           │ │ │
│ │ │ Premier League • Today 15:00 UTC                │ │ │
│ │ │                                                  │ │ │
│ │ │ [📊 15 Markets] [✅ V1/V2 Available]            │ │ │
│ │ │ [Avg Edge: +12.5%] [Best Edge: +18.3%]         │ │ │
│ │ │                                                  │ │ │
│ │ │ [+ Add to Parlay]                               │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [Selected: 2 matches] [Continue →]                      │
└─────────────────────────────────────────────────────────┘
```

#### **Match Card Information**:

**Display**:
- Home Team vs Away Team (with logos if available)
- League name and flag/emoji
- Kickoff date and time
- Number of available markets
- V1/V2 availability indicator
- Average edge across all markets
- Best edge in match
- Quick stats: Total markets, High-edge markets count

**Actions**:
- **"+ Add Match to Parlay"** button → Adds match to selection (for multi-game parlays)
- **Click match card** → Shows market selection modal
- **"Build SGP from This Match"** button → Quick action for single-game parlays

**Important UX Note**:
- Show selected matches counter: "Selected: 2 matches" (for multi-game)
- Visual indicator: Checkmark on selected matches
- Warning if user tries to add same match twice: "This match is already selected. For single-game parlays, select multiple markets from this match instead."

**Filters**:
- League dropdown (All, Premier League, La Liga, etc.)
- Date range (Today, Tomorrow, This Week, Custom)
- Search bar (team names)
- Sort by: Kickoff time, Market count, Best edge

---

### **3.3 UI/UX Design - Market Selection**

#### **Modal/Page Layout**:

```
┌─────────────────────────────────────────────────────────┐
│ Man City vs Liverpool - Select Markets                  │
│ [← Back]                                                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Tabs: [All] [1X2] [Totals] [BTTS] [DNB] [Others]       │
│                                                         │
│ Filters: [Edge: ≥8%] [Prob: ≥60%] [V1/V2: Both]       │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Market: Home Win (1X2)                              │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ V1 Model: 65% (Confidence: 0.72)                │ │ │
│ │ │ V2 Model: 68% (Confidence: 0.75)                │ │ │
│ │ │ ─────────────────────────────────               │ │ │
│ │ │ Consensus: 66.5% (Agreement: 0.95) ⭐          │ │ │
│ │ │ Edge: +12.3%                                    │ │ │
│ │ │ Risk: Low                                       │ │ │
│ │ │                                                  │ │ │
│ │ │ [✓ Select]                                      │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │                                                      │ │
│ │ Market: Over 2.5 Goals (Totals)                     │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ V1 Model: 58% (Confidence: 0.68)                │ │ │
│ │ │ V2 Model: 62% (Confidence: 0.71)                │ │ │
│ │ │ ─────────────────────────────────               │ │ │
│ │ │ Consensus: 60.0% (Agreement: 0.92) ⭐          │ │ │
│ │ │ Edge: +15.8%                                    │ │ │
│ │ │ Risk: Medium                                    │ │ │
│ │ │                                                  │ │ │
│ │ │ [✓ Select]                                      │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [Selected: 2 markets] [Continue →]                      │
└─────────────────────────────────────────────────────────┘
```

#### **Market Card Information**:

**Display**:
- Market type and subtype (e.g., "Home Win (1X2)", "Over 2.5 Goals")
- V1 model probability and confidence
- V2 model probability and confidence
- Consensus probability (weighted average)
- Model agreement score (0-1, with visual indicator ⭐)
- Edge percentage (color-coded: green = high, yellow = medium, red = low)
- Risk level badge (Low/Medium/High)
- Current market odds (if available)
- Correlation tags (for warning display)

**Visual Indicators**:
- **⭐ High Agreement** (≥0.80): Gold star
- **✓ Strong Edge** (≥10%): Green checkmark
- **⚠ Correlation Warning**: Yellow warning icon (if correlated with selected)
- **🔒 Locked**: Grey if already selected from same match (prevent duplicates)

**Actions**:
- **"Select"** button → Adds market to parlay builder
- **Click market card** → Shows detailed breakdown modal
- **"Already Selected"** indicator → Grey out if market already in parlay

**Important UX Note**:
- **Multi-game parlays**: Show warning if user tries to select another market from same match:
  "⚠️ You already selected a market from this match. For multi-game parlays, select markets from different matches."
- **Single-game parlays**: Allow multiple markets from same match (SGP mode)
- **Visual indicator**: Show which match each market belongs to
- **Match counter**: Display "Markets from: 2 different matches" (for multi-game)

---

### **3.4 UI/UX Design - Real-Time Parlay Builder**

#### **Main Builder Interface**:

```
┌─────────────────────────────────────────────────────────┐
│ Your Parlay (2 legs selected)                           │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Leg 1: Man City vs Liverpool                        │ │
│ │ Home Win (1X2)                                      │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ Consensus Prob: 66.5%                           │ │ │
│ │ │ Edge: +12.3%                                    │ │ │
│ │ │ Agreement: 0.95 ⭐                              │ │ │
│ │ │ [✕ Remove]                                      │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │                                                      │ │
│ │ Leg 2: Arsenal vs Chelsea                           │ │
│ │ Over 2.5 Goals (Totals)                             │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ Consensus Prob: 60.0%                           │ │ │
│ │ │ Edge: +15.8%                                    │ │ │
│ │ │ Agreement: 0.92 ⭐                              │ │ │
│ │ │ [✕ Remove]                                      │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Parlay Summary                                      │ │
│ │                                                      │ │
│ │ Combined Probability: 39.9%                         │ │
│ │ Correlation Penalty: -15%                           │ │
│ │ Adjusted Probability: 33.9%                         │ │
│ │                                                      │ │
│ │ Fair Odds: 2.51x                                    │ │
│ │ Market Odds: 3.20x                                  │ │
│ │ ─────────────────────────────────                   │ │
│ │ ✅ Parlay Edge: +27.5%                              │ │
│ │                                                      │ │
│ │ Quality Score: 78/100 ⭐⭐⭐                         │ │
│ │ Risk Level: Medium                                  │ │
│ │ Confidence: High                                    │ │
│ │                                                      │ │
│ │ ⚠ Warning: Legs from different matches (no correlation)│
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Actions:                                                │
│ [+ Add Another Leg] [Clear All] [Save Draft] [Continue]│
└─────────────────────────────────────────────────────────┘
```

#### **Real-Time Updates**:

**As User Adds/Removes Legs**:
- Combined probability recalculates instantly
- Correlation penalty updates if correlated legs detected
- Adjusted probability updates
- Edge recalculates based on market odds
- Quality score updates
- Risk level updates
- Warnings appear/disappear based on correlation

**Visual Feedback**:
- **Green border**: High quality parlay (quality score ≥70)
- **Yellow border**: Medium quality (quality score 50-69)
- **Red border**: Low quality (quality score <50) - warning to improve
- **Pulsing animation**: When edge changes significantly

**Correlation Warnings**:

**For Multi-Game Parlays** (Different Matches):
```
✅ Good: All legs from different matches
   - Leg 1: Match A (Man City vs Liverpool)
   - Leg 2: Match B (Arsenal vs Chelsea)
   - Leg 3: Match C (Brighton vs Tottenham)
   → Minimal correlation, optimal diversification
```

**For Single-Game Parlays** (Same Match):
```
⚠ Correlation Warning:
   Leg 1 (Home Win) and Leg 2 (Over 2.5) from the same match 
   are correlated. This is a single-game parlay (SGP).
   
   Correlation Penalty: -20%
   → Still acceptable for SGPs, but higher risk than multi-game parlays
   
   💡 Tip: For better value, consider selecting markets from different matches
```

**For Mixed Parlays** (Some Same Match):
```
⚠ Warning: Mixing same-match and different-match legs:
   - Leg 1: Match A (Man City vs Liverpool)
   - Leg 2: Match A (Man City vs Liverpool) ← Same match
   - Leg 3: Match B (Arsenal vs Chelsea)
   
   This creates higher correlation. Consider:
   → Option 1: Use all legs from Match A (SGP)
   → Option 2: Use one leg each from Match A, B, C (multi-game)
```

**Smart Suggestions**:

**For Multi-Game Parlays**:
```
💡 Suggestion:
   Currently: 2 legs from Match A and Match B
   
   Add "Brighton BTTS Yes vs Tottenham" (Match C) 
   → Boosts edge to +32.1% with better diversification
   
   OR
   
   Add market from "Liverpool vs Chelsea" (Match D)
   → Select from different match for optimal diversification
```

**For Single-Game Parlays**:
```
💡 Suggestion:
   Currently: 2 legs from Match A (Man City vs Liverpool)
   
   Add "Man City Clean Sheet" from same match
   → Boosts edge to +28.5% (SGP with higher correlation)
   
   OR
   
   Switch to multi-game parlay:
   → Add "Arsenal Over 2.5 vs Chelsea" (Match B)
   → Lower correlation penalty, better value
```

**For Better Diversification**:
```
💡 Diversification Tip:
   You have 2 legs from Match A. Consider:
   → Add a leg from Match B or Match C (different match)
   → This reduces correlation penalty from -20% to -8%
   → Improves parlay edge from +18.5% to +25.2%
```

---

### **3.5 UI/UX Design - Review & Save**

#### **Final Review Page**:

```
┌─────────────────────────────────────────────────────────┐
│ Review Your Parlay                                      │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Parlay Summary:                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 3-Leg Parlay                                        │ │
│ │                                                      │ │
│ │ Leg 1: Man City Win vs Liverpool (66.5%)            │ │
│ │ Leg 2: Arsenal Over 2.5 vs Chelsea (60.0%)          │ │
│ │ Leg 3: Brighton BTTS Yes vs Tottenham (58.0%)       │ │
│ │                                                      │ │
│ │ Combined Probability: 23.2%                         │ │
│ │ Adjusted Probability: 19.7% (after correlation)     │ │
│ │                                                      │ │
│ │ Fair Odds: 5.08x                                    │ │
│ │ Estimated Market Odds: 6.50x                        │ │
│ │ ─────────────────────────────────                   │ │
│ │ ✅ Edge: +28.0%                                     │ │
│ │                                                      │ │
│ │ Quality Score: 75/100 ⭐⭐⭐                         │ │
│ │ Risk Level: Medium                                  │ │
│ │ Confidence: High                                    │ │
│ │ Model Agreement: 0.92 (Excellent)                   │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Match Timeline:                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ All matches: Today, Dec 25, 2025                    │ │
│ │ Earliest: 15:00 UTC • Latest: 17:30 UTC             │ │
│ │ Window: 2.5 hours                                   │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Actions:                                                │
│ [← Edit Parlay] [Save to Account] [Share] [Export]     │
└─────────────────────────────────────────────────────────┘
```

#### **Save Options**:

**Save to Account**:
- Name your parlay (optional)
- Add notes/tags (optional)
- Set reminder notification (optional)
- Save → Stored in user's saved parlays

**Share**:
- Generate shareable link
- Copy to clipboard
- Share via social media
- Share via WhatsApp/Email

**Export**:
- Export as JSON
- Export as betting slip format
- Copy to clipboard (formatted text)
- Send to betting platform (if integration available)

---

### **3.6 Advanced Features**

#### **Feature 1: Smart Suggestions**

**AI-Powered Recommendations**:
- "Add 'Brighton Clean Sheet' to boost edge to +32%"
- "Remove 'Over 2.5' to reduce correlation penalty"
- "Switch to 'Under 2.5' for similar edge, lower correlation"
- "Consider 'Double Chance 1X' instead of 'Home Win' for higher probability"

**Logic**:
- Analyze current parlay
- Find markets that would improve edge
- Find markets that reduce correlation
- Suggest alternative markets with similar edge

---

#### **Feature 2: Parlay Templates**

**Pre-Built Templates**:
- **"Safe Builder"**: 2-3 legs, high probability (60%+ each), low risk
- **"Value Builder"**: 2-3 legs, balanced (50-60% each), medium risk
- **"Edge Builder"**: 3-4 legs, high edge (10%+ each), medium-high risk
- **"Longshot"**: 4-5 legs, lower probability (40-50% each), high reward

**User Flow**:
1. Select template
2. System auto-fills with best available markets matching template criteria
3. User can modify as needed

---

#### **Feature 3: Historical Performance**

**Show Similar Parlays**:
- "Similar parlays (same markets, different matches) have 68% win rate"
- "Parlays with this edge range have average ROI of +12.5%"
- "3-leg parlays with 20-25% probability win 42% of the time"

**Data Source**:
- Query ParlayPerformance table
- Match by market types, edge range, probability range
- Calculate win rates and ROI

---

#### **Feature 4: Comparison Mode**

**Compare Multiple Parlays**:
- Build 2-3 different parlay variations
- Side-by-side comparison
- See which has best edge, probability, quality score
- Select best one or save all

---

#### **Feature 5: Saved Parlays Management**

**User's Saved Parlays**:
- List of all saved parlays
- Filter by date, status (pending/active/resulted)
- Edit/delete saved parlays
- Track performance (if matches have finished)
- Rebuild similar parlays for new matches

---

### **3.7 Technical Implementation Considerations**

#### **Data Fetching Strategy**:

**Initial Load**:
- Fetch all UPCOMING matches with market count
- Lazy load market details when match selected
- Cache market data for 5 minutes

**Market Data Query**:
```sql
-- Get all markets for a match
SELECT * FROM additional_market_data
WHERE matchId = ?
  AND consensusProb > 0
ORDER BY edgeConsensus DESC, modelAgreement DESC
```

**Real-Time Calculations**:
- Client-side calculation for instant feedback
- Server-side validation before save
- Re-calculate on every leg add/remove

---

#### **Performance Optimization**:

**Pagination**:
- Load matches in pages (20 per page)
- Infinite scroll or "Load More" button
- Virtual scrolling for large lists

**Caching**:
- Cache match list (5 min TTL)
- Cache market data per match (5 min TTL)
- Cache calculated parlays (user session)

**Debouncing**:
- Debounce filter inputs (300ms)
- Debounce search queries (500ms)
- Debounce real-time calculations (100ms)

---

#### **State Management**:

**User Parlay State**:
```typescript
interface UserParlayBuilderState {
  selectedMatches: string[]  // matchIds
  selectedMarkets: {
    matchId: string
    marketId: string  // AdditionalMarketData.id
    marketType: string
    marketSubtype: string
  }[]
  calculatedParlay: {
    combinedProb: number
    adjustedProb: number
    edge: number
    qualityScore: number
    riskLevel: string
    correlationPenalty: number
  }
  savedDrafts: UserParlayDraft[]
}
```

---

## 🎯 **Part 4: Integration Strategy**

### **4.1 Tab-Based Navigation**

**Updated `/dashboard/parlays` Page Structure**:

```
┌─────────────────────────────────────────────────────────┐
│ Parlays Dashboard                                       │
│                                                         │
│ Tabs:                                                   │
│ [Browse Pre-Generated] [Build Your Own] [My Saved]     │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Content (changes based on active tab)                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Tab 1: Browse Pre-Generated** (Existing)
- Shows parlays from ParlayConsensus table
- Current functionality maintained

**Tab 2: Build Your Own** (NEW)
- User parlay builder interface
- Step-by-step flow (Match → Market → Builder → Review)

**Tab 3: My Saved** (NEW)
- User's saved parlays
- Performance tracking
- Edit/delete functionality

---

### **4.2 API Endpoints Needed**

#### **GET /api/parlays/builder/matches**
```
Query: ?league=premier-league&date=today&search=manchester

Response: {
  matches: [{
    matchId: string
    homeTeam: string
    awayTeam: string
    league: string
    kickoffDate: string
    marketCount: number
    avgEdge: number
    bestEdge: number
    hasV1V2: boolean
  }]
}
```

#### **GET /api/parlays/builder/markets/:matchId**
```
Response: {
  match: { matchId, homeTeam, awayTeam, league, kickoffDate },
  markets: [{
    id: string
    marketType: string
    marketSubtype: string
    line: number | null
    v1ModelProb: number
    v2ModelProb: number
    consensusProb: number
    edgeConsensus: number
    modelAgreement: number
    riskLevel: string
    correlationTags: string[]
  }]
}
```

#### **POST /api/parlays/builder/calculate**
```
Body: {
  legs: [{
    matchId: string
    marketId: string
  }]
}

Response: {
  combinedProb: number
  adjustedProb: number
  correlationPenalty: number
  edge: number
  qualityScore: number
  riskLevel: string
  confidenceTier: string
  warnings: string[]
  suggestions: string[]
}
```

#### **POST /api/parlays/builder/save**
```
Body: {
  name?: string
  notes?: string
  legs: [{
    matchId: string
    marketId: string
  }]
}

Response: {
  success: boolean
  parlayId: string  // Saved parlay ID
}
```

#### **GET /api/parlays/builder/saved**
```
Response: {
  savedParlays: [{
    id: string
    name: string
    createdAt: string
    legs: [...]
    calculatedParlay: {...}
    status: "pending" | "active" | "won" | "lost" | "void"
  }]
}
```

---

### **4.3 Data Flow for User-Built Parlays**

```
USER BUILDS PARLAY:
┌─────────────────────────────────────────┐
│ User selects matches & markets          │
│ (Client-side state)                     │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│ POST /api/parlays/builder/calculate     │
│ - Server validates legs                 │
│ - Calculates probabilities & edges      │
│ - Checks correlation                    │
│ - Returns calculated parlay             │
└──────────────┬──────────────────────────┘
               │
               ↓ (User saves)
┌─────────────────────────────────────────┐
│ POST /api/parlays/builder/save          │
│ - Validates user authentication         │
│ - Creates UserSavedParlay record        │
│ - Optionally creates ParlayConsensus    │
│   (if user wants to share/publish)      │
│ - Returns saved parlay ID               │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│ UserSavedParlay Table                   │
│ - userId, parlayId, name, notes         │
│ - legs (JSON array)                     │
│ - calculated metrics                    │
│ - status, createdAt                     │
└─────────────────────────────────────────┘
```

---

## 📊 **Part 5: Quality Metrics & Filtering**

### **5.1 Enhanced Quality Scoring for User Builder**

**Real-Time Quality Indicators**:

**Edge Indicator**:
- 🟢 **Excellent** (+20%+): Strong value, highly recommended
- 🟡 **Good** (+10% to +20%): Good value, recommended
- 🟠 **Fair** (+5% to +10%): Acceptable, use with caution
- 🔴 **Poor** (<+5%): Not recommended, low value

**Probability Indicator**:
- 🟢 **High** (30%+): Good win probability
- 🟡 **Medium** (15-30%): Moderate win probability
- 🟠 **Low** (5-15%): Low win probability, high risk
- 🔴 **Very Low** (<5%): Very low win probability

**Model Agreement Indicator**:
- 🟢 **Excellent** (≥0.85): Models strongly agree, high confidence
- 🟡 **Good** (0.70-0.85): Models mostly agree, good confidence
- 🟠 **Fair** (0.55-0.70): Models partially agree, moderate confidence
- 🔴 **Poor** (<0.55): Models disagree, low confidence

**Risk Indicator**:
- 🟢 **Low**: Combined prob ≥20%, manageable risk
- 🟡 **Medium**: Combined prob 10-20%, moderate risk
- 🟠 **High**: Combined prob 5-10%, high risk
- 🔴 **Very High**: Combined prob <5%, very high risk

---

### **5.2 Filtering & Search**

#### **Match Selection Filters**:

**League Filter**:
- All Leagues
- Top 5 Leagues (Premier League, La Liga, Serie A, Bundesliga, Ligue 1)
- By Country
- Custom selection

**Date Filter**:
- Today
- Tomorrow
- This Week
- Next Week
- Custom Date Range

**Search**:
- Team name search
- Match ID search
- League name search

**Sort Options**:
- Kickoff time (ascending/descending)
- Market count (highest/lowest)
- Best edge (highest/lowest)
- Average edge (highest/lowest)

---

#### **Market Selection Filters**:

**Market Type**:
- All Types
- 1X2 (Match Result)
- Totals (Over/Under)
- BTTS (Both Teams to Score)
- DNB (Draw No Bet)
- Double Chance
- Asian Handicap
- Team Totals
- Win to Nil / Clean Sheet

**Quality Filters**:
- Minimum Edge: Slider (0% to 30%)
- Minimum Probability: Slider (0% to 100%)
- Model Agreement: Checkboxes (Excellent, Good, Fair, Poor)
- Risk Level: Checkboxes (Low, Medium, High)

**V1/V2 Availability**:
- Both Available (preferred)
- V1 Only
- V2 Only
- Either Available

---

### **5.3 Validation & Warnings**

#### **Client-Side Validation**:

**Minimum Requirements**:
- At least 2 legs required
- Maximum 5 legs allowed
- All legs must be from UPCOMING matches
- Cannot select same market twice from same match

**Correlation Warnings**:
- Same match correlations (Home Win + Over 2.5)
- Conflicting outcomes (Over 2.5 + Under 2.5)
- Redundant selections (Home Win + Double Chance 1X)

**Quality Warnings**:
- Low edge warning (<5%)
- Low probability warning (<10% combined)
- High risk warning (combined prob <15%)
- Model disagreement warning (agreement <0.60)

**Performance Warnings**:
- Too many legs (4-5 legs have lower win rates)
- All same match (high correlation risk)
- All same market type (lack of diversity)

---

#### **Server-Side Validation**:

**Before Save**:
- Verify all markets exist in AdditionalMarketData
- Verify all matches are UPCOMING
- Recalculate all metrics (prevent client-side manipulation)
- Check for duplicates (same leg combination already saved)
- Validate user authentication and permissions

---

## 🚀 **Part 6: Implementation Roadmap**

### **6.1 Phase 1: Best Parlay Generation (Week 1-2)**

**Priority**: 🔴 **HIGH**

**Tasks**:
1. Create API endpoint for best parlay generation
2. Implement candidate leg pool generation
3. Implement correlation filtering
4. Implement combination generation algorithm
5. Implement quality scoring
6. Create cron job to run daily
7. Store generated parlays in ParlayConsensus

**Deliverables**:
- `/api/admin/parlays/generate-best` endpoint
- Daily cron job (runs at 8 AM)
- Top 60 parlays stored daily
- Quality metrics included

---

### **6.2 Phase 2: User Builder - Match Selection (Week 3)**

**Priority**: 🟠 **HIGH**

**Tasks**:
1. Create match selection page/component
2. Implement match filtering (league, date, search)
3. Display match cards with market counts
4. Implement match selection state management
5. Create API endpoint for match listing

**Deliverables**:
- Match selection UI
- `/api/parlays/builder/matches` endpoint
- Filter and search functionality

---

### **6.3 Phase 3: User Builder - Market Selection (Week 4)**

**Priority**: 🟠 **HIGH**

**Tasks**:
1. Create market selection modal/page
2. Display markets with V1/V2 comparison
3. Implement market filtering
4. Show model agreement and edge indicators
5. Implement market selection state
6. Create API endpoint for market listing

**Deliverables**:
- Market selection UI
- `/api/parlays/builder/markets/:matchId` endpoint
- V1/V2 comparison display
- Quality indicators

---

### **6.4 Phase 4: User Builder - Real-Time Calculator (Week 5)**

**Priority**: 🟠 **HIGH**

**Tasks**:
1. Create parlay builder component
2. Implement real-time probability calculation
3. Implement real-time edge calculation
4. Implement correlation detection and warnings
5. Implement quality score calculation
6. Add smart suggestions
7. Create API endpoint for calculation

**Deliverables**:
- Real-time parlay builder UI
- `/api/parlays/builder/calculate` endpoint
- Correlation warnings
- Quality indicators

---

### **6.5 Phase 5: User Builder - Save & Management (Week 6)**

**Priority**: 🟡 **MEDIUM**

**Tasks**:
1. Create review & save page
2. Implement save functionality
3. Create saved parlays list page
4. Implement edit/delete functionality
5. Add share functionality
6. Create API endpoints for save/load

**Deliverables**:
- Review & save UI
- `/api/parlays/builder/save` endpoint
- `/api/parlays/builder/saved` endpoint
- Saved parlays management

---

### **6.6 Phase 6: Polish & Optimization (Week 7-8)**

**Priority**: 🟢 **LOW**

**Tasks**:
1. Performance optimization (caching, pagination)
2. Mobile responsiveness
3. Advanced features (templates, comparisons)
4. Historical performance display
5. Export functionality
6. A/B testing and refinement

**Deliverables**:
- Optimized performance
- Mobile-friendly UI
- Advanced features
- Export options

---

## ✅ **Part 7: Success Criteria**

### **7.1 Best Parlay Generation Success Metrics**

**Technical Metrics**:
- ✅ Generate 50-100 quality parlays daily
- ✅ Average parlay edge: ≥10%
- ✅ Average quality score: ≥60
- ✅ Correlation detection accuracy: ≥95%
- ✅ Generation time: <30 seconds

**Quality Metrics**:
- ✅ 80%+ of generated parlays meet minimum thresholds
- ✅ Average model agreement: ≥0.75
- ✅ Diversified market types (not all 1X2)

---

### **7.2 User Builder Success Metrics**

**Usage Metrics**:
- ✅ 30%+ of users try builder (within first month)
- ✅ Average parlays built per user: ≥2
- ✅ Average builder session time: 5-10 minutes
- ✅ Save rate: ≥40% (users save their parlays)

**Quality Metrics**:
- ✅ Average user-built parlay edge: ≥8%
- ✅ Average user-built parlay quality score: ≥55
- ✅ User satisfaction: ≥4/5 stars

**Engagement Metrics**:
- ✅ Return rate: Users who build parlays return 2x more often
- ✅ Conversion: Builder users have higher premium conversion
- ✅ Retention: Builder users have higher retention rate

---

## 🎯 **Part 8: Key Recommendations**

### **8.1 Best Parlay Generation Recommendations**

1. **✅ Start with Conservative Strategy**
   - Use "High Edge + High Agreement" strategy first
   - Minimum 8% edge per leg
   - Minimum 0.75 model agreement
   - Generate 2-3 leg parlays primarily

2. **✅ Daily Generation Schedule**
   - Run at 8 AM local time
   - Process all UPCOMING matches
   - Store top 60 parlays
   - Mark old parlays as expired

3. **✅ Quality Over Quantity**
   - Better to have 20 excellent parlays than 100 mediocre ones
   - Use strict filtering criteria
   - Prioritize quality score over volume

4. **✅ Diversification**
   - Mix of single-game and multi-game parlays
   - Mix of market types (not just 1X2)
   - Mix of risk levels (primarily low/medium)

---

### **8.2 User Builder Recommendations**

1. **✅ Progressive Disclosure**
   - Show advanced options only when needed
   - Start simple, allow advanced features
   - Don't overwhelm users with all data at once

2. **✅ Real-Time Feedback**
   - Instant calculations on every change
   - Clear visual indicators (colors, badges)
   - Helpful warnings and suggestions

3. **✅ Education & Guidance**
   - Tooltips explaining edge, probability, correlation
   - "What is edge?" help section
   - Best practices guide
   - Example parlays

4. **✅ Mobile-First Design**
   - Ensure builder works well on mobile
   - Touch-friendly controls
   - Responsive layout
   - Simplified flow for mobile

5. **✅ Save & Share Features**
   - Easy save functionality
   - Shareable links
   - Export options
   - Social media integration

---

## 📋 **Part 9: Database Schema Considerations**

### **9.1 UserSavedParlay Table (If Needed)**

```prisma
model UserSavedParlay {
  id              String   @id @default(cuid())
  userId          String
  name            String?
  notes           String?
  
  // Parlay Configuration
  legs            Json     // Array of { matchId, marketId, marketType, marketSubtype, line }
  
  // Calculated Metrics (snapshot at save time)
  combinedProb    Decimal
  adjustedProb    Decimal
  correlationPenalty Decimal
  edge            Decimal
  qualityScore    Decimal
  riskLevel       String
  confidenceTier  String
  
  // Status
  status          String   @default("pending") // "pending", "active", "won", "lost", "void"
  
  // Match Timeline
  earliestKickoff DateTime
  latestKickoff    DateTime
  
  // Timestamps
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  resultDate      DateTime? // When all matches finished
  
  // Relations
  user            User     @relation(fields: [userId], references: [id])
  
  @@index([userId, status])
  @@index([userId, createdAt])
  @@index([status, earliestKickoff])
}
```

**Alternative**: Store in existing table structure by linking to ParlayConsensus with `userId` field or separate UserParlay relation.

---

## 🎯 **Part 10: Conclusion**

### **10.1 Summary**

**Best Parlay Identification**:
- ✅ Multiple strategies available (High Edge, High Agreement, Diverse, etc.)
- ✅ Rich data in AdditionalMarketData enables sophisticated filtering
- ✅ Quality scoring formula balances edge, probability, agreement, and risk
- ✅ Correlation detection prevents poor combinations

**User Parlay Builder**:
- ✅ Step-by-step flow: Match → Market → Builder → Review
- ✅ Real-time calculations provide instant feedback
- ✅ V1/V2 comparison builds user confidence
- ✅ Quality indicators guide user decisions
- ✅ Save/share functionality completes user journey

### **10.2 Key Advantages**

1. **Data Advantage**: AdditionalMarketData table provides structured, queryable market data with dual model support
2. **Quality Advantage**: Consensus calculations and model agreement enable better edge detection
3. **User Advantage**: Custom parlay building gives users control while guided by AI
4. **Competitive Advantage**: Unique feature not commonly available in betting platforms

### **10.3 Critical Design Principle - Match Diversification**

**CRITICAL FOR MULTI-GAME PARLAYS**:

✅ **Multi-Game Parlays MUST Use Different Matches**:
- ✅ 3-leg parlay = 3 different matches (1 leg per match)
- ✅ 4-leg parlay = 4 different matches (1 leg per match)
- ✅ 5-leg parlay = 5 different matches (1 leg per match)
- ✅ **Match diversification is PRIMARY** (more important than market type diversity)
- ✅ Lower correlation penalty (8-12% vs 20-30% for same match)
- ✅ Better value (higher adjusted probability)
- ✅ Lower risk (not dependent on single match outcome)

**Example Multi-Game Parlay** (CORRECT):
```
✅ CORRECT: 3-Leg Multi-Game Parlay
   Leg 1: Man City vs Liverpool (Match A) → Home Win (1X2)
   Leg 2: Arsenal vs Chelsea (Match B) → Over 2.5 Goals
   Leg 3: Brighton vs Tottenham (Match C) → BTTS Yes
   
   Diversification: 3 different matches ✅
   Correlation Penalty: -8% (minimal)
   Edge: +28.0%
```

**Example Multi-Game Parlay** (INCORRECT):
```
❌ INCORRECT: Mixing matches
   Leg 1: Man City vs Liverpool (Match A) → Home Win (1X2)
   Leg 2: Man City vs Liverpool (Match A) → Over 2.5 Goals ← Same match!
   Leg 3: Arsenal vs Chelsea (Match B) → BTTS Yes
   
   Diversification: 2 different matches ⚠️
   Correlation Penalty: -20% (high - same match legs)
   Edge: +18.5% (lower due to correlation)
   
   💡 This should be either:
   → SGP: All legs from Match A (accept higher correlation)
   → Multi-Game: One leg each from Match A, B, C (better value)
```

**Single-Game Parlays (SGPs) - Exception**:
- ✅ **SGPs CAN use same match** (2-3 legs from same match)
- ⚠️ Higher correlation penalty accepted (20-30%)
- ⚠️ Still acceptable for SGPs, but not optimal for multi-game parlays

**User Builder Guidance**:
- Show clear indicator: "Multi-game parlay: All legs from different matches ✅"
- Warn if user tries to add second leg from same match: "⚠️ You already selected a market from this match. For multi-game parlays, select markets from different matches."
- Suggest alternatives: "💡 Consider selecting from Match B or Match C for better diversification"

### **10.3 Implementation Priority**

**Phase 1 (Immediate)**: Best parlay generation from AdditionalMarketData
**Phase 2 (High)**: User builder - Match and market selection
**Phase 3 (High)**: User builder - Real-time calculator
**Phase 4 (Medium)**: Save and management features
**Phase 5 (Low)**: Advanced features and polish

---

**Last Updated**: January 2025  
**Status**: ✅ **ANALYSIS COMPLETE - READY FOR IMPLEMENTATION PLANNING**  
**Next Steps**: Begin Phase 1 implementation (Best Parlay Generation)

