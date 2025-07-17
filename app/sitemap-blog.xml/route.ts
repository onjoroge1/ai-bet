import { NextRequest } from 'next/server'
import { getPrimarySupportedCountries } from '@/lib/countries'
import prisma from '@/lib/db'

interface BlogPostData {
  slug: string
  publishedAt: Date | null
  updatedAt: Date | null
  geoTarget: string[]
}

// Prevent pre-rendering during build
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://snapbet.ai'
  const currentDate = new Date().toISOString()

  try {
    // Get all published blog posts
    const blogPosts = await prisma.blogPost.findMany({
      where: {
        isPublished: true,
        isActive: true,
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

    // Get supported countries
    const supportedCountries = getPrimarySupportedCountries()

    // Generate blog URLs
    const blogUrls: Array<{
      url: string
      lastModified: string
      changeFrequency: string
      priority: number
    }> = []

    // Add main blog pages
    blogUrls.push({
      url: `${baseUrl}/blog`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 0.7,
    })

    // Add individual blog posts
    blogPosts.forEach((post: BlogPostData) => {
      const postDate = post.updatedAt || post.publishedAt || new Date()
      
      // Main blog post URL
      blogUrls.push({
        url: `${baseUrl}/blog/${post.slug}`,
        lastModified: postDate.toISOString(),
        changeFrequency: 'monthly',
        priority: 0.6,
      })

      // Country-specific blog post URLs (if geoTarget is specified)
      if (post.geoTarget && post.geoTarget.length > 0) {
        post.geoTarget.forEach((countryCode: string) => {
          const country = supportedCountries.find(c => c.code === countryCode)
          if (country) {
            blogUrls.push({
              url: `${baseUrl}/${countryCode.toLowerCase()}/blog/${post.slug}`,
              lastModified: postDate.toISOString(),
              changeFrequency: 'monthly',
              priority: 0.6,
            })
          }
        })
      }
    })

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${blogUrls.map(page => `  <url>
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
    console.error('Error generating blog sitemap:', error)
    
    // Fallback to basic blog sitemap
    const fallbackXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/blog</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
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