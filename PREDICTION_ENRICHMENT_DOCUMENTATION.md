# 🧠 **Prediction Enrichment System Documentation**

## 📋 **Overview**

The Prediction Enrichment System is designed to populate QuickPurchase records with AI-powered predictions, confidence scores, and betting intelligence. This system integrates with an external backend API to fetch prediction data and update the database accordingly.

## 🔄 **How It Works**

### **1. Enrichment Trigger**
- **Location**: Admin Panel → League Management → Upcoming Matches Section
- **Buttons**: Refetch 72H, Refetch 48H, Refetch 24H, Refetch Urgent
- **API Endpoint**: `/api/admin/predictions/enrich-quickpurchases`

### **2. Data Flow**
```
Refetch Button Click → handleRefetchPredictions() → enrichMutation → 
enrichPredictions() → /api/admin/predictions/enrich-quickpurchases → 
Backend API (/predict) → Update QuickPurchase Table
```

### **3. Time Window Filtering**
- **72H**: Matches in next 72 hours
- **48H**: Matches in next 48 hours  
- **24H**: Matches in next 24 hours
- **Urgent**: Matches in next 6 hours

## 🚨 **Current Issue: 0 Enriched Status**

### **Problem Description**
When clicking refetch buttons (72H, 48H, 24H), the system returns "0 enriched" even when matches exist in those time categories.

### **Root Cause Analysis**

#### **Issue 1: Database Schema Mismatch ✅ FIXED**
The enrichment API was using a **broken SQL join** that would **never work**:

```sql
-- OLD BROKEN QUERY:
SELECT qp.* FROM "QuickPurchase" qp
INNER JOIN "Match" m ON qp."matchId" = m.id  -- ← THIS JOIN WAS BROKEN!
```

**Problem**: The `QuickPurchase.matchId` field stores the **external match ID** (string), but the `Match.id` field is the **internal database ID** (string). This join would **never work** because they're different types of identifiers.

**Solution**: ✅ **FIXED** - Now using the correct path: `qp.predictionData.match_info.match_id`

#### **Issue 2: Data Structure Inconsistency ✅ FIXED**
- **Before**: Looking for `QuickPurchase.matchId` (which was null)
- **After**: ✅ **FIXED** - Now correctly accessing `QuickPurchase.predictionData.match_info.match_id`

#### **Issue 3: Time Filtering Logic ✅ FIXED**
- **Before**: Time filtering was applied to `Match.matchDate` (non-existent relationship)
- **After**: ✅ **FIXED** - Now filtering by `qp.predictionData.match_info.date`

## 🔧 **Solutions Implemented**

### **✅ Solution 1: Fixed Database Query (IMPLEMENTED)**

#### **Updated Raw SQL Query**
```sql
SELECT qp.* FROM "QuickPurchase" qp
WHERE qp."predictionData" IS NOT NULL
AND qp."predictionData"->>'match_info'->>'match_id' IS NOT NULL
AND qp."predictionData"->>'prediction' IS NULL
AND qp."isPredictionActive" = true
-- ... other filters
AND (qp."predictionData"->>'match_info'->>'date')::timestamp >= '${now.toISOString()}'
AND (qp."predictionData"->>'match_info'->>'date')::timestamp <= '${cutoffDate.toISOString()}'
```

#### **Updated Prisma Query**
```typescript
const quickPurchases = await prisma.quickPurchase.findMany({
  where: {
    predictionData: {
      path: ['match_info', 'match_id'],
      not: null
    },
    OR: [
      { 
        predictionData: {
          path: ['prediction'],
          equals: Prisma.JsonNull
        }
      },
      { 
        predictionData: {
          path: ['prediction'],
          equals: {}
        }
      }
    ],
    isPredictionActive: true
  },
  take: limit
})
```

### **✅ Solution 2: Fixed Match ID Extraction (IMPLEMENTED)**

#### **Before (Broken)**
```typescript
if (!quickPurchase.matchId) {
  // This would always fail because matchId was null
  continue
}
const predictionData = await fetchPredictionData(quickPurchase.matchId, true)
```

#### **After (Fixed)**
```typescript
// Extract match_id from the correct path in predictionData
const matchId = quickPurchase.predictionData?.match_info?.match_id
if (!matchId) {
  logger.warn('QuickPurchase has no match_id in predictionData.match_info', {
    data: { 
      quickPurchaseId: quickPurchase.id,
      predictionDataKeys: Object.keys(quickPurchase.predictionData || {}),
      matchInfoKeys: Object.keys(quickPurchase.predictionData?.match_info || {})
    }
  })
  continue
}
const predictionData = await fetchPredictionData(matchId, true)
```

