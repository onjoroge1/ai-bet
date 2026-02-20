"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import {
  Calendar,
  MapPin,
  Trophy,
  Target,
  TrendingUp,
  Shield,
  ExternalLink,
  Sparkles,
  Clock,
  CheckCircle,
  Star,
  BarChart3,
  ChevronRight,
  Zap,
} from "lucide-react"
import { generateMatchSlug } from "@/lib/match-slug"

// ─── Types ────────────────────────────────────────────────────────────────────

/** Prediction data shape coming from the API. */
interface PredictionData {
  predictions?: {
    recommended_bet?: string
    confidence?: number
  }
  analysis?: {
    ai_summary?: string
    team_analysis?: {
      home_team?: TeamAnalysis
      away_team?: TeamAnalysis
    }
    prediction_analysis?: {
      model_assessment?: string
      value_assessment?: string
      confidence_factors?: string[]
      risk_factors?: string[]
    }
    betting_recommendations?: {
      primary_bet?: string
      risk_level?: string
      suggested_stake?: string
      alternative_bets?: string[]
    }
  }
  additional_markets?: {
    total_goals?: { over_2_5: number; under_2_5: number }
    both_teams_score?: { yes: number; no: number }
    asian_handicap?: Record<string, number>
  }
  additional_markets_v2?: AdditionalMarketsV2
  model_info?: {
    type?: string
    version?: string
    performance?: string
    quality_score?: number
    bookmaker_count?: number
    data_sources?: string[]
  }
  data_freshness?: {
    h2h_matches?: number
    form_matches?: number
    home_injuries?: number
    away_injuries?: number
    collection_time?: string
  }
  match_info?: { match_id?: string; id?: string }
  match_id?: string
}

interface TeamAnalysis {
  strengths?: string[]
  weaknesses?: string[]
  form_assessment?: string
  injury_impact?: string
}

interface AdditionalMarketsV2 {
  totals?: Record<string, { over: number; under: number }>
  team_totals?: {
    home?: Record<string, { over: number; under: number }>
    away?: Record<string, { over: number; under: number }>
  }
  btts?: { yes: number; no: number }
  double_chance?: Record<string, number>
  dnb?: { home: number; away: number }
  asian_handicap?: {
    home?: Record<string, { win: number; push?: number; lose: number }>
    away?: Record<string, { win: number; push?: number; lose: number }>
  }
  winning_margin?: Record<string, number>
  correct_scores?: Array<{ score: string; p: number }>
  odd_even_total?: { odd: number; even: number }
  clean_sheet?: { home: number; away: number }
  win_to_nil?: { home: number; away: number }
}

