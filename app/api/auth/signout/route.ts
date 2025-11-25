/**
 * Custom Signout API Route
 * 
 * Clears Redis session cache before NextAuth destroys the session token.
 * This ensures no stale session data remains in cache after logout.
 * 
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
    
    logger.info('Signout API - Clearing session cache', {
      tags: ['auth', 'signout', 'cache'],
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
        logger.info('Signout API - Session cache cleared successfully', {
          tags: ['auth', 'signout', 'cache'],
          data: {
            userId: token?.id,
            sessionToken: sessionToken.substring(0, 20) + '...',
          },
        })
      } else {
        logger.warn('Signout API - Failed to clear session cache', {
          tags: ['auth', 'signout', 'cache', 'warning'],
          data: {
            userId: token?.id,
          },
        })
      }
    } else {
      logger.warn('Signout API - No session token found to clear', {
        tags: ['auth', 'signout', 'cache', 'warning'],
      })
    }
    
    // Return success
    // Note: NextAuth's signOut() will handle the actual session token destruction
    // This route only clears the cache
    return NextResponse.json({ 
      success: true,
      cacheCleared: !!sessionToken,
    })
  } catch (error) {
    logger.error('Signout API - Error clearing session cache', {
      tags: ['auth', 'signout', 'cache', 'error'],
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

