import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { logger } from '@/lib/logger'
import { getCountryFromRequest } from "@/lib/country-pricing"
import { getCountryByCode, getPrimarySupportedCountries } from '@/lib/countries'
import { checkRateLimit } from '@/lib/security'
import { addSecurityHeaders, configureCORS } from '@/lib/security'

// Paths that don't require authentication
const publicPaths = [
  '/',
  '/signin',
  '/signup',
  '/parlays', // Public parlay generator page
  '/pricing', // Public pricing page
  '/api/auth/signin',
  '/api/auth/signup',
  '/api/auth/callback',
  '/api/auth/session',
  '/api/auth/csrf',
  '/api/auth/providers',
  '/api/auth/signout',
  '/api/auth/error',
  '/api/countries',
  '/api/health',
  '/api/predictions/live-ticker', // Public live predictions for homepage
  '/api/predictions/history', // Public predictions history
  '/api/predictions/history/stats', // Public predictions history stats
  '/api/predictions/history/export', // Public predictions history export
  '/api/parlays/preview', // Public parlay preview endpoint
  '/api/whatsapp/webhook', // WhatsApp webhook for Meta Business API
  '/api/whatsapp/send-test', // WhatsApp test endpoint for sending messages
  '/api/whatsapp/test-command', // WhatsApp test endpoint for menu commands
]

// Cron endpoints that use CRON_SECRET instead of user authentication
const cronEndpoints = [
  '/api/admin/parlays/sync-scheduled',
  '/api/admin/market/sync-scheduled',
  '/api/admin/predictions/enrich-scheduled',
  '/api/admin/predictions/sync-from-availability-scheduled',
  '/api/admin/template-blogs/scheduled',
  '/api/admin/social/twitter/scheduled',
  '/api/admin/social/twitter/post-scheduled',
]

// Paths that require admin role
const adminPaths = [
  '/admin',
  '/api/admin',
  '/api/predictions', // Keep this for prediction management (POST, PUT, DELETE) but exclude timeline
]

// Paths that require authentication but not admin role
const authenticatedPaths = [
  '/api/predictions/timeline', // Allow regular users to view predictions timeline
]

// Paths that require authentication
const protectedPaths = [
  '/dashboard',
  '/profile',
  '/settings',
]

// Rate limiting configuration
const isDevelopment = process.env.NODE_ENV === 'development'
const rateLimitConfig = {
  default: { 
    maxRequests: isDevelopment ? 10000 : 100, // 10000 requests per minute in dev, 100 in prod
    windowMs: 60000 
  },
  auth: { 
    maxRequests: isDevelopment ? 100 : 5, // 100 auth attempts per minute in dev, 5 in prod
    windowMs: 60000 
  },
  api: { 
    maxRequests: isDevelopment ? 10000 : 1000, // 10000 API calls per minute in dev, 1000 in prod
    windowMs: 60000 
  },
}

// Helper function to check if path is admin-only (excluding authenticated paths and public history endpoints)
const isAdminOnlyPath = (pathname: string) => {
  // Exclude predictions history endpoints from admin-only access
  if (pathname.startsWith('/api/predictions/history')) {
    return false
  }
  
  // Exclude live-ticker endpoint from admin-only access
  if (pathname === '/api/predictions/live-ticker') {
    return false
  }
  
  return adminPaths.some(p => pathname.startsWith(p)) && 
         !authenticatedPaths.some(p => pathname.startsWith(p))
}

// Helper function to check if path is a country-specific path
const isCountryPath = (pathname: string) => {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return false
  
  const firstSegment = segments[0].toLowerCase()
  const supportedCountries = getPrimarySupportedCountries()
  return supportedCountries.some(country => country.code.toLowerCase() === firstSegment)
}

