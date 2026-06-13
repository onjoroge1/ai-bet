import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AdvancedBreadcrumb } from '@/components/advanced-breadcrumb'
import { NewsArticleSchema, FAQSchema } from '@/components/schema-markup'
import { Card, CardContent } from '@/components/ui/card'
import { Calendar, Users, Flag, ChevronRight, AlertCircle } from 'lucide-react'
import { ALL_TEAMS, getTeamBySlug, getGroup, WC_METADATA } from '@/lib/world-cup/tournament'
import { wcFixtures, fixturesForTeam } from '@/lib/world-cup/data'
import { teamPageFAQ } from '@/lib/world-cup/faq'
import { WCFixtureRow } from '@/components/world-cup/WCFixtureRow'

export const dynamic = 'force-dynamic'
export const revalidate = 300

interface PageProps {
  params: Promise<{ country: string }>
}

export function generateStaticParams() {
  return ALL_TEAMS.map(t => ({ country: t.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { country } = await params
  const team = getTeamBySlug(country)
  if (!team) return { title: 'Team not found' }
  return {
    title: `${team.name} World Cup 2026 Predictions & Fixtures | SnapBet AI`,
    description: `${team.name} at the 2026 World Cup — Group ${team.group}, fixtures, and AI match predictions. ${team.confederation} qualifier.`,
    alternates: { canonical: `/world-cup/team/${team.slug}` },
    openGraph: {
      title: `${team.name} — World Cup 2026 Predictions`,
      description: `${team.name} fixtures and AI predictions for the 2026 World Cup. Group ${team.group}.`,
      url: `/world-cup/team/${team.slug}`,
      type: 'website',
    },
  }
}

export default async function WCTeamPage({ params }: PageProps) {
  const { country } = await params
  const team = getTeamBySlug(country)
  if (!team) notFound()

  const group = getGroup(team.group)
  const groupMates = group ? group.teams.filter(t => t.slug !== team.slug) : []

  const allFixtures = await wcFixtures()
  const teamFixtures = fixturesForTeam(allFixtures, team)
  const faqs = teamPageFAQ(team.name, team.group)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <NewsArticleSchema
        headline={`${team.name} World Cup 2026 Predictions`}
        description={`${team.name} fixtures and AI predictions for the 2026 World Cup — Group ${team.group}.`}
        datePublished={new Date().toISOString()}
        dateModified={new Date().toISOString()}
        author="SnapBet AI Team"
        publisher="SnapBet AI"
        articleSection="Predictions"
        articleBody={`${team.name} (${team.confederation}) competes in Group ${team.group} at the ${WC_METADATA.edition}.`}
      />
      <FAQSchema faqs={faqs} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <AdvancedBreadcrumb customItems={[
          { name: 'Home', href: '/' },
          { name: 'World Cup 2026', href: '/world-cup' },
          { name: `Group ${team.group}`, href: `/world-cup/group/${team.group.toLowerCase()}` },
          { name: team.name, href: `/world-cup/team/${team.slug}`, current: true },
        ]} />
      </div>

      <article className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">

        {/* ── Hero ─────────────────────────────────────────────────── */}
        <header>
          <div className="flex items-center gap-3">
            <span className="text-4xl leading-none">{team.flagEmoji}</span>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white">{team.name}</h1>
              <p className="text-slate-400 text-sm mt-1">{team.confederation} · Group {team.group}</p>
            </div>
          </div>
          <p className="text-slate-300 mt-4 max-w-3xl leading-relaxed">
            {team.name}&apos;s 2026 World Cup campaign begins in Group {team.group}. As fixtures are confirmed
            and enter our data window, AI predictions with model confidence and consensus odds appear below.
          </p>
          <div className="flex flex-wrap gap-3 mt-4 text-sm">
            <Link href={`/world-cup/group/${team.group.toLowerCase()}`} className="text-blue-300 hover:text-blue-200 underline underline-offset-2">
              ← Group {team.group}
            </Link>
            <span className="text-slate-600">·</span>
            <Link href="/world-cup" className="text-blue-300 hover:text-blue-200 underline underline-offset-2">
              World Cup hub →
            </Link>
          </div>
        </header>

        {/* ── Group context ────────────────────────────────────────── */}
        {groupMates.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-3">
              <Users className="w-5 h-5 text-purple-300" />
              Group {team.group} opponents
            </h2>
            <div className="grid sm:grid-cols-3 gap-3">
              {groupMates.map(opp => (
                <Link
                  key={opp.slug}
                  href={`/world-cup/team/${opp.slug}`}
                  className="flex items-center gap-2 p-3 rounded-lg border border-slate-700 bg-slate-900/40 hover:border-blue-500/40 transition-colors group"
                >
                  <span className="text-xl leading-none">{opp.flagEmoji}</span>
                  <span className="text-sm text-white group-hover:text-blue-300 truncate">{opp.name}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Fixtures ─────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-3">
            <Calendar className="w-5 h-5 text-emerald-300" />
            {team.name} fixtures
          </h2>
          {teamFixtures.length === 0 ? (
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-8 text-center">
                <Calendar className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <p className="text-slate-300 text-sm">
                  {team.name}&apos;s fixtures will appear here once they enter our data window.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-5 space-y-1">
                {teamFixtures.map(f => <WCFixtureRow key={f.matchId} fixture={f} />)}
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
