/**
 * §4.1 Value Badge — replaces the confidence pill.
 *
 * Tier-colored chip from value.rating. Shows the value outcome's EV.
 * Renders NOTHING when there's no value block or no value bet (callers
 * should show the No-Value state instead).
 */
import { Badge } from '@/components/ui/badge'
import { TrendingUp } from 'lucide-react'
import type { ValueBlock } from '@/lib/edge/types'
import { formatEvPct, formatEvDollars, ratingLabel } from '@/lib/edge/helpers'

const TIER_CLASS: Record<string, string> = {
  strong_value: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50',
  value: 'bg-blue-500/20 text-blue-300 border-blue-500/50',
  marginal: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
  no_value: 'bg-slate-600/20 text-slate-400 border-slate-600/50',
}

export function ValueBadge({ value, className = '' }: { value: ValueBlock | null; className?: string }) {
  // Hide entirely when there's nothing actionable to badge.
  if (!value || !value.value_bet) return null

  const tierCls = TIER_CLASS[value.rating] ?? TIER_CLASS.no_value
  const tooltip = `Expected value: about ${formatEvDollars(value.value_bet.ev)} over the long run at this price. Individual bets lose often — EV is a long-run average.`
  return (
    <Badge title={tooltip} className={`${tierCls} ${className} inline-flex items-center gap-1 font-semibold cursor-help`}>
      <TrendingUp className="w-3 h-3" />
      {ratingLabel(value.rating)} · {formatEvPct(value.value_bet.ev)} EV
    </Badge>
  )
}
