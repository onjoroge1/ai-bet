import type { Metadata } from 'next'
import Link from 'next/link'
import { AdvancedBreadcrumb } from '@/components/advanced-breadcrumb'
import { Card, CardContent } from '@/components/ui/card'
import { Calendar, Trophy, BarChart3, BookOpen, ChevronRight } from 'lucide-react'
import { LEAGUES } from '@/lib/soccer-hubs/leagues'

export const dynamic = 'force-static'
export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Soccer Predictions & AI Analysis | SnapBet AI',
  description:
    "Today and tomorrow's soccer predictions across the Premier League, La Liga, Serie A, Bundesliga and Champions League, plus model accuracy and live performance tracking.",
  alternates: { canonical: '/soccer' },
  openGraph: {
    title: 'Soccer Predictions & AI Analysis',
    description:
      'AI-driven match predictions, league hubs, and the live performance tracker — all in one place.',
    url: '/soccer',
    type: 'website',
  },
}

export default function SoccerIndexPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <AdvancedBreadcrumb />
      </div>

      <article className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
        {/* ── Hero ───────────────────────────────────────────────── */}
        <header>
          <h1 className="text-3xl sm:text-4xl font-bold text-white">Soccer Predictions</h1>
          <p className="text-slate-300 mt-3 max-w-3xl leading-relaxed">
            Today and tomorrow&apos;s soccer fixtures across the top European leagues, with V1 + V3 AI confidence
            scores and audited model performance. Pick a day or jump straight into a league.
          </p>
        </header>

        {/* ── Daily hubs ─────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-3">
            <Calendar className="w-5 h-5 text-emerald-300" />
            By day
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <HubLink
              href="/soccer/today"
              title="Today's fixtures"
              description="Live AI predictions for matches kicking off today, grouped by league."
            />
            <HubLink
              href="/soccer/tomorrow"
              title="Tomorrow's fixtures"
              description="A look ahead at the next 24-48 hours of matches across our covered leagues."
            />
          </div>
        </section>

        {/* ── League hubs ────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-3">
            <Trophy className="w-5 h-5 text-amber-300" />
            By league
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {LEAGUES.map(l => (
              <HubLink
                key={l.slug}
                href={`/soccer/${l.slug}`}
                title={`${l.flagEmoji ? l.flagEmoji + ' ' : ''}${l.displayName}`}
                description={l.description.split('.')[0] + '.'}
              />
            ))}
          </div>
        </section>

        {/* ── Performance + guides ───────────────────────────────── */}
        <section className="grid sm:grid-cols-2 gap-3">
          <HubLink
            href="/performance"
            title="Live performance tracker"
            description="Every premium-qualified pick, flat $100 stakes, wins and losses included."
            icon={<BarChart3 className="w-4 h-4 text-blue-300" />}
          />
          <HubLink
            href="/guides"
            title="Guides"
            description="How AI predictions work, reading confidence scores, and other fundamentals."
            icon={<BookOpen className="w-4 h-4 text-purple-300" />}
          />
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

function HubLink({
  href, title, description, icon,
}: {
  href: string
  title: string
  description: string
  icon?: React.ReactNode
}) {
  return (
    <Link href={href} className="block group">
      <Card className="bg-slate-800 border-slate-700 hover:border-blue-500/40 transition-colors h-full">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-white group-hover:text-blue-300 flex items-center gap-2">
                {icon}
                {title}
              </h3>
              <p className="text-sm text-slate-300 mt-1.5 leading-relaxed">{description}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-500 flex-shrink-0 mt-1" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
