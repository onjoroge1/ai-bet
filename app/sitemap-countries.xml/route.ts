import { NextRequest } from 'next/server'
import { getPrimarySupportedCountries } from '@/lib/countries'
import { normalizeBaseUrl, buildSitemapUrl } from '@/lib/sitemap-helpers'

// Prevent pre-rendering during build
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Normalize baseUrl to ensure no trailing slash (prevents double slashes)
  const baseUrl = normalizeBaseUrl()
  const currentDate = new Date().toISOString()

  // Get supported countries for country-specific pages
  const supportedCountries = getPrimarySupportedCountries()

  // Generate country-specific pages
  const countryPages = supportedCountries.flatMap(country => {
    const countryCode = country.code.toLowerCase()
    return [
      {
        url: buildSitemapUrl(baseUrl, `/${countryCode}`),
        lastModified: currentDate,
        changeFrequency: 'daily',
        priority: 0.9,
      },
      {
        url: buildSitemapUrl(baseUrl, `/${countryCode}/blog`),
        lastModified: currentDate,
        changeFrequency: 'daily',
        priority: 0.7,
      },
      {
        url: buildSitemapUrl(baseUrl, `/${countryCode}/faq`),
        lastModified: currentDate,
        changeFrequency: 'weekly',
        priority: 0.6,
      },
    ]
  })

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${countryPages.map(page => `  <url>
    <loc>${page.url}</loc>
    <lastmod>${page.lastModified}</lastmod>
    <changefreq>${page.changeFrequency}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n')}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
} 