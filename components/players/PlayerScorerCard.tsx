"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export interface PlayerPrediction {
  player_name: string
  position: string
  team: string
  is_home_team: boolean
  scored_probability: number
  involved_probability?: number
  method: string // "ml_lightgbm" | "stats_ranking"
  form?: {
    total_goals?: number
    avg_shots?: number
    avg_rating?: number
    games_played?: number
  }
  market_odds?: number | null
  edge?: number | null
  player_id?: number | null
}

interface Props {
  player: PlayerPrediction
  rank?: number
  compact?: boolean
  className?: string
}

const POSITION_COLORS: Record<string, string> = {
  Attacker: "text-red-400 bg-red-500/10 border-red-500/30",
  Midfielder: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  Defender: "text-green-400 bg-green-500/10 border-green-500/30",
  Goalkeeper: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
}

export function PlayerScorerCard({ player, rank, compact = false, className }: Props) {
  const prob = Math.round(player.scored_probability * 100)
  const involvedProb = player.involved_probability ? Math.round(player.involved_probability * 100) : null
  const posColor = POSITION_COLORS[player.position] || "text-slate-400 bg-slate-500/10 border-slate-500/30"
  const isML = player.method === "ml_lightgbm"

  // Confidence ring color
  const ringColor = prob >= 15 ? "stroke-emerald-400" : prob >= 8 ? "stroke-yellow-400" : "stroke-slate-400"
  const ringPercent = Math.min(prob * 3, 100) // Scale up for visual (15% goal prob = 45% ring fill)

  if (compact) {
    return (
      <div className={cn("flex items-center gap-3 py-2 px-3 bg-slate-800/40 rounded-lg border border-slate-700/30 hover:border-slate-600/50 transition-all", className)}>
        {rank && (
          <span className="text-xs font-bold text-slate-500 w-4 shrink-0">{rank}</span>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{player.player_name}</p>
          <p className="text-[11px] text-slate-400 truncate">{player.team} · {player.position}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn("text-sm font-bold", prob >= 15 ? "text-emerald-400" : prob >= 8 ? "text-yellow-400" : "text-slate-400")}>
            {prob}%
          </span>
          {isML && (
            <Badge className="text-[9px] px-1 py-0 bg-purple-500/15 text-purple-400 border-purple-500/30">ML</Badge>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      "bg-slate-800/50 border border-slate-700/40 rounded-xl p-4 hover:border-slate-600/60 transition-all group",
      className
    )}>
      {/* Header: rank + name + position */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {rank && (
            <span className="text-lg font-bold text-slate-500 w-6 shrink-0">#{rank}</span>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{player.player_name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[11px] text-slate-400">{player.team}</span>
              <span className="text-slate-600">·</span>
              <Badge className={cn("text-[10px] px-1.5 py-0", posColor)}>{player.position}</Badge>
              {player.is_home_team && (
                <Badge className="text-[9px] px-1 py-0 bg-slate-700/50 text-slate-400 border-slate-600/50">🏠</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Confidence ring */}
        <div className="relative flex items-center justify-center shrink-0" style={{ width: 48, height: 48 }}>
          <svg width="48" height="48" className="-rotate-90">
            <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-700/50" />
            <circle
              cx="24" cy="24" r="21" fill="none" strokeWidth="3" strokeLinecap="round"
              className={ringColor}
              strokeDasharray={`${2 * Math.PI * 21}`}
              strokeDashoffset={`${2 * Math.PI * 21 * (1 - ringPercent / 100)}`}
              style={{ transition: "stroke-dashoffset 0.6s" }}
            />
          </svg>
          <span className={cn("absolute text-xs font-bold", prob >= 15 ? "text-emerald-400" : prob >= 8 ? "text-yellow-400" : "text-slate-400")}>
            {prob}%
          </span>
        </div>
      </div>

      {/* Probability bars */}
      <div className="space-y-1.5 mb-3">
        <div>
          <div className="flex justify-between text-[10px] mb-0.5">
            <span className="text-slate-400">Score probability</span>
            <span className="text-slate-300 font-medium">{prob}%</span>
          </div>
          <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", prob >= 15 ? "bg-emerald-500" : prob >= 8 ? "bg-yellow-500" : "bg-slate-500")}
              style={{ width: `${Math.min(prob * 3, 100)}%` }}
            />
          </div>
        </div>
        {involvedProb != null && (
          <div>
            <div className="flex justify-between text-[10px] mb-0.5">
              <span className="text-slate-400">Involved (goal/assist)</span>
              <span className="text-slate-300 font-medium">{involvedProb}%</span>
            </div>
            <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-blue-500/60 transition-all" style={{ width: `${Math.min(involvedProb * 2.5, 100)}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Form stats */}
      {player.form && (
        <div className="flex items-center gap-3 text-[10px] text-slate-400 mb-2">
          {player.form.total_goals != null && (
            <span>⚽ {player.form.total_goals} goals</span>
          )}
          {player.form.avg_shots != null && (
            <span>🎯 {player.form.avg_shots.toFixed(1)} shots/g</span>
          )}
          {player.form.avg_rating != null && (
            <span>⭐ {player.form.avg_rating.toFixed(1)}</span>
          )}
        </div>
      )}

      {/* Footer: method + odds */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-700/30">
        <Badge className={cn(
          "text-[9px] px-1.5 py-0",
          isML ? "bg-purple-500/15 text-purple-400 border-purple-500/30" : "bg-slate-500/15 text-slate-400 border-slate-500/30"
        )}>
          {isML ? "ML (LightGBM)" : "Stats"}
        </Badge>
        {player.market_odds && (
          <span className="text-[11px] text-slate-300">
            Odds: <span className="font-medium">{player.market_odds.toFixed(2)}</span>
            {player.edge != null && (
              <span className={cn("ml-1", player.edge > 0 ? "text-emerald-400" : "text-red-400")}>
                ({player.edge > 0 ? "+" : ""}{(player.edge * 100).toFixed(1)}%)
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  )
}
