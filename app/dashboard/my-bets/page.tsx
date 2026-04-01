"use client"

import { useState, Suspense, lazy } from "react"
import { History, Users, Bookmark, BarChart3, Loader2 } from "lucide-react"

// Lazy-load each tab content to avoid loading 2500+ lines upfront
const BetHistory = lazy(() => import("./BetHistory"))
const MyTipsContent = lazy(() => import("../my-tips/page"))
const SavedBetsContent = lazy(() => import("../saved-bets/page"))
const AnalyticsContent = lazy(() => import("../analytics/page"))

const tabs = [
  { id: "history", label: "Bet History", icon: History },
  { id: "tips", label: "My Tips", icon: Users },
  { id: "saved", label: "Saved", icon: Bookmark },
  { id: "stats", label: "Stats", icon: BarChart3 },
]

function TabSkeleton() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
    </div>
  )
}

export default function MyBetsPage() {
  const [activeTab, setActiveTab] = useState("history")

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">My Bets</h1>
        <p className="text-sm text-slate-400 mt-1">Track your bets, tips, saved picks, and performance</p>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 p-1 bg-slate-800/50 rounded-lg border border-slate-700/50 w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                isActive
                  ? "bg-emerald-500/20 text-emerald-300 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <Suspense fallback={<TabSkeleton />}>
        {activeTab === "history" && <BetHistory />}
        {activeTab === "tips" && <MyTipsContent />}
        {activeTab === "saved" && <SavedBetsContent />}
        {activeTab === "stats" && <AnalyticsContent />}
      </Suspense>
    </div>
  )
}
