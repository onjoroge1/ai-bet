import type { Metadata } from 'next'
import Link from 'next/link'
import { AdvancedBreadcrumb } from '@/components/advanced-breadcrumb'
import { NewsArticleSchema, FAQSchema } from '@/components/schema-markup'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Trophy,
  Calendar,
  Flag,
  BarChart3,
  ChevronRight,
  Sparkles,
  AlertCircle,
} from 'lucide-react'
import {
  wcFixtures,
  buildGroupViews,
  leadPick,
  fixtureCounts,
} from '@/lib/world-cup/data'
import { WC_METADATA } from '@/lib/world-cup/tournament'
import { worldCupHubFAQ } from '@/lib/world-cup/faq'
import { WCFixtureRow } from '@/components/world-cup/WCFixtureRow'

export const dynamic = 'force-dynamic'
export const revalidate = 300

export const metadata: Metadata = {
  title: 'World Cup 2026 Predictions, Groups & AI Analysis | SnapBet AI',
  description:
    'AI predictions for the 2026 FIFA World Cup — all 12 groups, 48 teams, fixtures, model accuracy and a live audited tracker. Free group and team pages.',
  alternates: { canonical: '/world-cup' },
  openGraph: {
    title: 'World Cup 2026 Predictions & AI Analysis',
    description:
      'All 12 groups, 48 teams, AI match predictions and a live performance tracker for the 2026 FIFA World Cup.',
    url: '/world-cup',
    type: 'website',
  },
}

