/**
 * Helpers for constructing /signup and /signin URLs that carry the two
 * key attribution + UX parameters consistently:
 *   - `source`      → stored on User.signupSource at signup (admin attribution)
 *   - `callbackUrl` → page to land on after auth (NextAuth-compatible)
 *
 * Centralised because, per the 2026-05-15 friction audit, 83 % of signups
 * arrived without a source param and ~77 % of users never returned after
 * landing on /dashboard. Fixing both is the bulk of Tier 1.
 */

/** Build a /signup URL with source attribution + optional callbackUrl. */
export function buildSignupUrl(opts: {
  source: string
  callbackUrl?: string | null
}): string {
  const params = new URLSearchParams()
  if (opts.source) params.set('source', opts.source)
  if (opts.callbackUrl) {
    const safe = sanitizeCallbackUrl(opts.callbackUrl)
    if (safe) params.set('callbackUrl', safe)
  }
  const qs = params.toString()
  return qs ? `/signup?${qs}` : '/signup'
}

/** Same shape as buildSignupUrl but for /signin (sign-in path). */
export function buildSigninUrl(opts: {
  source?: string | null
  callbackUrl?: string | null
}): string {
  const params = new URLSearchParams()
  if (opts.source) params.set('source', opts.source)
  if (opts.callbackUrl) {
    const safe = sanitizeCallbackUrl(opts.callbackUrl)
    if (safe) params.set('callbackUrl', safe)
  }
  const qs = params.toString()
  return qs ? `/signin?${qs}` : '/signin'
}

/**
 * Validate a callbackUrl is safe to redirect to. Returns the URL if it's a
 * relative internal path, or null otherwise.
 *
 * Rules:
 *   - must start with `/`
 *   - must NOT start with `//` (protocol-relative)
 *   - must NOT be an API route (no point landing users on a JSON endpoint)
 *   - must NOT contain newlines / control chars
 */
export function sanitizeCallbackUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (typeof url !== 'string') return null
  if (url.length > 512) return null
  // Strip leading whitespace, reject control chars
  const trimmed = url.trim()
  if (!trimmed.startsWith('/')) return null
  if (trimmed.startsWith('//')) return null            // protocol-relative
  if (trimmed.startsWith('/api/')) return null         // never land on JSON endpoint
  if (/[\r\n\t]/.test(trimmed)) return null
  return trimmed
}

/** Pull `callbackUrl` out of a Next.js searchParams-style object safely. */
export function readCallbackUrl(searchParams: { get(name: string): string | null } | URLSearchParams | null | undefined, fallback = '/dashboard'): string {
  if (!searchParams) return fallback
  const raw = searchParams.get('callbackUrl')
  const safe = sanitizeCallbackUrl(raw)
  return safe ?? fallback
}
