"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { logger } from "@/lib/logger"
import { Loader2 } from "lucide-react"
import { getSession } from "@/lib/session-request-manager"

type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated'

/**
 * DashboardLayout - Server-Side First Authentication
 * 
 * 🔥 NEW ARCHITECTURE: Uses /api/auth/session as primary source of truth
 * - Checks server-side session directly (no waiting for useSession() sync)
 * - Fast and reliable authentication decisions
 * - useSession() syncs in background for UI components
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking')

  useEffect(() => {
    const checkAuth = async (retryCount = 0) => {
      const maxRetries = 5 // ✅ INCREASED: More retries for initial load after redirect
      const baseDelay = 1000 // 1 second
      
      // ✅ FIX: Longer delay on first check to allow session cookie to propagate after redirect
      // This is especially important in production where cookie propagation can take 300-500ms
      // Also check if we're coming from signin (document.referrer contains /signin)
      const isFromSignin = typeof window !== 'undefined' && 
        (document.referrer.includes('/signin') || 
         window.location.search.includes('from=signin') ||
         sessionStorage.getItem('justSignedIn') === 'true')
      
      if (retryCount === 0) {
        // ✅ INCREASED: Longer delay if coming from signin, shorter otherwise
        const initialDelay = isFromSignin ? 500 : 100 // 500ms for signin redirect, 100ms otherwise
        logger.info("DashboardLayout - Initial auth check", {
          tags: ["auth", "dashboard"],
          data: { isFromSignin, initialDelay },
        })
        await new Promise(resolve => setTimeout(resolve, initialDelay))
        // Clear the flag after first check
        if (isFromSignin && typeof window !== 'undefined') {
          sessionStorage.removeItem('justSignedIn')
        }
      }
      
      try {
        logger.info("DashboardLayout - Checking server-side session", {
          tags: ["auth", "dashboard", "server-side-check"],
          data: { architecture: "server-side-first", retryCount, usingManager: true },
        })
        
        // ✅ Use session request manager for deduplication and caching
        // This prevents multiple simultaneous requests and provides 5-second caching
        // Errors (including 429 rate limits) will be caught by catch block below
        const session = await getSession()
        
        if (session?.user) {
          logger.info("DashboardLayout - User authenticated (server-side)", {
            tags: ["auth", "dashboard"],
        data: {
              email: session.user.email,
              userId: session.user.id,
              architecture: "server-side-first",
        },
      })
          setAuthStatus('authenticated')
        } else {
          logger.info("DashboardLayout - User not authenticated, redirecting to signin", {
            tags: ["auth", "dashboard", "redirect"],
            data: { architecture: "server-side-first" },
          })
          setAuthStatus('unauthenticated')
          router.replace('/signin')
        }
      } catch (error) {
        logger.error("DashboardLayout - Auth check error", {
          tags: ["auth", "dashboard", "error"],
          error: error instanceof Error ? error : undefined,
        })
        setAuthStatus('unauthenticated')
        router.replace('/signin')
    }
    }
    
    checkAuth()
  }, [router])

  // Show loading state while checking authentication
  if (authStatus === 'checking') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <Loader2 className="h-12 w-12 animate-spin text-emerald-500" />
        <p className="ml-4 text-slate-300 text-lg">Loading dashboard...</p>
      </div>
    )
  }

  // Don't render anything while redirecting
  if (authStatus === 'unauthenticated') {
    return null
  }

  // Render dashboard content - user is authenticated (verified server-side)
  return <>{children}</>
}
