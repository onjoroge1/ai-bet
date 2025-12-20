# 📊 MarketMatch Table Schema - Comprehensive Design

## 🎯 **Overview**

This document defines the optimal `MarketMatch` table structure based on:
1. Market API responses for `upcoming`, `live`, and `completed` statuses
2. Match detail page (`/match/[match_id]`) requirements
3. Integration with QuickPurchase table
4. Frontend and WhatsApp system needs

---

## 📋 **Complete Schema Definition**

```prisma
model MarketMatch {
  id                String   @id @default(cuid())
  matchId           String   @unique // External API match ID (string or number as string)
  status            String   // "UPCOMING", "LIVE", "FINISHED", "CANCELLED", "POSTPONED"
  
  // ============================================
  // BASIC MATCH INFORMATION (All Statuses)
  // ============================================
  homeTeam          String
  homeTeamId        String?  // External team ID
  homeTeamLogo      String?  // Logo URL
  awayTeam          String
  awayTeamId        String?  // External team ID
  awayTeamLogo      String?  // Logo URL
  
  league            String
  leagueId          String?  // External league ID
  leagueCountry     String?  // League country code
  
  kickoffDate       DateTime // UTC kickoff time
  matchDate         DateTime? // Alternative date field
  
  // ============================================
  // ODDS DATA (All Statuses)
  // ============================================
  // Consensus odds (from novig_current)
  consensusOdds     Json?    // { home: number, draw: number, away: number }
  isConsensusOdds   Boolean  @default(true) // True if from novig_current
  
  // Individual bookmaker odds
  allBookmakers     Json?    // { bet365: {home, draw, away}, pinnacle: {...}, ... }
  primaryBook       String?  // Primary bookmaker name (bet365, pinnacle, etc.)
  booksCount        Int?     // Number of bookmakers available
  
  // ============================================
  // MODEL PREDICTIONS (All Statuses)
  // ============================================
  // V1 Model (Free - visible to all)
  v1Model           Json?    // {
                              //   pick: "home" | "away" | "draw",
                              //   confidence: number (0-1),
                              //   probs: { home: number, draw: number, away: number }
                              // }
  
  // V2 Model (Premium - requires purchase)
  v2Model           Json?    // {
                              //   pick: "home" | "away" | "draw",
                              //   confidence: number (0-1),
                              //   probs: { home: number, draw: number, away: number }
                              // }
  
  // Normalized predictions (for easy access)
  modelPredictions  Json?    // {
                              //   free: { side: string, confidence: number },
                              //   premium: { side: string, confidence: number }
                              // }
  
  // ============================================
  // LIVE MATCH DATA (Status: LIVE)
  // ============================================
  // Current score
  currentScore      Json?    // { home: number, away: number }
  liveScore         Json?    // Alternative field name (same data)
  
  // Match progress
  elapsed           Int?     // Minutes elapsed
  minute            Int?     // Alternative field name
  period            String?  // "1st Half", "2nd Half", "Half Time", "Full Time", etc.
  
  // Live statistics
  liveStatistics    Json?    // {
                              //   possession: { home: number, away: number },
                              //   shots: { home: number, away: number },
                              //   shotsOnTarget: { home: number, away: number },
                              //   corners: { home: number, away: number },
                              //   fouls: { home: number, away: number },
                              //   yellowCards: { home: number, away: number },
                              //   redCards: { home: number, away: number }
                              // }
  
  // Momentum data (for live matches)
  momentum          Json?    // {
                              //   minute: number,
                              //   momentum: "home" | "away" | "neutral",
                              //   intensity: number (0-1),
                              //   key_events: [...]
                              // }
  
  // Model markets (live betting markets)
  modelMarkets      Json?    // {
                              //   totals: {...},
                              //   btts: {...},
                              //   asian_handicap: {...}
                              // }
  
  // AI Analysis (live insights - premium feature)
  aiAnalysis        Json?    // {
                              //   minute: number,
                              //   trigger: string,
                              //   momentum: string,
                              //   observations: [...],
                              //   betting_angles: [...]
                              // }
  
  // ============================================
  // COMPLETED MATCH DATA (Status: FINISHED)
  // ============================================
  // Final result
  finalResult       Json?    // {
                              //   score: { home: number, away: number },
                              //   outcome: "home_win" | "away_win" | "draw",
                              //   outcome_text: string,
                              //   halfTimeScore: { home: number, away: number }?
                              // }
  
  // Match statistics (final)
  matchStatistics   Json?    // {
                              //   possession: { home: number, away: number },
                              //   shots: { home: number, away: number },
                              //   shotsOnTarget: { home: number, away: number },
                              //   corners: { home: number, away: number },
                              //   fouls: { home: number, away: number },
                              //   yellowCards: { home: number, away: number },
                              //   redCards: { home: number, away: number },
                              //   offsides: { home: number, away: number }
                              // }
  
  // Venue and match details
  venue             String?
  referee           String?
  attendance        Int?
  
  // ============================================
  // RAW API DATA (For Debugging & Future Use)
  // ============================================
  rawApiData        Json?    // Complete API response snapshot (all fields)
  
  // ============================================
  // SYNC METADATA
  // ============================================
  lastSyncedAt      DateTime @default(now())
  nextSyncAt        DateTime? // When to sync next (for prioritization)
  syncPriority      String?  // "high" (live), "medium" (upcoming <24h), "low" (upcoming >24h)
  syncCount         Int      @default(0) // Number of times synced
  syncErrors        Int      @default(0) // Number of sync errors
  lastSyncError     String?  // Last error message
  
  // ============================================
  // STATUS FLAGS
  // ============================================
  isActive          Boolean  @default(true) // Active matches (not archived)
  isArchived        Boolean  @default(false) // Archived matches (older than 7 days)
  
  // ============================================
  // TIMESTAMPS
  // ============================================
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  archivedAt        DateTime? // When match was archived
  
  // ============================================
  // RELATIONS
  // ============================================
  quickPurchases    QuickPurchase[] // One-to-many: One match can have multiple QuickPurchase items
  
  // ============================================
  // INDEXES
  // ============================================
  @@index([matchId])
  @@index([status, kickoffDate])
  @@index([status, lastSyncedAt])
  @@index([kickoffDate])
  @@index([isActive, status])
  @@index([nextSyncAt])
  @@index([syncPriority, status])
  @@index([isArchived, status])
  @@index([leagueId, status])
}
```

