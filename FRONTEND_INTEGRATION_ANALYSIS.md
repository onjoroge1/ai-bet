# Frontend Integration Analysis - MarketMatch Database Integration

## Overview

This document analyzes the integration of the `MarketMatch` database table into the frontend API endpoints to reduce external API calls and improve performance.

## Current State

### 1. `/api/market` Endpoint (`app/api/market/route.ts`)

**Current Behavior:**
- Always fetches from external backend API (`${BASE_URL}/market`)
- Supports `status` (upcoming, live), `limit`, `leagueId`, `match_id` parameters
- Caches upcoming matches for 60 seconds
- No caching for live matches (`no-store`)

**Used By:**
- `components/homepage-matches.tsx` - Fetches upcoming and live matches every 30 seconds
- `components/ui/odds-prediction-table.tsx` - Fetches matches for odds/prediction tables
- `components/trending-topics.tsx` - Fetches upcoming matches for trending topics
- `lib/whatsapp-market-fetcher.ts` - Fetches upcoming matches for WhatsApp

**Current API Call Frequency:**
- Homepage: Every 30 seconds (both upcoming and live)
- Odds/Prediction tables: Every 1-2 minutes
- Multiple components calling simultaneously

### 2. `/api/match/[match_id]` Endpoint (`app/api/match/[match_id]/route.ts`)

**Current Behavior:**
- Always fetches from external backend API FIRST
- Falls back to QuickPurchase data if API fails
- Tries multiple API endpoints (live, finished, general) to find match
- No database-first approach

**Used By:**
- `app/match/[match_id]/page.tsx` - Match detail page
- Fetches comprehensive match data including live data, momentum, model markets, AI analysis

## Data Freshness Requirements

### "Too Old" Thresholds by Status

| Status | Max Age | Rationale |
|--------|---------|-----------|
| **LIVE** | 30 seconds | Live matches need real-time data (score, elapsed time, momentum) |
| **UPCOMING** | 10 minutes | Upcoming matches change less frequently (odds, predictions) |
| **FINISHED** | Never (use DB) | Finished matches don't change, always use database |

### Sync Intervals (Already Configured)
- Live matches: Synced every 30 seconds (cron runs every minute, syncs if >30s old)
- Upcoming matches: Synced every 10 minutes
- Completed matches: Synced once when status changes to FINISHED

## Data Transformation Requirements

### MarketMatch → API Response Format

The external API returns:
```json
{
  "matches": [
    {
      "id": "12345",
      "status": "LIVE",
      "home": { "name": "Team A", "id": "1", "logo_url": "..." },
      "away": { "name": "Team B", "id": "2", "logo_url": "..." },
      "league": { "name": "Premier League", "id": "10", "country": "England", "flagUrl": "...", "flagEmoji": "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
      "kickoff_at": "2025-01-19T15:00:00Z",
      "odds": {
        "novig_current": { "home": 2.5, "draw": 3.0, "away": 2.8 },
        "books": { "bet365": {...}, "pinnacle": {...} }
      },
      "models": {
        "v1_consensus": { "pick": "home", "confidence": 0.65, "probs": {...} },
        "v2_lightgbm": { "pick": "home", "confidence": 0.70, "probs": {...} }
      },
      "score": { "home": 1, "away": 0 },
      "minute": 45,
      "period": "1st Half",
      "momentum": {...},
      "model_markets": {...},
      "ai_analysis": {...}
    }
  ],
  "total_count": 1
}
```

