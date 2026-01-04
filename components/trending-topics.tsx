import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CalendarDays, Clock, ArrowRight, Compass, Target } from 'lucide-react'
import Link from 'next/link'
import { formatDate, formatKickoffTime, getConfidenceColorClass, isToday, isTomorrow } from '@/lib/market/formatters'

interface HighlightMatch {
  id: string
  kickoffUtc: string
  status: 'upcoming' | 'live'
  leagueName: string
  homeTeam: string
  awayTeam: string
  homeLogo?: string
  awayLogo?: string
  confidence?: number
  pick?: 'home' | 'away' | 'draw'
  booksCount?: number
  link: string
}

const FALLBACK_LIMIT = 4
const INVALID_NAMES = ['TBD', 'TBA', 'TBC', '', 'HOME', 'AWAY', 'TEAM 1', 'TEAM 2']

const resolveAppBaseUrl = () => {
  const fallback = 'https://www.snapbet.bet'
  const envUrl = process.env.NEXTAUTH_URL

  if (!envUrl) {
    return fallback
  }

  try {
    return new URL(envUrl).origin
  } catch {
    return fallback
  }
}

const normalizeTeamName = (name?: string | null) => (name || '').trim()

const isTeamNameValid = (name?: string | null) => {
  if (!name) return false
  const upper = name.trim().toUpperCase()
  return !INVALID_NAMES.includes(upper)
}

const createMatchId = (match: any) => {
  const sourceId = match.match_id || match.id || match._id
  if (sourceId) {
    return String(sourceId)
  }

  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `match-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

const adaptMatch = (match: any): HighlightMatch | null => {
  const homeNameRaw = normalizeTeamName(match.home?.name)
  const awayNameRaw = normalizeTeamName(match.away?.name)

  if (!isTeamNameValid(homeNameRaw) || !isTeamNameValid(awayNameRaw)) {
    return null
  }

  const kickoffUtc =
    match.kickoff_at ||
    match.kickoff_utc ||
    match.matchDate ||
    match.date ||
    new Date().toISOString()

  const v1Model = match.models?.v1_consensus
  const fallbackFreePrediction = match.predictions?.free

  const rawPick = (v1Model?.pick || fallbackFreePrediction?.side || '').toLowerCase()
  const freePickSide = ['home', 'away', 'draw'].includes(rawPick) ? (rawPick as HighlightMatch['pick']) : undefined

  const freeConfidenceRaw =
    v1Model?.confidence ??
    fallbackFreePrediction?.confidence ??
    0

  const toPercent = (value: number) => {
    if (!value || Number.isNaN(value)) {
      return undefined
    }

    if (value > 1) {
      return Math.min(Math.round(value), 100)
    }

    return Math.min(Math.round(value * 100), 100)
  }

  const confidence = toPercent(freeConfidenceRaw)

  const booksCount =
    typeof match.odds?.books === 'object'
      ? Object.keys(match.odds.books).length
      : match.odds?.books_count || match.odds?.book_count

  return {
    id: createMatchId(match),
    kickoffUtc,
    status: match.status === 'live' || match.minute ? 'live' : 'upcoming',
    leagueName: match.league?.name || match.competition?.name || 'Football',
    homeTeam: homeNameRaw,
    awayTeam: awayNameRaw,
    homeLogo: match.home?.logo_url || match.homeTeam?.logo,
    awayLogo: match.away?.logo_url || match.awayTeam?.logo,
    pick: freePickSide,
    confidence,
    booksCount: typeof booksCount === 'number' && booksCount > 0 ? booksCount : undefined,
    link: `/match/${match.match_id || match.id}`,
  }
}

const fetchUpcomingMatches = async (): Promise<HighlightMatch[]> => {
  const baseUrl = resolveAppBaseUrl()

  try {
    // Use lite mode for fast loading
    const response = await fetch(
      `${baseUrl}/api/market?status=upcoming&limit=16&mode=lite`,
      {
        headers: { 'Content-Type': 'application/json' },
        next: {
          revalidate: 300,
          tags: ['market-data', 'market-upcoming'],
        },
      }
    )

    if (!response.ok) {
      console.error('[UpcomingMatchesSpotlight] Failed to fetch market data', response.status, response.statusText)
      return []
    }

    const payload = await response.json()
    const matches: HighlightMatch[] = (payload.matches || [])
      .map(adaptMatch)
      .filter((match): match is HighlightMatch => Boolean(match))

    return matches
      .sort((a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime())
      .slice(0, FALLBACK_LIMIT)
  } catch (error) {
    console.error('[UpcomingMatchesSpotlight] Error', error)
    return []
  }
}

const buildDateLabel = (kickoffUtc: string) => {
  if (isToday(kickoffUtc)) {
    return 'Today'
  }

  if (isTomorrow(kickoffUtc)) {
    return 'Tomorrow'
  }

  return formatDate(kickoffUtc)
}

const pickLabel = (match: HighlightMatch) => {
  if (!match.pick) {
    return 'Model update in progress'
  }

  if (match.pick === 'draw') {
    return 'AI Edge: Draw'
  }

  const team = match.pick === 'home' ? match.homeTeam : match.awayTeam
  return `AI Edge: ${team}`
}

const confidenceBadge = (match: HighlightMatch) => {
  if (!match.confidence) {
    return null
  }

  return (
    <Badge
      className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border-0 ${confidenceEmphasisClass(match.confidence)}`}
    >
      Confidence {match.confidence}%
    </Badge>
  )
}

