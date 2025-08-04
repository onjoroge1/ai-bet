# 🎯 **Referral System Implementation Roadmap**

## 📋 **Overview**

This document outlines the complete implementation roadmap for SnapBet's referral system, enabling users to earn credits and points by referring friends. The system integrates with the existing credit system and quiz platform.

**Referral URL Format**: `https://snapbet.bet/snapbet-quiz?ref=IADPRM50`

---

## 🗄️ **Database Schema**

### **New Models**

```prisma
model ReferralCode {
  id          String   @id @default(cuid())
  userId      String   @unique
  code        String   @unique // e.g., "IADPRM50"
  isActive    Boolean  @default(true)
  usageCount  Int      @default(0)
  maxUsage    Int?     // null for unlimited
  expiresAt   DateTime?
  createdAt   DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id])
  referrals   Referral[]
}

model Referral {
  id              String       @id @default(cuid())
  referrerId      String       // User who shared the link
  referredUserId  String       // User who used the link
  referralCodeId  String
  status          String       @default("pending") // pending, completed, expired
  rewardCredits   Int          @default(0)
  rewardPoints    Int          @default(0)
  completedAt     DateTime?    // When referral was completed
  expiresAt       DateTime     // 30 days from creation
  createdAt       DateTime     @default(now())
  
  referrer        User         @relation("Referrer", fields: [referrerId], references: [id])
  referredUser    User         @relation("ReferredUser", fields: [referredUserId], references: [id])
  referralCode    ReferralCode @relation(fields: [referralCodeId], references: [id])
}

// Update existing User model
model User {
  // ... existing fields ...
  referralCode    ReferralCode?
  referralsGiven  Referral[]   @relation("Referrer")
  referralsReceived Referral[] @relation("ReferredUser")
}
```

---

## 🚀 **Implementation Phases**

### **Phase 1: Foundation & Database Schema (Week 1)**

#### **1.1 Database Migration**
```bash
# Create migration
npx prisma migrate dev --name add-referral-system

# Apply to database
npx prisma db push
```

#### **1.2 Core API Endpoints**
```typescript
// app/api/referrals/generate-code/route.ts
POST /api/referrals/generate-code

// app/api/referrals/my-code/route.ts
GET /api/referrals/my-code

// app/api/referrals/validate-code/route.ts
POST /api/referrals/validate-code

// app/api/referrals/apply-code/route.ts
POST /api/referrals/apply-code
```

#### **1.3 Referral Code Generation Service**
```typescript
// lib/referral-code-service.ts
export async function generateReferralCode(userId: string): Promise<string> {
  const code = generateUniqueCode() // 8-character alphanumeric
  await prisma.referralCode.create({
    data: {
      userId,
      code,
      isActive: true
    }
  })
  return code
}

function generateUniqueCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}
```

### **Phase 2: Referral Tracking & Validation (Week 2)**

#### **2.1 URL Parameter Handling**
```typescript
// app/snapbet-quiz/page.tsx
'use client'
import { useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

export default function QuizPage() {
  const searchParams = useSearchParams()
  const refCode = searchParams.get('ref')

  useEffect(() => {
    if (refCode) {
      // Store referral code for signup process
      sessionStorage.setItem('referralCode', refCode)
      
      // Validate code and show welcome message
      validateReferralCode(refCode)
    }
  }, [refCode])

  // ... rest of component
}
```

#### **2.2 Referral Code Validation**
```typescript
// app/api/referrals/validate-code/route.ts
export async function POST(request: Request) {
  const { code } = await request.json()
  
  const referralCode = await prisma.referralCode.findUnique({
    where: { 
      code, 
      isActive: true 
    },
    include: { user: true }
  })
  
  if (!referralCode) {
    return NextResponse.json({ 
      valid: false, 
      error: 'Invalid referral code' 
    })
  }
  
  // Check usage limits
  if (referralCode.maxUsage && referralCode.usageCount >= referralCode.maxUsage) {
    return NextResponse.json({ 
      valid: false, 
      error: 'Referral code usage limit reached' 
    })
  }
  
  // Check expiration
  if (referralCode.expiresAt && referralCode.expiresAt < new Date()) {
    return NextResponse.json({ 
      valid: false, 
      error: 'Referral code has expired' 
    })
  }
  
  return NextResponse.json({ 
    valid: true, 
    referrerName: referralCode.user.name,
    referrerId: referralCode.userId
  })
}
```

