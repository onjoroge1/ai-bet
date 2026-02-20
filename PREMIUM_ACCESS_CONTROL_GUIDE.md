# Premium Access Control Implementation Guide

## 📋 Overview

This guide provides a comprehensive strategy for implementing tiered access controls for premium packages (Weekend, Weekly, Monthly) and outlines how to handle recurring subscriptions for the Monthly package.

---

## 🎯 Package Structure

### Current Packages (After Single Tip Removal)

1. **Weekend Package** (`weekend_pass`)
   - Duration: 2-3 days
   - Access Level: **Core Features**
   - Price: Entry-level (set by backend)

2. **Weekly Package** (`weekly_pass`)
   - Duration: 7 days
   - Access Level: **Full Features**
   - Price: Mid-tier (set by backend)

3. **Monthly Subscription** (`monthly_sub`)
   - Duration: 30 days (recurring)
   - Access Level: **Premium Features**
   - Price: Best value (set by backend)

---

## 🗄️ Database Schema Analysis

### Current User Model Fields

```prisma
model User {
  subscriptionPlan      String?    // e.g., "weekend_pass", "weekly_pass", "monthly_sub"
  subscriptionExpiresAt DateTime?  // When subscription expires
  // ... other fields
}
```

### Current Package Models

```prisma
model PackagePurchase {
  userId      String
  packageType String  // "weekend_pass", "weekly_pass", "monthly_sub"
  amount      Decimal
  status      String
  createdAt   DateTime
  // ... other fields
}

model UserPackage {
  userId        String
  packageOfferId String
  expiresAt     DateTime
  tipsRemaining Int
  status        String
  // ... other fields
}
```

---

## 🔐 Access Control Strategy

### Tier 1: Weekend Package (`weekend_pass`)

**Accessible Features:**
- ✅ `/dashboard/matches` - All match predictions
- ✅ `/dashboard/parlays` - AI-curated parlays
- ✅ `/dashboard/player-picks` - Player prop predictions
- ✅ `/dashboard/daily-tips` - Daily tips
- ❌ `/dashboard/clv` - CLV Tracker (read-only or limited)
- ❌ `/dashboard/analytics` - Advanced analytics (basic only)
- ❌ `/dashboard/my-bets` - Bet history (limited)

**Access Logic:**
```typescript
function hasWeekendAccess(user: User): boolean {
  const isWeekendPlan = user.subscriptionPlan === 'weekend_pass'
  const isNotExpired = user.subscriptionExpiresAt && 
    new Date(user.subscriptionExpiresAt) > new Date()
  return isWeekendPlan && isNotExpired
}
```

---

### Tier 2: Weekly Package (`weekly_pass`)

**Accessible Features:**
- ✅ Everything in Weekend Package
- ✅ `/dashboard/clv` - Full CLV Tracker access
- ✅ `/dashboard/analytics` - Full analytics dashboard
- ✅ `/dashboard/my-bets` - Complete bet history
- ✅ `/dashboard/saved-bets` - Saved bet management
- ✅ `/dashboard/tools` - All betting tools
- ❌ Early feature access
- ❌ Personalized recommendations (basic)

**Access Logic:**
```typescript
function hasWeeklyAccess(user: User): boolean {
  const isWeeklyPlan = user.subscriptionPlan === 'weekly_pass'
  const isNotExpired = user.subscriptionExpiresAt && 
    new Date(user.subscriptionExpiresAt) > new Date()
  return isWeeklyPlan && isNotExpired
}
```

---

### Tier 3: Monthly Subscription (`monthly_sub`)

**Accessible Features:**
- ✅ Everything in Weekly Package
- ✅ Early access to new features
- ✅ Personalized AI recommendations
- ✅ Priority support
- ✅ Advanced analytics with custom reports
- ✅ VIP-only content
- ✅ Exclusive webinars/events

**Access Logic:**
```typescript
function hasMonthlyAccess(user: User): boolean {
  const isMonthlyPlan = user.subscriptionPlan === 'monthly_sub'
  const isNotExpired = user.subscriptionExpiresAt && 
    new Date(user.subscriptionExpiresAt) > new Date()
  return isMonthlyPlan && isNotExpired
}
```

