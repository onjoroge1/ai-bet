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

export function makeTeamSlug(name: string, externalTeamId: string): string {
  const base = slugify(name)
  const id = String(externalTeamId).trim()
  if (!id) return base
  return base ? `${base}-${id}` : id
}

/**
 * Extract the externalTeamId from a slug. Slugs always end with the
 * external ID, which is alphanumeric (typically all digits). We split
 * on the LAST hyphen to extract it.
 */
export function parseTeamSlug(slug: string): { baseSlug: string; externalTeamId: string } | null {
  if (!slug) return null
  const idx = slug.lastIndexOf('-')
  if (idx === -1 || idx === slug.length - 1) {
    // No hyphen, or trailing hyphen — treat the whole thing as the id
    return { baseSlug: '', externalTeamId: slug }
  }
  const baseSlug = slug.slice(0, idx)
  const externalTeamId = slug.slice(idx + 1)
  if (!externalTeamId) return null
  return { baseSlug, externalTeamId }
}
