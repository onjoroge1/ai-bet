# Parlay QA Improvements

**Date**: January 2025  
**Status**: ✅ **COMPLETE**

---

## 🔍 **QA Findings - Example Parlay Analysis**

### **Example Parlay (Before Fixes):**
```
Confidence: high
Type: same_league
Status: active
League: Africa Cup of Nations

Leg 1: Egypt vs Zimbabwe - A (9.2%)
Leg 2: Nigeria vs Tanzania - A (11.3%)

Edge: 0.10%
Odds: 117.49
Prob: 1.0%
```

### **Issues Identified:**

1. ❌ **Unclear Outcome Display**
   - "A" is not descriptive - users don't know what "A" means
   - Should say "Tanzania to Win" or "Away Win"
   - No indication of what market is being bet on

2. ❌ **Very Low Quality**
   - Edge: 0.10% (essentially zero edge - not worth betting)
   - Probability: 1.0% (extremely low - 99% chance of losing)
   - Odds: 117.49 (very high odds = very unlikely to win)
   - This parlay is NOT tradable

3. ❌ **Missing Context**
   - No clear indication this is a "Match Result" bet
   - No risk warning for low probability
   - No quality indicator

4. ❌ **TBD Team Names**
   - Some parlays have "TBD vs TBD" which is not useful
   - Need to filter these out

---

## ✅ **Fixes Implemented**

### **1. Filter Out TBD Parlays**
- **Location**: `app/api/admin/parlays/list/route.ts`
- **Change**: Filter out parlays where any leg has "TBD" team names
- **Result**: Only show parlays with valid team names

### **2. Improved Outcome Display**
- **Location**: `app/api/admin/parlays/list/route.ts` + `components/admin/parlay-management.tsx`
- **Change**: 
  - Added `outcomeLabel` field with descriptive text
  - "A" → "Tanzania to Win"
  - "H" → "Egypt to Win"
  - "D" → "Draw"
  - Handles BTTS, Totals, Double Chance outcomes
- **Result**: Users can clearly see what to bet on

### **3. Quality Indicators**
- **Location**: `app/api/admin/parlays/list/route.ts` + `components/admin/parlay-management.tsx`
- **Change**:
  - Added `quality` object with:
    - `isTradable`: true if edge ≥ 5% AND probability ≥ 5%
    - `hasLowEdge`: true if edge < 5%
    - `hasLowProbability`: true if probability < 5%
    - `riskLevel`: 'low', 'medium', 'high', 'very_high'
  - Visual badges showing:
    - ✓ Tradable (green) - Good quality parlay
    - ⚠ Not Recommended (red) - Low quality
    - Risk level badge
    - Warnings for low edge/probability
- **Result**: Users can quickly identify quality parlays

### **4. Enhanced Display**
- **Location**: `components/admin/parlay-management.tsx`
- **Change**:
  - Each leg in its own card with clear structure
  - "BET TO PLACE" section with highlighted outcome
  - Team names clearly displayed
  - Probability shown per leg
  - Quality warnings prominently displayed
- **Result**: Much clearer presentation

---

## 📊 **Quality Thresholds**

### **Tradable Parlay Criteria:**
- ✅ Edge ≥ 5%
- ✅ Combined Probability ≥ 5%
- ✅ All legs have valid team names (not TBD)

### **Risk Levels:**
- **Low Risk**: Probability ≥ 20%
- **Medium Risk**: Probability ≥ 10%
- **High Risk**: Probability ≥ 5%
- **Very High Risk**: Probability < 5%

### **Edge Tiers:**
- **Excellent**: Edge ≥ 25%
- **Strong**: Edge ≥ 15%
- **Good**: Edge ≥ 10%
- **Moderate**: Edge ≥ 5%
- **Weak**: Edge < 5%

---

## 🎯 **Example Parlay (After Fixes)**

### **Display:**
```
Confidence: high | Type: same_league | Status: active
League: Africa Cup of Nations

⚠ Not Recommended | Risk: very high

⚠ Low edge (0.10%)
⚠ Low probability (1.0%)

Leg 1:
  Egypt vs Zimbabwe
  BET TO PLACE:
  Zimbabwe to Win (9.2% prob)

Leg 2:
  Nigeria vs Tanzania
  BET TO PLACE:
  Tanzania to Win (11.3% prob)

Edge: 0.10% | Odds: 117.49 | Prob: 1.0%
```

### **User Understanding:**
- ✅ Clear what to bet on: "Zimbabwe to Win" and "Tanzania to Win"
- ✅ Clear quality indicator: "Not Recommended"
- ✅ Clear risk level: "very high"
- ✅ Warnings shown: Low edge and low probability
- ✅ All information needed to make informed decision

---

## 🔧 **Technical Changes**

### **API Response Changes:**
```typescript
{
  // ... existing fields ...
  legs: [{
    outcome: "A",
    outcomeLabel: "Tanzania to Win", // NEW
    // ... other fields ...
  }],
  quality: { // NEW
    isTradable: false,
    hasLowEdge: true,
    hasLowProbability: true,
    riskLevel: "very_high"
  },
  // ... other fields ...
}
```

### **Filtering:**
- Parlays with TBD team names are filtered out at API level
- Response includes `totalBeforeFilter` and `filteredOut` counts

---

## ✅ **QA Checklist**

- [x] Filter out TBD parlays
- [x] Clear outcome descriptions
- [x] Quality indicators
- [x] Risk level warnings
- [x] Low edge/probability warnings
- [x] Enhanced leg display
- [x] "BET TO PLACE" section
- [x] All information needed for trading

---

## 📝 **Recommendations**

1. **Consider Auto-Hiding Low Quality Parlays**
   - Add filter option to hide parlays with `isTradable: false`
   - Or set minimum edge/probability thresholds

2. **Add Market Type Display**
   - Show "Match Result", "BTTS", "Totals", etc.
   - Helps users understand what market they're betting on

3. **Add Kickoff Time Display**
   - Show when matches start
   - Helps users know if parlay is still valid

4. **Consider Edge-Based Sorting**
   - Default sort by edge (highest first)
   - Show best opportunities first

---

**Last Updated**: January 2025  
**Status**: ✅ **COMPLETE - READY FOR TESTING**

