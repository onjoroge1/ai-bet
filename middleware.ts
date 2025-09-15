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
    // Get client IP for rate limiting and country detection
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown'
    
    // Rate limiting
    const rateLimitKey = `${ip}:${pathname}`
    const isApiPath = pathname.startsWith('/api/')
    const isAuthPath = pathname.includes('/auth/')
    
    const config = isAuthPath ? rateLimitConfig.auth : 
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
    const token = await getToken({ 
      req: request,
      secret: process.env.JWT_SECRET,
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
          role: token.role,
          exp: token.exp
        } : null
      }
    })

    // Check if path requires authentication
    const isProtectedPath = protectedPaths.some(p => pathname.startsWith(p))
    const isAuthenticatedPath = authenticatedPaths.some(p => pathname.startsWith(p))
    const isAdminPath = isAdminOnlyPath(pathname)
    const isPublicPath = publicPaths.some(p => pathname.startsWith(p))

    // If user is authenticated and tries to access signin/signup, redirect to dashboard
    if (token && (pathname === '/signin' || pathname === '/signup')) {
      const response = NextResponse.redirect(new URL('/dashboard', request.url))
      return addSecurityHeaders(response)
    }

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