---

## 🔗 **QuickPurchase Integration**

### **Updated QuickPurchase Schema**

```prisma
model QuickPurchase {
  // ... existing fields ...
  
  matchId            String?    @unique // External API match ID (keep for backward compatibility)
  marketMatchId      String?    // Link to MarketMatch table (NEW)
  marketMatch        MarketMatch? @relation(fields: [marketMatchId], references: [id])
  
  // ... rest of existing fields ...
  
  @@index([marketMatchId])
  @@index([matchId, marketMatchId]) // Composite index for lookups
}
```

### **Relationship Benefits**

1. **One-to-Many**: One `MarketMatch` → Many `QuickPurchase` items
   - Different countries can have different QuickPurchase items for the same match
   - Different prediction types (1X2, BTTS, Totals) can have separate QuickPurchase items

2. **Easy Queries**:
   ```typescript
   // Get match with all QuickPurchase items
   const match = await prisma.marketMatch.findUnique({
     where: { matchId: "123456" },
     include: {
       quickPurchases: {
         where: { isActive: true, isPredictionActive: true },
         include: { country: true }
       }
     }
   })
   
   // Get QuickPurchase with match data
   const qp = await prisma.quickPurchase.findUnique({
     where: { id: "qp123" },
     include: {
       marketMatch: {
         select: {
           consensusOdds: true,
           v1Model: true,
           v2Model: true,
           kickoffDate: true,
           status: true,
           currentScore: true
         }
       }
     }
   })
   ```

---

## 📊 **Data Mapping by Status**

### **Upcoming Matches**

**Required Fields:**
- `matchId`, `status` = "UPCOMING"
- `homeTeam`, `awayTeam`, `league`
- `kickoffDate`
- `consensusOdds`, `allBookmakers`
- `v1Model`, `v2Model` (if available)
- `lastSyncedAt`

**Optional Fields:**
- `homeTeamLogo`, `awayTeamLogo`
- `leagueId`, `leagueCountry`
- `primaryBook`, `booksCount`

**Not Needed:**
- `currentScore`, `elapsed`, `minute`
- `liveStatistics`, `momentum`, `modelMarkets`
- `finalResult`, `matchStatistics`

### **Live Matches**

**Required Fields:**
- Everything from Upcoming PLUS:
- `status` = "LIVE"
- `currentScore` (or `liveScore`)
- `elapsed` (or `minute`)
- `period`

