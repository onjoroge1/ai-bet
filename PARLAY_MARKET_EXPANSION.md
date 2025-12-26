# Parlay Market Expansion

**Date**: January 2025  
**Status**: ✅ **COMPLETE**

---

## 🎯 **Problem Identified**

1. **Limited Markets**: Only using DNB, Totals (2.5/3.5/4.5), BTTS, and Double Chance
2. **Missing Markets**: Not using Win to Nil, Clean Sheet, Team Totals, Odd/Even, and all Totals lines
3. **Duplicates**: Creating repeated parlays for same matches
4. **Only Match Results**: Focusing too much on H/A outcomes instead of rich market data

---

## ✅ **Solution Implemented**

### **1. Expanded Market Extraction**

Now extracting from `additional_markets_v2`:

#### **Previously Used:**
- ✅ DNB (Draw No Bet)
- ✅ Totals (2.5, 3.5, 4.5 only)
- ✅ BTTS (Both Teams to Score)
- ✅ Double Chance (1X, X2 only)

#### **Now Also Using:**
- ✅ **All Totals Lines**: 0.5, 1.5, 2.5, 3.5, 4.5 (both Over and Under)
- ✅ **Win to Nil**: Home and Away
- ✅ **Clean Sheet**: Home and Away
- ✅ **Team Totals**: Home and Away team goal lines (0.5, 1.5, 2.5)
- ✅ **Double Chance**: All options (1X, X2, 12)
- ✅ **Odd/Even Total Goals**

### **2. Deduplication Logic**

#### **During Generation:**
- Track seen combinations using outcome keys
- Skip duplicate combinations within same match
- Final deduplication pass before returning results

#### **During Sync:**
- Check for existing parlays with same match + same outcomes
- Skip if exact duplicate found
- Use outcome-based matching (not just match ID)

### **3. Better Outcome Formatting**

Outcomes now use descriptive codes:
- `DNB_H` / `DNB_A` - Draw No Bet
- `OVER_2_5` / `UNDER_2_5` - Totals
- `BTTS_YES` / `BTTS_NO` - Both Teams to Score
- `DC_1X` / `DC_X2` / `DC_12` - Double Chance
- `WTN_H` / `WTN_A` - Win to Nil
- `CS_H` / `CS_A` - Clean Sheet
- `TT_H_OVER_1_5` - Team Totals
- `ODD` / `EVEN` - Odd/Even

---

## 📊 **Market Coverage**

### **Before:**
- ~4-6 markets per match
- Limited to basic markets
- Many duplicates

### **After:**
- ~15-25 markets per match (depending on data)
- All available markets from `additional_markets_v2`
- Deduplication prevents repeats

---

## 🔧 **Technical Changes**

### **File: `app/api/admin/parlays/generate/route.ts`**

1. **Expanded MarketData Interface**:
   ```typescript
   interface MarketData {
     // ... existing ...
     clean_sheet?: { home: number; away: number }
     team_totals?: { home?: Record<...>, away?: Record<...> }
     odd_even_total?: { odd: number; even: number }
   }
   ```

2. **Market Extraction**:
   - All Totals lines (0.5 through 4.5)
   - Win to Nil
   - Clean Sheet
   - Team Totals (home and away)
   - Odd/Even
   - All Double Chance options

3. **Deduplication**:
   ```typescript
   const seenCombinations = new Set<string>()
   const comboKey = [leg1.outcome, leg2.outcome].sort().join('|')
   if (seenCombinations.has(comboKey)) continue
   ```

4. **Final Deduplication**:
   ```typescript
   const finalSeen = new Set<string>()
   const key = `${sgp.matchId}:${outcomes}`
   if (!finalSeen.has(key)) {
     finalSeen.add(key)
     finalSgps.push(sgp)
   }
   ```

### **File: `app/api/admin/parlays/sync-generated/route.ts`**

1. **Improved Duplicate Detection**:
   ```typescript
   const newLegOutcomes = sgp.legs.map(l => l.outcome).sort().join('|')
   const existingLegOutcomes = existing.legs.map(l => l.outcome).sort().join('|')
   if (existingLegOutcomes === newLegOutcomes && existing.legs.length === sgp.legs.length) {
     skipped++
     continue
   }
   ```

---

## 📈 **Expected Results**

### **More Parlays:**
- 3-5x more potential parlays per match
- Better variety of market combinations
- More trading opportunities

### **Better Quality:**
- No duplicates
- Clear outcome descriptions
- All markets utilized

### **Examples of New Parlays:**

1. **Win to Nil + Clean Sheet**:
   - "Egypt Win to Nil" + "Egypt Clean Sheet"

2. **Team Totals + Totals**:
   - "Home Over 1.5 Goals" + "Over 2.5 Total Goals"

3. **BTTS + Totals**:
   - "Both Teams to Score" + "Over 2.5 Goals"

4. **Odd/Even + Totals**:
   - "Odd Total Goals" + "Under 3.5 Goals"

---

## ✅ **Benefits**

1. **More Opportunities**: 3-5x more parlay combinations
2. **Better Variety**: Not just match results, but all markets
3. **No Duplicates**: Deduplication prevents repeats
4. **Clear Outcomes**: Descriptive outcome codes
5. **Full Data Utilization**: Using all available market data

---

**Last Updated**: January 2025  
**Status**: ✅ **COMPLETE - READY FOR TESTING**

