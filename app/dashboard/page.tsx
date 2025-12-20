"use client"

import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'

/**
 * DashboardPage - Server-Side First Architecture
 * 
 * 🔥 REMOVED: Duplicate auth check (layout already handles server-side auth)
 * - DashboardLayout checks /api/auth/session and only renders children if authenticated
 * - This page trusts the layout's auth check
 * - useAuth() is used only for user data (non-blocking)
 */

// Dynamically import heavy components
const StatsOverview = dynamic(() => import('@/components/dashboard/stats-overview').then(mod => mod.StatsOverview), {
  loading: () => <div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
})

const PackageCredits = dynamic(() => import('@/components/dashboard/package-credits').then(mod => mod.PackageCredits), {
  loading: () => <div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
})

const QuizCreditClaim = dynamic(() => import('@/components/quiz/QuizCreditClaim'), {
  loading: () => <div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
})

const QuizCredits = dynamic(() => import('@/components/dashboard/quiz-credits').then(mod => mod.QuizCredits), {
  loading: () => <div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
})

const TimelineFeed = dynamic(() => import('@/components/dashboard/timeline-feed').then(mod => mod.TimelineFeed), {
  loading: () => <div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
})

const MyTipsWidget = dynamic(() => import('@/components/dashboard/my-tips-widget').then(mod => mod.MyTipsWidget), {
  loading: () => <div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
})

const ClaimedTipsSection = dynamic(() => import('@/components/dashboard/ClaimedTipsSection').then(mod => mod.ClaimedTipsSection), {
  loading: () => <div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
})

const UpgradeOffers = dynamic(() => import('@/components/upgrade-offers').then(mod => mod.UpgradeOffers), {
  loading: () => <div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
})

const PersonalizedOffers = dynamic(() => import('@/components/personalized-offers').then(mod => mod.PersonalizedOffers), {
  loading: () => <div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
})

const NotificationsWidget = dynamic(() => import('@/components/notifications-widget').then(mod => mod.NotificationsWidget), {
  loading: () => <div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
})


const LiveMatchesWidget = dynamic(() => import('@/components/live-matches-widget').then(mod => mod.LiveMatchesWidget), {
  loading: () => <div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
})

const ReferralBanner = dynamic(() => import('@/components/referral-banner'), {
  loading: () => <div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
})

const ParlaysPreviewWidget = dynamic(() => import('@/components/dashboard/parlays-preview-widget').then(mod => mod.ParlaysPreviewWidget), {
  loading: () => <div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
})

const CLVPreviewWidget = dynamic(() => import('@/components/dashboard/clv-preview-widget').then(mod => mod.CLVPreviewWidget), {
  loading: () => <div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
})

export default function DashboardPage() {
  // 🔥 REMOVED: Duplicate auth check - DashboardLayout already handles server-side auth
  // The layout checks /api/auth/session and only renders children if authenticated
  // This page trusts the layout's auth check and renders content immediately

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 min-h-screen">
      <DashboardHeader />

      {/* Top Row: Stats and Package Credits */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <Suspense fallback={<div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>}>
            <StatsOverview />
          </Suspense>
        </div>
        <div>
          <Suspense fallback={<div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>}>
            <PackageCredits />
          </Suspense>
        </div>
      </div>

      {/* Quick Purchase Section - Full Width */}
      <div className="mb-8">
        <Suspense fallback={<div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>}>
          <UpgradeOffers />
        </Suspense>
      </div>

      {/* Personalized Offers - Full Width */}
      <div className="mb-8" data-section="personalized-offers">
        <Suspense fallback={<div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>}>
          <PersonalizedOffers />
        </Suspense>
      </div>

      {/* Premium Features Preview - Parlays & CLV */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Suspense fallback={<div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>}>
          <ParlaysPreviewWidget />
        </Suspense>
        <Suspense fallback={<div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>}>
          <CLVPreviewWidget />
        </Suspense>
      </div>

      {/* Middle Row: Notifications, Live Matches */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div>
          <Suspense fallback={<div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>}>
            <NotificationsWidget />
          </Suspense>
        </div>
        <div>
          <Suspense fallback={<div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>}>
            <LiveMatchesWidget />
          </Suspense>
        </div>
      </div>

      {/* Bottom Row: Timeline Feed, My Tips Widget */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Suspense fallback={<div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>}>
          <TimelineFeed />
        </Suspense>
        <Suspense fallback={<div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>}>
          <MyTipsWidget />
        </Suspense>
      </div>

      {/* Claimed Tips Section - Full Width */}
      <div className="mb-8">
        <Suspense fallback={<div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>}>
          <ClaimedTipsSection />
        </Suspense>
      </div>

      {/* Referral Banner - Full Width */}
      <div className="mb-8">
        <Suspense fallback={<div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>}>
          <ReferralBanner />
        </Suspense>
      </div>

      {/* Quiz Credits - Full Width */}
      <div className="mb-8 pt-4">
        <Suspense fallback={<div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>}>
          <QuizCredits />
        </Suspense>
      </div>

      {/* Quiz Credit Claim - Full Width */}
      <div className="mt-8">
        <Suspense fallback={<div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>}>
          <QuizCreditClaim />
        </Suspense>
      </div>
    </div>
  )
}
