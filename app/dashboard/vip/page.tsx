"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PremiumGate } from "@/components/premium-gate"
import { ConfidenceRing } from "@/components/match/shared"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { generateMatchSlug } from "@/lib/match-slug"
import {
  Crown,
  Activity,
  Layers,
  Target,
  Clock,
  ChevronRight,
  RefreshCw,
  Loader2,
  ArrowUpRight,
  Brain,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface VIPMatch {
  id: string
  name: string
  homeTeam: string
  awayTeam: string
  league: string
  startTime: string
  confidence: number
  prediction: string
  odds: number
  valueRating: string
  analysisSummary: string | null
}

interface VIPParlay {
  parlayId: string
  legCount: number
  edgePct: number
  impliedOdds: number
  confidenceTier: string
  parlayType: string
  legs: Array<{
    homeTeam: string
    awayTeam: string
    outcome: string
    modelProb: number
    decimalOdds: number
  }>
  earliestKickoff: string
}

interface CLVOpportunity {
  alertId: string
  homeTeam: string
  awayTeam: string
  league: string
  outcome: string
  bestOdds: number
  clvPct: number
  expiresAt: string
}

interface VIPFeedData {
  topMatches: VIPMatch[]
  topParlays: VIPParlay[]
  clvOpportunities: CLVOpportunity[]
  generatedAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getRelativeTime = (iso: string): string => {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return "Started"
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${mins % 60}m`
  return `${mins}m`
}

const getConfidenceColor = (confidence: number) => {
  if (confidence >= 75) return "emerald"
  if (confidence >= 60) return "blue"
  return "amber"
}

const getValueBadge = (value: string) => {
  switch (value?.toLowerCase()) {
    case "high":
    case "excellent":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
    case "medium":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30"
    default:
      return "bg-slate-500/20 text-slate-400 border-slate-500/30"
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VIPIntelligencePage() {
  const [hasPremiumAccess, setHasPremiumAccess] = useState<boolean | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [feed, setFeed] = useState<VIPFeedData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeSection, setActiveSection] = useState<"all" | "matches" | "parlays" | "clv">("all")

  // Premium access check
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

  const fetchFeed = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true)
    else setIsRefreshing(true)
    try {
      const res = await fetch("/api/vip/intelligence-feed", { credentials: "include" })
      if (res.ok) setFeed(await res.json())
    } catch {
      /* handled silently */
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (hasPremiumAccess || isAdmin) fetchFeed()
  }, [hasPremiumAccess, isAdmin, fetchFeed])

  if (hasPremiumAccess === false && !isAdmin) {
    return (
      <PremiumGate
        title="VIP Intelligence Feed"
        description="Access our premium AI Intelligence Feed — hand-picked high-confidence matches, curated parlays, and real-time CLV edge opportunities updated hourly."
        featureName="VIP Intelligence"
      />
    )
  }

  const matches = feed?.topMatches ?? []
  const parlays = feed?.topParlays ?? []
  const clv = feed?.clvOpportunities ?? []

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* ── Depth blobs ───────────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-amber-500/3 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-0 w-[500px] h-[500px] bg-emerald-500/3 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-1/3 w-[400px] h-[400px] bg-purple-500/3 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">

        {/* ── Hero Header ───────────────────────────────────────────── */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-800/80 via-slate-800/60 to-amber-900/20 rounded-2xl p-6 border border-amber-500/20">
          <div className="absolute top-4 right-8 w-48 h-48 bg-amber-400/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
                <Crown className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">VIP Intelligence Feed</h1>
                <p className="text-slate-400 text-sm mt-0.5">
                  AI-curated high-confidence picks · Updated hourly
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {feed?.generatedAt && (
                <span className="text-xs text-slate-500">
                  Updated {getRelativeTime(feed.generatedAt)} ago
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchFeed(true)}
                disabled={isRefreshing}
                className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-xs"
              >
                {isRefreshing ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                )}
                Refresh
              </Button>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            {[
              { icon: Target, label: "Top Matches", value: matches.length, color: "emerald" },
              { icon: Layers, label: "AI Parlays", value: parlays.length, color: "blue" },
              { icon: Activity, label: "CLV Edges", value: clv.length, color: "amber" },
            ].map(stat => (
              <div
                key={stat.label}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 border",
                  stat.color === "emerald" && "border-emerald-500/20",
                  stat.color === "blue" && "border-blue-500/20",
                  stat.color === "amber" && "border-amber-500/20"
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center",
                    stat.color === "emerald" && "bg-emerald-500/15",
                    stat.color === "blue" && "bg-blue-500/15",
                    stat.color === "amber" && "bg-amber-500/15"
                  )}
                >
                  <stat.icon
                    className={cn(
                      "w-4 h-4",
                      stat.color === "emerald" && "text-emerald-400",
                      stat.color === "blue" && "text-blue-400",
                      stat.color === "amber" && "text-amber-400"
                    )}
                  />
                </div>
                <div>
                  <p
                    className={cn(
                      "text-xl font-bold",
                      stat.color === "emerald" && "text-emerald-400",
                      stat.color === "blue" && "text-blue-400",
                      stat.color === "amber" && "text-amber-400"
                    )}
                  >
                    {isLoading ? "—" : stat.value}
                  </p>
                  <p className="text-xs text-slate-500">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Section Filters ───────────────────────────────────────── */}
        <div className="flex gap-2 flex-wrap">
          {(["all", "matches", "parlays", "clv"] as const).map(section => (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
                activeSection === section
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                  : "text-slate-400 hover:text-white border border-slate-700/50 hover:border-slate-600"
              )}
            >
              {section === "all" ? "All Intelligence" : section === "clv" ? "CLV Edges" : section.charAt(0).toUpperCase() + section.slice(1)}
            </button>
          ))}
        </div>

        {/* ── Loading ───────────────────────────────────────────────── */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
            </div>
            <p className="text-slate-400 text-sm">Loading intelligence feed…</p>
          </div>
        )}

        {!isLoading && (
          <div className="space-y-8">

            {/* ── Top Matches ───────────────────────────────────────── */}
            {(activeSection === "all" || activeSection === "matches") && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-emerald-500/15 rounded-lg flex items-center justify-center">
                      <Target className="w-4 h-4 text-emerald-400" />
                    </div>
                    <h2 className="text-lg font-semibold text-white">High-Confidence Matches</h2>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                      ≥70% confidence
                    </Badge>
                  </div>
                  <Link
                    href="/dashboard/matches"
                    className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                  >
                    View all <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>

                {matches.length === 0 ? (
                  <Card className="bg-slate-800/30 border-slate-700/50">
                    <CardContent className="py-10 text-center text-slate-500 text-sm">
                      No high-confidence matches available right now. Check back soon.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {matches.map(match => {
                      const color = getConfidenceColor(match.confidence)
                      const slug = generateMatchSlug(match.homeTeam, match.awayTeam)
                      return (
                        <Link key={match.id} href={`/match/${slug}`}>
                          <Card
                            className={cn(
                              "group relative overflow-hidden bg-slate-800/50 border-slate-700/50 hover:border-emerald-500/40 transition-all duration-200 cursor-pointer",
                              `hover:shadow-[0_0_20px_rgba(16,185,129,0.12)]`
                            )}
                          >
                            {/* Left accent */}
                            <div
                              className={cn(
                                "absolute left-0 top-0 bottom-0 w-0.5",
                                color === "emerald" && "bg-emerald-500",
                                color === "blue" && "bg-blue-500",
                                color === "amber" && "bg-amber-500"
                              )}
                            />
                            <CardContent className="p-4 pl-5">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-slate-400 mb-1 truncate">{match.league}</p>
                                  <p className="text-white font-semibold text-sm leading-tight truncate">
                                    {match.homeTeam} <span className="text-slate-500">vs</span> {match.awayTeam}
                                  </p>
                                  <div className="flex items-center gap-2 mt-2">
                                    <Badge
                                      className={cn(
                                        "text-xs font-medium",
                                        color === "emerald" && "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
                                        color === "blue" && "bg-blue-500/20 text-blue-400 border-blue-500/30",
                                        color === "amber" && "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                      )}
                                    >
                                      {match.prediction}
                                    </Badge>
                                    <Badge className={cn("text-xs", getValueBadge(match.valueRating))}>
                                      {match.valueRating}
                                    </Badge>
                                  </div>
                                  {match.analysisSummary && (
                                    <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                                      {match.analysisSummary}
                                    </p>
                                  )}
                                </div>
                                <div className="shrink-0 flex flex-col items-center gap-1">
                                  <ConfidenceRing score={match.confidence} size={44} />
                                  <div className="flex items-center gap-1 text-xs text-slate-400">
                                    <Clock className="w-3 h-3" />
                                    {getRelativeTime(match.startTime)}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </section>
            )}

            {/* ── AI Parlays ────────────────────────────────────────── */}
            {(activeSection === "all" || activeSection === "parlays") && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-blue-500/15 rounded-lg flex items-center justify-center">
                      <Layers className="w-4 h-4 text-blue-400" />
                    </div>
                    <h2 className="text-lg font-semibold text-white">Curated AI Parlays</h2>
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                      Best edge
                    </Badge>
                  </div>
                  <Link
                    href="/dashboard/parlays?tab=prebuilt"
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    View all <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>

                {parlays.length === 0 ? (
                  <Card className="bg-slate-800/30 border-slate-700/50">
                    <CardContent className="py-10 text-center text-slate-500 text-sm">
                      No AI parlays generated yet. Check back after the next sync.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {parlays.map((parlay, idx) => (
                      <Link key={parlay.parlayId} href="/dashboard/parlays?tab=prebuilt">
                        <Card className="group bg-slate-800/50 border-slate-700/50 hover:border-blue-500/40 transition-all hover:shadow-[0_0_20px_rgba(59,130,246,0.12)] cursor-pointer overflow-hidden">
                          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-blue-500/20 rounded-md flex items-center justify-center text-xs font-bold text-blue-400">
                                  {idx + 1}
                                </div>
                                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                                  {parlay.legCount}-Leg Parlay
                                </Badge>
                                <Badge className="bg-slate-700/50 text-slate-300 border-slate-600/30 text-xs">
                                  {parlay.confidenceTier}
                                </Badge>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-blue-400">
                                  {parlay.impliedOdds.toFixed(2)}x
                                </p>
                                <p className="text-xs text-slate-500">
                                  +{parlay.edgePct.toFixed(1)}% edge
                                </p>
                              </div>
                            </div>

                            {/* Legs */}
                            <div className="space-y-1.5">
                              {parlay.legs.map((leg, i) => (
                                <div
                                  key={i}
                                  className="flex items-center justify-between text-xs p-1.5 rounded-md bg-slate-700/30"
                                >
                                  <span className="text-slate-300 truncate flex-1 min-w-0">
                                    {leg.homeTeam} vs {leg.awayTeam}
                                  </span>
                                  <div className="flex items-center gap-1.5 ml-2 shrink-0">
                                    <Badge className="bg-slate-600/50 text-slate-300 border-0 text-xs px-1.5 py-0">
                                      {leg.outcome}
                                    </Badge>
                                    <span className="text-emerald-400 font-medium">
                                      {leg.decimalOdds > 0 ? leg.decimalOdds.toFixed(2) : (1 / leg.modelProb).toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>

                            <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                First kick-off {getRelativeTime(parlay.earliestKickoff)}
                              </span>
                              <span className="text-blue-400 flex items-center gap-0.5">
                                Add to slip <ArrowUpRight className="w-3 h-3" />
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* ── CLV Opportunities ─────────────────────────────────── */}
            {(activeSection === "all" || activeSection === "clv") && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-amber-500/15 rounded-lg flex items-center justify-center">
                      <Activity className="w-4 h-4 text-amber-400" />
                    </div>
                    <h2 className="text-lg font-semibold text-white">Closing Line Value Edges</h2>
                    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                      Real-time
                    </Badge>
                  </div>
                  <Link
                    href="/dashboard/clv"
                    className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
                  >
                    Full tracker <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>

                {clv.length === 0 ? (
                  <Card className="bg-slate-800/30 border-slate-700/50">
                    <CardContent className="py-10 text-center text-slate-500 text-sm">
                      No CLV opportunities at this time. The tracker checks every 15 minutes.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {clv.map(opp => (
                      <Link key={opp.alertId} href="/dashboard/clv">
                        <Card className="group bg-slate-800/50 border-slate-700/50 hover:border-amber-500/40 transition-all hover:shadow-[0_0_20px_rgba(245,158,11,0.12)] cursor-pointer">
                          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-slate-400 truncate">{opp.league}</p>
                                <p className="text-white text-sm font-semibold leading-snug">
                                  {opp.homeTeam} vs {opp.awayTeam}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-lg font-bold text-amber-400">
                                  +{opp.clvPct.toFixed(1)}%
                                </p>
                                <p className="text-xs text-slate-500">CLV</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-1.5">
                                <Badge className="bg-slate-700/50 text-slate-300 border-0 text-xs">
                                  {opp.outcome === "H" ? "Home Win" : opp.outcome === "A" ? "Away Win" : opp.outcome === "D" ? "Draw" : opp.outcome}
                                </Badge>
                                <span className="text-emerald-400 font-medium">@{opp.bestOdds.toFixed(2)}</span>
                              </div>
                              <span className="text-slate-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {getRelativeTime(opp.expiresAt)}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* ── AI Insight Banner ─────────────────────────────────── */}
            {activeSection === "all" && !isLoading && (
              <Card className="bg-gradient-to-br from-slate-800/60 via-slate-800/40 to-amber-900/20 border border-amber-500/20 overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="w-12 h-12 bg-amber-500/15 rounded-xl flex items-center justify-center shrink-0 border border-amber-500/30">
                      <Brain className="w-6 h-6 text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-white font-semibold mb-1">
                        How this feed works
                      </h3>
                      <p className="text-slate-400 text-sm">
                        Our AI scans hundreds of upcoming matches every hour, selecting only those with{" "}
                        <span className="text-amber-400 font-medium">≥70% model confidence</span>, strong
                        bookmaker consensus, and positive CLV. Parlays are curated from the highest-quality
                        single-match combinations to maximise edge while minimising correlation risk.
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Link href="/dashboard/matches">
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs shadow-[0_0_15px_rgba(16,185,129,0.25)]">
                          <Target className="w-3.5 h-3.5 mr-1.5" />
                          Browse Matches
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
