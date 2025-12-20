# WhatsApp Commands - Comprehensive Test Guide

## 🎯 **Testing Overview**

This guide provides step-by-step instructions for testing all WhatsApp commands to ensure:
1. Data comes from database (not static)
2. Premium commands check premium status
3. Message formats match requirements
4. Follow-up prompts encourage user engagement

---

## 📋 **Test Setup**

### 1. **Environment Configuration**

Add to `.env` for testing premium access:
```env
WHATSAPP_TEST_VIP_USERS=16783929144,1234567890
```

### 2. **Test Endpoint**

Use the test endpoint: `http://localhost:3000/whatsapp/test`

Or use the webhook endpoint: `POST /api/whatsapp/webhook`

---

## 🧪 **Test Cases**

### **FREE COMMANDS** (Should work for all users)

#### Test 1: BTTS (Browse)
**Command**: `BTTS`
**Expected**:
- ✅ Shows 3 matches (free) or 5 matches (premium)
- ✅ Each match has different BTTS percentages
- ✅ Date format: "Aug 23, 07:30 AM"
- ✅ Message ends with: "Reply with: OVERS [MATCH ID], UNDERS [MATCH ID]"
- ✅ Data comes from `predictionData.additional_markets_flat` or `additional_markets_v2`

**Verification**:
- Check server logs for "BTTS matches extracted" - verify percentages differ
- Verify no two matches show identical percentages (unless data is actually the same)

#### Test 2: OVERS (Browse)
**Command**: `OVERS`
**Expected**:
- ✅ Shows aggregated "Over 2.5 Goals: X%" and "Under 2.5 Goals: X%"
- ✅ Message ends with: "Reply with: UNDERS [MATCH ID], BTTS [MATCH ID]"
- ✅ Data calculated from actual matches in database

**Verification**:
- Check server logs for "OVERS matches extracted"
- Verify aggregated percentages are calculated from real data

#### Test 3: UNDERS (Browse)
**Command**: `UNDERS`
**Expected**:
- ✅ Shows 3 matches (free) or 5 matches (premium)
- ✅ Each match has different Under/Over percentages
- ✅ Date format: "Aug 23, 07:30 AM"
- ✅ Message ends with: "Reply with: BTTS [MATCH ID], OVERS [MATCH ID]"
- ✅ **CRITICAL**: Verify percentages vary per match (not all 95% | 5%)

**Verification**:
- Check server logs for "UNDERS matches extracted"
- **If all matches show same percentages**: Check database data, not code issue
- Verify data source logged (flat/v2/legacy)

#### Test 4: STATUS
**Command**: `STATUS`
**Expected**:
- ✅ Shows "📊 **Account STATUS**"
- ✅ Shows "Plan & expiry shown." or actual plan/expiry
- ✅ Ends with "Type: BUY"

---

### **PREMIUM COMMANDS** (Should require VIP)

#### Test 5: BTTS [MATCHID] (Premium Check)
**Command**: `BTTS 1378986`
**Expected (Free User)**:
- ❌ Shows "🔒 **VIP ACCESS REQUIRED**" message
- ❌ Does NOT show BTTS analysis

**Expected (Premium User)**:
- ✅ Shows "⚽ **BTTS ANALYSIS**"
- ✅ Shows "🎯 **ADDITIONAL MARKETS:**"
- ✅ Shows "Both Teams Score (Yes): X%" and "Both Teams Score (No): X%"
- ✅ Ends with: "Reply with: OVERS [MATCH ID], CS [MATCH ID]"
- ✅ Data comes from database

**Test Steps**:
1. Test without VIP: Should show VIP required
2. Set test VIP user in env: Should show analysis
3. Verify data is from `predictionData`

#### Test 6: OVERS [MATCHID] (Premium Check)
**Command**: `OVERS 1378986`
**Expected (Free User)**:
- ❌ Shows VIP required message

**Expected (Premium User)**:
- ✅ Shows "📈 **GOALS ANALYSIS**"
- ✅ Shows "🎯 **ADDITIONAL MARKETS:**"
- ✅ Shows "Over 2.5 Goals: X%" and "Under 2.5 Goals: X%"
- ✅ Ends with: "Reply with: UNDERS [MATCH ID], CS [MATCH ID]"
- ✅ Data comes from database