#### **2.3 Signup Integration**
```typescript
// Update app/api/auth/signup/route.ts
export async function POST(request: Request) {
  // ... existing signup logic ...
  
  // After user creation, check for referral code
  const referralCode = sessionStorage.getItem('referralCode')
  
  if (referralCode) {
    const validation = await validateReferralCode(referralCode)
    
    if (validation.valid) {
      await createReferralRecord({
        referrerId: validation.referrerId,
        referredUserId: newUser.id,
        referralCode: referralCode
      })
    }
  }
  
  // Clear referral code from session
  sessionStorage.removeItem('referralCode')
}
```

### **Phase 3: Reward System Implementation (Week 3)**

#### **3.1 Reward Configuration**
```typescript
// lib/referral-config.ts
export const REFERRAL_REWARDS = {
  REFERRER: {
    credits: 50,    // Credits for successful referral
    points: 100     // Quiz points for successful referral
  },
  REFERRED: {
    credits: 25,    // Bonus credits for new user
    points: 50      // Bonus quiz points for new user
  },
  COMPLETION_CRITERIA: {
    minQuizScore: 70,           // Minimum quiz score required
    minPredictions: 3,          // Minimum predictions made
    accountAge: 7 * 24 * 60 * 60 * 1000, // 7 days account age
    minPackagePurchases: 1      // Minimum package purchases
  },
  EXPIRATION: {
    referralExpiresIn: 30 * 24 * 60 * 60 * 1000, // 30 days
    rewardExpiresIn: 90 * 24 * 60 * 60 * 1000     // 90 days
  }
}
```

#### **3.2 Referral Completion Logic**
```typescript
// lib/referral-service.ts
export async function checkReferralCompletion(userId: string) {
  const pendingReferrals = await prisma.referral.findMany({
    where: {
      referredUserId: userId,
      status: 'pending',
      expiresAt: { gt: new Date() }
    },
    include: { referralCode: true }
  })
  
  for (const referral of pendingReferrals) {
    const isCompleted = await validateCompletionCriteria(userId)
    
    if (isCompleted) {
      await processReferralRewards(referral)
    }
  }
}

async function validateCompletionCriteria(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      quizParticipations: true,
      userPredictions: true,
      userPackages: true
    }
  })
  
  if (!user) return false
  
  // Check account age
  const accountAge = Date.now() - user.createdAt.getTime()
  if (accountAge < REFERRAL_REWARDS.COMPLETION_CRITERIA.accountAge) {
    return false
  }
  
  // Check quiz participation with minimum score
  const hasValidQuiz = user.quizParticipations.some(
    quiz => quiz.score >= REFERRAL_REWARDS.COMPLETION_CRITERIA.minQuizScore
  )
  
  // Check predictions made
  const predictionsCount = user.userPredictions.length
  
  // Check package purchases
  const packagePurchases = user.userPackages.length
  
  return hasValidQuiz && 
         predictionsCount >= REFERRAL_REWARDS.COMPLETION_CRITERIA.minPredictions &&
         packagePurchases >= REFERRAL_REWARDS.COMPLETION_CRITERIA.minPackagePurchases
}
```

#### **3.3 Reward Distribution**
```typescript
async function processReferralRewards(referral: Referral) {
  await prisma.$transaction(async (tx) => {
    // Update referral status
    await tx.referral.update({
      where: { id: referral.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        rewardCredits: REFERRAL_REWARDS.REFERRER.credits,
        rewardPoints: REFERRAL_REWARDS.REFERRER.points
      }
    })
    
    // Award credits to referrer
    await tx.user.update({
      where: { id: referral.referrerId },
      data: {
        predictionCredits: { increment: REFERRAL_REWARDS.REFERRER.credits },
        totalCreditsEarned: { increment: REFERRAL_REWARDS.REFERRER.credits }
      }
    })
    
    // Award points to referrer
    await tx.userPoints.update({
      where: { userId: referral.referrerId },
      data: {
        points: { increment: REFERRAL_REWARDS.REFERRER.points }
      }
    })
    
    // Award bonus to referred user
    await tx.user.update({
      where: { id: referral.referredUserId },
      data: {
        predictionCredits: { increment: REFERRAL_REWARDS.REFERRED.credits },
        totalCreditsEarned: { increment: REFERRAL_REWARDS.REFERRED.credits }
      }
    })
    
    await tx.userPoints.update({
      where: { userId: referral.referredUserId },
      data: {
        points: { increment: REFERRAL_REWARDS.REFERRED.points }
      }
    })
    
    // Update referral code usage count
    await tx.referralCode.update({
      where: { id: referral.referralCodeId },
      data: { usageCount: { increment: 1 } }
    })
    
    // Send notifications
    await sendReferralCompletionNotifications(referral)
  })
}
```