**Optional Fields:**
- `liveStatistics`
- `momentum`
- `modelMarkets`
- `aiAnalysis`

**Sync Priority:** `"high"` (sync every 15 seconds)

### **Completed Matches**

**Required Fields:**
- Everything from Live PLUS:
- `status` = "FINISHED"
- `finalResult`
- `matchStatistics` (final stats)

**Optional Fields:**
- `venue`, `referee`, `attendance`
- `halfTimeScore` (in `finalResult`)

**After Completion:**
- Set `isActive = false` after 7 days
- Set `isArchived = true` after 7 days
- Archive old matches to reduce table size

---

## 🔄 **Sync Strategy**

### **Priority Levels**

```typescript
function calculateSyncPriority(match: MarketMatch): string {
  if (match.status === 'LIVE') return 'high'
  
  if (match.status === 'UPCOMING') {
    const hoursUntilKickoff = (match.kickoffDate.getTime() - Date.now()) / (1000 * 60 * 60)
    if (hoursUntilKickoff < 24) return 'medium'
    return 'low'
  }
  
  if (match.status === 'FINISHED') {
    const daysSinceFinished = (Date.now() - match.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
    if (daysSinceFinished < 1) return 'medium' // Still sync recently finished matches
    return 'low'
  }
  
  return 'low'
}
```

### **Sync Frequencies**

- **High Priority (Live)**: Every 15 seconds
- **Medium Priority (Upcoming <24h)**: Every 30 seconds
- **Low Priority (Upcoming >24h)**: Every 5 minutes
- **Finished Matches**: Once per hour (for 24 hours), then archive

---

## 📱 **Frontend Usage Examples**

### **Homepage Tables**

```typescript
// Get upcoming matches
const upcomingMatches = await prisma.marketMatch.findMany({
  where: {
    status: 'UPCOMING',
    isActive: true,
    kickoffDate: { gte: new Date() }
  },
  orderBy: { kickoffDate: 'asc' },
  take: 50,
  select: {
    matchId: true,
    homeTeam: true,
    awayTeam: true,
    league: true,
    kickoffDate: true,
    consensusOdds: true,
    v1Model: true,
    v2Model: true,
    status: true
  }
})
```

### **Match Detail Page**

```typescript
// Get single match with all data
const match = await prisma.marketMatch.findUnique({
  where: { matchId: matchId },
  include: {
    quickPurchases: {
      where: {
        isActive: true,
        isPredictionActive: true
      },
      include: {
        country: {
          select: {
            currencyCode: true,
            currencySymbol: true
          }
        }
      }
    }
  }
})

// Transform to EnhancedMatchData format
const matchData: EnhancedMatchData = {
  match_id: match.matchId,
  status: match.status,
  kickoff_at: match.kickoffDate.toISOString(),
  home: {
    name: match.homeTeam,
    team_id: match.homeTeamId ? parseInt(match.homeTeamId) : null,
    logo_url: match.homeTeamLogo
  },
  away: {
    name: match.awayTeam,
    team_id: match.awayTeamId ? parseInt(match.awayTeamId) : null,
    logo_url: match.awayTeamLogo
  },
  league: {
    id: match.leagueId ? parseInt(match.leagueId) : null,
    name: match.league
  },
  odds: {
    novig_current: match.consensusOdds as any,
    books: match.allBookmakers as any
  },
  models: {
    v1_consensus: match.v1Model as any,
    v2_lightgbm: match.v2Model as any
  },
  score: match.currentScore as any,
  live_data: match.liveStatistics ? {
    current_score: match.currentScore as any,
    minute: match.elapsed || match.minute || 0,
    period: match.period || 'Live',
    statistics: match.liveStatistics as any
  } : undefined,
  momentum: match.momentum as any,
  model_markets: match.modelMarkets as any,
  ai_analysis: match.aiAnalysis as any,
  final_result: match.finalResult as any
}
```

### **WhatsApp Integration**

