/**
 * Custom Session API Route with Redis Caching
 * 
 * This route wraps NextAuth's session logic with Redis caching to:
 * - Prevent rate limiting from concurrent session checks
 * - Improve performance (cached responses in <10ms vs 50-100ms)
 * - Share session state across multiple components
 * 
 * This route takes precedence over NextAuth's built-in /api/auth/session
 * because it's more specific than the [...nextauth] catch-all route.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { 
  getCachedSession, 
  setCachedSession, 
  getSessionTokenFromCookies 
} from '@/lib/session-cache'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Get session token from cookies
    const sessionToken = getSessionTokenFromCookies(request.cookies)
    
    // ✅ PHASE 1: Check cache first (prevents duplicate calls)
    if (sessionToken) {
      const cached = await getCachedSession(sessionToken)
      
      if (cached) {
        const responseTime = Date.now() - startTime
        const cachedSession = cached as any // Type assertion for cached session
        logger.debug('Session API - Cache hit', {
          tags: ['auth', 'session-api', 'cache-hit'],
          data: {
            responseTime,
            userId: cachedSession?.user?.id,
            email: cachedSession?.user?.email,
          },
        })
        
        return NextResponse.json(cached, {
          headers: {
            'X-Session-Source': 'cache',
            'X-Response-Time': `${responseTime}ms`,
          },
        })
      }
    }
    
    // ✅ Cache miss - Generate session using NextAuth
    const session = await getServerSession(authOptions)
    const responseTime = Date.now() - startTime
    
    // ✅ PHASE 1: Cache the session if valid
    if (sessionToken && session?.user) {
      // Cache in background (don't block response)
      setCachedSession(sessionToken, session).catch((error) => {
        logger.warn('Failed to cache session (non-critical)', {
          tags: ['auth', 'session-api', 'cache-error'],
          error: error instanceof Error ? error : undefined,
        })
        // Don't throw - caching failure shouldn't break session
      })
    }
    
    logger.debug('Session API - Cache miss, generated session', {
      tags: ['auth', 'session-api', 'cache-miss'],
      data: {
        responseTime,
        userId: session?.user?.id,
        hasSession: !!session?.user,
      },
    })
    
    return NextResponse.json(session, {
      headers: {
        'X-Session-Source': 'nextauth',
        'X-Response-Time': `${responseTime}ms`,
      },
    })
  } catch (error) {
    const responseTime = Date.now() - startTime
    
    logger.error('Session API - Error', {
      tags: ['auth', 'session-api', 'error'],
      error: error instanceof Error ? error : undefined,
      data: { responseTime },
    })
    
    // Return empty session on error (NextAuth behavior)
    return NextResponse.json({}, {
      status: 200, // NextAuth returns 200 even when no session
      headers: {
        'X-Session-Source': 'error',
        'X-Response-Time': `${responseTime}ms`,
      },
    })
  }
}