function fmtKickoff(d: Date): string {
  return d.toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function pickLabel(pick: 'home' | 'away' | 'draw' | null, home: string, away: string): string {
  if (pick === 'home') return `${home} to win`
  if (pick === 'away') return `${away} to win`
  if (pick === 'draw') return 'Draw'
  return 'No pick yet'
}

export default async function WorldCupHubPage() {
  const now = new Date()
  const fixtures = await wcFixtures()
  const groupViews = buildGroupViews(fixtures)
  const lead = leadPick(fixtures, now)
  const counts = fixtureCounts(fixtures)
  const faqs = worldCupHubFAQ()
  const hasFixtures = counts.total > 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <NewsArticleSchema
        headline={`${WC_METADATA.edition} Predictions & AI Analysis`}
        description="AI predictions, group breakdowns and a live tracker for the 2026 FIFA World Cup."
        datePublished={new Date().toISOString()}
        dateModified={new Date().toISOString()}
        author="SnapBet AI Team"
        publisher="SnapBet AI"
        articleSection="Predictions"
        articleBody={`${WC_METADATA.totalTeams} teams across ${WC_METADATA.totalGroups} groups. ${counts.upcoming} upcoming fixtures currently in our data window.`}
      />
      <FAQSchema faqs={faqs} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <AdvancedBreadcrumb customItems={[
          { name: 'Home', href: '/' },
          { name: 'World Cup 2026', href: '/world-cup', current: true },
        ]} />
      </div>

      <article className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">

        {/* ── Hero ─────────────────────────────────────────────────── */}
        <header>
          <div className="flex items-center gap-2 text-amber-300 text-sm font-semibold uppercase tracking-wider">
            <Trophy className="w-4 h-4" /> {WC_METADATA.edition}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mt-2">
            World Cup 2026 Predictions
          </h1>
          <p className="text-slate-300 mt-3 max-w-3xl leading-relaxed">
            AI-driven predictions for every group and nation at the first 48-team World Cup,
            hosted across {WC_METADATA.host}. {WC_METADATA.totalTeams} teams, {WC_METADATA.totalGroups} groups,
            one live audited tracker. Group fixtures populate automatically as the tournament approaches.
          </p>
          <div className="flex flex-wrap gap-3 mt-4 text-sm">
            <Link href="/performance" className="text-blue-300 hover:text-blue-200 underline underline-offset-2">
              Live tracker →
            </Link>
            <span className="text-slate-600">·</span>
            <Link href="/soccer/today" className="text-blue-300 hover:text-blue-200 underline underline-offset-2">
              Today&apos;s picks →
            </Link>
            <span className="text-slate-600">·</span>
            <Link href="/methodology" className="text-blue-300 hover:text-blue-200 underline underline-offset-2">
              Methodology →
            </Link>
          </div>
        </header>

        {/* ── Tournament tracker / status ──────────────────────────── */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Stat label="Teams" value={String(WC_METADATA.totalTeams)} icon={<Flag className="w-4 h-4 text-blue-300" />} />
              <Stat label="Groups" value={String(WC_METADATA.totalGroups)} icon={<Trophy className="w-4 h-4 text-amber-300" />} />
              <Stat label="Opens" value="11 Jun" icon={<Calendar className="w-4 h-4 text-emerald-300" />} />
              <Stat label="Final" value="19 Jul" icon={<Calendar className="w-4 h-4 text-purple-300" />} />
            </div>
          </CardContent>
        </Card>

        {/* ── Lead pick (only when we have one) ────────────────────── */}
        {lead && (
          <Card className="bg-gradient-to-br from-amber-950/40 to-slate-800 border-amber-500/40">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-amber-200 text-xs font-semibold uppercase tracking-wider mb-2">
                <Sparkles className="w-4 h-4" /> Lead pick
              </div>
              <p className="text-xl font-bold text-white">
                {lead.homeTeam} <span className="text-slate-400 font-normal">vs</span> {lead.awayTeam}
              </p>
              <p className="text-sm text-slate-300 mt-1">{fmtKickoff(lead.kickoffDate)}</p>
              <div className="flex items-center gap-2 mt-3">
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
                  {pickLabel(lead.pick, lead.homeTeam, lead.awayTeam)} · {(lead.confidence * 100).toFixed(0)}%
                </Badge>
                <Link href={`/match/${lead.matchSlug}`} className="text-sm text-blue-300 hover:text-blue-200 inline-flex items-center gap-0.5">
                  Full analysis <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Pre-tournament empty state ───────────────────────────── */}
        {!hasFixtures && (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6 flex items-start gap-3">
              <Calendar className="w-5 h-5 text-emerald-300 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-semibold text-sm">Fixtures land as the tournament approaches</p>
                <p className="text-slate-300 text-sm mt-1 leading-relaxed">
                  The groups and teams below are confirmed. As soon as match fixtures enter our data
                  window, AI predictions, confidence scores and consensus odds appear here and on each
                  group and team page. Bookmark this page or follow the{' '}
                  <Link href="/soccer/today" className="text-blue-300 hover:text-blue-200 underline">daily picks</Link>{' '}
                  in the meantime.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Groups grid ──────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-amber-300" />
            Groups
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupViews.map(({ group, fixtures: gf }) => (
              <Link
                key={group.letter}
                href={`/world-cup/group/${group.letter.toLowerCase()}`}
                className="block rounded-lg border border-slate-700 bg-slate-900/40 hover:border-amber-500/40 transition-colors group p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-bold text-white group-hover:text-amber-300">
                    Group {group.letter}
                  </h3>
                  {gf.length > 0 && (
                    <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40 text-[10px]">
                      {gf.length} fixture{gf.length === 1 ? '' : 's'}
                    </Badge>
                  )}
                </div>
                <ul className="space-y-1.5">
                  {group.teams.map(team => (
                    <li key={team.slug} className="flex items-center gap-2 text-sm text-slate-300">
                      <span className="text-base leading-none">{team.flagEmoji}</span>
                      <span className="truncate">{team.name}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 text-xs text-amber-300/80 inline-flex items-center gap-0.5 group-hover:text-amber-300">
                  View group <ChevronRight className="w-3 h-3" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Upcoming fixtures (only when present) ────────────────── */}
        {counts.upcoming > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-3">
              <Calendar className="w-5 h-5 text-emerald-300" />
              Upcoming fixtures
            </h2>
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-5 space-y-1">
                {fixtures
                  .filter(f => f.status === 'UPCOMING' && f.kickoffDate >= now)
                  .slice(0, 20)
                  .map(f => <WCFixtureRow key={f.matchId} fixture={f} />)}
              </CardContent>
            </Card>
          </section>
        )}

        {/* ── Model note ───────────────────────────────────────────── */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6 flex items-start gap-3">
            <BarChart3 className="w-5 h-5 text-blue-300 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-white font-semibold text-sm">A note on tournament predictions</p>
              <p className="text-slate-300 text-sm mt-1 leading-relaxed">
                Our models are trained primarily on club football. National-team dynamics differ, so we
                treat the World Cup group stage as a calibration window and lock every pick into our public
                tracker — wins and losses included — at{' '}
                <Link href="/performance" className="text-blue-300 hover:text-blue-200 underline">/performance</Link>.
                We&apos;d rather be transparent than overclaim.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ── FAQ ──────────────────────────────────────────────────── */}
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

        {/* ── Disclaimer ───────────────────────────────────────────── */}
        <Card className="bg-slate-900/60 border-slate-700">
          <CardContent className="p-5">
            <p className="text-xs text-slate-400 leading-relaxed flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
              <span>
                Predictions are AI-generated and provided for informational purposes only. Group draw shown is
                provisional until confirmed by FIFA.
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

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1.5 text-slate-400 text-xs">{icon}{label}</div>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
    </div>
  )
}
