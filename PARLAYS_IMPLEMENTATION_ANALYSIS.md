# Parlays Implementation Analysis & Plan

## Executive Summary

**Date**: December 12, 2025  
**Status**: 🔄 **ANALYSIS COMPLETE - READY FOR IMPLEMENTATION**  
**Priority**: HIGH - New Product Feature  
**Goal**: Integrate backend parlay API into frontend with proper data storage and user interface

---

## 1. Database Schema Analysis

### ✅ **Recommendation: CREATE PARLAY TABLES**

**Rationale:**
- Parlays are a distinct product type from single predictions
- Need to track parlay performance, user purchases, and historical data
- Backend API provides parlay data that should be cached/synced locally
- Enables filtering, search, and analytics on parlays
- Supports purchase tracking and user history

### **Proposed Schema:**

```prisma
model ParlayConsensus {
  id                String   @id @default(cuid())
  parlayId          String   @unique // Backend parlay_id (UUID)
  legCount          Int
  combinedProb      Decimal
  correlationPenalty Decimal
  adjustedProb      Decimal
  impliedOdds       Decimal
  edgePct           Decimal
  confidenceTier    String   // "high", "medium", "low"
  parlayType        String   // "same_league", "cross_league", etc.
  leagueGroup       String?
  earliestKickoff   DateTime
  latestKickoff     DateTime
  kickoffWindow     String   // "today", "tomorrow", "this_week"
  status            String   @default("active") // "active", "expired", "settled"
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  syncedAt          DateTime @default(now())
  
  legs              ParlayLeg[]
  purchases         ParlayPurchase[]
  performance       ParlayPerformance[]
  
  @@index([status, earliestKickoff])
  @@index([confidenceTier, edgePct])
  @@index([parlayType, status])
  @@index([syncedAt])
}

model ParlayLeg {
  id                String   @id @default(cuid())
  parlayId          String
  matchId           String   // Backend match_id
  outcome           String   // "H", "D", "A"
  homeTeam          String
  awayTeam          String
  modelProb         Decimal
  decimalOdds       Decimal
  edge              Decimal
  legOrder          Int      // Order in parlay (1, 2, 3...)
  
  parlay            ParlayConsensus @relation(fields: [parlayId], references: [id], onDelete: Cascade)
  
  @@unique([parlayId, legOrder])
  @@index([matchId])
  @@index([parlayId])
}

model ParlayPurchase {
  id                String   @id @default(cuid())
  userId            String
  parlayId          String
  amount            Decimal
  paymentMethod     String
  status            String   // "pending", "completed", "failed", "won", "lost", "void"
  potentialReturn   Decimal?
  actualReturn      Decimal?
  purchasedAt       DateTime @default(now())
  settledAt         DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  user              User     @relation(fields: [userId], references: [id])
  parlay            ParlayConsensus @relation(fields: [parlayId], references: [id])
  
  @@index([userId, status])
  @@index([parlayId])
  @@index([purchasedAt])
}

model ParlayPerformance {
  id                String   @id @default(cuid())
  parlayId          String
  totalPurchases    Int      @default(0)
  totalWins         Int      @default(0)
  totalLosses       Int      @default(0)
  totalVoids        Int      @default(0)
  totalRevenue      Decimal  @default(0)
  totalPayouts      Decimal  @default(0)
  avgStake          Decimal?
  winRate           Decimal?
  roi               Decimal?
  calculatedAt      DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  parlay            ParlayConsensus @relation(fields: [parlayId], references: [id])
  
  @@unique([parlayId])
  @@index([winRate, roi])
}
```

### **User Model Addition:**
```prisma
model User {
  // ... existing fields ...
  parlayPurchases   ParlayPurchase[]
}
```

---

## 2. API Endpoint Testing & Integration

### **Backend API Endpoints - Test Results:**

1. **`GET /api/v2/parlays`** ✅ Tested
   - Returns list of active parlays
   - Filters: `status_filter`, `limit`, `offset`
   - Response: `{ count, status_filter, parlays: [...] }`
   - **Status**: Working correctly

