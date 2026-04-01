"use client"

import { useState, useEffect } from "react"
import { ArrowLeftRight, Lock, TrendingDown, ChevronDown, ChevronUp, ExternalLink } from "lucide-react"
import Link from "next/link"

interface ArbOpportunity {
  matchId: string; homeTeam: string; awayTeam: string; league: string; kickoff: string
  arbPercent: number; profitPercent: number; slug: string
  bets: { outcome: string; book: string; odds: number; stakeAmount: number }[]
  guaranteedReturn: number
}

export function ArbFinderTab() {
  const [data, setData] = useState<{ opportunities: ArbOpportunity[]; isPremium: boolean; total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/odds/arbitrage?limit=30")
      .then(r => r.json())
      .then(d => { if (d.success) setData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 bg-slate-800/30 rounded-xl animate-pulse" />)}</div>

  if (!data || data.opportunities.length === 0) {
    return (
      <div className="text-center py-16">
        <ArrowLeftRight className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-300">No arbitrage opportunities right now</h3>
        <p className="text-sm text-slate-500 mt-2">True arbs are rare — we scan 50+ books every sync cycle.<br />Check back when more odds come in.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        {data.total} near-arbitrage opportunities found. Arb% &lt; 100 = guaranteed profit.
      </p>

      {data.opportunities.map((opp) => {
        const isArb = opp.arbPercent < 100
        const isExpanded = expanded === opp.matchId

        return (
          <div key={opp.matchId} className={`rounded-xl border ${isArb ? 'border-amber-500/30 bg-amber-500/5' : 'border-slate-700/50 bg-slate-800/30'} overflow-hidden`}>
            <button onClick={() => setExpanded(isExpanded ? null : opp.matchId)} className="w-full p-4 flex items-center justify-between text-left">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-slate-400">{opp.league}</span>
                  {isArb && <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded-full font-bold">ARB</span>}
                </div>
                <div className="text-sm font-medium text-white">{opp.homeTeam} vs {opp.awayTeam}</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className={`text-lg font-bold ${isArb ? 'text-amber-400' : opp.arbPercent < 101 ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {opp.arbPercent.toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {isArb ? `+${opp.profitPercent.toFixed(2)}% profit` : 'Near-arb'}
                  </div>
                </div>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
              </div>
            </button>

            {isExpanded && data.isPremium && (
              <div className="px-4 pb-4 border-t border-slate-700/30 pt-3">
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {opp.bets.map((bet) => (
                    <div key={bet.outcome} className="bg-slate-900/50 rounded-lg p-3 text-center">
                      <div className="text-[10px] text-slate-500 uppercase mb-1">{bet.outcome}</div>
                      <div className="text-sm font-bold text-white">{bet.odds.toFixed(2)}</div>
                      <div className="text-[10px] text-slate-400">{bet.book}</div>
                      <div className="text-xs text-emerald-400 mt-1">${bet.stakeAmount.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">$100 stake → <span className="text-emerald-400 font-medium">${opp.guaranteedReturn.toFixed(2)} return</span></span>
                  <Link href={opp.slug} className="text-amber-400 hover:text-amber-300 flex items-center gap-1">
                    Match details <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            )}

            {isExpanded && !data.isPremium && (
              <div className="px-4 pb-4 border-t border-slate-700/30 pt-3 flex items-center gap-3">
                <Lock className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-400">Upgrade to see book names, odds, and optimal stakes</span>
                <Link href="/pricing" className="ml-auto px-3 py-1 bg-amber-500 text-black text-xs font-semibold rounded-lg">Upgrade</Link>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
