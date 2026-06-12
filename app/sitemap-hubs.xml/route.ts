import { normalizeBaseUrl, buildSitemapUrl } from '@/lib/sitemap-helpers'
import { LEAGUES } from '@/lib/soccer-hubs/leagues'
import { SPORTS as MULTISPORTS } from '@/lib/multisport-hubs/data'
import { GUIDES } from '@/lib/guides/registry'
import { GROUPS, ALL_TEAMS } from '@/lib/world-cup/tournament'

export const dynamic = 'force-dynamic'

/**
 * /sitemap-hubs.xml — SEO hub surfaces shipped in Chunk C.
 *
 * Includes:
 *   - /soccer/today, /soccer/tomorrow (daily hubs)
 *   - /soccer/[league] for the hardcoded LEAGUES allowlist
 *   - /guides (index)
 *   - /guides/[slug] for each entry in the GUIDES registry
 *   - /performance, /methodology, /about, /responsible-betting, /contact
 *     (trust surfaces from Chunk A — listed here so they land in the
 *      sitemap.xml index without spamming the main sitemap)
 *
 * Cache: 1 hour at the edge.
 */
export async function GET() {
  const baseUrl = normalizeBaseUrl()
  const now = new Date().toISOString()

  const entries: Array<{ url: string; lastmod: string; changefreq: string; priority: number }> = []

  // Soccer index + daily hubs — change frequently
  entries.push({ url: buildSitemapUrl(baseUrl, '/soccer'), lastmod: now, changefreq: 'daily', priority: 0.85 })
  entries.push({ url: buildSitemapUrl(baseUrl, '/soccer/today'), lastmod: now, changefreq: 'hourly', priority: 0.9 })
  entries.push({ url: buildSitemapUrl(baseUrl, '/soccer/tomorrow'), lastmod: now, changefreq: 'hourly', priority: 0.8 })

  // League hubs
  for (const l of LEAGUES) {
    entries.push({
      url: buildSitemapUrl(baseUrl, `/soccer/${l.slug}`),
      lastmod: now,
      changefreq: 'daily',
      priority: 0.8,
    })
  }

  // Guides
  entries.push({ url: buildSitemapUrl(baseUrl, '/guides'), lastmod: now, changefreq: 'weekly', priority: 0.7 })
  for (const g of GUIDES) {
    entries.push({
      url: buildSitemapUrl(baseUrl, `/guides/${g.slug}`),
      lastmod: new Date(g.updatedAt).toISOString(),
      changefreq: 'monthly',
      priority: 0.6,
    })
  }

  // Trust surfaces (Chunk A) — these aren't in any other segmented sitemap
  for (const path of ['/performance', '/methodology', '/about', '/responsible-betting', '/contact']) {
    entries.push({ url: buildSitemapUrl(baseUrl, path), lastmod: now, changefreq: 'weekly', priority: 0.6 })
  }

  // /premium product/teaser page + /team index
  entries.push({ url: buildSitemapUrl(baseUrl, '/premium'), lastmod: now, changefreq: 'daily', priority: 0.85 })
  entries.push({ url: buildSitemapUrl(baseUrl, '/team'), lastmod: now, changefreq: 'daily', priority: 0.7 })

  // World Cup 2026 hub family
  entries.push({ url: buildSitemapUrl(baseUrl, '/world-cup'), lastmod: now, changefreq: 'daily', priority: 0.85 })
  for (const g of GROUPS) {
    entries.push({
      url: buildSitemapUrl(baseUrl, `/world-cup/group/${g.letter.toLowerCase()}`),
      lastmod: now,
      changefreq: 'weekly',
      priority: 0.7,
    })
  }
  for (const t of ALL_TEAMS) {
    entries.push({
      url: buildSitemapUrl(baseUrl, `/world-cup/team/${t.slug}`),
      lastmod: now,
      changefreq: 'weekly',
      priority: 0.6,
    })
  }

  // Multisport hubs (Phase 2)
  for (const sport of MULTISPORTS) {
    entries.push({ url: buildSitemapUrl(baseUrl, `/${sport.slug}`), lastmod: now, changefreq: 'daily', priority: 0.85 })
    entries.push({ url: buildSitemapUrl(baseUrl, `/${sport.slug}/today`), lastmod: now, changefreq: 'hourly', priority: 0.9 })
    entries.push({ url: buildSitemapUrl(baseUrl, `/${sport.slug}/tomorrow`), lastmod: now, changefreq: 'hourly', priority: 0.8 })
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(e => `  <url>
    <loc>${e.url}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`)
  .join('\n')}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
