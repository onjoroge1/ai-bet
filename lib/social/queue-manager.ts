/**
 * Social Media Queue Manager — prevents scheduling conflicts
 * and enforces content diversity rules.
 */

import prisma from '@/lib/db'

const MIN_GAP_MINUTES = 15         // Minimum gap between posts
const MAX_HOURLY = 5               // Twitter hourly limit
const MAX_DAILY = 30               // Twitter daily limit
const MAX_PREVIEW_PCT = 0.60       // Max 60% match previews per day
const MAX_MULTISPORT_DAILY = 6     // Max multisport posts per day
const SAME_MATCH_GAP_HOURS = 2     // No same-match posts within 2 hours

interface ContentMixResult {
  allowed: boolean
  reason?: string
  stats: {
    totalToday: number
    byType: Record<string, number>
    previewPct: number
    hourlyUsed: number
    dailyUsed: number
  }
}

/**
 * Find the next available posting slot (at least MIN_GAP_MINUTES from last post)
 */
export async function getNextAvailableSlot(
  platform: string = 'twitter',
  afterTime?: Date
): Promise<Date> {
  const startAfter = afterTime || new Date()

  // Find the most recent scheduled/posted time
  const lastPost = await prisma.socialMediaPost.findFirst({
    where: {
      platform,
      status: { in: ['scheduled', 'posted'] },
      scheduledAt: { gte: startAfter },
    },
    orderBy: { scheduledAt: 'desc' },
    select: { scheduledAt: true },
  })

  if (!lastPost) {
    // No posts after startAfter — use startAfter + 1 min buffer
    return new Date(startAfter.getTime() + 60 * 1000)
  }

  // Find a gap of MIN_GAP_MINUTES in the schedule
  const posts = await prisma.socialMediaPost.findMany({
    where: {
      platform,
      status: { in: ['scheduled', 'posted'] },
      scheduledAt: { gte: startAfter },
    },
    orderBy: { scheduledAt: 'asc' },
    select: { scheduledAt: true },
    take: 50,
  })

  let candidate = new Date(startAfter.getTime() + 60 * 1000)
  for (const post of posts) {
    const gap = (post.scheduledAt.getTime() - candidate.getTime()) / 60000
    if (gap >= MIN_GAP_MINUTES) {
      return candidate // Found a slot
    }
    candidate = new Date(post.scheduledAt.getTime() + MIN_GAP_MINUTES * 60 * 1000)
  }

  return candidate
}

/**
 * Check if a specific time slot is available (no post within MIN_GAP_MINUTES)
 */
export async function isSlotAvailable(time: Date, platform: string = 'twitter'): Promise<boolean> {
  const windowStart = new Date(time.getTime() - MIN_GAP_MINUTES * 60 * 1000)
  const windowEnd = new Date(time.getTime() + MIN_GAP_MINUTES * 60 * 1000)

  const conflict = await prisma.socialMediaPost.findFirst({
    where: {
      platform,
      status: { in: ['scheduled', 'posted'] },
      scheduledAt: { gte: windowStart, lte: windowEnd },
    },
  })

  return !conflict
}

/**
 * Check content mix rules for today. Returns whether a new post of the given type is allowed.
 */
export async function enforceContentMix(
  postType: string,
  platform: string = 'twitter',
  matchId?: string
): Promise<ContentMixResult> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

  // Get today's posts
  const todayPosts = await prisma.socialMediaPost.findMany({
    where: {
      platform,
      status: { in: ['scheduled', 'posted'] },
      scheduledAt: { gte: today, lt: tomorrow },
    },
    select: { postType: true, matchId: true, scheduledAt: true },
  })

  // Hourly count
  const hourlyPosts = todayPosts.filter(p => p.scheduledAt >= oneHourAgo)

  // By type
  const byType: Record<string, number> = {}
  for (const p of todayPosts) {
    byType[p.postType] = (byType[p.postType] || 0) + 1
  }

  const totalToday = todayPosts.length
  const previewCount = (byType['match'] || 0) + (byType['multisport_preview'] || 0)
  const previewPct = totalToday > 0 ? previewCount / totalToday : 0

  const stats = {
    totalToday,
    byType,
    previewPct: Math.round(previewPct * 100),
    hourlyUsed: hourlyPosts.length,
    dailyUsed: totalToday,
  }

  // Rate limits
  if (hourlyPosts.length >= MAX_HOURLY) {
    return { allowed: false, reason: `Hourly limit reached (${MAX_HOURLY}/hr)`, stats }
  }
  if (totalToday >= MAX_DAILY) {
    return { allowed: false, reason: `Daily limit reached (${MAX_DAILY}/day)`, stats }
  }

  // Content mix rules
  const isPreview = ['match', 'multisport_preview'].includes(postType)
  if (isPreview && totalToday >= 5 && previewPct >= MAX_PREVIEW_PCT) {
    return { allowed: false, reason: `Too many previews (${Math.round(previewPct * 100)}% > ${MAX_PREVIEW_PCT * 100}%)`, stats }
  }

  // Multisport cap
  if (postType === 'multisport_preview' && (byType['multisport_preview'] || 0) >= MAX_MULTISPORT_DAILY) {
    return { allowed: false, reason: `Max ${MAX_MULTISPORT_DAILY} multisport posts per day`, stats }
  }

  // Same-match gap (except preview→result pair)
  if (matchId) {
    const twoHoursAgo = new Date(Date.now() - SAME_MATCH_GAP_HOURS * 60 * 60 * 1000)
    const recentSameMatch = todayPosts.find(p =>
      p.matchId === matchId && p.scheduledAt >= twoHoursAgo && p.postType === postType
    )
    if (recentSameMatch) {
      return { allowed: false, reason: `Same match posted within ${SAME_MATCH_GAP_HOURS}h`, stats }
    }
  }

  return { allowed: true, stats }
}
