/**
 * Slug helpers for team pages.
 *
 * Identity: {slugified_name}-{externalTeamId}. The trailing external ID
 * guarantees uniqueness across leagues with overlapping team names.
 *
 * Example:
 *   makeTeamSlug('Arsenal FC', '33')   → 'arsenal-fc-33'
 *   parseTeamSlug('arsenal-fc-33')     → { externalTeamId: '33', baseSlug: 'arsenal-fc' }
 */

/** Lowercase, strip diacritics, collapse non-alphanum into single dashes. */
export function slugify(input: string): string {
  if (!input) return ''
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')   // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function makeTeamSlug(name: string, externalTeamId: string, sport?: string): string {
  const base = slugify(name)
  const idRaw = String(externalTeamId).trim()
  // Sport prefix for non-soccer keeps slugs distinct across sports.
  // 'basketball_nba' → 'nba', 'icehockey_nhl' → 'nhl', etc.
  const prefix = sportSlugPrefix(sport)
  const withPrefix = prefix ? `${prefix}-${base}` : base
  if (!idRaw) return withPrefix
  // If externalTeamId IS the name (because upstream IDs aren't populated and
  // we fall back to using team-name as key), suppress the redundant suffix.
  if (idRaw === name) return withPrefix
  // External IDs may be numeric (preferred), or other free text — slugify
  // for URL safety so slugs like `arsenal-fc-33` stay clean.
  const idPart = /^[0-9a-zA-Z]+$/.test(idRaw) ? idRaw : slugify(idRaw)
  if (!idPart) return withPrefix
  return withPrefix ? `${withPrefix}-${idPart}` : idPart
}

/** Convert upstream sport key to short slug prefix. Empty string for soccer
 *  so existing slugs (`arsenal`, `celta-vigo`) keep working unchanged. */
export function sportSlugPrefix(sport?: string): string {
  if (!sport || sport === 'soccer') return ''
  if (sport === 'basketball_nba') return 'nba'
  if (sport === 'icehockey_nhl') return 'nhl'
  if (sport === 'basketball_ncaab') return 'ncaab'
  return slugify(sport)
}

/**
 * Extract the externalTeamId from a slug. Slugs always end with the
 * external ID, which is alphanumeric (typically all digits). We split
 * on the LAST hyphen to extract it.
 */
export function parseTeamSlug(slug: string): { baseSlug: string; externalTeamId: string | null } | null {
  if (!slug) return null
  // For name-only slugs (no external ID suffix), the whole thing is the
  // base — no parse-back to ID is possible. Caller uses baseSlug to query.
  const idx = slug.lastIndexOf('-')
  if (idx === -1 || idx === slug.length - 1) {
    return { baseSlug: slug, externalTeamId: null }
  }
  // Heuristic: if the trailing segment is purely alphanumeric (typical
  // external ID shape from upstream APIs), treat it as an ID. Otherwise
  // the whole slug is just slugify(name) and there is no ID suffix.
  const trailing = slug.slice(idx + 1)
  if (!/^[0-9a-zA-Z]+$/.test(trailing) || /[-]/.test(trailing)) {
    return { baseSlug: slug, externalTeamId: null }
  }
  // Numeric-only trailing or short alphanumeric = treated as ID
  if (/^\d+$/.test(trailing) || trailing.length <= 8) {
    return { baseSlug: slug.slice(0, idx), externalTeamId: trailing }
  }
  // Long alphanumeric trailing — ambiguous, default to name-only
  return { baseSlug: slug, externalTeamId: null }
}
