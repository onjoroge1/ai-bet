"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Zap, Crown, TrendingUp, Clock, Target, CheckCircle, Calendar, Trophy,
  Loader2, AlertCircle, RefreshCw, Lock, Star, ArrowRight,
} from "lucide-react"
import { DashboardBreadcrumb } from "@/components/dashboard-breadcrumb"
import { QuickPurchaseModal } from "@/components/quick-purchase-modal"
import { useUserCountry } from "@/contexts/user-country-context"
import Link from "next/link"

interface Tip {
  id: string
  name: string
  match: string
  homeTeam: string
  awayTeam: string
  league: string
  time: string             // formatted kickoff time
  startTime: string        // ISO
  prediction: string
  odds: number
  confidence: number
  analysis: string | null
  status: "free" | "premium"
  price: number
  currencySymbol: string
  valueRating: string | null
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  } catch {
    return ""
  }
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    if (d.toDateString() === today.toDateString()) return "Today"
    if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow"
    return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })
  } catch {
    return ""
  }
}

function confidenceColor(c: number) {
  if (c >= 80) return "text-emerald-400"
  if (c >= 70) return "text-yellow-400"
  return "text-orange-400"
}

function valueBadgeColor(v: string | null) {
  switch (v) {
    case "Excellent": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
    case "High": return "bg-blue-500/20 text-blue-400 border-blue-500/40"
    case "Medium": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/40"
    default: return "bg-slate-700 text-slate-400 border-slate-600"
  }
}

