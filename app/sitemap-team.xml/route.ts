import { normalizeBaseUrl, buildSitemapUrl } from '@/lib/sitemap-helpers'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * /sitemap-team.xml — every live /team/[slug]/predictions page.
 *
 * Drives Google crawl freshness for team pages. lastmod tracks
 * TeamStats.lastRolledAt (the nightly rollup) so crawlers know when
 * stats changed.
 */
export async function GET() {
  const baseUrl = normalizeBaseUrl()
  const now = new Date().toISOString()

  try {
    const teams = await prisma.teamStats.findMany({
      where: { isActive: true },
      select: { slug: true, lastRolledAt: true, hasUpcoming: true },
      orderBy: { hasUpcoming: 'desc' },
    })

    const entries = teams.map(t => {
      const lastmod = t.lastRolledAt.toISOString()
      return `  <url>
    <loc>${buildSitemapUrl(baseUrl, `/team/${t.slug}/predictions`)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>${t.hasUpcoming ? 0.7 : 0.5}</priority>
  </url>`
    })

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>`

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    })
  } catch (error) {
    console.error('Error generating team sitemap:', error)
    const fallbackXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${baseUrl}/</loc><lastmod>${now}</lastmod></url>
</urlset>`
    return new Response(fallbackXml, {
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    })
  }
}
