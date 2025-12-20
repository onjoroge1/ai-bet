# MarketMatch Setup - Comprehensive QA Test Plan

## Test Categories

### 1. Database Schema Validation
- [ ] MarketMatch table exists with all required fields
- [ ] MarketMatch table has proper indexes
- [ ] QuickPurchase relation to MarketMatch works
- [ ] Flag columns (leagueFlagUrl, leagueFlagEmoji) exist
- [ ] JSON fields are properly typed
- [ ] Unique constraints on matchId work

### 2. API Endpoint Tests

#### 2.1 Scheduled Sync Endpoint (`/api/admin/market/sync-scheduled`)
- [ ] GET with valid CRON_SECRET returns 200
- [ ] GET without CRON_SECRET returns 401
- [ ] GET with invalid CRON_SECRET returns 401
- [ ] Sync type=live works correctly
- [ ] Sync type=upcoming works correctly
- [ ] Sync type=completed works correctly
- [ ] Sync type=all syncs all types
- [ ] Response includes correct summary structure
- [ ] Response includes synced/errors/skipped counts

#### 2.2 Manual Sync Endpoint (`/api/admin/market/sync-manual`)
- [ ] POST without admin session returns 401
- [ ] POST with non-admin session returns 403
- [ ] POST with admin session returns 200
- [ ] Sync type=live works correctly
- [ ] Sync type=upcoming works correctly
- [ ] Sync type=completed works correctly
- [ ] Force sync bypasses smart sync logic
- [ ] Response includes correct summary structure

### 3. Authentication Tests
- [ ] CRON_SECRET authentication works in middleware
- [ ] Admin session authentication works
- [ ] Unauthorized requests are rejected
- [ ] Rate limiting doesn't block valid requests

### 4. Data Transformation Tests
- [ ] API response transforms correctly to MarketMatch format
- [ ] Status normalization works (UPCOMING, LIVE, FINISHED)
- [ ] Flag fields (leagueFlagUrl, leagueFlagEmoji) are captured
- [ ] Odds data is properly structured
- [ ] Model predictions are properly structured
- [ ] Live match data is captured when status=LIVE
- [ ] Completed match data is captured when status=FINISHED
- [ ] Invalid matchId (null, undefined, "null", "undefined") is skipped

### 5. Sync Logic Tests
- [ ] Live matches sync every 30 seconds (smart sync)
- [ ] Upcoming matches sync every 10 minutes (smart sync)
- [ ] Completed matches only sync once
- [ ] Force sync bypasses smart sync intervals
- [ ] Sync count increments correctly
- [ ] Error count increments on failures
- [ ] LastSyncError is updated on failures
- [ ] NextSyncAt is calculated correctly

### 6. Status Transition Tests
- [ ] Match status updates from UPCOMING to LIVE
- [ ] Match status updates from LIVE to FINISHED
- [ ] Status changes are persisted correctly
- [ ] Live data appears when status becomes LIVE
- [ ] Final result appears when status becomes FINISHED

### 7. Edge Cases
- [ ] Empty API response handled gracefully
- [ ] API error (400, 500) handled gracefully
- [ ] Missing required fields handled gracefully
- [ ] Duplicate matchId handled (upsert works)
- [ ] Large batch of matches processed correctly
- [ ] Network timeout handled gracefully

### 8. Cron Configuration Tests
- [ ] vercel.json has correct cron schedules
- [ ] Cron paths match endpoint routes
- [ ] Cron schedules are correct (live: every minute, upcoming: every 10 min, completed: every 10 min)
- [ ] maxDuration is set correctly (60s for market sync)

### 9. Integration Tests
- [ ] Admin UI sync button renders correctly
- [ ] Admin UI sync button triggers manual sync
- [ ] Admin UI displays sync results
- [ ] Toast notifications work correctly

### 10. Performance Tests
- [ ] Sync completes within maxDuration (60s)
- [ ] Database queries are optimized (indexes used)
- [ ] No memory leaks in long-running syncs