#### Test 7: UNDERS [MATCHID] (Premium Check)
**Command**: `UNDERS 1378986`
**Expected (Free User)**:
- ❌ Shows VIP required message

**Expected (Premium User)**:
- ✅ Shows "📉 **UNDER GOALS ANALYSIS**"
- ✅ Shows "🎯 **UNDER MARKETS:**"
- ✅ Shows "Under 2.5: X% | Over 2.5: X%"
- ✅ Ends with: "Reply with: OVERS [MATCH ID], CS [MATCH ID]"
- ✅ **CRITICAL**: Verify percentage is from database, not static

#### Test 8: CS (Correct Score - Browse)
**Command**: `CS`
**Expected (Free User)**:
- ❌ Shows VIP required message

**Expected (Premium User)**:
- ✅ Shows "🎯 **CORRECT SCORES**"
- ✅ Shows "High-odds score picks."
- ✅ Lists matches with top scores
- ✅ Ends with: "Reply with: MORE [MATCH ID]"
- ✅ Data from `predictionData.additional_markets_v2.correct_scores`

#### Test 9: CS [MATCHID]
**Command**: `CS 1378986`
**Expected (Premium User)**:
- ✅ Shows "🎯 **CORRECT SCORE ANALYSIS**"
- ✅ Shows top 5 predicted scores with probabilities
- ✅ Ends with: "Reply with: BTTS [MATCH ID], OVERS [MATCH ID]"
- ✅ Data from database

#### Test 10: REASON [MATCHID]
**Command**: `REASON 1378986`
**Expected (Premium User)**:
- ✅ Shows "🧠 **WHY THIS PICK**"
- ✅ Shows home team strengths/weaknesses/injuries
- ✅ Shows away team strengths/weaknesses/injuries
- ✅ Ends with: "Reply with: RISK [MATCH ID], ALT [MATCH ID]"
- ✅ Data from `predictionData.comprehensive_analysis.ai_verdict.team_analysis`

#### Test 11: RISK [MATCHID]
**Command**: `RISK 1378986`
**Expected (Premium User)**:
- ✅ Shows "⚠️ **RISK CHECK**"
- ✅ Shows risk level, suggested stake
- ✅ Shows main risks
- ✅ Ends with: "Reply with: ALT [MATCH ID], BTTS [MATCH ID], OVERS [MATCH ID]"
- ✅ Data from `predictionData.comprehensive_analysis.ai_verdict`

#### Test 12: CONFIDENCE [MATCHID]
**Command**: `CONFIDENCE 1378986`
**Expected (Premium User)**:
- ✅ Shows "📊 **CONFIDENCE BREAKDOWN**"
- ✅ Shows Home/Draw/Away probabilities
- ✅ Shows model type and quality score
- ✅ Ends with: "Reply: VALUE [MATCH ID]"
- ✅ Data from `predictionData.comprehensive_analysis.ml_prediction`

#### Test 13: VALUE [MATCHID]
**Command**: `VALUE 1378986`
**Expected (Premium User)**:
- ✅ Shows "💰 **VALUE CHECK**"
- ✅ Shows market, AI probability, consensus odds, value rating
- ✅ Ends with: "Reply: CONFIDENCE [MATCH ID]"
- ✅ Data from `predictionData` and `QuickPurchase.odds`

#### Test 14: ALT [MATCHID]
**Command**: `ALT 1378986`
**Expected (Premium User)**:
- ✅ Shows "🔁 **ALTERNATIVE BETS**"
- ✅ Shows BTTS, Over/Under, Double Chance, DNB recommendations
- ✅ Ends with: "Reply: BTTS [MATCH ID], OVERS [MATCH ID]"
- ✅ Data from `predictionData.additional_markets_flat` or `additional_markets_v2`

#### Test 15: STATS [MATCHID]
**Command**: `STATS 1378986`
**Expected (Premium User)**:
- ✅ Shows "📈 **MATCH STATS SNAPSHOT**"
- ✅ Shows H2H matches, form window, injuries
- ✅ Shows home/away form assessments
- ✅ Ends with: "Reply: CONFIDENCE [MATCH ID]"
- ✅ Data from `predictionData.data_freshness` and `team_analysis`

