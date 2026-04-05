"use client"

import { useState, useEffect } from "react"
import { Search, TrendingUp, ArrowLeftRight, Zap, Lock, RefreshCw } from "lucide-react"
import { ArbFinderTab } from "@/components/edge-finder/ArbFinderTab"
import { EVScannerTab } from "@/components/edge-finder/EVScannerTab"
import { LineShopTab } from "@/components/edge-finder/LineShopTab"

const TABS = [
  { key: "arb", label: "Arb Finder", icon: ArrowLeftRight, badge: "New" },
  { key: "ev", label: "+EV Scanner", icon: TrendingUp, badge: null },
  { key: "lines", label: "Line Shop", icon: Search, badge: null },
]

export default function EdgeFinderPage() {
  const [activeTab, setActiveTab] = useState("ev")
  const [stats, setStats] = useState<any>(null)
  const [accessDenied, setAccessDenied] = useState(false)
  const [checkingAccess, setCheckingAccess] = useState(true)

  useEffect(() => {
    // Check URL params for tab
    const params = new URLSearchParams(window.location.search)
    const tab = params.get("tab")
    if (tab && TABS.some(t => t.key === tab)) setActiveTab(tab)
  }, [])

  // Check VIP access — Edge Finder requires clv_tracker feature (VIP+)
  useEffect(() => {
    fetch("/api/premium/check")
      .then(r => r.json())
      .then(data => {
        const hasAccess = data.features?.clv_tracker || data.tier === 'admin' || data.tier === 'vip'
        setAccessDenied(!hasAccess)
        setCheckingAccess(false)
      })
      .catch(() => {
        setAccessDenied(true)
        setCheckingAccess(false)
      })
  }, [])

  useEffect(() => {
    // Fetch quick stats
    Promise.all([
      fetch("/api/odds/arbitrage?limit=50").then(r => r.json()),
      fetch("/api/odds/positive-ev?limit=50").then(r => r.json()),
    ]).then(([arbData, evData]) => {
      setStats({
        arbs: arbData.total || 0,
        evBets: evData.total || 0,
        isPremium: arbData.isPremium || evData.isPremium || false,
      })
    }).catch(() => {})
  }, [])

  if (checkingAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    )
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="max-w-md text-center space-y-4 px-4">
          <Lock className="w-12 h-12 text-amber-400 mx-auto" />
          <h2 className="text-2xl font-bold text-white">VIP Feature</h2>
          <p className="text-slate-400">Edge Finder (Arbitrage, +EV Scanner, Line Shopping) is available on the VIP plan.</p>
          <a href="/pricing" className="inline-block px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg transition-colors">
            Upgrade to VIP
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Zap className="w-6 h-6 text-amber-400" />
              Edge Finder
              <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full font-semibold">
                PRO
              </span>
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Arbitrage, +EV bets, and line shopping across 50+ bookmakers
            </p>
          </div>

          {/* Quick stats */}
          {stats && (
            <div className="flex items-center gap-3">
              <div className="px-3 py-1.5 bg-slate-800/60 rounded-lg border border-slate-700/40">
                <span className="text-xs text-slate-400">Near-Arbs: </span>
                <span className="text-sm font-bold text-amber-400">{stats.arbs}</span>
              </div>
              <div className="px-3 py-1.5 bg-slate-800/60 rounded-lg border border-slate-700/40">
                <span className="text-xs text-slate-400">+EV Bets: </span>
                <span className="text-sm font-bold text-emerald-400">{stats.evBets}</span>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-700/50 pb-0">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                activeTab === tab.key
                  ? "text-amber-400 border-amber-400"
                  : "text-slate-400 border-transparent hover:text-slate-200 hover:border-slate-600"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.badge && (
                <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded-full">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "arb" && <ArbFinderTab />}
        {activeTab === "ev" && <EVScannerTab />}
        {activeTab === "lines" && <LineShopTab />}
      </div>
    </div>
  )
}
