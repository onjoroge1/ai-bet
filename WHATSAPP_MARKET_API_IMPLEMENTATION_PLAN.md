# 📱 WhatsApp Market API Integration - Implementation Plan

## 🎯 **Objective**

Implement hybrid approach (Market API primary + QuickPurchase fallback) for WhatsApp picks, with Redis caching for upcoming matches, including dates, consensus odds, and model predictions.

---

## 📊 **Architecture Overview**

```
WhatsApp User → "1" (picks)
    ↓
getTodaysPicks() Function
    ↓
┌─────────────────────────────────────┐
│  Step 1: Try Market API (Cached)    │
│  - Check Redis cache (10min TTL)    │
│  - If miss: Fetch from /api/market  │
│  - Cache result in Redis             │
└─────────────────────────────────────┘
    ↓ (Success)
┌─────────────────────────────────────┐
│  Step 2: Join with QuickPurchase    │
│  - Extract matchIds from Market API │
│  - Query QuickPurchase WHERE IN     │
│  - Merge: Market data + QP data     │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Step 3: Filter & Enrich            │
│  - Only matches with predictionData │
│  - Add confidence, price, odds      │
│  - Sort by confidenceScore DESC      │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Step 4: Format for WhatsApp        │
│  - Include dates, odds, predictions │
│  - Format message with all data     │
└─────────────────────────────────────┘
    ↓
Fallback: If Market API fails → QuickPurchase-only query
```

---

## 🗂️ **Data Flow**

### **Market API Response Structure**
```typescript
{
  matches: [
    {
      id: "123456",
      status: "upcoming",
      kickoff_utc: "2025-01-15T18:00:00Z",
      home: { name: "Arsenal", id: 1 },
      away: { name: "Chelsea", id: 2 },
      league: { name: "Premier League", id: 39 },
      odds: {
        bet365: { home: 2.10, draw: 3.40, away: 3.20 },
        pinnacle: { home: 2.08, draw: 3.45, away: 3.25 },
        // ... consensus odds
      },
      primaryBook: "bet365",
      booksCount: 5, // Number of bookmakers
      predictions: {
        free: { side: "home", confidence: 0.65 },
        premium: { side: "home", confidence: 0.78 }
      }
    }
  ],
  total_count: 50
}
```

### **QuickPurchase Data Structure**
```typescript
{
  matchId: "123456",
  confidenceScore: 78,
  price: 9.99,
  odds: 2.10,
  valueRating: "High",
  predictionData: { ... },
  matchData: { ... }
}
```

### **Merged WhatsApp Pick Structure**
```typescript
{
  matchId: "123456",
  quickPurchaseId: "qp_abc123",
  homeTeam: "Arsenal",
  awayTeam: "Chelsea",
  league: "Premier League",
  kickoffDate: "2025-01-15T18:00:00Z", // From Market API
  market: "1X2",
  tip: "Arsenal to win",
  confidence: 78, // From QuickPurchase
  price: 9.99, // From QuickPurchase
  currency: "USD",
  odds: {
    consensus: { home: 2.10, draw: 3.40, away: 3.20 }, // From Market API
    primaryBook: "bet365",
    booksCount: 5
  },
  modelPredictions: {
    free: { side: "home", confidence: 65 }, // From Market API
    premium: { side: "home", confidence: 78 } // From Market API
  }
}
```

---

## 🏗️ **Implementation Components**

### **1. Redis Cache Layer** (`lib/whatsapp-market-cache.ts`)

**Purpose:** Cache Market API responses for upcoming matches

**Key Functions:**
- `getCachedUpcomingMatches()` - Get from Redis cache
- `setCachedUpcomingMatches()` - Store in Redis cache
- `invalidateUpcomingMatchesCache()` - Clear cache (if needed)

**Cache Key:** `whatsapp:market:upcoming`
**TTL:** 600 seconds (10 minutes)
**Cache Strategy:** 
- Check cache first
- If miss: Fetch from Market API
- Store in cache with TTL
- Return cached data

**Important:** 
- ❌ **DO NOT cache** `status=live` matches (real-time nature)
- ✅ **ONLY cache** `status=upcoming` matches

---

### **2. Market API Fetcher** (`lib/whatsapp-market-fetcher.ts`)

**Purpose:** Fetch and normalize Market API data

