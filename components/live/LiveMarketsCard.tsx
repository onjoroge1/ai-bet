"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Target, TrendingUp, Clock } from "lucide-react"
import type { ModelMarkets } from "@/types/live-match"

interface LiveMarketsCardProps {
  markets: ModelMarkets
}

/**
 * Displays live market predictions: Win/Draw/Win, Over/Under, Next Goal
 * Updates every 60 seconds via WebSocket
 */
export function LiveMarketsCard({ markets }: LiveMarketsCardProps) {
  if (!markets) return null

  const { win_draw_win, over_under, next_goal, updated_at } = markets

  // Format timestamp
  const updateTime = updated_at 
    ? new Date(updated_at).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      })
    : null

  return (
    <Card className="bg-slate-800/60 border-slate-700 mb-6">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-purple-400" />
            Live Market Predictions
          </h3>
          {updateTime && (
            <Badge variant="secondary" className="bg-slate-700 text-slate-300 text-xs">
              <Clock className="w-3 h-3 mr-1" />
              {updateTime}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Win/Draw/Win Market */}
          <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
            <div className="text-xs text-slate-400 mb-3">Win/Draw/Win</div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 text-sm">Home</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-2 bg-slate-600 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${win_draw_win.home * 100}%` }}
                    />
                  </div>
                  <span className="text-white font-semibold text-sm w-12 text-right">
                    {(win_draw_win.home * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300 text-sm">Draw</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-2 bg-slate-600 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-500 transition-all duration-500"
                      style={{ width: `${win_draw_win.draw * 100}%` }}
                    />
                  </div>
                  <span className="text-white font-semibold text-sm w-12 text-right">
                    {(win_draw_win.draw * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300 text-sm">Away</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-2 bg-slate-600 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${win_draw_win.away * 100}%` }}
                    />
                  </div>
                  <span className="text-white font-semibold text-sm w-12 text-right">
                    {(win_draw_win.away * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Over/Under Market */}
          <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
            <div className="text-xs text-slate-400 mb-3">
              Over/Under {over_under.line}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 text-sm">Over</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-2 bg-slate-600 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all duration-500"
                      style={{ width: `${over_under.over * 100}%` }}
                    />
                  </div>
                  <span className="text-white font-semibold text-sm w-12 text-right">
                    {(over_under.over * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300 text-sm">Under</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-2 bg-slate-600 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 transition-all duration-500"
                      style={{ width: `${over_under.under * 100}%` }}
                    />
                  </div>
                  <span className="text-white font-semibold text-sm w-12 text-right">
                    {(over_under.under * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Next Goal Market */}
          <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
            <div className="text-xs text-slate-400 mb-3 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Next Goal
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 text-sm">Home</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-2 bg-slate-600 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${next_goal.home * 100}%` }}
                    />
                  </div>
                  <span className="text-white font-semibold text-sm w-12 text-right">
                    {(next_goal.home * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300 text-sm">None</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-2 bg-slate-600 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-500 transition-all duration-500"
                      style={{ width: `${next_goal.none * 100}%` }}
                    />
                  </div>
                  <span className="text-white font-semibold text-sm w-12 text-right">
                    {(next_goal.none * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300 text-sm">Away</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-2 bg-slate-600 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${next_goal.away * 100}%` }}
                    />
                  </div>
                  <span className="text-white font-semibold text-sm w-12 text-right">
                    {(next_goal.away * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}




