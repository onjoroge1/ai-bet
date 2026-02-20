"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Calendar, MapPin, Trophy, Target, TrendingUp, Loader2, Search, Filter,
  Zap, BarChart3, Clock, Star, ChevronRight, Sparkles, Shield, Timer, Eye
} from "lucide-react"
import { useRouter } from "next/navigation"
import { QuickPurchaseModal } from "@/components/quick-purchase-modal"
import { generateMatchSlug } from "@/lib/match-slug"
import {
  ConfidenceRing,
  SkeletonCard,
  getConfidenceColor,
  getRelativeTime,
  getUrgency,
  formatPrediction,
  getMatchStatus as sharedGetMatchStatus,
  type Match,
  type MatchData,
  type MatchFilters,
} from "@/components/match/shared"

// ─── Types (local-only) ──────────────────────────────────────────────────────

interface QuickPurchaseItem {
  id: string
  name: string
  price: number
  originalPrice?: number
  description: string
  features: string[]
  type: "prediction" | "tip" | "package" | "vip"
  iconName: string
  colorGradientFrom: string
  colorGradientTo: string
  isUrgent?: boolean
  timeLeft?: string
  isPopular?: boolean
  discountPercentage?: number
  confidenceScore?: number
  matchData?: {
    home_team: string
    away_team: string
    league: string
    date: string
  }
  country?: {
    currencyCode: string
    currencySymbol: string
  }
  tipCount?: number
  predictionType?: string
  odds?: number
  valueRating?: string
  analysisSummary?: string
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MatchesPage() {
  const router = useRouter()
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalItem, setModalItem] = useState<QuickPurchaseItem | null>(null)
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [filters, setFilters] = useState<MatchFilters>({
    search: "",
    status: "all",
    confidence: "all",
    valueRating: "all",
    sortBy: "date"
  })

