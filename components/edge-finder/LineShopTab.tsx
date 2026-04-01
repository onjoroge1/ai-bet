"use client"

import { useState, useEffect } from "react"
import { Search, Star, ChevronDown, ChevronUp } from "lucide-react"

interface LineShopMatch {
  matchId: string; homeTeam: string; awayTeam: string; league: string; kickoff: string; slug: string
  marketOverround: number
  bookmakers: { name: string; home: number; draw: number; away: number; overround: number }[]
  bestOdds: {
    home: { odds: number; book: string }
    draw: { odds: number; book: string }
    away: { odds: number; book: string }
  }
}

export function LineShopTab() {
  const [matches, setMatches] = useState<LineShopMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/odds/best-lines?limit=20")
      .then(r => r.json())
      .then(d => { if (d.success) setMatches(d.matches || []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 bg-slate-800/30 rounded-xl animate-pulse" />)}</div>

  if (matches.length === 0) {
    return (
      <div className="text-center py-16">
        <Search className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-300">No matches with bookmaker odds</h3>
        <p className="text-sm text-slate-500 mt-2">Odds are synced regularly. Check back soon.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">{matches.length} matches with bookmaker odds. Click to see all books.</p>

      {matches.map((match) => {
        const isExpanded = expanded === match.matchId
        const kickoff = new Date(match.kickoff)
        const timeLabel = kickoff.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

        return (
          <div key={match.matchId} className="rounded-xl border border-slate-700/50 bg-slate-800/30 overflow-hidden">
            <button onClick={() => setExpanded(isExpanded ? null : match.matchId)} className="w-full p-4 text-left">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-slate-500">{match.league}</span>
                    <span className="text-[10px] text-slate-600">{timeLabel}</span>
                    <span className="text-[10px] text-slate-600">{match.bookmakers.length} books</span>
                  </div>
                  <div className="text-sm font-medium text-white">{match.homeTeam} vs {match.awayTeam}</div>
                </div>

                {/* Best odds summary */}
                <div className="flex items-center gap-4 mr-2">
                  <div className="text-center">
                    <div className="text-[9px] text-slate-500 uppercase">Home</div>
                    <div className="text-sm font-bold text-emerald-400">{match.bestOdds.home.odds.toFixed(2)}</div>
                    <div className="text-[9px] text-slate-600">{match.bestOdds.home.book.slice(0, 12)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[9px] text-slate-500 uppercase">Draw</div>
                    <div className="text-sm font-bold text-blue-400">{match.bestOdds.draw.odds.toFixed(2)}</div>
                    <div className="text-[9px] text-slate-600">{match.bestOdds.draw.book.slice(0, 12)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[9px] text-slate-500 uppercase">Away</div>
                    <div className="text-sm font-bold text-amber-400">{match.bestOdds.away.odds.toFixed(2)}</div>
                    <div className="text-[9px] text-slate-600">{match.bestOdds.away.book.slice(0, 12)}</div>
                  </div>
                </div>

                {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
              </div>
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 border-t border-slate-700/30 pt-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-700/30">
                        <th className="text-left py-1.5 px-2">Bookmaker</th>
                        <th className="text-right py-1.5 px-2">Home</th>
                        <th className="text-right py-1.5 px-2">Draw</th>
                        <th className="text-right py-1.5 px-2">Away</th>
                        <th className="text-right py-1.5 px-2">Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {match.bookmakers.slice(0, 20).map((book) => {
                        const isBestHome = book.home === match.bestOdds.home.odds
                        const isBestDraw = book.draw === match.bestOdds.draw.odds
                        const isBestAway = book.away === match.bestOdds.away.odds

                        return (
                          <tr key={book.name} className="border-b border-slate-800/30 hover:bg-slate-800/20">
                            <td className="py-1.5 px-2 text-slate-300 capitalize">{book.name}</td>
                            <td className={`py-1.5 px-2 text-right font-medium ${isBestHome ? 'text-emerald-400' : 'text-slate-400'}`}>
                              {book.home.toFixed(2)} {isBestHome && <Star className="w-2.5 h-2.5 inline fill-emerald-400 text-emerald-400" />}
                            </td>
                            <td className={`py-1.5 px-2 text-right font-medium ${isBestDraw ? 'text-blue-400' : 'text-slate-400'}`}>
                              {book.draw.toFixed(2)} {isBestDraw && <Star className="w-2.5 h-2.5 inline fill-blue-400 text-blue-400" />}
                            </td>
                            <td className={`py-1.5 px-2 text-right font-medium ${isBestAway ? 'text-amber-400' : 'text-slate-400'}`}>
                              {book.away.toFixed(2)} {isBestAway && <Star className="w-2.5 h-2.5 inline fill-amber-400 text-amber-400" />}
                            </td>
                            <td className={`py-1.5 px-2 text-right ${book.overround < 3 ? 'text-emerald-400' : book.overround < 6 ? 'text-slate-400' : 'text-red-400'}`}>
                              {book.overround.toFixed(1)}%
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {match.bookmakers.length > 20 && (
                  <p className="text-[10px] text-slate-600 mt-2 text-center">+ {match.bookmakers.length - 20} more bookmakers</p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
