/**
 * Session Request Manager
 * 
 * Deduplicates /api/auth/session requests from multiple components to prevent:
 * - Rate limiting issues (429 errors)
 * - Multiple simultaneous duplicate requests
 * - Unnecessary network overhead
 * 
 * Usage:
 * - Critical paths (dashboard layout, route protection): Use getSession()
 * - UI components (navigation, headers): Use useSession() hook (has built-in deduplication)
 * 
 * Architecture:
 * - Only one request in flight at a time
 * - Caches response for 5 seconds (matches Redis cache TTL)
 * - All components calling getSession() share the same request/cache
 */

import { logger } from '@/lib/logger'

let sessionPromise: Promise<any> | null = null
let sessionCache: any = null
let cacheExpiry = 0
const CACHE_TTL = 5000 // 5 seconds - matches Redis cache TTL in lib/session-cache.ts

/**
 * Get session data with request deduplication and caching
 * 
 * Multiple components can call this simultaneously, but only ONE request
 * will be made to /api/auth/session. Subsequent calls within 5 seconds
 * will return cached data.
 * 
 * @returns Promise resolving to session data (NextAuth format)
 */
export async function getSession(): Promise<any> {
  // Return cached session if valid
  if (sessionCache && Date.now() < cacheExpiry) {
    logger.debug('Session Request Manager - Cache hit', {
      tags: ['auth', 'session-manager', 'cache-hit'],
      data: {
        cacheAge: Date.now() - (cacheExpiry - CACHE_TTL),
        hasUser: !!sessionCache?.user,
      },
    })
    return sessionCache
  }

  // If request already in flight, reuse it (deduplication)
  if (sessionPromise) {
    logger.debug('Session Request Manager - Request in flight, reusing', {
      tags: ['auth', 'session-manager', 'deduplication'],
    })
    return sessionPromise
  }

  // Create new request
  logger.debug('Session Request Manager - Creating new request', {
    tags: ['auth', 'session-manager', 'new-request'],
  })

  sessionPromise = fetch('/api/auth/session', {
    credentials: 'include',
  } as RequestInit)
    .then(res => {
      if (!res.ok) {
        // Don't cache error responses
        throw new Error(`Session check failed: ${res.status}`)
      }
      return res.json()
    })
    .then(session => {
      // Cache the session
      sessionCache = session
      cacheExpiry = Date.now() + CACHE_TTL
      
      logger.debug('Session Request Manager - Request complete, cached', {
        tags: ['auth', 'session-manager', 'cached'],
        data: {
          hasUser: !!(session as any)?.user,
          userId: (session as any)?.user?.id,
        },
      })
      
      // Clear promise so next request can create new one
      sessionPromise = null
      
      return session
    })
    .catch(error => {
      logger.error('Session Request Manager - Request failed', {
        tags: ['auth', 'session-manager', 'error'],
        error: error instanceof Error ? error : undefined,
      })
      
      // Clear promise on error so retry is possible
      sessionPromise = null
      throw error
    })

  return sessionPromise
}

/**
 * Clear cached session (call after logout)
 * 
 * This ensures that after logout, the next session check will fetch
 * fresh data instead of returning stale cached session.
 */
export function clearSessionCache(): void {
  logger.debug('Session Request Manager - Cache cleared', {
    tags: ['auth', 'session-manager', 'cache-clear'],
  })
  
  sessionCache = null
  cacheExpiry = 0
  sessionPromise = null
}

/**
 * Get current cached session without making a request
 * 
 * Useful for checking if we have cached data without triggering a fetch
 * 
 * @returns Cached session data or null if not cached/expired
 */
export function getCachedSession(): any | null {
  if (sessionCache && Date.now() < cacheExpiry) {
    return sessionCache
  }
  return null
}

