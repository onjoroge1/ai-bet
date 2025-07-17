import { NextRequest } from 'next/server'
import { getCountryByCode, getPrimarySupportedCountries } from '@/lib/countries'
import prisma from '@/lib/db'

interface BlogPostData {
  slug: string
  publishedAt: Date | null
  updatedAt: Date | null
  geoTarget: string[]
}

// Prevent pre-rendering during build
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { country: string } }
) {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://snapbet.ai'
  const currentDate = new Date().toISOString()
  const countryCode = params.country.toUpperCase()

  // Validate country
  const country = getCountryByCode(countryCode)
  if (!country || !country.isSupported) {
    return new Response('Country not found', { status: 404 })
  }

  try {
    // Get blog posts for this country
    const blogPosts = await prisma.blogPost.findMany({
      where: {
        isPublished: true,
        isActive: true,
        OR: [
          { geoTarget: { has: countryCode } },
          { geoTarget: { has: 'worldwide' } }, // Worldwide posts
          { geoTarget: { isEmpty: true } }, // Empty geoTarget (legacy)
        ],
      },
      select: {
        slug: true,
        publishedAt: true,
        updatedAt: true,
        geoTarget: true,
      },
      orderBy: {
        publishedAt: 'desc',
      },
    })

    const countryCodeLower = countryCode.toLowerCase()
    const countryUrls: Array<{
      url: string
      lastModified: string
      changeFrequency: string
      priority: number
    }> = []

    // Add country-specific main pages
    countryUrls.push({
      url: `${baseUrl}/${countryCodeLower}`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 0.9,
    })

    countryUrls.push({
      url: `${baseUrl}/${countryCodeLower}/blog`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 0.7,
    })

    countryUrls.push({
      url: `${baseUrl}/${countryCodeLower}/faq`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.6,
    })

    // Add country-specific blog posts
    blogPosts.forEach((post: BlogPostData) => {
      const postDate = post.updatedAt || post.publishedAt || new Date()
      
      countryUrls.push({
        url: `${baseUrl}/${countryCodeLower}/blog/${post.slug}`,
        lastModified: postDate.toISOString(),
        changeFrequency: 'monthly',
        priority: 0.6,
      })
    })

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${countryUrls.map(page => `  <url>
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
  } catch (error) {
    console.error(`Error generating sitemap for ${countryCode}:`, error)
    
    // Fallback to basic country sitemap
    const fallbackXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/${countryCode.toLowerCase()}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/${countryCode.toLowerCase()}/blog</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${baseUrl}/${countryCode.toLowerCase()}/faq</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>
</urlset>`

    return new Response(fallbackXml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    })
  }
} 