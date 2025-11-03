import { NextRequest } from 'next/server'
import prisma from '@/lib/db'

// Prevent pre-rendering during build
export const dynamic = 'force-dynamic'

const BASE_URL = process.env.BACKEND_API_URL || process.env.BACKEND_URL
const API_KEY = process.env.BACKEND_API_KEY || process.env.NEXT_PUBLIC_MARKET_KEY || 'betgenius_secure_key_2024'

/**
 * Sitemap for finished matches
 * Uses backend API to get authoritative list of finished matches,
 * then cross-references with QuickPurchase to ensure we only include
 * matches with predictionData (content requirement)
 */
export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://www.snapbet.bet'

  try {
    // Step 1: Get finished matches from backend API (source of truth)
    let finishedMatchIds: string[] = []
    
    if (BASE_URL) {
      try {
        // Call backend API to get finished matches (limit to 500 most recent)
        const finishedMatchesUrl = `${BASE_URL}/market?status=finished&limit=500`
        console.log('[Sitemap] Fetching finished matches from backend:', finishedMatchesUrl)
        
        const response = await fetch(finishedMatchesUrl, {
          headers: {
            Authorization: `Bearer ${API_KEY}`,
          },
          next: { revalidate: 3600 } // Cache for 1 hour
        })

        if (response.ok) {
          const data = await response.json()
          // Extract match IDs from backend response
          if (data.matches && Array.isArray(data.matches)) {
            finishedMatchIds = data.matches
              .map((match: any) => match.match_id?.toString())
              .filter((id: string) => id !== undefined && id !== null)
          }
          console.log(`[Sitemap] Found ${finishedMatchIds.length} finished matches from backend API`)
        } else {
          console.warn(`[Sitemap] Backend API returned ${response.status}, falling back to database`)
        }
      } catch (error) {
        console.error('[Sitemap] Error fetching from backend API:', error)
        // Fall back to database-only approach
      }
    }

    // Step 2: Get QuickPurchase records with predictionData
    // If we have match IDs from backend, filter by them; otherwise get all with predictionData
    const quickPurchaseWhere: any = {
      type: { in: ['prediction', 'tip'] },
      isActive: true,
      predictionData: { not: null },
    }

    // If we have finished match IDs from backend, filter by them
    if (finishedMatchIds.length > 0) {
      quickPurchaseWhere.matchId = { in: finishedMatchIds }
    }

    const quickPurchases = await prisma.quickPurchase.findMany({
      where: quickPurchaseWhere,
      select: {
        matchId: true,
        updatedAt: true,
        createdAt: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 1000, // Limit to most recent 1000
    })

    console.log(`[Sitemap] Found ${quickPurchases.length} QuickPurchase records with predictionData`)

    // Step 3: Create sitemap entries
    const matchUrls = quickPurchases.map((qp) => ({
      url: `${baseUrl}/match/${qp.matchId}`,
      lastModified: qp.updatedAt.toISOString(),
      changeFrequency: 'weekly' as const, // Finished matches don't change often
      priority: 0.6, // Medium priority - good for SEO but not highest
    }))

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
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    console.error('Error generating matches sitemap:', error)
    return new Response('Error generating sitemap', { status: 500 })
  }
}