### **Phase 4: UI/UX Implementation (Week 4)**

#### **4.1 Referral Dashboard Component**
```tsx
// components/dashboard/ReferralSection.tsx
'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Copy, Share2, Users, CreditCard, Target } from 'lucide-react'

export function ReferralSection() {
  const [referralCode, setReferralCode] = useState('')
  const [referrals, setReferrals] = useState([])
  const [stats, setStats] = useState({
    totalReferrals: 0,
    completedReferrals: 0,
    totalEarned: 0,
    completionRate: 0
  })
  
  useEffect(() => {
    loadReferralData()
  }, [])
  
  const loadReferralData = async () => {
    try {
      const [codeRes, referralsRes, statsRes] = await Promise.all([
        fetch('/api/referrals/my-code'),
        fetch('/api/referrals/my-referrals'),
        fetch('/api/referrals/analytics')
      ])
      
      const codeData = await codeRes.json()
      const referralsData = await referralsRes.json()
      const statsData = await statsRes.json()
      
      setReferralCode(codeData.code)
      setReferrals(referralsData.referrals)
      setStats(statsData)
    } catch (error) {
      console.error('Failed to load referral data:', error)
    }
  }
  
  const copyToClipboard = async () => {
    const link = `https://snapbet.bet/snapbet-quiz?ref=${referralCode}`
    await navigator.clipboard.writeText(link)
    // Show toast notification
  }
  
  const shareLink = async () => {
    const link = `https://snapbet.bet/snapbet-quiz?ref=${referralCode}`
    const message = `Join me on SnapBet! Use my referral code for bonus credits: ${referralCode}`
    
    if (navigator.share) {
      await navigator.share({
        title: 'Join SnapBet',
        text: message,
        url: link
      })
    } else {
      await navigator.clipboard.writeText(`${message}\n${link}`)
      // Show toast notification
    }
  }
  
  return (
    <div className="space-y-6">
      {/* Referral Code Display */}
      <Card className="bg-gradient-to-r from-purple-500 to-blue-500 text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Your Referral Code
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="bg-white/20 px-3 py-2 rounded text-white font-mono text-lg">
              {referralCode}
            </code>
            <Button onClick={copyToClipboard} variant="secondary" size="sm">
              <Copy className="w-4 h-4 mr-1" />
              Copy
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Referral Link */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Share Your Link
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Input 
              value={`https://snapbet.bet/snapbet-quiz?ref=${referralCode}`}
              readOnly
              className="font-mono text-sm"
            />
            <Button onClick={shareLink}>
              <Share2 className="w-4 h-4 mr-1" />
              Share
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Referral Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard 
          title="Total Referrals" 
          value={stats.totalReferrals}
          icon={Users}
          color="blue"
        />
        <StatCard 
          title="Completed" 
          value={stats.completedReferrals}
          icon={Target}
          color="green"
        />
        <StatCard 
          title="Completion Rate" 
          value={`${stats.completionRate}%`}
          icon={Target}
          color="purple"
        />
        <StatCard 
          title="Credits Earned" 
          value={stats.totalEarned}
          icon={CreditCard}
          color="orange"
        />
      </div>
      
      {/* Referral History */}
      <ReferralHistory referrals={referrals} />
    </div>
  )
}

