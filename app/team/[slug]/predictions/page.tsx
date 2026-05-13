import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import prisma from '@/lib/db'
import { AdvancedBreadcrumb } from '@/components/advanced-breadcrumb'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { NewsArticleSchema } from '@/components/schema-markup'
import { PremiumTrackerCard } from '@/components/blog/PremiumTrackerCard'
import {
  Trophy,
  Target,
  Clock,
  Calendar,
  BarChart3,
  Users,
  AlertCircle,
} from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 300  // 5 min ISR

interface PageProps {
  params: Promise<{ slug: string }>
}

interface H2HEntry {
  opponent: string
  externalOpponentId?: string
  matchesPlayed: number
  wins: number
  draws: number
  losses: number
  last5: string
  lastResult: string | null
  lastDate: string | null
}

// ─── Metadata ─────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const team = await prisma.teamStats.findUnique({
    where: { slug },
    select: { name: true, league: true, lastRolledAt: true },
  })
  if (!team) return { title: 'Team not found' }

  const title = `${team.name} Predictions, Form & H2H | SnapBet AI`
  const description = `Live AI predictions, recent form, head-to-head record, goal patterns and model accuracy for ${team.name}${team.league ? ` (${team.league})` : ''}.`
  return {
    title,
    description,
    alternates: { canonical: `/team/${slug}/predictions` },
    openGraph: { title, description, type: 'website' },
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────

function fmtPct(p: number | null): string {
  if (p === null) return '—'
  return `${(p * 100).toFixed(1)}%`
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function fmtKickoff(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function FormPip({ ch }: { ch: string }) {
  const cls = ch === 'W'
    ? 'bg-emerald-500/30 text-emerald-200 border-emerald-500/40'
    : ch === 'L'
      ? 'bg-red-500/30 text-red-200 border-red-500/40'
      : 'bg-slate-600/30 text-slate-300 border-slate-500/40'
  return <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold border ${cls}`}>{ch}</span>
}

// ─── Page ─────────────────────────────────────────────────────────────

export default async function TeamPredictionsPage({ params }: PageProps) {
  const { slug } = await params

  const team = await prisma.teamStats.findUnique({ where: { slug } })
  if (!team || !team.isActive) notFound()

  // Upcoming fixtures (next 3) by team name on either side
  const now = new Date()
  const upcoming = await prisma.marketMatch.findMany({
    where: {
      status: 'UPCOMING',
      kickoffDate: { gte: now },
      OR: [{ homeTeam: team.name }, { awayTeam: team.name }],
      isActive: true,
    },
    select: {
      matchId: true,
      homeTeam: true, awayTeam: true,
      league: true,
      kickoffDate: true,
      v1Model: true, v3Model: true,
      consensusOdds: true,
    },
    orderBy: { kickoffDate: 'asc' },
    take: 3,
  })

  // Recent match-preview blogs referencing this team via marketMatch FK
  const recentBlogs = await prisma.blogPost.findMany({
    where: {
      isActive: true, isPublished: true,
      marketMatch: {
        OR: [{ homeTeam: team.name }, { awayTeam: team.name }],
      },
    },
    select: {
      id: true, title: true, slug: true, viewCount: true, publishedAt: true,
    },
    orderBy: { publishedAt: 'desc' },
    take: 5,
  })

  const h2h = (team.h2hGrid as unknown as H2HEntry[] | null) ?? []

  // Derived display fields
  const v1acc = team.v1ModelAccuracy ? Number(team.v1ModelAccuracy) : null
  const v3acc = team.v3ModelAccuracy ? Number(team.v3ModelAccuracy) : null
  const bttsRate = team.matchesPlayed > 0 ? team.bttsCount / team.matchesPlayed : 0
  const over25Rate = team.matchesPlayed > 0 ? team.over25Count / team.matchesPlayed : 0
  const avgGf = team.matchesPlayed > 0 ? team.goalsFor / team.matchesPlayed : 0
  const avgGa = team.matchesPlayed > 0 ? team.goalsAgainst / team.matchesPlayed : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* NewsArticleSchema — feeds Google News + structured search */}
      <NewsArticleSchema
        title={`${team.name} Predictions, Form & H2H`}
        description={`AI-driven analysis of ${team.name}'s form, model accuracy, and head-to-head record.`}
        url={`/team/${slug}/predictions`}
        imageUrl={team.logoUrl ?? '/og-default.png'}
        datePublished={team.createdAt.toISOString()}
        dateModified={team.lastRolledAt.toISOString()}
        author="SnapBet AI Team"
        articleBody={`Predictions and historical analysis for ${team.name}.`}
        articleSection="Predictions"
        keywords={[team.name, team.league ?? 'football', 'predictions', 'H2H']}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <AdvancedBreadcrumb />
      </div>

      <article className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">

        {/* ── Hero ───────────────────────────────────────────────── */}
        <header className="flex items-start gap-4">
          {team.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={team.logoUrl} alt={`${team.name} logo`} className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-slate-800 p-2 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl sm:text-4xl font-bold text-white">{team.name}</h1>
            <p className="text-slate-300 mt-1">
              {team.league && <span>{team.league}</span>}
              {team.country && team.league && <span className="text-slate-500 mx-2">·</span>}
              {team.country && <span>{team.country}</span>}
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Last updated {fmtDate(team.lastRolledAt)}
            </p>
          </div>
        </header>

        {/* ── Snapshot ──────────────────────────────────────────── */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider">Last {team.matchesPlayed} matches</p>
                <p className="text-3xl font-bold text-white mt-1">
                  <span className="text-emerald-300">{team.wins}W</span>
                  <span className="text-slate-500"> · </span>
                  <span className="text-slate-200">{team.draws}D</span>
                  <span className="text-slate-500"> · </span>
                  <span className="text-red-300">{team.losses}L</span>
                </p>
              </div>
              {team.formLast10 && (
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-2 text-right">Form (recent → older)</p>
                  <div className="flex gap-1">
                    {team.formLast10.split('').map((ch, i) => <FormPip key={i} ch={ch} />)}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Model accuracy card ───────────────────────────────── */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-blue-300" />
              Model accuracy on {team.name}&apos;s matches
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <ModelTile
                label="V1 model"
                accuracy={v1acc}
                sampleN={team.v1ModelSampleN}
                recommended={team.recommendedModel === 'v1'}
              />
              <ModelTile
                label="V3 (Sharp Intelligence)"
                accuracy={v3acc}
                sampleN={team.v3ModelSampleN}
                recommended={team.recommendedModel === 'v3'}
              />
            </div>
            <p className="text-xs text-slate-500 mt-4">
              Recommended badge appears when one model leads by ≥5 percentage points over a minimum of 10 settled matches.
              {' '}<Link href="/methodology#models" className="text-blue-300 hover:text-blue-200 underline">How V1 vs V3 work →</Link>
            </p>
          </CardContent>
        </Card>

        {/* ── Premium Tracker (team-scoped) ─────────────────────── */}
        <PremiumTrackerCard mode="premium" teamName={team.name} />

        {/* ── Goal patterns ─────────────────────────────────────── */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-amber-300" />
              Goal patterns
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Stat label="Avg goals scored" value={avgGf.toFixed(2)} />
              <Stat label="Avg goals conceded" value={avgGa.toFixed(2)} />
              <Stat label="BTTS" value={`${(bttsRate * 100).toFixed(0)}%`} sub={`${team.bttsCount}/${team.matchesPlayed}`} />
              <Stat label="Over 2.5" value={`${(over25Rate * 100).toFixed(0)}%`} sub={`${team.over25Count}/${team.matchesPlayed}`} />
            </div>
            {team.homeGoalsFor !== null && team.awayGoalsFor !== null && (
              <div className="grid sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-700">
                <Stat label="At home (avg scored)" value={Number(team.homeGoalsFor).toFixed(2)} />
                <Stat label="Away (avg scored)" value={Number(team.awayGoalsFor).toFixed(2)} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── H2H grid ──────────────────────────────────────────── */}
        {h2h.length > 0 && (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-purple-300" />
                Head-to-head — top opponents
              </h2>
              <div className="space-y-2">
                {h2h.map(opp => (
                  <div key={opp.opponent} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-slate-700 bg-slate-900/40">
                    <div className="flex items-center gap-3 min-w-0">
                      <p className="text-sm font-semibold text-white">vs {opp.opponent}</p>
                      <span className="text-xs text-slate-500">·</span>
                      <p className="text-xs text-slate-400">{opp.matchesPlayed} meetings</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-xs">
                        <span className="text-emerald-300">{opp.wins}W</span>
                        <span className="text-slate-500"> </span>
                        <span className="text-slate-300">{opp.draws}D</span>
                        <span className="text-slate-500"> </span>
                        <span className="text-red-300">{opp.losses}L</span>
                      </div>
                      {opp.last5 && (
                        <div className="flex gap-1">
                          {opp.last5.split('').map((ch, i) => <FormPip key={i} ch={ch} />)}
                        </div>
                      )}
                      {opp.lastResult && (
                        <span className="text-xs text-slate-400 hidden sm:inline">Last: {opp.lastResult}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Upcoming fixtures ─────────────────────────────────── */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-emerald-300" />
              Upcoming fixtures
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-slate-400">No fixtures scheduled in the data window.</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map(m => {
                  const v3 = m.v3Model as { confidence?: number; pick?: string } | null
                  const v1 = m.v1Model as { confidence?: number; pick?: string } | null
                  const conf = v3?.confidence ?? v1?.confidence
                  return (
                    <div key={m.matchId} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-slate-700 bg-slate-900/40">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">
                          {m.homeTeam} vs {m.awayTeam}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {m.league} · {fmtKickoff(m.kickoffDate)}
                        </p>
                      </div>
                      {conf !== undefined && (
                        <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40 text-xs">
                          {(conf * 100).toFixed(0)}% confidence
                        </Badge>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Recent match-preview blogs ────────────────────────── */}
        {recentBlogs.length > 0 && (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-slate-300" />
                Recent analysis
              </h2>
              <div className="space-y-2">
                {recentBlogs.map(b => (
                  <Link
                    key={b.id}
                    href={`/blog/${b.slug}`}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-700 bg-slate-900/40 hover:border-blue-500/40 transition-colors group"
                  >
                    <p className="text-sm text-white group-hover:text-blue-300 truncate">{b.title}</p>
                    <p className="text-xs text-slate-400 whitespace-nowrap">{b.viewCount.toLocaleString()} views</p>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Disclaimer ────────────────────────────────────────── */}
        <Card className="bg-slate-900/60 border-slate-700">
          <CardContent className="p-5">
            <p className="text-xs text-slate-400 leading-relaxed flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
              <span>
                Stats are rolled up from finished matches in the last 365 days.
                <Link href="/methodology" className="text-blue-300 hover:text-blue-200 underline ml-1">Methodology</Link>
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
        {sampleN !== null ? `n = ${sampleN}` : 'Not enough data'}
      </p>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}
