"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp } from "lucide-react"
import { edgeEV } from "@/lib/odds"

type ThreeWay = "home" | "draw" | "away"

interface BookmakerOddsProps {
  books: Record<string, { home: number; draw: number; away: number }>
  matchData: {
    home: { name: string }
    away: { name: string }
  }
  novig?: { home: number; draw: number; away: number }
}

export default function BookmakerOdds({ books, matchData, novig }: BookmakerOddsProps) {
  const bookmakerNames = Object.keys(books || {})
  
  if (bookmakerNames.length === 0) return null

  // Calculate best odds for each outcome
  const bestOdds = {
    home: { value: 0, bookmaker: "" },
    draw: { value: 0, bookmaker: "" },
    away: { value: 0, bookmaker: "" }
  }

  bookmakerNames.forEach((bookmaker) => {
    const odds = books[bookmaker]
    if (odds.home > bestOdds.home.value) {
      bestOdds.home.value = odds.home
      bestOdds.home.bookmaker = bookmaker
    }
    if (odds.draw > bestOdds.draw.value) {
      bestOdds.draw.value = odds.draw
      bestOdds.draw.bookmaker = bookmaker
    }
    if (odds.away > bestOdds.away.value) {
      bestOdds.away.value = odds.away
      bestOdds.away.bookmaker = bookmaker
    }
  })

  // Helper to get EV color
  const getEVColor = (ev: number) => {
    if (ev >= 0.02) return 'text-emerald-400 bg-emerald-500/10'
    if (ev > 0) return 'text-blue-400 bg-blue-500/10'
    return 'text-slate-400 bg-slate-600/10'
  }

  // Helper to calculate EV if novig probabilities available
  const calculateEV = (bookmakerOdds: number, outcome: 'home' | 'draw' | 'away') => {
    if (!novig) return null
    const prob = novig[outcome]
    return edgeEV(prob, bookmakerOdds)
  }

  return (
    <Card className="bg-slate-800/60 border-slate-700">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-400" />
            <h3 className="text-base font-semibold text-white">All Bookmaker Odds</h3>
          </div>
          <Badge className="bg-slate-700/50 text-slate-300 border-slate-600 text-xs">
            {bookmakerNames.length} {bookmakerNames.length === 1 ? 'bookmaker' : 'bookmakers'}
          </Badge>
        </div>

        {/* Scrollable table with better spacing */}
        <div className="overflow-x-auto -mx-6 px-6">
          <div className="min-w-full">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/70 sticky top-0 z-10">
                <tr>
                  <th className="text-left px-3 py-3 text-slate-300 text-xs font-semibold uppercase tracking-wide min-w-[120px]">
                    Bookmaker
                  </th>
                  <th className="text-center px-3 py-3 text-slate-300 text-xs font-semibold uppercase tracking-wide min-w-[90px]">
                    <div className="truncate max-w-[80px] mx-auto" title={matchData.home.name}>
                      {matchData.home.name}
                    </div>
                  </th>
                  <th className="text-center px-3 py-3 text-slate-300 text-xs font-semibold uppercase tracking-wide min-w-[80px]">
                    Draw
                  </th>
                  <th className="text-center px-3 py-3 text-slate-300 text-xs font-semibold uppercase tracking-wide min-w-[90px]">
                    <div className="truncate max-w-[80px] mx-auto" title={matchData.away.name}>
                      {matchData.away.name}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {bookmakerNames.map((bookmaker) => {
                  const odds = books[bookmaker]
                  const isBestHome = bestOdds.home.bookmaker === bookmaker
                  const isBestDraw = bestOdds.draw.bookmaker === bookmaker
                  const isBestAway = bestOdds.away.bookmaker === bookmaker

                  const homeEV = calculateEV(odds.home, 'home')
                  const drawEV = calculateEV(odds.draw, 'draw')
                  const awayEV = calculateEV(odds.away, 'away')

                  const cell = (value: number, best: boolean, ev: number | null, outcome: string) => (
                    <td className="px-3 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-1">
                          <span className={`text-sm font-semibold ${best ? 'text-emerald-400' : 'text-slate-200'}`}>
                            {value.toFixed(2)}
                          </span>
                          {best && (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px] px-1 py-0 h-4">
                              BEST
                            </Badge>
                          )}
                        </div>
                        {ev !== null && (
                          <div className={`text-[10px] px-1.5 py-0.5 rounded ${getEVColor(ev)}`}>
                            EV {ev >= 0 ? '+' : ''}{(ev * 100).toFixed(1)}%
                          </div>
                        )}
                      </div>
                    </td>
                  )

                  return (
                    <tr key={bookmaker} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-3 py-3">
                        <span className="text-slate-300 text-xs font-medium">
                          {bookmaker.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                        </span>
                      </td>
                      {cell(odds.home, isBestHome, homeEV, 'home')}
                      {cell(odds.draw, isBestDraw, drawEV, 'draw')}
                      {cell(odds.away, isBestAway, awayEV, 'away')}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Card>
  )
}

