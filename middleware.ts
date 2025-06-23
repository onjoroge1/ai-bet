import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { logger } from '@/lib/logger'
import { getCountryFromRequest } from "@/lib/country-pricing"

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
]

// Paths that require admin role
const adminPaths = [
  '/admin',
  '/api/admin',
  '/api/predictions',
]

// Paths that require authentication
const protectedPaths = [
  '/dashboard',
  '/profile',
  '/settings',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Get user's IP address for country detection
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown'
  
  // Get country from IP (you can use a service like ipapi.co, ipinfo.io, or similar)
  let ipCountryCode: string | undefined
  
  try {
    // For now, we'll use a simple approach. In production, you might want to use a proper IP geolocation service
    // Example with ipapi.co (free tier available)
    // const response = await fetch(`https://ipapi.co/${ip}/json/`)
    // const data = await response.json()
    // ipCountryCode = data.country_code
    
    // For now, we'll skip IP detection to avoid rate limits and use domain/user preference
    ipCountryCode = undefined
  } catch (error) {
    console.warn('Failed to detect country from IP:', error)
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

  try {
    // Get the token using next-auth
    const token = await getToken({ 
      req: request,
      secret: process.env.JWT_SECRET,
      secureCookie: process.env.NODE_ENV === 'production'
    })

    logger.debug('Middleware - Token check', {
      tags: ['auth', 'middleware'],
      data: { 
        pathname,
        hasToken: !!token,
        // Only log non-sensitive token data
        tokenData: token ? { 
          role: token.role,
          exp: token.exp
        } : null
      }
    })

    // Check if path requires authentication
    const isProtectedPath = protectedPaths.some(p => pathname.startsWith(p))
    const isAdminPath = adminPaths.some(p => pathname.startsWith(p))
    const isPublicPath = publicPaths.some(p => pathname.startsWith(p))

    // If user is authenticated and tries to access signin/signup, redirect to dashboard
    if (token && (pathname === '/signin' || pathname === '/signup')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // If path requires authentication and no token exists, redirect to signin
    if ((isProtectedPath || isAdminPath) && !token) {
      logger.warn('Middleware - Unauthorized access attempt', {
        tags: ['auth', 'middleware'],
        data: { pathname, isProtectedPath, isAdminPath }
      })
      const signInUrl = new URL('/signin', request.url)
      signInUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(signInUrl)
    }

    // If path requires admin role, check token role
    if (isAdminPath && token) {
      const userRole = token.role as string
      if (!userRole || userRole.toLowerCase() !== 'admin') {
        logger.warn('Middleware - Unauthorized admin access attempt', {
          tags: ['auth', 'middleware', 'admin'],
          data: { pathname, role: userRole }
        })
        return new NextResponse(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }

    // Allow access to public paths or authenticated requests
    logger.debug('Middleware - Access granted', {
      tags: ['auth', 'middleware'],
      data: { 
        pathname,
        isPublicPath,
        isProtectedPath,
        isAdminPath,
        hasToken: !!token
      }
    })
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })

  } catch (error) {
    logger.error('Middleware error', {
      tags: ['auth', 'middleware'],
      error: error instanceof Error ? error : undefined,
      data: { pathname }
    })
    return new NextResponse(
      JSON.stringify({ error: 'Internal Server Error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
} 