**Key Functions:**
- `fetchUpcomingMatchesFromMarket()` - Fetch from `/api/market?status=upcoming`
- `normalizeMarketMatch()` - Transform API response to WhatsApp format
- `extractMatchIds()` - Get list of matchIds for QuickPurchase join

**Error Handling:**
- Timeout: 5 seconds
- Retry: 1 retry on failure
- Fallback: Return empty array, trigger QuickPurchase fallback

---

### **3. Enhanced Picks Fetcher** (`lib/whatsapp-picks.ts` - Updated)

**Purpose:** Hybrid approach - Market API primary, QuickPurchase fallback

**Key Function:** `getTodaysPicks()` - **MAJOR UPDATE**

**Flow:**
```typescript
async function getTodaysPicks(): Promise<WhatsAppPick[]> {
  // Step 1: Try Market API (with cache)
  const marketMatches = await getMarketMatchesWithCache()
  
  if (marketMatches.length > 0) {
    // Step 2: Join with QuickPurchase
    const matchIds = marketMatches.map(m => m.id.toString())
    const quickPurchases = await getQuickPurchasesByMatchIds(matchIds)
    
    // Step 3: Merge data
    const mergedPicks = mergeMarketAndQuickPurchase(marketMatches, quickPurchases)
    
    // Step 4: Filter & Sort
    return filterAndSortPicks(mergedPicks)
  }
  
  // Fallback: QuickPurchase-only
  return getQuickPurchaseOnlyPicks()
}
```

**Helper Functions:**
- `getMarketMatchesWithCache()` - Get from cache or API
- `getQuickPurchasesByMatchIds()` - Batch query QuickPurchase
- `mergeMarketAndQuickPurchase()` - Combine data sources
- `filterAndSortPicks()` - Filter active, sort by confidence
- `getQuickPurchaseOnlyPicks()` - Fallback to current implementation

---

### **4. Enhanced WhatsApp Message Formatter** (`lib/whatsapp-picks.ts` - Updated)

**Purpose:** Format picks with dates, odds, and predictions

**Updated Function:** `formatPickForWhatsApp()`

**New Format:**
```
1) Match ID: 123456
   Arsenal vs Chelsea
   📅 Date: Jan 15, 2025 6:00 PM UTC
   🏆 League: Premier League
   📊 Market: 1X2
   💡 Tip: Arsenal to win
   📈 Confidence: 78%
   💰 Price: $9.99
   📊 Consensus Odds: Home 2.10 | Draw 3.40 | Away 3.20
   📚 Bookmakers: 5 (bet365, pinnacle, ...)
   🤖 Model Prediction: Home Win (78% confidence)
```

---

## 🔧 **Technical Implementation Details**

### **Redis Cache Configuration**

**Cache Key Structure:**
```
whatsapp:market:upcoming
```

**Cache Value:**
```json
{
  "matches": [...],
  "cachedAt": "2025-01-15T10:00:00Z",
  "ttl": 600
}
```

**Cache Operations:**
- **Get:** Check if exists and not expired
- **Set:** Store with 10-minute TTL
- **Invalidate:** Clear on demand (optional, for admin)

**Error Handling:**
- If Redis fails: Continue without cache (fetch from API)
- Log Redis errors but don't block flow

---

### **Market API Integration**

**Endpoint:** `/api/market?status=upcoming&limit=50`

**Parameters:**
- `status=upcoming` (required)
- `limit=50` (get more matches for better selection)
- `include_v2=false` (faster response, we get predictions from QuickPurchase)

**Response Handling:**
- Parse JSON response
- Extract `matches` array
- Validate match structure
- Handle empty responses gracefully

**Timeout:** 5 seconds
**Retry:** 1 attempt on failure

---

### **QuickPurchase Join Strategy**

**Query:**
```sql
SELECT * FROM "QuickPurchase"
WHERE "matchId" IN ('123456', '789012', ...)
  AND "type" = 'prediction'
  AND "isActive" = true
  AND "isPredictionActive" = true
  AND "predictionData" IS NOT NULL
```

**Optimization:**
- Use `IN` clause for batch lookup
- Index on `matchId` (already exists)
- Limit to 50 matches max (performance)

**Data Merging:**
- Match by `matchId` (string comparison)
- Market API provides: dates, odds, model predictions
- QuickPurchase provides: confidence, price, full prediction data
- Combine into single pick object

