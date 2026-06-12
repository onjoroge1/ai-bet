/**
 * §4.6 No-Value Empty State — designed deliberately, not an error.
 *
 * Most matches have value_bet: null. Copy reframes not-betting as the
 * correct, +EV move. The Edge Meter is still shown (as information) by the
 * caller; this is just the headline + reassurance, with NO CTA.
 *
 * Also used for the disclosure case (§5): an unvalidated (club/V3) model —
 * pass `unvalidated` to swap the copy to "no demonstrated edge".
 */
import { MinusCircle, Info } from 'lucide-react'

export function NoValueState({ unvalidated = false }: { unvalidated?: boolean }) {
  if (unvalidated) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-white">Calibrated probabilities — no demonstrated edge</p>
          <p className="text-sm text-slate-400 mt-1 leading-relaxed">
            This match is priced by an efficient market segment where our model hasn&apos;t beaten the line in
            holdout testing. We show the probabilities as information, not as a pick.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4 flex items-start gap-3">
      <MinusCircle className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-white">No value at current prices</p>
        <p className="text-sm text-slate-400 mt-1 leading-relaxed">
          The market has this one right. Not betting is the +EV move today — the edge meter below shows why
          our probabilities don&apos;t beat the price.
        </p>
      </div>
    </div>
  )
}
