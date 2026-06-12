/**
 * One World Cup fixture row — used on the hub, group, and team pages.
 * Shows flags (when teams resolve to the registry), pick badge, and a
 * link to the full match analysis.
 */
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { ChevronRight } from 'lucide-react'
import type { WCFixture } from '@/lib/world-cup/data'
import { isEdgePivotEnabled } from '@/lib/feature-flags'
import { EdgeChip } from '@/components/edge'

function fmtKickoff(d: Date): string {
  return d.toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function pickLabel(pick: 'home' | 'away' | 'draw' | null, home: string, away: string): string {
  if (pick === 'home') return `${home} win`
  if (pick === 'away') return `${away} win`
  if (pick === 'draw') return 'Draw'
  return '—'
}

function confidenceBadgeClass(conf: number): string {
  if (conf >= 0.65) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
  if (conf >= 0.55) return 'bg-blue-500/20 text-blue-300 border-blue-500/40'
  return 'bg-slate-500/20 text-slate-300 border-slate-500/40'
}

export function WCFixtureRow({ fixture: f }: { fixture: WCFixture }) {
  const isFinished = f.status === 'FINISHED'
  return (
    <div className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg border border-slate-700/50 bg-slate-900/40 text-sm">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-[10px] text-slate-500 w-24 flex-shrink-0">{fmtKickoff(f.kickoffDate)}</span>
        <span className="text-white truncate">
          {f.homeWCTeam && <span className="mr-1">{f.homeWCTeam.flagEmoji}</span>}
          {f.homeTeam}
          <span className="text-slate-500 mx-1.5">vs</span>
          {f.awayWCTeam && <span className="mr-1">{f.awayWCTeam.flagEmoji}</span>}
          {f.awayTeam}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {f.groupLetter && (
          <span className="text-[10px] text-slate-500">Grp {f.groupLetter}</span>
        )}
        {!isFinished && isEdgePivotEnabled() && <EdgeChip summary={f.edge} />}
        {!isFinished && !(isEdgePivotEnabled() && f.edge) && f.confidence >= 0.5 && f.pick !== null && (
          <Badge className={`${confidenceBadgeClass(f.confidence)} text-[10px]`}>
            {pickLabel(f.pick, f.homeTeam, f.awayTeam)} · {(f.confidence * 100).toFixed(0)}%
          </Badge>
        )}
        <Link href={`/match/${f.matchSlug}`} className="text-xs text-blue-300 hover:text-blue-200 inline-flex items-center gap-0.5">
          View <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  )
}
