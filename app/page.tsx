"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Brain, 
  TrendingUp, 
  Target, 
  Zap, 
  Shield, 
  Clock, 
  Star, 
  CheckCircle, 
  BarChart3,
  Trophy,
  Users,
  ArrowRight,
  PlayCircle,
  Activity,
  DollarSign,
  Timer,
  Sparkles,
  Crown,
  Calculator,
  RefreshCw,
  Eye,
  LineChart,
  ChevronRight,
  Flame,
  Layers,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { QuizSection } from "@/components/quiz-section"
import { OddsPredictionTable } from "@/components/ui/odds-prediction-table"
import { MarqueeTicker } from "@/components/marquee-ticker"
import { MultisportMatchTable } from "@/components/multisport/MultisportMatchTable"
import { SnapBetPicksSection } from "@/components/snapbet-picks/SnapBetPicksSection"
import { SoccerMatchGrid } from "@/components/multisport/SoccerMatchGrid"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Feature {
  icon: React.ReactElement
  title: string
  description: string
  highlight?: string
  accentColor: string
  glowColor: string
}

interface Stat {
  value: string
  label: string
  trend?: string
  color: string
  iconBg: string
  icon: React.ReactElement
}

/** A lightweight match preview for the hero section. */
interface HeroMatch {
  id: string
  home: string
  away: string
  league: string
  homeLogo?: string
  awayLogo?: string
  kickoff: string
  aiPick: string
  confidence: number
  odds: string
  isLive: boolean
}

/** A lightweight parlay preview for the hero section. */
interface HeroParlay {
  id: string
  legs: number
  combinedOdds: string
  confidence: string
  tier: string
  matches: string[]
}

/**
 * HomePage — modern gradient design with live match previews, AI parlay
 * highlights, animated hero, and background depth blobs.
 *
 * Auth check is server-side via /api/auth/session for fast, non-blocking decisions.
 */
