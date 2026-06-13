/**
 * Plain-English explainer for a value bet — the bridge between the edge
 * math and a casual user. One sentence built from the blocks, plus the
 * mandatory honesty subline. Renders nothing without an actionable bet.
 *
 *   "The market prices Paraguay at 23% — our model makes it 34%. At 4.20
 *    (betfair_ex_au), that's about +$42 per $100 staked over the long run."
 */
import { Lightbulb } from 'lucide-react'
import type { MarketBlock, ValueBlock } from '@/lib/edge/types'
import { whyThisBet, EV_HONESTY_NOTE } from '@/lib/edge/helpers'

export function WhyThisBet({
  market,
  value,
  modelProbs,
  homeLabel,
  awayLabel,
  className = '',
}: {
  market: MarketBlock | null
  value: ValueBlock | null
  /** Model probabilities (0..1); draw absent on 2-way sports. */
  modelProbs: { home: number; draw?: number; away: number }
  homeLabel?: string
  awayLabel?: string
  className?: string
}) {
  const vb = value?.value_bet
  if (!vb) return null

  const sideLabel =
    vb.outcome === 'home' ? (homeLabel || 'the home side')
    : vb.outcome === 'away' ? (awayLabel || 'the away side')
    : 'the draw'

  const marketProb = market ? (market.implied[vb.outcome] ?? null) : null
  const modelProbRaw = modelProbs[vb.outcome]
  const modelProb = typeof modelProbRaw === 'number' && modelProbRaw > 0 ? modelProbRaw : null

  const sentence = whyThisBet({
    sideLabel,
    marketProb,
    modelProb,
    price: vb.price ?? null,
    book: vb.book ?? null,
    ev: vb.ev,
  })

  return (
    <div className={`rounded-lg border border-slate-700 bg-slate-900/40 p-4 ${className}`}>
      <div className="flex items-start gap-2.5">
        <Lightbulb className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-slate-200 leading-relaxed">{sentence}</p>
          <p className="text-xs text-slate-500 mt-1.5">{EV_HONESTY_NOTE}</p>
        </div>
      </div>
    </div>
  )
}
