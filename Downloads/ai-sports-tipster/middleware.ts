import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken } from './lib/auth'
import { jwtVerify } from 'jose'

// Add paths that don't require authentication
const publicPaths = ['/signin', '/signup', '/forgot-password', '/reset-password']

// Add admin paths that require admin role
const adminPaths = ['/admin']

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value
  const { pathname } = request.nextUrl

  // Allow public paths
  if (publicPaths.includes(pathname)) {
    // If user is already logged in, redirect to dashboard
    if (token) {
      const isValid = await verifyToken(token)
      if (isValid) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
    return NextResponse.next()
  }

  // Check authentication for protected routes
  if (!token) {
    return NextResponse.redirect(new URL('/signin', request.url))
  }

  // Verify token and check role for admin routes
  if (adminPaths.some(path => pathname.startsWith(path))) {
    try {
      const encoder = new TextEncoder()
      const secretKey = encoder.encode(process.env.JWT_SECRET || 'your-secret-key')
      const { payload } = await jwtVerify(token, secretKey)
      
      // Check if user has Admin role
      if (payload.role !== 'Admin') {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    } catch (error) {
      console.error('Admin access error:', error)
      return NextResponse.redirect(new URL('/signin', request.url))
    }
  }

  // Verify token for other protected routes
  const isValid = await verifyToken(token)
  if (!isValid) {
    // Clear invalid token
    const response = NextResponse.redirect(new URL('/signin', request.url))
    response.cookies.delete('token')
    return response
  }

  return NextResponse.next()
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
} 