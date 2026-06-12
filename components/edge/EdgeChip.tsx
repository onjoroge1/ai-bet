/**
 * Compact value chip for LIST rows (match lists, hub fixtures, WC rows),
 * driven by the chip-sized EdgeSummary rather than the full ValueBlock.
 * Renders nothing when there's no actionable value — list rows stay quiet
 * instead of showing a "no value" pill per row.
 */
import { Badge } from '@/components/ui/badge'
import { TrendingUp } from 'lucide-react'
import type { EdgeSummary } from '@/lib/edge/extract'
import { hasActionableValue } from '@/lib/edge/extract'
import { formatEvPct, ratingLabel } from '@/lib/edge/helpers'

const TIER_CLASS: Record<string, string> = {
  strong_value: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50',
  value: 'bg-blue-500/20 text-blue-300 border-blue-500/50',
  marginal: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
}

export function EdgeChip({ summary, className = '' }: { summary: EdgeSummary | null; className?: string }) {
  if (!summary || !hasActionableValue(summary) || !summary.rating || summary.ev === null) return null
  const tierCls = TIER_CLASS[summary.rating] ?? TIER_CLASS.marginal
  return (
    <Badge className={`${tierCls} ${className} inline-flex items-center gap-1 text-[10px] font-semibold`}>
      <TrendingUp className="w-3 h-3" />
      {ratingLabel(summary.rating)} · {formatEvPct(summary.ev)} EV
    </Badge>
  )
}
