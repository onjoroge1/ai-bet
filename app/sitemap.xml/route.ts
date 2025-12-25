import { NextRequest } from 'next/server'
import { normalizeBaseUrl } from '@/lib/sitemap-helpers'

// Prevent pre-rendering during build
export const dynamic = 'force-dynamic'

/**
 * Sitemap Index - Points to all sub-sitemaps
 * 
 * This is a Sitemap Index file, not a regular sitemap.
 * It uses <sitemapindex> structure, not <urlset>.
 * 
 * Reference: https://www.sitemaps.org/protocol.html#index
 */
export async function GET(request: NextRequest) {
  // Normalize baseUrl to ensure no trailing slash (prevents double slashes)
  const baseUrl = normalizeBaseUrl()
  
  const currentDate = new Date().toISOString()

  // List of all sub-sitemaps
  const sitemaps = [
    {
      loc: `${baseUrl}/sitemap-main.xml`,
      lastmod: currentDate,
    },
    {
      loc: `${baseUrl}/sitemap-countries.xml`,
      lastmod: currentDate,
    },
    {
      loc: `${baseUrl}/sitemap-blog.xml`,
      lastmod: currentDate,
    },
    {
      loc: `${baseUrl}/sitemap-news.xml`,
      lastmod: currentDate,
    },
    {
      loc: `${baseUrl}/sitemap-matches.xml`,
      lastmod: currentDate,
    },
  ]

  // Generate proper sitemap index XML
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps
  .map(
    (sitemap) => `  <sitemap>
    <loc>${sitemap.loc}</loc>
    <lastmod>${sitemap.lastmod}</lastmod>
  </sitemap>`
  )
  .join('\n')}
</sitemapindex>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}

