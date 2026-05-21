import type { Metadata } from 'next'
import Link from 'next/link'
import { AdvancedBreadcrumb } from '@/components/advanced-breadcrumb'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Calendar,
  Trophy,
  BarChart3,
  BookOpen,
  ChevronRight,
  TrendingUp,
  Users,
  Clock,
  Flame,
  Newspaper,
} from 'lucide-react'
import prisma from '@/lib/db'
import { getHubData, type HubFixture } from '@/lib/soccer-hubs/data'
import { LEAGUES } from '@/lib/soccer-hubs/leagues'
import { aggregateStats, type TrackerPickRow } from '@/lib/premium-tracker/stats'
import { outcomeFromFinalResult } from '@/lib/premium-tracker/capture-helpers'
import { SoccerHubImpressionPing } from '@/components/soccer-hub/SoccerHubImpressionPing'

export const dynamic = 'force-dynamic'
export const revalidate = 300

export const metadata: Metadata = {
  title: 'Soccer Predictions, AI Analysis & Live Tracker | SnapBet AI',
  description:
    "Today's lead pick, league-by-league fixtures, model accuracy, recent results, and the live performance tracker — soccer predictions in one place.",
  alternates: { canonical: '/soccer' },
  openGraph: {
    title: 'Soccer Predictions, AI Analysis & Live Tracker',
    description:
      "Today's lead pick, league spotlights, recent results, and audited model performance.",
    url: '/soccer',
    type: 'website',
  },
}

// ─── Formatters ───────────────────────────────────────────────────────

