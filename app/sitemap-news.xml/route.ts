import { NextRequest } from 'next/server'
import prisma from '@/lib/db'

// Prevent pre-rendering during build
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://snapbet.ai'
  const currentDate = new Date().toISOString()

  try {
    // Get published blog posts from the last 2 days (Google News requirement)
    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

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
      take: 1000 // Google News limit
    })

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${newsArticles.map((article: any) => `  <url>
    <loc>${baseUrl}/blog/${article.slug}</loc>
    <news:news>
      <news:publication>
        <news:name>SnapBet AI</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${new Date(article.publishedAt).toISOString()}</news:publication_date>
      <news:title>${article.title.replace(/[<>&'"]/g, (match: string) => {
        const entities: { [key: string]: string } = {
          '<': '&lt;',
          '>': '&gt;',
          '&': '&amp;',
          "'": '&apos;',
          '"': '&quot;'
        }
        return entities[match]
      })}</news:title>
      <news:keywords>${(article.tags || []).join(', ')}</news:keywords>
      <news:stock_tickers>${article.category}</news:stock_tickers>
    </news:news>
  </url>`).join('\n')}
</urlset>`

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml',
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
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=1800, s-maxage=1800',
      },
    })
  }
} 