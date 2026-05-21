/**
 * Shared visual body for /soccer/today and /soccer/tomorrow.
 * Server component — receives the already-loaded HubData payload.
 */
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Trophy,
  Target,
  Calendar,
  TrendingUp,
  ChevronRight,
} from 'lucide-react'

// (ChevronRight kept — used inside top-picks card link)
import type { HubData } from '@/lib/soccer-hubs/data'
import type { FAQEntry } from '@/lib/soccer-hubs/faq'
import { FixturesByLeague } from './FixturesByLeague'

interface HubBodyProps {
  data: HubData
  /** Optional intro paragraph that varies per hub (today vs tomorrow vs league). */
  intro: string
  /** Pre-built FAQ for this hub variant. */
  faqs: FAQEntry[]
}

function fmtKickoffTime(d: Date): string {
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
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

export function HubBody({ data, intro, faqs }: HubBodyProps) {
  const hasFixtures = data.totalFixtures > 0
  const hasTopPicks = data.topPicks.length > 0

  return (
    <article className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <header>
        <h1 className="text-3xl sm:text-4xl font-bold text-white">
          AI Soccer Predictions — {data.dayLabel}
        </h1>
        <p className="text-slate-300 mt-3 max-w-3xl leading-relaxed">{intro}</p>
        <div className="flex flex-wrap gap-3 mt-4 text-sm text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="w-4 h-4" /> {data.totalFixtures} fixture{data.totalFixtures === 1 ? '' : 's'}
          </span>
          <span className="text-slate-600">·</span>
          <span className="inline-flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" /> {data.topPicks.length} high-confidence pick{data.topPicks.length === 1 ? '' : 's'}
          </span>
          <span className="text-slate-600">·</span>
          <Link href="/performance" className="text-blue-300 hover:text-blue-200 underline underline-offset-2">
            Live tracker →
          </Link>
        </div>
      </header>

      {/* ── Empty state ─────────────────────────────────────────── */}
      {!hasFixtures && (
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-10 text-center">
            <Calendar className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-300">No soccer fixtures scheduled in our data window for this day.</p>
            <p className="text-sm text-slate-500 mt-2">
              <Link href="/blog" className="text-blue-300 hover:text-blue-200 underline">
                Browse recent analysis →
              </Link>
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Top picks ──────────────────────────────────────────── */}
      {hasTopPicks && (
        <section>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-3">
            <Trophy className="w-5 h-5 text-amber-300" /> High-confidence picks
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.topPicks.map((f, i) => (
              <Card key={f.matchId} className="bg-slate-800 border-slate-700 hover:border-blue-500/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">#{i + 1} · {f.league}</span>
                    <Badge className={`${confidenceBadgeClass(f.confidence)} text-[10px] uppercase`}>
                      {(f.confidence * 100).toFixed(0)}% conf
                    </Badge>
                  </div>
                  <Link href={`/match/${f.matchSlug}`} className="block group">
                    <p className="text-sm font-semibold text-white group-hover:text-blue-300 leading-snug">
                      {f.homeTeam} vs {f.awayTeam}
                    </p>
                  </Link>
                  <div className="flex items-center gap-2 mt-3 text-xs text-slate-400">
                    <Target className="w-3.5 h-3.5 text-amber-300" />
                    <span className="font-semibold text-amber-200">Pick:</span>
                    <span className="text-slate-200">{pickLabel(f.pick, f.homeTeam, f.awayTeam)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/60 text-xs">
                    <span className="text-slate-400">{fmtKickoffTime(f.kickoffDate)} UTC</span>
                    <Link href={`/match/${f.matchSlug}`} className="text-blue-300 hover:text-blue-200 inline-flex items-center gap-1">
                      Analysis <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* ── All fixtures by league ─────────────────────────────── */}
      {hasFixtures && (
        <section>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-3">
            <Calendar className="w-5 h-5 text-blue-300" /> All fixtures
          </h2>
          <FixturesByLeague byLeague={data.byLeague} />
        </section>
      )}

      {/* ── FAQ ─────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-3">Frequently asked</h2>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <Card key={i} className="bg-slate-800 border-slate-700">
              <CardContent className="p-5">
                <p className="text-sm font-semibold text-white">{faq.question}</p>
                <p className="text-sm text-slate-300 mt-2 leading-relaxed">{faq.answer}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Methodology footer ─────────────────────────────────── */}
      <Card className="bg-slate-900/60 border-slate-700">
        <CardContent className="p-5 text-xs text-slate-400 leading-relaxed">
          Predictions are AI-generated and provided for informational purposes only.{' '}
          <Link href="/methodology" className="text-blue-300 hover:text-blue-200 underline">Methodology</Link>
          {' · '}
          <Link href="/performance" className="text-blue-300 hover:text-blue-200 underline">Live performance audit</Link>
          {' · '}
          <Link href="/responsible-betting" className="text-blue-300 hover:text-blue-200 underline">Bet responsibly</Link>
        </CardContent>
      </Card>
    </article>
  )
}
