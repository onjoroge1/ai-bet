"use client"

import { useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { logger } from "@/lib/logger"
import { Loader2 } from "lucide-react"

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { data: session, status } = useSession()

  useEffect(() => {
    // 🔥 CRITICAL: Trust useSession() directly, not useAuth()
    // useSession() is the single source of truth for NextAuth authentication
    // Only redirect if we're CERTAIN the user is not authenticated (not loading, and no session)
    // Wait for status to be determined (not 'loading') before making decisions
    if (status !== 'loading' && status === 'unauthenticated') {
      logger.info("User not authenticated, redirecting to signin from dashboard layout", {
        tags: ["auth", "dashboard", "redirect"],
        data: {
          nextAuthStatus: status,
          hasSession: !!session,
        },
      })
      console.log("[DEBUG] DashboardLayout - redirecting to signin because status is unauthenticated (after loading)")
      router.replace("/signin")
    }
  }, [status, router, session])

  // Show loading state while NextAuth is determining session status
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <Loader2 className="h-12 w-12 animate-spin text-emerald-500" />
        <p className="ml-4 text-slate-300 text-lg">Loading dashboard...</p>
      </div>
    )
  }

  // Only render children if authenticated
  if (status !== 'authenticated' || !session?.user) {
    return null // Don't render anything while redirecting
  }

  return <>{children}</>
}
