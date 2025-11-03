"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import type { Momentum } from "@/types/live-match"

interface MomentumIndicatorProps {
  momentum: Momentum
  homeTeamName: string
  awayTeamName: string
}

/**
 * Visual momentum indicator showing team dominance
 * Includes driver summary badges
 */
export function MomentumIndicator({ momentum, homeTeamName, awayTeamName }: MomentumIndicatorProps) {
  const { home, away, driver_summary } = momentum
  
  // Calculate total for percentage
  const total = home + away
  const homePercent = total > 0 ? Math.round((home / total) * 100) : 0
  const awayPercent = total > 0 ? Math.round((away / total) * 100) : 0
  
  // Determine which team is leading
  const homeLeading = home > away
  const awayLeading = away > home
  const isBalanced = Math.abs(home - away) < 10

  return (
    <Card className="bg-slate-800/60 border-slate-700 mb-4">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            Live Momentum
          </h3>
          <Badge variant="secondary" className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5">
            Min {momentum.minute}'
          </Badge>
        </div>

        {/* Momentum Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-medium">Team Momentum</span>
            <span>{home} - {away}</span>
          </div>
          
          <div className="relative w-full h-8 bg-slate-700 rounded-full overflow-hidden">
            {/* Home momentum (left side) */}
            <div
              className={`absolute left-0 top-0 h-full transition-all duration-500 ease-out ${
                homeLeading ? 'bg-gradient-to-r from-emerald-600 to-emerald-500' :
                'bg-gradient-to-r from-slate-600 to-slate-500'
              }`}
              style={{ width: `${homePercent}%` }}
            />
            
            {/* Away momentum (right side) */}
            <div
              className={`absolute right-0 top-0 h-full transition-all duration-500 ease-out ${
                awayLeading ? 'bg-gradient-to-l from-blue-600 to-blue-500' :
                'bg-gradient-to-l from-slate-600 to-slate-500'
              }`}
              style={{ width: `${awayPercent}%` }}
            />
            
            {/* Center indicator */}
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/20" />
          </div>
          
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              {homeLeading ? (
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              ) : isBalanced ? (
                <Minus className="w-4 h-4 text-slate-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-slate-400" />
              )}
              <span className="text-xs text-slate-300">{homePercent}%</span>
            </div>
            <span className="text-xs text-slate-400">vs</span>
            <div className="flex items-center gap-2">
              {awayLeading ? (
                <TrendingUp className="w-4 h-4 text-blue-400" />
              ) : isBalanced ? (
                <Minus className="w-4 h-4 text-slate-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-slate-400" />
              )}
              <span className="text-xs text-slate-300">{awayPercent}%</span>
            </div>
          </div>
        </div>

        {/* Driver Summary Badges */}
        {driver_summary && Object.keys(driver_summary).length > 0 && (
          <div className="border-t border-slate-700 pt-3 mt-3">
            <div className="text-xs text-slate-400 mb-1.5">Momentum Drivers</div>
            <div className="flex flex-wrap gap-1.5">
              {driver_summary.shots_on_target && (
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    driver_summary.shots_on_target === 'home' 
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                      : driver_summary.shots_on_target === 'away'
                      ? 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                      : 'bg-slate-700/50 border-slate-600 text-slate-300'
                  }`}
                >
                  🎯 Shots: {driver_summary.shots_on_target === 'home' ? homeTeamName : driver_summary.shots_on_target === 'away' ? awayTeamName : 'Balanced'}
                </Badge>
              )}
              {driver_summary.possession && (
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    driver_summary.possession === 'home' 
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                      : driver_summary.possession === 'away'
                      ? 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                      : 'bg-slate-700/50 border-slate-600 text-slate-300'
                  }`}
                >
                  ⚽ Possession: {driver_summary.possession === 'home' ? homeTeamName : driver_summary.possession === 'away' ? awayTeamName : 'Balanced'}
                </Badge>
              )}
              {driver_summary.red_card && (
                <Badge
                  variant="outline"
                  className="bg-red-500/20 border-red-500/40 text-red-400 text-xs"
                >
                  🟥 Red Card: {driver_summary.red_card === 'home' ? homeTeamName : awayTeamName}
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}




