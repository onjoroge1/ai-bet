import { NextRequest } from 'next/server'
import { normalizeBaseUrl, buildSitemapUrl } from '@/lib/sitemap-helpers'

// Prevent pre-rendering during build
export const dynamic = 'force-dynamic'

/**
 * Main Sitemap - Public Marketing Pages Only
 * 
 * This sitemap includes only public, SEO-worthy pages that should be indexed.
 * Excludes: auth pages, private pages, utility pages, demo pages
 * 
 * Strategy: Focus crawl budget on content that matters for Discover + organic search
 */
export async function GET(request: NextRequest) {
  // Normalize baseUrl to ensure no trailing slash (prevents double slashes)
  const baseUrl = normalizeBaseUrl()
  const currentDate = new Date().toISOString()

  // Only include public, SEO-worthy marketing pages
  // Removed: /signup, /signin, /dashboard, /support, /geo-demo, /snapbet-quiz
  const staticPages = [
    {
      path: '/',
      lastModified: currentDate,
      changeFrequency: 'daily' as const,
      priority: 1.0, // Homepage - highest priority
    },
    {
      path: '/daily-tips',
      lastModified: currentDate,
      changeFrequency: 'daily' as const,
      priority: 0.9, // High priority - main feature
    },
    {
      path: '/live-predictions',
      lastModified: currentDate,
      changeFrequency: 'hourly' as const,
      priority: 0.9, // High priority - real-time content
    },
    {
      path: '/matches',
      lastModified: currentDate,
      changeFrequency: 'hourly' as const,
      priority: 0.8, // High priority - public browse page for matches
    },
    {
      path: '/blog',
      lastModified: currentDate,
      changeFrequency: 'daily' as const,
      priority: 0.8, // High priority - content hub
    },
    {
      path: '/weekly-specials',
      lastModified: currentDate,
      changeFrequency: 'weekly' as const,
      priority: 0.8, // High priority - special content
    },
    {
      path: '/faq',
      lastModified: currentDate,
      changeFrequency: 'weekly' as const,
      priority: 0.7, // Medium-high priority - user support
    },
    {
      path: '/tips-history',
      lastModified: currentDate,
      changeFrequency: 'daily' as const,
      priority: 0.7, // Medium-high priority - historical data (if public and content-rich)
    },
  ]

  // Generate XML with proper URL construction (prevents double slashes)
  // Note: priority and changefreq are mostly ignored by Google but kept for internal clarity
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticPages.map(page => {
      // Use buildSitemapUrl to ensure no double slashes
      const url = buildSitemapUrl(baseUrl, page.path)
      return `  <url>
    <loc>${url}</loc>
    <lastmod>${page.lastModified}</lastmod>
    <changefreq>${page.changeFrequency}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
    }).join('\n')}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
} 