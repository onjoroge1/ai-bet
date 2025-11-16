import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CalendarDays, Clock, ShieldCheck, Sparkles, ArrowRight, TrendingUp, Flame } from 'lucide-react'
import { getDbCountryPricing } from '@/lib/server-pricing-service'

interface BlogMatchSalesSidebarProps {
  title: string
  tags?: string[]
  matchId?: string | null
  excerpt?: string | null
}

interface PublicMatchSummary {
  id: string
  name: string
  matchId: string | null
  matchData?: {
    date?: string
    league?: { name?: string }
    home?: { name?: string; logoUrl?: string }
    away?: { name?: string; logoUrl?: string }
    homeTeam?: { name?: string; logo?: string }
    awayTeam?: { name?: string; logo?: string }
    odds?: {
      novig_current?: {
        home?: number
        draw?: number
        away?: number
      }
    }
  }
  predictionData?: Record<string, unknown>
  confidenceScore?: number | null
  valueRating?: string | null
  analysisSummary?: string | null
  price?: number | null
  originalPrice?: number | null
  country?: {
    currencyCode?: string
    currencySymbol?: string
    code?: string
  }
}

interface MatchDetailResponse {
  match: any
  quickPurchase: {
    id: string
    name: string
    price: number
    originalPrice: number
    description: string | null
    confidenceScore: number | null
    predictionType: string | null
    valueRating: string | null
    analysisSummary: string | null
    predictionData: any
    country?: {
      currencyCode?: string
      currencySymbol?: string
      code?: string
    }
  } | null
}

