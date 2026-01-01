# X/Twitter Automation - Quick Reference Guide

**Last Updated:** January 2025

---

## 🎯 Quick Answers

### Should we post multiple templates per game?
**Answer: NO** - Post **once per match** for optimal coverage and engagement.

### Which templates should we use?
**Answer: Templates 1-5 (Blog Summary)** - These are the primary templates:
- `ai-confidence` - Requires confidence score
- `ai-vs-market` - Market vs AI comparison
- `neutral-preview` - Neutral match preview
- `value-signal` - Value opportunity highlight
- `minimal` - Short and direct

### Should we link to blog or match page?
**Answer: Blog URL preferred, Match URL fallback**
- If blog exists: `/blog/{slug}`
- If no blog: `/match/{matchId}`
- ✅ Current implementation is **correct**

### Is the system ready to post?
**Answer: Almost** - Infrastructure complete, but Twitter API integration pending.

---

## 📋 Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Database Schema | ✅ Complete | `SocialMediaPost` table ready |
| Template System | ✅ Complete | 12 templates defined |
| API Endpoints | ✅ Complete | All endpoints implemented |
| Admin Interface | ✅ Complete | `/admin/social-automation` |
| URL Routing | ✅ Complete | Blog → Match fallback correct |
| Duplicate Prevention | ✅ Complete | Working correctly |
| Rate Limiting | ✅ Complete | 5/hour, 30/day enforced |
| Twitter API Integration | ⚠️ Pending | Needs credentials + code update |

---

## 🔧 Configuration Recommendations

### Current Settings
- Max posts per hour: **5**
- Max posts per day: **30**
- Max posts per match: **2** (current)

### Recommended Changes
- Max posts per match: **1** (recommended for better coverage)
- Template selection: **Random from Templates 1-5**
- Post frequency: **Once per match**

---

## 📝 Template Reference

### Primary Templates (Use These)
1. **ai-confidence** - `{TEAM_A} vs {TEAM_B} ⚽ SnapBet AI gives {TEAM_A} a {AI_CONF}% win probability...`
2. **ai-vs-market** - `AI vs market 📊 {TEAM_A} vs {TEAM_B} shows a gap...`
3. **neutral-preview** - `{LEAGUE} preview: {TEAM_A} vs {TEAM_B} — AI match analysis now live`
4. **value-signal** - `This match stood out in our AI scan 👀 {TEAM_A} vs {TEAM_B}...`
5. **minimal** - `AI match analysis ⚽ {TEAM_A} vs {TEAM_B} — confidence, context, and key factors`

### Secondary Templates (Use Sparingly)
- **fixture-alert** / **league-focus** - For matches without prediction data (no URL)
- **live-momentum** / **live-observations** - For live matches only
- **daily-parlay** - For parlays
- **brand-authority** / **brand-educational** - Non-match content (no URL)

---

## 🔗 URL Strategy

**Priority:**
1. Blog URL (if exists): `https://snapbet.ai/blog/{slug}`
2. Match URL (fallback): `https://snapbet.ai/match/{matchId}`

**Implementation:**
```typescript
const url = matchData.blogUrl || matchData.matchUrl
```

**Current Status:** ✅ Correctly implemented

---

## 🚀 Next Steps to Go Live

1. **Get Twitter Developer Account**
   - Sign up at developer.twitter.com
   - Get Elevated Access or Academic Research tier
   - Obtain API credentials

2. **Add Environment Variables**
   ```env
   TWITTER_API_KEY=...
   TWITTER_API_SECRET=...
   TWITTER_ACCESS_TOKEN=...
   TWITTER_ACCESS_TOKEN_SECRET=...
   ```

3. **Update Code**
   - File: `app/api/admin/social/twitter/post-scheduled/route.ts`
   - Replace simulation with actual Twitter API calls
   - See `TWITTER_API_INTEGRATION_GUIDE.md` for details

4. **Test**
   - Test manual posting first
   - Verify posts appear on Twitter
   - Test automated cron jobs
   - Monitor for 24-48 hours

---

## 📊 Rate Limits

- **Hourly:** 5 posts/hour (enforced)
- **Daily:** 30 posts/day (enforced)
- **Per Match:** 2 posts/match (current) → Recommend: 1 post/match

**Twitter API Limits:**
- 200 tweets per 15 minutes per user (well within our limits)

---

## ✅ QA Validation Results

| Check | Status | Notes |
|-------|--------|-------|
| Template Generator | ✅ Pass | Variable substitution correct |
| URL Routing | ✅ Pass | Blog → Match fallback correct |
| Duplicate Prevention | ✅ Pass | Working correctly |
| Rate Limiting | ✅ Pass | All limits enforced |
| API Endpoints | ✅ Pass | Authentication and logic correct |
| Database Schema | ✅ Pass | Proper relations and indexes |

**Issues Found:**
- ⚠️ Minor: Base URL function inconsistency (low priority)
- ⚠️ Gap: No retry logic for failed posts (medium priority)
- ⚠️ Gap: Twitter API integration pending (high priority)

---

## 📚 Documentation Files

- **Full Analysis:** `X_TWITTER_AUTOMATION_ANALYSIS_AND_QA.md`
- **API Integration Guide:** `TWITTER_API_INTEGRATION_GUIDE.md`
- **Implementation Summary:** `TWITTER_AUTOMATION_IMPLEMENTATION.md`
- **Feasibility Analysis:** `TWITTER_AUTOMATION_FEASIBILITY_ANALYSIS.md`

---

## 🎯 Key Takeaways

1. ✅ **System is well-designed and nearly complete**
2. ✅ **Post once per match** (not multiple times)
3. ✅ **Use Templates 1-5** (Blog Summary templates)
4. ✅ **Blog URL preferred** (current logic is correct)
5. ⚠️ **Twitter API integration needed** before going live

---

**For detailed analysis, see:** `X_TWITTER_AUTOMATION_ANALYSIS_AND_QA.md`

