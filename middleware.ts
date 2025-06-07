import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  // Get the user session from cookies
  const userSession = request.cookies.get("user-session")?.value
  const isAuthenticated = !!userSession

  // Protected routes that require authentication
  const protectedRoutes = ["/dashboard"]

  // Check if the current path is a protected route
  const isProtectedRoute = protectedRoutes.some((route) => request.nextUrl.pathname.startsWith(route))

  // If trying to access a protected route without authentication, redirect to login
  if (isProtectedRoute && !isAuthenticated) {
    return NextResponse.redirect(new URL("/signin", request.url))
  }

  // If already authenticated and trying to access login/signup, redirect to dashboard
  if (isAuthenticated && (request.nextUrl.pathname === "/signin" || request.nextUrl.pathname === "/signup")) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: ["/dashboard/:path*", "/signin", "/signup"],
}
