# Test Execution Guide - Quick Reference

**Date**: January 3, 2026  
**Purpose**: Quick reference for executing QA tests

---

## 🚀 **Quick Test Commands**

### **Test 1: Lite Mode - Live Matches**
```bash
# Test lite mode for live matches
curl "http://localhost:3000/api/market?status=live&mode=lite"

# Expected: Response <2 seconds, returns all live matches
```

### **Test 2: Auto-Lite Mode (No Parameter)**
```bash
# Test auto-lite for live matches (no mode parameter)
curl "http://localhost:3000/api/market?status=live"

# Expected: Automatically uses lite mode, response <2 seconds
```

### **Test 3: Upcoming Matches - No Limit**
```bash
# Test upcoming matches with no limit
curl "http://localhost:3000/api/market?status=upcoming&mode=lite"

# Expected: Returns all upcoming matches, no limit
```

### **Test 4: Full Mode Still Works**
```bash
# Test full mode (backward compatibility)
curl "http://localhost:3000/api/market?status=upcoming&limit=10"

# Expected: Uses full mode, returns complete data
```

### **Test 5: Individual Match**
```bash
# Test single match request
curl "http://localhost:3000/api/market?match_id=123456"

# Expected: Uses full mode, returns complete match data
```

---

## ✅ **Manual Test Checklist**

### **Frontend Tests**:

1. **Homepage Live Matches**:
   - [ ] Navigate to homepage
   - [ ] Check network tab - should see `/api/market?status=live&mode=lite`
   - [ ] Verify live matches table displays matches
   - [ ] Verify no limit in request
   - [ ] Check response time <2 seconds

2. **Homepage Upcoming Matches**:
   - [ ] Navigate to homepage
   - [ ] Check network tab - should see `/api/market?status=upcoming&mode=lite`
   - [ ] Verify upcoming matches table displays matches
   - [ ] Verify no limit in request
   - [ ] Check response time <2 seconds

3. **Marquee Ticker**:
   - [ ] Check marquee ticker displays
   - [ ] Verify it shows live matches
   - [ ] Check request has `limit=5` (intentional)

4. **Odds Prediction Table**:
   - [ ] Navigate to odds prediction table
   - [ ] Verify it loads quickly
   - [ ] Check request uses `mode=lite`

---

## 🔍 **Database Verification**

### **Check Database Freshness**:
```sql
-- Check live matches freshness
SELECT 
  matchId, 
  status, 
  homeTeam, 
  awayTeam,
  lastSyncedAt,
  EXTRACT(EPOCH FROM (NOW() - lastSyncedAt)) as age_seconds
FROM "MarketMatch"
WHERE status = 'LIVE' AND isActive = true
ORDER BY lastSyncedAt DESC
LIMIT 10;

-- Expected: All matches <30 seconds old
```

### **Check Match Counts**:
```sql
-- Count matches by status
SELECT 
  status, 
  COUNT(*) as count,
  MIN(lastSyncedAt) as oldest_sync,
  MAX(lastSyncedAt) as newest_sync
FROM "MarketMatch"
WHERE isActive = true
GROUP BY status;

-- Expected: Reasonable counts, recent sync times
```

---

## 📊 **Performance Monitoring**

### **Key Metrics to Monitor**:
1. **Response Times**:
   - Lite mode: Should be <2 seconds
   - Full mode: May be 5-15 seconds

2. **Error Rates**:
   - Timeout errors: Should be 0%
   - 500 errors: Should be 0%
   - 200 responses: Should be >95%

3. **Data Freshness**:
   - Live matches: <30 seconds old
   - Upcoming matches: <30 minutes old

4. **Sync Success Rate**:
   - Should be >95%
   - Should complete in <5 seconds for live matches

---

## 🐛 **Common Issues & Solutions**

### **Issue 1: Empty Tables**
**Symptoms**: No matches displayed  
**Check**:
- Database has matches?
- External API working?
- Check browser console for errors

**Solution**: Check database, verify sync process running

---

### **Issue 2: Timeout Errors**
**Symptoms**: 504 errors, slow responses  
**Check**:
- Is lite mode being used?
- External API slow?
- Check network tab

**Solution**: Verify `mode=lite` in requests, check external API

---

### **Issue 3: Stale Data**
**Symptoms**: Old matches displayed  
**Check**:
- Database `lastSyncedAt` timestamps
- Sync process running?
- External API working?

**Solution**: Trigger manual sync, check sync logs

---

## 📝 **Test Results Template**

```
Test Date: __________
Tester: __________

Test Results:
[ ] Test 1.1: Lite Mode Parameter - PASS/FAIL
[ ] Test 1.2: Auto-Lite Mode - PASS/FAIL
[ ] Test 2.1: Live Matches No Limit - PASS/FAIL
[ ] Test 2.2: Upcoming Matches No Limit - PASS/FAIL
[ ] Test 3.1: Data Merge - PASS/FAIL
[ ] Test 4.1: Error Handling - PASS/FAIL
[ ] Test 5.1: Performance - PASS/FAIL
[ ] Test 6.1: Frontend Integration - PASS/FAIL
[ ] Test 7.1: Sync Process - PASS/FAIL
[ ] Test 8.1: Backward Compatibility - PASS/FAIL

Issues Found:
1. __________
2. __________

Notes:
__________
```

---

**Status**: Ready for execution