#### Test 16: MORE [MATCHID]
**Command**: `MORE 1378986`
**Expected (Premium User)**:
- ✅ Shows "📊 **ALL MARKETS**"
- ✅ Shows 1X2, BTTS, Total Goals, Double Chance, DNB, Win to Nil
- ✅ Ends with: "Reply: BTTS [MATCH ID], OVERS [MATCH ID], CS [MATCH ID]"
- ✅ All data from database

#### Test 17: PARLAY
**Command**: `PARLAY`
**Expected (Premium User)**:
- ✅ Shows "🔗 **AI PARLAY**"
- ✅ Shows "High-odds parlay ticket."
- ✅ Ends with "Type: [matchid]"
- ✅ Data from `ParlayConsensus` table

---

## 🔍 **Data Verification Tests**

### Test: Verify Data is Not Static

**Problem**: User reported all UNDERS entries showing "95% | 5%"

**Solution**: Check server logs

1. **Run UNDERS command**
2. **Check server logs** for:
   ```
   "UNDERS matches extracted" {
     count: 5,
     sampleData: [
       { matchId: "1378978", under25: 0.658, over25: 0.342 },
       { matchId: "1378979", under25: 0.721, over25: 0.279 },
       { matchId: "1378980", under25: 0.543, over25: 0.457 }
     ]
   }
   ```

3. **If all values are identical**:
   - Issue is in database data, not code
   - Check data enrichment process
   - Verify `predictionData` is being updated correctly

4. **If values differ**:
   - Code is working correctly
   - Issue might be in message formatting
   - Check if percentages are being rounded incorrectly

### Test: Verify Data Source Priority

**Check logs for data source**:
- Should see: `dataSource: 'flat'` (preferred)
- Or: `dataSource: 'v2'` (secondary)
- Or: `dataSource: 'legacy'` (fallback)

**If all matches use 'legacy'**:
- Database might not have `additional_markets_flat` or `additional_markets_v2`
- Check data enrichment process

---

## 🛡️ **Premium Access Tests**

### Test: Premium Command Without VIP

**Steps**:
1. Ensure `WHATSAPP_TEST_VIP_USERS` is NOT set or doesn't include test number
2. Send premium command: `BTTS 1378986`
3. **Expected**: VIP required message

### Test: Premium Command With VIP

**Steps**:
1. Add test number to `WHATSAPP_TEST_VIP_USERS` in `.env`
2. Restart server
3. Send premium command: `BTTS 1378986`
4. **Expected**: Full analysis message

### Test: Package Expiry

**Steps**:
1. Set VIP user with expiry date in past
2. Send premium command
3. **Expected**: VIP required message (expired)

---

## 📊 **Message Format Verification**

### Checklist for Each Command:

- [ ] Header matches user format exactly
- [ ] Data is displayed correctly
- [ ] Date format: "Aug 23, 07:30 AM" (not "8/23/2025, 3:00 PM")
- [ ] Follow-up prompts present
- [ ] Follow-up prompts encourage reply (not just informational)
- [ ] No hardcoded values
- [ ] All percentages formatted correctly (X.X% or X%)

---

## 🐛 **Common Issues & Solutions**

### Issue 1: All Matches Show Same Percentages
**Cause**: Database data is actually the same, or data extraction is failing
**Solution**: 
1. Check server logs for data extraction
2. Verify database has different values
3. Check if fallback values are being used

### Issue 2: Premium Commands Work for Free Users
**Cause**: Premium check not implemented or always returns true
**Solution**:
1. Verify `hasWhatsAppPremiumAccess()` is called
2. Check if test VIP users are set in env
3. Verify premium check logic

### Issue 3: Message Format Doesn't Match
**Cause**: Format not updated in code
**Solution**:
1. Check message format in code matches user requirements
2. Verify date formatting
3. Check follow-up prompts

### Issue 4: Data Source Always 'legacy'
**Cause**: Database doesn't have `additional_markets_flat` or `additional_markets_v2`
**Solution**:
1. Check data enrichment process
2. Verify `predictionData` structure
3. May need to update data enrichment to include flat/v2 data

---

## ✅ **Test Results Template**

