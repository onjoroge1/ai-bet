/**
 * Sitemap Helper Functions
 * 
 * Utilities for generating sitemaps with consistent URL formatting
 */

/**
 * Normalizes baseUrl to ensure no trailing slash
 * Prevents double slashes in generated URLs
 */
export function normalizeBaseUrl(url?: string): string {
  const defaultUrl = 'https://www.snapbet.bet'
  const baseUrl = url || process.env.NEXTAUTH_URL || defaultUrl
  return baseUrl.replace(/\/$/, '') // Remove trailing slash if present
}

/**
 * Ensures a URL path starts with a single slash
 * Combines baseUrl and path safely
 */
export function buildSitemapUrl(baseUrl: string, path: string): string {
  const normalizedBase = normalizeBaseUrl(baseUrl)
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizedBase}${normalizedPath}`
}

