# Parlays Implementation - Summary & Recommendations

## ✅ **Analysis Complete**

**Date**: December 12, 2025  
**Status**: Ready for Implementation

---

## 📋 **Key Findings**

### 1. **Database Schema** ✅ **CREATED**

**Decision**: **YES - Create parlay tables**

**Rationale:**
- Parlays are distinct from single predictions
- Need local storage for performance, analytics, and purchase tracking
- Enables faster queries and offline capability
- Supports user history and analytics

**Tables Created:**
- `ParlayConsensus` - Main parlay data
- `ParlayLeg` - Individual legs within parlays
- `ParlayPurchase` - User purchase tracking
- `ParlayPerformance` - Performance metrics

**Schema Location**: `prisma/schema.prisma` (lines 1990+)

### 2. **API Testing** ✅ **COMPLETED**

**Tested Endpoints:**
- ✅ `GET /api/v2/parlays` - Working
- ✅ `GET /api/v2/parlays/recommended` - Working
- ✅ `GET /api/v2/parlays/status` - Working
- ✅ `GET /api/v2/parlays/performance` - Working (returns message when no data)
- ⚠️ `POST /api/v2/parlays/build` - Needs testing (requires POST body)

**API Response Examples:**

**Recommended Parlays:**
```json
{
  "recommended_count": 10,
  "criteria": {
    "min_edge_pct": 5.0,
    "confidence_tiers": ["high", "medium"]
  },
  "parlays": [...]
}
```

**Status:**
```json
{
  "status": "ok",
  "stats": {
    "active_parlays": 22,
    "settled_parlays": 0,
    "expired_parlays": 305,
    "high_confidence_active": 22,
    "avg_edge_pct": 25.4,
    "last_generated": "2025-12-12T16:36:41.290163"
  }
}
```

### 3. **UI/UX Location** ✅ **DECIDED**

**Decision**: **`/dashboard/parlays` + Homepage Feature**

**Primary Location**: `/dashboard/parlays`
- Dedicated page for parlay browsing
- Full filtering and search capabilities
- Similar structure to `/dashboard/matches`
- Add to dashboard navigation under "Predictions & Tips"

**Secondary Location**: Homepage
- "Featured Parlays" section
- Highlights top recommended parlays
- Drives discovery and engagement

**Navigation Structure:**
```
Dashboard Navigation:
├── Overview
├── Predictions & Tips
│   ├── Live Matches
│   ├── Daily Tips
│   ├── Weekend Special
│   ├── VIP Zone
│   ├── CLV Tracker
│   └── 🆕 Parlays  ← NEW
├── User Content
└── Account & Support
```

---

## 🎯 **Implementation Recommendations**

### **Phase 1: Database & API (Week 1)**
1. ✅ Database schema created
2. ⏭️ Run Prisma migration: `npx prisma migrate dev --name add_parlay_tables`
3. ⏭️ Create `/api/parlays` sync route
4. ⏭️ Create sync service to fetch from backend
5. ⏭️ Test `POST /api/v2/parlays/build` endpoint

### **Phase 2: Core UI (Week 2)**
1. ⏭️ Create `/app/dashboard/parlays/page.tsx`
2. ⏭️ Build `ParlayList` component
3. ⏭️ Build `ParlayCard` component
4. ⏭️ Add filtering and sorting
5. ⏭️ Create parlay detail modal

### **Phase 3: Purchase Integration (Week 3)**
1. ⏭️ Integrate with purchase system
2. ⏭️ Create parlay purchase tracking
3. ⏭️ Add user parlay history
4. ⏭️ Build performance tracking

### **Phase 4: Advanced Features (Week 4)**
1. ⏭️ Custom parlay builder
2. ⏭️ Recommended parlays section
3. ⏭️ Homepage featured section
4. ⏭️ Performance analytics dashboard

---

## 📊 **Data Flow**

```
Backend API (/api/v2/parlays)
    ↓
Frontend API Route (/api/parlays)
    ↓
Sync Service (every 15 min)
    ↓
Database (ParlayConsensus, ParlayLeg)
    ↓
Frontend Components
    ↓
User Interface
```

---

## 🔧 **Technical Details**

### **Environment Variables:**
```env
BACKEND_URL=https://bet-genius-ai-onjoroge1.replit.app
BACKEND_API_KEY=betgenius_secure_key_2024
```

### **Sync Strategy:**
- **Active Parlays**: Every 15 minutes
- **Recommended**: Every 30 minutes
- **Status/Performance**: Daily

### **Key Components to Create:**
```
components/parlays/
  ├── ParlayList.tsx
  ├── ParlayCard.tsx
  ├── ParlayDetailModal.tsx
  ├── ParlayLegCard.tsx
  ├── ParlayBuilder.tsx
  ├── RecommendedParlays.tsx
  └── ParlayFilters.tsx
```

---

## ✅ **Next Steps**

1. **Immediate**:
   - Run Prisma migration
   - Create `/api/parlays` route
   - Test parlay build endpoint

2. **This Week**:
   - Implement sync service
   - Create basic parlay list page
   - Add to dashboard navigation

3. **Next Week**:
   - Purchase integration
   - Detail views
   - Filtering and search

---

## 📝 **Summary**

**Questions Answered:**

1. **Should we create parlay tables?** ✅ **YES**
   - Schema created in `prisma/schema.prisma`
   - Ready for migration

2. **Test other parlay APIs?** ✅ **YES - COMPLETED**
   - All GET endpoints tested and working
   - POST endpoint needs testing with body

3. **Where should parlays live?** ✅ **DECIDED**
   - Primary: `/dashboard/parlays`
   - Secondary: Homepage featured section
   - Navigation: Add to dashboard menu

**Status**: Ready to proceed with implementation

---

**Last Updated**: December 12, 2025  
**Next Action**: Run Prisma migration and create API routes