function StatCard({ title, value, icon: Icon, color }) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700'
  }
  
  return (
    <Card className={colorClasses[color]}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium opacity-80">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
          <Icon className="w-8 h-8 opacity-60" />
        </div>
      </CardContent>
    </Card>
  )
}
```

#### **4.2 Referral History Component**
```tsx
// components/dashboard/ReferralHistory.tsx
export function ReferralHistory({ referrals }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Referral History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {referrals.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No referrals yet. Share your link to start earning!
            </p>
          ) : (
            referrals.map((referral) => (
              <ReferralCard key={referral.id} referral={referral} />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ReferralCard({ referral }) {
  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    completed: 'bg-green-100 text-green-800 border-green-200',
    expired: 'bg-red-100 text-red-800 border-red-200'
  }
  
  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-lg border">
      <div>
        <p className="font-medium">{referral.referredUser.name}</p>
        <p className="text-sm text-gray-500">
          Joined {formatDate(referral.createdAt)}
        </p>
        {referral.completedAt && (
          <p className="text-sm text-green-600">
            Completed {formatDate(referral.completedAt)}
          </p>
        )}
      </div>
      <div className="text-right">
        <Badge className={statusColors[referral.status]}>
          {referral.status}
        </Badge>
        {referral.status === 'completed' && (
          <p className="text-sm text-green-600 mt-1">
            +{referral.rewardCredits} credits earned
          </p>
        )}
      </div>
    </div>
  )
}
```

### **Phase 5: Advanced Features & Analytics (Week 5)**

#### **5.1 Referral Analytics API**
```typescript
// app/api/referrals/analytics/route.ts
export async function GET(request: Request) {
  const { userId } = await getServerSession()
  
  const analytics = await prisma.$transaction(async (tx) => {
    const totalReferrals = await tx.referral.count({
      where: { referrerId: userId }
    })
    
    const completedReferrals = await tx.referral.count({
      where: { referrerId: userId, status: 'completed' }
    })
    
    const totalEarned = await tx.referral.aggregate({
      where: { referrerId: userId, status: 'completed' },
      _sum: { rewardCredits: true }
    })
    
    const monthlyStats = await tx.referral.groupBy({
      by: ['status'],
      where: { 
        referrerId: userId,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      },
      _count: true
    })
    
    const completionRate = totalReferrals > 0 
      ? (completedReferrals / totalReferrals) * 100 
      : 0
    
    return {
      totalReferrals,
      completedReferrals,
      totalEarned: totalEarned._sum.rewardCredits || 0,
      completionRate: Math.round(completionRate * 100) / 100,
      monthlyStats
    }
  })
  
  return NextResponse.json(analytics)
}
```

#### **5.2 Referral Leaderboard**
```typescript
// app/api/referrals/leaderboard/route.ts
export async function GET() {
  const leaderboard = await prisma.referral.groupBy({
    by: ['referrerId'],
    where: { status: 'completed' },
    _count: { id: true },
    _sum: { rewardCredits: true },
    orderBy: { _sum: { rewardCredits: 'desc' } },
    take: 10
  })
  
  const leaderboardWithUsers = await Promise.all(
    leaderboard.map(async (entry) => {
      const user = await prisma.user.findUnique({
        where: { id: entry.referrerId },
        select: { name: true, email: true }
      })
      return {
        ...entry,
        user
      }
    })
  )
  
  return NextResponse.json(leaderboardWithUsers)
}
```

### **Phase 6: Testing & Optimization (Week 6)**

#### **6.1 Test Coverage**
```typescript
// __tests__/referral-system.test.ts
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { prisma } from '@/lib/db'
import { generateReferralCode, validateReferralCode, processReferralRewards } from '@/lib/referral-service'

describe('Referral System', () => {
  beforeEach(async () => {
    await prisma.referral.deleteMany()
    await prisma.referralCode.deleteMany()
    await prisma.user.deleteMany()
  })
  
  afterEach(async () => {
    await prisma.$disconnect()
  })
  
  test('should generate unique referral codes', async () => {
    const user1 = await createTestUser('user1@test.com')
    const user2 = await createTestUser('user2@test.com')
    
    const code1 = await generateReferralCode(user1.id)
    const code2 = await generateReferralCode(user2.id)
    
    expect(code1).not.toBe(code2)
    expect(code1).toHaveLength(8)
    expect(code2).toHaveLength(8)
  })
  
  test('should validate referral codes correctly', async () => {
    const user = await createTestUser('referrer@test.com')
    const referralCode = await createTestReferralCode(user.id)
    
    const result = await validateReferralCode(referralCode.code)
    expect(result.valid).toBe(true)
    expect(result.referrerName).toBe(user.name)
  })
  
  test('should process referral rewards correctly', async () => {
    const { referrer, referred, referral } = await createTestReferral()
    
    await processReferralRewards(referral.id)
    
    const updatedReferrer = await prisma.user.findUnique({
      where: { id: referrer.id }
    })
    
    expect(updatedReferrer.predictionCredits).toBe(
      referrer.predictionCredits + REFERRAL_REWARDS.REFERRER.credits
    )
  })
  
  test('should prevent duplicate referrals', async () => {
    const { referrer, referred } = await createTestUsers()
    
    // First referral should succeed
    const referral1 = await createReferral(referrer.id, referred.id)
    expect(referral1).toBeDefined()
    
    // Second referral should fail
    await expect(createReferral(referrer.id, referred.id))
      .rejects.toThrow('Duplicate referral')
  })
})
```

#### **6.2 Performance Optimization**
```typescript
// lib/referral-cache.ts
import { cacheManager } from '@/lib/cache-manager'

export const REFERRAL_CACHE_KEYS = {
  CODE_VALIDATION: 'referral:validation:',
  USER_REFERRALS: 'referral:user:',
  ANALYTICS: 'referral:analytics:',
  LEADERBOARD: 'referral:leaderboard'
}

export async function getCachedReferralCode(code: string) {
  return await cacheManager.get(
    REFERRAL_CACHE_KEYS.CODE_VALIDATION + code,
    { ttl: 300 } // 5 minutes
  )
}

export async function setCachedReferralCode(code: string, data: any) {
  await cacheManager.set(
    REFERRAL_CACHE_KEYS.CODE_VALIDATION + code,
    data,
    { ttl: 300 }
  )
}

export async function invalidateReferralCache(userId: string) {
  await cacheManager.deletePattern(`referral:user:${userId}:*`)
  await cacheManager.delete(REFERRAL_CACHE_KEYS.LEADERBOARD)
}
```

### **Phase 7: Launch & Monitoring (Week 7)**

#### **7.1 Launch Checklist**
- [ ] Database migrations deployed and tested
- [ ] API endpoints tested and deployed
- [ ] UI components integrated into dashboard
- [ ] Email notifications configured: 
- [ ] Analytics dashboard set up
- [ ] Rate limiting configured
- [ ] Monitoring and alerting set up
- [ ] A/B testing framework ready
- [ ] Documentation completed
- [ ] Team training completed

#### **7.2 Monitoring & Analytics**
```typescript
// lib/referral-monitoring.ts
import { logger } from '@/lib/logger'
import { analytics } from '@/lib/analytics'

export const trackReferralEvent = async (event: string, data: any) => {
  await logger.info('Referral event', {
    tags: ['referral', event],
    data: {
      event,
      ...data,
      timestamp: new Date().toISOString()
    }
  })
  
  // Send to analytics service
  await analytics.track(event, {
    ...data,
    category: 'referral',
    timestamp: new Date().toISOString()
  })
}

export const trackReferralConversion = async (referralId: string, userId: string) => {
  await trackReferralEvent('referral_conversion', {
    referralId,
    userId,
    conversionType: 'signup'
  })
}

export const trackReferralCompletion = async (referralId: string, rewards: any) => {
  await trackReferralEvent('referral_completion', {
    referralId,
    rewards,
    completionType: 'full_criteria'
  })
}
```

---

## 🎯 **Key Success Metrics**

### **Primary Metrics**
1. **Referral Conversion Rate**: % of referred users who complete signup
2. **Referral Completion Rate**: % of referrals that reach completion criteria
3. **User Engagement**: Average credits/points earned per referrer
4. **Viral Coefficient**: Number of new users each referrer brings
5. **Retention Impact**: Whether referred users have higher retention

### **Secondary Metrics**
1. **Referral Code Usage**: How often codes are shared
2. **Completion Time**: Average time from signup to completion
3. **Reward Distribution**: Distribution of rewards across users
4. **Geographic Distribution**: Where referrals are coming from
5. **Platform Distribution**: Which platforms generate most referrals

---

## 🔧 **Configuration & Environment Variables**

```env
# Referral System Configuration
REFERRAL_REWARDS_REFERRER_CREDITS=50
REFERRAL_REWARDS_REFERRER_POINTS=100
REFERRAL_REWARDS_REFERRED_CREDITS=25
REFERRAL_REWARDS_REFERRED_POINTS=50
REFERRAL_COMPLETION_MIN_QUIZ_SCORE=70
REFERRAL_COMPLETION_MIN_PREDICTIONS=3
REFERRAL_COMPLETION_MIN_ACCOUNT_AGE_DAYS=7
REFERRAL_COMPLETION_MIN_PACKAGE_PURCHASES=1
REFERRAL_EXPIRATION_DAYS=30
REFERRAL_REWARD_EXPIRATION_DAYS=90

# Rate Limiting
REFERRAL_CODE_GENERATION_RATE_LIMIT=5
REFERRAL_CODE_VALIDATION_RATE_LIMIT=100
```

---

## 🛡️ **Security & Anti-Abuse Measures**

### **Rate Limiting**
```typescript
// lib/referral-rate-limiter.ts
import { rateLimit } from '@/lib/rate-limiter'

export const referralRateLimiters = {
  codeGeneration: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 codes per hour
    message: 'Too many referral code generation attempts'
  }),
  
  codeValidation: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 validations per minute
    message: 'Too many referral code validation attempts'
  })
}
```

### **Fraud Prevention**
```typescript
// lib/referral-fraud-detection.ts
export async function detectReferralFraud(referral: Referral): Promise<boolean> {
  // Check for self-referrals
  if (referral.referrerId === referral.referredUserId) {
    return true
  }
  
  // Check for rapid referrals from same IP
  const recentReferrals = await prisma.referral.findMany({
    where: {
      referrerId: referral.referrerId,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }
  })
  
  if (recentReferrals.length > 10) {
    return true
  }
  
  // Check for suspicious patterns
  const suspiciousPatterns = await checkSuspiciousPatterns(referral)
  
  return suspiciousPatterns
}
```

---

## 📧 **Email Notifications**

### **Referral Completion Email**
```typescript
// lib/email-templates/referral-completion.ts
export const referralCompletionEmail = {
  subject: '🎉 Your referral completed! You earned credits!',
  template: `
    <h2>Congratulations!</h2>
    <p>Your friend ${referredUserName} has completed their referral requirements!</p>
    <p>You've earned:</p>
    <ul>
      <li>${REFERRAL_REWARDS.REFERRER.credits} credits</li>
      <li>${REFERRAL_REWARDS.REFERRER.points} quiz points</li>
    </ul>
    <p>Keep sharing your referral link to earn more rewards!</p>
  `
}
```

### **Referral Welcome Email**
```typescript
// lib/email-templates/referral-welcome.ts
export const referralWelcomeEmail = {
  subject: '🎁 Welcome to SnapBet! Here are your bonus credits!',
  template: `
    <h2>Welcome to SnapBet!</h2>
    <p>You were referred by ${referrerName} and earned bonus rewards!</p>
    <p>Your bonus:</p>
    <ul>
      <li>${REFERRAL_REWARDS.REFERRED.credits} credits</li>
      <li>${REFERRAL_REWARDS.REFERRED.points} quiz points</li>
    </ul>
    <p>Complete your profile and start making predictions to unlock more rewards!</p>
  `
}
```

---

## 🚀 **Deployment Strategy**

### **Phase 1: Soft Launch (Week 1-2)**
- Deploy to staging environment
- Test with internal team
- Gather feedback and iterate

### **Phase 2: Beta Launch (Week 3-4)**
- Deploy to production with feature flag
- Enable for 10% of users
- Monitor metrics and performance

### **Phase 3: Full Launch (Week 5-6)**
- Enable for all users
- Monitor closely for issues
- Optimize based on real usage

### **Phase 4: Optimization (Week 7+)**
- Analyze performance data
- Implement improvements
- Scale based on usage patterns

---

## 📚 **Additional Resources**

### **Useful Links**
- [Prisma Documentation](https://www.prisma.io/docs)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
- [Stripe Referral System Guide](https://stripe.com/docs/connect/referrals)
- [Referral Marketing Best Practices](https://www.referralcandy.com/blog/referral-marketing-best-practices/)

### **Testing Tools**
- [Jest Testing Framework](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Postman API Testing](https://www.postman.com/)

### **Monitoring Tools**
- [Vercel Analytics](https://vercel.com/analytics)
- [Sentry Error Tracking](https://sentry.io/)
- [LogRocket Session Replay](https://logrocket.com/)

---

**🎯 This roadmap provides a comprehensive guide for implementing a robust referral system that integrates seamlessly with SnapBet's existing credit and quiz systems. Each phase builds upon the previous one, ensuring a solid foundation and gradual feature rollout.** 