"use client"

import { useEffect, useState } from "react"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { StatsOverview } from "@/components/dashboard/stats-overview"
import { RecentPredictions } from "@/components/dashboard/recent-predictions"
import { TipsHistory } from "@/components/dashboard/tips-history"
import { ReferralTracker } from "@/components/dashboard/referral-tracker"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { MobileDashboard } from "@/components/mobile/mobile-dashboard"
import { EmailVerificationBanner } from '@/components/email-verification-banner'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function DashboardPage() {
  const [isMobile, setIsMobile] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkScreenSize()
    window.addEventListener("resize", checkScreenSize)

    return () => window.removeEventListener("resize", checkScreenSize)
  }, [])

  const handleSignOut = async () => {
    await fetch('/api/auth/signout', { method: 'POST' })
    router.push('/signin')
  }

  // Show mobile version only on mobile screens
  if (isMobile) {
    return <MobileDashboard />
  }

  // Desktop/Tablet version
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <EmailVerificationBanner email="user@example.com" />
        <DashboardHeader />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <StatsOverview />
          </div>
          <div>
            <QuickActions />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <RecentPredictions />
          <ReferralTracker />
        </div>

        <TipsHistory />
      </div>
    </div>
  )
}