2. **`GET /api/v2/parlays/recommended`** ✅ Tested
   - AI-curated high-edge parlays
   - Response: `{ recommended_count, criteria: { min_edge_pct, confidence_tiers }, parlays: [...] }`
   - **Status**: Working correctly
   - Returns top 10 recommended parlays with filtering criteria

3. **`POST /api/v2/parlays/build`** ⚠️ Needs Testing
   - Build custom parlay from match selections
   - Input: Array of match selections
   - Output: Calculated parlay with odds
   - **Status**: Not yet tested (requires POST with body)

4. **`GET /api/v2/parlays/status`** ✅ Tested
   - System statistics
   - Response: `{ status: "ok", stats: { active_parlays, settled_parlays, expired_parlays, high_confidence_active, avg_edge_pct, last_generated } }`
   - **Status**: Working correctly
   - Example: `{ "status": "ok", "stats": { "active_parlays": 22, "settled_parlays": 0, "expired_parlays": 305, "high_confidence_active": 22, "avg_edge_pct": 25.4, "last_generated": "2025-12-12T16:36:41.290163" } }`

5. **`GET /api/v2/parlays/performance`** ✅ Tested
   - ROI tracking
   - Response: `{ message: "No settled parlays yet" }` (when no data)
   - **Status**: Working correctly (returns message when no performance data available)

### **Frontend API Routes to Create:**

```
/api/parlays
  GET  - List parlays (with filters)
  POST - Sync parlays from backend

/api/parlays/recommended
  GET  - Get recommended parlays

/api/parlays/build
  POST - Build custom parlay

/api/parlays/[parlayId]
  GET  - Get single parlay details

/api/parlays/purchase
  POST - Purchase a parlay

/api/parlays/performance
  GET  - Get performance metrics
```

---

## 3. UI/UX Location Analysis

### **Option A: Separate `/dashboard/parlays` Page** ✅ **RECOMMENDED**

**Pros:**
- Clear separation from single predictions
- Dedicated space for parlay-specific features
- Better organization and navigation
- Can have parlay-specific filters and views
- Matches user mental model (parlays = different product)

**Cons:**
- Additional navigation item
- May reduce discovery if users don't know about it

**Implementation:**
- Add to dashboard navigation under "Predictions & Tips" section
- Create `/app/dashboard/parlays/page.tsx`
- Similar structure to `/dashboard/matches` but parlay-focused

### **Option B: Integrate with `/dashboard/matches`**

**Pros:**
- Single location for all betting options
- Users see both singles and parlays together
- Easier discovery

**Cons:**
- Clutters matches page
- Different product types mixed together
- Harder to filter and organize
- Parlays have different purchase flow

### **Option C: Homepage Section**

**Pros:**
- High visibility
- Good for discovery

**Cons:**
- Homepage already has many sections
- Better suited for featured/highlighted content
- Not ideal for browsing all parlays

### **✅ FINAL RECOMMENDATION: Option A + Homepage Feature**

**Implementation Strategy:**
1. **Primary Location**: `/dashboard/parlays` - Full parlay browsing and management
2. **Homepage Feature**: Add "Featured Parlays" section on homepage (similar to featured predictions)
3. **Navigation**: Add "Parlays" to dashboard nav under "Predictions & Tips"
4. **Cross-linking**: Link from matches page to parlays (and vice versa)

---

## 4. Implementation Phases

### **Phase 1: Foundation (Week 1)**
- [x] Database schema design
- [ ] Create Prisma schema migrations
- [ ] Test all backend parlay API endpoints
- [ ] Create `/api/parlays` sync route
- [ ] Create database sync service

### **Phase 2: Core Features (Week 2)**
- [ ] Create `/dashboard/parlays` page
- [ ] Build parlay list component
- [ ] Build parlay card component
- [ ] Implement filtering and sorting
- [ ] Add parlay detail modal/page

### **Phase 3: Purchase Integration (Week 3)**
- [ ] Integrate with QuickPurchaseModal (or create ParlayPurchaseModal)
- [ ] Add parlay purchase tracking
- [ ] Create user parlay history
- [ ] Add parlay performance tracking