// Helper function to get country code from pathname
const getCountryFromPath = (pathname: string): string | null => {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return null
  
  const firstSegment = segments[0].toLowerCase()
  const supportedCountries = getPrimarySupportedCountries()
  const country = supportedCountries.find(country => country.code.toLowerCase() === firstSegment)
  
  return country ? country.code : null
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const startTime = Date.now()
  
  try {
    // ✅ CRON_SECRET Authentication Check (Early Exit for Automated Sync)
    // This allows automated cron jobs to authenticate without user sessions
    const isCronEndpoint = cronEndpoints.some(endpoint => pathname.startsWith(endpoint))
    if (isCronEndpoint) {
      const authHeader = request.headers.get('authorization')
      const cronSecret = process.env.CRON_SECRET || '749daccdf93e0228b8d5c9b7210d2181ea3b9e48af1e3833473a5020bcbc9ecb'
      
      if (authHeader === `Bearer ${cronSecret}`) {
        // Valid CRON_SECRET - allow through without user authentication
        logger.info('Middleware - CRON_SECRET authenticated', {
          tags: ['middleware', 'cron', 'auth'],
          data: { pathname, authenticated: true }
        })
        
        // Create response with security headers
        const requestHeaders = new Headers(request.headers)
        const forwarded = request.headers.get('x-forwarded-for')
        const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown'
        requestHeaders.set('x-client-ip', ip)
        requestHeaders.set('x-cron-authenticated', 'true')
        
        const response = NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        })
        
        return addSecurityHeaders(response)
      } else {
        // Invalid or missing CRON_SECRET - reject
        logger.warn('Middleware - Invalid CRON_SECRET attempt', {
          tags: ['middleware', 'cron', 'auth', 'unauthorized'],
          data: { pathname, hasAuthHeader: !!authHeader }
        })
        
        const response = new NextResponse(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        )
        return addSecurityHeaders(response)
      }
    }
    
    // Get client IP for rate limiting and country detection
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown'
    
    // Rate limiting
    const rateLimitKey = `${ip}:${pathname}`
    const isApiPath = pathname.startsWith('/api/')
    const isAuthPath = pathname.includes('/auth/')
    
    // ✅ FIX: Exclude /api/auth/session from strict auth rate limiting
    // Session endpoint is read-only and cached - multiple components legitimately call it
    // Use API rate limit (1000/min) instead of auth rate limit (5/min)
    const isSessionEndpoint = pathname === '/api/auth/session'
    const shouldUseStrictAuthLimit = isAuthPath && !isSessionEndpoint
    
    const config = shouldUseStrictAuthLimit ? rateLimitConfig.auth : 
                   isApiPath ? rateLimitConfig.api : 
                   rateLimitConfig.default
    
    const rateLimit = checkRateLimit(rateLimitKey, config.maxRequests, config.windowMs)
    
    if (!rateLimit.allowed) {
      logger.warn('Rate limit exceeded', {
        tags: ['middleware', 'rate-limit'],
        data: { 
          ip, 
          pathname, 
          count: rateLimit.remaining,
          resetTime: new Date(rateLimit.resetTime).toISOString()
        }
      })
      
      return new NextResponse(
        JSON.stringify({ 
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
        }),
        { 
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString(),
            'X-RateLimit-Limit': config.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.resetTime.toString()
          }
        }
      )
    }
    
    // Get country from IP (you can use a service like ipapi.co, ipinfo.io, or similar)
    let ipCountryCode: string | undefined
    
    try {
      // For now, we'll skip IP detection to avoid rate limits and use domain/user preference
      ipCountryCode = undefined
    } catch (error) {
      logger.warn('Failed to detect country from IP', {
        tags: ['middleware', 'country-detection'],
        error: error instanceof Error ? error : undefined,
        data: { ip }
      })
      ipCountryCode = undefined
    }

    // Detect country using the enhanced function
    const detectedCountry = await getCountryFromRequest(
      request.headers.get('host') || '',
      undefined, // userCountryCode will be set by the auth context
      ipCountryCode
    )

    // Add detected country to headers for use in the application
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-detected-country', detectedCountry)
    requestHeaders.set('x-client-ip', ip)

    // Handle country-specific routing
    const countryFromPath = getCountryFromPath(pathname)
    
    if (countryFromPath) {
      // This is a country-specific path, validate the country
      const country = getCountryByCode(countryFromPath)
      if (!country || !country.isSupported) {
        logger.warn('Invalid country path accessed', {
          tags: ['middleware', 'country-routing', 'invalid-country'],
          data: { pathname, countryCode: countryFromPath, ip }
        })
        
        // Redirect to main homepage for invalid countries
        const response = NextResponse.redirect(new URL('/', request.url))
        return addSecurityHeaders(response)
      }
      
      // Add country info to headers
      requestHeaders.set('x-country-code', countryFromPath)
      requestHeaders.set('x-country-name', country.name)
      
      logger.info('Country-specific page accessed', {
        tags: ['middleware', 'country-routing', 'valid-country'],
        data: { pathname, countryCode: countryFromPath, countryName: country.name, ip }
      })
    } else if (pathname === '/' && !isApiPath) {
      // Root path - could implement automatic country detection and redirect
      // For now, let the homepage handle country detection
      logger.debug('Root path accessed - using default country detection', {
        tags: ['middleware', 'country-routing', 'root-path'],
        data: { pathname, detectedCountry, ip }
      })
    }

    // Get the token using next-auth
    // Use NEXTAUTH_SECRET if available, fallback to JWT_SECRET
    const authSecret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET
    
    // Log all cookies to see what's being sent
    const allCookies = request.cookies.getAll()
    const sessionCookie = request.cookies.get('next-auth.session-token') || request.cookies.get('__Secure-next-auth.session-token')
    const legacyTokenCookie = request.cookies.get('token')
    const authTokenCookie = request.cookies.get('auth_token')
    
    // ⚠️ WARNING: If we have legacy tokens, they shouldn't be used with NextAuth
    if (legacyTokenCookie || authTokenCookie) {
      logger.warn('⚠️ Middleware - Found legacy auth cookies (should use NextAuth only)', {
        tags: ['middleware', 'auth', 'cookies', 'warning'],
        data: {
          pathname,
          hasLegacyToken: !!legacyTokenCookie,
          hasAuthToken: !!authTokenCookie,
          hasNextAuthSession: !!sessionCookie,
          cookieNames: allCookies.map(c => c.name),
          message: 'Legacy token cookies found - these should be cleared. Only NextAuth session cookies should be used.'
        }
      })
      console.warn('⚠️ Middleware - Found legacy auth cookies:', {
        hasLegacyToken: !!legacyTokenCookie,
        hasAuthToken: !!authTokenCookie,
        hasNextAuthSession: !!sessionCookie
      })
    }
    
    logger.debug('Middleware - Cookie check', {
      tags: ['middleware', 'auth', 'cookies'],
      data: {
        pathname,
        totalCookies: allCookies.length,
        cookieNames: allCookies.map(c => c.name),
        hasSessionCookie: !!sessionCookie,
        hasLegacyToken: !!legacyTokenCookie,
        hasAuthToken: !!authTokenCookie,
        sessionCookieName: sessionCookie?.name,
        sessionCookieValue: sessionCookie ? `${sessionCookie.value.substring(0, 20)}...` : null,
        usingNextAuth: !!sessionCookie,
        usingLegacyAuth: !!(legacyTokenCookie || authTokenCookie),
      }
    })
    
    const token = await getToken({ 
      req: request,
      secret: authSecret,
      secureCookie: process.env.NODE_ENV === 'production'
    })

    logger.debug('Middleware - Token check', {
      tags: ['middleware', 'auth'],
      data: { 
        pathname,
        hasToken: !!token,
        ip,
        detectedCountry,
        countryFromPath,
        // Only log non-sensitive token data
        tokenData: token ? { 
          id: token.id,
          email: token.email,
          role: token.role,
          exp: token.exp,
          iat: token.iat,
          tokenAge: token.exp && token.iat ? `${token.exp - token.iat}s` : null,
          expiresIn: token.exp ? `${Math.floor((token.exp * 1000 - Date.now()) / 1000)}s` : null,
        } : null
      }
    })

    // Check if path requires authentication
    const isProtectedPath = protectedPaths.some(p => pathname.startsWith(p))
    const isAuthenticatedPath = authenticatedPaths.some(p => pathname.startsWith(p))
    const isAdminPath = isAdminOnlyPath(pathname)
    const isPublicPath = publicPaths.some(p => pathname.startsWith(p))

    // Allow access to signin/signup pages even if authenticated
    // This lets users log in as a different user or test the login flow
    // The signin form itself can show a message if user is already logged in

    // If path requires authentication and no token exists, redirect to signin
    if ((isProtectedPath || isAdminPath || isAuthenticatedPath) && !token) {
      logger.warn('Middleware - Unauthorized access attempt', {
        tags: ['middleware', 'unauthorized'],
        data: { pathname, isProtectedPath, isAdminPath, isAuthenticatedPath, ip }
      })
      const signInUrl = new URL('/signin', request.url)
      signInUrl.searchParams.set('callbackUrl', pathname)
      const response = NextResponse.redirect(signInUrl)
      return addSecurityHeaders(response)
    }

    // If path requires admin role, check token role
    if (isAdminPath && token) {
      const userRole = token.role as string
      if (!userRole || userRole.toLowerCase() !== 'admin') {
        logger.warn('Middleware - Unauthorized admin access attempt', {
          tags: ['middleware', 'admin', 'unauthorized'],
          data: { pathname, role: userRole, ip }
        })
        const response = new NextResponse(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        )
        return addSecurityHeaders(response)
      }
    }

    // Allow access to public paths or authenticated requests
    logger.debug('Middleware - Access granted', {
      tags: ['middleware', 'access-granted'],
      data: { 
        pathname,
        isPublicPath,
        isProtectedPath,
        isAdminPath,
        isAuthenticatedPath,
        hasToken: !!token,
        responseTime: Date.now() - startTime
      }
    })

    // Create response with updated headers
    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })

    return addSecurityHeaders(response)
  } catch (error) {
    logger.error('Middleware error', {
      tags: ['middleware', 'error'],
      error: error instanceof Error ? error : undefined,
      data: { pathname, ip: 'unknown' }
    })
    
    // Return error response
    const response = new NextResponse(
      JSON.stringify({ error: 'Internal Server Error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
    return addSecurityHeaders(response)
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
} 