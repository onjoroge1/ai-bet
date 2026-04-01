"use client"

import { useState, useEffect } from "react"
import { TrendingUp, Lock, ArrowUpRight } from "lucide-react"
import Link from "next/link"

interface EVBet {
  matchId: string; homeTeam: string; awayTeam: string; league: string; kickoff: string
  outcome: string; outcomeTeam: string; modelProb: number; impliedProb: number
  edgePercent: number; bestOdds: number; bestBook: string; fairOdds: number
  kellyStake: number; confidence: number; slug: string
}

export function EVScannerTab() {
  const [data, setData] = useState<{ bets: EVBet[]; isPremium: boolean; total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [minEdge, setMinEdge] = useState(2)

  useEffect(() => {
    fetch(`/api/odds/positive-ev?limit=30&min_edge=${minEdge}`)
      .then(r => r.json())
      .then(d => { if (d.success) setData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [minEdge])

  if (loading) return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-slate-800/30 rounded-xl animate-pulse" />)}</div>

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-400">Min edge:</span>
        {[2, 5, 10, 15].map(e => (
          <button key={e} onClick={() => setMinEdge(e)} className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${minEdge === e ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800/50 text-slate-400 border border-slate-700/50'}`}>
            {e}%+
          </button>
        ))}
      </div>

      {!data || data.bets.length === 0 ? (
        <div className="text-center py-16">
          <TrendingUp className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-300">No +EV bets found at {minEdge}%+ edge</h3>
          <p className="text-sm text-slate-500 mt-2">Try lowering the minimum edge filter.</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-500">{data.total} bets where our model sees higher probability than the market implies.</p>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-slate-700/50">
                  <th className="text-left py-2 px-3">Match</th>
                  <th className="text-left py-2 px-3">Pick</th>
                  <th className="text-right py-2 px-3">Model</th>
                  <th className="text-right py-2 px-3">Market</th>
                  <th className="text-right py-2 px-3">Edge</th>
                  <th className="text-right py-2 px-3">Best Odds</th>
                  <th className="text-right py-2 px-3">Book</th>
                  <th className="text-right py-2 px-3">Kelly %</th>
                </tr>
              </thead>
              <tbody>
                {data.bets.map((bet, i) => {
                  const isLocked = !data.isPremium
                  return (
                    <tr key={`${bet.matchId}-${bet.outcome}-${i}`} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="py-3 px-3">
                        <Link href={bet.slug} className="hover:text-emerald-400 transition-colors">
                          <div className="text-white font-medium text-xs">{bet.homeTeam} vs {bet.awayTeam}</div>
                          <div className="text-[10px] text-slate-500">{bet.league}</div>
                        </Link>
                      </td>
                      <td className="py-3 px-3">
                        {isLocked ? <Lock className="w-3 h-3 text-slate-500" /> : (
                          <span className="text-xs font-medium text-emerald-400">{bet.outcomeTeam}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right text-xs text-white">{Math.round(bet.modelProb * 100)}%</td>
                      <td className="py-3 px-3 text-right text-xs text-slate-400">{Math.round(bet.impliedProb * 100)}%</td>
                      <td className="py-3 px-3 text-right">
                        <span className={`text-xs font-bold ${bet.edgePercent >= 10 ? 'text-amber-400' : bet.edgePercent >= 5 ? 'text-emerald-400' : 'text-blue-400'}`}>
                          +{bet.edgePercent}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-xs text-white">
                        {isLocked ? '🔒' : bet.bestOdds.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right text-[10px] text-slate-400">
                        {isLocked ? '🔒' : bet.bestBook}
                      </td>
                      <td className="py-3 px-3 text-right text-xs text-slate-300">
                        {isLocked ? '🔒' : `${bet.kellyStake}%`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {!data.isPremium && (
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/20 rounded-xl">
              <div>
                <p className="text-sm font-medium text-white">See all {data.total} +EV opportunities</p>
                <p className="text-xs text-slate-400">Unlock book names, exact odds, and Kelly stakes</p>
              </div>
              <Link href="/pricing" className="px-4 py-2 bg-emerald-500 text-black text-sm font-semibold rounded-lg">Upgrade</Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}
