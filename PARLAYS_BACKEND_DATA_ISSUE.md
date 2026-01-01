# Parlays Backend Data Issue

## 🔍 **Issue Identified**

### **Problem:**
All parlays are showing the same legs (Liverpool vs Brighton, West Ham vs Aston Villa).

### **Root Cause:**
The **backend API** is returning the same legs for all parlays. This is NOT a hardcoding issue in our code.

### **Evidence:**
- Tested backend API directly: All 5 parlays have identical leg combinations
- Combination: `1379122-D|1379126-H` (Liverpool vs Brighton - Draw, West Ham vs Aston Villa - Home)
- This is coming from the backend, not our code

### **Our Code Status:**
✅ **NO HARDCODING** - Our code correctly:
1. Fetches parlays from backend API
2. Reads `parlay.legs` array from API response
3. Saves each leg with data from API: `leg.match_id`, `leg.home_team`, `leg.away_team`, `leg.outcome`, etc.
4. All data comes directly from `parlay.legs[i]` - no hardcoded values

### **Code Verification:**
```typescript
// app/api/parlays/route.ts - Line 221-236
for (let i = 0; i < parlay.legs.length; i++) {
  const leg = parlay.legs[i]  // ← Reading from API response
  await prisma.parlayLeg.create({
    data: {
      parlayId: parlayConsensusId,
      matchId: leg.match_id.toString(),      // ← From API
      outcome: leg.outcome,                   // ← From API
      homeTeam: leg.home_team,                // ← From API
      awayTeam: leg.away_team,                // ← From API
      modelProb: leg.model_prob,              // ← From API
      decimalOdds: leg.decimal_odds,          // ← From API
      edge: leg.edge,                         // ← From API
      legOrder: i + 1,
    },
  })
}
```

### **Backend API Response:**
```json
{
  "parlays": [
    {
      "parlay_id": "188189e9-ad71-48bf-8de1-52b2e9c063ad",
      "legs": [
        {"match_id": 1379122, "home_team": "Liverpool", "away_team": "Brighton and Hove Albion", "outcome": "D"},
        {"match_id": 1379126, "home_team": "West Ham United", "away_team": "Aston Villa", "outcome": "H"}
      ]
    },
    {
      "parlay_id": "31f08eba-7785-4bf7-bb54-4ca2e0dd3762",
      "legs": [
        {"match_id": 1379122, "home_team": "Liverpool", "away_team": "Brighton and Hove Albion", "outcome": "D"},
        {"match_id": 1379126, "home_team": "West Ham United", "away_team": "Aston Villa", "outcome": "H"}
      ]
    }
    // ... all parlays have identical legs
  ]
}
```

### **Conclusion:**
- ✅ Our code is correct - no hardcoding
- ❌ Backend API is returning duplicate legs for all parlays
- 🔧 **Fix needed**: Backend API should return unique legs for each parlay

---

**Status**: Backend API Issue  
**Date**: December 12, 2025  
**Action Required**: Contact backend team to fix parlay generation logic



