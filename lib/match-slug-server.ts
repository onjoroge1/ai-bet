/**
 * Server-only match slug resolver.
 *
 * This file imports prisma and MUST only be used in server components,
 * API routes, or other server-side code.  Client components should
 * import from `lib/match-slug.ts` instead.
 */

import prisma from '@/lib/db'
import { isNumericSlug, parseSlugTeams } from '@/lib/match-slug'

/**
 * Resolve a URL slug to a numeric `matchId`.
 *
 * 1. If the slug is purely numeric it is returned as-is (backward compat).
 * 2. Otherwise we parse team names and search MarketMatch
 *    for the most recent match between those teams.
 *
 * Returns `null` when no match can be found.
 */
export async function resolveSlugToMatchId(slug: string): Promise<string | null> {
  // Fast-path: numeric IDs
  if (isNumericSlug(slug)) return slug

  const parsed = parseSlugTeams(slug)
  if (!parsed) return null

  const { homeSlug, awaySlug } = parsed

  // Convert slug fragments to SQL ILIKE patterns:
  //   `paris-saint-germain`  →  `%paris%saint%germain%`
  const homeLike = `%${homeSlug.split('-').join('%')}%`
  const awayLike = `%${awaySlug.split('-').join('%')}%`

  // 1. Try Prisma case-insensitive contains (fast, works for ASCII names)
  const match = await prisma.marketMatch.findFirst({
    where: {
      homeTeam: { contains: homeSlug.split('-').join(' '), mode: 'insensitive' },
      awayTeam: { contains: awaySlug.split('-').join(' '), mode: 'insensitive' },
    },
    orderBy: [{ kickoffDate: 'desc' }],
    select: { matchId: true },
  })

  if (match) return match.matchId

  // 2. Fallback: accent-insensitive raw query using unaccent() + ILIKE
  //    Handles diacritics e.g. "Fenerbahçe" matches slug "fenerbahce"
  try {
    const rawMatches = await prisma.$queryRaw<{ matchId: string }[]>`
      SELECT "matchId"
      FROM "MarketMatch"
      WHERE unaccent("homeTeam") ILIKE unaccent(${homeLike})
        AND unaccent("awayTeam") ILIKE unaccent(${awayLike})
      ORDER BY "kickoffDate" DESC
      LIMIT 1
    `
    if (rawMatches.length > 0) return rawMatches[0].matchId
  } catch {
    // unaccent may not be available; try plain ILIKE as last resort
    try {
      const rawMatches = await prisma.$queryRaw<{ matchId: string }[]>`
        SELECT "matchId"
        FROM "MarketMatch"
        WHERE "homeTeam" ILIKE ${homeLike}
          AND "awayTeam" ILIKE ${awayLike}
        ORDER BY "kickoffDate" DESC
        LIMIT 1
      `
      if (rawMatches.length > 0) return rawMatches[0].matchId
    } catch {
      // Swallow — return null below
    }
  }

  return null
}