const confidenceEmphasisClass = (confidence: number): string => {
  if (confidence >= 80) {
    return 'bg-gradient-to-r from-emerald-400 via-emerald-300 to-emerald-400 text-slate-900 shadow-[0_0_20px_rgba(16,185,129,0.45)]'
  }

  if (confidence >= 65) {
    return 'bg-gradient-to-r from-lime-300 via-emerald-300 to-lime-400 text-slate-900 shadow-[0_0_16px_rgba(132,204,22,0.35)]'
  }

  return 'bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-400 text-slate-900 shadow-[0_0_12px_rgba(250,204,21,0.3)]'
}

const teamStack = (team: string, logo?: string) => (
  <div className="flex items-center gap-2">
    <div className="h-8 w-8 rounded-full bg-slate-700/70 border border-slate-600 flex items-center justify-center overflow-hidden">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt={team} className="h-full w-full object-cover" />
      ) : (
        <span className="text-xs font-semibold text-slate-300">
          {team.slice(0, 2).toUpperCase()}
        </span>
      )}
    </div>
    <span className="text-sm font-medium text-white">{team}</span>
  </div>
)

export async function UpcomingMatchesSpotlight() {
  const matches = await fetchUpcomingMatches()

  return (
    <section className="bg-slate-900/60 border-t border-slate-800/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/15 rounded-xl border border-emerald-500/20">
              <Compass className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Upcoming Matches Spotlight
              </h2>
              <p className="text-sm text-slate-400">
                Fresh pick opportunities sourced from the live market feed.
              </p>
            </div>
          </div>
          <Button variant="outline" className="border-slate-600 text-slate-200 hover:bg-emerald-500/20 hover:border-emerald-500/40" asChild>
            <Link href="/matches">
              Explore all markets
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>

        {matches.length === 0 ? (
          <Card className="bg-slate-800/40 border-slate-700/60">
            <CardContent className="py-12 text-center space-y-3">
              <Target className="w-10 h-10 text-slate-500 mx-auto" />
              <h3 className="text-lg font-semibold text-white">
                Market data warming up
              </h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                We couldn’t find upcoming matches right now. Refresh shortly for the latest edges, or head to the matches page for full coverage.
              </p>
              <Button variant="ghost" className="text-emerald-400 hover:text-emerald-300" asChild>
                <Link href="/matches">
                  View matches
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {matches.map((match) => (
              <Card key={match.id} className="bg-slate-800/40 border-slate-700/60 hover:border-emerald-500/40 transition-all duration-300">
                <CardContent className="p-6 space-y-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wide">
                        <CalendarDays className="w-3 h-3" />
                        {buildDateLabel(match.kickoffUtc)}
                        <span>•</span>
                        <Clock className="w-3 h-3" />
                        {formatKickoffTime(match.kickoffUtc)}
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-200">
                        {match.leagueName}
                      </div>
                    </div>
                    {confidenceBadge(match)}
                  </div>

                  <div className="space-y-3">
                    {teamStack(match.homeTeam, match.homeLogo)}
                    <div className="text-center text-xs uppercase text-slate-500 tracking-[0.3em]">
                      vs
                    </div>
                    {teamStack(match.awayTeam, match.awayLogo)}
                  </div>

                  <div className="rounded-lg bg-slate-900/70 border border-slate-700/60 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                        {match.booksCount ? `${match.booksCount} bookmaker consensus` : 'Model insight'}
                      </span>
                      {match.confidence && (
                        <span
                          className={`text-xs font-bold uppercase tracking-wide px-2 py-1 rounded-full ${confidenceEmphasisClass(match.confidence)}`}
                        >
                          {match.confidence}%
                        </span>
                      )}
                    </div>
                    <div className="mt-2 text-sm text-slate-200 font-medium">
                      {pickLabel(match)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      Kickoff {new Date(match.kickoffUtc).toLocaleString('en-US', {
                        weekday: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <Button variant="ghost" size="sm" className="text-emerald-400 hover:text-emerald-300" asChild>
                      <Link href={match.link}>
                        Match intel
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