export default function HomePage() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [isPremium, setIsPremium] = useState<boolean>(false)
  const [heroMatches, setHeroMatches] = useState<HeroMatch[]>([])
  const [heroParlays, setHeroParlays] = useState<HeroParlay[]>([])
  const [activeMatchIdx, setActiveMatchIdx] = useState(0)
  const [liveStats, setLiveStats] = useState({
    activeOpportunities: 47,
    avgConfidence: 82,
    liveMatches: 23,
  })
  const [selectedSport, setSelectedSport] = useState<string>("soccer")

  // ── Auth check ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store", credentials: "include" })
        const session = await res.json()
        setIsAuthenticated(!!session?.user)
        if (session?.user) {
          try {
            const premiumRes = await fetch("/api/premium/check", { cache: "no-store", credentials: "include" })
            if (premiumRes.ok) {
              const premiumData = await premiumRes.json()
              setIsPremium(!!premiumData.hasAccess)
            }
          } catch {}
        }
      } catch {
        setIsAuthenticated(false)
      }
    }
    checkAuth()
  }, [])

  // ── Fetch hero data: live/upcoming matches + AI parlays ─────────────────────
  useEffect(() => {
    const fetchHeroData = async () => {
      try {
        // Fetch matches (live first, fall back to upcoming)
        const [liveRes, upcomingRes, parlayRes] = await Promise.allSettled([
          fetch("/api/market?status=live&mode=lite&limit=4"),
          fetch("/api/market?status=upcoming&mode=lite&limit=6"),
          fetch("/api/parlays?limit=3&parlay_type=cross_league&min_edge=0&tradable_only=false"),
        ])

        // Process matches
        const allMatches: HeroMatch[] = []
        const processMatches = (data: { matches?: Array<Record<string, unknown>> }, isLive: boolean) => {
          if (!data?.matches) return
          for (const m of data.matches) {
            const home = m.home as { name?: string; logo_url?: string } | undefined
            const away = m.away as { name?: string; logo_url?: string } | undefined
            const league = m.league as { name?: string } | undefined
            const odds = m.odds as { consensus?: { home?: number; draw?: number; away?: number } } | undefined

            if (!home?.name || !away?.name || home.name === "TBD" || away.name === "TBD") continue

            const homeProb = odds?.consensus?.home ?? 0
            const drawProb = odds?.consensus?.draw ?? 0
            const awayProb = odds?.consensus?.away ?? 0
            const maxProb = Math.max(homeProb, drawProb, awayProb)
            const aiPick = maxProb === homeProb ? home.name : maxProb === awayProb ? away.name : "Draw"
            const conf = Math.round(maxProb * 100)
            const impliedOdds = maxProb > 0 ? (1 / maxProb).toFixed(2) : "—"

            allMatches.push({
              id: String(m.match_id ?? m.id),
              home: home.name,
              away: away.name,
              league: league?.name ?? "Football",
              homeLogo: home.logo_url ?? undefined,
              awayLogo: away.logo_url ?? undefined,
              kickoff: String(m.kickoff_at ?? m.matchDate ?? ""),
              aiPick,
              confidence: conf,
              odds: impliedOdds,
              isLive,
            })
          }
        }

        if (liveRes.status === "fulfilled") {
          const liveData = await liveRes.value.json()
          processMatches(liveData, true)
        }
        if (upcomingRes.status === "fulfilled") {
          const upData = await upcomingRes.value.json()
          processMatches(upData, false)
        }
        setHeroMatches(allMatches.slice(0, 6))

        // Process parlays
        if (parlayRes.status === "fulfilled") {
          const parlayData = await parlayRes.value.json()
          const parlays: HeroParlay[] = (parlayData.parlays ?? []).slice(0, 3).map((p: Record<string, unknown>) => {
            const legs = p.legs as Array<{ home_team?: string; away_team?: string }> | undefined
            return {
              id: String(p.parlay_id),
              legs: Number(p.leg_count ?? 0),
              combinedOdds: Number(p.implied_odds ?? 0).toFixed(2),
              confidence: String(p.confidence_tier ?? "medium"),
              tier: String(p.confidence_tier ?? "medium"),
              matches: (legs ?? []).map(
                (l) => `${l.home_team ?? "?"} vs ${l.away_team ?? "?"}`
              ),
            }
          })
          setHeroParlays(parlays)
        }
      } catch {
        // Silent — hero data is non-critical
      }
    }
    fetchHeroData()
  }, [])

  // ── Rotate active match card every 4 seconds ───────────────────────────────
  useEffect(() => {
    if (heroMatches.length <= 1) return
    const interval = setInterval(() => {
      setActiveMatchIdx((prev) => (prev + 1) % heroMatches.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [heroMatches.length])

  // ── Simulate live stats updates ─────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveStats((prev) => ({
        activeOpportunities: Math.max(20, prev.activeOpportunities + Math.floor(Math.random() * 5) - 2),
        avgConfidence: Math.max(75, Math.min(95, prev.avgConfidence + Math.floor(Math.random() * 3) - 1)),
        liveMatches: Math.max(5, prev.liveMatches + Math.floor(Math.random() * 3) - 1),
      }))
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const SOURCE_TO_PLAN: Record<string, string> = {
    pricing_pro: "pro_monthly",
    pricing_vip: "vip_monthly",
  }

  const handleCTAClick = async (source: string) => {
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store", credentials: "include" })
      const session = await res.json()
      if (session?.user) {
        const planId = SOURCE_TO_PLAN[source]
        router.push(planId ? `/subscribe/${planId}` : "/dashboard")
      } else {
        router.push(`/signup?source=${source}`)
      }
    } catch {
      router.push(`/signup?source=${source}`)
    }
  }

  /** Returns relative time string like "In 2h", "Tomorrow", or "LIVE" */
  const getRelativeTime = (iso: string, isLive: boolean): string => {
    if (isLive) return "LIVE"
    const diff = new Date(iso).getTime() - Date.now()
    if (diff < 0) return "Starting soon"
    const h = Math.floor(diff / 3_600_000)
    const m = Math.floor((diff % 3_600_000) / 60_000)
    if (h >= 24) return `In ${Math.ceil(h / 24)}d`
    if (h > 0) return `In ${h}h ${m}m`
    return `In ${m}m`
  }

  /** Confidence colour band */
  const getConfColor = (conf: number) =>
    conf >= 70 ? "text-emerald-400" : conf >= 55 ? "text-yellow-400" : "text-slate-400"
  const getConfBg = (conf: number) =>
    conf >= 70 ? "bg-emerald-500/20 border-emerald-500/30" : conf >= 55 ? "bg-yellow-500/20 border-yellow-500/30" : "bg-slate-500/20 border-slate-500/30"

  const keyFeatures: Feature[] = [
    {
      icon: <Activity className="h-7 w-7 text-emerald-400" />,
      title: "Real-time CLV Tracker",
      description: "Monitor Closing Line Value opportunities as they happen. Get confidence scores, Kelly stake recommendations, and optimal bet sizing.",
      highlight: "🎯 Just Released",
      accentColor: "border-l-emerald-500/60",
      glowColor: "hover:shadow-emerald-900/30",
    },
    {
      icon: <Brain className="h-7 w-7 text-blue-400" />,
      title: "AI-Powered Predictions",
      description: "Advanced machine learning algorithms analyze thousands of data points to generate predictions with 70-95% confidence scores.",
      highlight: "🧠 ML-Driven",
      accentColor: "border-l-blue-500/60",
      glowColor: "hover:shadow-blue-900/30",
    },
    {
      icon: <Calculator className="h-7 w-7 text-purple-400" />,
      title: "Kelly Criterion Staking",
      description: "Automatically calculate optimal bet sizes using the Kelly Criterion. Half-Kelly recommendations for risk management.",
      highlight: "📊 Bankroll Optimization",
      accentColor: "border-l-purple-500/60",
      glowColor: "hover:shadow-purple-900/30",
    },
    {
      icon: <LineChart className="h-7 w-7 text-orange-400" />,
      title: "Value Rating System",
      description: "Every prediction comes with a value rating (Low, Medium, High, Very High) to help you prioritize the best opportunities.",
      highlight: "💎 Value-Based Betting",
      accentColor: "border-l-orange-500/60",
      glowColor: "hover:shadow-orange-900/30",
    },
    {
      icon: <RefreshCw className="h-7 w-7 text-teal-400" />,
      title: "Live Data Updates",
      description: "Real-time match data, odds tracking, and opportunity alerts. Never miss a value bet with 30-second refresh cycles.",
      highlight: "⚡ Real-time Updates",
      accentColor: "border-l-teal-500/60",
      glowColor: "hover:shadow-teal-900/30",
    },
    {
      icon: <Shield className="h-7 w-7 text-red-400" />,
      title: "Risk Management Tools",
      description: "Built-in risk controls, confidence thresholds, and stake limits to protect your bankroll while maximising returns.",
      highlight: "🛡️ Bankroll Protection",
      accentColor: "border-l-red-500/60",
      glowColor: "hover:shadow-red-900/30",
    }
  ]

  const platformStats: Stat[] = [
    {
      value: "65–75%",
      label: "V2 Model Confidence Range",
      color: "text-emerald-400",
      iconBg: "bg-emerald-500/10",
      icon: <Target className="h-5 w-5 text-emerald-400" />,
    },
    {
      value: "2.3×",
      label: "Average ROI Improvement",
      trend: "+23% this month",
      color: "text-blue-400",
      iconBg: "bg-blue-500/10",
      icon: <TrendingUp className="h-5 w-5 text-blue-400" />,
    },
    {
      value: "1000+",
      label: "CLV Opportunities Found",
      trend: "Value opportunities identified",
      color: "text-purple-400",
      iconBg: "bg-purple-500/10",
      icon: <BarChart3 className="h-5 w-5 text-purple-400" />,
    },
    {
      value: "450",
      label: "AI Predictions This Week",
      trend: "Soccer predictions generated",
      color: "text-orange-400",
      iconBg: "bg-orange-500/10",
      icon: <Brain className="h-5 w-5 text-orange-400" />,
    }
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">

      {/* ── Background depth blobs ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-emerald-500/[0.03] rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-blue-500/[0.03] rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/2 w-[400px] h-[400px] bg-purple-500/[0.03] rounded-full blur-3xl" />
      </div>

      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden pt-10 pb-6 sm:pt-16 sm:pb-10 lg:pt-20 lg:pb-14">
        {/* Animated accent orbs */}
        <div className="absolute -top-32 left-1/4 w-[500px] h-[500px] bg-emerald-500/[0.06] rounded-full blur-[100px] animate-pulse pointer-events-none" />
        <div className="absolute top-20 right-0 w-[400px] h-[400px] bg-blue-500/[0.05] rounded-full blur-[100px] animate-pulse pointer-events-none" style={{ animationDelay: "1.5s" }} />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-purple-500/[0.04] rounded-full blur-[80px] animate-pulse pointer-events-none" style={{ animationDelay: "3s" }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12 items-start">

            {/* ── Left column: Copy + CTA ── */}
            <div className="lg:col-span-3 pt-4 lg:pt-8">
              {/* Floating badges */}
              <div className="flex flex-wrap items-center gap-2 mb-5">
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs px-3 py-1 animate-[fadeIn_0.5s_ease-out]">
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI-Powered
                </Badge>
                <Badge className="bg-blue-500/15 text-blue-300 border-blue-500/25 text-xs px-3 py-1 animate-[fadeIn_0.5s_0.2s_ease-out_both]">
                  <Activity className="h-3 w-3 mr-1 animate-pulse" />
                  {liveStats.liveMatches} Live Matches
                </Badge>
                {heroParlays.length > 0 && (
                  <Badge className="bg-purple-500/15 text-purple-300 border-purple-500/25 text-xs px-3 py-1 animate-[fadeIn_0.5s_0.4s_ease-out_both]">
                    <Layers className="h-3 w-3 mr-1" />
                    {heroParlays.length} AI Parlays
                  </Badge>
                )}
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mb-5 leading-[1.1] tracking-tight">
                Smart Bets,{" "}
                <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-blue-400 bg-clip-text text-transparent">
                  Real Edge
                </span>
              </h1>

              <p className="text-base sm:text-lg text-slate-400 mb-8 max-w-xl leading-relaxed">
                Our AI analyses thousands of data points per match to surface the bets worth taking, with 
                confidence scores, Kelly sizing, and real-time CLV tracking.
              </p>

              {/* Live stats row */}
              <div className="flex flex-wrap gap-5 mb-8">
                {[
                  { icon: <Flame className="h-4 w-4" />, value: liveStats.activeOpportunities, label: "Value Bets", color: "text-orange-400", bg: "bg-orange-500/10" },
                  { icon: <Target className="h-4 w-4" />, value: `${liveStats.avgConfidence}%`, label: "Avg Confidence", color: "text-emerald-400", bg: "bg-emerald-500/10" },
                  { icon: <TrendingUp className="h-4 w-4" />, value: "2.3×", label: "Avg ROI", color: "text-blue-400", bg: "bg-blue-500/10" },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className={`p-1.5 ${s.bg} rounded-lg`}>
                      <span className={s.color}>{s.icon}</span>
                    </div>
                    <div>
                      <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                      <div className="text-[11px] text-slate-500 uppercase tracking-wide font-medium">{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* CTA buttons */}
              <div className="flex flex-col sm:flex-row gap-3 mb-6 lg:mb-0">
                <Button
                  size="lg"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3.5 text-base font-semibold shadow-lg shadow-emerald-900/40 hover:shadow-emerald-800/60 hover:scale-[1.02] transition-all"
                  onClick={() => handleCTAClick("hero_primary")}
                >
                  <Zap className="h-5 w-5 mr-2" />
                  Start Free Trial
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-slate-700 text-slate-300 hover:bg-slate-800/60 hover:border-slate-500 hover:text-white px-8 py-3.5 text-base transition-all"
                  onClick={() => router.push(isAuthenticated ? "/dashboard/matches" : "/matches")}
                >
                  <Eye className="h-5 w-5 mr-2" />
                  View Live Predictions
                </Button>
              </div>
            </div>

            {/* ── Right column: Live match preview cards ── */}
            <div className="lg:col-span-2 space-y-3">
              {/* Section label */}
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Today&apos;s AI Picks</span>
              </div>

              {/* Match preview cards */}
              {heroMatches.length > 0 ? (
                heroMatches.slice(0, 4).map((match, idx) => (
                  <div
                    key={match.id}
                    className={`group relative bg-slate-800/60 border rounded-xl p-3.5 cursor-pointer transition-all duration-300 ${
                      idx === activeMatchIdx
                        ? "border-emerald-500/40 shadow-lg shadow-emerald-900/20 scale-[1.01]"
                        : "border-slate-700/50 hover:border-slate-600/60 hover:bg-slate-800/80"
                    }`}
                    onClick={() => router.push(isAuthenticated ? "/dashboard/matches" : "/matches")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      {/* Teams */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {match.homeLogo && (
                            <img src={match.homeLogo} alt="" className="w-5 h-5 rounded-full object-cover" />
                          )}
                          <span className="text-sm font-semibold text-white truncate">{match.home}</span>
                          <span className="text-slate-600 text-xs">vs</span>
                          {match.awayLogo && (
                            <img src={match.awayLogo} alt="" className="w-5 h-5 rounded-full object-cover" />
                          )}
                          <span className="text-sm font-semibold text-white truncate">{match.away}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="text-slate-500 truncate">{match.league}</span>
                          <span className="text-slate-700">•</span>
                          {match.isLive ? (
                            <span className="flex items-center gap-1 text-red-400 font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                              LIVE
                            </span>
                          ) : (
                            <span className="text-slate-500">{getRelativeTime(match.kickoff, false)}</span>
                          )}
                        </div>
                      </div>

                      {/* AI Pick + Confidence */}
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <Badge className={`${getConfBg(match.confidence)} border text-[10px] px-2 py-0.5`}>
                          <Brain className="h-2.5 w-2.5 mr-1" />
                          <span className={getConfColor(match.confidence)}>{match.confidence}%</span>
                        </Badge>
                        <span className="text-[10px] text-slate-500 truncate max-w-[90px]">
                          AI: {match.aiPick}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                /* Skeleton loading cards */
                Array.from({ length: 3 }).map((_, idx) => (
                  <div key={idx} className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-3.5 animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-700/60 rounded w-3/4" />
                        <div className="h-3 bg-slate-700/40 rounded w-1/2" />
                      </div>
                      <div className="h-5 w-14 bg-slate-700/50 rounded" />
                    </div>
                  </div>
                ))
              )}

              {/* AI Parlays mini-strip */}
              {heroParlays.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-700/40">
                  <div className="flex items-center gap-2 mb-2">
                    <Layers className="h-3.5 w-3.5 text-purple-400" />
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Hot AI Parlays</span>
                  </div>
                  <div className="space-y-2">
                    {heroParlays.map((parlay) => (
                      <div
                        key={parlay.id}
                        className="group bg-gradient-to-r from-purple-500/5 to-emerald-500/5 border border-purple-500/20 rounded-lg p-2.5 cursor-pointer hover:border-purple-400/40 transition-all"
                        onClick={() => router.push(isAuthenticated ? "/dashboard/parlays" : "/signup?source=parlay_hero")}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/15 rounded text-[10px] font-bold text-purple-300">
                              {parlay.legs}-LEG
                            </div>
                            <span className="text-xs text-slate-400 truncate">
                              {parlay.matches.slice(0, 2).join(" • ")}
                              {parlay.matches.length > 2 && ` +${parlay.matches.length - 2}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-sm font-bold text-emerald-400">{parlay.combinedOdds}×</span>
                            <ChevronRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* View all CTA */}
              <button
                onClick={() => router.push(isAuthenticated ? "/dashboard/matches" : "/matches")}
                className="w-full text-center text-xs text-slate-500 hover:text-emerald-400 py-2 transition-colors"
              >
                View all matches & predictions →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Marquee Ticker ── */}
      <MarqueeTicker />

      {/* ── SnapBet Picks (Premium Curated) ── */}
      <section className="py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <SnapBetPicksSection limit={6} />
        </div>
      </section>

      {/* ── Sport Tabs + Matches ── */}
      <section className="py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Sport tab bar */}
          <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
            {[
              { key: "soccer", label: "Soccer", icon: "⚽" },
              { key: "basketball_nba", label: "NBA", icon: "🏀" },
              { key: "icehockey_nhl", label: "NHL", icon: "🏒" },
              { key: "basketball_ncaab", label: "NCAAB", icon: "🏀" },
            ].map((sport) => (
              <button
                key={sport.key}
                onClick={() => setSelectedSport(sport.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  selectedSport === sport.key
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:text-slate-200 hover:border-slate-600/60"
                }`}
              >
                <span>{sport.icon}</span>
                {sport.label}
              </button>
            ))}
          </div>

          {selectedSport === "soccer" ? (
            <>
              {/* Soccer: Live + Upcoming card grids */}
              <div className="space-y-8">
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-red-500/10 rounded-xl border border-red-500/20">
                      <Activity className="h-5 w-5 text-red-400" />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-white">Live Matches</h2>
                      <p className="text-slate-400 text-sm">Real-time match updates</p>
                    </div>
                    <span className="ml-auto flex items-center gap-1.5 text-xs text-red-400 font-medium">
                      <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                      LIVE
                    </span>
                  </div>
                  <SoccerMatchGrid status="live" limit={10} />
                </div>

                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                      <Clock className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-white">Upcoming Matches</h2>
                      <p className="text-slate-400 text-sm">Get ready for these exciting fixtures</p>
                    </div>
                  </div>
                  <SoccerMatchGrid status="upcoming" limit={20} />
                </div>
              </div>
            </>
          ) : (
            /* Non-soccer sport: show multisport grid */
            <div className="space-y-8">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                    <Clock className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white">Upcoming</h2>
                    <p className="text-slate-400 text-sm">AI predictions for upcoming games</p>
                  </div>
                </div>
                <MultisportMatchTable sport={selectedSport} status="upcoming" limit={20} />
              </div>

              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-slate-500/10 rounded-xl border border-slate-500/20">
                    <Trophy className="h-5 w-5 text-slate-400" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white">Recent Results</h2>
                    <p className="text-slate-400 text-sm">See how the model performed</p>
                  </div>
                </div>
                <MultisportMatchTable sport={selectedSport} status="finished" limit={10} />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Pricing Preview (hidden for premium subscribers) ── */}
      {isPremium ? (
        <section className="py-12 sm:py-16 bg-slate-900/30">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="bg-gradient-to-r from-emerald-500/10 via-emerald-600/5 to-transparent border border-emerald-500/20 rounded-2xl p-8 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/15 rounded-full text-emerald-400 text-sm font-semibold mb-4">
                <CheckCircle className="w-4 h-4" /> Active Subscription
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">You're All Set</h2>
              <p className="text-slate-400 mb-6">You have full access to premium predictions, parlays, and analytics.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => router.push("/dashboard/matches")}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-sm transition-colors"
                >
                  View All Predictions
                </button>
                <button
                  onClick={() => router.push("/dashboard/parlays")}
                  className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold text-sm transition-colors"
                >
                  AI Parlays
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="py-12 sm:py-16 bg-slate-900/30">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Simple Pricing</h2>
              <p className="text-slate-400">Two plans. Full access. Cancel anytime.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
              {/* Pro */}
              <div className="bg-slate-800/60 border border-emerald-500/30 rounded-xl p-6 text-center hover:border-emerald-500/60 transition-all">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 rounded-full text-emerald-400 text-xs font-semibold mb-3">
                  <Crown className="w-3 h-3" /> MOST POPULAR
                </div>
                <h3 className="text-xl font-bold text-white mb-1">Pro</h3>
                <div className="text-3xl font-bold text-white mb-1">$19.99<span className="text-sm text-slate-400 font-normal">/mo</span></div>
                <p className="text-slate-400 text-sm mb-4">Unlimited picks across all sports</p>
                <ul className="text-sm text-slate-300 space-y-1.5 mb-5 text-left">
                  <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />All sports predictions</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />Full match analysis</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />AI parlays & player picks</li>
                </ul>
                <button onClick={() => handleCTAClick('pricing_pro')} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-sm transition-colors">
                  Get Pro
                </button>
              </div>
              {/* VIP */}
              <div className="bg-slate-800/60 border border-amber-500/30 rounded-xl p-6 text-center hover:border-amber-500/60 transition-all">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 rounded-full text-amber-400 text-xs font-semibold mb-3">
                  <Crown className="w-3 h-3" /> ALL ACCESS
                </div>
                <h3 className="text-xl font-bold text-white mb-1">VIP</h3>
                <div className="text-3xl font-bold text-white mb-1">$39.99<span className="text-sm text-slate-400 font-normal">/mo</span></div>
                <p className="text-slate-400 text-sm mb-4">Everything + power tools</p>
                <ul className="text-sm text-slate-300 space-y-1.5 mb-5 text-left">
                  <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />Everything in Pro</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />Edge Finder & AI Builder</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />50+ bookmaker odds</li>
                </ul>
                <button onClick={() => handleCTAClick('pricing_vip')} className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black rounded-lg font-semibold text-sm transition-colors">
                  Get VIP
                </button>
              </div>
            </div>
            <p className="text-center text-slate-500 text-xs mt-4">
              <a href="/pricing" className="text-emerald-400 hover:underline">View full comparison →</a>
            </p>
          </div>
        </section>
      )}

      {/* ── Platform Stats ── */}
      <section className="py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Platform Performance</h2>
            <p className="text-slate-400 text-sm">Real numbers, real results</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {platformStats.map((stat, index) => (
              <Card
                key={index}
                className="bg-slate-800/50 border border-slate-700/60 hover:border-slate-600/80 hover:bg-slate-800/70 transition-all duration-200 p-5 rounded-xl"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${stat.iconBg}`}>
                    {stat.icon}
                  </div>
                </div>
                <div className={`text-2xl sm:text-3xl font-bold ${stat.color} mb-1`}>
                  {stat.value}
                </div>
                <div className="text-slate-400 text-sm">{stat.label}</div>
                {stat.trend && (
                  <div className="text-emerald-400 text-xs mt-1">{stat.trend}</div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Key Features ── */}
      <section className="py-12 sm:py-20 bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                <Sparkles className="h-5 w-5 text-emerald-400" />
              </div>
              <span className="text-emerald-400 font-semibold text-sm uppercase tracking-wider">Features</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Advanced Betting Tools
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Professional-grade features that give you the edge over bookmakers and the market
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {keyFeatures.map((feature, index) => (
              <Card
                key={index}
                className={`bg-slate-800/50 border border-slate-700/60 border-l-4 ${feature.accentColor} hover:bg-slate-800/70 hover:shadow-xl ${feature.glowColor} transition-all duration-200 rounded-xl overflow-hidden`}
              >
                <CardHeader className="pb-2 pt-5 px-5">
                  <div className="flex items-start justify-between mb-3">
                    {feature.icon}
                    {feature.highlight && (
                      <Badge className="bg-slate-700/60 text-slate-300 border-slate-600/50 text-[10px] px-2">
                        {feature.highlight}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-white text-base font-semibold">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── CLV Tracker Spotlight ── */}
      <section className="py-12 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="relative bg-gradient-to-br from-slate-800/80 via-slate-800/60 to-emerald-900/20 rounded-2xl border border-slate-700/50 overflow-hidden">
            <div className="absolute -top-20 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-8 sm:p-12 items-center">
              {/* Left: copy */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                    <Activity className="h-5 w-5 text-emerald-400" />
                  </div>
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs">
                    🎯 New Feature
                  </Badge>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-white mb-4">
                  Real-time CLV Tracker
                </h3>
                <p className="text-slate-300 mb-6 leading-relaxed">
                  Monitor Closing Line Value opportunities as they happen. Our advanced algorithm tracks odds movements
                  across multiple bookmakers and alerts you to profitable betting opportunities in real-time.
                </p>

                <ul className="space-y-3 mb-8">
                  {[
                    "30-second auto-refresh with live data",
                    "Confidence scoring (0-100) based on EV%",
                    "Kelly criterion stake recommendations",
                    "Time window filtering (72h, 48h, 24h)",
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                      <span className="text-slate-300 text-sm">{item}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  size="lg"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 shadow-lg shadow-emerald-900/40 hover:shadow-emerald-800/50 hover:scale-[1.02] transition-all"
                  onClick={() => handleCTAClick('clv_spotlight')}
                >
                  <Activity className="h-5 w-5 mr-2" />
                  Try CLV Tracker Free
                </Button>
              </div>

              {/* Right: mock CLV card */}
              <div>
                <Card className="bg-slate-900/80 border border-slate-700/60 rounded-xl overflow-hidden">
                  <CardHeader className="border-b border-slate-700/50 pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-white flex items-center gap-2 text-sm font-semibold">
                        <Activity className="h-4 w-4 text-emerald-400" />
                        CLV Opportunities
                      </CardTitle>
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] animate-pulse">
                        LIVE
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    {[
                      { match: "Barcelona vs Real Madrid", league: "LaLiga • Match Winner", confidence: 92, clv: "+8.5%", ev: "+4.2%", kelly: "2.1%", confColor: "text-emerald-400", badgeBg: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
                      { match: "Man City vs Liverpool", league: "Premier League • Over 2.5", confidence: 78, clv: "+5.2%", ev: "+2.8%", kelly: "1.4%", confColor: "text-yellow-400", badgeBg: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
                      { match: "Bayern vs Dortmund", league: "Bundesliga • BTTS Yes", confidence: 85, clv: "+6.8%", ev: "+3.5%", kelly: "1.8%", confColor: "text-emerald-400", badgeBg: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
                    ].map((item, i) => (
                      <div key={i} className="bg-slate-800/60 rounded-lg p-3">
                        <div className="flex justify-between items-start mb-1.5">
                          <div>
                            <div className="text-white font-medium text-sm">{item.match}</div>
                            <div className="text-slate-400 text-xs">{item.league}</div>
                          </div>
                          <Badge className={`${item.badgeBg} text-xs px-2 py-0.5 border`}>
                            {item.confidence}%
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-400">CLV: {item.clv} · EV: {item.ev}</span>
                          <span className={`text-xs font-medium ${item.confColor}`}>Kelly: {item.kelly}</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Quiz Section ── */}
      <QuizSection />

    </div>
  )
}
