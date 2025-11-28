/**
 * Clear Session Cache API Route
 * 
 * Clears Redis session cache before NextAuth destroys the session token.
 * This ensures no stale session data remains in cache after logout.
 * 
 * This route is separate from NextAuth's signout endpoint to avoid conflicts.
 * Called by logout button BEFORE NextAuth's signOut() to ensure
 * cache is cleared before the session token is destroyed.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { clearCachedSession, getSessionTokenFromCookies } from '@/lib/session-cache'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    // Get session token from cookie BEFORE it's destroyed
    const sessionToken = getSessionTokenFromCookies(request.cookies)
    
    // Get token data to identify user (for logging)
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
      secureCookie: process.env.NODE_ENV === 'production',
    })
    
    logger.info('Clear Session Cache API - Clearing Redis cache', {
      tags: ['auth', 'logout', 'cache'],
      data: {
        userId: token?.id,
        email: token?.email,
        hasSessionToken: !!sessionToken,
      },
    })
    
    // Clear Redis cache for this session token
    if (sessionToken) {
      const cleared = await clearCachedSession(sessionToken)
      
      if (cleared) {
        logger.info('Clear Session Cache API - Session cache cleared successfully', {
          tags: ['auth', 'logout', 'cache'],
          data: {
            userId: token?.id,
            sessionToken: sessionToken.substring(0, 20) + '...',
          },
        })
      } else {
        logger.warn('Clear Session Cache API - Failed to clear session cache', {
          tags: ['auth', 'logout', 'cache', 'warning'],
          data: {
            userId: token?.id,
          },
        })
      }
    } else {
      logger.warn('Clear Session Cache API - No session token found to clear', {
        tags: ['auth', 'logout', 'cache', 'warning'],
      })
    }
    
    // Return success
    // Note: NextAuth's signOut() will handle the actual session token destruction
    // This route only clears the Redis cache
    return NextResponse.json({ 
      success: true,
      cacheCleared: !!sessionToken,
    })
  } catch (error) {
    logger.error('Clear Session Cache API - Error clearing session cache', {
      tags: ['auth', 'logout', 'cache', 'error'],
      error: error instanceof Error ? error : undefined,
    })
    
    // Don't fail logout if cache clearing fails
    // Session token destruction is more important
    return NextResponse.json({ 
      success: true,
      cacheCleared: false,
      error: 'Cache clear failed but logout can continue',
    }, { status: 200 })
  }
}

