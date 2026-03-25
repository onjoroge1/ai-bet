"use client"

import { useState, useEffect, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Calendar,
  DollarSign,
  Target,
  Loader2,
  RefreshCw,
  AlertCircle,
  BarChart3,
} from "lucide-react"

/** Bet history item from the API */
interface BetHistoryItem {
  id: string
  type: "single" | "parlay" | "prediction"
  name: string
  legs: Array<{
    match: string
    pick: string
    result: string
  }>
  odds: string
  stake: number
  potentialReturn: number
  actualReturn: number | null
  status: "pending" | "won" | "lost"
  date: string
}

/** Computed stats */
interface BetStats {
  totalBets: number
  wonBets: number
  lostBets: number
  pendingBets: number
  totalStaked: number
  totalReturns: number
  roi: number
  avgOdds: number
  bestWin: number
  currentStreak: number
}

const statusFilters = [
  { id: "all", name: "All Bets" },
  { id: "pending", name: "Pending" },
  { id: "won", name: "Won" },
  { id: "lost", name: "Lost" },
]

/**
 * MyBetsPage - Track betting history and performance
 *
 * Fetches data from:
 * - /api/user/dashboard-data (for prediction history)
 * - /api/parlays/purchase (for parlay purchase history)
 */
export default function MyBetsPage() {
  const [bets, setBets] = useState<BetHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedFilter, setSelectedFilter] = useState("all")

  const fetchBetHistory = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [predictionsRes, parlaysRes] = await Promise.allSettled([
        fetch("/api/user/dashboard-data"),
        fetch("/api/parlays/purchase"),
      ])

      const allBets: BetHistoryItem[] = []

      // Parse predictions from dashboard data
      if (predictionsRes.status === "fulfilled" && predictionsRes.value.ok) {
        const data = await predictionsRes.value.json()
        const predictions = data.recentPredictions || data.predictions || []

        if (Array.isArray(predictions)) {
          predictions.forEach((pred: Record<string, unknown>) => {
            allBets.push({
              id: String(pred.id || `pred-${Date.now()}-${predictions.indexOf(pred)}`),
              type: "prediction",
              name: String(pred.matchName || pred.name || "Match Prediction"),
              legs: [
                {
                  match: String(pred.matchName || pred.homeTeam && pred.awayTeam ? `${pred.homeTeam} vs ${pred.awayTeam}` : "Unknown Match"),
                  pick: String(pred.predictionType || pred.pick || "Match Result"),
                  result: String(pred.status === "won" ? "won" : pred.status === "lost" ? "lost" : "pending"),
                },
              ],
              odds: String(pred.odds || "1.00"),
              stake: Number(pred.stakeAmount || pred.stake || 0),
              potentialReturn: Number(pred.potentialReturn || 0),
              actualReturn: pred.actualReturn != null ? Number(pred.actualReturn) : null,
              status: pred.status === "won" ? "won" : pred.status === "lost" ? "lost" : "pending",
              date: String(pred.placedAt || pred.date || new Date().toISOString()),
            })
          })
        }
      }

      // Parse parlay purchases
      if (parlaysRes.status === "fulfilled" && parlaysRes.value.ok) {
        const data = await parlaysRes.value.json()
        const purchases = data.purchases || data.data || []

        if (Array.isArray(purchases)) {
          purchases.forEach((purchase: Record<string, unknown>) => {
            const legs = (purchase.parlay as Record<string, unknown>)?.legs
            allBets.push({
              id: String(purchase.id || `parlay-${Date.now()}-${purchases.indexOf(purchase)}`),
              type: "parlay",
              name: String(purchase.parlayName || "AI Parlay"),
              legs: Array.isArray(legs)
                ? legs.map((leg: Record<string, unknown>) => ({
                    match: String(leg.matchName || `${leg.homeTeam || ""} vs ${leg.awayTeam || ""}`),
                    pick: String(leg.outcome || leg.pick || ""),
                    result: String(leg.result || purchase.status || "pending"),
                  }))
                : [],
              odds: String(purchase.odds || "1.00"),
              stake: Number(purchase.amount || purchase.stake || 0),
              potentialReturn: Number(purchase.potentialReturn || 0),
              actualReturn: purchase.actualReturn != null ? Number(purchase.actualReturn) : null,
              status:
                purchase.status === "won"
                  ? "won"
                  : purchase.status === "lost"
                    ? "lost"
                    : "pending",
              date: String(purchase.purchasedAt || purchase.date || new Date().toISOString()),
            })
          })
        }
      }

      // Sort by date descending
      allBets.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )

      setBets(allBets)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bet history")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBetHistory()
  }, [fetchBetHistory])

  /** Filter bets */
  const filteredBets = bets.filter(
    (bet) => selectedFilter === "all" || bet.status === selectedFilter
  )

  /** Compute stats */
  const stats: BetStats = (() => {
    const settled = bets.filter((b) => b.status === "won" || b.status === "lost")
    const won = bets.filter((b) => b.status === "won")
    const lost = bets.filter((b) => b.status === "lost")
    const totalStaked = bets.reduce((a, b) => a + b.stake, 0)
    const totalReturns = won.reduce(
      (a, b) => a + (b.actualReturn ?? b.potentialReturn),
      0
    )
    const roi = totalStaked > 0 ? ((totalReturns - totalStaked) / totalStaked) * 100 : 0
    const avgOdds =
      bets.length > 0
        ? bets.reduce((a, b) => a + parseFloat(b.odds), 0) / bets.length
        : 0
    const bestWin = Math.max(
      0,
      ...won.map((b) => b.actualReturn ?? b.potentialReturn)
    )

    // Calculate current streak
    let streak = 0
    for (const bet of [...bets].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )) {
      if (bet.status === "won") streak++
      else break
    }

    return {
      totalBets: bets.length,
      wonBets: won.length,
      lostBets: lost.length,
      pendingBets: bets.filter((b) => b.status === "pending").length,
      totalStaked,
      totalReturns,
      roi,
      avgOdds,
      bestWin,
      currentStreak: streak,
    }
  })()

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">My Bets</h1>
          <p className="text-slate-400">
            Track your betting history and performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800"
            onClick={fetchBetHistory}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Stats Overview ─────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <Card className="bg-slate-800/60 border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <Target className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.totalBets}</p>
              <p className="text-xs text-slate-500">Total Bets</p>
            </div>
          </div>
        </Card>
        <Card className="bg-slate-800/60 border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-400">{stats.wonBets}</p>
              <p className="text-xs text-slate-500">Won</p>
            </div>
          </div>
        </Card>
        <Card className="bg-slate-800/60 border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-400">{stats.lostBets}</p>
              <p className="text-xs text-slate-500">Lost</p>
            </div>
          </div>
        </Card>
        <Card className="bg-slate-800/60 border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-cyan-400">
                {stats.roi >= 0 ? "+" : ""}
                {stats.roi.toFixed(1)}%
              </p>
              <p className="text-xs text-slate-500">ROI</p>
            </div>
          </div>
        </Card>
        <Card className="bg-slate-800/60 border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-400">
                ${stats.totalReturns.toFixed(0)}
              </p>
              <p className="text-xs text-slate-500">Returns</p>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Performance Card ───────────────────────────────── */}
      {stats.totalBets > 0 && (
        <Card className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border-emerald-500/20 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="font-semibold text-white mb-1">
                Performance Summary
              </h3>
              <p className="text-sm text-slate-400">
                {stats.currentStreak > 0
                  ? `You're on a ${stats.currentStreak}-bet winning streak! Keep it up.`
                  : "Keep analyzing and placing smart bets."}
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-sm text-slate-400">Win Rate</p>
                <p className="text-2xl font-bold text-emerald-400">
                  {stats.wonBets + stats.lostBets > 0
                    ? (
                        (stats.wonBets / (stats.wonBets + stats.lostBets)) *
                        100
                      ).toFixed(1)
                    : "0.0"}
                  %
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-400">Avg. Odds</p>
                <p className="text-2xl font-bold text-white">
                  {stats.avgOdds.toFixed(2)}x
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-400">Best Win</p>
                <p className="text-2xl font-bold text-cyan-400">
                  ${stats.bestWin.toFixed(0)}
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ── Error state ────────────────────────────────────── */}
      {error && (
        <Card className="bg-red-500/10 border-red-500/30 p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="text-sm text-red-400">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto border-red-500/30 text-red-400 hover:bg-red-500/10"
              onClick={fetchBetHistory}
            >
              Retry
            </Button>
          </div>
        </Card>
      )}

      {/* ── Filters ────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {statusFilters.map((filter) => (
          <Button
            key={filter.id}
            variant={selectedFilter === filter.id ? "default" : "outline"}
            size="sm"
            className={
              selectedFilter === filter.id
                ? "bg-emerald-600 hover:bg-emerald-500"
                : "bg-transparent border-slate-600 text-slate-300 hover:bg-slate-700"
            }
            onClick={() => setSelectedFilter(filter.id)}
          >
            {filter.name}
            {filter.id === "pending" && stats.pendingBets > 0 && (
              <Badge className="ml-2 bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                {stats.pendingBets}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {/* ── Bet History ────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <p className="ml-3 text-slate-400">Loading bet history...</p>
        </div>
      ) : filteredBets.length === 0 ? (
        <Card className="bg-slate-800/60 border-slate-700 p-12 text-center">
          <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">
            No Bets Found
          </h3>
          <p className="text-slate-400 text-sm">
            {selectedFilter !== "all"
              ? "Try changing the filter"
              : "Your bet history will appear here once you start placing bets"}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredBets.map((bet) => (
            <Card
              key={bet.id}
              className={`bg-slate-800/60 border-slate-700 p-5 ${
                bet.status === "pending" ? "border-amber-500/30" : ""
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                {/* Left side */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge
                      variant="outline"
                      className="text-xs capitalize border-slate-600 text-slate-400"
                    >
                      {bet.type}
                    </Badge>
                    <h3 className="font-semibold text-white">{bet.name}</h3>
                    {bet.status === "won" && (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Won
                      </Badge>
                    )}
                    {bet.status === "lost" && (
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
                        <XCircle className="w-3 h-3 mr-1" /> Lost
                      </Badge>
                    )}
                    {bet.status === "pending" && (
                      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                        <Clock className="w-3 h-3 mr-1" /> Pending
                      </Badge>
                    )}
                  </div>

                  {/* Legs */}
                  <div className="space-y-1">
                    {bet.legs.map((leg, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        {leg.result === "won" && (
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                        )}
                        {leg.result === "lost" && (
                          <XCircle className="w-4 h-4 text-red-400" />
                        )}
                        {leg.result === "pending" && (
                          <Clock className="w-4 h-4 text-amber-400" />
                        )}
                        <span className="text-slate-400">{leg.match}</span>
                        <span className="text-white font-medium">{leg.pick}</span>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-slate-500 mt-2">
                    {new Date(bet.date).toLocaleDateString()} at{" "}
                    {new Date(bet.date).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                {/* Right side */}
                <div className="flex items-center gap-6 md:text-right">
                  <div>
                    <p className="text-xs text-slate-500">Odds</p>
                    <p className="text-lg font-bold text-white">{bet.odds}x</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Stake</p>
                    <p className="text-lg font-bold text-white">${bet.stake}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">
                      {bet.status === "pending" ? "Potential" : "Return"}
                    </p>
                    <p
                      className={`text-lg font-bold ${
                        bet.status === "won"
                          ? "text-green-400"
                          : bet.status === "lost"
                            ? "text-red-400"
                            : "text-amber-400"
                      }`}
                    >
                      {bet.status === "lost"
                        ? `-$${bet.stake}`
                        : `+$${(bet.actualReturn ?? bet.potentialReturn).toFixed(2)}`}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