```
## Test Results - [Date]

### Free Commands
- [ ] BTTS - Data varies: YES/NO, Format: PASS/FAIL
- [ ] OVERS - Data varies: YES/NO, Format: PASS/FAIL
- [ ] UNDERS - Data varies: YES/NO, Format: PASS/FAIL
- [ ] STATUS - Format: PASS/FAIL

### Premium Commands (Free User)
- [ ] BTTS [MATCHID] - Blocks access: YES/NO
- [ ] OVERS [MATCHID] - Blocks access: YES/NO
- [ ] CS - Blocks access: YES/NO
- [ ] REASON [MATCHID] - Blocks access: YES/NO
- [ ] RISK [MATCHID] - Blocks access: YES/NO
- [ ] CONFIDENCE [MATCHID] - Blocks access: YES/NO
- [ ] VALUE [MATCHID] - Blocks access: YES/NO
- [ ] ALT [MATCHID] - Blocks access: YES/NO
- [ ] STATS [MATCHID] - Blocks access: YES/NO
- [ ] MORE [MATCHID] - Blocks access: YES/NO

### Premium Commands (VIP User)
- [ ] BTTS [MATCHID] - Shows data: YES/NO, Format: PASS/FAIL
- [ ] OVERS [MATCHID] - Shows data: YES/NO, Format: PASS/FAIL
- [ ] UNDERS [MATCHID] - Shows data: YES/NO, Format: PASS/FAIL
- [ ] CS - Shows data: YES/NO, Format: PASS/FAIL
- [ ] CS [MATCHID] - Shows data: YES/NO, Format: PASS/FAIL
- [ ] REASON [MATCHID] - Shows data: YES/NO, Format: PASS/FAIL
- [ ] RISK [MATCHID] - Shows data: YES/NO, Format: PASS/FAIL
- [ ] CONFIDENCE [MATCHID] - Shows data: YES/NO, Format: PASS/FAIL
- [ ] VALUE [MATCHID] - Shows data: YES/NO, Format: PASS/FAIL
- [ ] ALT [MATCHID] - Shows data: YES/NO, Format: PASS/FAIL
- [ ] STATS [MATCHID] - Shows data: YES/NO, Format: PASS/FAIL
- [ ] MORE [MATCHID] - Shows data: YES/NO, Format: PASS/FAIL

### Data Verification
- [ ] BTTS data varies per match: YES/NO
- [ ] OVERS data varies per match: YES/NO
- [ ] UNDERS data varies per match: YES/NO
- [ ] All data from database: YES/NO
- [ ] No static/hardcoded values: YES/NO

### Follow-up Prompts
- [ ] All commands have follow-up prompts: YES/NO
- [ ] Prompts encourage user to reply: YES/NO
- [ ] Prompts match user requirements: YES/NO
```

---

## 🚀 **Quick Test Commands**

```bash
# Test free commands
curl -X POST http://localhost:3000/api/whatsapp/test-command \
  -H "Content-Type: application/json" \
  -d '{"to": "16783929144", "command": "BTTS"}'

curl -X POST http://localhost:3000/api/whatsapp/test-command \
  -H "Content-Type: application/json" \
  -d '{"to": "16783929144", "command": "OVERS"}'

curl -X POST http://localhost:3000/api/whatsapp/test-command \
  -H "Content-Type: application/json" \
  -d '{"to": "16783929144", "command": "UNDERS"}'

# Test premium commands (should fail without VIP)
curl -X POST http://localhost:3000/api/whatsapp/test-command \
  -H "Content-Type: application/json" \
  -d '{"to": "16783929144", "command": "BTTS 1378986"}'

curl -X POST http://localhost:3000/api/whatsapp/test-command \
  -H "Content-Type: application/json" \
  -d '{"to": "16783929144", "command": "REASON 1378986"}'

curl -X POST http://localhost:3000/api/whatsapp/test-command \
  -H "Content-Type: application/json" \
  -d '{"to": "16783929144", "command": "CS"}'
```

---

## 📝 **Notes**

1. **Data Static Issue**: If all matches show same percentages, check:
   - Server logs for "UNDERS matches extracted"
   - Database `predictionData` field
   - Data enrichment process

2. **Premium Access**: Currently uses test VIP users via env variable. For production, need schema update.

3. **Message Formats**: All formats updated to match user requirements. Verify date formatting matches exactly.

4. **Follow-up Prompts**: All commands now include prompts that encourage user to reply with next command.

