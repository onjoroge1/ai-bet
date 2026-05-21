/**
 * Compact fixtures-by-league list. Used by daily hubs (full HubBody) and
 * by league hubs (without the hub-level hero/FAQ wrapping).
 */
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, ChevronRight } from 'lucide-react'
import type { HubFixture } from '@/lib/soccer-hubs/data'

interface FixturesByLeagueProps {
  byLeague: Array<{ league: string; flagEmoji: string | null; fixtures: HubFixture[] }>
  /** When true, suppresses the league name header (used when the page
   * itself is already scoped to one league). */
  hideLeagueHeaders?: boolean
  emptyMessage?: string
}

function fmtKickoffTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
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

export function FixturesByLeague({ byLeague, hideLeagueHeaders, emptyMessage }: FixturesByLeagueProps) {
  const total = byLeague.reduce((sum, g) => sum + g.fixtures.length, 0)
  if (total === 0) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-8 text-center">
          <Calendar className="w-8 h-8 text-slate-500 mx-auto mb-2" />
          <p className="text-slate-300 text-sm">{emptyMessage || 'No fixtures in this window.'}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {byLeague.map(group => (
        <Card key={group.league} className="bg-slate-800 border-slate-700">
          <CardContent className="p-5">
            {!hideLeagueHeaders && (
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">
                  {group.flagEmoji && <span className="mr-2">{group.flagEmoji}</span>}
                  {group.league}
                </h3>
                <span className="text-xs text-slate-400">{group.fixtures.length} fixture{group.fixtures.length === 1 ? '' : 's'}</span>
              </div>
            )}
            <div className="space-y-1">
              {group.fixtures.map(f => (
                <div key={f.matchId} className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg border border-slate-700/50 bg-slate-900/40 text-sm">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-[10px] text-slate-500 w-12 flex-shrink-0">{fmtKickoffTime(f.kickoffDate)}</span>
                    <span className="text-white truncate">
                      {f.homeTeamSlug ? (
                        <Link href={`/team/${f.homeTeamSlug}/predictions`} className="hover:text-blue-300">
                          {f.homeTeam}
                        </Link>
                      ) : f.homeTeam}
                      <span className="text-slate-500 mx-1.5">vs</span>
                      {f.awayTeamSlug ? (
                        <Link href={`/team/${f.awayTeamSlug}/predictions`} className="hover:text-blue-300">
                          {f.awayTeam}
                        </Link>
                      ) : f.awayTeam}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {f.confidence >= 0.5 && f.pick !== null && (
                      <Badge className={`${confidenceBadgeClass(f.confidence)} text-[10px]`}>
                        {pickLabel(f.pick, f.homeTeam, f.awayTeam)} · {(f.confidence * 100).toFixed(0)}%
                      </Badge>
                    )}
                    <Link href={`/match/${f.matchSlug}`} className="text-xs text-blue-300 hover:text-blue-200 inline-flex items-center gap-0.5">
                      View <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
