"use client"

import { useState } from "react"
import { AdminHeader } from "@/components/admin/admin-header"
import { AdminStats } from "@/components/admin/admin-stats"
import { UserManagement } from "@/components/admin/user-management"
import { PredictionAnalytics } from "@/components/admin/prediction-analytics"
import { AdminSystemMonitoring } from "@/components/admin/system-monitoring"
import { RecentActivity } from "@/components/admin/recent-activity"
import { AdminPredictionManagement } from "@/components/admin-prediction-management"
import { AdminQuickPurchaseManagement } from "@/components/admin-quick-purchase-management" // Import new
import { AdminPersonalizedOffersManagement } from "@/components/admin-personalized-offers-management" // Import new
import { AdminLeagueManagement } from "@/components/admin/league-management" // Import new
import { PredictionQuickPurchaseManager } from "@/components/admin/prediction-quickpurchase-manager" // Import new
import { PricingManagement } from "@/components/admin/pricing-management" // Import new
import { GlobalMatchSync } from "@/components/admin/global-match-sync" // Import new Global Sync
import { MarketSyncButton } from "@/components/admin/market-sync-button" // Import Market Sync Button
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { DollarSign, Target, ChevronDown, ShoppingBag } from "lucide-react"

export default function AdminPage() {
  const [pricingCollapsed, setPricingCollapsed] = useState(true)
  const [availableMatchesCollapsed, setAvailableMatchesCollapsed] = useState(true)
  const [quickPurchaseManagementCollapsed, setQuickPurchaseManagementCollapsed] = useState(true)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <AdminHeader />

        {/* Platform Overview - Full Width */}
        <AdminStats />

        {/* Market Data Sync - Manual Sync Button */}
        <MarketSyncButton />

        {/* System Monitoring - Full Width */}
        <AdminSystemMonitoring />

        {/* Pricing Management Section - Collapsible */}
        <Collapsible open={!pricingCollapsed} onOpenChange={(open) => setPricingCollapsed(!open)}>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
            <CollapsibleTrigger asChild>
              <div className="cursor-pointer hover:bg-slate-700/30 transition-colors px-6 py-4">
                <div className="flex items-center justify-between text-white">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="w-6 h-6 text-emerald-500" />
                    <span className="text-xl font-semibold">Pricing Management</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-slate-400">
                      {pricingCollapsed ? "Click to expand" : "Click to collapse"}
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
                        pricingCollapsed ? "" : "rotate-180"
                      }`}
                    />
                  </div>
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-6 pb-6 pt-2">
                <PricingManagement />
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Global Match Sync Section - Primary sync system */}
        <GlobalMatchSync />

        {/* League Management Section - Specialized management */}
        <AdminLeagueManagement />

        {/* Available Matches Section - Collapsible */}
        <Collapsible open={!availableMatchesCollapsed} onOpenChange={(open) => setAvailableMatchesCollapsed(!open)}>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
            <CollapsibleTrigger asChild>
              <div className="cursor-pointer hover:bg-slate-700/30 transition-colors px-6 py-4">
                <div className="flex items-center justify-between text-white">
                  <div className="flex items-center space-x-2">
                    <Target className="w-6 h-6 text-emerald-500" />
                    <span className="text-xl font-semibold">Available Matches</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-slate-400">
                      {availableMatchesCollapsed ? "Click to expand" : "Click to collapse"}
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
                        availableMatchesCollapsed ? "" : "rotate-180"
                      }`}
                    />
                  </div>
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-6 pb-6 pt-2">
                <PredictionQuickPurchaseManager shouldLoadData={!availableMatchesCollapsed} />
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Prediction Management Section */}
        <AdminPredictionManagement />

        {/* Quick Purchase Management Section - Collapsible */}
        <Collapsible open={!quickPurchaseManagementCollapsed} onOpenChange={(open) => setQuickPurchaseManagementCollapsed(!open)}>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
            <CollapsibleTrigger asChild>
              <div className="cursor-pointer hover:bg-slate-700/30 transition-colors px-6 py-4">
                <div className="flex items-center justify-between text-white">
                  <div className="flex items-center space-x-2">
                    <ShoppingBag className="w-6 h-6 text-emerald-500" />
                    <span className="text-xl font-semibold">Quick Purchase Management</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-slate-400">
                      {quickPurchaseManagementCollapsed ? "Click to expand" : "Click to collapse"}
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
                        quickPurchaseManagementCollapsed ? "" : "rotate-180"
                      }`}
                    />
                  </div>
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-6 pb-6 pt-2">
                <AdminQuickPurchaseManagement shouldLoadData={!quickPurchaseManagementCollapsed} />
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Personalized Offers Management Section */}
        <AdminPersonalizedOffersManagement />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <UserManagement />
          <PredictionAnalytics />
        </div>

        <RecentActivity />
      </div>
    </div>
  )
}
