import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AdvancedBreadcrumb } from '@/components/advanced-breadcrumb'
import { NewsArticleSchema, FAQSchema } from '@/components/schema-markup'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  BarChart3,
  Trophy,
  Calendar,
  Users,
  AlertCircle,
} from 'lucide-react'
import { getHubData } from '@/lib/soccer-hubs/data'
import { leagueHubFAQ } from '@/lib/soccer-hubs/faq'
import { LEAGUES, getLeagueBySlug, getLeagueData } from '@/lib/soccer-hubs/leagues'
import { FixturesByLeague } from '@/components/soccer-hub/FixturesByLeague'

export const dynamic = 'force-dynamic'
export const revalidate = 300

interface PageProps {
  params: Promise<{ league: string }>
}

export async function generateStaticParams() {
  return LEAGUES.map(l => ({ league: l.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { league: slug } = await params
  const league = getLeagueBySlug(slug)
  if (!league) return { title: 'League not found' }
  return {
    title: `${league.displayName} Predictions, Form & AI Analysis | SnapBet AI`,
    description: league.description,
    alternates: { canonical: `/soccer/${league.slug}` },
    openGraph: {
      title: `${league.displayName} AI Predictions`,
      description: league.description,
      url: `/soccer/${league.slug}`,
      type: 'website',
    },
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────

function fmtPct(p: number | null): string {
  if (p === null) return '—'
  return `${(p * 100).toFixed(1)}%`
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function pickLabel(pick: 'home' | 'away' | 'draw' | null): string {
  if (pick === 'home') return 'Home'
  if (pick === 'away') return 'Away'
  if (pick === 'draw') return 'Draw'
  return '—'
}

function FormPip({ ch }: { ch: string }) {
  const cls = ch === 'W'
    ? 'bg-emerald-500/30 text-emerald-200 border-emerald-500/40'
    : ch === 'L'
      ? 'bg-red-500/30 text-red-200 border-red-500/40'
      : 'bg-slate-600/30 text-slate-300 border-slate-500/40'
  return <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold border ${cls}`}>{ch}</span>
}

// ─── Page ─────────────────────────────────────────────────────────────

export default async function LeagueHubPage({ params }: PageProps) {
  const { league: slug } = await params
  const league = getLeagueBySlug(slug)
  if (!league) notFound()

  const [todayData, tomorrowData, leagueData] = await Promise.all([
    getHubData({ dayName: 'today', league: league.displayName }),
    getHubData({ dayName: 'tomorrow', league: league.displayName }),
    getLeagueData(league),
  ])
  const faqs = leagueHubFAQ(league.displayName)

  const totalFixturesInWindow = todayData.totalFixtures + tomorrowData.totalFixtures

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <NewsArticleSchema
        headline={`${league.displayName} Predictions & AI Analysis`}
        description={league.description}
        datePublished={new Date().toISOString()}
        dateModified={new Date().toISOString()}
        author="SnapBet AI Team"
        publisher="SnapBet AI"
        articleSection="Predictions"
        articleBody={`${totalFixturesInWindow} fixtures in today/tomorrow window. ${leagueData.totalFinishedLast90d} finished matches analysed in last 90d.`}
      />
      <FAQSchema faqs={faqs} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <AdvancedBreadcrumb context={{ title: league.displayName }} />
      </div>

      <article className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">

        {/* ── Hero ─────────────────────────────────────────────────── */}
        <header>
          <h1 className="text-3xl sm:text-4xl font-bold text-white">
            {league.flagEmoji && <span className="mr-2">{league.flagEmoji}</span>}
            {league.displayName} Predictions
          </h1>
          <p className="text-slate-300 mt-3 max-w-3xl leading-relaxed">{league.description}</p>
          <div className="flex flex-wrap gap-3 mt-4 text-sm text-slate-400">
            <Link href="/soccer/today" className="text-blue-300 hover:text-blue-200 underline underline-offset-2">
              All today&apos;s picks →
            </Link>
            <span className="text-slate-600">·</span>
            <Link href="/performance" className="text-blue-300 hover:text-blue-200 underline underline-offset-2">
              Live tracker →
            </Link>
            <span className="text-slate-600">·</span>
            <Link href="/methodology" className="text-blue-300 hover:text-blue-200 underline underline-offset-2">
              Methodology →
            </Link>
          </div>
        </header>

        {/* ── League model accuracy ─────────────────────────────────── */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-blue-300" />
              Model accuracy on {league.displayName} (last 90 days)
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <ModelTile
                label="V1 consensus"
                accuracy={leagueData.accuracy.v1?.accuracy ?? null}
                sampleN={leagueData.accuracy.v1?.sampleN ?? null}
                recommended={leagueData.accuracy.recommended === 'v1'}
              />
              <ModelTile
                label="V3 Sharp Intelligence"
                accuracy={leagueData.accuracy.v3?.accuracy ?? null}
                sampleN={leagueData.accuracy.v3?.sampleN ?? null}
                recommended={leagueData.accuracy.recommended === 'v3'}
              />
            </div>
            <p className="text-xs text-slate-500 mt-4">
              Aggregated across {leagueData.totalFinishedLast90d} finished {league.displayName} matches. Recommended badge requires ≥10 sample and ≥5 percentage-point lead.
              {' '}<Link href="/methodology" className="text-blue-300 hover:text-blue-200 underline">How models are scored →</Link>
            </p>
          </CardContent>
        </Card>

        {/* ── Top teams in league ───────────────────────────────────── */}
        {leagueData.topTeams.length > 0 && (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-purple-300" />
                Top {league.displayName} teams
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {leagueData.topTeams.map(team => (
                  <Link
                    key={team.slug}
                    href={`/team/${team.slug}/predictions`}
                    className="block p-4 rounded-lg border border-slate-700 bg-slate-900/40 hover:border-blue-500/40 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      {team.logoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={team.logoUrl} alt="" className="w-8 h-8 rounded bg-slate-800 p-0.5 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white group-hover:text-blue-300 truncate">{team.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          <span className="text-emerald-300">{team.wins}W</span>
                          <span className="text-slate-500"> · </span>
                          <span className="text-slate-300">{team.draws}D</span>
                          <span className="text-slate-500"> · </span>
                          <span className="text-red-300">{team.losses}L</span>
                        </p>
                      </div>
                    </div>
                    {team.formLast10 && (
                      <div className="flex gap-1 mt-3">
                        {team.formLast10.slice(0, 10).split('').map((ch, i) => <FormPip key={i} ch={ch} />)}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Today + tomorrow fixtures (league-scoped) ────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-3">
            <Calendar className="w-5 h-5 text-emerald-300" />
            Fixtures — today &amp; tomorrow
          </h2>
          {totalFixturesInWindow === 0 ? (
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-8 text-center">
                <Calendar className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <p className="text-slate-300 text-sm">No {league.displayName} fixtures in our data window for today or tomorrow.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {todayData.totalFixtures > 0 && (
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Today · {todayData.dayLabel}</p>
                  <FixturesByLeague byLeague={todayData.byLeague} hideLeagueHeaders />
                </div>
              )}
              {tomorrowData.totalFixtures > 0 && (
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Tomorrow · {tomorrowData.dayLabel}</p>
                  <FixturesByLeague byLeague={tomorrowData.byLeague} hideLeagueHeaders />
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Recent results ───────────────────────────────────────── */}
        {leagueData.recentResults.length > 0 && (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5 text-amber-300" />
                Recent {league.displayName} results
              </h2>
              <div className="space-y-2">
                {leagueData.recentResults.map(r => (
                  <div key={r.matchId} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-slate-700/50 bg-slate-900/40">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-[10px] text-slate-500 w-12 flex-shrink-0">{fmtDate(r.kickoffDate)}</span>
                      <span className="text-sm text-white truncate">
                        {r.homeTeam} <span className="text-slate-300 font-mono">{r.homeScore ?? '—'}–{r.awayScore ?? '—'}</span> {r.awayTeam}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px]">
                      {r.v1Pick && (
                        <Badge className={r.v1Hit ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-red-500/20 text-red-300 border-red-500/40'}>
                          V1: {pickLabel(r.v1Pick)} {r.v1Hit ? '✓' : '✗'}
                        </Badge>
                      )}
                      {r.v3Pick && (
                        <Badge className={r.v3Hit ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-red-500/20 text-red-300 border-red-500/40'}>
                          V3: {pickLabel(r.v3Pick)} {r.v3Hit ? '✓' : '✗'}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
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

        {/* ── Footer disclaimer ───────────────────────────────────── */}
        <Card className="bg-slate-900/60 border-slate-700">
          <CardContent className="p-5">
            <p className="text-xs text-slate-400 leading-relaxed flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
              <span>
                Predictions are AI-generated and provided for informational purposes only.
                {' '}<Link href="/methodology" className="text-blue-300 hover:text-blue-200 underline">Methodology</Link>
                {' · '}
                <Link href="/performance" className="text-blue-300 hover:text-blue-200 underline">Performance audit</Link>
                {' · '}
                <Link href="/responsible-betting" className="text-blue-300 hover:text-blue-200 underline">Bet responsibly</Link>
              </span>
            </p>
          </CardContent>
        </Card>
      </article>
    </div>
  )
}

// ─── Subcomponents ────────────────────────────────────────────────────

function ModelTile({
  label, accuracy, sampleN, recommended,
}: {
  label: string
  accuracy: number | null
  sampleN: number | null
  recommended: boolean
}) {
  return (
    <div className={`rounded-lg border p-4 ${recommended ? 'border-amber-500/50 bg-amber-950/20' : 'border-slate-700 bg-slate-900/40'}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-300 font-semibold">{label}</p>
        {recommended && (
          <Badge className="bg-amber-500/20 text-amber-200 border-amber-500/40 text-[10px] uppercase">
            <Trophy className="w-3 h-3 mr-1" /> Recommended
          </Badge>
        )}
      </div>
      <p className={`text-3xl font-bold mt-2 ${accuracy === null ? 'text-slate-500' : 'text-white'}`}>
        {fmtPct(accuracy)}
      </p>
      <p className="text-xs text-slate-400 mt-1">
        {sampleN !== null ? `n = ${sampleN}` : 'Insufficient sample'}
      </p>
    </div>
  )
}
