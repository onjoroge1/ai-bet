import Link from 'next/link'
import { AdvancedBreadcrumb } from '@/components/advanced-breadcrumb'
import { NewsArticleSchema } from '@/components/schema-markup'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  BarChart3,
  Calendar,
  Clock,
  Flame,
  Trophy,
  Users,
  ChevronRight,
  AlertCircle,
} from 'lucide-react'
import {
  getMultisportHubData,
  getMultisportSportSummary,
  type SportDef,
  type MultisportHubFixture,
} from '@/lib/multisport-hubs/data'

// ─── Helpers ──────────────────────────────────────────────────────────

function fmtKickoffShort(d: Date): string {
  return d.toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtDateShort(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtPct(p: number | null): string {
  if (p === null) return '—'
  return `${(p * 100).toFixed(1)}%`
}

function pickLabel(pick: MultisportHubFixture['pick'], home: string, away: string): string {
  if (pick === 'home') return `${home} to win`
  if (pick === 'away') return `${away} to win`
  return 'No pick'
}

function FormPip({ ch }: { ch: string }) {
  const cls = ch === 'W'
    ? 'bg-emerald-500/30 text-emerald-200 border-emerald-500/40'
    : ch === 'L'
      ? 'bg-red-500/30 text-red-200 border-red-500/40'
      : 'bg-slate-600/30 text-slate-300 border-slate-500/40'
  return <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold border ${cls}`}>{ch}</span>
}

// ─── Component ────────────────────────────────────────────────────────

/**
 * Shared body for /nba and /nhl magazine-style index pages. Server
 * component — fetches all data in parallel.
 */
export async function SportHubBody({ sport }: { sport: SportDef }) {
  const [todayData, tomorrowData, summary] = await Promise.all([
    getMultisportHubData({ sport: sport.sport, dayName: 'today' }),
    getMultisportHubData({ sport: sport.sport, dayName: 'tomorrow' }),
    getMultisportSportSummary(sport.sport),
  ])

  const leadPick = todayData.topPicks[0] ?? tomorrowData.topPicks[0] ?? null
  const totalFixturesInWindow = todayData.totalFixtures + tomorrowData.totalFixtures

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <NewsArticleSchema
        headline={`${sport.displayName} Predictions & AI Analysis`}
        description={sport.description}
        datePublished={new Date().toISOString()}
        dateModified={new Date().toISOString()}
        author="SnapBet AI Team"
        publisher="SnapBet AI"
        articleSection="Predictions"
        articleBody={`${totalFixturesInWindow} fixtures in today/tomorrow window. ${summary.totalFinishedLast90d} finished matches analysed in last 90d.`}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <AdvancedBreadcrumb context={{ title: sport.displayName }} />
      </div>

      <article className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
        <header className="border-b border-slate-700/60 pb-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-none">
                <span className="mr-2">{sport.flagEmoji}</span>
                {sport.displayName}
              </h1>
              <p className="text-xs text-slate-400 uppercase tracking-widest mt-2">
                Predictions · Analysis · Live tracker
              </p>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <p className="text-slate-300 mt-4 max-w-3xl leading-relaxed">{sport.description}</p>
        </header>

        {/* ── HERO BAND ─────────────────────────────────────────── */}
        <section className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            {leadPick ? (
              <Card className="bg-gradient-to-br from-blue-950/40 via-slate-900 to-slate-900 border-blue-500/30 h-full">
                <CardContent className="p-6 sm:p-8">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-blue-300 font-semibold mb-3">
                    <Flame className="w-3.5 h-3.5" />
                    Lead pick · {sport.displayName}
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                    {leadPick.homeTeam} <span className="text-slate-500">vs</span> {leadPick.awayTeam}
                  </p>
                  <p className="text-sm text-slate-400 mt-2">
                    {leadPick.league} · {fmtKickoffShort(leadPick.commenceTime)}
                  </p>
                  <div className="flex items-end justify-between gap-4 mt-4 pt-4 border-t border-slate-700/60">
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide">Model call</p>
                      <p className="text-lg font-semibold text-white mt-0.5">
                        {pickLabel(leadPick.pick, leadPick.homeTeam, leadPick.awayTeam)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400 uppercase tracking-wide">Confidence</p>
                      <p className="text-3xl font-bold text-blue-300">
                        {(leadPick.confidence * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-slate-800 border-slate-700 h-full">
                <CardContent className="p-8 text-center">
                  <Calendar className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  <p className="text-sm text-slate-300">
                    No {sport.displayName} fixtures in our data window today or tomorrow.
                    {' '}<Link href="/soccer" className="text-blue-300 hover:text-blue-200 underline">Try soccer →</Link>
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          <Card className="bg-slate-800 border-slate-700 h-full">
            <CardContent className="p-6 flex flex-col h-full">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-blue-300 font-semibold mb-3">
                <BarChart3 className="w-3.5 h-3.5" />
                Model · 90d
              </div>
              <p className="text-4xl sm:text-5xl font-bold text-white leading-none">
                {fmtPct(summary.modelAccuracy?.accuracy ?? null)}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {summary.modelAccuracy
                  ? `n = ${summary.modelAccuracy.sampleN} matches`
                  : 'Insufficient sample'}
              </p>
              <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                V3 Sharp Intelligence pick vs actual outcome across the last
                90 days of {sport.displayName} games.
              </p>
              <div className="mt-auto pt-4 text-sm text-blue-300 hover:text-blue-200">
                <Link href="/methodology" className="underline underline-offset-2">
                  Methodology →
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>

        {todayData.topPicks.length > 1 && (
          <section>
            <SectionHeading
              icon={Trophy}
              label={`Top picks · ${todayData.dayLabel}`}
              href={`/${sport.slug}/today`}
              hrefLabel="All today's →"
            />
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
              {todayData.topPicks.slice(1, 5).map(fx => (
                <PickCard key={fx.eventId} fx={fx} />
              ))}
            </div>
          </section>
        )}

        {tomorrowData.topPicks.length > 0 && (
          <section>
            <SectionHeading
              icon={Calendar}
              label={`Tomorrow · ${tomorrowData.dayLabel}`}
              href={`/${sport.slug}/tomorrow`}
              hrefLabel="All tomorrow's →"
            />
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
              {tomorrowData.topPicks.slice(0, 4).map(fx => (
                <PickCard key={fx.eventId} fx={fx} />
              ))}
            </div>
          </section>
        )}

        <section className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <SectionHeading icon={Clock} label="Recent results" />
            {summary.recentResults.length === 0 ? (
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-6 text-sm text-slate-400">No recent settled matches.</CardContent>
              </Card>
            ) : (
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-700/60">
                    {summary.recentResults.map(r => (
                      <div key={r.eventId} className="flex flex-wrap items-center justify-between gap-3 p-4">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="text-[10px] text-slate-500 w-12 flex-shrink-0">{fmtDateShort(r.commenceTime)}</span>
                          <p className="text-sm text-white truncate">
                            {r.homeTeam} <span className="text-slate-500">vs</span> {r.awayTeam}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {r.outcome && (
                            <span className="text-[10px] text-slate-400">
                              {r.outcome === 'home' ? r.homeTeam : r.awayTeam} won
                            </span>
                          )}
                          {r.modelPick && (
                            <Badge className={r.modelHit
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]'
                              : 'bg-red-500/20 text-red-300 border-red-500/40 text-[10px]'
                            }>
                              V3 {r.modelHit ? '✓' : '✗'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div>
            <SectionHeading icon={Users} label={`Top ${sport.displayName} teams`} />
            {summary.topTeams.length === 0 ? (
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-5 text-sm text-slate-400">No team pages yet.</CardContent>
              </Card>
            ) : (
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-700/60">
                    {summary.topTeams.map(t => (
                      <Link key={t.slug} href={`/team/${t.slug}/predictions`} className="flex items-center gap-3 p-3 hover:bg-slate-700/30 group">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-white group-hover:text-blue-300 truncate">{t.name}</p>
                          <p className="text-[10px] text-slate-400 flex items-center flex-wrap gap-x-1">
                            <span className="text-emerald-300">{t.wins}W</span>
                            <span className="text-slate-500">·</span>
                            <span className="text-red-300">{t.losses}L</span>
                            {t.formLast10 && (
                              <span className="ml-1 inline-flex gap-0.5">
                                {t.formLast10.slice(0, 5).split('').map((ch, i) => <FormPip key={i} ch={ch} />)}
                              </span>
                            )}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        <Card className="bg-slate-900/60 border-slate-700">
          <CardContent className="p-5 text-xs text-slate-400 leading-relaxed flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
            <span>
              AI-generated predictions for informational use only.{' '}
              <Link href="/methodology" className="text-blue-300 hover:text-blue-200 underline">Methodology</Link>
              {' · '}
              <Link href="/performance" className="text-blue-300 hover:text-blue-200 underline">Performance audit</Link>
              {' · '}
              <Link href="/responsible-betting" className="text-blue-300 hover:text-blue-200 underline">Bet responsibly</Link>
            </span>
          </CardContent>
        </Card>
      </article>
    </div>
  )
}

// ─── Subcomponents ────────────────────────────────────────────────────

function SectionHeading({
  icon: Icon, label, href, hrefLabel,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  href?: string
  hrefLabel?: string
}) {
  return (
    <div className="flex items-end justify-between mb-3 border-b border-slate-700/60 pb-2">
      <h2 className="text-lg font-semibold text-white flex items-center gap-2">
        <Icon className="w-5 h-5 text-blue-300" />
        {label}
      </h2>
      {href && (
        <Link href={href} className="text-xs text-blue-300 hover:text-blue-200 underline underline-offset-2">
          {hrefLabel}
        </Link>
      )}
    </div>
  )
}

function PickCard({ fx }: { fx: MultisportHubFixture }) {
  return (
    <Card className="bg-slate-800 border-slate-700 h-full">
      <CardContent className="p-4">
        <p className="text-[10px] text-slate-400 uppercase tracking-wide">{fx.league}</p>
        <p className="text-sm font-semibold text-white mt-2 leading-snug">
          {fx.homeTeam} <span className="text-slate-500">vs</span> {fx.awayTeam}
        </p>
        <p className="text-[10px] text-slate-500 mt-1.5">{fmtKickoffShort(fx.commenceTime)}</p>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/60">
          <span className="text-xs text-slate-300">
            {fx.pick === 'home' ? 'Home' : fx.pick === 'away' ? 'Away' : '—'}
          </span>
          <span className="text-xs font-bold text-blue-300">{(fx.confidence * 100).toFixed(0)}%</span>
        </div>
      </CardContent>
    </Card>
  )
}
