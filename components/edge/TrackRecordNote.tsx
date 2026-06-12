/**
 * §2.4 / §5 — the honesty block, surfaced.
 *
 * Renders model_track_record as a small, neutral provenance line. When the
 * model is edge-validated it earns a quiet green check; when not, it states
 * plainly that there's no demonstrated edge. This is the disclosure that
 * MUST appear anywhere a pick is shown — do not work around the flag.
 */
import { BadgeCheck, Info } from 'lucide-react'
import type { ModelTrackRecord } from '@/lib/edge/types'
import { formatEvPct } from '@/lib/edge/helpers'

export function TrackRecordNote({ track }: { track: ModelTrackRecord | null }) {
  if (!track) return null

  if (track.edge_validated) {
    return (
      <div className="flex items-start gap-2 text-[11px] text-slate-400">
        <BadgeCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
        <span>
          <span className="text-emerald-300 font-medium">Edge-validated</span> model ({track.model},{' '}
          {track.segment.replace('_', ' ')}): {track.validation}.
          {typeof track.median_clv_90d === 'number' && (
            <> 90d median CLV {formatEvPct(track.median_clv_90d)}{track.n_settled ? ` (n=${track.n_settled})` : ''}.</>
          )}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2 text-[11px] text-slate-500">
      <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
      <span>
        Calibrated probabilities from {track.model} — no demonstrated edge in this market segment
        ({track.segment.replace('_', ' ')}). Shown as information, not a pick.
      </span>
    </div>
  )
}
