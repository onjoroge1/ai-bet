"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PlayerScorerCard, type PlayerPrediction } from "./PlayerScorerCard"
import { Target, ChevronDown, ChevronUp, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  matchId: string | number
  homeTeam?: string
  awayTeam?: string
  maxFree?: number    // How many to show for free users (default 3)
  isPremium?: boolean // Whether user has premium access
  className?: string
}

export function PredictedScorersSection({
  matchId,
  homeTeam,
  awayTeam,
  maxFree = 3,
  isPremium = false,
  className,
}: Props) {
  const [predictions, setPredictions] = useState<PlayerPrediction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [matchInfo, setMatchInfo] = useState<{ home_team?: string; away_team?: string }>({})

  useEffect(() => {
    if (!matchId) return

    async function fetchScorers() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/player-predictions/by-match/${matchId}`)
        if (!res.ok) {
          if (res.status === 504) {
            setError("Generating predictions — this can take up to 30 seconds. Refresh to check.")
          } else {
            setError("Could not load scorer predictions")
          }
          return
        }
        const data = await res.json()
        setPredictions(data.predictions || [])
        if (data.match) setMatchInfo(data.match)
      } catch {
        setError("Failed to load scorer predictions")
      } finally {
        setLoading(false)
      }
    }

    fetchScorers()
  }, [matchId])

  // Don't render if no data and not loading
  if (!loading && !error && predictions.length === 0) return null

  const displayPredictions = expanded || isPremium
    ? predictions
    : predictions.slice(0, maxFree)
  const hasMore = !isPremium && predictions.length > maxFree

  return (
    <Card className={cn("bg-slate-800/40 border-slate-700/40 overflow-hidden", className)}>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
            <div className="p-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              <Target className="w-4 h-4 text-emerald-400" />
            </div>
            Predicted Scorers
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="text-[9px] px-1.5 py-0 bg-purple-500/10 text-purple-400 border-purple-500/20">
              ML · AUC 0.72
            </Badge>
            {predictions.length > 0 && (
              <span className="text-[10px] text-slate-500">{predictions.length} players</span>
            )}
          </div>
        </div>
        {(homeTeam || matchInfo.home_team) && (
          <p className="text-[11px] text-slate-400 mt-1">
            {homeTeam || matchInfo.home_team} vs {awayTeam || matchInfo.away_team}
          </p>
        )}
      </CardHeader>

      <CardContent className="px-4 pb-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
            <p className="text-xs text-slate-400">Generating scorer predictions...</p>
            <p className="text-[10px] text-slate-500">This may take up to 30 seconds</p>
          </div>
        ) : error ? (
          <div className="text-center py-6">
            <p className="text-xs text-slate-400">{error}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {displayPredictions.map((p, i) => (
                <PlayerScorerCard
                  key={`${p.player_name}-${i}`}
                  player={p}
                  rank={i + 1}
                />
              ))}
            </div>

            {/* Blurred premium teaser */}
            {hasMore && !expanded && (
              <div className="relative mt-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 blur-sm opacity-40 pointer-events-none">
                  {predictions.slice(maxFree, maxFree + 3).map((p, i) => (
                    <PlayerScorerCard
                      key={`blur-${p.player_name}-${i}`}
                      player={p}
                      rank={maxFree + i + 1}
                      compact
                    />
                  ))}
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <button
                    onClick={() => setExpanded(true)}
                    className="px-4 py-2 bg-emerald-500/20 border border-emerald-500/40 rounded-lg text-sm text-emerald-400 font-medium hover:bg-emerald-500/30 transition-all flex items-center gap-1.5"
                  >
                    <ChevronDown className="w-4 h-4" />
                    Show all {predictions.length} players
                  </button>
                </div>
              </div>
            )}

            {expanded && predictions.length > maxFree && (
              <button
                onClick={() => setExpanded(false)}
                className="mt-3 mx-auto flex items-center gap-1 text-xs text-slate-400 hover:text-slate-300 transition-colors"
              >
                <ChevronUp className="w-3 h-3" />
                Show less
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
