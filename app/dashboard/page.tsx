"use client"

import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'

// Dynamically import heavy components
const StatsOverview = dynamic(() => import('@/components/dashboard/stats-overview').then(mod => mod.StatsOverview), {
  loading: () => <div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
})

const AIToolsResources = dynamic(() => import('@/components/dashboard/ai-tools-resources').then(mod => mod.AIToolsResources), {
  loading: () => <div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
})

const PackageCredits = dynamic(() => import('@/components/dashboard/package-credits').then(mod => mod.PackageCredits), {
  loading: () => <div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
})

const RecentPredictions = dynamic(() => import('@/components/dashboard/recent-predictions').then(mod => mod.RecentPredictions), {
  loading: () => <div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
})

const TipsHistoryWidget = dynamic(() => import('@/components/dashboard/tips-history-widget').then(mod => mod.TipsHistoryWidget), {
  loading: () => <div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
})

const MyTipsWidget = dynamic(() => import('@/components/dashboard/my-tips-widget').then(mod => mod.MyTipsWidget), {
  loading: () => <div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
})

const ReferralTracker = dynamic(() => import('@/components/dashboard/referral-tracker').then(mod => mod.ReferralTracker), {
  loading: () => <div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
})

const UpgradeOffers = dynamic(() => import('@/components/upgrade-offers').then(mod => mod.UpgradeOffers), {
  loading: () => <div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
})

const MyTipsOverview = dynamic(() => import('@/components/my-tips-overview').then(mod => mod.MyTipsOverview), {
  loading: () => <div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
})

const PersonalizedOffers = dynamic(() => import('@/components/personalized-offers').then(mod => mod.PersonalizedOffers), {
  loading: () => <div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
})

const NotificationsWidget = dynamic(() => import('@/components/notifications-widget').then(mod => mod.NotificationsWidget), {
  loading: () => <div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
})

const AchievementsWidget = dynamic(() => import('@/components/achievements-widget').then(mod => mod.AchievementsWidget), {
  loading: () => <div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
})

const LiveMatchesWidget = dynamic(() => import('@/components/live-matches-widget').then(mod => mod.LiveMatchesWidget), {
  loading: () => <div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
})

export default function DashboardPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <DashboardHeader />

      {/* Top Row: Stats, AI Tools, Package Credits */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        <div className="lg:col-span-2">
          <Suspense fallback={<div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>}>
            <StatsOverview />
          </Suspense>
        </div>
        <div>
          <Suspense fallback={<div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>}>
            <AIToolsResources />
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

      {/* My Tips Overview Section - Full Width */}
      <div className="mb-8">
        <Suspense fallback={<div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>}>
          <MyTipsOverview />
        </Suspense>
      </div>

      {/* Personalized Offers - Full Width */}
      <div className="mb-8" data-section="personalized-offers">
        <Suspense fallback={<div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>}>
          <PersonalizedOffers />
        </Suspense>
      </div>

      {/* Middle Row: Notifications, Live Matches, Achievements */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
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
        <div>
          <Suspense fallback={<div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>}>
            <AchievementsWidget />
          </Suspense>
        </div>
      </div>

      {/* Bottom Row: Recent Predictions, My Tips Widget */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Suspense fallback={<div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>}>
          <RecentPredictions />
        </Suspense>
        <Suspense fallback={<div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>}>
          <MyTipsWidget />
        </Suspense>
      </div>

      {/* Referral Tracker - Full Width */}
      <Suspense fallback={<div className="h-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>}>
        <ReferralTracker />
      </Suspense>
    </div>
  )
}
