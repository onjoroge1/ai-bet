/**
 * Session Cache Utility
 * 
 * Provides caching layer for NextAuth sessions to prevent rate limiting
 * and improve performance. Sessions are cached for 5 seconds to prevent
 * duplicate API calls while still maintaining freshness.
 */

import { cacheManager } from '@/lib/cache-manager'
import { logger } from '@/lib/logger'

const SESSION_CACHE_PREFIX = 'auth'
const SESSION_CACHE_TTL = 5 // 5 seconds - short enough to be fresh, long enough to prevent duplicates

/**
 * Get cached session data by session token
 * 
 * @param sessionToken - The NextAuth session token from cookie
 * @returns Cached session data or null if not found/expired
 */
export async function getCachedSession(sessionToken: string | null | undefined) {
  if (!sessionToken) {
    return null
  }
  
  try {
    const cacheKey = `session:${sessionToken}`
    const cached = await cacheManager.get(cacheKey, {
      prefix: SESSION_CACHE_PREFIX,
      ttl: SESSION_CACHE_TTL,
    })
    
    if (cached) {
      logger.debug('Session cache hit', {
        tags: ['auth', 'session-cache', 'hit'],
        data: {
          sessionToken: sessionToken.substring(0, 20) + '...',
        },
      })
    }
    
    return cached
  } catch (error) {
    logger.warn('Error getting cached session', {
      tags: ['auth', 'session-cache', 'error'],
      error: error instanceof Error ? error : undefined,
    })
    return null
  }
}

/**
 * Set cached session data
 * 
 * @param sessionToken - The NextAuth session token from cookie
 * @param sessionData - The session data to cache
 * @returns True if cached successfully, false otherwise
 */
export async function setCachedSession(
  sessionToken: string | null | undefined,
  sessionData: any
): Promise<boolean> {
  if (!sessionToken || !sessionData?.user) {
    return false
  }
  
  try {
    const cacheKey = `session:${sessionToken}`
    const success = await cacheManager.set(cacheKey, sessionData, {
      prefix: SESSION_CACHE_PREFIX,
      ttl: SESSION_CACHE_TTL,
    })
    
    if (success) {
      logger.debug('Session cache set', {
        tags: ['auth', 'session-cache', 'set'],
        data: {
          sessionToken: sessionToken.substring(0, 20) + '...',
          userId: sessionData.user.id,
        },
      })
    }
    
    return success
  } catch (error) {
    logger.warn('Error setting cached session', {
      tags: ['auth', 'session-cache', 'error'],
      error: error instanceof Error ? error : undefined,
    })
    return false
  }
}

/**
 * Clear cached session data (for logout)
 * 
 * @param sessionToken - The NextAuth session token to clear
 * @returns True if cleared successfully, false otherwise
 */
export async function clearCachedSession(
  sessionToken: string | null | undefined
): Promise<boolean> {
  if (!sessionToken) {
    return false
  }
  
  try {
    const cacheKey = `session:${sessionToken}`
    const success = await cacheManager.delete(cacheKey, {
      prefix: SESSION_CACHE_PREFIX,
    })
    
    if (success) {
      logger.info('Session cache cleared', {
        tags: ['auth', 'session-cache', 'clear'],
        data: {
          sessionToken: sessionToken.substring(0, 20) + '...',
        },
      })
    }
    
    return success
  } catch (error) {
    logger.warn('Error clearing cached session', {
      tags: ['auth', 'session-cache', 'error'],
      error: error instanceof Error ? error : undefined,
    })
    return false
  }
}

/**
 * Get session token from request cookies
 * Handles both development and production cookie names
 * 
 * @param cookies - Request cookies object
 * @returns Session token or null
 */
export function getSessionTokenFromCookies(cookies: {
  get: (name: string) => { value: string } | undefined
}): string | null {
  // Production uses __Secure-next-auth.session-token
  // Development uses next-auth.session-token
  const productionToken = cookies.get('__Secure-next-auth.session-token')?.value
  const devToken = cookies.get('next-auth.session-token')?.value
  
  return productionToken || devToken || null
}

