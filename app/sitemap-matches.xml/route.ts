import { NextRequest } from 'next/server'
import { normalizeBaseUrl, buildSitemapUrl } from '@/lib/sitemap-helpers'
import prisma from '@/lib/db'

// Prevent pre-rendering during build
export const dynamic = 'force-dynamic'

/**
 * Sitemap for all matches (UPCOMING, LIVE, FINISHED)
 * Uses MarketMatch table as single source of truth
 * Cross-references with QuickPurchase to ensure we only include
 * matches with predictionData (content requirement)
 * 
 * Strategy:
 * - UPCOMING/LIVE: Recent active matches with active predictions
 * - FINISHED: Recent completed matches (last 90 days) with prediction data
 *   (Includes historical content for SEO and user reference)
 */
export async function GET(request: NextRequest) {
  // Normalize baseUrl to ensure no trailing slash (prevents double slashes)
  const baseUrl = normalizeBaseUrl()

  try {
    // Step 1: Get UPCOMING and LIVE matches (active predictions)
    const upcomingAndLiveMatches = await prisma.marketMatch.findMany({
      where: {
        status: { in: ['UPCOMING', 'LIVE'] },
        isActive: true,
        isArchived: false,
        quickPurchases: {
          some: {
            type: { in: ['prediction', 'tip'] },
            isActive: true,
            isPredictionActive: true,
            predictionData: { not: null },
          },
        },
      },
      select: {
        matchId: true,
        status: true,
        updatedAt: true,
        kickoffDate: true,
        quickPurchases: {
          where: {
            type: { in: ['prediction', 'tip'] },
            isActive: true,
            isPredictionActive: true,
            predictionData: { not: null },
          },
          select: {
            id: true,
            updatedAt: true,
          },
          take: 1,
        },
      },
      orderBy: [
        { status: 'asc' }, // UPCOMING first, then LIVE
        { kickoffDate: 'desc' },
      ],
      take: 2000, // Limit for upcoming/live matches
    })

    // Step 2: Get FINISHED matches (recent completed matches with prediction data)
    // Include finished matches from the last 90 days to ensure we have historical content
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const finishedMatches = await prisma.marketMatch.findMany({
      where: {
        status: 'FINISHED',
        isActive: true,
        isArchived: false,
        kickoffDate: { gte: ninetyDaysAgo }, // Only recent finished matches (last 90 days)
        quickPurchases: {
          some: {
            type: { in: ['prediction', 'tip'] },
            isActive: true,
            predictionData: { not: null }, // For finished matches, include if predictionData exists
            // Note: We don't require isPredictionActive for finished matches
            // as they may have historical prediction data
          },
        },
      },
      select: {
        matchId: true,
        status: true,
        updatedAt: true,
        kickoffDate: true,
        quickPurchases: {
          where: {
            type: { in: ['prediction', 'tip'] },
            isActive: true,
            predictionData: { not: null },
          },
          select: {
            id: true,
            updatedAt: true,
          },
          take: 1,
        },
      },
      orderBy: {
        kickoffDate: 'desc', // Most recent finished matches first
      },
      take: 3000, // Limit for finished matches
    })

    // Step 3: Combine both sets of matches
    const marketMatches = [...upcomingAndLiveMatches, ...finishedMatches]

    console.log(`[Sitemap] Found ${upcomingAndLiveMatches.length} UPCOMING/LIVE matches`)
    console.log(`[Sitemap] Found ${finishedMatches.length} FINISHED matches`)
    console.log(`[Sitemap] Total: ${marketMatches.length} MarketMatch records`)

    // Step 4: Filter to only matches that have QuickPurchase with predictionData
    const matchesWithPredictions = marketMatches.filter(
      (match) => match.quickPurchases.length > 0
    )

    console.log(
      `[Sitemap] Found ${matchesWithPredictions.length} matches with predictionData`
    )

    // Step 5: Create sitemap entries with status-based priorities and change frequencies
    const matchUrls = matchesWithPredictions.map((match) => {
      // Determine priority and change frequency based on status
      let priority: number
      let changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'

      switch (match.status) {
        case 'UPCOMING':
          priority = 0.8 // High priority - users actively search for upcoming predictions
          changeFrequency = 'daily' // May change before kickoff
          break
        case 'LIVE':
          priority = 0.8 // High priority - live matches are very relevant
          changeFrequency = 'hourly' // Changing rapidly during match
          break
        case 'FINISHED':
          priority = 0.6 // Lower priority - historical content
          changeFrequency = 'weekly' // Rarely changes after completion
          break
        default:
          priority = 0.6
          changeFrequency = 'weekly'
      }

      // Use the most recent updatedAt from either MarketMatch or QuickPurchase
      const quickPurchaseUpdatedAt =
        match.quickPurchases[0]?.updatedAt || match.updatedAt
      const lastModified =
        quickPurchaseUpdatedAt > match.updatedAt
          ? quickPurchaseUpdatedAt
          : match.updatedAt

      return {
        url: buildSitemapUrl(baseUrl, `/match/${match.matchId}`),
        lastModified: lastModified.toISOString(),
        changeFrequency,
        priority,
      }
    })

    // Generate XML
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${matchUrls
  .map(
    (url) => `  <url>
    <loc>${url.url}</loc>
    <lastmod>${url.lastModified}</lastmod>
    <changefreq>${url.changeFrequency}</changefreq>
    <priority>${url.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    console.error('Error generating matches sitemap:', error)
    return new Response('Error generating sitemap', { status: 500 })
  }
}

