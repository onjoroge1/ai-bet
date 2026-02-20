/**
 * Match slug utilities for SEO-friendly URLs.
 *
 * Slug format:  `{home-team}-vs-{away-team}-prediction`
 *   e.g.  `monaco-vs-paris-saint-germain-prediction`
 *
 * ⚠️  This file is imported by client components — do NOT import prisma or
 *     any server-only module here.  DB-backed resolution lives in
 *     `lib/match-slug-server.ts`.
 */

/* ------------------------------------------------------------------ */
/*  Pure helpers (no DB – safe for client & server)                    */
/* ------------------------------------------------------------------ */

/**
 * Normalise a team name into a URL-safe slug fragment.
 * - diacritics decomposed to ASCII (e.g. ç → c, ü → u)
 * - lowercased
 * - non-alphanumeric chars (except spaces/hyphens) stripped
 * - whitespace collapsed to single hyphens
 */
function normaliseTeamName(name: string): string {
  return name
    .normalize('NFD')                    // decompose diacritics: ç → c + combining cedilla
    .replace(/[\u0300-\u036f]/g, '')     // strip combining marks
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Build a full match slug from two team names.
 *
 * @example generateMatchSlug('AS Monaco', 'Paris Saint-Germain')
 *          // → 'as-monaco-vs-paris-saint-germain-prediction'
 */
export function generateMatchSlug(homeTeam: string, awayTeam: string): string {
  return `${normaliseTeamName(homeTeam)}-vs-${normaliseTeamName(awayTeam)}-prediction`
}

/** Return `true` when the slug is a plain numeric match ID. */
export function isNumericSlug(slug: string): boolean {
  return /^\d+$/.test(slug)
}

/**
 * Strip the `-prediction` suffix (if present) and then parse team name
 * fragments from the slug.
 * Returns `null` when the slug does not contain the `-vs-` separator.
 */
export function parseSlugTeams(slug: string): { homeSlug: string; awaySlug: string } | null {
  // Remove trailing `-prediction` suffix if present
  const cleaned = slug.replace(/-prediction$/, '')

  const idx = cleaned.indexOf('-vs-')
  if (idx === -1) return null

  return {
    homeSlug: cleaned.slice(0, idx),
    awaySlug: cleaned.slice(idx + 4), // length of '-vs-' = 4
  }
}