---

## 🔄 Monthly Subscription: Recurring Billing Strategy

### Option A: Automatic Recurring (Recommended)

**How It Works:**
1. User purchases Monthly Subscription
2. Backend creates Stripe/PesaPal subscription with `recurring: true`
3. Payment gateway handles automatic renewal every 30 days
4. Webhook updates `subscriptionExpiresAt` on each successful payment
5. If payment fails, subscription expires but user can reactivate

**Database Fields Needed:**
```prisma
model User {
  subscriptionPlan          String?
  subscriptionExpiresAt     DateTime?
  subscriptionStatus        String?     // "active", "cancelled", "past_due", "unpaid"
  subscriptionId            String?     // Stripe subscription ID
  subscriptionRenewsAt      DateTime?   // Next billing date
  subscriptionCancelledAt   DateTime?   // When user cancelled
  // ... other fields
}
```

**Implementation Steps:**
1. **Purchase Flow:**
   - User selects Monthly Subscription
   - Backend creates Stripe subscription (not one-time payment)
   - Set `subscriptionPlan = "monthly_sub"`
   - Set `subscriptionExpiresAt = now() + 30 days`
   - Set `subscriptionStatus = "active"`
   - Store `subscriptionId` from Stripe

2. **Webhook Handler:**
   ```typescript
   // On successful recurring payment
   if (event.type === 'invoice.payment_succeeded' && 
       subscription.metadata.packageType === 'monthly_sub') {
     await prisma.user.update({
       where: { id: userId },
       data: {
         subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
         subscriptionRenewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
         subscriptionStatus: 'active'
       }
     })
   }
   
   // On payment failure
   if (event.type === 'invoice.payment_failed') {
     await prisma.user.update({
       where: { id: userId },
       data: {
         subscriptionStatus: 'past_due',
         // Keep expiresAt as-is (grace period)
       }
     })
   }
   ```

3. **Cancellation Flow:**
   - User cancels subscription
   - Set `subscriptionCancelledAt = now()`
   - Set `subscriptionStatus = "cancelled"`
   - Keep `subscriptionExpiresAt` (user keeps access until expiry)
   - Cancel Stripe subscription

---

### Option B: Manual Renewal (Simpler, Less Revenue)

**How It Works:**
1. User purchases Monthly Subscription
2. One-time payment for 30 days
3. User must manually renew before expiry
4. No automatic billing

**Pros:**
- Simpler implementation
- No webhook complexity
- User has full control

**Cons:**
- Lower retention (users forget to renew)
- Less predictable revenue
- More manual intervention

**Recommendation:** Use Option A (Automatic Recurring) for better revenue and user experience.

---

## 📝 Implementation Plan

### Step 1: Update Access Control Library

**File:** `lib/premium-access.ts`

```typescript
/**
 * Check if user has access to a specific feature tier
 */
export async function hasFeatureAccess(
  feature: 'core' | 'full' | 'premium'
): Promise<boolean> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return false

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      subscriptionPlan: true,
      subscriptionExpiresAt: true,
      subscriptionStatus: true,
      role: true,
    },
  })

  if (!user) return false

  // Admins always have access
  if (user.role === 'admin') return true

  // Check if subscription is active
  const isActive = user.subscriptionExpiresAt && 
    new Date(user.subscriptionExpiresAt) > new Date() &&
    user.subscriptionStatus !== 'cancelled' &&
    user.subscriptionStatus !== 'unpaid'

  if (!isActive) return false

  // Tier-based access
  switch (feature) {
    case 'core':
      // Weekend, Weekly, Monthly all have core access
      return ['weekend_pass', 'weekly_pass', 'monthly_sub'].includes(
        user.subscriptionPlan || ''
      )
    
    case 'full':
      // Weekly and Monthly have full access
      return ['weekly_pass', 'monthly_sub'].includes(
        user.subscriptionPlan || ''
      )
    
    case 'premium':
      // Only Monthly has premium access
      return user.subscriptionPlan === 'monthly_sub'
    
    default:
      return false
  }
}

/**
 * Get user's subscription tier
 */
export async function getSubscriptionTier(): Promise<
  'weekend' | 'weekly' | 'monthly' | 'free' | null
> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return 'free'

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      subscriptionPlan: true,
      subscriptionExpiresAt: true,
      subscriptionStatus: true,
    },
  })

  if (!user || !user.subscriptionPlan) return 'free'

  const isActive = user.subscriptionExpiresAt && 
    new Date(user.subscriptionExpiresAt) > new Date() &&
    user.subscriptionStatus !== 'cancelled'

  if (!isActive) return 'free'

  switch (user.subscriptionPlan) {
    case 'weekend_pass':
      return 'weekend'
    case 'weekly_pass':
      return 'weekly'
    case 'monthly_sub':
      return 'monthly'
    default:
      return 'free'
  }
}
```

