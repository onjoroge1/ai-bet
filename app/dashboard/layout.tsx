"use client"

import { useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { logger } from "@/lib/logger"
import { Loader2 } from "lucide-react"
import { getSession } from "@/lib/session-request-manager"

/**
 * DashboardLayout - Optimized Hybrid Authentication
 * 
 * 🔥 OPTIMIZED ARCHITECTURE:
 * - Fast route protection: Direct API check (~100ms) for immediate auth decision
 * - Reliable UI sync: useSession() for reactive updates (non-blocking)
 * - Best of both worlds: Fast + Consistent
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { data: session, status } = useSession()

  // ✅ OPTIMIZED: Coordinate with useSession() for reliable auth checks
  // This prevents race conditions and redirect loops
  useEffect(() => {
    const checkAuth = async () => {
      // Wait for useSession() to sync first (refetchOnMount handles this)
      let attempts = 0
      const maxWaitAttempts = 20 // 2 seconds max wait
      const waitInterval = 100
      
      // Wait for useSession() to finish loading
      while (status === 'loading' && attempts < maxWaitAttempts) {
        await new Promise(resolve => setTimeout(resolve, waitInterval))
        attempts++
      }
      
      // If useSession() shows authenticated, trust it
      if (status === 'authenticated' && session?.user) {
        logger.debug("DashboardLayout - Authenticated via useSession()", {
          tags: ["auth", "dashboard"],
          data: { email: session.user.email }
        })
        return // User is authenticated, no need to check server
      }
      
      // If useSession() shows unauthenticated, verify server-side
      if (status === 'unauthenticated') {
        // Small delay for cookie propagation
        await new Promise(resolve => setTimeout(resolve, 200))
        
        try {
          logger.debug("DashboardLayout - Verifying server-side session", {
            tags: ["auth", "dashboard"],
          })
          
          const serverSession = await getSession()
          if (!serverSession?.user) {
            logger.info("DashboardLayout - User not authenticated, redirecting to signin", {
              tags: ["auth", "dashboard", "redirect"],
            })
            router.replace('/signin')
            return
          } else {
            // Server has session but useSession() doesn't - wait for sync
            logger.warn("DashboardLayout - Server has session but useSession() doesn't, waiting for sync", {
              tags: ["auth", "dashboard", "sync"],
            })
            // Wait a bit more for useSession() to sync
            await new Promise(resolve => setTimeout(resolve, 500))
            // If still unauthenticated after wait, trust server and redirect will be handled by useSession()
            return
          }
        } catch (error) {
          logger.error("DashboardLayout - Auth check error", {
            tags: ["auth", "dashboard", "error"],
            error: error instanceof Error ? error : undefined,
          })
          router.replace('/signin')
          return
        }
      }
      
      // If still loading after max wait, check server-side
      if (status === 'loading') {
        logger.warn("DashboardLayout - useSession() still loading after max wait, checking server", {
          tags: ["auth", "dashboard"],
        })
        
        try {
          const serverSession = await getSession()
          if (!serverSession?.user) {
            router.replace('/signin')
            return
          }
          // Server has session, wait for useSession() to sync
          logger.debug("DashboardLayout - Server has session, waiting for useSession() sync", {
            tags: ["auth", "dashboard"],
          })
        } catch (error) {
          logger.error("DashboardLayout - Auth check error", {
            tags: ["auth", "dashboard", "error"],
            error: error instanceof Error ? error : undefined,
          })
          router.replace('/signin')
        }
      }
    }
    
    checkAuth()
  }, [router, status, session])

  // Show loading state while checking authentication
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <Loader2 className="h-12 w-12 animate-spin text-emerald-500" />
        <p className="ml-4 text-slate-300 text-lg">Loading dashboard...</p>
      </div>
    )
  }

  // Redirect if not authenticated (useSession() will have synced by now with refetchOnMount)
  if (status === 'unauthenticated' || !session?.user) {
    return null // Will redirect via useEffect above
  }

  // Render dashboard content - user is authenticated
  // useSession() provides reactive updates for UI components
  return <>{children}</>
}
