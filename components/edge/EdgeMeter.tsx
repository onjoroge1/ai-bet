/**
 * §4.2 Edge Meter — the new core per-match visual.
 *
 * Three rows (H/D/A), each pairing the de-vigged MARKET probability against
 * the MODEL probability. The gap between the bars IS the edge. The value
 * outcome is annotated: "Market 22.6% → Model 33.7% (+11.1)".
 *
 * Pure/presentational. Works pre-pivot too (model probs come from the
 * legacy predictions block). Shown even in the no-value state as information.
 */
import type { MarketBlock, ValueBlock } from '@/lib/edge/types'
import { edgeMeterRows, formatProbPct, formatEdgePoints } from '@/lib/edge/helpers'

interface EdgeMeterProps {
  market: MarketBlock
  /** Model probabilities from predictions (home_win/draw/away_win), 0..1. */
  modelProbs: { home: number; draw: number; away: number }
  value: ValueBlock | null
}

export function EdgeMeter({ market, modelProbs, value }: EdgeMeterProps) {
  const rows = edgeMeterRows(market, modelProbs, value)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-slate-400">
        <span>Outcome</span>
        <span className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-slate-500 inline-block" /> Market</span>
          <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-blue-400 inline-block" /> Model</span>
        </span>
      </div>

      {rows.map(row => {
        const positiveEdge = row.edge > 0.0005
        return (
          <div
            key={row.outcome}
            className={`rounded-lg border p-3 ${
              row.isValueOutcome
                ? 'border-emerald-500/50 bg-emerald-950/20'
                : 'border-slate-700 bg-slate-900/40'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-white">{row.label}</span>
              <span
                className={`text-xs font-mono ${
                  positiveEdge ? 'text-emerald-300' : row.edge < -0.0005 ? 'text-red-300' : 'text-slate-400'
                }`}
              >
                {formatEdgePoints(row.edge)} pts
              </span>
            </div>

            {/* Paired bars */}
            <div className="space-y-1.5">
              <Bar label="Market" pct={row.marketProb} color="bg-slate-500" />
              <Bar label="Model" pct={row.modelProb} color="bg-blue-400" />
            </div>

            {row.isValueOutcome && (
              <p className="text-xs text-emerald-300 mt-2">
                Market {formatProbPct(row.marketProb)} → Model {formatProbPct(row.modelProb)} ({formatEdgePoints(row.edge)})
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Bar({ label, pct, color }: { label: string; pct: number; color: string }) {
  const width = `${Math.max(0, Math.min(1, pct)) * 100}%`
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-500 w-12 flex-shrink-0">{label}</span>
      <div className="flex-1 h-2.5 rounded-full bg-slate-800 overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width }} />
      </div>
      <span className="text-[10px] text-slate-300 font-mono w-12 text-right flex-shrink-0">{formatProbPct(pct)}</span>
    </div>
  )
}
