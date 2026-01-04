# Lite Mode Implementation Plan

**Date**: January 3, 2026  
**Status**: 📋 **PLAN READY**  
**External API**: ✅ `/market?status=live&mode=lite` is live and working (1.1s vs >60s)

---

## 🎯 **Requirements**

1. **Lite mode for homepage table only** ✅
2. **Store lite data in DB, merge with existing full data** (don't overwrite)
3. **Ensure lite doesn't overwrite current API data** (smart merge)
4. **Show all live matches** (remove/increase limit)
5. **Use external API's `mode=lite` endpoint** (already working)

---

## 📋 **External API Lite Response Format**

```json
{
  "matches": [{
    "match_id": 1389277,
    "status": "LIVE",
    "kickoff_at": "2026-01-03T19:00:00+00:00",
    "league": {"id": 62, "name": "Ligue 2"},
    "home": {"name": "Guingamp", "logo_url": "..."},
    "away": {"name": "Boulogne", "logo_url": "..."},
    "prediction": {"pick": "home", "confidence": 0.523},
    "bookmakers": ["bet365", "pinnacle", "..."],
    "score": {"home": 2, "away": 0},
    "elapsed": {"minute": 40, "period": "First Half"}
  }],
  "total_count": 11,
  "mode": "lite"
}
```

**Lite Data Includes**:
- ✅ Basic match info (match_id, status, kickoff_at)
- ✅ Teams (home/away names, logos)
- ✅ League (id, name)
- ✅ Basic prediction (pick, confidence)
- ✅ Bookmaker names (array)
- ✅ Score (for live matches)
- ✅ Elapsed time (for live matches)

**Lite Data Excludes**:
- ❌ Full bookmaker odds (allBookmakers)
- ❌ Full model predictions (v1Model, v2Model details)
- ❌ Live statistics
- ❌ Momentum data
- ❌ Model markets
- ❌ AI analysis

---

## 🔄 **Data Flow Strategy**

### **Current Flow** (Full Data)
```
Homepage → /api/market?status=live&limit=50
  ↓
Database: Check for fresh matches
  ↓
External API: /market?status=live&limit=50 (full data, >60s timeout)
  ↓
Store full data in database
  ↓
Return to frontend
```

### **New Flow** (Lite Mode)
```
Homepage → /api/market?status=live&mode=lite
  ↓
Database: Check for fresh matches
  ↓
External API: /market?status=live&mode=lite (lite data, 1.1s)
  ↓
Merge lite data with existing full data in database
  ↓
Return lite data to frontend
```

### **Individual Match Flow** (Unchanged)
```
Match Page → /api/match/[match_id]
  ↓
Database: Get full data (or fetch full from API if needed)
  ↓
Return full data to frontend
```

---

## 🔀 **Smart Merge Strategy**

### **Problem**: How to merge lite data without overwriting full data?

**Solution**: Update only fields present in lite response, preserve existing full data

### **Merge Logic**:

```typescript
// When storing lite data in database
async function mergeLiteDataIntoDatabase(liteMatch: LiteMatchData) {
  const existing = await prisma.marketMatch.findUnique({
    where: { matchId: String(liteMatch.match_id) }
  })

  if (existing) {
    // MERGE: Update only lite fields, preserve full data
    await prisma.marketMatch.update({
      where: { matchId: String(liteMatch.match_id) },
      data: {
        // Update basic fields from lite data
        status: liteMatch.status,
        homeTeam: liteMatch.home.name,
        homeTeamLogo: liteMatch.home.logo_url,
        awayTeam: liteMatch.away.name,
        awayTeamLogo: liteMatch.away.logo_url,
        league: liteMatch.league.name,
        leagueId: String(liteMatch.league.id),
        kickoffDate: new Date(liteMatch.kickoff_at),
        
        // Update live data from lite (if live match)
        ...(liteMatch.status === 'LIVE' && {
          currentScore: liteMatch.score,
          liveScore: liteMatch.score,
          elapsed: liteMatch.elapsed?.minute,
          minute: liteMatch.elapsed?.minute,
          period: liteMatch.elapsed?.period,
        }),
        
        // Update basic prediction (if provided)
        ...(liteMatch.prediction && {
          // Only update if we don't have full prediction data
          // OR merge basic prediction into existing full data
          modelPredictions: existing.modelPredictions ? {
            ...existing.modelPredictions,
            // Update basic prediction but keep full analysis
            free: liteMatch.prediction ? {
              side: liteMatch.prediction.pick,
              confidence: liteMatch.prediction.confidence * 100
            } : existing.modelPredictions.free
          } : {
            free: {
              side: liteMatch.prediction.pick,
              confidence: liteMatch.prediction.confidence * 100
            }
          }
        }),
        
        // PRESERVE full data fields (don't overwrite)
        // Keep existing: allBookmakers, v1Model, v2Model, liveStatistics, momentum, etc.
        // Only update lastSyncedAt to indicate we got fresh lite data
        lastSyncedAt: new Date(),
        
        // Update sync count
        syncCount: { increment: 1 }
      }
    })
  } else {
    // CREATE: New match, store lite data
    await prisma.marketMatch.create({
      data: {
        matchId: String(liteMatch.match_id),
        status: liteMatch.status,
        homeTeam: liteMatch.home.name,
        homeTeamLogo: liteMatch.home.logo_url,
        awayTeam: liteMatch.away.name,
        awayTeamLogo: liteMatch.away.logo_url,
        league: liteMatch.league.name,
        leagueId: String(liteMatch.league.id),
        kickoffDate: new Date(liteMatch.kickoff_at),
        currentScore: liteMatch.score,
        liveScore: liteMatch.score,
        elapsed: liteMatch.elapsed?.minute,
        minute: liteMatch.elapsed?.minute,
        period: liteMatch.elapsed?.period,
        modelPredictions: liteMatch.prediction ? {
          free: {
            side: liteMatch.prediction.pick,
            confidence: liteMatch.prediction.confidence * 100
          }
        } : null,
        lastSyncedAt: new Date(),
        syncCount: 1
      }
    })
  }
}
```

### **Key Merge Rules**:

1. **Update Basic Fields**: Always update from lite data
   - status, homeTeam, awayTeam, league, kickoffDate
   - score, elapsed, period (for live matches)

2. **Preserve Full Data**: Never overwrite full data fields
   - allBookmakers (keep existing full odds)
   - v1Model, v2Model (keep existing full predictions)
   - liveStatistics, momentum, modelMarkets, aiAnalysis (keep existing)

3. **Smart Prediction Merge**: 
   - If existing has full prediction → Keep full, update basic fields only
   - If existing has no prediction → Use lite prediction
   - If both exist → Merge (keep full analysis, update basic pick/confidence)

4. **Update Timestamp**: Always update `lastSyncedAt` to indicate fresh data

---

## 📋 **Implementation Plan**

### **Phase 1: Update `/api/market` Route to Support `mode=lite`**

**File**: `app/api/market/route.ts`

**Changes**:
1. Add `mode` query parameter check
2. When `mode=lite`, call external API with `mode=lite`
3. Transform lite response to our format
4. Merge lite data with database (smart merge)
5. Return lite data to frontend

**Code Structure**:
```typescript
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('mode') // 'lite' or null
  const status = searchParams.get('status') || 'upcoming'
  const limit = searchParams.get('limit') || (mode === 'lite' ? '1000' : '10') // No limit for lite
  
  const isLite = mode === 'lite'
  
  // Database query (same as before)
  // ...
  
  // External API fallback
  let url = `${BASE_URL}/market?status=${status}`
  
  if (isLite) {
    url += `&mode=lite` // Use lite endpoint
    // No limit or high limit for live matches
    if (status === 'live') {
      url += `&limit=1000` // Get all live matches
    } else {
      url += `&limit=${limit}`
    }
  } else {
    url += `&limit=${limit}`
    if (includeV2 === 'false') {
      url += '&include_v2=false'
    }
  }
  
  // Fetch and merge logic
  // ...
}
```

---

### **Phase 2: Create Lite Data Merge Function**

**File**: `lib/market-match-helpers.ts` (or new file)

**Function**: `mergeLiteDataIntoDatabase(liteMatch, existingMatch)`

**Logic**:
- Update basic fields from lite data
- Preserve full data fields (allBookmakers, v1Model, v2Model, etc.)
- Smart prediction merge
- Update timestamp

---

### **Phase 3: Update Frontend Components**

**Files to Update**:
1. `components/homepage-matches.tsx`
   - Change: `/api/market?status=live&limit=50` → `/api/market?status=live&mode=lite`
   - Remove limit for live matches (or set to 1000)

2. `components/ui/odds-prediction-table.tsx`
   - Add `mode=lite` for list views
   - Keep full mode for detail views

3. `components/marquee-ticker.tsx`
   - Add `mode=lite`

---

### **Phase 4: Update Sync Process**

**File**: `app/api/admin/market/sync-scheduled/route.ts`

**Strategy**:
- **Option A**: Use lite mode for sync (faster, then enrich with full data later)
- **Option B**: Keep full mode for sync (ensures we have complete data)
- **Option C**: Hybrid - Use lite for live matches (frequent sync), full for upcoming (less frequent)

**Recommendation**: **Option C** (Hybrid)
- Live matches: Use lite mode (sync every 30s, fast updates)
- Upcoming matches: Use full mode (sync every 10min, complete data)
- Completed matches: Use full mode (one-time sync)

---

## 🔍 **Data Preservation Strategy**

### **Scenario 1: Database has Full Data, Lite Data Arrives**

**Before**:
```json
{
  "allBookmakers": {"bet365": {...}, "pinnacle": {...}},
  "v1Model": {"pick": "home", "confidence": 0.75, "probs": {...}},
  "liveStatistics": {...}
}
```

**Lite Data Arrives**:
```json
{
  "score": {"home": 2, "away": 1},
  "elapsed": {"minute": 40}
}
```

**After Merge**:
```json
{
  "allBookmakers": {"bet365": {...}, "pinnacle": {...}}, // ✅ PRESERVED
  "v1Model": {"pick": "home", "confidence": 0.75, "probs": {...}}, // ✅ PRESERVED
  "liveStatistics": {...}, // ✅ PRESERVED
  "currentScore": {"home": 2, "away": 1}, // ✅ UPDATED from lite
  "elapsed": 40 // ✅ UPDATED from lite
}
```

### **Scenario 2: Database has No Data, Lite Data Arrives**

**Action**: Create new record with lite data
- Store basic fields from lite
- Leave full data fields as null
- Full data can be added later via sync or individual match fetch

### **Scenario 3: Database has Lite Data, Full Data Arrives**

**Action**: Merge full data into existing record
- Update all fields from full data
- Preserve any additional fields we added

---

## 📊 **Response Transformation**

### **Lite Response from External API**:
```json
{
  "match_id": 1389277,
  "status": "LIVE",
  "score": {"home": 2, "away": 0},
  "elapsed": {"minute": 40, "period": "First Half"}
}
```

### **Transform to Our Format**:
```typescript
function transformLiteMatchToApiFormat(liteMatch: any): any {
  return {
    id: liteMatch.match_id,
    match_id: liteMatch.match_id,
    status: liteMatch.status.toLowerCase(),
    home: {
      name: liteMatch.home.name,
      logo_url: liteMatch.home.logo_url
    },
    away: {
      name: liteMatch.away.name,
      logo_url: liteMatch.away.logo_url
    },
    league: {
      name: liteMatch.league.name,
      country: liteMatch.league.country || null
    },
    kickoff_at: liteMatch.kickoff_at,
    score: liteMatch.score,
    elapsed: liteMatch.elapsed?.minute,
    period: liteMatch.elapsed?.period,
    odds: {
      consensus: liteMatch.odds?.consensus || null
    },
    prediction: liteMatch.prediction ? {
      team: liteMatch.prediction.pick === 'home' ? liteMatch.home.name : 
            liteMatch.prediction.pick === 'away' ? liteMatch.away.name : 'Draw',
      confidence: Math.round(liteMatch.prediction.confidence * 100),
      isPremium: false // Lite mode doesn't include premium
    } : null,
    bookmakers: liteMatch.bookmakers || []
  }
}
```

---

## 🎯 **Implementation Checklist**

### **Backend** ✅
- [ ] Add `mode` parameter to `/api/market` route
- [ ] Add `mode=lite` to external API URL when lite mode
- [ ] Remove/increase limit for live matches in lite mode
- [ ] Create `mergeLiteDataIntoDatabase()` function
- [ ] Implement smart merge logic (preserve full data)
- [ ] Transform lite response to our format
- [ ] Test merge logic (don't overwrite full data)

### **Frontend** ✅
- [ ] Update `homepage-matches.tsx` to use `mode=lite`
- [ ] Remove limit for live matches (or set to 1000)
- [ ] Update `odds-prediction-table.tsx` for list views
- [ ] Update `marquee-ticker.tsx` to use `mode=lite`
- [ ] Test homepage loading performance

### **Sync Process** ✅
- [ ] Update sync to use lite mode for live matches
- [ ] Keep full mode for upcoming matches
- [ ] Test sync performance

---

## 🧪 **Testing Plan**

### **Test 1: Lite Mode Doesn't Overwrite Full Data**

**Setup**:
1. Create match in database with full data (allBookmakers, v1Model, etc.)
2. Call `/api/market?status=live&mode=lite`
3. Check database after merge

**Expected**:
- ✅ Basic fields updated (score, elapsed, etc.)
- ✅ Full data preserved (allBookmakers, v1Model, etc.)
- ✅ lastSyncedAt updated

### **Test 2: Lite Mode Performance**

**Test**:
```bash
time curl "http://localhost:3000/api/market?status=live&mode=lite"
```

**Expected**:
- ✅ Response time <2 seconds
- ✅ Returns all live matches (no limit)
- ✅ Payload size ~50KB (vs 500KB for full)

### **Test 3: Backward Compatibility**

**Test**:
```bash
# Full mode (no mode parameter)
curl "http://localhost:3000/api/market?status=live&limit=50"

# Should still work (backward compatible)
```

**Expected**:
- ✅ Returns full data (current behavior)
- ✅ No breaking changes

---

## 📊 **Expected Results**

### **Performance**:
- ✅ Lite endpoint: <2 seconds (vs >60 seconds)
- ✅ 50x+ speedup (as confirmed by benchmark)
- ✅ No timeouts
- ✅ All live matches returned (no limit)

### **Data Integrity**:
- ✅ Full data preserved in database
- ✅ Lite data updates basic fields only
- ✅ No data loss
- ✅ Smart merge works correctly

### **User Experience**:
- ✅ Homepage loads in <2 seconds
- ✅ All live matches displayed
- ✅ No timeout errors
- ✅ Smooth user experience

---

**Status**: 📋 **PLAN READY**  
**Next**: Implement `mode=lite` support with smart merge logic

