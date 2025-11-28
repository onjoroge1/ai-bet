"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn, useSession } from "next-auth/react"
import { useQueryClient } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { TrendingUp, Mail, Lock } from "lucide-react"
import Link from "next/link"
import { logger } from "@/lib/logger"
import { clearSessionCache } from "@/lib/session-request-manager"

export function SignInForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { update } = useSession() // Get update function for background sync
  const queryClient = useQueryClient() // Get queryClient to clear cache

  const rawCallbackUrl = searchParams.get("callbackUrl") || "/dashboard"
  // Sanitize callbackUrl: never allow API routes or external URLs
  const callbackUrl =
    !rawCallbackUrl ||
    rawCallbackUrl.startsWith("/api/") ||
    rawCallbackUrl.startsWith("http")
      ? "/dashboard"
      : rawCallbackUrl
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    remember: false
  })

  // 🔥 REMOVED: Auto-logout on /signin
  // This was causing issues because:
  // 1. HttpOnly cookies can't be deleted via JavaScript
  // 2. Auto-logout creates loops and overwrites sessions
  // 3. If user wants to switch accounts, they can manually log out
  // The navigation bar already hides authenticated state on /signin page

  // Clear URL parameters on component mount to prevent credentials from being displayed
  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.has('email') || url.searchParams.has('password')) {
      // Remove sensitive parameters from URL
      url.searchParams.delete('email')
      url.searchParams.delete('password')
      // Replace the current URL without the sensitive parameters
      window.history.replaceState({}, '', url.toString())
    }
    
    // Log all cookies on signin page load
    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
      const [name, value] = cookie.trim().split('=')
      acc[name] = value ? `${value.substring(0, 20)}...` : null
      return acc
    }, {} as Record<string, string | null>)
    
    logger.debug('SignInForm - Page loaded, checking cookies', {
      tags: ['auth', 'signin', 'cookies'],
      data: {
        cookieCount: Object.keys(cookies).length,
        cookieNames: Object.keys(cookies),
        hasSessionCookie: !!cookies['next-auth.session-token'] || !!cookies['__Secure-next-auth.session-token'],
        hasLegacyToken: !!cookies['token'],
        hasAuthToken: !!cookies['auth_token'],
        cookies: Object.keys(cookies)
      }
    })
    console.log('SignInForm - Cookies on page load:', {
      cookieCount: Object.keys(cookies).length,
      cookieNames: Object.keys(cookies),
      hasSessionCookie: !!cookies['next-auth.session-token'] || !!cookies['__Secure-next-auth.session-token']
    })
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    
    // Explicit validation: ensure email and password are not empty
    const trimmedEmail = formData.email.trim()
    const trimmedPassword = formData.password.trim()
    
    if (!trimmedEmail || !trimmedPassword) {
      setError('Please enter both email and password.')
      logger.warn('Sign in attempt with empty credentials', {
        tags: ['auth', 'signin'],
        data: { hasEmail: !!trimmedEmail, hasPassword: !!trimmedPassword }
      })
      return
    }

    // Additional email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address.')
      return
    }

    setIsLoading(true)

    try {
      logger.info('Attempting sign in (NextAuth) - Using NextAuth signIn()', { 
        tags: ['auth', 'signin', 'nextauth'], 
        data: { 
          email: trimmedEmail, 
          hasPassword: !!trimmedPassword, 
          callbackUrl,
          method: 'NextAuth signIn()',
          endpoint: '/api/auth/[...nextauth]',
          timestamp: new Date().toISOString()
        } 
      })
      console.log('SignInForm - Using NextAuth signIn(), NOT calling /api/auth/signin')

      // ✅ IMPORTANT: We use NextAuth's signIn(), NOT the legacy /api/auth/signin route
      // NextAuth will call /api/auth/[...nextauth] which uses our CredentialsProvider
      // This sets next-auth.session-token cookie, NOT the legacy 'token' cookie
      const result = await signIn("credentials", {
        email: trimmedEmail,
        password: trimmedPassword,
        redirect: false, // Check for errors first
        callbackUrl, // already sanitized
      })
      
      // 🔍 DIAGNOSTIC: Log the full result object
      logger.info('SignInForm - signIn result (full)', {
        tags: ['auth', 'signin', 'nextauth', 'diagnostic'],
        data: {
          ok: result?.ok,
          error: result?.error,
          status: result?.status,
          url: result?.url,
          fullResult: result,
        }
      })
      
      console.log("[DEBUG] SignInForm - signIn() result:", {
        ok: result?.ok,
        error: result?.error,
        status: result?.status,
        url: result?.url,
        fullResult: result,
      })

      if (result?.error) {
        logger.error('Sign in failed', { 
          tags: ['auth', 'signin'],
          data: { email: trimmedEmail, error: result.error }
        })
        
        // Provide user-friendly error messages
        if (result.error === 'CredentialsSignin') {
          setError('Invalid email or password. Please check your credentials and try again.')
        } else if (result.error === 'CallbackRouteError') {
          setError('Authentication service temporarily unavailable. Please try again later.')
        } else {
          setError('Sign in failed. Please try again.')
        }
        setIsLoading(false)
        // Clear password field on error for security
        setFormData(prev => ({ ...prev, password: '' }))
        return
      }

      if (result?.ok) {
        logger.info("Sign in successful - syncing session before redirect", { 
          tags: ["auth", "signin"], 
          data: { 
            callbackUrl,
            resultUrl: result?.url,
            architecture: "useSession-optimized"
          } 
        })
        
        // 🔥 CRITICAL FIX: Clear all caches before sync to prevent stale data
        // This ensures dashboard components load fresh data for the new user
        try {
          // Step 1: Clear session request manager cache
          clearSessionCache()
          logger.info("SignInForm - Session request manager cache cleared", {
            tags: ["auth", "signin", "cache"],
          })
          
          // Step 2: Clear all React Query cache to prevent showing previous user's data
          queryClient.invalidateQueries()
          queryClient.removeQueries()
          logger.info("SignInForm - React Query cache cleared", {
            tags: ["auth", "signin", "cache"],
          })
        } catch (cacheError) {
          logger.warn("SignInForm - Failed to clear caches, but continuing", {
            tags: ["auth", "signin", "cache"],
            error: cacheError instanceof Error ? cacheError : undefined,
          })
        }
        
        // 🔥 OPTIMIZED: Wait for useSession() to sync before redirect
        // This ensures session is ready and prevents redirect loops
        // 1. Wait for useSession() update to complete (blocking)
        // 2. Small delay for state propagation
        // 3. Redirect with confidence that session is synced
        
        // Step 1: Wait for useSession() to sync (blocking to ensure session is ready)
        logger.info("SignInForm - Waiting for useSession() to sync", {
          tags: ["auth", "signin", "session-sync"],
        })
        
        try {
          await update()
          logger.info("SignInForm - useSession() sync completed", {
            tags: ["auth", "signin", "session-sync"],
          })
        } catch (updateError) {
          logger.warn("SignInForm - useSession() update failed, but continuing with verification", {
            tags: ["auth", "signin", "session-sync"],
            error: updateError instanceof Error ? updateError : undefined,
          })
          // Continue with verification - will check server-side session
        }
        
        // Step 2: Verify session is actually authenticated before redirect (CRITICAL FIX)
        // This prevents redirect loops on slow networks
        let sessionVerified = false
        let attempts = 0
        const maxAttempts = 15 // 15 attempts = 1.5 seconds max wait
        const pollInterval = 100 // Check every 100ms
        
        logger.info("SignInForm - Verifying session before redirect", {
          tags: ["auth", "signin", "session-verification"],
        })
        
        while (!sessionVerified && attempts < maxAttempts) {
          try {
            const sessionCheck = await fetch('/api/auth/session', {
              credentials: 'include',
              cache: 'no-store'
            })
            
            if (sessionCheck.ok) {
              const session = await sessionCheck.json()
              if (session?.user) {
                sessionVerified = true
                logger.info("SignInForm - Session verified before redirect", {
                  tags: ["auth", "signin", "session-verification"],
                  data: { 
                    attempts: attempts + 1,
                    email: session.user.email 
                  }
                })
                break
              }
            }
            
            attempts++
            if (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, pollInterval))
            }
          } catch (error) {
            logger.warn("SignInForm - Session verification error during polling", {
              tags: ["auth", "signin", "session-verification"],
              error: error instanceof Error ? error : undefined,
              data: { attempts: attempts + 1 }
            })
            attempts++
            if (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, pollInterval))
            }
          }
        }
        
        if (!sessionVerified) {
          logger.error("SignInForm - Session verification timeout, redirecting anyway (fallback)", {
            tags: ["auth", "signin", "session-verification", "warning"],
            data: { attempts }
          })
          // Fallback: redirect anyway, DashboardLayout will handle verification
        }
        
        logger.info("SignInForm - Session verified, ready for redirect", {
          tags: ["auth", "signin"],
          data: { sessionVerified, attempts }
        })
        
        // Step 3: Redirect - session is now synced, refetchOnMount will ensure fresh check
        // ✅ FIX: Validate result.url - in production, NextAuth sometimes returns CSRF endpoint instead of callbackUrl
        // If result.url points to /api/auth/signin or contains csrf=true, ignore it and use callbackUrl
        let target = callbackUrl
        if (result?.url) {
          const resultUrl = result.url
          const isCSRFEndpoint = resultUrl.includes('/api/auth/signin') || resultUrl.includes('csrf=true')
          const isInvalidRedirect = resultUrl.includes('/api/') && !resultUrl.includes('/dashboard')
          
          if (isCSRFEndpoint || isInvalidRedirect) {
            logger.warn("SignInForm - NextAuth returned invalid redirect URL, using callbackUrl instead", {
              tags: ["auth", "signin", "redirect"],
              data: {
                resultUrl,
                callbackUrl,
                reason: isCSRFEndpoint ? "CSRF endpoint" : "Invalid API route",
              },
            })
            target = callbackUrl
          } else {
            // ✅ Valid redirect URL - use it
            target = resultUrl
          }
        }
        
        logger.info("Redirecting to dashboard - session synced via useSession()", {
          tags: ["auth", "signin"],
          data: { 
            target, 
            resultUrl: result?.url,
            callbackUrl,
            architecture: "useSession-optimized" 
          },
        })
        
        // ✅ OPTIMIZED: Use router.push() since session is already synced
        // Session is synced via update(), so we can use client-side navigation
        // This provides faster navigation than window.location.href
        router.push(target)
        return
      }

      // Fallback: if we get here, something unexpected happened
      logger.error("Sign in returned unexpected result", {
        tags: ["auth", "signin"],
        data: { result }
      })
      setError("Sign in failed. Please try again.")
      setIsLoading(false)
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
      logger.error('Sign in error', { 
        tags: ['auth', 'signin'],
        error: err instanceof Error ? err : undefined,
        data: { email: trimmedEmail }
      })
      setIsLoading(false)
      // Clear password field on error for security
      setFormData(prev => ({ ...prev, password: '' }))
    }
    // Note: If redirect: true, setIsLoading(false) won't run because the page will redirect
    // This is expected behavior
  }

  return (
    <div className="w-full max-w-md">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center space-x-2 mb-4">
          <div className="w-10 h-10 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-slate-900" />
          </div>
          <span className="text-2xl font-bold text-white">SnapBet</span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
        <p className="text-slate-300">Sign in to your account</p>
      </div>

      <Card className="bg-slate-800/50 border-slate-700 p-6 backdrop-blur-sm">

        {error && (
          <div 
            className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm"
            role="alert"
            aria-live="polite"
          >
            {error}
          </div>
        )}

        <form 
          onSubmit={handleSubmit} 
          className="space-y-4" 
          method="POST" 
          action=""
          autoComplete="off"
          noValidate
        >
          {/* Hidden input to prevent browser autofill */}
          <input type="text" name="username" autoComplete="username" style={{ display: 'none' }} tabIndex={-1} />
          <input type="password" name="password-hidden" autoComplete="new-password" style={{ display: 'none' }} tabIndex={-1} />
          
          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-300">
              Email Address
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" aria-hidden="true" />
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="Enter your email"
                className="pl-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-400"
                required
                value={formData.email}
                onChange={handleChange}
                autoComplete="off"
                autoFocus={false}
                aria-label="Email address"
                aria-required="true"
                aria-invalid={!!error}
                aria-describedby={error ? "email-error" : undefined}
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-300">
              Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" aria-hidden="true" />
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Enter your password"
                className="pl-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-400"
                required
                value={formData.password}
                onChange={handleChange}
                autoComplete="off"
                autoFocus={false}
                aria-label="Password"
                aria-required="true"
                aria-invalid={!!error}
                aria-describedby={error ? "password-error" : undefined}
              />
            </div>
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                name="remember"
                checked={formData.remember}
                onCheckedChange={(checked) => handleChange({ target: { name: 'remember', checked } } as any)}
                aria-label="Remember me"
              />
              <Label htmlFor="remember" className="text-slate-300 text-sm">
                Remember me
              </Label>
            </div>
            <Link 
              href="/forgot-password" 
              className="text-emerald-400 hover:text-emerald-300 text-sm"
              aria-label="Forgot password?"
            >
              Forgot password?
            </Link>
          </div>

          {/* Sign In Button */}
          <Button 
            type="submit" 
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" 
            disabled={isLoading}
            aria-label={isLoading ? "Signing in..." : "Sign in"}
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </Button>

          {/* Sign Up Link */}
          <div className="text-center">
            <p className="text-slate-400">
              Don't have an account?{" "}
              <Link 
                href="/signup" 
                className="text-emerald-400 hover:text-emerald-300 font-medium"
                aria-label="Sign up for free"
              >
                Sign up for free
              </Link>
            </p>
          </div>
        </form>
      </Card>
    </div>
  )
}