---

### **Filtering & Sorting**

**Filter Criteria:**
1. Must have `predictionData` in QuickPurchase
2. Must be `isActive = true`
3. Must be `isPredictionActive = true`
4. Must have valid `matchId`

**Sort Criteria:**
1. Primary: `confidenceScore DESC` (from QuickPurchase)
2. Secondary: `kickoff_utc ASC` (from Market API - earlier matches first)

**Limit:** Top 20 picks

---

## 📝 **WhatsApp Message Format**

### **Current Format (Before):**
```
1) Match ID: 123456
   Arsenal vs Chelsea
   Market: 1X2
   Tip: Arsenal to win
   Confidence: 78%
   Price: $9.99
```

### **New Format (After):**
```
1) Match ID: 123456
   Arsenal vs Chelsea
   📅 Jan 15, 2025 6:00 PM UTC
   🏆 Premier League
   📊 Market: 1X2
   💡 Tip: Arsenal to win
   📈 Confidence: 78%
   💰 Price: $9.99
   📊 Odds: Home 2.10 | Draw 3.40 | Away 3.20
   📚 5 bookmakers (bet365, pinnacle, ...)
   🤖 Model: Home Win (78%)
```

**Character Count:** ~200-250 chars per pick (WhatsApp limit: 4096 chars per message)
**Total Picks:** 20 picks = ~4000-5000 chars (may need to split into 2 messages)

---

## 🚨 **Error Handling & Fallbacks**

### **Scenario 1: Market API Fails**
- **Action:** Fallback to QuickPurchase-only query
- **Log:** Warning with error details
- **User Impact:** Still gets picks (just without Market API data)

### **Scenario 2: Redis Cache Fails**
- **Action:** Fetch directly from Market API (skip cache)
- **Log:** Warning about cache failure
- **User Impact:** Slightly slower response, but still works

### **Scenario 3: Market API Returns Empty**
- **Action:** Fallback to QuickPurchase-only query
- **Log:** Info message
- **User Impact:** Still gets picks from database

### **Scenario 4: QuickPurchase Join Returns No Matches**
- **Action:** Return empty array with message
- **Log:** Warning about sync gap
- **User Impact:** "No picks available" message

### **Scenario 5: Partial Data (Market API has match, but no QuickPurchase)**
- **Action:** Skip that match (only show purchasable matches)
- **Log:** Debug message
- **User Impact:** Only sees matches they can actually buy

---

## ⚡ **Performance Considerations**

### **Caching Strategy**
- **Cache Hit:** ~10-50ms (Redis lookup)
- **Cache Miss:** ~500-2000ms (Market API call + cache store)
- **QuickPurchase Query:** ~50-100ms (database lookup)
- **Total (Cache Hit):** ~60-150ms
- **Total (Cache Miss):** ~550-2100ms

### **Optimization Opportunities**
1. **Batch QuickPurchase Query:** Single query with `IN` clause
2. **Redis Pipeline:** Batch cache operations if needed
3. **Parallel Fetching:** Market API + QuickPurchase query in parallel (if cache miss)
4. **Response Compression:** Not needed for WhatsApp (text only)

### **Rate Limiting**
- Market API: No explicit rate limit (but respect backend limits)
- Redis: No rate limit concerns
- Database: Batch query is efficient

---

## 🧪 **Testing Strategy**

### **Unit Tests**
1. **Cache Layer:**
   - Test cache hit/miss scenarios
   - Test TTL expiration
   - Test Redis failure handling

2. **Market API Fetcher:**
   - Test successful fetch
   - Test timeout handling
   - Test empty response handling
   - Test invalid response handling

3. **Data Merging:**
   - Test successful merge
   - Test partial data scenarios
   - Test duplicate matchIds

4. **Message Formatting:**
   - Test single pick formatting
   - Test multiple picks formatting
   - Test character limit handling

### **Integration Tests**
1. **End-to-End Flow:**
   - Market API → Cache → QuickPurchase → Format → WhatsApp
   - Fallback flow: Market API fails → QuickPurchase-only

2. **Performance Tests:**
   - Measure cache hit performance
   - Measure cache miss performance
   - Measure fallback performance

### **Manual Testing**
1. **Cache Behavior:**
   - First request (cache miss)
   - Second request (cache hit)
   - After 10 minutes (cache expired)

