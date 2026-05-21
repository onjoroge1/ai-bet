import type { Metadata } from 'next'
import Link from 'next/link'
import prisma from '@/lib/db'
import { AdvancedBreadcrumb } from '@/components/advanced-breadcrumb'
import { Card, CardContent } from '@/components/ui/card'
import { Users, ChevronRight } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 300

export const metadata: Metadata = {
  title: 'All Team Pages | SnapBet AI',
  description:
    'Browse every team with a live AI predictions page — form, model accuracy, head-to-head, upcoming fixtures.',
  alternates: { canonical: '/team' },
  openGraph: {
    title: 'All Team Pages — SnapBet AI',
    description:
      'AI-driven analysis for every team in our data window. Predictions, form, head-to-head, model accuracy.',
    url: '/team',
    type: 'website',
  },
}

export default async function TeamIndexPage() {
  const teams = await prisma.teamStats.findMany({
    where: { isActive: true },
    select: {
      slug: true,
      name: true,
      logoUrl: true,
      league: true,
      matchesPlayed: true,
      hasUpcoming: true,
    },
    orderBy: [{ hasUpcoming: 'desc' }, { matchesPlayed: 'desc' }],
  })

  // Group by league for visual scanning
  const byLeague = new Map<string, typeof teams>()
  for (const t of teams) {
    const key = t.league ?? 'Other'
    const list = byLeague.get(key) ?? []
    list.push(t)
    byLeague.set(key, list)
  }
  const sortedLeagues = [...byLeague.entries()].sort((a, b) => b[1].length - a[1].length)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <AdvancedBreadcrumb />
      </div>

      <article className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
        <header>
          <h1 className="text-3xl sm:text-4xl font-bold text-white flex items-center gap-3">
            <Users className="w-8 h-8 text-purple-300" />
            All Team Pages
          </h1>
          <p className="text-slate-300 mt-3 max-w-3xl leading-relaxed">
            {teams.length} teams with a live AI predictions page. Form, model accuracy, head-to-head,
            and upcoming fixtures for each.
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Teams with fixtures in the next 30 days appear first within each league.
          </p>
        </header>

        {sortedLeagues.map(([league, leagueTeams]) => (
          <section key={league}>
            <h2 className="text-lg font-semibold text-white mb-3 border-b border-slate-700/60 pb-2">
              {league} <span className="text-sm font-normal text-slate-500 ml-2">({leagueTeams.length})</span>
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {leagueTeams.map(team => (
                <Link
                  key={team.slug}
                  href={`/team/${team.slug}/predictions`}
                  className="flex items-center gap-3 p-3 rounded-lg border border-slate-700 bg-slate-800/40 hover:border-blue-500/40 hover:bg-slate-800 transition-colors group"
                >
                  {team.logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={team.logoUrl} alt="" className="w-7 h-7 rounded bg-slate-900 p-0.5 flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white group-hover:text-blue-300 truncate">
                      {team.name}
                    </p>
                    <p className="text-[10px] text-slate-500">{team.matchesPlayed} matches tracked</p>
                  </div>
                  {team.hasUpcoming && (
                    <span className="text-[9px] uppercase tracking-wider text-emerald-400 font-semibold flex-shrink-0">
                      Upcoming
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
                </Link>
              ))}
            </div>
          </section>
        ))}

        <Card className="bg-slate-900/60 border-slate-700">
          <CardContent className="p-5 text-xs text-slate-400 leading-relaxed">
            Don&apos;t see your team? Pages are auto-generated for teams with at least 10 historical matches
            and recent or upcoming activity in our data window. Coverage expands as more matches land.
            See{' '}
            <Link href="/soccer" className="text-blue-300 hover:text-blue-200 underline">/soccer</Link>
            {' '}for league-level overviews.
          </CardContent>
        </Card>
      </article>
    </div>
  )
}
