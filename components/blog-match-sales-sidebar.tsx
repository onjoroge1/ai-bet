import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CalendarDays, Clock, ShieldCheck, Sparkles, ArrowRight, TrendingUp, Flame, Zap, Target, BarChart3 } from 'lucide-react'
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
      <Card className="relative overflow-hidden bg-slate-900/70 border-slate-700/50 backdrop-blur-sm">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-white flex items-center gap-2">
            <div className="p-1.5 bg-emerald-500/15 rounded-lg">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            Today&apos;s AI Picks
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-400 leading-relaxed">
            Unlock premium match analysis, AI confidence levels, and bookmaker consensus odds.
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-slate-400 bg-slate-800/40 rounded-lg px-2.5 py-2 border border-slate-700/40">
              <Target className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>AI Predictions</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400 bg-slate-800/40 rounded-lg px-2.5 py-2 border border-slate-700/40">
              <BarChart3 className="w-3 h-3 text-blue-400 shrink-0" />
              <span>Value Ratings</span>
            </div>
          </div>
          <Button
            asChild
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-lg shadow-emerald-900/30 hover:shadow-emerald-800/40 hover:scale-[1.02] transition-all"
          >
            <Link href="/matches">
              Browse Matches
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
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
      <Card className="relative overflow-hidden bg-slate-900/70 border-slate-700/50 backdrop-blur-sm">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
        <CardHeader className="relative pb-3">
          <CardTitle className="text-base font-bold text-white flex items-center gap-2">
            <div className="p-1.5 bg-emerald-500/15 rounded-lg">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            Premium Predictions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 relative">
          <p className="text-sm text-slate-400 leading-relaxed">
            Data-backed match intelligence, value ratings, and AI-powered confidence scores.
          </p>
          <Button
            asChild
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-lg shadow-emerald-900/30 hover:shadow-emerald-800/40 hover:scale-[1.02] transition-all"
          >
            <Link href="/matches">
              Discover Matches
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
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
    <div className="space-y-4">
      {/* ── Match Card ─────────────────────────────────────────────────── */}
      <Card className="relative overflow-hidden bg-slate-900/70 border-slate-700/50 backdrop-blur-sm">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />

        <CardHeader className="pb-2 space-y-3 relative">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <div className="p-1.5 bg-emerald-500/15 rounded-lg">
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              Match Intel
            </CardTitle>
            <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/25 text-[10px] px-2 py-0.5">
              <Flame className="w-2.5 h-2.5 mr-1" />
              Premium
            </Badge>
          </div>

          {confidence && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
                  style={{ width: `${Math.min(confidence, 100)}%` }}
                />
              </div>
              <span className="text-xs font-bold text-emerald-400 tabular-nums">{confidence}%</span>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-4 relative pt-0">
          {/* Teams */}
          <div className="flex items-center justify-between gap-3 py-3 border-y border-slate-800/60">
            <span className="text-sm font-semibold text-white text-center flex-1 truncate">{homeName}</span>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-800/60 rounded-full w-7 h-7 flex items-center justify-center shrink-0">vs</span>
            <span className="text-sm font-semibold text-white text-center flex-1 truncate">{awayName}</span>
          </div>

          {/* Match info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <CalendarDays className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>{formatKickoff(kickoff)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>{leagueName}</span>
            </div>
            {valueRating && (
              <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
                <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                <span>Value: {valueRating}</span>
              </div>
            )}
          </div>

          {/* Analysis summary */}
          {analysisSummary && (
            <p className="text-xs text-slate-400 leading-relaxed border-l-2 border-emerald-500/30 pl-3 py-1">
              {truncate(analysisSummary, 180)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Odds Card ──────────────────────────────────────────────────── */}
      {marketOdds && (marketOdds.home || marketOdds.draw || marketOdds.away) && (
        <Card className="relative overflow-hidden bg-slate-900/70 border-slate-700/50 backdrop-blur-sm">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1 bg-blue-500/15 rounded-md">
                <BarChart3 className="w-3 h-3 text-blue-400" />
              </div>
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                {marketOdds.label}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Home', value: marketOdds.home },
                { label: 'Draw', value: marketOdds.draw },
                { label: 'Away', value: marketOdds.away },
              ].map((o) => (
                <div key={o.label} className="text-center bg-slate-800/50 rounded-lg py-2.5 border border-slate-700/40">
                  <span className="block text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">
                    {o.label}
                  </span>
                  <span className="text-sm font-bold text-white">
                    {o.value ? o.value.toFixed(2) : '—'}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Decimal odds for comparison. Actual book prices may vary.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── CTA Card ───────────────────────────────────────────────────── */}
      <Card className="relative overflow-hidden bg-slate-900/70 border-emerald-500/20 backdrop-blur-sm">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/[0.04] to-transparent pointer-events-none" />
        <CardContent className="pt-5 space-y-4 relative">
          <div>
            <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-widest">
              Instant Access
            </span>
            <div className="mt-1.5 flex items-baseline gap-2">
              {priceDisplay && (
                <span className="text-2xl font-extrabold text-white">
                  {priceDisplay}
                </span>
              )}
              {originalPriceDisplay && (
                <span className="text-xs text-slate-500 line-through">
                  {originalPriceDisplay}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
              Premium projection, model confidence, and bookmaker consensus odds.
            </p>
          </div>
          <Button
            asChild
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-lg shadow-emerald-900/30 hover:shadow-emerald-800/40 hover:scale-[1.02] transition-all"
          >
            <Link href={`/match/${resolvedMatchId}`}>
              View Full Analysis
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