const resolveBaseUrl = () => {
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

const stripAccents = (value: string) =>
  value.normalize('NFD').replace(/\p{Diacritic}/gu, '')

const normalize = (value: string) =>
  stripAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()

const extractTeamsFromTitle = (title: string): { home?: string; away?: string } | null => {
  if (!title) return null

  const titleSegment = title.split('–')[0]?.split('|')[0] ?? title
  const vsMatch = titleSegment.match(/(.+?)\s+vs\s+(.+)/i)

  if (vsMatch && vsMatch[1] && vsMatch[2]) {
    return {
      home: vsMatch[1].trim(),
      away: vsMatch[2].trim(),
    }
  }

  return null
}

const extractTeamsFromTags = (tags?: string[]) => {
  if (!tags || tags.length < 2) return null
  const filtered = tags
    .map(tag => tag.replace(/[-_]/g, ' ').trim())
    .filter(tag => tag.length > 2)

  if (filtered.length >= 2) {
    return {
      home: filtered[0],
      away: filtered[1],
    }
  }

  return null
}

const getTeamNamesFromMatch = (match: PublicMatchSummary) => {
  const fallbackNames = match.name?.split(' vs ') ?? []
  const homeName =
    match.matchData?.home?.name ||
    match.matchData?.homeTeam?.name ||
    fallbackNames[0] ||
    ''
  const awayName =
    match.matchData?.away?.name ||
    match.matchData?.awayTeam?.name ||
    fallbackNames[1] ||
    ''

  return {
    home: homeName.trim(),
    away: awayName.trim(),
  }
}

const matchesTeams = (expected: { home?: string; away?: string } | null, actual: { home?: string; away?: string }) => {
  if (!expected?.home || !expected?.away || !actual.home || !actual.away) {
    return false
  }

  const expectedHome = normalize(expected.home)
  const expectedAway = normalize(expected.away)
  const actualHome = normalize(actual.home)
  const actualAway = normalize(actual.away)

  const directMatch = actualHome.includes(expectedHome) && actualAway.includes(expectedAway)
  const swappedMatch = actualHome.includes(expectedAway) && actualAway.includes(expectedHome)

  return directMatch || swappedMatch
}

const formatKickoff = (isoDate?: string) => {
  if (!isoDate) return 'TBD'
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return 'TBD'

  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const truncate = (value: string, length: number) =>
  value.length <= length ? value : `${value.substring(0, length - 1).trim()}…`

const deriveConfidence = (...values: Array<number | null | undefined>) => {
  for (const value of values) {
    if (typeof value === 'number') {
      if (value > 1 && value <= 100) return Math.round(value)
      if (value > 0 && value <= 1) return Math.round(value * 100)
    }
  }
  return null
}

const deriveCurrency = (quickPurchase?: MatchDetailResponse['quickPurchase'], matchSummary?: PublicMatchSummary) => {
  const symbol =
    quickPurchase?.country?.currencySymbol ||
    matchSummary?.country?.currencySymbol ||
    '$'
  const code =
    quickPurchase?.country?.currencyCode ||
    matchSummary?.country?.currencyCode ||
    'USD'

  return { symbol, code }
}

type MarketOdds = {
  home?: number | null
  draw?: number | null
  away?: number | null
  label: string
}

const toDecimalOdds = (value?: number | null): number | null => {
  if (!value || value <= 0) return null
  if (value > 0 && value < 1) {
    const decimal = 1 / value
    return Number.isFinite(decimal) ? Number(decimal.toFixed(2)) : null
  }
  return Number(value.toFixed(2))
}

const deriveMarketOdds = (match: any, summary?: PublicMatchSummary): MarketOdds | null => {
  const novig =
    match?.odds?.novig_current ||
    summary?.matchData?.odds?.novig_current ||
    null

  if (novig && (novig.home || novig.draw || novig.away)) {
    return {
      home: toDecimalOdds(novig.home ?? null),
      draw: toDecimalOdds(novig.draw ?? null),
      away: toDecimalOdds(novig.away ?? null),
      label: 'Implied consensus odds',
    }
  }

  const books = match?.odds?.books
  if (books && typeof books === 'object') {
    const firstBookKey = Object.keys(books)[0]
    const bookData = firstBookKey ? books[firstBookKey] : null
    if (bookData) {
      return {
        home: toDecimalOdds(bookData.home ?? null),
        draw: toDecimalOdds(bookData.draw ?? null),
        away: toDecimalOdds(bookData.away ?? null),
        label: `${firstBookKey} odds`,
      }
    }
  }

  return null
}

const resolvePricing = async (
  price: number | null,
  originalPrice: number | null,
  currency: { symbol?: string; code?: string },
  quickPurchase?: MatchDetailResponse['quickPurchase'],
  matchSummary?: PublicMatchSummary | null
) => {
  if (price && price > 0) {
    return {
      price,
      originalPrice: originalPrice ?? price,
      currencySymbol: currency.symbol ?? '$',
      currencyCode: currency.code ?? 'USD',
    }
  }

  const countryCode =
    quickPurchase?.country?.code ||
    matchSummary?.country?.code ||
    matchSummary?.country?.currencyCode ||
    'US'

  try {
    const config = await getDbCountryPricing(countryCode, 'prediction')
    return {
      price: config.price,
      originalPrice: config.originalPrice,
      currencySymbol: config.currencySymbol || currency.symbol || '$',
      currencyCode: config.currencyCode || currency.code || 'USD',
    }
  } catch {
    return {
      price: price ?? null,
      originalPrice: originalPrice ?? price ?? null,
      currencySymbol: currency.symbol ?? '$',
      currencyCode: currency.code ?? 'USD',
    }
  }
}

export async function BlogMatchSalesSidebar({
  title,
  tags,
  matchId,
  excerpt,
}: BlogMatchSalesSidebarProps) {
  const baseUrl = resolveBaseUrl()
  const parsedTeams = extractTeamsFromTitle(title) ?? extractTeamsFromTags(tags)
  let resolvedMatchId = matchId ?? null
  let matchSummary: PublicMatchSummary | null = null

  if (!resolvedMatchId && parsedTeams) {
    try {
      const matchesResponse = await fetch(`${baseUrl}/api/matches`, {
        next: { revalidate: 120, tags: ['blog-matches'] },
      })

      if (matchesResponse.ok) {
        const matches = (await matchesResponse.json()) as PublicMatchSummary[]
        const candidate = matches.find(match => {
          if (!match.matchId) return false
          const names = getTeamNamesFromMatch(match)
          return matchesTeams(parsedTeams, names)
        })

        if (candidate?.matchId) {
          resolvedMatchId = candidate.matchId
          matchSummary = candidate
        }
      }
    } catch (error) {
      console.error('[BlogMatchSalesSidebar] Failed to fetch matches:', error)
    }
  }

  if (!resolvedMatchId) {
    return (
      <Card className="bg-slate-800/50 border-slate-700/60 shadow-lg shadow-emerald-900/10">
        <CardHeader>
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            Tap Into Today&apos;s Picks
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-300 leading-relaxed">
            Unlock premium match analysis, AI confidence levels, and bookmaker consensus odds inside SnapBet AI.
          </p>
          <Button
            asChild
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold"
          >
            <Link href="/matches">
              Browse premium matches
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  let matchDetail: MatchDetailResponse | null = null

  try {
    const detailResponse = await fetch(`${baseUrl}/api/match/${resolvedMatchId}`, {
      next: { revalidate: 120, tags: [`match-${resolvedMatchId}`] },
    })

    if (detailResponse.ok) {
      matchDetail = (await detailResponse.json()) as MatchDetailResponse
    }
  } catch (error) {
    console.error('[BlogMatchSalesSidebar] Failed to fetch match detail:', error)
  }

  const match = matchDetail?.match

  if (!match && !matchSummary) {
    return (
      <Card className="relative overflow-hidden bg-gradient-to-br from-slate-900/85 via-slate-900/70 to-slate-900/85 border border-emerald-500/30 shadow-[0_0_35px_rgba(16,185,129,0.18)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.25),transparent_55%)]" />
        <CardHeader className="relative">
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-300 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
            Explore Premium Predictions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 relative">
          <p className="text-sm text-slate-300 leading-relaxed">
            Secure data-backed match intelligence, value ratings, and AI-powered confidence scores across today&apos;s fixtures.
          </p>
          <Button
            asChild
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold shadow-[0_8px_30px_rgba(16,185,129,0.35)]"
          >
            <Link href="/matches">
              Discover matches
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const homeName =
    match?.home?.name ||
    matchSummary?.matchData?.home?.name ||
    matchSummary?.matchData?.homeTeam?.name ||
    matchSummary?.name?.split(' vs ')?.[0] ||
    'Home'
  const awayName =
    match?.away?.name ||
    matchSummary?.matchData?.away?.name ||
    matchSummary?.matchData?.awayTeam?.name ||
    matchSummary?.name?.split(' vs ')?.[1] ||
    'Away'

  const leagueName =
    match?.league?.name ||
    matchSummary?.matchData?.league?.name ||
    (matchSummary?.name ? matchSummary.name.split(' – ')[1] : null) ||
    'Football'

  const kickoff =
    match?.kickoff_at ||
    match?.match_info?.date ||
    matchSummary?.matchData?.date ||
    null

  const quickPurchase = matchDetail?.quickPurchase
  const confidence = deriveConfidence(
    quickPurchase?.confidenceScore,
    match?.models?.v1_consensus?.confidence,
    matchSummary?.confidenceScore ?? null
  )
  const valueRating =
    quickPurchase?.valueRating ||
    (matchSummary?.valueRating ?? null)

  const analysisSummary =
    quickPurchase?.analysisSummary ||
    (matchSummary?.analysisSummary ?? null) ||
    excerpt ||
    null

  const marketOdds = deriveMarketOdds(match, matchSummary)

  const price = quickPurchase?.price ?? matchSummary?.price ?? null
  const originalPrice =
    quickPurchase?.originalPrice ?? matchSummary?.originalPrice ?? price ?? null
  const currency = deriveCurrency(quickPurchase, matchSummary)
  const pricing = await resolvePricing(price, originalPrice, currency, quickPurchase, matchSummary)

  const hasDiscount =
    typeof pricing.price === 'number' &&
    typeof pricing.originalPrice === 'number' &&
    pricing.price < pricing.originalPrice

  const priceDisplay =
    typeof pricing.price === 'number'
      ? `${pricing.currencySymbol ?? '$'}${pricing.price.toFixed(2)}`
      : null
  const originalPriceDisplay =
    hasDiscount && typeof pricing.originalPrice === 'number'
      ? `${pricing.currencySymbol ?? '$'}${pricing.originalPrice.toFixed(2)}`
      : null

  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-slate-900/85 via-slate-900/70 to-slate-900/85 border border-emerald-500/30 shadow-[0_0_35px_rgba(16,185,129,0.18)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.25),transparent_55%)]" />
      <CardHeader className="space-y-3 relative">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-300 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
            Unlock Full Match Intel
          </CardTitle>
          <span className="inline-flex items-center gap-1 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <Flame className="w-3 h-3" />
            Premium Pick
          </span>
        </div>
        {confidence && (
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide px-3 py-1 rounded-full bg-gradient-to-r from-emerald-400/20 via-emerald-500/20 to-cyan-400/20 text-emerald-200 border border-emerald-400/40">
            <TrendingUp className="w-3 h-3" />
            Confidence {confidence}%
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6 relative">
        <div className="space-y-4">
          <div className="flex flex-col gap-2 text-center">
            <span className="text-sm font-semibold text-white">{homeName}</span>
            <span className="text-[10px] uppercase tracking-[0.35em] text-slate-500">
              vs
            </span>
            <span className="text-sm font-semibold text-white">{awayName}</span>
          </div>
          <div className="rounded-lg bg-gradient-to-r from-slate-900/80 via-slate-900/70 to-slate-900/80 border border-emerald-500/20 p-4 space-y-3 shadow-[0_0_25px_rgba(16,185,129,0.12)]">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <CalendarDays className="w-4 h-4 text-emerald-300" />
              <span>{formatKickoff(kickoff)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-300" />
              <span>{leagueName}</span>
            </div>
            {valueRating && (
              <div className="flex items-center gap-2 text-xs text-emerald-200 font-semibold">
                <Clock className="w-4 h-4" />
                <span>Value Rating: {valueRating}</span>
              </div>
            )}
          </div>
        </div>

        {analysisSummary && (
          <p className="text-sm text-slate-200 leading-relaxed border-l-2 border-emerald-500/50 pl-4 bg-slate-900/50 py-3 rounded-r-lg shadow-[0_0_25px_rgba(16,185,129,0.08)]">
            {truncate(analysisSummary, 220)}
          </p>
        )}

        {marketOdds && (marketOdds.home || marketOdds.draw || marketOdds.away) && (
          <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-r from-slate-900/80 via-slate-900/70 to-slate-900/80 p-5 space-y-3 shadow-[0_0_25px_rgba(16,185,129,0.12)]">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase text-emerald-200 font-semibold tracking-widest">
                {marketOdds.label}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center space-y-1">
                <span className="block text-[10px] uppercase tracking-widest text-slate-400">
                  Home
                </span>
                <span className="text-base font-semibold text-white drop-shadow">
                  {marketOdds.home ? marketOdds.home.toFixed(2) : '—'}
                </span>
              </div>
              <div className="text-center space-y-1">
                <span className="block text-[10px] uppercase tracking-widest text-slate-400">
                  Draw
                </span>
                <span className="text-base font-semibold text-white drop-shadow">
                  {marketOdds.draw ? marketOdds.draw.toFixed(2) : '—'}
                </span>
              </div>
              <div className="text-center space-y-1">
                <span className="block text-[10px] uppercase tracking-widest text-slate-400">
                  Away
                </span>
                <span className="text-base font-semibold text-white drop-shadow">
                  {marketOdds.away ? marketOdds.away.toFixed(2) : '—'}
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Converted to decimal odds for quick comparison. Actual book prices may vary.
            </p>
          </div>
        )}

        <div className="rounded-xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent p-5 space-y-4 shadow-[0_0_30px_rgba(16,185,129,0.18)]">
          <div>
            <span className="text-xs uppercase text-emerald-200 font-semibold tracking-widest">
              Instant Access
            </span>
            <div className="mt-1 flex items-end gap-2">
              {priceDisplay && (
                <span className="text-3xl font-bold text-white drop-shadow-[0_0_15px_rgba(16,185,129,0.35)]">
                  {priceDisplay}
                </span>
              )}
              {originalPriceDisplay && (
                <span className="text-sm text-emerald-200/70 line-through">
                  {originalPriceDisplay}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-200/80 mt-2">
              Includes premium projection, model confidence, and bookmaker consensus odds.
            </p>
          </div>
          <Button
            asChild
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold shadow-[0_12px_35px_rgba(16,185,129,0.35)]"
          >
            <Link href={`/match/${resolvedMatchId}`}>
              View full match analysis
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

