"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  MapPin, Trophy, Target, TrendingUp, Loader2, Search, Filter,
  Zap, BarChart3, Clock, Star, ChevronRight, Sparkles, Timer, Eye, LogIn, Users
} from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import { generateMatchSlug } from "@/lib/match-slug"
import {
  ConfidenceRing,
  SkeletonCard,
  getConfidenceColor,
  getRelativeTime,
  getUrgency,
  formatPrediction,
  getMatchStatus,
  type Match,
  type MatchFilters,
} from "@/components/match/shared"

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PublicMatchesPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<MatchFilters>({
    search: "",
    status: "all",
    confidence: "all",
    valueRating: "all",
    sortBy: "date"
  })

  // ─── Filtering ─────────────────────────────────────────────────────────
  const filteredMatches = useMemo(() => {
    let filtered = [...matches]

    if (filters.search) {
      const q = filters.search.toLowerCase()
      filtered = filtered.filter(m => {
        const md = m.matchData || {}
        return (md.home_team?.toLowerCase() || "").includes(q) ||
               (md.away_team?.toLowerCase() || "").includes(q) ||
               (md.league?.toLowerCase() || "").includes(q) ||
               (m.predictionType?.toLowerCase() || "").includes(q)
      })
    }

    if (filters.status !== "all") {
      filtered = filtered.filter(m => getMatchStatus(m) === filters.status)
    }

    if (filters.confidence !== "all") {
      filtered = filtered.filter(m => {
        const c = m.confidenceScore || 0
        if (filters.confidence === "high") return c >= 80
        if (filters.confidence === "medium") return c >= 60 && c < 80
        return c < 60
      })
    }

    if (filters.valueRating !== "all") {
      filtered = filtered.filter(m =>
        (m.valueRating?.toLowerCase() || "") === filters.valueRating.toLowerCase()
      )
    }

    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case "confidence": return (b.confidenceScore || 0) - (a.confidenceScore || 0)
        case "price": return a.price - b.price
        case "name": {
          const aName = `${a.matchData?.home_team || ""} vs ${a.matchData?.away_team || ""}`
          const bName = `${b.matchData?.home_team || ""} vs ${b.matchData?.away_team || ""}`
          return aName.localeCompare(bName)
        }
        case "date":
        default: {
          const aDate = a.matchData?.date ? new Date(a.matchData.date) : new Date(0)
          const bDate = b.matchData?.date ? new Date(b.matchData.date) : new Date(0)
          return aDate.getTime() - bDate.getTime()
        }
      }
    })

    return filtered
  }, [matches, filters])

  // ─── Stats ─────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: filteredMatches.length,
    highConfidence: filteredMatches.filter(m => (m.confidenceScore || 0) >= 80).length,
    upcoming: filteredMatches.filter(m => getMatchStatus(m) === "upcoming").length,
    veryHighValue: filteredMatches.filter(m => m.valueRating?.toLowerCase() === "very high").length,
  }), [filteredMatches])

  // ─── Data fetching ─────────────────────────────────────────────────────
  const fetchMatches = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/matches')
      if (!response.ok) {
        throw new Error(`Failed to fetch matches: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      setMatches(data as Match[])
    } catch (err) {
      console.error('Error fetching matches:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch matches')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMatches()
  }, [fetchMatches])

  // ─── Navigation ────────────────────────────────────────────────────────
  const handleLoginClick = () => router.push('/signin?callbackUrl=/dashboard/matches')
  const handleSignUpClick = () => router.push('/signup?callbackUrl=/dashboard/matches')

  const clearFilters = () =>
    setFilters({ search: "", status: "all", confidence: "all", valueRating: "all", sortBy: "date" })

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 py-8 space-y-8">

        {/* ── Hero Section ──────────────────────────────────────────────── */}
        <div className="text-center space-y-4 py-6">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 mb-2">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            <span className="text-emerald-400 text-sm font-medium">AI-Powered Predictions</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
            Today&apos;s Match Predictions
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Discover upcoming matches with AI-powered predictions, confidence scores,
            and value ratings — backed by machine learning analysis.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button
              onClick={handleSignUpClick}
              size="lg"
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 shadow-lg shadow-emerald-900/30 transition-all hover:shadow-emerald-800/40 hover:scale-[1.02]"
            >
              <Zap className="h-5 w-5 mr-2" />
              Get Started Free
            </Button>
            <Button
              onClick={handleLoginClick}
              variant="outline"
              size="lg"
              className="border-slate-600 text-white hover:bg-slate-800 px-8"
            >
              <LogIn className="h-5 w-5 mr-2" />
              Sign In
            </Button>
          </div>
        </div>

        {/* ── Stats Strip ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

        {/* ── Filter Bar ─────────────────────────────────────────────────── */}
        <Card className="bg-slate-800/40 border-slate-700/40 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search matches..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="pl-10 bg-slate-900/50 border-slate-700/50"
                />
              </div>

              <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
                <SelectTrigger className="bg-slate-900/50 border-slate-700/50">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="upcoming">Upcoming (&lt;2h)</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.confidence} onValueChange={(v) => setFilters({ ...filters, confidence: v })}>
                <SelectTrigger className="bg-slate-900/50 border-slate-700/50">
                  <SelectValue placeholder="Confidence" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Confidence</SelectItem>
                  <SelectItem value="high">80%+ Confidence</SelectItem>
                  <SelectItem value="medium">60-79% Confidence</SelectItem>
                  <SelectItem value="low">&lt;60% Confidence</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.valueRating} onValueChange={(v) => setFilters({ ...filters, valueRating: v })}>
                <SelectTrigger className="bg-slate-900/50 border-slate-700/50">
                  <SelectValue placeholder="Value Rating" />
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
                <SelectTrigger className="bg-slate-900/50 border-slate-700/50">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="confidence">Confidence</SelectItem>
                  <SelectItem value="price">Price</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                className="border-slate-700/60 hover:bg-slate-700/40"
                onClick={clearFilters}
              >
                <Filter className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

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
                          onClick={isAuthenticated ? undefined : handleSignUpClick}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium px-4 shadow-lg shadow-emerald-900/30 transition-all hover:shadow-emerald-800/40 hover:scale-[1.02]"
                        >
                          <span>{isAuthenticated ? "View Prediction" : "Sign Up to View"}</span>
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
                <Button variant="outline" className="border-slate-700/60" onClick={clearFilters}>
                  Clear all filters
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* ── Bottom CTA ────────────────────────────────────────────────── */}
        <Card className="bg-gradient-to-r from-emerald-500/10 via-slate-800/60 to-blue-500/10 border border-emerald-500/20 p-8 mt-8">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold text-white">
              Ready to Start Winning?
            </h2>
            <p className="text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Join thousands of successful bettors who trust our AI predictions.
              Get access to premium analysis, confidence scores, and value ratings.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button
                onClick={handleSignUpClick}
                size="lg"
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 shadow-lg shadow-emerald-900/30 transition-all hover:shadow-emerald-800/40 hover:scale-[1.02]"
              >
                <Zap className="h-5 w-5 mr-2" />
                Start Free Trial
              </Button>
              <Button
                onClick={handleLoginClick}
                variant="outline"
                size="lg"
                className="border-slate-600 text-white hover:bg-slate-800 px-8"
              >
                <LogIn className="h-5 w-5 mr-2" />
                Already have an account?
              </Button>
            </div>
          </div>
        </Card>

      </div>
    </div>
  )
}