---

### Step 2: Update Premium Gate Component

**File:** `components/premium-gate.tsx`

```typescript
interface PremiumGateProps {
  requiredTier: 'core' | 'full' | 'premium'
  title?: string
  description?: string
  featureName?: string
}

export function PremiumGate({ 
  requiredTier,
  title = "Premium Feature",
  description = "This feature requires an active premium subscription.",
  featureName = "premium feature"
}: PremiumGateProps) {
  const [hasAccess, setHasAccess] = useState(false)
  const [tier, setTier] = useState<'weekend' | 'weekly' | 'monthly' | 'free'>('free')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkAccess()
  }, [])

  const checkAccess = async () => {
    try {
      const response = await fetch('/api/premium/check')
      const data = await response.json()
      setHasAccess(data.hasAccess)
      setTier(data.tier || 'free')
    } catch (error) {
      console.error('Error checking premium access:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return <LoadingSkeleton />
  }

  if (hasAccess) {
    return null // Render children
  }

  // Show upgrade prompt based on required tier
  return (
    <UpgradePrompt 
      requiredTier={requiredTier}
      currentTier={tier}
      title={title}
      description={description}
      featureName={featureName}
    />
  )
}
```

---

### Step 3: Protect Routes with Access Control

**Example:** `app/dashboard/clv/page.tsx`

```typescript
import { hasFeatureAccess } from '@/lib/premium-access'
import { PremiumGate } from '@/components/premium-gate'

export default async function CLVPage() {
  const hasAccess = await hasFeatureAccess('full') // Weekly+ required

  if (!hasAccess) {
    return (
      <PremiumGate 
        requiredTier="full"
        title="CLV Tracker"
        description="Full CLV Tracker access requires a Weekly or Monthly subscription."
        featureName="CLV Tracker"
      />
    )
  }

  // Render CLV page content
  return <CLVContent />
}
```

---

### Step 4: Update API Routes

**File:** `app/api/clv/opportunities/route.ts`

```typescript
import { hasFeatureAccess } from '@/lib/premium-access'

export async function GET() {
  const hasAccess = await hasFeatureAccess('full')
  
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Weekly or Monthly subscription required' },
      { status: 403 }
    )
  }

  // Return CLV opportunities
  // ...
}
```

---

### Step 5: Add Subscription Status to User Context

**File:** `lib/premium-access.ts` (add new function)

```typescript
export async function getSubscriptionStatus(): Promise<{
  tier: 'weekend' | 'weekly' | 'monthly' | 'free'
  hasAccess: boolean
  expiresAt: Date | null
  renewsAt: Date | null
  status: string | null
  daysRemaining: number | null
}> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return {
      tier: 'free',
      hasAccess: false,
      expiresAt: null,
      renewsAt: null,
      status: null,
      daysRemaining: null,
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      subscriptionPlan: true,
      subscriptionExpiresAt: true,
      subscriptionRenewsAt: true,
      subscriptionStatus: true,
    },
  })

  if (!user || !user.subscriptionPlan) {
    return {
      tier: 'free',
      hasAccess: false,
      expiresAt: null,
      renewsAt: null,
      status: null,
      daysRemaining: null,
    }
  }

  const expiresAt = user.subscriptionExpiresAt
  const daysRemaining = expiresAt
    ? Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  const tier = user.subscriptionPlan === 'weekend_pass' ? 'weekend' :
               user.subscriptionPlan === 'weekly_pass' ? 'weekly' :
               user.subscriptionPlan === 'monthly_sub' ? 'monthly' : 'free'

  const hasAccess = expiresAt && new Date(expiresAt) > new Date() &&
    user.subscriptionStatus !== 'cancelled'

  return {
    tier,
    hasAccess: !!hasAccess,
    expiresAt,
    renewsAt: user.subscriptionRenewsAt,
    status: user.subscriptionStatus,
    daysRemaining,
  }
}
```

