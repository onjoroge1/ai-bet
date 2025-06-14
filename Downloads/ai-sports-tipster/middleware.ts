import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { logger } from '@/lib/logger'

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
  const path = request.nextUrl.pathname

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
        path,
        hasToken: !!token,
        // Only log non-sensitive token data
        tokenData: token ? { 
          role: token.role,
          exp: token.exp
        } : null
      }
    })

    // Check if path requires authentication
    const isProtectedPath = protectedPaths.some(p => path.startsWith(p))
    const isAdminPath = adminPaths.some(p => path.startsWith(p))
    const isPublicPath = publicPaths.some(p => path.startsWith(p))

    // If user is authenticated and tries to access signin/signup, redirect to dashboard
    if (token && (path === '/signin' || path === '/signup')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // If path requires authentication and no token exists, redirect to signin
    if ((isProtectedPath || isAdminPath) && !token) {
      logger.warn('Middleware - Unauthorized access attempt', {
        tags: ['auth', 'middleware'],
        data: { path, isProtectedPath, isAdminPath }
      })
      const signInUrl = new URL('/signin', request.url)
      signInUrl.searchParams.set('callbackUrl', path)
      return NextResponse.redirect(signInUrl)
    }

    // If path requires admin role, check token role
    if (isAdminPath && token) {
      const userRole = token.role as string
      if (!userRole || userRole.toLowerCase() !== 'admin') {
        logger.warn('Middleware - Unauthorized admin access attempt', {
          tags: ['auth', 'middleware', 'admin'],
          data: { path, role: userRole }
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
        path,
        isPublicPath,
        isProtectedPath,
        isAdminPath,
        hasToken: !!token
      }
    })
    return NextResponse.next()

  } catch (error) {
    logger.error('Middleware error', {
      tags: ['auth', 'middleware'],
      error: error instanceof Error ? error : undefined,
      data: { path }
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