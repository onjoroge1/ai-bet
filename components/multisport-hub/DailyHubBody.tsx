import Link from 'next/link'
import { AdvancedBreadcrumb } from '@/components/advanced-breadcrumb'
import { NewsArticleSchema } from '@/components/schema-markup'
import { Card, CardContent } from '@/components/ui/card'
import { Calendar, Trophy, AlertCircle } from 'lucide-react'
import {
  getMultisportHubData,
  type SportDef,
  type MultisportHubFixture,
} from '@/lib/multisport-hubs/data'

function fmtKickoff(d: Date): string {
  return d.toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/**
 * Shared body for /nba/today, /nba/tomorrow, /nhl/today, /nhl/tomorrow.
 * Static-friendly, runs in parallel data fetches.
 */
export async function DailyHubBody({
  sport, dayName,
}: {
  sport: SportDef
  dayName: 'today' | 'tomorrow'
}) {
  const data = await getMultisportHubData({ sport: sport.sport, dayName })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <NewsArticleSchema
        headline={`${sport.displayName} ${dayName === 'today' ? "Today's" : "Tomorrow's"} Picks`}
        description={`${data.totalFixtures} ${sport.displayName} fixtures with AI predictions for ${data.dayLabel}.`}
        datePublished={new Date().toISOString()}
        dateModified={new Date().toISOString()}
        author="SnapBet AI Team"
        publisher="SnapBet AI"
        articleSection="Predictions"
        articleBody={`${data.totalFixtures} ${sport.displayName} fixtures with AI predictions for ${data.dayLabel}.`}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <AdvancedBreadcrumb context={{ title: dayName === 'today' ? 'Today' : 'Tomorrow' }} />
      </div>

      <article className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
        <header>
          <h1 className="text-3xl sm:text-4xl font-bold text-white">
            <span className="mr-2">{sport.flagEmoji}</span>
            {sport.displayName} · {dayName === 'today' ? "Today's" : "Tomorrow's"} picks
          </h1>
          <p className="text-slate-300 mt-2">{data.dayLabel}</p>
          <p className="text-xs text-slate-500 mt-1">{data.totalFixtures} fixture{data.totalFixtures === 1 ? '' : 's'}</p>
        </header>

        {data.topPicks.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-3 border-b border-slate-700/60 pb-2">
              <Trophy className="w-5 h-5 text-amber-300" />
              Top picks
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.topPicks.map(fx => (
                <PickCard key={fx.eventId} fx={fx} highlight />
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-3 border-b border-slate-700/60 pb-2">
            <Calendar className="w-5 h-5 text-blue-300" />
            All fixtures
          </h2>
          {data.fixtures.length === 0 ? (
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-8 text-center">
                <Calendar className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <p className="text-sm text-slate-300">
                  No {sport.displayName} fixtures {dayName === 'today' ? 'today' : 'tomorrow'}.
                  {' '}<Link href={`/${sport.slug}`} className="text-blue-300 hover:text-blue-200 underline">Back to {sport.displayName} →</Link>
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-0">
                <div className="divide-y divide-slate-700/60">
                  {data.fixtures.map(fx => (
                    <FixtureRow key={fx.eventId} fx={fx} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        <Card className="bg-slate-900/60 border-slate-700">
          <CardContent className="p-5 text-xs text-slate-400 leading-relaxed flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
            <span>
              AI-generated predictions for informational use only.{' '}
              <Link href="/methodology" className="text-blue-300 hover:text-blue-200 underline">Methodology</Link>
              {' · '}
              <Link href="/performance" className="text-blue-300 hover:text-blue-200 underline">Performance</Link>
              {' · '}
              <Link href="/responsible-betting" className="text-blue-300 hover:text-blue-200 underline">Bet responsibly</Link>
            </span>
          </CardContent>
        </Card>
      </article>
    </div>
  )
}

function PickCard({ fx, highlight }: { fx: MultisportHubFixture; highlight?: boolean }) {
  return (
    <Card className={highlight
      ? 'bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-900 border-amber-500/30 h-full'
      : 'bg-slate-800 border-slate-700 h-full'}>
      <CardContent className="p-4">
        <p className="text-[10px] text-slate-400 uppercase tracking-wide">{fx.league}</p>
        <p className="text-sm font-semibold text-white mt-2 leading-snug">
          {fx.homeTeam} <span className="text-slate-500">vs</span> {fx.awayTeam}
        </p>
        <p className="text-[10px] text-slate-500 mt-1.5">{fmtKickoff(fx.commenceTime)}</p>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/60">
          <span className="text-xs text-slate-300">
            {fx.pick === 'home' ? `${fx.homeTeam} win` : fx.pick === 'away' ? `${fx.awayTeam} win` : 'No pick'}
          </span>
          <span className="text-xs font-bold text-blue-300">{(fx.confidence * 100).toFixed(0)}%</span>
        </div>
      </CardContent>
    </Card>
  )
}

function FixtureRow({ fx }: { fx: MultisportHubFixture }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="text-[10px] text-slate-500 w-12 flex-shrink-0">
          {fx.commenceTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </span>
        <div className="min-w-0">
          <p className="text-sm text-white truncate">
            {fx.homeTeam} <span className="text-slate-500">vs</span> {fx.awayTeam}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">{fx.league}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {fx.pick && (
          <span className="text-xs text-slate-300">
            {fx.pick === 'home' ? 'Home' : 'Away'}
          </span>
        )}
        <span className="text-xs font-bold text-blue-300 w-10 text-right">{(fx.confidence * 100).toFixed(0)}%</span>
      </div>
    </div>
  )
}
