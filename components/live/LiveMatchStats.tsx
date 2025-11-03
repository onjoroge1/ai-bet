"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BarChart3, Target, TrendingUp, Shield, Zap, Move, Activity } from "lucide-react"
import type { LiveData } from "@/types/live-match"

interface LiveMatchStatsProps {
  liveData: LiveData
  homeTeamName: string
  awayTeamName: string
}

/**
 * Displays live match statistics: shots, possession, cards, etc.
 * Shows real-time stats in an engaging visual format
 */
export function LiveMatchStats({ liveData, homeTeamName, awayTeamName }: LiveMatchStatsProps) {
  if (!liveData.statistics) return null

  const stats = liveData.statistics

  // Helper to format percentage
  const formatPercent = (value: number) => `${Math.round(value)}%`
  
  // Helper to get max value for bar scaling
  const getMaxValue = (home: number, away: number) => Math.max(home, away, 1)

  // Helper to render stat bar
  const StatBar = ({ label, home, away }: { label: string; home: number; away: number }) => {
    const max = getMaxValue(home, away)
    const homePercent = max > 0 ? (home / max) * 100 : 0
    const awayPercent = max > 0 ? (away / max) * 100 : 0
    
    return (
      <div className="space-y-2">
        <div className="text-xs text-slate-400 font-medium">{label}</div>
        <div className="grid grid-cols-3 gap-2 items-center">
          {/* Home value */}
          <div className="text-right text-sm font-semibold text-white">{home}</div>
          
          {/* Bar visualization */}
          <div className="flex items-center gap-1">
            <div className="flex-1 h-4 bg-slate-700 rounded-full overflow-hidden relative">
              <div
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-emerald-600 to-emerald-500 transition-all duration-500"
                style={{ width: `${homePercent}%` }}
              />
            </div>
            <span className="text-xs text-slate-500 w-3 text-center">vs</span>
            <div className="flex-1 h-4 bg-slate-700 rounded-full overflow-hidden relative">
              <div
                className="absolute right-0 top-0 h-full bg-gradient-to-l from-blue-600 to-blue-500 transition-all duration-500"
                style={{ width: `${awayPercent}%` }}
              />
            </div>
          </div>
          
          {/* Away value */}
          <div className="text-left text-sm font-semibold text-white">{away}</div>
        </div>
      </div>
    )
  }

  return (
    <Card className="bg-slate-800/60 border-slate-700 mb-6">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            Live Statistics
          </h3>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-slate-700 text-slate-300">
              Min {liveData.minute}'
            </Badge>
            <Badge variant="outline" className="bg-green-500/10 border-green-500/30 text-green-400 text-xs">
              <Activity className="w-3 h-3 mr-1" />
              Updates every 30s
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Shots on Target */}
          {stats.shots_on_target && (
            <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-4 h-4 text-yellow-400" />
                <span className="text-sm font-medium text-white">Shots on Target</span>
              </div>
              <StatBar
                label=""
                home={stats.shots_on_target.home || 0}
                away={stats.shots_on_target.away || 0}
              />
            </div>
          )}

          {/* Possession */}
          {stats.possession && (
            <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-medium text-white">Possession</span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">{homeTeamName}</span>
                  <span className="text-sm font-bold text-white">
                    {formatPercent(stats.possession.home || 0)}
                  </span>
                </div>
                <div className="relative w-full h-3 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="absolute left-0 top-0 h-full bg-gradient-to-r from-emerald-600 to-emerald-500 transition-all duration-500"
                    style={{ width: `${stats.possession.home || 0}%` }}
                  />
                  <div
                    className="absolute right-0 top-0 h-full bg-gradient-to-l from-blue-600 to-blue-500 transition-all duration-500"
                    style={{ width: `${stats.possession.away || 0}%` }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">{awayTeamName}</span>
                  <span className="text-sm font-bold text-white">
                    {formatPercent(stats.possession.away || 0)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Total Shots */}
          {stats.shots && (
            <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
              <div className="text-xs text-slate-400 mb-2">Total Shots</div>
              <StatBar
                label=""
                home={stats.shots.home || 0}
                away={stats.shots.away || 0}
              />
            </div>
          )}

          {/* Corners */}
          {stats.corners && (
            <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
              <div className="text-xs text-slate-400 mb-2">Corners</div>
              <StatBar
                label=""
                home={stats.corners.home || 0}
                away={stats.corners.away || 0}
              />
            </div>
          )}

          {/* Fouls */}
          {stats.fouls && (
            <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
              <div className="text-xs text-slate-400 mb-2">Fouls</div>
              <StatBar
                label=""
                home={stats.fouls.home || 0}
                away={stats.fouls.away || 0}
              />
            </div>
          )}

          {/* Cards */}
          {(stats.yellow_cards || stats.red_cards) && (
            <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-orange-400" />
                <span className="text-xs text-slate-400 font-medium">Cards</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {/* Yellow Cards */}
                {stats.yellow_cards && (
                  <div>
                    <div className="text-xs text-yellow-400 mb-1">Yellow</div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">
                        {stats.yellow_cards.home || 0}
                      </span>
                      <span className="text-xs text-slate-500">vs</span>
                      <span className="text-sm font-bold text-white">
                        {stats.yellow_cards.away || 0}
                      </span>
                    </div>
                  </div>
                )}
                {/* Red Cards */}
                {stats.red_cards && (
                  <div>
                    <div className="text-xs text-red-400 mb-1">Red</div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">
                        {stats.red_cards.home || 0}
                      </span>
                      <span className="text-xs text-slate-500">vs</span>
                      <span className="text-sm font-bold text-white">
                        {stats.red_cards.away || 0}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pass Accuracy */}
          {stats.pass_accuracy && (
            <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span className="text-xs text-slate-400 font-medium">Pass Accuracy</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">{homeTeamName}</span>
                  <span className="text-sm font-bold text-white">
                    {formatPercent(stats.pass_accuracy.home || 0)}
                  </span>
                </div>
                <div className="relative w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="absolute left-0 top-0 h-full bg-cyan-500 transition-all duration-500"
                    style={{ width: `${stats.pass_accuracy.home || 0}%` }}
                  />
                  <div
                    className="absolute right-0 top-0 h-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${stats.pass_accuracy.away || 0}%` }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">{awayTeamName}</span>
                  <span className="text-sm font-bold text-white">
                    {formatPercent(stats.pass_accuracy.away || 0)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Saves */}
          {stats.saves && (
            <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-green-400" />
                <span className="text-xs text-slate-400 font-medium">Goalkeeper Saves</span>
              </div>
              <StatBar
                label=""
                home={stats.saves.home || 0}
                away={stats.saves.away || 0}
              />
            </div>
          )}

          {/* Tackles */}
          {stats.tackles && (
            <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-red-400" />
                <span className="text-xs text-slate-400 font-medium">Tackles</span>
              </div>
              <StatBar
                label=""
                home={stats.tackles.home || 0}
                away={stats.tackles.away || 0}
              />
            </div>
          )}

          {/* Offsides */}
          {stats.offsides && (
            <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
              <div className="text-xs text-slate-400 mb-2">Offsides</div>
              <StatBar
                label=""
                home={stats.offsides.home || 0}
                away={stats.offsides.away || 0}
              />
            </div>
          )}

          {/* Total Passes */}
          {stats.passes && (
            <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
              <div className="flex items-center gap-2 mb-3">
                <Move className="w-4 h-4 text-indigo-400" />
                <span className="text-xs text-slate-400 font-medium">Total Passes</span>
              </div>
              <StatBar
                label=""
                home={stats.passes.home || 0}
                away={stats.passes.away || 0}
              />
            </div>
          )}

          {/* Clearances */}
          {stats.clearances && (
            <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
              <div className="text-xs text-slate-400 mb-2">Clearances</div>
              <StatBar
                label=""
                home={stats.clearances.home || 0}
                away={stats.clearances.away || 0}
              />
            </div>
          )}

          {/* Blocks */}
          {stats.blocks && (
            <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
              <div className="text-xs text-slate-400 mb-2">Blocks</div>
              <StatBar
                label=""
                home={stats.blocks.home || 0}
                away={stats.blocks.away || 0}
              />
            </div>
          )}
        </div>

        {/* Recent Events */}
        {liveData.events && liveData.events.length > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-700">
            <div className="text-xs text-slate-400 mb-3 font-medium">Recent Events</div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {liveData.events.slice(0, 5).map((event, index) => (
                <div key={index} className="flex items-center gap-3 text-xs">
                  <div className="w-12 text-center text-slate-400 font-medium">
                    {event.minute}'
                  </div>
                  <div className={`flex-1 ${
                    event.type === 'goal' ? 'text-emerald-400' :
                    event.type === 'card' ? 'text-yellow-400' :
                    'text-slate-300'
                  }`}>
                    {event.type === 'goal' && '⚽'}
                    {event.type === 'card' && '🟨'}
                    {event.description || `${event.type} - ${event.player || ''}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}