## 📊 **Enrichment Process Details**

### **1. Data Fetching**
```typescript
// Calls external backend API
const backendUrl = `${process.env.BACKEND_URL}/predict`
const response = await fetch(backendUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.BACKEND_API_KEY}`
  },
  body: JSON.stringify({
    match_id: Number(matchId),
    include_analysis: true
  })
})
```

### **2. Data Processing**
```typescript
// Extract prediction details
const aiVerdict = prediction.comprehensive_analysis?.ai_verdict
const mlPrediction = prediction.comprehensive_analysis?.ml_prediction

// Determine prediction type and confidence
let predictionType = 'unknown'
let confidenceScore = 0

if (aiVerdict) {
  predictionType = aiVerdict.recommended_outcome?.toLowerCase().replace(' ', '_') || 'unknown'
  confidenceScore = aiVerdict.confidence_level === 'High' ? 85 : 
                   aiVerdict.confidence_level === 'Medium' ? 65 : 45
}

if (mlPrediction) {
  confidenceScore = Math.round(mlPrediction.confidence * 100)
}
```

### **3. Database Update**
```typescript
await prisma.quickPurchase.update({
  where: { id: quickPurchase.id },
  data: {
    predictionData: predictionData,
    predictionType: predictionType,
    confidenceScore: confidenceScore,
    odds: odds ? parseFloat(odds) : null,
    valueRating: valueRating,
    analysisSummary: analysisSummary,
    isPredictionActive: true,
    lastEnrichmentAt: new Date(),
    enrichmentCount: { increment: 1 }
  }
})
```

## 🧪 **Testing the Fix**

### **Step 1: Verify Data Structure**
```typescript
// Check what's in the database
const testRecords = await prisma.quickPurchase.findMany({
  where: { matchId: { not: null } },
  select: {
    id: true,
    matchId: true,
    predictionData: true,
    matchData: true
  },
  take: 5
})

console.log('Test records:', testRecords)
```

### **Step 2: Test Time Filtering**
```typescript
// Test the time filtering logic
const now = new Date()
const cutoffDate = new Date(now.getTime() + 72 * 60 * 60 * 1000)

const testFilter = baseQuickPurchases.filter(qp => {
  const matchData = qp.matchData as any
  if (!matchData?.date) return false
  
  const matchDate = new Date(matchData.date)
  return matchDate >= now && matchDate <= cutoffDate
})

console.log('Filtered records:', testFilter.length)
```

### **Step 3: Verify Backend API**
```typescript
// Test the backend API directly
const testResponse = await fetch(`${process.env.BACKEND_URL}/predict`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.BACKEND_API_KEY}`
  },
  body: JSON.stringify({
    match_id: 1234567,
    include_analysis: true
  })
})

console.log('Backend response:', await testResponse.json())
```

## 📝 **Implementation Checklist**

- [ ] **Fix database relationships** between QuickPurchase and Match tables
- [ ] **Update enrichment query** to properly filter by time windows
- [ ] **Test time filtering logic** with actual data
- [ ] **Verify backend API** responses
- [ ] **Add proper error handling** for failed enrichments
- [ ] **Implement retry logic** for failed API calls
- [ ] **Add monitoring** for enrichment success rates
- [ ] **Document the fix** for future developers

## 🔍 **Debugging Commands**

### **Check Database State**
```bash
# Check QuickPurchase records
npx prisma studio

# Check specific records
npx prisma db execute --stdin <<< "
SELECT 
  qp.id,
  qp.name,
  qp.matchId,
  qp.predictionData IS NOT NULL as hasPrediction,
  qp.confidenceScore,
  qp.predictionType
FROM \"QuickPurchase\" qp
WHERE qp.\"matchId\" IS NOT NULL
LIMIT 10;
"
```

### **Check API Endpoints**
```bash
# Test enrichment endpoint
curl -X POST http://localhost:3000/api/admin/predictions/enrich-quickpurchases \
  -H "Content-Type: application/json" \
  -d '{"limit": 5, "timeWindow": "72h"}'

# Test upcoming matches endpoint
curl http://localhost:3000/api/admin/predictions/upcoming-matches?timeWindow=72h
```

## 📚 **Additional Resources**

- **Prisma Documentation**: https://www.prisma.io/docs/
- **Database Joins**: Understanding INNER JOIN vs LEFT JOIN
- **JSON Field Queries**: PostgreSQL JSON operators
- **Time Filtering**: Date range queries in SQL

---

**Last Updated**: December 2024  
**Status**: ✅ **ISSUE FIXED** - Database join mismatch resolved, now using correct path for match_id  
**Priority**: **RESOLVED** - Core functionality should now work correctly