  // Check auth and fetch matches on mount
  useEffect(() => {
    const checkAuthAndFetch = async () => {
      try {
        const res = await fetch('/api/auth/session', {
          cache: 'no-store',
          credentials: 'include',
        })
        const session = await res.json()
        const authenticated = !!session?.user
        setIsAuthenticated(authenticated)
        if (!authenticated) { router.push('/matches'); return }
        fetchMatches()
      } catch {
        setIsAuthenticated(false)
        router.push('/matches')
      }
    }
    checkAuthAndFetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const fetchMatches = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/quick-purchases?view=matches&limit=100')
      if (!response.ok) throw new Error(`Failed to fetch matches: ${response.status} ${response.statusText}`)
      const data: Match[] = await response.json()
      setMatches(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      setMatches([])
    } finally {
      setLoading(false)
    }
  }

  /** Apply client-side filters */
  const filteredMatches = useMemo(() => {
    let filtered = [...matches]

    if (filters.search) {
      const q = filters.search.toLowerCase()
      filtered = filtered.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.matchData?.home_team?.toLowerCase().includes(q) ||
        m.matchData?.away_team?.toLowerCase().includes(q) ||
        m.matchData?.league?.toLowerCase().includes(q)
      )
    }

    if (filters.status !== "all") {
      const now = Date.now()
      const twoH = 2 * 60 * 60 * 1000
      filtered = filtered.filter(m => {
        const t = m.matchData?.date ? new Date(m.matchData.date).getTime() - now : null
        if (t === null) return false
        if (filters.status === "upcoming") return t > 0 && t <= twoH
        if (filters.status === "scheduled") return t > twoH
        return true
      })
    }

    if (filters.confidence !== "all") {
      filtered = filtered.filter(m => {
        const c = m.confidenceScore || 0
        if (filters.confidence === "high") return c >= 80
        if (filters.confidence === "medium") return c >= 60 && c < 80
        if (filters.confidence === "low") return c < 60
        return true
      })
    }

    if (filters.valueRating !== "all") {
      filtered = filtered.filter(m =>
        m.valueRating?.toLowerCase() === filters.valueRating
      )
    }

    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case "confidence": return (b.confidenceScore || 0) - (a.confidenceScore || 0)
        case "date": {
          const dA = a.matchData?.date ? new Date(a.matchData.date).getTime() : 0
          const dB = b.matchData?.date ? new Date(b.matchData.date).getTime() : 0
          return dA - dB
        }
        case "price": return a.price - b.price
        case "name": return a.name.localeCompare(b.name)
        default: return 0
      }
    })
    return filtered
  }, [matches, filters])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showPurchaseModal) { setShowPurchaseModal(false); setModalItem(null) }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [showPurchaseModal])

  const getMatchStatus = sharedGetMatchStatus

  const handlePurchaseClick = (match: Match) => {
    setModalItem({
      id: match.id,
      name: match.name,
      price: match.price,
      originalPrice: match.originalPrice,
      description: match.analysisSummary || `AI prediction for ${match.name}`,
      features: match.features || ['AI Analysis', 'Match Statistics', 'Risk Assessment'],
      type: (match.type as "prediction" | "tip" | "package" | "vip"),
      iconName: match.iconName || 'Star',
      colorGradientFrom: match.colorGradientFrom || '#3B82F6',
      colorGradientTo: match.colorGradientTo || '#1D4ED8',
      isUrgent: match.isUrgent || false,
      timeLeft: match.timeLeft,
      isPopular: match.isPopular || false,
      discountPercentage: match.discountPercentage,
      confidenceScore: match.confidenceScore,
      matchData: match.matchData ? {
        home_team: match.matchData.home_team || '',
        away_team: match.matchData.away_team || '',
        league: match.matchData.league || '',
        date: match.matchData.date || new Date().toISOString()
      } : undefined,
      country: match.country,
      tipCount: match.tipCount,
      predictionType: match.predictionType,
      odds: match.odds,
      valueRating: match.valueRating,
      analysisSummary: match.analysisSummary
    })
    setShowPurchaseModal(true)
  }

  const stats = useMemo(() => ({
    total: filteredMatches.length,
    highConfidence: filteredMatches.filter(m => (m.confidenceScore || 0) >= 80).length,
    upcoming: filteredMatches.filter(m => getMatchStatus(m) === "upcoming").length,
    veryHighValue: filteredMatches.filter(m => m.valueRating?.toLowerCase() === "very high").length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [filteredMatches])

  // ── Auth gate ──────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Shield className="h-12 w-12 text-slate-500 mx-auto" />
          <div className="text-red-400 text-lg font-semibold">Authentication Required</div>
          <div className="text-slate-400 text-sm">You need to be logged in to view this page.</div>
          <Button onClick={() => window.location.href = '/signin'} variant="outline">Go to Sign In</Button>
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen">
      {/* ── Background effects ─────────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-emerald-500/[0.03] rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-60 w-[500px] h-[500px] bg-blue-500/[0.03] rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-purple-500/[0.02] rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* ── Hero Header ───────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800/80 via-slate-800/60 to-emerald-900/20 border border-slate-700/50 p-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30">
                <Sparkles className="h-5 w-5 text-emerald-400" />
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Upcoming Matches</h1>
            </div>
            <p className="text-slate-400 max-w-2xl">
              AI-powered predictions for upcoming fixtures. Each prediction includes confidence scoring,
              value ratings, and detailed analysis from our machine learning models.
            </p>
          </div>
        </div>

        {/* ── Filters ───────────────────────────────────────────────────── */}
        <Card className="bg-slate-800/40 border-slate-700/50 backdrop-blur-sm">
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <div className="relative lg:col-span-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  placeholder="Search teams, leagues..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="pl-10 bg-slate-900/50 border-slate-700/60 text-sm placeholder:text-slate-500"
                />
              </div>

              <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
                <SelectTrigger className="bg-slate-900/50 border-slate-700/60 text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="upcoming">Starting Soon (&lt;2h)</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.confidence} onValueChange={(v) => setFilters({ ...filters, confidence: v })}>
                <SelectTrigger className="bg-slate-900/50 border-slate-700/60 text-sm">
                  <SelectValue placeholder="Confidence" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Confidence</SelectItem>
                  <SelectItem value="high">80%+ High</SelectItem>
                  <SelectItem value="medium">60-79% Medium</SelectItem>
                  <SelectItem value="low">&lt;60% Low</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.valueRating} onValueChange={(v) => setFilters({ ...filters, valueRating: v })}>
                <SelectTrigger className="bg-slate-900/50 border-slate-700/60 text-sm">
                  <SelectValue placeholder="Value" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Ratings</SelectItem>
                  <SelectItem value="very high">Very High</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.sortBy} onValueChange={(v) => setFilters({ ...filters, sortBy: v })}>
                <SelectTrigger className="bg-slate-900/50 border-slate-700/60 text-sm">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Kick-off Time</SelectItem>
                  <SelectItem value="confidence">Confidence</SelectItem>
                  <SelectItem value="price">Price</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                className="border-slate-700/60 text-slate-400 hover:text-white text-sm"
                onClick={() => setFilters({ search: "", status: "all", confidence: "all", valueRating: "all", sortBy: "date" })}
              >
                <Filter className="h-3.5 w-3.5 mr-1.5" />
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Stats Strip ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Matches", value: stats.total, icon: BarChart3, color: "text-white", iconBg: "bg-slate-700/60" },
            { label: "High Confidence", value: stats.highConfidence, icon: Zap, color: "text-emerald-400", iconBg: "bg-emerald-500/15" },
            { label: "Starting Soon", value: stats.upcoming, icon: Timer, color: "text-orange-400", iconBg: "bg-orange-500/15" },
            { label: "Very High Value", value: stats.veryHighValue, icon: Star, color: "text-purple-400", iconBg: "bg-purple-500/15" },
          ].map((stat) => (
            <Card key={stat.label} className="bg-slate-800/40 border-slate-700/40 hover:border-slate-600/60 transition-colors">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${stat.iconBg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-slate-500 text-xs">{stat.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Loading State ─────────────────────────────────────────────── */}
        {loading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* ── Error State ───────────────────────────────────────────────── */}
        {error && !loading && (
          <Card className="bg-red-950/20 border-red-500/20 p-10">
            <div className="text-center space-y-3">
              <div className="text-red-400 text-lg font-semibold">Error Loading Matches</div>
              <div className="text-slate-400 text-sm">{error}</div>
              <Button onClick={fetchMatches} variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10">
                Try Again
              </Button>
            </div>
          </Card>
        )}

        {/* ── Matches Grid ──────────────────────────────────────────────── */}
        {!loading && !error && filteredMatches.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredMatches.map((match) => {
              const matchData = match.matchData || {}
              const confidence = match.confidenceScore || 0
              const confColors = getConfidenceColor(confidence)
              const urgency = getUrgency(matchData.date)
              const status = getMatchStatus(match)

              return (
                <Card
                  key={match.id}
                  className={`group relative overflow-hidden bg-slate-800/50 border-slate-700/50 backdrop-blur-sm
                    hover:border-slate-600/70 hover:shadow-lg ${confColors.glow} transition-all duration-300
                    ${urgency === "hot" ? "ring-1 ring-orange-500/30" : ""}`}
                >
                  {/* Confidence accent bar */}
                  <div className={`absolute top-0 left-0 w-1 h-full ${
                    confidence >= 80 ? 'bg-emerald-500' :
                    confidence >= 60 ? 'bg-yellow-500' :
                    confidence >= 40 ? 'bg-orange-500' : 'bg-red-500'
                  }`} />

                  {/* Urgency pulse for matches starting soon */}
                  {urgency === "hot" && (
                    <div className="absolute top-3 right-3">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500" />
                      </span>
                    </div>
                  )}

                  <CardHeader className="pb-3 pl-5">
                    <div className="flex items-start gap-4">
                      {/* Left: Match info */}
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-white text-base font-semibold leading-tight mb-2 group-hover:text-emerald-50 transition-colors">
                          {matchData.home_team || "TBD"} vs {matchData.away_team || "TBD"}
                        </CardTitle>
                        <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                          <Trophy className="h-3 w-3 shrink-0" />
                          <span className="truncate">{matchData.league || "Unknown"}</span>
                        </div>
                        {matchData.venue && (
                          <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{matchData.venue}</span>
                          </div>
                        )}
                      </div>

                      {/* Right: Confidence ring */}
                      <ConfidenceRing score={confidence} />
                    </div>

                    {/* Date & status row */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/40">
                      {matchData.date && (
                        <div className="flex items-center gap-1.5">
                          <Clock className={`h-3.5 w-3.5 ${urgency === "hot" ? "text-orange-400" : "text-slate-500"}`} />
                          <span className={`text-xs font-medium ${urgency === "hot" ? "text-orange-400" : "text-slate-400"}`}>
                            {getRelativeTime(matchData.date)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        {status === "upcoming" ? (
                          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[10px] px-2 py-0">
                            Starting Soon
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/25 text-[10px] px-2 py-0">
                            Scheduled
                          </Badge>
                        )}
                        {match.valueRating && (
                          <Badge className={`text-[10px] px-2 py-0 ${
                            match.valueRating.toLowerCase() === "very high" ? "bg-purple-500/20 text-purple-400 border-purple-500/30" :
                            match.valueRating.toLowerCase() === "high" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                            match.valueRating.toLowerCase() === "medium" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
                            "bg-slate-600/30 text-slate-400 border-slate-600/40"
                          }`}>
                            {match.valueRating}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 pl-5 pt-0">
                    {/* Prediction & Odds */}
                    {match.predictionType && (
                      <div className={`rounded-lg p-3 ${confColors.bg} border ${
                        confidence >= 80 ? "border-emerald-500/20" :
                        confidence >= 60 ? "border-yellow-500/20" :
                        confidence >= 40 ? "border-orange-500/20" : "border-red-500/20"
                      }`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Prediction</div>
                            <div className="text-white font-semibold text-sm">
                              {formatPrediction(match.predictionType)}
                            </div>
                          </div>
                          {match.odds && (
                            <div className="text-right">
                              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Odds</div>
                              <div className="text-white font-bold text-lg">{Number(match.odds).toFixed(2)}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Analysis summary (only show meaningful text, not raw types) */}
                    {match.analysisSummary && match.analysisSummary.length > 20 && (
                      <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/30">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <TrendingUp className="h-3 w-3 text-emerald-400" />
                          <span className="text-emerald-400 font-medium text-[10px] uppercase tracking-wider">AI Analysis</span>
                        </div>
                        <p className="text-slate-300 text-xs leading-relaxed line-clamp-3">
                          {match.analysisSummary}
                        </p>
                      </div>
                    )}

                    {/* Price & CTAs */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-700/40">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-white font-bold text-lg">
                          {match.country?.currencySymbol}{match.price}
                        </span>
                        {match.originalPrice && match.originalPrice > match.price && (
                          <span className="text-slate-500 line-through text-xs">
                            {match.country?.currencySymbol}{match.originalPrice}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {match.matchId && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const homeTeam = match.matchData?.home_team
                              const awayTeam = match.matchData?.away_team
                              const slug = homeTeam && awayTeam
                                ? generateMatchSlug(homeTeam, awayTeam)
                                : match.matchId
                              router.push(`/match/${slug}`)
                            }}
                            className="border-slate-600/60 text-slate-300 hover:text-white hover:border-slate-500 text-xs font-medium px-3 transition-all hover:bg-slate-700/40"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            Match
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => handlePurchaseClick(match)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium px-4 shadow-lg shadow-emerald-900/30 transition-all hover:shadow-emerald-800/40 hover:scale-[1.02]"
                        >
                          <span>View Prediction</span>
                          <ChevronRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* ── Empty State ───────────────────────────────────────────────── */}
        {!loading && !error && filteredMatches.length === 0 && (
          <Card className="bg-slate-800/40 border-slate-700/40 p-12">
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-700/40 mx-auto">
                <Target className="h-8 w-8 text-slate-500" />
              </div>
              <h3 className="text-lg font-semibold text-white">
                {matches.length === 0 ? "No upcoming matches available" : "No matches found"}
              </h3>
              <p className="text-slate-400 text-sm max-w-md mx-auto">
                {matches.length === 0
                  ? "There are no upcoming match predictions at the moment. New predictions are added regularly — check back soon!"
                  : "Try adjusting your filters or search terms to find what you're looking for."}
              </p>
              {matches.length > 0 && (
                <Button
                  variant="outline"
                  className="border-slate-700/60"
                  onClick={() => setFilters({ search: "", status: "all", confidence: "all", valueRating: "all", sortBy: "date" })}
                >
                  Clear all filters
                </Button>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* ── Purchase Modal ──────────────────────────────────────────────── */}
      {showPurchaseModal && modalItem && (
        <QuickPurchaseModal
          isOpen={showPurchaseModal}
          onClose={() => { setShowPurchaseModal(false); setModalItem(null) }}
          item={modalItem}
        />
      )}
    </div>
  )
}