function fmtKickoffShort(d: Date): string {
  return d.toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtDateShort(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtUSD(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '−' : ''
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

function fmtPctSigned(p: number): string {
  const sign = p > 0 ? '+' : p < 0 ? '−' : ''
  return `${sign}${Math.abs(p).toFixed(1)}%`
}

function dollarTone(n: number): string {
  if (n > 0) return 'text-emerald-300'
  if (n < 0) return 'text-red-300'
  return 'text-slate-200'
}

function pickLabel(pick: HubFixture['pick'], home: string, away: string): string {
  if (pick === 'home') return `${home} to win`
  if (pick === 'away') return `${away} to win`
  if (pick === 'draw') return 'Draw'
  return 'No pick'
}

function pickShort(pick: HubFixture['pick']): string {
  if (pick === 'home') return 'Home'
  if (pick === 'away') return 'Away'
  if (pick === 'draw') return 'Draw'
  return '—'
}

// ─── Page ─────────────────────────────────────────────────────────────

export default async function SoccerHubPage() {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400 * 1000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400 * 1000)

  // Run all data fetches in parallel — every block of the page is read-only
  // and independent, so a single Promise.all keeps response time tight.
  const [
    todayData,
    tomorrowData,
    trackerRows,
    recentResults,
    topTeams,
    recentBlogs,
  ] = await Promise.all([
    getHubData({ dayName: 'today' }),
    getHubData({ dayName: 'tomorrow' }),
    prisma.premiumPickHistory.findMany({
      where: { publishedAt: { gte: thirtyDaysAgo } },
      select: {
        oddsAtPublish: true,
        stakeDollars: true,
        netDollars: true,
        netUnits: true,
        result: true,
        tier: true,
        sport: true,
        league: true,
        market: true,
        publishedAt: true,
        kickoffDate: true,
        settledAt: true,
      },
      orderBy: { publishedAt: 'desc' },
      take: 1000,
    }),
    prisma.marketMatch.findMany({
      where: {
        status: 'FINISHED',
        isActive: true,
        finalResult: { not: { equals: null as unknown as object } },
        kickoffDate: { gte: sevenDaysAgo },
      },
      select: {
        matchId: true,
        homeTeam: true, awayTeam: true,
        homeTeamLogo: true, awayTeamLogo: true,
        league: true,
        kickoffDate: true,
        finalResult: true,
        v1Model: true,
        v3Model: true,
      },
      orderBy: { kickoffDate: 'desc' },
      take: 6,
    }),
    prisma.teamStats.findMany({
      where: { isActive: true, hasUpcoming: true },
      orderBy: { matchesPlayed: 'desc' },
      take: 6,
      select: {
        slug: true,
        name: true,
        logoUrl: true,
        league: true,
        wins: true,
        draws: true,
        losses: true,
        formLast10: true,
      },
    }),
    prisma.blogPost.findMany({
      where: {
        isActive: true,
        isPublished: true,
        publishedAt: { gte: thirtyDaysAgo },
      },
      orderBy: { publishedAt: 'desc' },
      take: 4,
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        publishedAt: true,
        viewCount: true,
      },
    }),
  ])

  // ── Lead pick: highest-confidence top pick today (fall back to tomorrow)
  const leadPick: HubFixture | null =
    todayData.topPicks[0] ?? tomorrowData.topPicks[0] ?? null

  // ── Tracker stats — premium tier headline (matches /performance card)
  const trackerInput: TrackerPickRow[] = trackerRows.map(r => ({
    oddsAtPublish: Number(r.oddsAtPublish),
    stakeDollars: Number(r.stakeDollars),
    netDollars: r.netDollars !== null ? Number(r.netDollars) : null,
    netUnits: r.netUnits !== null ? Number(r.netUnits) : null,
    result: r.result as TrackerPickRow['result'],
    tier: r.tier,
    sport: r.sport,
    league: r.league,
    publishedAt: r.publishedAt,
    kickoffDate: r.kickoffDate,
    settledAt: r.settledAt,
    market: r.market,
  }))
  const allStats = aggregateStats(trackerInput)
  const premiumStats = aggregateStats(trackerInput.filter(r => r.tier === 'premium'))
  const headlineStats = premiumStats.settledCount > 0 ? premiumStats : allStats
  const headlineLabel = premiumStats.settledCount > 0 ? 'Premium tier · 30d' : 'All tier · 30d'

  // ── Around the leagues: pick the top fixture per league from todayData/tomorrowData
  const leagueSpotlights = LEAGUES.map(l => {
    const candidates = [
      ...todayData.byLeague.filter(g => g.league === l.displayName).flatMap(g => g.fixtures),
      ...tomorrowData.byLeague.filter(g => g.league === l.displayName).flatMap(g => g.fixtures),
    ]
    candidates.sort((a, b) => b.confidence - a.confidence)
    return { league: l, fixture: candidates[0] ?? null }
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <SoccerHubImpressionPing />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <AdvancedBreadcrumb />
      </div>

      <article className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">

        {/* ── Masthead ──────────────────────────────────────────── */}
        <header className="border-b border-slate-700/60 pb-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-none">Soccer</h1>
              <p className="text-xs text-slate-400 uppercase tracking-widest mt-2">
                Predictions · Analysis · Live tracker
              </p>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </header>

        {/* ── HERO BAND: lead pick + tracker strip ─────────────── */}
        <section className="grid lg:grid-cols-3 gap-4">
          {/* Lead pick — 2 cols on desktop */}
          <div className="lg:col-span-2">
            {leadPick ? (
              <Link href={`/match/${leadPick.matchSlug}`} className="block group">
                <Card className="bg-gradient-to-br from-blue-950/40 via-slate-900 to-slate-900 border-blue-500/30 hover:border-blue-400/60 transition-colors h-full">
                  <CardContent className="p-6 sm:p-8">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-blue-300 font-semibold mb-3">
                      <Flame className="w-3.5 h-3.5" />
                      Lead pick · today
                    </div>
                    <div className="flex items-center gap-4 mb-4">
                      {leadPick.homeTeamLogo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={leadPick.homeTeamLogo} alt="" className="w-14 h-14 rounded bg-slate-800 p-1.5 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-2xl sm:text-3xl font-bold text-white leading-tight group-hover:text-blue-200 transition-colors">
                          {leadPick.homeTeam} <span className="text-slate-500">vs</span> {leadPick.awayTeam}
                        </p>
                        <p className="text-sm text-slate-400 mt-1">
                          {leadPick.leagueFlagEmoji && <span className="mr-1">{leadPick.leagueFlagEmoji}</span>}
                          {leadPick.league} · {fmtKickoffShort(leadPick.kickoffDate)}
                        </p>
                      </div>
                      {leadPick.awayTeamLogo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={leadPick.awayTeamLogo} alt="" className="w-14 h-14 rounded bg-slate-800 p-1.5 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-end justify-between gap-4 pt-3 border-t border-slate-700/60">
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
              </Link>
            ) : (
              <Card className="bg-slate-800 border-slate-700 h-full">
                <CardContent className="p-8 text-center">
                  <Calendar className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">
                    No top picks in the current window. Try{' '}
                    <Link href="/soccer/tomorrow" className="text-blue-300 hover:text-blue-200 underline">tomorrow&apos;s fixtures</Link>.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Live tracker strip */}
          <Link href="/performance" className="block group">
            <Card className="bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-900 border-amber-500/30 hover:border-amber-400/60 transition-colors h-full">
              <CardContent className="p-6 sm:p-8 flex flex-col h-full">
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-amber-300 font-semibold mb-3">
                  <Trophy className="w-3.5 h-3.5" />
                  Live tracker · {headlineLabel}
                </div>
                <p className={`text-4xl sm:text-5xl font-bold leading-none ${dollarTone(headlineStats.netDollars)}`}>
                  {fmtUSD(headlineStats.netDollars)}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  ROI {fmtPctSigned(headlineStats.roiPct)} · {headlineStats.record.wins}W–{headlineStats.record.losses}L
                </p>
                <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                  Flat $100 simulation. Every premium-qualified pick. Wins and losses included.
                </p>
                <div className="mt-auto pt-4 text-sm text-amber-200 group-hover:text-amber-100 flex items-center gap-1">
                  Full audit
                  <ChevronRight className="w-4 h-4" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </section>

        {/* ── Top picks today ───────────────────────────────────── */}
        {todayData.topPicks.length > 1 && (
          <section>
            <SectionHeading icon={TrendingUp} label="Top picks today" href="/soccer/today" hrefLabel="All today's →" />
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
              {todayData.topPicks.slice(1, 5).map(fx => (
                <PickCard key={fx.matchId} fx={fx} />
              ))}
            </div>
          </section>
        )}

        {/* ── Around the leagues ────────────────────────────────── */}
        <section>
          <SectionHeading icon={Newspaper} label="Around the leagues" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {leagueSpotlights.map(({ league, fixture }) => (
              <Card key={league.slug} className="bg-slate-800 border-slate-700 hover:border-blue-500/40 transition-colors h-full">
                <CardContent className="p-5 flex flex-col h-full">
                  <Link href={`/soccer/${league.slug}`} className="block group">
                    <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold flex items-center gap-1.5 group-hover:text-blue-300">
                      {league.flagEmoji && <span>{league.flagEmoji}</span>}
                      {league.displayName}
                      <ChevronRight className="w-3.5 h-3.5 ml-auto" />
                    </p>
                  </Link>
                  <div className="mt-3 flex-1">
                    {fixture ? (
                      <Link href={`/match/${fixture.matchSlug}`} className="block group">
                        <p className="text-sm font-semibold text-white group-hover:text-blue-200 leading-snug">
                          {fixture.homeTeam} <span className="text-slate-500">vs</span> {fixture.awayTeam}
                        </p>
                        <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          {fmtKickoffShort(fixture.kickoffDate)}
                        </p>
                        {fixture.pick && (
                          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-700/60">
                            <span className="text-xs text-slate-300">
                              {pickShort(fixture.pick)}
                            </span>
                            <span className="text-xs text-slate-500">·</span>
                            <span className="text-xs font-semibold text-blue-300">
                              {(fixture.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                        )}
                      </Link>
                    ) : (
                      <p className="text-xs text-slate-500 italic">No fixtures in the next 48h.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* ── Recent results + top teams (two-column) ──────────── */}
        <section className="grid lg:grid-cols-3 gap-4">
          {/* Recent results — 2 cols */}
          <div className="lg:col-span-2">
            <SectionHeading icon={Clock} label="Recent results" />
            {recentResults.length === 0 ? (
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-6 text-sm text-slate-400">No recent settled matches.</CardContent>
              </Card>
            ) : (
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-700/60">
                    {recentResults.map(r => {
                      const outcome = outcomeFromFinalResult(r.finalResult)
                      const score = (r.finalResult as { score?: { home?: number; away?: number } } | null)?.score
                      const v3 = (r.v3Model as { pick?: string } | null)?.pick?.toLowerCase()
                      const v3Hit = outcome && v3 && (v3 === 'home' || v3 === 'away' || v3 === 'draw') ? v3 === outcome : null
                      return (
                        <div key={r.matchId} className="flex flex-wrap items-center justify-between gap-3 p-4">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <span className="text-[10px] text-slate-500 w-12 flex-shrink-0">{fmtDateShort(r.kickoffDate)}</span>
                            <div className="min-w-0">
                              <p className="text-sm text-white truncate">
                                {r.homeTeam} <span className="text-slate-300 font-mono mx-1">{score?.home ?? '—'}–{score?.away ?? '—'}</span> {r.awayTeam}
                              </p>
                              <p className="text-[10px] text-slate-500 mt-0.5">{r.league}</p>
                            </div>
                          </div>
                          {v3 && (
                            <Badge className={v3Hit ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]' : 'bg-red-500/20 text-red-300 border-red-500/40 text-[10px]'}>
                              V3 {v3Hit ? '✓' : '✗'}
                            </Badge>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Top teams */}
          <div>
            <SectionHeading icon={Users} label="Most-tracked teams" href="/performance" hrefLabel="Performance →" />
            {topTeams.length === 0 ? (
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-5 text-sm text-slate-400">No team pages yet.</CardContent>
              </Card>
            ) : (
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-700/60">
                    {topTeams.map(t => (
                      <Link key={t.slug} href={`/team/${t.slug}/predictions`} className="flex items-center gap-3 p-3 hover:bg-slate-700/30 group">
                        {t.logoUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={t.logoUrl} alt="" className="w-7 h-7 rounded bg-slate-900 p-0.5 flex-shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-white group-hover:text-blue-300 truncate">{t.name}</p>
                          <p className="text-[10px] text-slate-400">
                            <span className="text-emerald-300">{t.wins}W</span>
                            <span className="text-slate-500"> · </span>
                            <span className="text-slate-300">{t.draws}D</span>
                            <span className="text-slate-500"> · </span>
                            <span className="text-red-300">{t.losses}L</span>
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

        {/* ── Latest analysis (blog posts) ──────────────────────── */}
        {recentBlogs.length > 0 && (
          <section>
            <SectionHeading icon={Newspaper} label="Latest analysis" href="/blog" hrefLabel="All articles →" />
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
              {recentBlogs.map(b => (
                <Link key={b.id} href={`/blog/${b.slug}`} className="block group">
                  <Card className="bg-slate-800 border-slate-700 hover:border-blue-500/40 transition-colors h-full">
                    <CardContent className="p-4">
                      <p className="text-sm font-semibold text-white group-hover:text-blue-300 leading-snug line-clamp-3">{b.title}</p>
                      {b.excerpt && (
                        <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">{b.excerpt}</p>
                      )}
                      <p className="text-[10px] text-slate-500 mt-2">
                        {b.publishedAt && fmtDateShort(b.publishedAt)} · {b.viewCount.toLocaleString()} views
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Footer: quick links + disclaimer ──────────────────── */}
        <section className="border-t border-slate-700/60 pt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <FooterLink href="/soccer/today" icon={Calendar} label="Today's fixtures" />
          <FooterLink href="/soccer/tomorrow" icon={Calendar} label="Tomorrow's fixtures" />
          <FooterLink href="/performance" icon={BarChart3} label="Live tracker" />
          <FooterLink href="/guides" icon={BookOpen} label="Guides" />
        </section>

        <Card className="bg-slate-900/60 border-slate-700">
          <CardContent className="p-5 text-xs text-slate-400 leading-relaxed">
            AI-generated predictions for informational use only.{' '}
            <Link href="/methodology" className="text-blue-300 hover:text-blue-200 underline">Methodology</Link>
            {' · '}
            <Link href="/responsible-betting" className="text-blue-300 hover:text-blue-200 underline">Bet responsibly</Link>
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

function PickCard({ fx }: { fx: HubFixture }) {
  return (
    <Link href={`/match/${fx.matchSlug}`} className="block group h-full">
      <Card className="bg-slate-800 border-slate-700 hover:border-blue-500/40 transition-colors h-full">
        <CardContent className="p-4">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide flex items-center gap-1">
            {fx.leagueFlagEmoji && <span>{fx.leagueFlagEmoji}</span>}
            {fx.league}
          </p>
          <p className="text-sm font-semibold text-white mt-2 leading-snug group-hover:text-blue-200">
            {fx.homeTeam} <span className="text-slate-500">vs</span> {fx.awayTeam}
          </p>
          <p className="text-[10px] text-slate-500 mt-1.5">{fmtKickoffShort(fx.kickoffDate)}</p>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/60">
            <span className="text-xs text-slate-300">{pickShort(fx.pick)}</span>
            <span className="text-xs font-bold text-blue-300">{(fx.confidence * 100).toFixed(0)}%</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function FooterLink({
  href, icon: Icon, label,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <Link href={href} className="flex items-center gap-2 px-4 py-3 rounded-lg border border-slate-700 bg-slate-800/40 hover:border-blue-500/40 hover:bg-slate-800 transition-colors text-sm text-slate-200 group">
      <Icon className="w-4 h-4 text-slate-400 group-hover:text-blue-300" />
      <span>{label}</span>
      <ChevronRight className="w-4 h-4 text-slate-500 ml-auto" />
    </Link>
  )
}