interface Tip {
  id: string
  purchaseDate: string
  amount: number
  paymentMethod: string
  tipType: "purchase" | "credit_claim"
  creditsSpent?: number
  matchId?: string | null
  homeTeam: string
  awayTeam: string
  matchDate: string | null
  venue: string | null
  league: string | null
  matchStatus: string | null
  predictionType: string | null
  confidenceScore: number | null
  odds: number | null
  valueRating: string | null
  analysisSummary: string | null
  name: string
  type: string
  price: number
  description: string
  features: string[]
  isUrgent: boolean
  timeLeft: string | null
  currencySymbol: string
  currencyCode: string
  predictionData: PredictionData | null
  prediction: {
    match: {
      homeTeam: string
      awayTeam: string
      date: string
      venue?: string
      league?: string
    }
    prediction: string
    odds: string
    confidence: number
    analysis: string
    valueRating: string
    detailedReasoning: string[]
    extraMarkets: unknown[]
    thingsToAvoid: string[]
    riskLevel: string
    confidenceStars: number
  } | null
  expiresAt?: string | null
  status?: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the relative time string for a future match date. */
function getRelativeTime(dateString: string | null): string {
  if (!dateString) return "TBD"
  const diff = new Date(dateString).getTime() - Date.now()
  if (diff <= 0) return "Finished"
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `In ${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `In ${hours}h ${minutes % 60}m`
  const days = Math.floor(hours / 24)
  if (days === 1) return `Tomorrow ${new Date(dateString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
  return `In ${days}d`
}

/** Formats a date string as a short locale date + time. */
function formatMatchDate(dateString: string | null): string {
  if (!dateString) return "TBD"
  return new Date(dateString).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** Maps a confidence score (0–100) to a Tailwind colour token. */
function getConfidenceColor(score: number | null): string {
  if (!score) return "text-slate-400"
  if (score >= 75) return "text-emerald-400"
  if (score >= 55) return "text-yellow-400"
  return "text-red-400"
}

/** Returns the stroke colour for the SVG confidence ring. */
function getRingStroke(score: number | null): string {
  if (!score) return "#64748b"
  if (score >= 75) return "#34d399"
  if (score >= 55) return "#fbbf24"
  return "#f87171"
}

/** Maps a prediction type key to a human-readable label. */
function getPredictionLabel(type: string | null): string {
  if (!type) return "No Prediction"
  switch (type) {
    case "home_win": return "Home Win"
    case "away_win": return "Away Win"
    case "draw": return "Draw"
    default: return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  }
}

/** Returns the best available matchId from multiple sources. */
function resolveMatchId(tip: Tip): string | null {
  return (
    tip.matchId ??
    tip.predictionData?.match_info?.match_id ??
    tip.predictionData?.match_info?.id ??
    tip.predictionData?.match_id ??
    null
  )
}

/** Builds the match detail URL — slug-based when team names are available. */
function buildMatchUrl(tip: Tip): string {
  const home = tip.homeTeam
  const away = tip.awayTeam
  if (home && away && !home.startsWith("Team ") && !away.startsWith("Team ")) {
    return `/match/${generateMatchSlug(home, away)}`
  }
  const id = resolveMatchId(tip)
  return id ? `/match/${id}` : "/matches"
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Circular SVG confidence ring. */
function ConfidenceRing({ score }: { score: number | null }) {
  const pct = score ?? 0
  const r = 22
  const circumference = 2 * Math.PI * r
  const offset = circumference - (pct / 100) * circumference
  return (
    <div className="relative w-14 h-14 flex items-center justify-center">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={r} fill="none" stroke="#1e293b" strokeWidth="4" />
        <circle
          cx="28" cy="28" r={r} fill="none"
          stroke={getRingStroke(score)}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <span className={`text-xs font-bold ${getConfidenceColor(score)}`}>
        {score ? `${score}%` : "—"}
      </span>
    </div>
  )
}

/** Skeleton loading card. */
function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 overflow-hidden animate-pulse">
      <div className="h-1 bg-slate-700 w-full" />
      <div className="p-5 space-y-3">
        <div className="h-3 bg-slate-700 rounded w-1/2" />
        <div className="h-5 bg-slate-700 rounded w-3/4" />
        <div className="h-3 bg-slate-700 rounded w-2/3" />
        <div className="h-8 bg-slate-700 rounded w-full mt-4" />
      </div>
    </div>
  )
}

// ─── Tip Cards ────────────────────────────────────────────────────────────────

/** Full-size card for upcoming matches. */
function UpcomingMatchCard({
  tip,
  onView,
}: {
  tip: Tip
  onView: (t: Tip) => void
}) {
  const router = useRouter()
  const relTime = getRelativeTime(tip.matchDate)
  const matchUrl = buildMatchUrl(tip)
  const confidence = tip.confidenceScore
  const accentColor = confidence && confidence >= 75
    ? "bg-emerald-500"
    : confidence && confidence >= 55
    ? "bg-yellow-500"
    : "bg-slate-500"
  const glowClass = confidence && confidence >= 75
    ? "hover:shadow-emerald-500/20"
    : confidence && confidence >= 55
    ? "hover:shadow-yellow-500/20"
    : "hover:shadow-slate-500/20"

  return (
    <div
      className={`group relative rounded-2xl border border-slate-700/50 bg-slate-800/60 backdrop-blur-sm overflow-hidden
        cursor-pointer transition-all duration-300 hover:border-slate-600/70 hover:bg-slate-800/80 hover:shadow-xl ${glowClass}`}
      onClick={() => onView(tip)}
    >
      {/* Left accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentColor} rounded-l-2xl`} />

      <div className="p-5 pl-6 space-y-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs">
              <Clock className="w-3 h-3 shrink-0" />
              <span className="truncate">{formatMatchDate(tip.matchDate)}</span>
                  </div>
            <p className="text-white font-bold text-base leading-tight line-clamp-2">
              {tip.homeTeam} <span className="text-slate-400 font-normal">vs</span> {tip.awayTeam}
            </p>
          </div>
          <ConfidenceRing score={confidence} />
                  </div>

        {/* League + venue */}
                  {tip.league && (
          <div className="flex items-center gap-1.5 text-slate-400 text-xs">
            <Trophy className="w-3 h-3 shrink-0 text-yellow-500" />
            <span className="truncate">{tip.league}</span>
                    </div>
                  )}

        {/* Prediction badge */}
                {tip.predictionType && (
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-emerald-600/80 text-white text-xs border-0 shadow-none">
              {getPredictionLabel(tip.predictionType)}
                    </Badge>
                    {tip.valueRating && (
              <Badge className="bg-slate-700 text-slate-300 text-xs border-0">
                        {tip.valueRating} Value
                      </Badge>
                    )}
                  </div>
                )}

        {/* Time chip */}
        <div className="flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-emerald-400 shrink-0" />
          <span className="text-emerald-400 text-xs font-semibold">{relTime}</span>
          </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
            <Button 
            size="sm"
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs shadow-lg shadow-emerald-500/20
              hover:shadow-emerald-500/40 transition-all duration-200 hover:scale-[1.02]"
            onClick={(e) => { e.stopPropagation(); onView(tip) }}
            >
              View Prediction
            </Button>
              <Button
            size="sm"
                variant="outline"
            className="border-slate-600 text-slate-300 hover:bg-slate-700/60 text-xs"
            onClick={(e) => { e.stopPropagation(); router.push(matchUrl) }}
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            Match
              </Button>
          </div>
        </div>
    </div>
  )
}

/** Compact card for completed matches. */
function CompletedMatchCard({
  tip,
  onView,
}: {
  tip: Tip
  onView: (t: Tip) => void
}) {
  const router = useRouter()
  const matchUrl = buildMatchUrl(tip)
    
    return (
    <div
      className="group relative rounded-2xl border border-slate-700/40 bg-slate-800/40 backdrop-blur-sm overflow-hidden
        cursor-pointer transition-all duration-300 hover:border-slate-600/60 hover:bg-slate-800/60 hover:shadow-lg hover:shadow-slate-700/20"
      onClick={() => onView(tip)}
    >
      {/* Left accent bar (muted for completed) */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-600 rounded-l-2xl" />

      <div className="p-4 pl-5 space-y-3">
        <div className="flex items-center gap-1.5 text-slate-500 text-xs">
          <Calendar className="w-3 h-3 shrink-0" />
          <span className="truncate">{formatMatchDate(tip.matchDate)}</span>
                </div>

        <p className="text-slate-200 font-semibold text-sm leading-tight line-clamp-2">
          {tip.homeTeam} <span className="text-slate-500 font-normal">vs</span> {tip.awayTeam}
        </p>

          {tip.predictionType && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge className="bg-slate-700 text-slate-300 text-xs border-0">
              {getPredictionLabel(tip.predictionType)}
                </Badge>
                {tip.confidenceScore && (
              <span className={`text-xs font-semibold ${getConfidenceColor(tip.confidenceScore)}`}>
                    {tip.confidenceScore}%
                  </span>
                )}
            </div>
          )}

        <div className="flex gap-1.5 pt-0.5">
                  <Button 
                    size="sm"
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-xs"
            onClick={(e) => { e.stopPropagation(); onView(tip) }}
          >
            Details
                  </Button>
                    <Button
                      size="sm"
                      variant="outline"
            className="border-slate-600 text-slate-400 hover:bg-slate-700/60 text-xs px-2"
            onClick={(e) => { e.stopPropagation(); router.push(matchUrl) }}
          >
            <ExternalLink className="w-3 h-3" />
                    </Button>
                </div>
              </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MyTipsPage() {
  const [tips, setTips] = useState<Tip[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTip, setSelectedTip] = useState<Tip | null>(null)
  const [showPrediction, setShowPrediction] = useState(false)

  useEffect(() => {
    const fetchTips = async () => {
      try {
        const res = await fetch("/api/my-tips")
        if (!res.ok) throw new Error("Failed to fetch tips")
        setTips(await res.json())
      } catch (err) {
        console.error("Error fetching tips:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchTips()
  }, [])

  const handleViewPrediction = (tip: Tip) => {
    setSelectedTip(tip)
    setShowPrediction(true)
  }

  const upcomingTips = tips
    .filter((t) => t.matchDate && new Date(t.matchDate) > new Date())
    .sort((a, b) => new Date(a.matchDate!).getTime() - new Date(b.matchDate!).getTime())

  const completedTips = tips
    .filter((t) => !t.matchDate || new Date(t.matchDate) <= new Date())
    .sort((a, b) => new Date(b.matchDate ?? 0).getTime() - new Date(a.matchDate ?? 0).getTime())

  // ── Stats ──
  const totalTips = tips.length
  const avgConfidence = tips.length
    ? Math.round(tips.reduce((s, t) => s + (t.confidenceScore ?? 0), 0) / tips.length)
    : 0
  const highConfidence = tips.filter((t) => (t.confidenceScore ?? 0) >= 75).length

  return (
    <div className="relative min-h-screen">
      {/* ── Background depth blobs ── */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-emerald-500/[0.03] rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-blue-500/[0.03] rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 w-[300px] h-[300px] bg-purple-500/[0.03] rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">

        {/* ── Hero header ── */}
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-slate-800/80 via-slate-800/60 to-emerald-900/20 border border-slate-700/50 p-8">
          {/* Glow orb */}
          <div className="absolute -top-6 -right-6 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-emerald-500/20 border border-emerald-500/30 shrink-0">
              <Sparkles className="w-7 h-7 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">My Predictions</h1>
              <p className="text-slate-400 mt-1 text-sm">
          View and manage your purchased predictions and claimed tips
        </p>
            </div>
      </div>
      
          {/* ── Stats strip ── */}
          {!loading && tips.length > 0 && (
            <div className="relative mt-6 flex flex-wrap gap-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-500/20">
                  <BarChart3 className="w-4 h-4 text-blue-400" />
          </div>
            <div>
                  <div className="text-xl font-bold text-white leading-none">{totalTips}</div>
                  <div className="text-xs text-slate-400">Total Tips</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-500/20">
                  <Target className="w-4 h-4 text-emerald-400" />
              </div>
            <div>
                  <div className="text-xl font-bold text-white leading-none">{upcomingTips.length}</div>
                  <div className="text-xs text-slate-400">Upcoming</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-yellow-500/20">
                  <Star className="w-4 h-4 text-yellow-400" />
              </div>
                <div>
                  <div className="text-xl font-bold text-white leading-none">{avgConfidence}%</div>
                  <div className="text-xs text-slate-400">Avg Confidence</div>
            </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-purple-500/20">
                  <TrendingUp className="w-4 h-4 text-purple-400" />
        </div>
                  <div>
                  <div className="text-xl font-bold text-white leading-none">{highConfidence}</div>
                  <div className="text-xs text-slate-400">High Confidence</div>
                      </div>
                      </div>
                        </div>
                      )}
        </div>

        {/* ── Loading skeletons ── */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
                        </div>
                      )}

        {/* ── Empty state ── */}
        {!loading && tips.length === 0 && (
          <div className="rounded-2xl border border-slate-700/50 bg-slate-800/60 backdrop-blur-sm p-16 text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-700/60 mx-auto mb-4">
              <Target className="w-8 h-8 text-slate-400" />
                    </div>
            <h3 className="text-lg font-semibold text-white mb-2">No predictions yet</h3>
            <p className="text-slate-400 text-sm max-w-sm mx-auto">
              You haven&apos;t purchased or claimed any predictions yet. Start by claiming tips with credits
              or purchasing premium predictions!
            </p>
                  </div>
        )}

        {/* ── Upcoming section ── */}
        {!loading && upcomingTips.length > 0 && (
          <section className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-xl font-bold text-white">Upcoming Matches</h2>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                {upcomingTips.length}
                        </Badge>
                      </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {upcomingTips.map((tip) => (
                <UpcomingMatchCard key={tip.id} tip={tip} onView={handleViewPrediction} />
              ))}
                      </div>
          </section>
        )}

        {/* ── Completed section ── */}
        {!loading && completedTips.length > 0 && (
          <section className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-slate-500" />
              <h2 className="text-xl font-bold text-white">Completed Matches</h2>
              <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30 text-xs">
                {completedTips.length}
                        </Badge>
                      </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {completedTips.map((tip) => (
                <CompletedMatchCard key={tip.id} tip={tip} onView={handleViewPrediction} />
              ))}
                      </div>
          </section>
        )}
                    </div>

      {/* ── Detail Modal ── */}
      {selectedTip && (
        <Dialog open={showPrediction} onOpenChange={setShowPrediction}>
          <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto bg-slate-900 border-slate-700">
            <div className="space-y-6 pt-2">
              {/* Modal header */}
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Prediction Details</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPrediction(false)}
                  className="border-slate-600 text-slate-300 hover:bg-slate-800"
                >
                  Close
                </Button>
                  </div>

              {/* Hero card */}
              <Card className="bg-gradient-to-r from-emerald-800/30 to-blue-800/30 border-emerald-500/30 p-6">
                <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                  <div className="flex-1 space-y-2">
                    <h3 className="text-2xl font-bold text-white">
                      {selectedTip.homeTeam} <span className="text-slate-400 font-normal text-xl">vs</span> {selectedTip.awayTeam}
                      </h3>
                    <div className="flex flex-wrap items-center gap-4 text-slate-400 text-sm">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {selectedTip.matchDate
                          ? new Date(selectedTip.matchDate).toLocaleDateString("en-US", {
                              weekday: "short", month: "short", day: "numeric",
                              hour: "2-digit", minute: "2-digit",
                            })
                          : "TBD"}
                      </span>
                        {selectedTip.league && (
                        <span className="flex items-center gap-1">
                          <Trophy className="w-4 h-4" />
                            {selectedTip.league}
                        </span>
                        )}
                        {selectedTip.venue && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                            {selectedTip.venue}
                        </span>
                        )}
                      </div>
                    </div>
                  <div className="text-center lg:text-right space-y-2">
                    <p className="text-slate-400 text-xs uppercase tracking-wider">Our Prediction</p>
                    {selectedTip.predictionData?.predictions?.recommended_bet ? (
                      <>
                        <p className="text-3xl font-bold text-emerald-400">
                          {selectedTip.predictionData.predictions.recommended_bet
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (c) => c.toUpperCase())}
                        </p>
                        {selectedTip.predictionData.predictions.confidence && (
                          <p className="text-slate-300 text-sm">
                            Confidence:{" "}
                            <span className="text-emerald-400 font-bold text-xl">
                              {(selectedTip.predictionData.predictions.confidence * 100).toFixed(1)}%
                                </span>
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-slate-400">—</p>
                    )}
                  </div>
                </div>
              </Card>

              {/* Match info grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-slate-800 border-slate-700 p-5">
                  <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-400" /> Match Information
                  </h4>
                  <InfoRow label="Home Team" value={selectedTip.homeTeam} />
                  <InfoRow label="Away Team" value={selectedTip.awayTeam} />
                  <InfoRow label="Date" value={selectedTip.matchDate ? new Date(selectedTip.matchDate).toLocaleDateString() : "TBD"} />
                  {selectedTip.venue && <InfoRow label="Venue" value={selectedTip.venue} />}
                  {selectedTip.league && <InfoRow label="League" value={selectedTip.league} />}
                </Card>
                <Card className="bg-slate-800 border-slate-700 p-5">
                  <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                    <Target className="w-4 h-4 text-emerald-400" /> Prediction Details
                  </h4>
                  <InfoRow
                    label="Prediction"
                    value={
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                        {selectedTip.predictionType ?? "N/A"}
                      </Badge>
                    }
                  />
                  <InfoRow
                    label="Confidence"
                    value={selectedTip.confidenceScore ? `${selectedTip.confidenceScore.toFixed(1)}%` : "N/A"}
                  />
                  <InfoRow
                    label="Type"
                    value={
                      <Badge className={selectedTip.tipType === "credit_claim"
                        ? "bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs"
                        : "bg-green-500/20 text-green-400 border-green-500/30 text-xs"}>
                        {selectedTip.tipType === "credit_claim" ? "Credit Claim" : "Purchase"}
                      </Badge>
                    }
                  />
                  <InfoRow label="Purchase Date" value={new Date(selectedTip.purchaseDate).toLocaleDateString()} />
                </Card>
              </div>

              {/* AI Analysis */}
              {selectedTip.predictionData?.analysis?.ai_summary && (
                <Card className="bg-slate-800 border-slate-700 p-5">
                  <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-purple-400" /> AI Analysis Summary
                  </h4>
                  <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
                    <p className="text-slate-300 leading-relaxed whitespace-pre-line text-sm">
                      {selectedTip.predictionData.analysis.ai_summary}
                    </p>
                  </div>
                </Card>
              )}

              {/* Team Analysis */}
              {selectedTip.predictionData?.analysis?.team_analysis && (
                <Card className="bg-slate-800 border-slate-700 p-5">
                  <h4 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-blue-400" /> Team Analysis
                        </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <TeamAnalysisSection
                      team={selectedTip.predictionData.analysis.team_analysis.home_team}
                      label={selectedTip.homeTeam}
                      dotColor="bg-blue-500"
                    />
                    <TeamAnalysisSection
                      team={selectedTip.predictionData.analysis.team_analysis.away_team}
                      label={selectedTip.awayTeam}
                      dotColor="bg-red-500"
                    />
                  </div>
                </Card>
              )}

              {/* Prediction Analysis */}
              {selectedTip.predictionData?.analysis?.prediction_analysis && (
                <Card className="bg-slate-800 border-slate-700 p-5">
                  <h4 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                    <Target className="w-4 h-4 text-yellow-400" /> Prediction Analysis
                        </h4>
                        <div className="space-y-3">
                    {selectedTip.predictionData.analysis.prediction_analysis.model_assessment && (
                      <AnalysisBlock label="Model Assessment" value={selectedTip.predictionData.analysis.prediction_analysis.model_assessment} color="text-yellow-400" />
                    )}
                    {selectedTip.predictionData.analysis.prediction_analysis.value_assessment && (
                      <AnalysisBlock label="Value Assessment" value={selectedTip.predictionData.analysis.prediction_analysis.value_assessment} color="text-blue-400" />
                    )}
                    {selectedTip.predictionData.analysis.prediction_analysis.confidence_factors && (
                      <BulletList label="Confidence Factors" items={selectedTip.predictionData.analysis.prediction_analysis.confidence_factors} bulletColor="text-green-400" />
                    )}
                    {selectedTip.predictionData.analysis.prediction_analysis.risk_factors && (
                      <BulletList label="Risk Factors" items={selectedTip.predictionData.analysis.prediction_analysis.risk_factors} bulletColor="text-red-400" />
                  )}
                </div>
              </Card>
              )}

              {/* Betting Recommendations */}
              {selectedTip.predictionData?.analysis?.betting_recommendations && (
                <Card className="bg-slate-800 border-slate-700 p-5">
                  <h4 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-400" /> Betting Recommendations
                  </h4>
                  <div className="space-y-3">
                    {selectedTip.predictionData.analysis.betting_recommendations.primary_bet && (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                        <p className="text-xs text-emerald-400 font-semibold mb-1">Primary Recommendation</p>
                        <p className="text-slate-200 text-sm">{selectedTip.predictionData.analysis.betting_recommendations.primary_bet}</p>
                          </div>
                    )}
                    <div className="flex flex-wrap gap-3">
                      {selectedTip.predictionData.analysis.betting_recommendations.risk_level && (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-xs">Risk:</span>
                          <Badge className={riskBadgeClass(selectedTip.predictionData.analysis.betting_recommendations.risk_level)}>
                            {selectedTip.predictionData.analysis.betting_recommendations.risk_level}
                        </Badge>
                        </div>
                    )}
                      {selectedTip.predictionData.analysis.betting_recommendations.suggested_stake && (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-xs">Stake:</span>
                          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                            {selectedTip.predictionData.analysis.betting_recommendations.suggested_stake}
                        </Badge>
                        </div>
                    )}
                                </div>
                    {selectedTip.predictionData.analysis.betting_recommendations.alternative_bets && (
                      <BulletList label="Alternative Options" items={selectedTip.predictionData.analysis.betting_recommendations.alternative_bets} bulletColor="text-blue-400" />
                    )}
                  </div>
                </Card>
              )}

              {/* Additional Markets */}
              {selectedTip.predictionData?.additional_markets_v2 && (
                <Card className="bg-slate-800 border-slate-700 p-5">
                  <h4 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-purple-400" /> Advanced Markets Analysis
                  </h4>
                  <AdvancedMarkets data={selectedTip.predictionData.additional_markets_v2} tip={selectedTip} />
                </Card>
              )}

              {/* Model Info */}
              {selectedTip.predictionData?.model_info && (
                <Card className="bg-slate-800 border-slate-700 p-5">
                  <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-purple-400" /> Model Information
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <InfoRow label="Type" value={selectedTip.predictionData.model_info.type ?? "—"} />
                    <InfoRow label="Version" value={selectedTip.predictionData.model_info.version ?? "—"} />
                    <InfoRow label="Performance" value={selectedTip.predictionData.model_info.performance ?? "—"} />
                    <InfoRow label="Quality Score" value={selectedTip.predictionData.model_info.quality_score != null
                      ? `${(selectedTip.predictionData.model_info.quality_score * 100).toFixed(1)}%` : "N/A"} />
                    <InfoRow label="Bookmakers" value={String(selectedTip.predictionData.model_info.bookmaker_count ?? "—")} />
                    <InfoRow label="Data Sources" value={selectedTip.predictionData.model_info.data_sources?.join(", ") ?? "—"} />
                            </div>
                </Card>
              )}

              {/* Data Freshness */}
              {selectedTip.predictionData?.data_freshness && (
                <Card className="bg-slate-800 border-slate-700 p-5">
                  <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-400" /> Data Freshness
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <StatBlock value={selectedTip.predictionData.data_freshness.h2h_matches} label="H2H Matches" color="text-blue-400" />
                    <StatBlock value={selectedTip.predictionData.data_freshness.form_matches} label="Form Matches" color="text-green-400" />
                    <StatBlock value={selectedTip.predictionData.data_freshness.home_injuries} label="Home Injuries" color="text-orange-400" />
                    <StatBlock value={selectedTip.predictionData.data_freshness.away_injuries} label="Away Injuries" color="text-red-400" />
                            </div>
                  {selectedTip.predictionData.data_freshness.collection_time && (
                    <p className="text-slate-400 text-xs mt-3 pt-3 border-t border-slate-700">
                      Last Updated: {new Date(selectedTip.predictionData.data_freshness.collection_time).toLocaleString()}
                    </p>
                  )}
                </Card>
              )}

              {/* Disclaimer */}
              <p className="text-center text-xs text-slate-500 bg-slate-800/50 py-3 rounded-xl">
                Predictions are estimates, not guarantees. Gamble responsibly 18+.
              </p>
                              </div>
          </DialogContent>
        </Dialog>
      )}
                                    </div>
  )
}

// ─── Micro-components ─────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-slate-700/50 last:border-0">
      <span className="text-slate-400 text-sm">{label}</span>
      <span className="text-white text-sm font-medium">{value}</span>
                              </div>
  )
}

function AnalysisBlock({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600">
      <p className={`${color} text-xs font-semibold mb-1`}>{label}</p>
      <p className="text-slate-300 text-sm">{value}</p>
                            </div>
  )
}

function BulletList({ label, items, bulletColor }: { label: string; items: string[]; bulletColor: string }) {
  return (
    <div>
      <p className={`${bulletColor} text-xs font-semibold mb-1`}>{label}</p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
            <span className={`${bulletColor} mt-0.5`}>•</span>
            {item}
          </li>
        ))}
      </ul>
                        </div>
  )
}

function StatBlock({ value, label, color }: { value: number | undefined; label: string; color: string }) {
  return (
    <div>
      <p className={`text-2xl font-bold ${color}`}>{value ?? "—"}</p>
      <p className="text-slate-400 text-xs">{label}</p>
                          </div>
  )
}

function TeamAnalysisSection({
  team,
  label,
  dotColor,
}: {
  team: TeamAnalysis | undefined
  label: string
  dotColor: string
}) {
  if (!team) return null
                                  return (
    <div className="space-y-3">
      <h5 className="text-sm font-medium text-white flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
        {label}
      </h5>
      {team.strengths && <BulletList label="Strengths" items={team.strengths} bulletColor="text-green-400" />}
      {team.weaknesses && <BulletList label="Weaknesses" items={team.weaknesses} bulletColor="text-red-400" />}
      {team.form_assessment && <AnalysisBlock label="Form Assessment" value={team.form_assessment} color="text-blue-400" />}
      {team.injury_impact && <AnalysisBlock label="Injury Impact" value={team.injury_impact} color="text-orange-400" />}
                                      </div>
  )
}

function AdvancedMarkets({ data, tip }: { data: AdditionalMarketsV2; tip: Tip }) {
                                  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {data.totals && (
        <MarketCard title="Total Goals Markets" dotColor="bg-blue-500">
          <div className="grid grid-cols-2 gap-3 text-xs">
            {Object.entries(data.totals).map(([key, val]) => (
              <div key={key}>
                <p className="text-slate-400 font-medium mb-1">{key.replace("_", ".").toUpperCase()}</p>
                <div className="flex justify-between">
                  <span className="text-slate-300">Over:</span>
                  <span className="text-green-400 font-medium">{(val.over * 100).toFixed(1)}%</span>
                                      </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">Under:</span>
                  <span className="text-red-400 font-medium">{(val.under * 100).toFixed(1)}%</span>
                                    </div>
                            </div>
                          ))}
                        </div>
        </MarketCard>
      )}
      {data.btts && (
        <MarketCard title="Both Teams to Score" dotColor="bg-yellow-500">
          <div className="flex gap-8">
                          <div className="text-center">
              <p className="text-slate-400 text-xs">Yes</p>
              <p className="text-green-400 font-bold text-lg">{(data.btts.yes * 100).toFixed(1)}%</p>
                          </div>
                          <div className="text-center">
              <p className="text-slate-400 text-xs">No</p>
              <p className="text-red-400 font-bold text-lg">{(data.btts.no * 100).toFixed(1)}%</p>
                            </div>
                          </div>
        </MarketCard>
      )}
      {data.double_chance && (
        <MarketCard title="Double Chance" dotColor="bg-purple-500">
          <div className="space-y-1.5 text-sm">
            {Object.entries(data.double_chance).map(([key, val]) => (
              <div key={key} className="flex justify-between">
                <span className="text-slate-300">{key === "1X" ? "Home or Draw" : key === "12" ? "Home or Away" : "Draw or Away"}</span>
                <span className="text-white font-medium">{(val * 100).toFixed(1)}%</span>
                          </div>
            ))}
                          </div>
        </MarketCard>
      )}
      {data.dnb && (
        <MarketCard title="Draw No Bet" dotColor="bg-orange-500">
          <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
              <span className="text-slate-300">{tip.homeTeam}</span>
              <span className="text-green-400 font-medium">{(data.dnb.home * 100).toFixed(1)}%</span>
                    </div>
                      <div className="flex justify-between">
              <span className="text-slate-300">{tip.awayTeam}</span>
              <span className="text-red-400 font-medium">{(data.dnb.away * 100).toFixed(1)}%</span>
                  </div>
                    </div>
        </MarketCard>
      )}
      {data.clean_sheet && (
        <MarketCard title="Clean Sheet Probability" dotColor="bg-emerald-500">
          <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
              <span className="text-slate-300">{tip.homeTeam}</span>
              <span className="text-green-400 font-medium">{(data.clean_sheet.home * 100).toFixed(1)}%</span>
                    </div>
                      <div className="flex justify-between">
              <span className="text-slate-300">{tip.awayTeam}</span>
              <span className="text-red-400 font-medium">{(data.clean_sheet.away * 100).toFixed(1)}%</span>
                    </div>
                    </div>
        </MarketCard>
      )}
      {data.correct_scores && (
        <MarketCard title="Most Likely Scores" dotColor="bg-indigo-500">
          <div className="space-y-1 text-xs">
            {data.correct_scores.slice(0, 6).map((s, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-slate-300">{s.score}</span>
                <span className="text-white font-medium">{(s.p * 100).toFixed(1)}%</span>
                    </div>
            ))}
                </div>
        </MarketCard>
      )}
      {data.odd_even_total && (
        <MarketCard title="Odd/Even Total Goals" dotColor="bg-teal-500">
          <div className="flex gap-8">
                    <div className="text-center">
              <p className="text-slate-400 text-xs">Odd</p>
              <p className="text-blue-400 font-bold text-lg">{(data.odd_even_total.odd * 100).toFixed(1)}%</p>
                  </div>
                    <div className="text-center">
              <p className="text-slate-400 text-xs">Even</p>
              <p className="text-purple-400 font-bold text-lg">{(data.odd_even_total.even * 100).toFixed(1)}%</p>
                  </div>
                  </div>
        </MarketCard>
      )}
      {data.winning_margin && (
        <MarketCard title="Winning Margin" dotColor="bg-pink-500">
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            {Object.entries(data.winning_margin).map(([key, val]) => (
              <div key={key} className="flex justify-between">
                <span className="text-slate-300">{key === "-3+" ? "Home 3+" : key === "+3+" ? "Away 3+" : key}</span>
                <span className="text-white font-medium">{(val * 100).toFixed(1)}%</span>
              </div>
            ))}
            </div>
        </MarketCard>
      )}
    </div>
  )
} 

function MarketCard({ title, dotColor, children }: { title: string; dotColor: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600">
      <h5 className="text-white text-sm font-medium mb-3 flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        {title}
      </h5>
      {children}
    </div>
  )
}

function riskBadgeClass(level: string): string {
  switch (level.toLowerCase()) {
    case "low": return "bg-green-500/20 text-green-400 border-green-500/30 text-xs"
    case "medium": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs"
    default: return "bg-red-500/20 text-red-400 border-red-500/30 text-xs"
  }
}
