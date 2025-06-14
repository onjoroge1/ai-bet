"use client"

import { useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { logger } from "@/lib/logger"
import { Loader2 } from "lucide-react"

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    logger.debug("DashboardLayout auth check", {
      tags: ["auth", "dashboard"],
      data: { isLoading, isAuthenticated, userId: user?.id },
    })
    
    // Only redirect if we're sure the user is not authenticated
    if (!isLoading && !isAuthenticated) {
      logger.info("User not authenticated, redirecting to signin from dashboard layout", {
        tags: ["auth", "dashboard", "redirect"],
      })
      router.replace("/signin")
    }
  }, [isAuthenticated, isLoading, router, user])

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <Loader2 className="h-12 w-12 animate-spin text-emerald-500" />
        <p className="ml-4 text-slate-300 text-lg">Loading dashboard...</p>
      </div>
    )
  }

  // Only render children if authenticated
  if (!isAuthenticated) {
    return null // Don't render anything while redirecting
  }

  return <>{children}</>
}