MarketMatch stores:
- `matchId` (string) → API `id`
- `status` (UPCOMING/LIVE/FINISHED) → API `status` (lowercase)
- `homeTeam`, `awayTeam` → API `home.name`, `away.name`
- `homeTeamId`, `awayTeamId` → API `home.id`, `away.id`
- `homeTeamLogo`, `awayTeamLogo` → API `home.logo_url`, `away.logo_url`
- `league` → API `league.name`
- `leagueId` → API `league.id`
- `leagueCountry` → API `league.country`
- `leagueFlagUrl` → API `league.flagUrl`
- `leagueFlagEmoji` → API `league.flagEmoji`
- `kickoffDate` → API `kickoff_at`
- `consensusOdds` (JSON) → API `odds.novig_current`
- `allBookmakers` (JSON) → API `odds.books`
- `v1Model` (JSON) → API `models.v1_consensus`
- `v2Model` (JSON) → API `models.v2_lightgbm`
- `currentScore` (JSON) → API `score` (for LIVE)
- `elapsed` → API `minute` (for LIVE)
- `period` → API `period` (for LIVE)
- `momentum` (JSON) → API `momentum` (for LIVE)
- `modelMarkets` (JSON) → API `model_markets` (for LIVE)
- `aiAnalysis` (JSON) → API `ai_analysis` (for LIVE)
- `finalResult` (JSON) → API `final_result` (for FINISHED)
- `matchStatistics` (JSON) → API `match_statistics` (for FINISHED)

## Implementation Plan

### Phase 1: `/api/market` Endpoint

**New Flow:**
1. Check `MarketMatch` table first based on `status` parameter
2. Filter by `lastSyncedAt` to determine if data is "too old"
3. If data is fresh enough, return from database
4. If data is too old or missing, fetch from external API
5. Transform database records to match API response format
6. Return response with appropriate cache headers

**Key Functions:**
- `getMatchesFromDatabase(status, limit, leagueId)` - Query MarketMatch table
- `isDataTooOld(match, status)` - Check if data needs refresh
- `transformMarketMatchToApiFormat(match)` - Convert DB format to API format
- `fetchFromExternalApi(status, limit, leagueId)` - Fallback to external API

**Edge Cases:**
- No matches in database → Fetch from API
- Partial matches in database → Return what we have, fetch missing from API (optional)
- Database query fails → Fallback to API
- External API fails → Return database data even if old (graceful degradation)

### Phase 2: `/api/match/[match_id]` Endpoint

**New Flow:**
1. Check `MarketMatch` table first by `matchId`
2. Check if data is "too old" based on status
3. If fresh, return from database
4. If too old or missing, fetch from external API
5. Transform database record to match API response format
6. Merge with QuickPurchase data (existing logic)

**Key Functions:**
- `getMatchFromDatabase(matchId)` - Query MarketMatch by matchId
- `isMatchDataTooOld(match)` - Check freshness based on status
- `transformMarketMatchToMatchDetail(match)` - Convert to match detail format
- `fetchMatchFromExternalApi(matchId)` - Fallback to external API

**Edge Cases:**
- Match not in database → Fetch from API
- Database data too old for LIVE match → Fetch from API
- External API fails → Return database data even if old
- QuickPurchase integration → Keep existing logic

## Benefits

1. **Reduced API Calls**: 80-90% reduction in external API calls
2. **Faster Response Times**: Database queries are faster than external API calls
3. **Better Reliability**: Graceful degradation if external API is down
4. **Consistent Data**: All components use same data source
5. **Cost Savings**: Reduced external API usage

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Stale data for live matches | Strict 30-second freshness check for LIVE status |
| Missing matches in database | Fallback to external API |
| Data format mismatches | Comprehensive transformation function with tests |
| Performance degradation | Database indexes already in place |
| Breaking changes | Maintain backward compatibility with API response format |

## Testing Strategy

1. **Unit Tests**: Test transformation functions
2. **Integration Tests**: Test database-first flow with fallback
3. **E2E Tests**: Test homepage and match detail pages
4. **Performance Tests**: Compare response times (DB vs API)
5. **Load Tests**: Test under high traffic

## Rollout Plan

1. **Phase 1**: Implement `/api/market` endpoint (upcoming matches first)
2. **Phase 2**: Add live matches support to `/api/market`
3. **Phase 3**: Implement `/api/match/[match_id]` endpoint
4. **Phase 4**: Monitor and optimize
5. **Phase 5**: Update WhatsApp integration to use new endpoints

## Success Metrics

- API call reduction: Target 80%+ reduction
- Response time improvement: Target 50%+ faster
- Error rate: Maintain <1% error rate
- Data freshness: 100% of LIVE matches <30s old

