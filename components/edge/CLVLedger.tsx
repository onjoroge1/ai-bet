/**
 * §4.5 CLV Ledger — the retention feature.
 *
 * Per settled pick: bet price vs closing price vs realized CLV, plus rolling
 * aggregates ("You beat the close on 68% of picks, avg +2.1%"). The honest
 * answer to "is this working?" during a losing streak — CLV proves edge in
 * ~50 bets; win-rate needs thousands.
 *
 * Pure/presentational. Per-pick rows come from the clv block; aggregates are
 * computed upstream from settled history and passed in.
 */
import { LineChart, TrendingUp, TrendingDown } from 'lucide-react'
import type { ClvBlock } from '@/lib/edge/types'
import { formatEvPct } from '@/lib/edge/helpers'

export interface CLVAggregate {
  /** Fraction of settled picks that beat the close (0..1). */
  beatCloseRate: number
  /** Average realized CLV across settled picks (fraction). */
  avgClv: number
  nSettled: number
}

export interface CLVLedgerRow {
  id: string
  label: string            // e.g. "USA vs Paraguay · away"
  betTimeOdds: number | null
  closingOdds: number | null
  realizedClv: number | null
  settledAt?: string | null
}

export function CLVLedgerSummary({ agg }: { agg: CLVAggregate }) {
  if (agg.nSettled === 0) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4">
        <p className="text-sm text-slate-400">
          No settled picks yet. Once picks settle, this tracks how often you beat the closing line —
          the fastest honest proof of edge.
        </p>
      </div>
    )
  }
  const beatPct = (agg.beatCloseRate * 100).toFixed(0)
  const positive = agg.avgClv > 0
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4">
      <div className="flex items-center gap-2 mb-3">
        <LineChart className="w-4 h-4 text-blue-300" />
        <h3 className="text-sm font-semibold text-white">Closing-line value</h3>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-2xl font-bold text-white">{beatPct}%</p>
          <p className="text-xs text-slate-400">beat the close ({agg.nSettled} picks)</p>
        </div>
        <div>
          <p className={`text-2xl font-bold ${positive ? 'text-emerald-300' : 'text-red-300'}`}>
            {formatEvPct(agg.avgClv)}
          </p>
          <p className="text-xs text-slate-400">average CLV</p>
        </div>
      </div>
      <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
        CLV proves edge in ~50 bets; win-rate needs thousands. Beating the close means you got a better
        price than the market settled at — edge, independent of whether a single bet won.
      </p>
    </div>
  )
}

export function CLVLedgerRows({ rows }: { rows: CLVLedgerRow[] }) {
  if (rows.length === 0) return null
  return (
    <div className="space-y-1">
      {rows.map(r => {
        const clv = r.realizedClv
        const pending = clv == null
        return (
          <div key={r.id} className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg border border-slate-700/50 bg-slate-900/40 text-sm">
            <span className="text-white truncate flex-1">{r.label}</span>
            <span className="text-[11px] text-slate-400 font-mono">
              {r.betTimeOdds?.toFixed(2) ?? '—'} → {r.closingOdds?.toFixed(2) ?? '—'}
            </span>
            {pending ? (
              <span className="text-[11px] text-slate-500 w-16 text-right">pending</span>
            ) : (
              <span className={`text-[11px] font-semibold w-16 text-right inline-flex items-center justify-end gap-0.5 ${clv > 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                {clv > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {formatEvPct(clv)}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Helper for callers: roll settled clv blocks into an aggregate. */
export function aggregateCLV(blocks: Array<Pick<ClvBlock, 'realized_clv'>>): CLVAggregate {
  const settled = blocks.filter(b => typeof b.realized_clv === 'number') as Array<{ realized_clv: number }>
  if (settled.length === 0) return { beatCloseRate: 0, avgClv: 0, nSettled: 0 }
  const beat = settled.filter(b => b.realized_clv > 0).length
  const sum = settled.reduce((a, b) => a + b.realized_clv, 0)
  return {
    beatCloseRate: beat / settled.length,
    avgClv: sum / settled.length,
    nSettled: settled.length,
  }
}
