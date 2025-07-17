import { NextRequest } from 'next/server'

// Prevent pre-rendering during build
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://snapbet.ai'
  const currentDate = new Date().toISOString()

  const staticPages = [
    {
      url: baseUrl,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 1.0, // Homepage - highest priority
    },
    {
      url: `${baseUrl}/daily-tips`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 0.9, // High priority - main feature
    },
    {
      url: `${baseUrl}/live-predictions`,
      lastModified: currentDate,
      changeFrequency: 'hourly',
      priority: 0.9, // High priority - real-time content
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 0.8, // High priority - content hub
    },
    {
      url: `${baseUrl}/weekly-specials`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.8, // High priority - special content
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.7, // Medium-high priority - user support
    },
    {
      url: `${baseUrl}/tips-history`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 0.7, // Medium-high priority - historical data
    },
    {
      url: `${baseUrl}/support`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.6, // Medium priority - support page
    },
    {
      url: `${baseUrl}/snapbet-quiz`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.6, // Medium priority - engagement feature
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.5, // Medium priority - conversion page
    },
    {
      url: `${baseUrl}/signin`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.4, // Lower priority - utility page
    },
    {
      url: `${baseUrl}/dashboard`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.3, // Low priority - authenticated page
    },
    {
      url: `${baseUrl}/geo-demo`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.2, // Very low priority - demo page
    },
  ]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticPages.map(page => `  <url>
    <loc>${page.url}</loc>
    <lastmod>${page.lastModified}</lastmod>
    <changefreq>${page.changeFrequency}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n')}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
} 