2. **Error Scenarios:**
   - Market API down
   - Redis down
   - Database down
   - Partial failures

---

## 📋 **Implementation Checklist**

### **Phase 1: Infrastructure Setup**
- [ ] Create `lib/whatsapp-market-cache.ts` (Redis cache layer)
- [ ] Create `lib/whatsapp-market-fetcher.ts` (Market API fetcher)
- [ ] Add Redis cache key constants
- [ ] Add error handling utilities

### **Phase 2: Core Logic**
- [ ] Update `getTodaysPicks()` in `lib/whatsapp-picks.ts`
- [ ] Implement `getMarketMatchesWithCache()` function
- [ ] Implement `getQuickPurchasesByMatchIds()` function
- [ ] Implement `mergeMarketAndQuickPurchase()` function
- [ ] Implement `filterAndSortPicks()` function
- [ ] Implement `getQuickPurchaseOnlyPicks()` fallback

### **Phase 3: Message Formatting**
- [ ] Update `formatPickForWhatsApp()` to include dates, odds, predictions
- [ ] Update `formatPicksList()` to handle new format
- [ ] Add emoji support for better readability
- [ ] Handle message length limits (split if needed)

### **Phase 4: Error Handling**
- [ ] Add Market API error handling
- [ ] Add Redis cache error handling
- [ ] Add fallback logic
- [ ] Add comprehensive logging

### **Phase 5: Testing**
- [ ] Unit tests for cache layer
- [ ] Unit tests for Market API fetcher
- [ ] Unit tests for data merging
- [ ] Integration tests for full flow
- [ ] Manual testing in production

### **Phase 6: Monitoring**
- [ ] Add cache hit/miss metrics
- [ ] Add Market API response time metrics
- [ ] Add fallback usage metrics
- [ ] Add error rate metrics

---

## 🔍 **Key Design Decisions**

### **1. Why 10-Minute Cache?**
- **Balance:** Freshness vs Performance
- **Rationale:** Upcoming matches don't change frequently
- **Trade-off:** Slight staleness (10 min) for much faster responses

### **2. Why NOT Cache Live Matches?**
- **Real-time Nature:** Live matches change every second
- **User Expectation:** Users expect real-time data for live matches
- **Performance:** Live matches are less common, acceptable to fetch fresh

### **3. Why Hybrid Approach?**
- **Coverage:** Market API has all upcoming matches
- **Reliability:** QuickPurchase has purchase data
- **Resilience:** Fallback if Market API fails
- **Best of Both:** Real-time match data + Purchase capability

### **4. Why Include Dates, Odds, Predictions?**
- **User Value:** More information = better decisions
- **Differentiation:** WhatsApp picks more comprehensive than web
- **Trust:** Showing odds and model predictions builds confidence

---

## 📊 **Expected Outcomes**

### **Performance Improvements**
- **Cache Hit:** 10-50ms (vs 500-2000ms without cache)
- **Cache Miss:** 550-2100ms (acceptable, cached for next 10 min)
- **Fallback:** 50-100ms (QuickPurchase-only, still fast)

### **User Experience Improvements**
- **More Matches:** All upcoming matches visible (not just synced ones)
- **More Information:** Dates, odds, model predictions included
- **Better Selection:** Sorted by confidence, filtered by quality
- **Reliability:** Fallback ensures picks always available

### **System Reliability**
- **Resilience:** Multiple fallback layers
- **Monitoring:** Cache hit/miss metrics
- **Error Handling:** Graceful degradation

---

## 🚀 **Next Steps**

1. **Review & Approve:** This implementation plan
2. **Setup Redis:** Ensure Redis is configured and accessible
3. **Implement Phase 1:** Infrastructure setup
4. **Implement Phase 2:** Core logic
5. **Implement Phase 3:** Message formatting
6. **Test:** Comprehensive testing
7. **Deploy:** Gradual rollout with monitoring

---

## ❓ **Open Questions**

1. **Message Length:** Should we split into multiple messages if > 4096 chars?
2. **Cache Invalidation:** Do we need manual cache clearing for admin?
3. **Monitoring:** What metrics should we track?
4. **Rate Limiting:** Should we add rate limiting for Market API calls?

---

**Status:** 📋 **PLAN READY FOR REVIEW**

**Next Action:** Review plan, answer open questions, then proceed with implementation.

