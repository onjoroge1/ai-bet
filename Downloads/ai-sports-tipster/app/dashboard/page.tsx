"use client"

import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { StatsOverview } from "@/components/dashboard/stats-overview"
import { RecentPredictions } from "@/components/dashboard/recent-predictions"
import { TipsHistory } from "@/components/dashboard/tips-history"
import { ReferralTracker } from "@/components/dashboard/referral-tracker"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { UpgradeOffers } from "@/components/upgrade-offers"
import { PersonalizedOffers } from "@/components/personalized-offers"
import { WalletWidget } from "@/components/wallet-widget"
import { NotificationsWidget } from "@/components/notifications-widget"
import { AchievementsWidget } from "@/components/achievements-widget"
import { LiveMatchesWidget } from "@/components/live-matches-widget"

export default function DashboardPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <DashboardHeader />

      {/* Top Row: Stats, Quick Actions, Wallet */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        <div className="lg:col-span-2">
          <StatsOverview />
        </div>
        <div>
          <QuickActions />
        </div>
        <div>
          <WalletWidget />
        </div>
      </div>

      {/* Quick Purchase Section - Full Width */}
      <div className="mb-8">
        <UpgradeOffers />
      </div>

      {/* Personalized Offers - Full Width */}
      <div className="mb-8">
        <PersonalizedOffers />
      </div>

      {/* Middle Row: Notifications, Live Matches, Achievements */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div>
          <NotificationsWidget />
        </div>
        <div>
          <LiveMatchesWidget />
        </div>
        <div>
          <AchievementsWidget />
        </div>
      </div>

      {/* Bottom Row: Recent Predictions, Referral Tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <RecentPredictions />
        <ReferralTracker />
      </div>

      {/* Tips History - Full Width */}
      <TipsHistory />
    </div>
  )
}