---

## 🎨 UI/UX Considerations

### 1. Subscription Status Badge

Show current tier in dashboard header:
```typescript
<Badge>
  {tier === 'monthly' && '⭐ Monthly Pro'}
  {tier === 'weekly' && '📅 Weekly'}
  {tier === 'weekend' && '🎯 Weekend'}
  {tier === 'free' && 'Free'}
</Badge>
```

### 2. Upgrade Prompts

Show contextual upgrade prompts:
- "Upgrade to Weekly to unlock CLV Tracker"
- "Upgrade to Monthly for early feature access"

### 3. Expiry Warnings

Show warnings when subscription is expiring:
- 7 days before: "Your subscription expires in 7 days"
- 3 days before: "Renew now to continue access"
- For Monthly: "Your subscription auto-renews on [date]"

### 4. Feature Comparison Table

Create a comparison table showing what each tier includes:
```
Feature              | Weekend | Weekly | Monthly
─────────────────────────────────────────────────
Match Predictions    |   ✅   |   ✅   |   ✅
Parlays              |   ✅   |   ✅   |   ✅
Player Picks         |   ✅   |   ✅   |   ✅
CLV Tracker          |   ❌   |   ✅   |   ✅
Full Analytics       |   ❌   |   ✅   |   ✅
Early Features       |   ❌   |   ❌   |   ✅
Personalized AI      |   ❌   |   ❌   |   ✅
```

---

## 🔧 Database Migration (If Needed)

If you need to add subscription tracking fields:

```prisma
model User {
  // ... existing fields
  
  subscriptionPlan          String?
  subscriptionExpiresAt     DateTime?
  subscriptionStatus        String?     // "active", "cancelled", "past_due", "unpaid"
  subscriptionId            String?     // Stripe/PesaPal subscription ID
  subscriptionRenewsAt      DateTime?   // Next billing date (for recurring)
  subscriptionCancelledAt   DateTime?   // When user cancelled
  subscriptionCancelledReason String?   // Why they cancelled
  
  @@index([subscriptionPlan, subscriptionStatus])
  @@index([subscriptionExpiresAt])
}
```

---

## 📊 Testing Checklist

- [ ] Weekend package grants core feature access
- [ ] Weekly package grants full feature access
- [ ] Monthly package grants premium feature access
- [ ] Expired subscriptions are blocked
- [ ] Cancelled subscriptions are blocked
- [ ] Admins bypass all checks
- [ ] API routes return 403 for insufficient access
- [ ] Premium gates show correct upgrade prompts
- [ ] Monthly subscription auto-renews (webhook test)
- [ ] Payment failures are handled gracefully
- [ ] Cancellation flow works correctly

---

## 🚀 Next Steps

1. **Backend:** Update pricing API to exclude "prediction" (Single Tip)
2. **Frontend:** Remove Single Tip from all package displays
3. **Access Control:** Implement tiered access functions
4. **Routes:** Protect routes with appropriate tier requirements
5. **Webhooks:** Set up recurring payment webhooks for Monthly
6. **UI:** Add subscription status indicators
7. **Testing:** Test all access scenarios

---

## 📝 Notes

- **Monthly Recurring:** Recommended to use automatic recurring billing via Stripe/PesaPal subscriptions
- **Grace Period:** Consider 3-7 day grace period for failed payments
- **Cancellation:** Users keep access until `subscriptionExpiresAt` even after cancellation
- **Upgrades:** Allow users to upgrade from Weekend → Weekly → Monthly (prorate if needed)
- **Downgrades:** Handle downgrades gracefully (immediate or at next billing cycle)

