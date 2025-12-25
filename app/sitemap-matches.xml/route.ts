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
 */
export async function GET(request: NextRequest) {
  // Normalize baseUrl to ensure no trailing slash (prevents double slashes)
  const baseUrl = normalizeBaseUrl()

  try {
    // Step 1: Get all MarketMatch records with active statuses
    // Include UPCOMING, LIVE, and FINISHED matches (exclude CANCELLED, POSTPONED)
    const marketMatches = await prisma.marketMatch.findMany({
      where: {
        status: { in: ['UPCOMING', 'LIVE', 'FINISHED'] },
        isActive: true,
        isArchived: false,
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
          take: 1, // Only need to check if predictionData exists
        },
      },
      orderBy: [
        { status: 'asc' }, // UPCOMING first, then LIVE, then FINISHED
        { kickoffDate: 'desc' }, // Most recent first within each status
      ],
      take: 5000, // Increased limit to include more matches
    })

    console.log(`[Sitemap] Found ${marketMatches.length} MarketMatch records`)

    // Step 2: Filter to only matches that have QuickPurchase with predictionData
    const matchesWithPredictions = marketMatches.filter(
      (match) => match.quickPurchases.length > 0
    )

    console.log(
      `[Sitemap] Found ${matchesWithPredictions.length} matches with predictionData`
    )

    // Step 3: Create sitemap entries with status-based priorities and change frequencies
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

