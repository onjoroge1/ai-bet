"use client"

import { useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth/auth-provider"
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
    if (!isLoading && !isAuthenticated) {
      logger.info("User not authenticated, redirecting to signin from dashboard layout", {
        tags: ["auth", "dashboard", "redirect"],
      })
      router.replace("/signin")
    }
  }, [isAuthenticated, isLoading, router, user])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <Loader2 className="h-12 w-12 animate-spin text-emerald-500" />
        <p className="ml-4 text-slate-300 text-lg">Loading dashboard...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    // This case should ideally be handled by the redirect,
    // but it's a fallback.
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <Loader2 className="h-12 w-12 animate-spin text-emerald-500" />
        <p className="ml-4 text-slate-300 text-lg">Redirecting to sign in...</p>
      </div>
    )
  }

  return <>{children}</>
}
