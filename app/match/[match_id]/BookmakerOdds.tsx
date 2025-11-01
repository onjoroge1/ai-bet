"use client"

import { Card } from "@/components/ui/card"

type ThreeWay = "home" | "draw" | "away"

interface BookmakerOddsProps {
  books: Record<string, { home: number; draw: number; away: number }>
  matchData: {
    home: { name: string }
    away: { name: string }
  }
}

export default function BookmakerOdds({ books, matchData }: BookmakerOddsProps) {
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

  return (
    <Card className="bg-slate-800/60 border-slate-700">
      <div className="p-4">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">All Bookmaker Odds</h3>
          <div className="text-[12px] text-slate-400">
            {bookmakerNames.length === 1 ? "1 bookmaker" : `${bookmakerNames.length} bookmakers`}
          </div>
        </div>

        {/* Compact single table, scrollable if long */}
        <div className="max-h-[520px] overflow-auto rounded-md border border-slate-700/60">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/70 sticky top-0 z-10">
              <tr className="text-slate-300 text-xs">
                <th className="text-left px-3 py-2 w-[50%]">Bookmaker</th>
                <th className="text-center px-2 py-2">{matchData.home.name}</th>
                <th className="text-center px-2 py-2">Draw</th>
                <th className="text-center px-2 py-2">{matchData.away.name}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {bookmakerNames.map((bookmaker) => {
                const odds = books[bookmaker]
                const isBestHome = bestOdds.home.bookmaker === bookmaker
                const isBestDraw = bestOdds.draw.bookmaker === bookmaker
                const isBestAway = bestOdds.away.bookmaker === bookmaker

                const cell = (value: number, best: boolean) => (
                  <td className="px-2 py-2 text-center">
                    <span className={`${best ? 'text-emerald-300 font-semibold' : 'text-slate-200'}`}>{value.toFixed(2)}</span>
                    {best && <span className="ml-1 text-[10px] text-emerald-400">BEST</span>}
                  </td>
                )

                return (
                  <tr key={bookmaker} className="hover:bg-slate-800/30">
                    <td className="px-3 py-2 text-slate-300 uppercase text-xs">{bookmaker.replace(/_/g, ' ')}</td>
                    {cell(odds.home, isBestHome)}
                    {cell(odds.draw, isBestDraw)}
                    {cell(odds.away, isBestAway)}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  )
}

