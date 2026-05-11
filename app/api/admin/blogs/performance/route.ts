import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/blogs/performance
 *
 * Powers the 14-day blog performance dashboard. Returns:
 *   - aggregate funnel: views, CTA clicks + CTR, shares, newsletter subscribers
 *   - popup funnel: impression → subscribe rate, dismiss rate, by source
 *   - top blogs by views + by CTA clicks
 *   - broken-funnel detector (high views, zero CTA clicks)
 *   - recent generated blogs (last 7d)
 *   - REGRESSION GUARD: blogs generated last 7d whose match has already
 *     finished or kicked off — MUST be zero. Non-zero = the eligibility
 *     filter regressed.
 *   - evergreen topic queue counts by status
 *
 * Window: last 14 days. Override with ?days=N.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const days = Math.max(1, Math.min(90, parseInt(url.searchParams.get('days') || '14', 10) || 14))

    const now = new Date()
    const windowStart = new Date(now.getTime() - days * 86400 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400 * 1000)

    // ── Aggregate counters (lifetime totals across active blogs) ───────────
    const [aggregates] = await prisma.$queryRaw<Array<{
      total_views: bigint
      total_shares: bigint
      total_cta_clicks: bigint
      blog_count: bigint
    }>>`
      SELECT
        COALESCE(SUM("viewCount"), 0)::bigint AS total_views,
        COALESCE(SUM("shareCount"), 0)::bigint AS total_shares,
        COALESCE(SUM("ctaClickCount"), 0)::bigint AS total_cta_clicks,
        COUNT(*)::bigint AS blog_count
      FROM "BlogPost"
      WHERE "isActive" = true AND "isPublished" = true
    `

    // ── Newsletter subscribers ─────────────────────────────────────────────
    const [subsLifetime, subsWindow] = await Promise.all([
      prisma.newsletterSubscription.count({ where: { isActive: true } }),
      prisma.newsletterSubscription.count({
        where: { isActive: true, subscribedAt: { gte: windowStart } },
      }),
    ])

    // ── Popup funnel by source (NewsletterEvent within window) ─────────────
    const popupEventsRaw = await prisma.newsletterEvent.groupBy({
      by: ['type', 'source'],
      where: { createdAt: { gte: windowStart } },
      _count: { _all: true },
    })
    type EventBucket = { impression: number; dismiss: number; subscribe: number }
    const popup: EventBucket = { impression: 0, dismiss: 0, subscribe: 0 }
    const staticWidget: EventBucket = { impression: 0, dismiss: 0, subscribe: 0 }
    for (const row of popupEventsRaw) {
      const t = row.type as keyof EventBucket
      if (t !== 'impression' && t !== 'dismiss' && t !== 'subscribe') continue
      const bucket = row.source === 'popup' ? popup : row.source === 'static_widget' ? staticWidget : null
      if (!bucket) continue
      bucket[t] = row._count._all
    }

    function rate(num: number, denom: number): number {
      if (denom <= 0) return 0
      return Math.round((num / denom) * 10000) / 100 // pct, 2 decimals
    }

    // ── Top blogs by views (active+published, all-time) ────────────────────
    const topByViews = await prisma.blogPost.findMany({
      where: { isActive: true, isPublished: true },
      orderBy: { viewCount: 'desc' },
      take: 10,
      select: {
        id: true, title: true, slug: true, viewCount: true, shareCount: true,
        ctaClickCount: true, aiGenerated: true, publishedAt: true,
      },
    })

    // ── Top blogs by CTA clicks ────────────────────────────────────────────
    const topByCtaClicks = await prisma.blogPost.findMany({
      where: { isActive: true, isPublished: true, ctaClickCount: { gt: 0 } },
      orderBy: { ctaClickCount: 'desc' },
      take: 10,
      select: {
        id: true, title: true, slug: true, viewCount: true, ctaClickCount: true,
        aiGenerated: true,
      },
    })

    // ── Broken funnel: views > 50, ctaClicks = 0, has marketMatch link ─────
    const brokenFunnel = await prisma.blogPost.findMany({
      where: {
        isActive: true,
        isPublished: true,
        viewCount: { gt: 50 },
        ctaClickCount: 0,
        marketMatchId: { not: null },
      },
      orderBy: { viewCount: 'desc' },
      take: 10,
      select: { id: true, title: true, slug: true, viewCount: true },
    })

    // ── Recently generated blogs (last 7d) ─────────────────────────────────
    const recentlyGenerated = await prisma.blogPost.findMany({
      where: { isActive: true, createdAt: { gte: sevenDaysAgo } },
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: {
        id: true, title: true, slug: true, aiGenerated: true, isPublished: true,
        viewCount: true, createdAt: true, category: true,
        marketMatch: {
          select: { matchId: true, status: true, kickoffDate: true, homeTeam: true, awayTeam: true },
        },
      },
    })

    // ── REGRESSION GUARD: blogs created in last 7d for finished/past matches ─
    // Must be zero — the eligibility filter (lib/blog/eligibility.ts) guarantees
    // it. Any non-zero count signals a regression and should alert.
    const regressionRows = recentlyGenerated.filter(b =>
      b.marketMatch && (
        b.marketMatch.status === 'FINISHED' ||
        b.marketMatch.status === 'CANCELLED' ||
        new Date(b.marketMatch.kickoffDate) < new Date(b.createdAt)
      )
    )

    // ── Evergreen topic queue status ───────────────────────────────────────
    const evergreenStatusRaw = await prisma.evergreenTopic.groupBy({
      by: ['status'],
      _count: { _all: true },
    })
    const evergreenStatus = Object.fromEntries(
      evergreenStatusRaw.map(r => [r.status, r._count._all])
    )

    return NextResponse.json({
      success: true,
      window: { days, start: windowStart.toISOString(), end: now.toISOString() },
      aggregates: {
        totalBlogs: Number(aggregates.blog_count),
        totalViews: Number(aggregates.total_views),
        totalShares: Number(aggregates.total_shares),
        totalCtaClicks: Number(aggregates.total_cta_clicks),
        ctaCtrPct: rate(Number(aggregates.total_cta_clicks), Number(aggregates.total_views)),
      },
      newsletter: {
        subscribersLifetime: subsLifetime,
        subscribersInWindow: subsWindow,
        popup: {
          ...popup,
          impressionToSubscribePct: rate(popup.subscribe, popup.impression),
          dismissalRatePct: rate(popup.dismiss, popup.impression),
        },
        staticWidget: {
          ...staticWidget,
          // static widget has no separate impression event yet; this is just subscribes
        },
      },
      topByViews,
      topByCtaClicks,
      brokenFunnel,
      recentlyGenerated,
      regression: {
        finishedOrPastKickoffInLast7d: regressionRows.length,
        examples: regressionRows.slice(0, 5).map(r => ({
          id: r.id,
          title: r.title,
          slug: r.slug,
          matchStatus: r.marketMatch?.status,
          kickoffDate: r.marketMatch?.kickoffDate,
          createdAt: r.createdAt,
        })),
      },
      evergreenStatus: {
        queued: evergreenStatus.queued || 0,
        drafted: evergreenStatus.drafted || 0,
        reviewed: evergreenStatus.reviewed || 0,
        published: evergreenStatus.published || 0,
        refresh_due: evergreenStatus.refresh_due || 0,
      },
    })
  } catch (error) {
    console.error('[Blog Performance] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load performance data' },
      { status: 500 }
    )
  }
}
