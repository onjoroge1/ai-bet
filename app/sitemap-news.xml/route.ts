import { NextRequest } from 'next/server'
import { normalizeBaseUrl, buildSitemapUrl } from '@/lib/sitemap-helpers'
import prisma from '@/lib/db'

// Prevent pre-rendering during build
export const dynamic = 'force-dynamic'

// Define proper types for blog post articles
interface BlogPostArticle {
  title: string
  slug: string
  publishedAt: Date
  updatedAt: Date
  category: string
  tags: string[]
  author: string
}

export async function GET(request: NextRequest) {
  // Normalize baseUrl to ensure no trailing slash (prevents double slashes)
  const baseUrl = normalizeBaseUrl()
  const currentDate = new Date().toISOString()

  try {
    // Google News sitemap requirement: Only articles from last 48 hours
    // This sitemap is for Google News eligibility (Top Stories, News surfaces)
    // Note: Match predictions may not qualify as "news" - this is for compliance
    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2) // 48 hours = 2 days

    const newsArticles = await prisma.blogPost.findMany({
      where: {
        isPublished: true,
        isActive: true,
        publishedAt: {
          gte: twoDaysAgo
        }
      },
      select: {
        title: true,
        slug: true,
        publishedAt: true,
        updatedAt: true,
        category: true,
        tags: true,
        author: true
      },
      orderBy: {
        publishedAt: 'desc'
      },
      take: 1000 // Google News limit (up to 1,000 URLs per news sitemap)
    })

    // Generate XML with proper Google News sitemap format
    // Note: Only includes articles from last 48 hours (Google News requirement)
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${newsArticles.map((article: BlogPostArticle) => {
      // Escape XML entities in title
      const escapedTitle = article.title.replace(/[<>&'"]/g, (match: string) => {
        const entities: { [key: string]: string } = {
          '<': '&lt;',
          '>': '&gt;',
          '&': '&amp;',
          "'": '&apos;',
          '"': '&quot;'
        }
        return entities[match]
      })
      
      // Use most recent date (updatedAt if available and newer, otherwise publishedAt)
      const publishedDate = new Date(article.publishedAt)
      const updatedDate = new Date(article.updatedAt)
      const lastModified = updatedDate > publishedDate 
        ? updatedDate.toISOString() 
        : publishedDate.toISOString()
      
      const articleUrl = buildSitemapUrl(baseUrl, `/blog/${article.slug}`)
      return `  <url>
    <loc>${articleUrl}</loc>
    <lastmod>${lastModified}</lastmod>
    <news:news>
      <news:publication>
        <news:name>SnapBet AI</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${new Date(article.publishedAt).toISOString()}</news:publication_date>
      <news:title>${escapedTitle}</news:title>
    </news:news>
  </url>`
    }).join('\n')}
</urlset>`

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=1800, s-maxage=1800', // Cache for 30 minutes
      },
    })
  } catch (error) {
    console.error('Error generating news sitemap:', error)
    
    // Fallback to empty news sitemap
    const fallbackXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
</urlset>`

    return new Response(fallbackXml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=1800, s-maxage=1800',
      },
    })
  }
} 