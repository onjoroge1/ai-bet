/**
 * §4.4 Stake Suggester.
 *
 * Surfaces quarter-Kelly by default: "Suggested: 3.7% of bankroll
 * (quarter-Kelly)". With a user bankroll, converts to a unit amount. Full
 * Kelly is hidden behind an "advanced" toggle with a variance warning.
 * Display is capped at 5% even if Kelly says more.
 *
 * Client component (the advanced toggle holds local state).
 */
'use client'

import { useState } from 'react'
import { Coins, ChevronDown, AlertTriangle } from 'lucide-react'
import type { ValueBet } from '@/lib/edge/types'
import { displayStakeFraction, stakeFromBankroll, formatStakePct, STAKE_DISPLAY_CAP } from '@/lib/edge/helpers'

interface StakeSuggesterProps {
  valueBet: ValueBet
  /** User's bankroll in their currency; when set we show a money amount. */
  bankroll?: number | null
  currencySymbol?: string
}

export function StakeSuggester({ valueBet, bankroll = null, currencySymbol = '$' }: StakeSuggesterProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  const quarter = displayStakeFraction(valueBet.kelly_quarter)
  const quarterCapped = valueBet.kelly_quarter > STAKE_DISPLAY_CAP
  const fullCapped = displayStakeFraction(valueBet.kelly_full)

  const quarterMoney = bankroll ? stakeFromBankroll(quarter, bankroll) : null
  const fullMoney = bankroll ? stakeFromBankroll(fullCapped, bankroll) : null

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
      <div className="flex items-center gap-2">
        <Coins className="w-4 h-4 text-amber-300 flex-shrink-0" />
        <div className="text-sm">
          <span className="text-white font-semibold">Suggested: {formatStakePct(quarter)} of bankroll</span>
          <span className="text-slate-400"> (quarter-Kelly)</span>
          {quarterMoney != null && (
            <span className="text-slate-300"> · {currencySymbol}{quarterMoney.toLocaleString()}</span>
          )}
        </div>
      </div>
      {quarterCapped && (
        <p className="text-[11px] text-amber-300/80 mt-1 ml-6">Capped at {formatStakePct(STAKE_DISPLAY_CAP)} for safety.</p>
      )}

      <button
        type="button"
        onClick={() => setShowAdvanced(v => !v)}
        className="mt-2 ml-6 inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"
      >
        Advanced <ChevronDown className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
      </button>

      {showAdvanced && (
        <div className="mt-2 ml-6 rounded border border-amber-500/30 bg-amber-950/20 p-2">
          <p className="text-xs text-amber-200 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>
              Full Kelly: {formatStakePct(fullCapped)}
              {fullMoney != null && <> · {currencySymbol}{fullMoney.toLocaleString()}</>}.
              Full Kelly maximizes growth but swings hard — most bettors should stay at quarter.
            </span>
          </p>
        </div>
      )}
    </div>
  )
}
