# ✅ Parlays UPCOMING Filter Implementation

**Date**: January 2, 2026  
**Status**: ✅ **IMPLEMENTED**

---

## 🔍 **Problem Identified**

Parlays were being displayed regardless of whether their matches were still UPCOMING in the MarketMatch table. This meant:
- Parlays referencing past/completed matches were still showing
- Only 3 parlays were visible, likely because most parlays referenced matches that were no longer UPCOMING
- Users couldn't see parlays for all available UPCOMING matches

---

## ✅ **Solution Implemented**

### **Filter Parlays by UPCOMING Matches**

Updated `GET /api/parlays` endpoint to:
1. Query MarketMatch for all UPCOMING matches (status='UPCOMING', kickoffDate > now, isActive=true)
2. Create a Set of matchIds from UPCOMING matches
3. Filter parlays to only include those where **ALL legs** reference matches in the UPCOMING set
4. Return only parlays based on currently UPCOMING matches

### **Implementation Details**

**File**: `app/api/parlays/route.ts`

**Changes**:
- Added query to fetch UPCOMING matches from MarketMatch
- Added filtering logic to check if all parlay legs reference UPCOMING matches
- Updated count logic to reflect filtered results
- Added logging for debugging

**Logic**:
```typescript
// Get UPCOMING match IDs from MarketMatch
const upcomingMatches = await prisma.marketMatch.findMany({
  where: {
    status: 'UPCOMING',
    kickoffDate: { gt: now },
    isActive: true,
  },
  select: { matchId: true },
})
const upcomingMatchIds = new Set(upcomingMatches.map(m => m.matchId))

// Filter parlays: Only include those where ALL legs reference UPCOMING matches
const filteredParlays = allParlays.filter(parlay => {
  if (!parlay.legs || parlay.legs.length === 0) return false
  return parlay.legs.every(leg => upcomingMatchIds.has(leg.matchId))
})
```

---

## 📋 **Benefits**

1. **Relevance**: Only shows parlays for matches users can actually bet on (UPCOMING)
2. **More Parlays**: Should show more parlays if they exist for UPCOMING matches
3. **Data Quality**: Filters out stale parlays referencing past matches
4. **Consistency**: Same filtering logic as WhatsApp webhook (`sendParlayPicks`)

---

## 🧪 **Testing**

To verify the fix works:

1. Check MarketMatch table for UPCOMING matches:
   ```sql
   SELECT COUNT(*) FROM "MarketMatch" 
   WHERE status = 'UPCOMING' 
   AND "kickoffDate" > NOW() 
   AND "isActive" = true;
   ```

2. Check parlays in database:
   ```sql
   SELECT COUNT(*) FROM "ParlayConsensus" WHERE status = 'active';
   ```

3. Check how many parlays reference UPCOMING matches:
   - Call `/api/parlays?status=active`
   - Should only return parlays where all legs reference UPCOMING matches

4. Verify more parlays are showing in `/dashboard/parlays` page

---

## 📝 **Notes**

- The filter uses `leg.matchId` (from ParlayLeg table) which stores the backend match_id
- Only parlays where **ALL legs** reference UPCOMING matches are included
- If a parlay has even one leg referencing a non-UPCOMING match, it's filtered out
- This ensures users only see parlays they can actually bet on

---

**Status**: ✅ Implemented and ready for testing  
**Next Steps**: Monitor `/dashboard/parlays` page to verify more parlays are showing