```typescript
// Get picks for WhatsApp
const picks = await prisma.marketMatch.findMany({
  where: {
    status: 'UPCOMING',
    isActive: true,
    kickoffDate: { gte: new Date() }
  },
  include: {
    quickPurchases: {
      where: {
        type: 'prediction',
        isActive: true,
        isPredictionActive: true
      },
      include: {
        country: {
          select: {
            currencyCode: true,
            currencySymbol: true
          }
        }
      }
    }
  },
  orderBy: { kickoffDate: 'asc' },
  take: 50
})

// Transform to WhatsAppPick format
const whatsappPicks = picks.map(match => {
  const qp = match.quickPurchases[0]
  return {
    matchId: match.matchId,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    league: match.league,
    kickoffDate: match.kickoffDate.toISOString(),
    consensusOdds: match.consensusOdds as any,
    modelPredictions: {
      free: match.v1Model ? {
        side: match.v1Model.pick,
        confidence: (match.v1Model.confidence || 0) * 100
      } : undefined,
      premium: match.v2Model ? {
        side: match.v2Model.pick,
        confidence: (match.v2Model.confidence || 0) * 100
      } : undefined
    },
    isPurchasable: !!qp,
    price: qp?.price ? Number(qp.price) : undefined,
    currency: qp?.country.currencyCode || 'USD',
    confidence: qp?.confidenceScore || undefined
  }
})
```

---

## 🎯 **Key Design Decisions**

### **1. JSON Fields for Flexibility**

**Why JSON?**
- Market API structure may change
- Different statuses have different fields
- Easy to store nested structures (odds, models, statistics)
- Can query JSON fields in PostgreSQL

**Trade-offs:**
- Less type safety (mitigated by TypeScript interfaces)
- Slightly slower queries (but acceptable for read-heavy workload)

### **2. Separate Fields for Common Data**

**Why separate fields?**
- `homeTeam`, `awayTeam`, `league` - Used in every query
- `kickoffDate` - Used for filtering and sorting
- `status` - Used for filtering
- `consensusOdds` - Used in most displays

**Benefits:**
- Fast queries (indexed fields)
- Easy filtering and sorting
- No JSON parsing needed for common operations

### **3. Status-Specific Fields**

**Why conditional fields?**
- Live matches need `currentScore`, `elapsed`
- Finished matches need `finalResult`, `matchStatistics`
- Upcoming matches don't need these fields

**Benefits:**
- Cleaner data model
- No null fields for upcoming matches
- Clear separation of concerns

### **4. Dual Linking (matchId + marketMatchId)**

**Why both?**
- `matchId` (string) - External API ID (backward compatibility)
- `marketMatchId` (relation) - Internal database ID (proper relation)

**Benefits:**
- Backward compatible with existing QuickPurchase records
- Proper database relations for joins
- Easy migration path

---

## 📈 **Performance Considerations**

### **Indexes**

```prisma
@@index([matchId])                    // Primary lookup
@@index([status, kickoffDate])         // Status-based queries
@@index([status, lastSyncedAt])        // Sync prioritization
@@index([kickoffDate])                 // Time-based queries
@@index([isActive, status])            // Active matches only
@@index([nextSyncAt])                  // Sync scheduling
@@index([syncPriority, status])       // Priority-based sync
@@index([isArchived, status])          // Archive queries
@@index([leagueId, status])            // League filtering
```

### **Query Optimization**

1. **Select only needed fields** (avoid `select: true`)
2. **Use includes sparingly** (only when needed)
3. **Filter early** (where clauses before includes)
4. **Limit results** (use `take` for pagination)

---

## 🔄 **Migration Path**

### **Phase 1: Create Table**
```sql
-- Create MarketMatch table
-- Run Prisma migration
```

### **Phase 2: Populate from API**
```typescript
// Background sync job populates table
// Start with upcoming matches
// Then sync live matches
```

### **Phase 3: Link QuickPurchase**
```typescript
// Update existing QuickPurchase records
await prisma.quickPurchase.updateMany({
  where: { matchId: { not: null } },
  data: {
    marketMatchId: // Find matching MarketMatch
  }
})
```

### **Phase 4: Switch Frontend**
```typescript
// Update /api/market to read from database
// Update /api/match/[match_id] to read from database
// Update WhatsApp picks to read from database
```

---

## ✅ **Summary**

This schema design provides:

1. **Complete Coverage**: All fields needed for upcoming, live, and completed matches
2. **Flexible Structure**: JSON fields for complex data, separate fields for common queries
3. **Easy Integration**: Simple relationship with QuickPurchase table
4. **Performance**: Proper indexes for fast queries
5. **Scalability**: Archive strategy for old matches
6. **Maintainability**: Clear field organization by status

**Next Steps:**
1. Review and approve schema
2. Create Prisma migration
3. Implement background sync
4. Update frontend to use database
5. Link existing QuickPurchase records

---

**Document Version:** 1.0  
**Last Updated:** January 2025  
**Status:** Ready for Implementation

