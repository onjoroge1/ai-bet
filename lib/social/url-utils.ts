import { logger } from '@/lib/logger'

/**
 * Centralized URL utility for social media automation
 * Ensures production URLs are used and prevents localhost in production
 */

/**
 * Default production URL - used as fallback
 */
const DEFAULT_PRODUCTION_URL = 'https://snapbet.ai'

/**
 * Get the production base URL with proper environment handling
 * 
 * Priority:
 * 1. NEXT_PUBLIC_APP_URL (explicit production URL)
 * 2. NEXTAUTH_URL (if not localhost in production)
 * 3. VERCEL_URL (auto-provided by Vercel)
 * 4. Default production URL (in production)
 * 5. localhost (development only)
 * 
 * @returns Normalized base URL without trailing slash
 */
export function getProductionBaseUrl(): string {
  // Priority 1: Explicit production URL env var
  if (process.env.NEXT_PUBLIC_APP_URL) {
    const url = process.env.NEXT_PUBLIC_APP_URL.trim()
    if (url) {
      const normalized = normalizeUrl(url)
      if (isValidProductionUrl(normalized)) {
        return normalized
      }
    }
  }

  // Priority 2: NEXTAUTH_URL (but validate it's not localhost in production)
  if (process.env.NEXTAUTH_URL) {
    const url = process.env.NEXTAUTH_URL.trim()
    if (url) {
      const normalized = normalizeUrl(url)
      
      // In production, reject localhost
      if (process.env.NODE_ENV === 'production' && isLocalhost(normalized)) {
        logger.warn('⚠️ NEXTAUTH_URL contains localhost in production! Using fallback.', {
          tags: ['social', 'url', 'warning'],
          data: { url: normalized, environment: process.env.NODE_ENV },
        })
        // Fall through to next option
      } else if (isValidProductionUrl(normalized)) {
        return normalized
      }
    }
  }

  // Priority 3: VERCEL_URL (Vercel automatically provides this)
  if (process.env.VERCEL_URL) {
    const vercelUrl = process.env.VERCEL_URL.trim()
    if (vercelUrl) {
      // VERCEL_URL doesn't include protocol, so add it
      const url = vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`
      return normalizeUrl(url)
    }
  }

  // Priority 4: Production fallback
  if (process.env.NODE_ENV === 'production') {
    logger.warn('Using default production URL fallback', {
      tags: ['social', 'url', 'warning'],
      data: { defaultUrl: DEFAULT_PRODUCTION_URL },
    })
    return DEFAULT_PRODUCTION_URL
  }

  // Development fallback only
  logger.warn('Using localhost fallback for appUrl in development mode', {
    tags: ['social', 'url', 'warning'],
    data: { environment: process.env.NODE_ENV },
  })
  return 'http://localhost:3000'
}

/**
 * Normalize URL by removing trailing slashes and ensuring proper format
 */
function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '').trim()
}

/**
 * Check if URL is localhost
 */
function isLocalhost(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1' || urlObj.hostname.startsWith('localhost')
  } catch {
    return url.includes('localhost') || url.includes('127.0.0.1')
  }
}

/**
 * Validate that URL is a valid production URL
 */
function isValidProductionUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    // Must be http or https
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return false
    }
    // Must have a hostname
    if (!urlObj.hostname || urlObj.hostname.length === 0) {
      return false
    }
    // In production, must not be localhost
    if (process.env.NODE_ENV === 'production' && isLocalhost(url)) {
      return false
    }
    return true
  } catch {
    return false
  }
}

/**
 * Build a full URL from base URL and path
 * Prevents double slashes and ensures proper formatting
 * 
 * @param path - Path to append (with or without leading slash)
 * @param baseUrl - Optional base URL (uses getProductionBaseUrl() if not provided)
 * @returns Full URL without double slashes
 */
export function buildSocialUrl(path: string, baseUrl?: string): string {
  const base = baseUrl || getProductionBaseUrl()
  const normalizedBase = normalizeUrl(base)
  
  // Normalize path - ensure it starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  
  // Combine and ensure no double slashes (except after protocol)
  const fullUrl = `${normalizedBase}${normalizedPath}`
  
  // Replace multiple slashes with single slash (but preserve http:// or https://)
  return fullUrl.replace(/([^:]\/)\/+/g, '$1')
}

