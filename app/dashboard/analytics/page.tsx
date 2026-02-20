"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import {
  TrendingUp,
  Target,
  BarChart3,
  PieChart,
  Activity,
  Award,
  Zap,
  Clock,
  Loader2,
  RefreshCw,
  TrendingDown,
  Minus,
} from "lucide-react"
import { PremiumGate } from "@/components/premium-gate"
import Link from "next/link"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalyticsSummary {
  total: number
  won: number
  lost: number
  pending: number
  voided: number
  winRate: number
  roi: number
  totalStake: number
  totalReturn: number
  totalProfit: number
  avgOdds: number
  bestStreak: number
  currentStreak: number
}

interface MonthlyStat {
  month: string
  profit: number
  bets: number
  winRate: number
}

interface CategoryStat {
  category: string
  bets: number
  winRate: number
  profit: number
}

interface AnalyticsData {
  summary: AnalyticsSummary
  monthlyStats: MonthlyStat[]
  categoryPerformance: CategoryStat[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Formats a decimal as a signed percentage string */
function fmtRoi(roi: number): string {
  const sign = roi >= 0 ? "+" : ""
  return `${sign}${roi.toFixed(1)}%`
}

/** Returns currency-formatted profit with sign */
function fmtProfit(n: number): string {
  const sign = n >= 0 ? "+" : "-"
  return `${sign}$${Math.abs(n).toFixed(2)}`
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [hasPremiumAccess, setHasPremiumAccess] = useState<boolean | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [timeframe, setTimeframe] = useState("month")
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check premium access
  useEffect(() => {
    async function checkAccess() {
      try {
        const [sessionRes, premRes] = await Promise.all([
          fetch("/api/auth/session", { cache: "no-store", credentials: "include" }),
          fetch("/api/premium/check"),
        ])
        const session = await sessionRes.json()
        setIsAdmin(session?.user?.role?.toLowerCase() === "admin")
        if (premRes.ok) {
          const prem = await premRes.json()
          setHasPremiumAccess(prem.hasAccess)
        } else {
          setHasPremiumAccess(false)
        }
      } catch {
        setHasPremiumAccess(false)
      }
    }
    checkAccess()
  }, [])

  // Fetch real analytics data
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/user/analytics?timeframe=${timeframe}`, {
          credentials: "include",
        })
        if (res.ok) {
          setData(await res.json())
        }
      } catch {
        /* handled by empty state */
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [timeframe])

  if (hasPremiumAccess === false && !isAdmin) {
    return (
      <PremiumGate
        title="Premium Analytics"
        description="Unlock deep insights into your betting performance, trends, and strategy analysis."
        featureName="Performance Analytics"
      />
    )
  }

  const s = data?.summary
  const monthly = data?.monthlyStats ?? []
  const categories = data?.categoryPerformance ?? []

  const maxMonthlyProfit = Math.max(...monthly.map(m => Math.abs(m.profit)), 1)
  const bestCategory = categories[0]
  const worstCategory = [...categories].sort((a, b) => a.winRate - b.winRate)[0]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Performance Analytics</h1>
            <p className="text-slate-400">Deep insights from your saved bets &amp; real results</p>
          </div>
          <Tabs value={timeframe} onValueChange={setTimeframe}>
            <TabsList className="bg-slate-800 border-slate-700">
              <TabsTrigger value="week" className="data-[state=active]:bg-emerald-600 text-xs">7 Days</TabsTrigger>
              <TabsTrigger value="month" className="data-[state=active]:bg-emerald-600 text-xs">30 Days</TabsTrigger>
              <TabsTrigger value="year" className="data-[state=active]:bg-emerald-600 text-xs">1 Year</TabsTrigger>
              <TabsTrigger value="all" className="data-[state=active]:bg-emerald-600 text-xs">All Time</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* ── Loading ───────────────────────────────────────────────── */}
        {isLoading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          </div>
        )}

        {!isLoading && s && (
          <>
            {/* ── Key Metrics ───────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {/* Win Rate */}
              <Card className="bg-slate-800/50 border-slate-700 p-5">
                <div className="flex items-center justify-between mb-3">
                  <Target className="w-7 h-7 text-emerald-400" />
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                    {s.won}W/{s.lost}L
                  </Badge>
                </div>
                <h3 className="text-2xl font-bold text-white">{s.winRate}%</h3>
                <p className="text-slate-400 text-sm">Win Rate</p>
                <Progress value={s.winRate} className="mt-2 h-1.5" />
              </Card>

              {/* Total Bets */}
              <Card className="bg-slate-800/50 border-slate-700 p-5">
                <div className="flex items-center justify-between mb-3">
                  <BarChart3 className="w-7 h-7 text-blue-400" />
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                    {s.pending} pending
                  </Badge>
                </div>
                <h3 className="text-2xl font-bold text-white">{s.total}</h3>
                <p className="text-slate-400 text-sm">Total Bets</p>
              </Card>

              {/* Profit / Loss */}
              <Card className="bg-slate-800/50 border-slate-700 p-5">
                <div className="flex items-center justify-between mb-3">
                  <Award className="w-7 h-7 text-amber-400" />
                  <Badge
                    className={cn(
                      "text-xs",
                      s.roi >= 0
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        : "bg-red-500/20 text-red-400 border-red-500/30"
                    )}
                  >
                    {fmtRoi(s.roi)} ROI
                  </Badge>
                </div>
                <h3
                  className={cn(
                    "text-2xl font-bold",
                    s.totalProfit >= 0 ? "text-emerald-400" : "text-red-400"
                  )}
                >
                  {fmtProfit(s.totalProfit)}
                </h3>
                <p className="text-slate-400 text-sm">Net Profit</p>
              </Card>

              {/* Streak */}
              <Card className="bg-slate-800/50 border-slate-700 p-5">
                <div className="flex items-center justify-between mb-3">
                  <Zap className="w-7 h-7 text-purple-400" />
                  <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">
                    Current
                  </Badge>
                </div>
                <h3 className="text-2xl font-bold text-white">{s.currentStreak}</h3>
                <p className="text-slate-400 text-sm">Win Streak</p>
                <p className="text-xs text-purple-400 mt-1">Best: {s.bestStreak} wins</p>
              </Card>
            </div>

            {/* ── Secondary stats ───────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-400 mb-1">Avg Odds</p>
                <p className="text-lg font-bold text-white">{s.avgOdds.toFixed(2)}</p>
              </div>
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-400 mb-1">Total Staked</p>
                <p className="text-lg font-bold text-white">${s.totalStake.toFixed(2)}</p>
              </div>
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-400 mb-1">Total Returns</p>
                <p className="text-lg font-bold text-emerald-400">${s.totalReturn.toFixed(2)}</p>
              </div>
            </div>

            {/* ── Charts ────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Monthly Performance */}
              <Card className="bg-slate-800/50 border-slate-700 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-white">Monthly Performance</h3>
                  <Activity className="w-5 h-5 text-emerald-400" />
                </div>
                {monthly.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-8">No data for this period</p>
                ) : (
                  <div className="space-y-4">
                    {monthly.map(m => {
                      const barWidth = (Math.abs(m.profit) / maxMonthlyProfit) * 100
                      const positive = m.profit >= 0
                      return (
                        <div key={m.month} className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-700/60 rounded-lg flex items-center justify-center text-xs font-semibold text-slate-300 shrink-0">
                            {m.month}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between text-xs mb-1">
                              <span className={positive ? "text-emerald-400" : "text-red-400"}>
                                {fmtProfit(m.profit)}
                              </span>
                              <span className="text-slate-400">
                                {m.bets} bets · {m.winRate}%
                              </span>
                            </div>
                            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  positive ? "bg-emerald-500" : "bg-red-500"
                                )}
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>

              {/* Category Performance */}
              <Card className="bg-slate-800/50 border-slate-700 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-white">Performance by Market</h3>
                  <PieChart className="w-5 h-5 text-emerald-400" />
                </div>
                {categories.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-8">Place some bets to see market breakdown</p>
                ) : (
                  <div className="space-y-4">
                    {categories.map(cat => (
                      <div key={cat.category} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-white font-medium truncate">{cat.category}</span>
                          <span className="text-emerald-400 ml-2 shrink-0">{cat.winRate}%</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>{cat.bets} bets</span>
                          <span className={cat.profit >= 0 ? "text-emerald-400" : "text-red-400"}>
                            {fmtProfit(cat.profit)}
                          </span>
                        </div>
                        <Progress value={cat.winRate} className="h-1.5" />
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* ── Insights ──────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="bg-gradient-to-br from-emerald-600/15 to-cyan-600/15 border-emerald-500/30 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                  </div>
                  <h3 className="text-white font-semibold">Best Market</h3>
                </div>
                {bestCategory ? (
                  <>
                    <p className="text-slate-300 text-sm mb-3">
                      <span className="text-emerald-400 font-medium">{bestCategory.category}</span> is your
                      strongest market with <span className="text-white font-medium">{bestCategory.winRate}%</span> win rate.
                    </p>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                      {bestCategory.bets} bets tracked
                    </Badge>
                  </>
                ) : (
                  <p className="text-slate-400 text-sm">Place more bets to see your best market.</p>
                )}
              </Card>

              <Card className="bg-gradient-to-br from-amber-600/15 to-orange-600/15 border-amber-500/30 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 bg-amber-500/20 rounded-xl flex items-center justify-center">
                    <Clock className="w-5 h-5 text-amber-400" />
                  </div>
                  <h3 className="text-white font-semibold">Needs Work</h3>
                </div>
                {worstCategory && worstCategory !== bestCategory ? (
                  <>
                    <p className="text-slate-300 text-sm mb-3">
                      <span className="text-amber-400 font-medium">{worstCategory.category}</span> has the
                      lowest win rate at <span className="text-white font-medium">{worstCategory.winRate}%</span>.
                    </p>
                    <Link href="/dashboard/matches">
                      <Button variant="outline" size="sm" className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10 text-xs">
                        Find Better Picks
                      </Button>
                    </Link>
                  </>
                ) : (
                  <p className="text-slate-400 text-sm">Keep tracking your bets to spot improvement areas.</p>
                )}
              </Card>

              <Card className="bg-gradient-to-br from-purple-600/15 to-pink-600/15 border-purple-500/30 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 bg-purple-500/20 rounded-xl flex items-center justify-center">
                    <Award className="w-5 h-5 text-purple-400" />
                  </div>
                  <h3 className="text-white font-semibold">Performance</h3>
                </div>
                <p className="text-slate-300 text-sm mb-3">
                  ROI of <span className={cn("font-semibold", s.roi >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {fmtRoi(s.roi)}
                  </span>{" "}
                  over {s.total} tracked bets. Keep saving bets to build your history.
                </p>
                <Link href="/dashboard/saved-bets">
                  <Button variant="outline" size="sm" className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10 text-xs">
                    View Saved Bets
                  </Button>
                </Link>
              </Card>
            </div>
          </>
        )}

        {/* ── Empty state ───────────────────────────────────────────── */}
        {!isLoading && !s && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <BarChart3 className="w-16 h-16 text-slate-600 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Betting Data Yet</h3>
            <p className="text-slate-400 max-w-sm mb-6">
              Start saving bets from the match pages to see your performance analytics here.
            </p>
            <Link href="/dashboard/matches">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Browse Matches
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
