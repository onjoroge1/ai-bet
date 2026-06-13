import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AdvancedBreadcrumb } from '@/components/advanced-breadcrumb'
import { NewsArticleSchema, FAQSchema } from '@/components/schema-markup'
import { Card, CardContent } from '@/components/ui/card'
import { Calendar, Flag, ChevronRight, AlertCircle } from 'lucide-react'
import { GROUPS, getGroup, WC_METADATA } from '@/lib/world-cup/tournament'
import { wcFixtures, fixturesForGroup } from '@/lib/world-cup/data'
import { simulateGroup, type GroupSimFixtureInput } from '@/lib/world-cup/metrics'
import { groupPageFAQ } from '@/lib/world-cup/faq'
import { WCFixtureRow } from '@/components/world-cup/WCFixtureRow'
import { WCGroupMetrics } from '@/components/world-cup/WCGroupMetrics'

export const dynamic = 'force-dynamic'
export const revalidate = 300

interface PageProps {
  params: Promise<{ letter: string }>
}

export function generateStaticParams() {
  return GROUPS.map(g => ({ letter: g.letter.toLowerCase() }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { letter } = await params
  const group = getGroup(letter)
  if (!group) return { title: 'Group not found' }
  const names = group.teams.map(t => t.name).join(', ')
  return {
    title: `World Cup 2026 Group ${group.letter}: ${names} — Predictions | SnapBet AI`,
    description: `Group ${group.letter} at the 2026 World Cup: ${names}. AI predictions, fixtures and standings as the tournament unfolds.`,
    alternates: { canonical: `/world-cup/group/${group.letter.toLowerCase()}` },
    openGraph: {
      title: `World Cup 2026 Group ${group.letter} Predictions`,
      description: `${names} — AI predictions and fixtures for World Cup Group ${group.letter}.`,
      url: `/world-cup/group/${group.letter.toLowerCase()}`,
      type: 'website',
    },
  }
}

export default async function GroupPage({ params }: PageProps) {
  const { letter } = await params
  const group = getGroup(letter)
  if (!group) notFound()

  const allFixtures = await wcFixtures()
  const groupFixtures = fixturesForGroup(allFixtures, group.letter)
  const faqs = groupPageFAQ(group.letter, group.teams.map(t => t.name))

  // Group-advancement simulation — only when every fixture resolves to a
  // registry team (it does for real group-stage matches).
  const simInputs: GroupSimFixtureInput[] = groupFixtures
    .filter(f => f.homeWCTeam && f.awayWCTeam)
    .map(f => ({
      homeSlug: f.homeWCTeam!.slug,
      awaySlug: f.awayWCTeam!.slug,
      probs: f.probs,
      result: f.status === 'FINISHED' ? f.result : null,
    }))
  const sim = simInputs.length >= 3 ? simulateGroup(group.teams, simInputs) : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <NewsArticleSchema
        headline={`World Cup 2026 Group ${group.letter} Predictions`}
        description={`AI predictions and fixtures for Group ${group.letter}: ${group.teams.map(t => t.name).join(', ')}.`}
        datePublished={new Date().toISOString()}
        dateModified={new Date().toISOString()}
        author="SnapBet AI Team"
        publisher="SnapBet AI"
        articleSection="Predictions"
        articleBody={`Group ${group.letter} of the ${WC_METADATA.edition}: ${group.teams.map(t => t.name).join(', ')}.`}
      />
      <FAQSchema faqs={faqs} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <AdvancedBreadcrumb customItems={[
          { name: 'Home', href: '/' },
          { name: 'World Cup 2026', href: '/world-cup' },
          { name: `Group ${group.letter}`, href: `/world-cup/group/${group.letter.toLowerCase()}`, current: true },
        ]} />
      </div>

      <article className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">

        {/* ── Hero ─────────────────────────────────────────────────── */}
        <header>
          <h1 className="text-3xl sm:text-4xl font-bold text-white">
            World Cup 2026 — Group {group.letter}
          </h1>
          <p className="text-slate-300 mt-3 max-w-3xl leading-relaxed">
            {group.teams.map(t => t.name).join(', ')}. The top two advance to the knockout round;
            the best eight third-placed teams across all {WC_METADATA.totalGroups} groups also progress.
            Predictions populate as fixtures enter our data window.
          </p>
          <div className="flex flex-wrap gap-3 mt-4 text-sm">
            <Link href="/world-cup" className="text-blue-300 hover:text-blue-200 underline underline-offset-2">
              ← All groups
            </Link>
            <span className="text-slate-600">·</span>
            <Link href="/performance" className="text-blue-300 hover:text-blue-200 underline underline-offset-2">
              Live tracker →
            </Link>
          </div>
        </header>

        {/* ── Teams ────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <Flag className="w-5 h-5 text-blue-300" />
            Teams
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {group.teams.map(team => (
              <Link
                key={team.slug}
                href={`/world-cup/team/${team.slug}`}
                className="flex items-center justify-between gap-3 p-4 rounded-lg border border-slate-700 bg-slate-900/40 hover:border-blue-500/40 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl leading-none">{team.flagEmoji}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white group-hover:text-blue-300 truncate">{team.name}</p>
                    <p className="text-xs text-slate-400">{team.confederation}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-blue-300 flex-shrink-0" />
              </Link>
            ))}
          </div>
        </section>

        {/* ── Advancement metrics ──────────────────────────────────── */}
        {sim && <WCGroupMetrics sim={sim} groupLetter={group.letter} />}

        {/* ── Fixtures ─────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-3">
            <Calendar className="w-5 h-5 text-emerald-300" />
            Group {group.letter} fixtures
          </h2>
          {groupFixtures.length === 0 ? (
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-8 text-center">
                <Calendar className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <p className="text-slate-300 text-sm">
                  Group {group.letter} fixtures will appear here once they enter our data window.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-5 space-y-1">
                {groupFixtures.map(f => <WCFixtureRow key={f.matchId} fixture={f} />)}
              </CardContent>
            </Card>
          )}
        </section>

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
                AI-generated predictions for informational purposes only.
                {' '}<Link href="/methodology" className="text-blue-300 hover:text-blue-200 underline">Methodology</Link>
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