export default function DailyTipsPage() {
  const [tips, setTips] = useState<Tip[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedOffer, setSelectedOffer] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"today" | "history">("today")
  const { userCountry } = useUserCountry()

  const fetchTips = async () => {
    setIsLoading(true)
    setError(null)
    try {
      // Fetch upcoming prediction quick purchases (same data source as /dashboard/matches)
      const res = await fetch(
        `/api/quick-purchases?view=matches&type=prediction&limit=20&country=${userCountry ?? ""}`,
        { cache: "no-store" }
      )
      if (!res.ok) throw new Error(`Failed to fetch tips: ${res.status}`)
      const data = await res.json()

      const items: any[] = Array.isArray(data) ? data : data.data ?? []

      const mapped: Tip[] = items
        .filter((item: any) => {
          // Keep only upcoming matches
          const matchDate =
            item.matchData?.date ??
            item.matchData?.kickoff_date ??
            item.matchData?.matchDate
          if (!matchDate) return false
          return new Date(matchDate) > new Date()
        })
        .map((item: any) => {
          const md = item.matchData ?? {}
          const homeTeam = md.home_team ?? md.homeTeam ?? item.name?.split(" vs ")?.[0] ?? "TBD"
          const awayTeam = md.away_team ?? md.awayTeam ?? item.name?.split(" vs ")?.[1] ?? "TBD"
          const isoTime = md.date ?? md.kickoff_date ?? md.matchDate ?? new Date().toISOString()

          return {
            id: item.id,
            name: item.name,
            match: `${homeTeam} vs ${awayTeam}`,
            homeTeam,
            awayTeam,
            league: md.league ?? md.competition ?? "",
            time: formatTime(isoTime),
            startTime: isoTime,
            prediction: item.predictionType ?? "Match Result",
            odds: Number(item.odds) || 0,
            confidence: item.confidenceScore ?? 0,
            analysis: item.analysisSummary ?? null,
            status: item.isFree || item.type === "tip" ? "free" : "premium",
            price: item.price ?? 0,
            currencySymbol: item.country?.currencySymbol ?? "$",
            valueRating: item.valueRating ?? null,
          } as Tip
        })

      setTips(mapped)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tips")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTips()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userCountry])

  // Stats derived from live data
  const avgConfidence = tips.length
    ? Math.round(tips.reduce((s, t) => s + t.confidence, 0) / tips.length)
    : 0
  const avgOdds = tips.length
    ? parseFloat((tips.reduce((s, t) => s + (t.odds || 0), 0) / tips.length).toFixed(2))
    : 0
  const highConfidence = tips.filter(t => t.confidence >= 75).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <DashboardBreadcrumb />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Zap className="w-7 h-7 text-yellow-400" />
              <h1 className="text-2xl font-bold text-white">Daily Tips</h1>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 animate-pulse">
                LIVE
              </Badge>
            </div>
            <p className="text-slate-400">
              Today&apos;s AI-powered predictions — confidence-ranked
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-white"
            onClick={fetchTips}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Tab nav */}
        <div className="flex gap-2 border-b border-slate-700/50 pb-2">
          {(["today", "history"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "bg-emerald-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              {tab === "today" ? "Today's Tips" : "Purchase History"}
            </button>
          ))}
        </div>

        {/* TODAY'S TIPS */}
        {activeTab === "today" && (
          <>
            {/* Stats */}
            {!isLoading && !error && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { icon: Target, label: "Available Tips", value: `${tips.length}`, color: "text-emerald-400" },
                  { icon: TrendingUp, label: "Avg Confidence", value: `${avgConfidence}%`, color: "text-blue-400" },
                  { icon: Trophy, label: "High Confidence", value: `${highConfidence}`, color: "text-yellow-400" },
                  { icon: Star, label: "Avg Odds", value: avgOdds > 0 ? `${avgOdds}` : "—", color: "text-purple-400" },
                ].map(s => (
                  <Card key={s.label} className="bg-slate-800/50 border-slate-700">
                    <CardContent className="p-4 flex items-center gap-3">
                      <s.icon className={`w-5 h-5 ${s.color} shrink-0`} />
                      <div>
                        <p className="text-xs text-slate-400">{s.label}</p>
                        <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Loading */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
                <p className="text-slate-400">Loading today&apos;s tips…</p>
              </div>
            )}

            {/* Error */}
            {!isLoading && error && (
              <Card className="bg-red-500/10 border-red-500/30 p-6">
                <div className="flex items-center gap-3 text-red-400">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <div>
                    <p className="font-medium">Failed to load tips</p>
                    <p className="text-sm text-red-300">{error}</p>
                  </div>
                  <Button size="sm" variant="outline" className="ml-auto border-red-500/50 text-red-400" onClick={fetchTips}>
                    Retry
                  </Button>
                </div>
              </Card>
            )}

            {/* Empty */}
            {!isLoading && !error && tips.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                <Calendar className="w-14 h-14 text-slate-600" />
                <div>
                  <h3 className="text-lg font-semibold text-white">No Tips Available Yet</h3>
                  <p className="text-slate-400 text-sm mt-1">
                    Check back shortly — new tips are added as matches approach.
                  </p>
                </div>
                <Link href="/dashboard/matches">
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    Browse All Matches
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            )}

            {/* Tips Grid */}
            {!isLoading && !error && tips.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {tips.map(tip => (
                  <Card
                    key={tip.id}
                    className="bg-slate-800/60 border-slate-700 hover:border-emerald-500/50 transition-all duration-200 group overflow-hidden"
                  >
                    {/* Confidence accent bar */}
                    <div
                      className="h-1 bg-gradient-to-r from-emerald-500 to-cyan-500"
                      style={{ width: `${tip.confidence}%` }}
                    />

                    <CardHeader className="pb-2 pt-4 px-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <CardTitle className="text-white text-base truncate">{tip.match}</CardTitle>
                          <p className="text-slate-400 text-xs mt-0.5 truncate">{tip.league}</p>
                        </div>
                        <Badge
                          className={`shrink-0 text-[10px] ${
                            tip.status === "free"
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                              : "bg-amber-500/20 text-amber-400 border-amber-500/40"
                          }`}
                        >
                          {tip.status === "free" ? "Free" : "Premium"}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="px-4 pb-4 space-y-3">
                      {/* Time + Date */}
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatDate(tip.startTime)} at {tip.time}</span>
                      </div>

                      {/* Prediction + Confidence */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wide">AI Pick</p>
                          <p className="text-white font-semibold text-sm">{tip.prediction}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Confidence</p>
                          <p className={`text-lg font-bold ${confidenceColor(tip.confidence)}`}>
                            {tip.confidence}%
                          </p>
                        </div>
                      </div>

                      {/* Odds + Value */}
                      <div className="flex items-center gap-2">
                        {tip.odds > 0 && (
                          <span className="text-sm font-semibold text-emerald-400">
                            {tip.odds.toFixed(2)} odds
                          </span>
                        )}
                        {tip.valueRating && tip.valueRating !== "Low" && (
                          <Badge className={`text-[10px] ${valueBadgeColor(tip.valueRating)}`}>
                            {tip.valueRating} Value
                          </Badge>
                        )}
                      </div>

                      {/* Analysis / locked */}
                      {tip.analysis ? (
                        <p className="text-slate-300 text-xs leading-relaxed line-clamp-2">{tip.analysis}</p>
                      ) : tip.status === "premium" ? (
                        <div className="flex items-center gap-2 text-slate-500 text-xs">
                          <Lock className="w-3.5 h-3.5 shrink-0" />
                          <span>Full analysis unlocked after purchase</span>
                        </div>
                      ) : null}

                      {/* CTA */}
                      {tip.status === "free" ? (
                        <Link href="/dashboard/matches">
                          <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
                            <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                            View Match
                          </Button>
                        </Link>
                      ) : (
                        <Button
                          size="sm"
                          className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs"
                          onClick={() =>
                            setSelectedOffer({
                              id: tip.id,
                              name: tip.name,
                              price: tip.price,
                              currencySymbol: tip.currencySymbol,
                            }) || setIsModalOpen(true)
                          }
                        >
                          <Crown className="w-3.5 h-3.5 mr-1.5" />
                          Unlock — {tip.currencySymbol}{tip.price}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* PURCHASE HISTORY */}
        {activeTab === "history" && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Purchase History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Calendar className="w-14 h-14 text-slate-600 mx-auto mb-4" />
                <p className="text-white font-semibold mb-1">No purchases yet</p>
                <p className="text-slate-400 text-sm mb-5">
                  Your purchased tips will appear here.
                </p>
                <Link href="/dashboard/my-tips">
                  <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                    View My Tips
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Purchase Modal */}
        {selectedOffer && (
          <QuickPurchaseModal
            isOpen={isModalOpen}
            onClose={() => { setIsModalOpen(false); setSelectedOffer(null) }}
            offer={selectedOffer}
          />
        )}
      </div>
    </div>
  )
}
