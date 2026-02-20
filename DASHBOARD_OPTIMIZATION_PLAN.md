# Dashboard Page Optimization Plan

## Current Issues

### 1. Performance Problems
- **13+ dynamic imports** loading simultaneously
- **Multiple API calls** per component (each makes its own fetch)
- **No prioritization** - everything loads at once
- **Redundant session checks** - many components check auth independently
- **Heavy components** loading even when not immediately visible

### 2. Components That Should Be Standalone Pages

#### High Priority (Move Now)
- **ReferralBanner** → `/dashboard/referrals` (dedicated referrals page)
- **QuizCredits & QuizCreditClaim** → `/dashboard/rewards` (unified rewards/credits page)
- **ClaimedTipsSection** → Already in `/dashboard/my-bets` (remove duplicate)

#### Medium Priority (Consider Moving)
- **PersonalizedOffers & UpgradeOffers** → Combine into single widget or move to `/dashboard/premium`
- **TimelineFeed** → Could be simplified or moved to `/dashboard/activity`
- **MyTipsWidget** → Already covered in `/dashboard/my-bets` (could be simplified preview)

### 3. Components to Keep on Overview

#### Essential (Load First)
1. **StatsOverview** - Core performance metrics
2. **Quick Actions** - Navigation shortcuts
3. **PackageCredits** - User's credit balance (important for UX)

#### Secondary (Load After)
4. **NotificationsWidget** - Important but not critical
5. **LiveMatchesWidget** - Useful but can load later

## Optimization Strategy

### Phase 1: Remove/Move Components
1. ✅ Remove `ReferralBanner` → Create `/dashboard/referrals` page
2. ✅ Remove `QuizCredits` & `QuizCreditClaim` → Create `/dashboard/rewards` page
3. ✅ Remove `ClaimedTipsSection` (already in My Bets)
4. ✅ Simplify or remove `MyTipsWidget` (preview only, full data in My Bets)
5. ✅ Combine `PersonalizedOffers` & `UpgradeOffers` into single widget

### Phase 2: Progressive Loading
- **Critical Path**: Stats + Quick Actions + Package Credits (load immediately)
- **Secondary**: Notifications + Live Matches (load after 500ms)
- **Tertiary**: Timeline Feed (load after 1s, or lazy load on scroll)

### Phase 3: API Optimization
- Consolidate multiple API calls where possible
- Use React Query with shared queries
- Implement proper caching strategies
- Reduce redundant session checks

## Recommended Dashboard Structure

```
/dashboard (Overview)
├── Welcome Header
├── Quick Actions (4 cards)
├── Stats Overview (2/3 width)
├── Package Credits (1/3 width)
├── Notifications Widget (1/2 width)
├── Live Matches Widget (1/2 width)
└── Timeline Feed (simplified, 3-4 items max)

/dashboard/referrals (New)
├── Referral Banner
├── Referral Stats
├── Referral History
└── Share Options

/dashboard/rewards (New)
├── Quiz Credits
├── Quiz Credit Claim
├── Other Rewards
└── Rewards History
```

## Performance Targets

- **Initial Load**: < 1.5s (critical content visible)
- **Time to Interactive**: < 2.5s
- **API Calls**: Reduce from 13+ to 3-4
- **Bundle Size**: Reduce by ~30% by removing unused components

