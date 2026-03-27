"use client"

import { useState, useEffect, useCallback } from "react"
import { SportSelector } from "@/components/multisport/SportSelector"
import { SportMatchCard } from "@/components/multisport/SportMatchCard"
import { SoccerMatchGrid } from "@/components/multisport/SoccerMatchGrid"
import { SkeletonCard } from "@/components/match/shared"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Calendar, Trophy, AlertTriangle } from "lucide-react"
import { HotScorerPicks } from "@/components/players/HotScorerPicks"

interface MatchData {
  event_id: string
  status: string
  commence_time: string
  league: { name: string; sport_key: string }
  home: { name: string; team_id: number | null }
  away: { name: string; team_id: number | null }
  odds: any
  spread: any
  model: any
  final_result: any
}

interface MarketResponse {
  sport: string
  sport_name: string
  season: { status: string; season_window: string }
  matches: MatchData[]
  total_count: number
  model_info: { training_samples: number; confidence_note: string | null }
  live_data_available: boolean
}

export default function SportsPage() {
  const [sport, setSport] = useState("soccer")
  const [status, setStatus] = useState<"upcoming" | "finished">("upcoming")
  const [data, setData] = useState<MarketResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMatches = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let url: string
      if (sport === "soccer") {
        // Soccer uses the main market API
        const apiStatus = status === "finished" ? "completed" : status
        url = `/api/market?status=${apiStatus}&limit=30`
      } else {
        url = `/api/multisport/market?sport=${sport}&status=${status}&limit=30`
      }
      const res = await fetch(url)
      const json = await res.json()
      if (json.error && !json.matches?.length) {
        setError(json.error)
        setData(null)
      } else {
        setData(json)
      }
    } catch (e) {
      setError("Failed to load matches")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [sport, status])

  useEffect(() => {
    fetchMatches()
  }, [fetchMatches])

  const matches = data?.matches || []
  const isOffSeason = data?.season?.status === "off_season"

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Sports Predictions</h1>
            <p className="text-sm text-slate-400 mt-1">
              AI-powered predictions across all sports
            </p>
          </div>
          <button
            onClick={fetchMatches}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/40 text-slate-300 hover:text-white hover:border-slate-600 transition-all text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Sport selector tabs */}
        <SportSelector selectedSport={sport} onSelect={setSport} />

        {/* Status filter */}
        <div className="flex gap-2">
          <button
            onClick={() => setStatus("upcoming")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
              status === "upcoming"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-slate-800/40 text-slate-400 border border-slate-700/30 hover:text-white"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Upcoming
          </button>
          <button
            onClick={() => setStatus("finished")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
              status === "finished"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-slate-800/40 text-slate-400 border border-slate-700/30 hover:text-white"
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            Finished
          </button>
        </div>

        {/* Model info note (multisport only) */}
        {sport !== "soccer" && data?.model_info?.confidence_note && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-xs">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {data.model_info.confidence_note}
          </div>
        )}

        {/* Off-season message (multisport only) */}
        {sport !== "soccer" && isOffSeason && !loading && (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">🏈</div>
            <h3 className="text-lg font-medium text-slate-300">Off-Season</h3>
            <p className="text-sm text-slate-500 mt-1">
              {data?.sport_name || "This sport"} season runs {data?.season?.season_window || ""}. Check back then!
            </p>
          </div>
        )}

        {/* Loading (multisport only — soccer has its own loading) */}
        {sport !== "soccer" && loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* Error (multisport only) */}
        {sport !== "soccer" && error && !loading && (
          <div className="text-center py-12">
            <p className="text-slate-400 text-sm">{error}</p>
            <button onClick={fetchMatches} className="mt-3 text-emerald-400 text-sm hover:text-emerald-300">
              Try again
            </button>
          </div>
        )}

        {/* Hot Scorer Picks widget — show for soccer upcoming only */}
        {sport === "soccer" && status === "upcoming" && (
          <HotScorerPicks limit={5} className="mb-6" />
        )}

        {/* Soccer uses the same card grid as other sports */}
        {sport === "soccer" && (
          <SoccerMatchGrid status={status === "finished" ? "live" : "upcoming"} limit={30} />
        )}

        {/* Multisport matches grid */}
        {sport !== "soccer" && !loading && !error && !isOffSeason && matches.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {matches.map(match => (
              <SportMatchCard key={match.event_id} match={match} sportKey={sport} />
            ))}
          </div>
        )}

        {/* Empty state (multisport only — soccer has its own empty state) */}
        {sport !== "soccer" && !loading && !error && !isOffSeason && matches.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">{status === "upcoming" ? "📅" : "🏆"}</div>
            <h3 className="text-lg font-medium text-slate-300">
              {status === "upcoming" ? "No upcoming games" : "No finished games"}
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              {status === "upcoming"
                ? "Check back closer to game day for upcoming matches"
                : "Finished games will appear here after results are in"}
            </p>
          </div>
        )}

        {/* Stats footer */}
        {!loading && matches.length > 0 && (
          <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-800">
            <span>{matches.length} {status === "upcoming" ? "upcoming" : "finished"} games</span>
            {data?.model_info && (
              <span>Model trained on {data.model_info.training_samples} games</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