### **Phase 4: Advanced Features (Week 4)**
- [ ] Custom parlay builder
- [ ] Recommended parlays section
- [ ] Performance analytics
- [ ] Homepage featured parlays

---

## 5. Data Sync Strategy

### **Sync Frequency:**
- **Active Parlays**: Every 15 minutes
- **Recommended Parlays**: Every 30 minutes
- **Performance Data**: Daily

### **Sync Logic:**
```typescript
// Pseudo-code for sync service
async function syncParlays() {
  // 1. Fetch from backend API
  const response = await fetch(`${BACKEND_URL}/api/v2/parlays`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` }
  })
  const { parlays } = await response.json()
  
  // 2. Upsert parlays
  for (const parlay of parlays) {
    await prisma.parlayConsensus.upsert({
      where: { parlayId: parlay.parlay_id },
      update: {
        legCount: parlay.leg_count,
        combinedProb: parlay.combined_prob,
        // ... update all fields
        syncedAt: new Date()
      },
      create: {
        parlayId: parlay.parlay_id,
        // ... create with all fields
      }
    })
    
    // 3. Upsert legs
    for (const [index, leg] of parlay.legs.entries()) {
      await prisma.parlayLeg.upsert({
        where: {
          parlayId_legOrder: {
            parlayId: parlay.parlay_id,
            legOrder: index + 1
          }
        },
        update: { /* ... */ },
        create: { /* ... */ }
      })
    }
  }
  
  // 4. Mark expired parlays
  await prisma.parlayConsensus.updateMany({
    where: {
      latestKickoff: { lt: new Date() },
      status: 'active'
    },
    data: { status: 'expired' }
  })
}
```

---

## 6. Component Structure

```
components/
  parlays/
    ParlayList.tsx          # Main list view
    ParlayCard.tsx           # Individual parlay card
    ParlayDetailModal.tsx    # Detailed view modal
    ParlayLegCard.tsx        # Single leg display
    ParlayBuilder.tsx        # Custom parlay builder
    RecommendedParlays.tsx   # Featured/recommended section
    ParlayPerformance.tsx    # Performance metrics
    ParlayFilters.tsx        # Filter controls
```

---

## 7. Key Decisions

### ✅ **Decision 1: Create Parlay Tables**
**Answer: YES** - Store parlay data locally for:
- Faster queries
- Offline capability
- Analytics and reporting
- Purchase tracking
- Performance metrics

### ✅ **Decision 2: Test All APIs**
**Answer: YES** - Need to test:
- `/api/v2/parlays/recommended`
- `/api/v2/parlays/build`
- `/api/v2/parlays/status`
- `/api/v2/parlays/performance`

### ✅ **Decision 3: UI Location**
**Answer: `/dashboard/parlays` + Homepage Feature**
- Primary: Dedicated parlay page
- Secondary: Featured section on homepage
- Navigation: Add to dashboard menu

---

## 8. Next Steps

1. **Immediate (Today)**:
   - Test all backend parlay API endpoints
   - Document API responses
   - Create Prisma schema

2. **This Week**:
   - Implement database sync
   - Create `/api/parlays` routes
   - Build basic parlay list page

3. **Next Week**:
   - Add purchase integration
   - Build parlay detail views
   - Add filtering and search

---

## 9. Technical Considerations

### **Environment Variables:**
```env
BACKEND_URL=https://bet-genius-ai-onjoroge1.replit.app
BACKEND_API_KEY=betgenius_secure_key_2024
```

### **Error Handling:**
- Handle API failures gracefully
- Retry logic for sync operations
- User-friendly error messages
- Fallback to cached data

### **Performance:**
- Cache parlay data (5-15 min TTL)
- Paginate large parlay lists
- Lazy load parlay details
- Optimize database queries with indexes

### **Security:**
- Validate parlay IDs
- Sanitize user inputs
- Rate limit API calls
- Authenticate purchase requests

---

**Last Updated**: December 12, 2025  
**Status**: Ready for Implementation  
**Next Review**: After Phase 1 completion

