# Upcoming Matches - Removed Limit

**Date**: January 3, 2026  
**Status**: ✅ **FIXED**

---

## 🎯 **Issue**

Upcoming matches were limited to 50-100 matches in backend API calls, preventing all upcoming matches from being displayed.

---

## ✅ **Fixes Applied**

### **1. Homepage Component** ✅

**File**: `components/homepage-matches.tsx`

**Before**:
```typescript
const upcomingResponse = await fetch(
  "/api/market?status=upcoming&limit=100&mode=lite"
)
```

**After**:
```typescript
// No limit for upcoming matches - get all matches
const upcomingResponse = await fetch(
  "/api/market?status=upcoming&mode=lite"
)
```

**Change**: Removed `limit=100` parameter

---

### **2. API Route - External API Call** ✅

**File**: `app/api/market/route.ts`

**Before**:
```typescript
if (shouldUseLite) {
  url += `&mode=lite`
  if (status === 'live') {
    url += `&limit=1000` // Get all live matches
  } else {
    url += `&limit=${limit}` // Limited upcoming matches
  }
}
```

**After**:
```typescript
if (shouldUseLite) {
  url += `&mode=lite`
  // For live and upcoming matches in lite mode, get all matches (no limit)
  if (status === 'live' || status === 'upcoming') {
    url += `&limit=1000` // Get all matches (no effective limit)
  } else {
    url += `&limit=${limit}`
  }
}
```

**Change**: Added `status === 'upcoming'` to the no-limit condition

---

### **3. API Route - Database Query** ✅

**File**: `app/api/market/route.ts`

**Before**:
```typescript
dbMatches = await prisma.marketMatch.findMany({
  where: whereClause,
  orderBy: [{ kickoffDate: 'asc' }],
  take: parseInt(limit) || 10, // Always limited
})
```

**After**:
```typescript
// For upcoming matches, don't limit (get all matches)
// For other statuses, use provided limit or default
const dbLimit = (status === 'upcoming' || status === 'live') ? undefined : (parseInt(limit) || 10)

dbMatches = await prisma.marketMatch.findMany({
  where: whereClause,
  orderBy: [{ kickoffDate: 'asc' }],
  ...(dbLimit !== undefined && { take: dbLimit }),
})
```

**Change**: Removed limit for upcoming and live matches in database query

---

## 📊 **Impact**

### **Before**:
- ❌ Upcoming matches limited to 50-100
- ❌ Some matches not displayed
- ❌ Users miss upcoming matches

### **After**:
- ✅ All upcoming matches displayed
- ✅ No limit on database query
- ✅ No limit on external API call (uses 1000 as max)
- ✅ Better user experience

---

## 🎯 **Behavior**

### **Upcoming Matches**:
- **Database Query**: No limit (returns all matches)
- **External API**: `limit=1000` (effectively no limit)
- **Frontend**: Displays all matches

### **Live Matches**:
- **Database Query**: No limit (returns all matches)
- **External API**: `limit=1000` (effectively no limit)
- **Frontend**: Displays all matches

### **Other Statuses** (e.g., completed):
- **Database Query**: Uses provided limit or default (10)
- **External API**: Uses provided limit
- **Frontend**: Displays limited matches

---

## ✅ **Validation**

- [x] Homepage request has no limit for upcoming matches
- [x] API route passes no limit to external API for upcoming matches
- [x] Database query has no limit for upcoming matches
- [x] Live matches also have no limit (consistent behavior)
- [x] Other statuses still use limits (as intended)

---

**Status**: ✅ **FIXED**  
**Result**: All upcoming matches will now be displayed

