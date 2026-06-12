/**
 * §4.3 Price Guard — prevents the stale-tip loss.
 *
 * On every value bet: "Value at ≥ {min}. Best now: {price} ({book})". If a
 * live price is supplied and it has dropped below min_acceptable_odds, the
 * component flips to an "edge gone — don't bet" state automatically. This
 * single component stops users taking dead prices.
 */
import { ShieldCheck, ShieldAlert } from 'lucide-react'
import type { ValueBet } from '@/lib/edge/types'
import { priceGuard } from '@/lib/edge/helpers'

interface PriceGuardProps {
  valueBet: ValueBet
  /** Live decimal price for the value outcome, if you have a live quote. */
  livePrice?: number | null
}

export function PriceGuard({ valueBet, livePrice = null }: PriceGuardProps) {
  const guard = priceGuard(valueBet.min_acceptable_odds, livePrice)
  const shownPrice = livePrice ?? valueBet.price
  const shownBook = valueBet.book

  if (guard.edgeGone) {
    return (
      <div className="rounded-lg border border-red-500/50 bg-red-950/30 p-3 flex items-start gap-2">
        <ShieldAlert className="w-4 h-4 text-red-300 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-red-200">Edge gone — don&apos;t bet</p>
          <p className="text-red-300/90 text-xs mt-0.5">
            Live price {shownPrice.toFixed(2)} is below the {valueBet.min_acceptable_odds.toFixed(2)} floor.
            The value is no longer there.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/20 p-3 flex items-start gap-2">
      <ShieldCheck className="w-4 h-4 text-emerald-300 flex-shrink-0 mt-0.5" />
      <div className="text-sm">
        <p className="font-semibold text-emerald-200">
          Value while ≥ {valueBet.min_acceptable_odds.toFixed(2)}
        </p>
        <p className="text-emerald-300/90 text-xs mt-0.5">
          Best now: <span className="font-mono">{shownPrice.toFixed(2)}</span> ({shownBook})
          {livePrice == null && <span className="text-emerald-400/70"> · captured price</span>}
        </p>
      </div>
    </div>
  )
}
