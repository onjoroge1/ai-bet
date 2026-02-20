"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Loader2, Calendar, Trophy, Target, TrendingUp, Shield,
  ArrowLeft, CheckCircle, Brain, Star, Zap, Unlock, Lock,
  Sparkles, ChevronRight, Eye, Activity, MapPin, Info, AlertTriangle, BarChart3,
  Plus, Check, DollarSign, Clock
} from "lucide-react"
import ConsensusRow from "./ConsensusRow"
import BookmakerOdds from "./BookmakerOdds"
import { QuickPurchaseModal } from "@/components/quick-purchase-modal"
import { PredictionCard } from "@/components/predictions/PredictionCard"
import { useLiveMatchWebSocket, mergeDeltaUpdate } from "@/hooks/use-live-match-websocket"
import { LiveScoreCard } from "@/components/live/LiveScoreCard"
import { MomentumIndicator } from "@/components/live/MomentumIndicator"
import { LiveMarketsCard } from "@/components/live/LiveMarketsCard"
import { LiveMatchStats } from "@/components/live/LiveMatchStats"
import { LiveAIAnalysis } from "@/components/live/LiveAIAnalysis"
import { ConnectionStatusIndicator } from "@/components/live/ConnectionStatusIndicator"
import { generateMatchSlug, isNumericSlug } from "@/lib/match-slug"
import { RealtimeAdvancedMarkets } from "@/components/live/RealtimeAdvancedMarkets"
import { FinishedMatchStats } from "@/components/match/FinishedMatchStats"
import { BettingIntelligence } from "@/components/match/BettingIntelligence"
import { edgeEV } from "@/lib/odds"
import { BetSlip } from "./BetSlip"
import type { BetSlipItem } from "./BetSlip"
import type { EnhancedMatchData } from "@/types/live-match"
import { ConfidenceRing, getConfidenceColor, formatPrediction, SkeletonCard } from "@/components/match/shared"

type MatchData = EnhancedMatchData

/* ═══════════════════════════════════════════════════════════════════════════
   HELPER COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

/* ConfidenceRing imported from @/components/match/shared */

/** Skeleton loader for page sections */
function SectionSkeleton() {
  return (
    <Card className="bg-slate-800/60 border-slate-700 animate-pulse">
      <div className="p-6 space-y-4">
        <div className="h-5 bg-slate-700 rounded w-1/3" />
        <div className="h-4 bg-slate-700/60 rounded w-full" />
        <div className="h-4 bg-slate-700/60 rounded w-3/4" />
        <div className="h-4 bg-slate-700/60 rounded w-1/2" />
      </div>
    </Card>
  )
}

/**
 * UrgencyCountdown — Displays a live countdown to kickoff for upcoming matches.
 * Updates every second. Shows hours, minutes, seconds when < 24 h away,
 * or days + hours when further out.
 */
function UrgencyCountdown({ kickoffAt }: { kickoffAt: string }) {
  const [remaining, setRemaining] = useState<string | null>(null)
  const [urgencyLevel, setUrgencyLevel] = useState<"high" | "medium" | "low">("low")

  useEffect(() => {
    function tick() {
      const now = Date.now()
      const kickoff = new Date(kickoffAt).getTime()
      const diff = kickoff - now
      if (diff <= 0) {
        setRemaining(null)
        return
      }

      const days = Math.floor(diff / 86_400_000)
      const hours = Math.floor((diff % 86_400_000) / 3_600_000)
      const minutes = Math.floor((diff % 3_600_000) / 60_000)
      const seconds = Math.floor((diff % 60_000) / 1_000)

      if (days > 0) {
        setRemaining(`${days}d ${hours}h ${minutes}m`)
        setUrgencyLevel("low")
      } else if (hours > 0) {
        setRemaining(`${hours}h ${minutes}m ${seconds}s`)
        setUrgencyLevel(hours <= 2 ? "high" : "medium")
      } else {
        setRemaining(`${minutes}m ${seconds}s`)
        setUrgencyLevel("high")
      }
    }
    tick()
    const id = setInterval(tick, 1_000)
    return () => clearInterval(id)
  }, [kickoffAt])

  if (!remaining) return null

  const colorMap = {
    high: "from-red-500/20 to-orange-500/10 border-red-500/30 text-red-400",
    medium: "from-amber-500/15 to-yellow-500/10 border-amber-500/25 text-amber-400",
    low: "from-blue-500/10 to-slate-800/60 border-blue-500/20 text-blue-400",
  }

  const pulseClass = urgencyLevel === "high" ? "animate-pulse" : ""

  return (
    <div className={`flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border bg-gradient-to-r ${colorMap[urgencyLevel]} ${pulseClass}`}>
      <Clock className="h-4 w-4 shrink-0" />
      <span className="text-sm font-semibold">
        Kickoff in <span className="tabular-nums">{remaining}</span>
      </span>
      <span className="text-xs opacity-70">— Get your prediction now</span>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   PREMIUM OBFUSCATION COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * PremiumBlur — wraps a value and blurs it when locked.
 * Shows a shimmer lock icon on hover. Clicking triggers the purchase flow.
 */
function PremiumBlur({
  children,
  locked,
  onUnlock,
  inline = false,
}: {
  children: React.ReactNode
  locked: boolean
  onUnlock?: () => void
  /** If true, renders as inline-flex instead of block */
  inline?: boolean
}) {
  if (!locked) return <>{children}</>
  return (
    <button
      type="button"
      onClick={onUnlock}
      className={`${inline ? "inline-flex" : "flex"} items-center gap-1 group relative cursor-pointer`}
      title="Unlock with purchase"
    >
      <span className="blur-[6px] select-none pointer-events-none">
        {children}
      </span>
      <Lock className="h-3 w-3 text-amber-400 opacity-70 group-hover:opacity-100 transition-opacity absolute right-0 top-0" />
    </button>
  )
}

/**
 * PremiumSection — wraps an entire card/section and overlays a lock when locked.
 * Shows a teaser peek (blurred background) with an unlock CTA.
 */
function PremiumSection({
  children,
  locked,
  onUnlock,
  title,
  price,
}: {
  children: React.ReactNode
  locked: boolean
  onUnlock?: () => void
  title?: string
  price?: string
}) {
  if (!locked) return <>{children}</>
  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Blurred content as teaser */}
      <div className="blur-[5px] pointer-events-none select-none opacity-60">
        {children}
      </div>
      {/* Lock overlay */}
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-10 rounded-xl">
        <div className="p-3 bg-amber-500/20 rounded-full">
          <Lock className="h-6 w-6 text-amber-400" />
        </div>
        {title && (
          <p className="text-white font-semibold text-sm text-center px-4">
            {title}
          </p>
        )}
        <Button
          onClick={onUnlock}
          className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-semibold px-6 py-2 text-sm shadow-lg shadow-amber-500/20 gap-2"
          size="sm"
        >
          <Unlock className="h-4 w-4" />
          Unlock Analysis{price ? ` — ${price}` : ""}
        </Button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   INTERFACES
   ═══════════════════════════════════════════════════════════════════════════ */

interface QuickPurchaseInfo {
  id: string
  name: string
  price: number
  originalPrice?: number
  description: string | null
  confidenceScore: number | null
  predictionType: string | null
  valueRating: string | null
  analysisSummary: string | null
  predictionData?: FullPrediction | null
  country: {
    currencyCode: string
    currencySymbol: string
  }
}

interface PurchaseStatus {
  isPurchased: boolean
  isAuthenticated: boolean
  quickPurchaseId: string | null
  purchaseDate: string | null
}

interface FullPrediction {
  predictions?: {
    recommended_bet?: string
    confidence?: number
    draw?: number
    away_win?: number
    home_win?: number
    recommendation_tone?: string
    final_decision?: {
      selected_model?: string
      prediction_source?: string
      reason?: string
      strategy?: string
      data_quality?: string
    }
    models?: Array<{
      id?: string
      name?: string
      type?: string
      version?: string
      confidence?: number
      status?: string
      predictions?: {
        draw?: number
        away_win?: number
        home_win?: number
      }
      recommended_bet?: string
      quality_metrics?: {
        value?: number
        metric?: string
        sample_size?: number
      }
      agreement?: {
        agrees_with_v1?: boolean
        confidence_delta?: number
      }
    }>
  }
  analysis?: {
    ai_summary?: string
    explanation?: string
    risk_assessment?: string
    confidence_factors?: string[]
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
      alternative_bets?: string[]
      risk_level?: string
      suggested_stake?: string
      avoid_bets?: string[]
    }
  }
  additional_markets?: Record<string, unknown>
  additional_markets_v2?: Record<string, unknown>
  model_info?: {
    type?: string
    version?: string
    performance?: string
    data_quality?: string
    data_sources?: string[]
    quality_score?: number
    bookmaker_count?: number
    prediction_source?: string
  }
  data_freshness?: {
    h2h_matches?: number
    form_matches?: number
    away_injuries?: number
    home_injuries?: number
    collection_time?: string
  }
  comprehensive_analysis?: Record<string, unknown>
}

interface TeamAnalysis {
  strengths?: string[]
  weaknesses?: string[]
  form_assessment?: string
  injury_impact?: string
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * MatchDetailPage — Full match analysis view.
 *
 * All analysis is shown to every visitor (premium gating removed for now).
 * The page auto-loads prediction data from the QuickPurchase record so all
 * sections render without requiring a purchase.
 */
export default function MatchDetailPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [matchId, setMatchId] = useState<string>(
    isNumericSlug(slug) ? slug : ""
  )
  const [matchData, setMatchData] = useState<MatchData | null>(null)
  const [quickPurchaseInfo, setQuickPurchaseInfo] =
    useState<QuickPurchaseInfo | null>(null)
  const [purchaseStatus, setPurchaseStatus] = useState<PurchaseStatus | null>(
    null
  )
  const [fullPrediction, setFullPrediction] = useState<FullPrediction | null>(
    null
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const [showFullAnalysis, setShowFullAnalysis] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)

  // ── Bet Slip state ─────────────────────────────────────────────
  const [betSlip, setBetSlip] = useState<BetSlipItem[]>([])
  const [betStake, setBetStake] = useState(100)

  /** Toggle a selection in/out of the bet slip */
  const toggleBetSlip = useCallback((item: BetSlipItem) => {
    setBetSlip((prev) =>
      prev.some((s) => s.id === item.id)
        ? prev.filter((s) => s.id !== item.id)
        : [...prev, item]
    )
  }, [])

  /** Check if a given id is currently in the slip */
  const isInSlip = useCallback(
    (id: string) => betSlip.some((s) => s.id === id),
    [betSlip]
  )

  /** Remove one item from the slip */
  const removeFromSlip = useCallback((id: string) => {
    setBetSlip((prev) => prev.filter((s) => s.id !== id))
  }, [])

  /** Clear the entire slip */
  const clearSlip = useCallback(() => setBetSlip([]), [])

  // ── Match status ────────────────────────────────────────────────
  /** Normalised status – the API may return lowercase or uppercase */
  const normStatus = matchData?.status?.toUpperCase() || ""

  const getMatchFinishStatus = () => {
    if (!matchData) return { isFinished: false, isLive: false }
    const explicitlyFinished =
      normStatus === "FINISHED" || matchData.final_result !== undefined
    if (explicitlyFinished) return { isFinished: true, isLive: false }
    if (matchData.kickoff_at) {
      const hours =
        (Date.now() - new Date(matchData.kickoff_at).getTime()) / 3_600_000
      if (hours > 3) return { isFinished: true, isLive: false }
    }
    const isLiveStatus =
      normStatus === "LIVE" ||
      matchData.momentum !== undefined ||
      matchData.model_markets !== undefined
    return { isFinished: false, isLive: isLiveStatus }
  }

  const { isFinished, isLive } = getMatchFinishStatus()
  const { delta, connectionStatus, clearDelta, reconnect } =
    useLiveMatchWebSocket(matchId, isLive || false)

  // ── WebSocket delta merge ───────────────────────────────────────
  useEffect(() => {
    if (delta && matchData) {
      const updated = mergeDeltaUpdate(matchData, delta)
      setMatchData(updated)
      clearDelta()
    }
  }, [delta, matchData, clearDelta])

  // ── Auth check ──────────────────────────────────────────────────
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/session", {
          cache: "no-store",
          credentials: "include",
        })
        const session = await res.json()
        setIsAuthenticated(!!session?.user)
      } catch {
        setIsAuthenticated(false)
      }
    }
    checkAuth()
  }, [])

  // ── Auto-load prediction data for ALL users ─────────────────────
  useEffect(() => {
    if (quickPurchaseInfo?.predictionData && !fullPrediction) {
      setFullPrediction(quickPurchaseInfo.predictionData)
      setShowFullAnalysis(true)
    }
  }, [quickPurchaseInfo?.predictionData, fullPrediction])

  // ── Fetch match details on mount ────────────────────────────────
  useEffect(() => {
    fetchMatchDetails()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  const fetchMatchDetails = async (): Promise<void> => {
    try {
      setLoading(true)
      setError(null)

      // Check server session
      let serverIsAuthenticated = false
      try {
        const authRes = await fetch("/api/auth/session", {
          cache: "no-store",
          credentials: "include",
        })
        const session = await authRes.json()
        serverIsAuthenticated = !!session?.user
        setIsAuthenticated(serverIsAuthenticated)
      } catch {
        serverIsAuthenticated = false
      }

      // Fetch match data (API resolves slug)
      const resp = await fetch(`/api/match/${slug}?t=${Date.now()}`, {
        cache: "no-store",
        credentials: "include",
      })
      if (!resp.ok) throw new Error("Failed to fetch match details")
      const json = await resp.json()

      setMatchData(json.match)
      setQuickPurchaseInfo(json.quickPurchase)

      // Resolve numeric matchId
      const resolvedMatchId: string =
        json.match?.match_id?.toString() ??
        json.match?.id?.toString() ??
        (isNumericSlug(slug) ? slug : "")
      setMatchId(resolvedMatchId)

      // Redirect numeric → SEO slug
      if (
        isNumericSlug(slug) &&
        json.match?.home?.name &&
        json.match?.away?.name
      ) {
        const h = json.match.home.name
        const a = json.match.away.name
        if (
          h !== "Home Team" &&
          a !== "Away Team" &&
          h !== "TBD" &&
          a !== "TBD"
        ) {
          const seoSlug = generateMatchSlug(h, a)
          if (seoSlug && seoSlug !== slug) {
            router.replace(`/match/${seoSlug}`, { scroll: false })
          }
        }
      }

      // Dynamic page title — only override when the server-rendered title
      // can't know the current state (LIVE status / real-time scores).
      // For UPCOMING and FINISHED matches, generateMetadata in layout.tsx
      // already produces the correct <title>.
      if (json.match?.home?.name && json.match?.away?.name) {
        const h = json.match.home.name
        const a = json.match.away.name
        const isLiveNow = json.match.status?.toUpperCase() === "LIVE"
        const score =
          json.match.live_data?.current_score ||
          json.match.score ||
          json.match.final_result?.score

        if (isLiveNow && score?.home !== undefined && score?.away !== undefined) {
          document.title = `${h} ${score.home}-${score.away} ${a} (LIVE) | SnapBet AI`
        } else if (isLiveNow) {
          document.title = `${h} vs ${a} (LIVE) | SnapBet AI`
        }
        // For non-live states we intentionally leave document.title as-is
        // so the server-rendered <title> from generateMetadata() is preserved.
      }

      // Purchase status
      const purchasePromise = (async () => {
        if (!serverIsAuthenticated || !resolvedMatchId) {
          setPurchaseStatus({
            isPurchased: false,
            isAuthenticated: false,
            quickPurchaseId: null,
            purchaseDate: null,
          })
          return
        }
        const pResp = await fetch(
          `/api/match/${resolvedMatchId}/purchase-status`,
          { cache: "no-store", credentials: "include" }
        )
        if (!pResp.ok) return
        const purchaseResult = await pResp.json()
        setPurchaseStatus(purchaseResult)
        if (purchaseResult.isPurchased) {
          setShowFullAnalysis(true)
          fetchFullPrediction()
        }
      })()

      await purchasePromise

      // Warm-up
      if (resolvedMatchId) {
        try {
          fetch("/api/predictions/warm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ match_id: Number(resolvedMatchId) }),
            keepalive: true,
          }).catch(() => {})
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      console.error("Error fetching match details:", err)
      setError(
        err instanceof Error ? err.message : "Failed to load match details"
      )
    } finally {
      setLoading(false)
    }
  }

  const fetchFullPrediction = async () => {
    try {
      if (quickPurchaseInfo?.predictionData) {
        setFullPrediction(quickPurchaseInfo.predictionData)
        return
      }
      if (purchaseStatus?.isPurchased && purchaseStatus?.quickPurchaseId) {
        try {
          const res = await fetch(
            `/api/my-tips?latest=1&quickPurchaseId=${purchaseStatus.quickPurchaseId}`
          )
          if (res.ok) {
            const data = await res.json()
            if (data.tips?.[0]?.predictionData) {
              setFullPrediction(data.tips[0].predictionData)
              return
            }
          }
        } catch {
          /* continue */
        }
      }
      const numId = matchId || (isNumericSlug(slug) ? slug : "")
      if (!numId) return
      const response = await fetch("/api/predictions/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: parseInt(numId) }),
      })
      if (response.ok) {
        const data = await response.json()
        setFullPrediction(data)
      }
    } catch (err) {
      console.error("Error fetching full prediction:", err)
    }
  }

  const handlePurchaseClick = async () => {
    try {
      const res = await fetch("/api/auth/session", {
        cache: "no-store",
        credentials: "include",
      })
      const session = await res.json()
      if (!session?.user) {
        router.push(`/signin?callbackUrl=/match/${slug}`)
        return
      }
      setIsAuthenticated(true)
    } catch {
      router.push(`/signin?callbackUrl=/match/${slug}`)
      return
    }
    if (!quickPurchaseInfo) {
      setError("Purchase information not available")
      return
    }
    setShowPurchaseModal(true)
  }

  // ── Purchase-modal lifecycle ────────────────────────────────────
  const [modalWasOpen, setModalWasOpen] = useState(false)

  useEffect(() => {
    if (showPurchaseModal) {
      setModalWasOpen(true)
    } else if (modalWasOpen && !showPurchaseModal) {
      const timer = setTimeout(async () => {
        try {
          const res = await fetch("/api/auth/session", {
            cache: "no-store",
            credentials: "include",
          })
          const session = await res.json()
          setIsAuthenticated(!!session?.user)
        } catch {
          /* ignore */
        }
        fetchMatchDetails().then(() => {
          setModalWasOpen(false)
        })
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [showPurchaseModal, modalWasOpen])

  // ── Derived prediction (needed by useMemo below, safe even when matchData is null) ──
  const prediction = fullPrediction || quickPurchaseInfo?.predictionData || null

  // ── Value Picks — scan all markets for +EV opportunities ──────
  const valuePicks = useMemo(() => {
    if (!matchData) return []

    type ValuePick = BetSlipItem & {
      edge: number
      confidence: "high" | "medium" | "low"
      source: "bookmaker" | "model"
      category: string
    }

    const picks: ValuePick[] = []
    const books = matchData.odds?.books as
      | Record<string, Record<string, number>>
      | undefined
    const novig = matchData.odds?.novig_current
    const mkts = (prediction?.additional_markets_v2 || {}) as Record<
      string,
      unknown
    >
    const homeName = matchData.home.name
    const awayName = matchData.away.name

    // ── 1X2 with real bookmaker odds ────────────────────────────
    if (novig && books) {
      const sides = ["home", "draw", "away"] as const
      sides.forEach((side) => {
        const prob: number = novig[side]
        if (prob <= 0) return
        // Find the best odds and which bookmaker offers them
        let bestOdds = 0
        let bestBook = ""
        Object.entries(books).forEach(([bookName, bookOdds]) => {
          const sideOdds = (bookOdds as Record<string, number>)[side] || 0
          if (sideOdds > bestOdds) {
            bestOdds = sideOdds
            bestBook = bookName
          }
        })
        if (bestOdds <= 0) return
        const ev = edgeEV(prob, bestOdds)
        const edgePct = ev * 100
        picks.push({
          id: `1x2-${side}`,
          market: "Match Result",
          selection:
            side === "home" ? homeName : side === "away" ? awayName : "Draw",
          probability: prob,
          decimalOdds: bestOdds,
          edge: edgePct,
          confidence: edgePct > 5 ? "high" : edgePct > 0 ? "medium" : "low",
          source: "bookmaker",
          category: "1X2",
          bestBookmaker: bestBook,
        })
      })
    }

    // ── BTTS ────────────────────────────────────────────────────
    if (mkts.btts) {
      const btts = mkts.btts as { yes: number; no: number }
      ;(["yes", "no"] as const).forEach((sel) => {
        const prob = btts[sel]
        if (!prob || prob <= 0) return
        picks.push({
          id: `btts-${sel}`,
          market: "Both Teams to Score",
          selection: sel === "yes" ? "BTTS Yes" : "BTTS No",
          probability: prob,
          decimalOdds: +(1 / prob).toFixed(2),
          edge: 0,
          confidence: prob > 0.6 ? "high" : prob > 0.45 ? "medium" : "low",
          source: "model",
          category: "BTTS",
        })
      })
    }

    // ── Totals ──────────────────────────────────────────────────
    if (mkts.totals) {
      const totals = mkts.totals as Record<
        string,
        { over: number; under: number }
      >
      Object.entries(totals).forEach(([line, vals]) => {
        const label = line.replace("_", ".")
        if (vals.over > 0) {
          picks.push({
            id: `total-over-${line}`,
            market: "Total Goals",
            selection: `Over ${label}`,
            probability: vals.over,
            decimalOdds: +(1 / vals.over).toFixed(2),
            edge: 0,
            confidence:
              vals.over > 0.65 ? "high" : vals.over > 0.45 ? "medium" : "low",
            source: "model",
            category: "Totals",
          })
        }
        if (vals.under > 0) {
          picks.push({
            id: `total-under-${line}`,
            market: "Total Goals",
            selection: `Under ${label}`,
            probability: vals.under,
            decimalOdds: +(1 / vals.under).toFixed(2),
            edge: 0,
            confidence:
              vals.under > 0.65
                ? "high"
                : vals.under > 0.45
                  ? "medium"
                  : "low",
            source: "model",
            category: "Totals",
          })
        }
      })
    }

    // ── Double Chance ───────────────────────────────────────────
    if (mkts.double_chance) {
      const dc = mkts.double_chance as Record<string, number>
      Object.entries(dc).forEach(([key, prob]) => {
        if (!prob || prob <= 0) return
        const label =
          key === "1X"
            ? `${homeName} or Draw`
            : key === "X2"
              ? `Draw or ${awayName}`
              : `${homeName} or ${awayName}`
        picks.push({
          id: `dc-${key}`,
          market: "Double Chance",
          selection: label,
          probability: prob,
          decimalOdds: +(1 / prob).toFixed(2),
          edge: 0,
          confidence: prob > 0.75 ? "high" : prob > 0.55 ? "medium" : "low",
          source: "model",
          category: "Double Chance",
        })
      })
    }

    // ── Win to Nil ──────────────────────────────────────────────
    if (mkts.win_to_nil) {
      const wtn = mkts.win_to_nil as { home: number; away: number }
      ;(["home", "away"] as const).forEach((side) => {
        const prob = wtn[side]
        if (!prob || prob <= 0) return
        picks.push({
          id: `wtn-${side}`,
          market: "Win to Nil",
          selection: `${side === "home" ? homeName : awayName} Win to Nil`,
          probability: prob,
          decimalOdds: +(1 / prob).toFixed(2),
          edge: 0,
          confidence: prob > 0.4 ? "high" : prob > 0.2 ? "medium" : "low",
          source: "model",
          category: "Win to Nil",
        })
      })
    }

    // ── Correct Score (top 5) ───────────────────────────────────
    if (mkts.correct_scores) {
      const scores = mkts.correct_scores as Array<{
        score: string
        p: number
      }>
      scores
        .filter((s) => s.score !== "Other")
        .slice(0, 5)
        .forEach((s) => {
          picks.push({
            id: `cs-${s.score}`,
            market: "Correct Score",
            selection: s.score,
            probability: s.p,
            decimalOdds: +(1 / s.p).toFixed(2),
            edge: 0,
            confidence:
              s.p > 0.12 ? "high" : s.p > 0.08 ? "medium" : "low",
            source: "model",
            category: "Correct Score",
          })
        })
    }

    // Sort: positive edge first, then by probability
    return picks.sort((a, b) => {
      if (a.edge > 0 && b.edge <= 0) return -1
      if (b.edge > 0 && a.edge <= 0) return 1
      if (a.edge !== b.edge) return b.edge - a.edge
      return b.probability - a.probability
    })
  }, [matchData, prediction])

  // Split value picks into groups
  // 1X2 picks — always show all three so users can pick any team
  const matchResultPicks = valuePicks.filter((p) => p.category === "1X2")
  // Other picks with positive edge (non-1X2)
  const otherPositiveEdgePicks = valuePicks.filter(
    (p) => p.edge > 0 && p.category !== "1X2"
  )
  const topModelPicks = valuePicks.filter((p) => p.edge === 0).slice(0, 8)

  // ── Utility functions ───────────────────────────────────────────
  const formatKickoffTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getSideName = (side: string, match: MatchData) => {
    if (side === "home") return match.home.name
    if (side === "away") return match.away.name
    return "Draw"
  }

  const getConfidenceColor = (c: number) =>
    c >= 70 ? "text-emerald-400" : c >= 50 ? "text-yellow-400" : "text-red-400"

  const getRiskColor = (risk: string) => {
    const r = risk.toLowerCase()
    if (r === "low") return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
    if (r === "medium") return "bg-amber-500/20 text-amber-400 border-amber-500/30"
    return "bg-red-500/20 text-red-400 border-red-500/30"
  }

  /* ═══════════════════════════════════════════════════════════════════
     LOADING STATE — skeleton cards
     ═══════════════════════════════════════════════════════════════════ */
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/[0.03] rounded-full blur-3xl" />
          <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-blue-500/[0.03] rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 py-8 space-y-6">
          <div className="h-8 w-48 bg-slate-800 rounded animate-pulse" />
          <SectionSkeleton />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-slate-800/60 rounded-xl p-4 border border-slate-700 animate-pulse">
                <div className="h-14 w-14 bg-slate-700 rounded-full mx-auto mb-2" />
                <div className="h-3 bg-slate-700 rounded w-1/2 mx-auto" />
              </div>
            ))}
          </div>
          <SectionSkeleton />
          <SectionSkeleton />
        </div>
      </div>
    )
  }

  /* ═══════════════════════════════════════════════════════════════════
     ERROR / NOT FOUND STATE
     ═══════════════════════════════════════════════════════════════════ */
  if (error || !matchData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
        <Card className="bg-slate-800/60 border-slate-700 p-8 max-w-md">
          <div className="text-center">
            <div className="text-red-400 text-xl font-semibold mb-2">
              Match Not Found
            </div>
            <div className="text-slate-300 mb-6">
              {error || "The match you are looking for does not exist."}
            </div>
            <Button
              onClick={() => router.push("/")}
              variant="outline"
              className="border-slate-600"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Homepage
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  /* ═══════════════════════════════════════════════════════════════════
     DERIVED VALUES
     ═══════════════════════════════════════════════════════════════════ */
  const v1Model = matchData.models?.v1_consensus
  const v2Model = matchData.models?.v2_lightgbm
  const isPurchased = purchaseStatus?.isPurchased || false

  /** Whether premium content should be locked (not purchased AND match not finished) */
  const premiumLocked = !isPurchased && !isFinished

  /** Formatted price for unlock CTAs */
  const premiumPrice = quickPurchaseInfo
    ? `${quickPurchaseInfo.country?.currencySymbol || "$"}${quickPurchaseInfo.price.toFixed(2)}`
    : undefined

  // V2 from prediction data (always available through quickPurchase)
  const v2FromPrediction = prediction?.predictions?.models?.find(
    (m) => m.id === "v2_unified"
  )
  const v1FromPrediction = prediction?.predictions?.models?.find(
    (m) => m.id === "v1_consensus"
  )

  // Confidence score — prefer quickPurchase, fall back to model
  const confidenceScore =
    quickPurchaseInfo?.confidenceScore ??
    (v1Model ? Math.round(v1Model.confidence * 100) : 0)

  // JSON-LD structured data (SportsEvent + BreadcrumbList) is rendered
  // server-side in layout.tsx for optimal crawler discovery.

  /* ═══════════════════════════════════════════════════════════════════
     MAIN RENDER
     ═══════════════════════════════════════════════════════════════════ */
  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative">
        {/* ── Background depth effects ──────────────────────────── */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/[0.03] rounded-full blur-3xl" />
          <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-blue-500/[0.03] rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-purple-500/[0.02] rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 py-8 space-y-6">
          {/* ── Back Button ──────────────────────────────────────── */}
          <Button
            onClick={() => router.push("/")}
            variant="ghost"
            className="text-slate-300 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Homepage
          </Button>

          {/* ═══════════ HERO CARD — Match Overview ═══════════════ */}
          <Card className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 border-slate-700 overflow-hidden relative">
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl" />

            <div className="relative p-6">
              {/* Top strip: league + date + status */}
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-700">
                <div className="flex items-center gap-4 flex-wrap">
                  {matchData.league?.name && (
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-amber-500/10 rounded-lg">
                        <Trophy className="h-4 w-4 text-amber-400" />
                      </div>
                      <span className="text-slate-200 font-medium">
                        {matchData.league.name}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-blue-400" />
                    <span className="text-slate-300 text-sm">
                      {formatKickoffTime(matchData.kickoff_at)}
                    </span>
                  </div>
                </div>

                {/* Live/Finished score */}
                {(normStatus === "LIVE" || isFinished) &&
                  (() => {
                    let score = null
                    if (isFinished)
                      score =
                        matchData.final_result?.score || matchData.score
                    else if (normStatus === "LIVE")
                      score =
                        matchData.live_data?.current_score || matchData.score
                    if (
                      !score ||
                      score.home === undefined ||
                      score.away === undefined
                    )
                      return null
                    return (
                      <div className="flex flex-col gap-2">
                        <div
                          className={`flex items-center gap-2 ${normStatus === "LIVE" ? "text-emerald-400" : "text-slate-300"}`}
                        >
                          {normStatus === "LIVE" && (
                            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                          )}
                          <span className="font-bold text-lg">
                            {score.home} - {score.away}
                          </span>
                          {normStatus === "LIVE" &&
                            (matchData.live_data?.minute ||
                              matchData.momentum?.minute) && (
                              <span className="text-slate-400 text-sm">
                                {matchData.live_data?.minute ||
                                  matchData.momentum?.minute}
                                &apos;
                              </span>
                            )}
                        </div>
                        {normStatus === "LIVE" && (
                          <ConnectionStatusIndicator
                            status={connectionStatus}
                            onReconnect={reconnect}
                          />
                        )}
                      </div>
                    )
                  })()}
              </div>

              {/* ── Teams VS Layout with Odds ─────────────── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Home Team */}
                <div className="flex flex-col items-center lg:items-start">
                  <div className="flex items-center gap-3 mb-2">
                    {matchData.home?.logo_url && (
                      <img
                        src={matchData.home.logo_url}
                        alt={matchData.home.name}
                        className="w-12 h-12 object-contain"
                        onError={(e) => {
                          ;(e.target as HTMLImageElement).style.display = "none"
                        }}
                      />
                    )}
                    <h2 className="text-xl lg:text-2xl font-bold text-white text-center lg:text-left">
                      {matchData.home.name}
                    </h2>
                  </div>
                  {matchData.odds?.novig_current &&
                    matchData.odds?.books &&
                    (() => {
                      const p = matchData.odds.novig_current.home
                      const fair = (1 / p).toFixed(2)
                      const best = Math.max(
                        ...Object.values(matchData.odds.books).map(
                          (b) => b.home
                        )
                      )
                      const ev = edgeEV(p, best)
                      const c =
                        ev >= 0.02
                          ? "text-emerald-400"
                          : ev > 0
                            ? "text-blue-400"
                            : "text-slate-400"
                      return (
                        <div className="w-full mt-3 space-y-2">
                          <PremiumBlur locked={premiumLocked} onUnlock={handlePurchaseClick} inline>
                            <div className="w-full space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400 text-xs">
                                  Fair Odds
                                </span>
                                <span className="text-white font-semibold text-lg">
                                  {fair}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400 text-xs">
                                  Best Available
                                </span>
                                <span className="text-slate-300 text-sm">
                                  {best.toFixed(2)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between pt-2 border-t border-slate-700">
                                <span className="text-slate-400 text-xs">
                                  Edge %
                                </span>
                                <span className={`font-semibold text-sm ${c}`}>
                                  {ev >= 0 ? "+" : ""}
                                  {(ev * 100).toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          </PremiumBlur>
                        </div>
                      )
                    })()}
                </div>

                {/* VS Center */}
                <div className="flex flex-col items-center justify-center">
                  <div className="bg-slate-700/50 rounded-full px-4 py-2 mb-4">
                    <span className="text-slate-400 font-semibold text-sm">
                      VS
                    </span>
                  </div>
                  {normStatus === "LIVE" && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 animate-pulse mb-2">
                      LIVE
                    </Badge>
                  )}
                  {isFinished && (
                    <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/40 mb-2">
                      FINISHED
                    </Badge>
                  )}
                </div>

                {/* Away Team */}
                <div className="flex flex-col items-center lg:items-end">
                  <div className="flex items-center gap-3 mb-2 flex-row-reverse lg:flex-row">
                    <h2 className="text-xl lg:text-2xl font-bold text-white text-center lg:text-right">
                      {matchData.away.name}
                    </h2>
                    {matchData.away?.logo_url && (
                      <img
                        src={matchData.away.logo_url}
                        alt={matchData.away.name}
                        className="w-12 h-12 object-contain"
                        onError={(e) => {
                          ;(e.target as HTMLImageElement).style.display = "none"
                        }}
                      />
                    )}
                  </div>
                  {matchData.odds?.novig_current &&
                    matchData.odds?.books &&
                    (() => {
                      const p = matchData.odds.novig_current.away
                      const fair = (1 / p).toFixed(2)
                      const best = Math.max(
                        ...Object.values(matchData.odds.books).map(
                          (b) => b.away
                        )
                      )
                      const ev = edgeEV(p, best)
                      const c =
                        ev >= 0.02
                          ? "text-emerald-400"
                          : ev > 0
                            ? "text-blue-400"
                            : "text-slate-400"
                      return (
                        <div className="w-full mt-3 space-y-2 text-right lg:text-right">
                          <PremiumBlur locked={premiumLocked} onUnlock={handlePurchaseClick} inline>
                            <div className="w-full space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-white font-semibold text-lg">
                                  {fair}
                                </span>
                                <span className="text-slate-400 text-xs">
                                  Fair Odds
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-300 text-sm">
                                  {best.toFixed(2)}
                                </span>
                                <span className="text-slate-400 text-xs">
                                  Best Available
                                </span>
                              </div>
                              <div className="flex items-center justify-between pt-2 border-t border-slate-700">
                                <span className={`font-semibold text-sm ${c}`}>
                                  {ev >= 0 ? "+" : ""}
                                  {(ev * 100).toFixed(1)}%
                                </span>
                                <span className="text-slate-400 text-xs">
                                  Edge %
                                </span>
                              </div>
                            </div>
                          </PremiumBlur>
                        </div>
                      )
                    })()}
                </div>
              </div>

              {/* ── Draw Odds Row ─────────────────────────── */}
              {matchData.odds?.novig_current &&
                matchData.odds?.books &&
                (() => {
                  const dp = matchData.odds.novig_current.draw
                  const dFair = (1 / dp).toFixed(2)
                  const bestDraw = Math.max(
                    ...Object.values(matchData.odds.books).map((b) => b.draw)
                  )
                  const dEV = edgeEV(dp, bestDraw)
                  const dColor =
                    dEV >= 0.02
                      ? "text-emerald-400"
                      : dEV > 0
                        ? "text-blue-400"
                        : "text-slate-400"
                  return (
                    <div className="mt-6 pt-6 border-t border-slate-700">
                      <PremiumBlur locked={premiumLocked} onUnlock={handlePurchaseClick}>
                        <div className="flex items-center justify-center gap-6">
                          <div className="text-center">
                            <div className="text-slate-400 text-xs mb-1">
                              Draw Fair Odds
                            </div>
                            <div className="text-white font-semibold text-lg">
                              {dFair}
                            </div>
                          </div>
                          <div className="h-8 w-px bg-slate-700" />
                          <div className="text-center">
                            <div className="text-slate-400 text-xs mb-1">
                              Best Available
                            </div>
                            <div className="text-slate-300 text-base">
                              {bestDraw.toFixed(2)}
                            </div>
                          </div>
                          <div className="h-8 w-px bg-slate-700" />
                          <div className="text-center">
                            <div className="text-slate-400 text-xs mb-1">
                              Edge %
                            </div>
                            <div
                              className={`font-semibold text-base ${dColor}`}
                            >
                              {dEV >= 0 ? "+" : ""}
                              {(dEV * 100).toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      </PremiumBlur>
                    </div>
                  )
                })()}

              {/* ── Consensus Row ─────────────────────────── */}
              {matchData.odds?.books && matchData.odds?.novig_current && (
                <div className="mt-6 pt-6 border-t border-slate-700">
                  <ConsensusRow
                    novig={matchData.odds.novig_current as Record<string, number> as { home: number; draw: number; away: number }}
                    books={matchData.odds.books as Record<string, { home: number; draw: number; away: number }>}
                  />
                </div>
              )}
            </div>
          </Card>

          {/* ═══════════ URGENCY COUNTDOWN ════════════════════════ */}
          {!isFinished && !isLive && matchData.kickoff_at && (
            <UrgencyCountdown kickoffAt={matchData.kickoff_at} />
          )}

          {/* ═══════════ ABOVE-THE-FOLD PREMIUM CTA ═══════════════ */}
          {premiumLocked && !isFinished && (
            <div className="bg-gradient-to-r from-emerald-500/10 via-slate-800/60 to-blue-500/10 border border-emerald-500/20 rounded-xl overflow-hidden">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/20 rounded-lg shrink-0">
                    <Zap className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">
                      Unlock Premium Insights
                    </p>
                    <p className="text-slate-400 text-xs">
                      Fair odds, edge %, confidence scores &amp; parlay recommendations
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handlePurchaseClick}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-5 py-2 rounded-xl shadow-lg shadow-emerald-500/20 text-sm whitespace-nowrap"
                >
                  <Lock className="h-3.5 w-3.5 mr-1.5" />
                  Get Full Prediction {premiumPrice ? `— ${premiumPrice}` : ""}
                </Button>
              </div>
            </div>
          )}

          {/* ═══════════ STATS STRIP ══════════════════════════════ */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Confidence — PREMIUM */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 text-center hover:border-emerald-500/30 transition-colors relative">
              <PremiumBlur locked={premiumLocked} onUnlock={handlePurchaseClick}>
                <div className="flex justify-center mb-2">
                  <ConfidenceRing value={confidenceScore} />
                </div>
              </PremiumBlur>
              <div className="text-slate-400 text-xs font-medium">
                AI Confidence
              </div>
            </div>

            {/* Prediction — free for all */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 text-center hover:border-emerald-500/30 transition-colors">
              <div className="p-2 bg-emerald-500/10 rounded-lg w-fit mx-auto mb-2">
                <Target className="h-5 w-5 text-emerald-400" />
              </div>
              <div className="text-white font-semibold text-sm">
                {v1Model
                  ? getSideName(v1Model.pick, matchData)
                  : prediction?.predictions?.recommended_bet
                      ?.replace(/_/g, " ")
                      .replace(/\b\w/g, (l) => l.toUpperCase()) || "N/A"}
              </div>
              <div className="text-slate-400 text-xs">Prediction</div>
            </div>

            {/* Value Rating — PREMIUM */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 text-center hover:border-blue-500/30 transition-colors relative">
              <div className="p-2 bg-blue-500/10 rounded-lg w-fit mx-auto mb-2">
                <TrendingUp className="h-5 w-5 text-blue-400" />
              </div>
              <PremiumBlur locked={premiumLocked} onUnlock={handlePurchaseClick}>
                <div className="text-white font-semibold text-sm">
                  {quickPurchaseInfo?.valueRating || "N/A"}
                </div>
              </PremiumBlur>
              <div className="text-slate-400 text-xs">Value Rating</div>
            </div>

            {/* Risk Level — PREMIUM */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 text-center hover:border-amber-500/30 transition-colors relative">
              <div className="p-2 bg-amber-500/10 rounded-lg w-fit mx-auto mb-2">
                <Shield className="h-5 w-5 text-amber-400" />
              </div>
              <PremiumBlur locked={premiumLocked} onUnlock={handlePurchaseClick}>
                <div className="text-white font-semibold text-sm">
                  {prediction?.analysis?.risk_assessment ||
                    prediction?.analysis?.betting_recommendations?.risk_level ||
                    "N/A"}
                </div>
              </PremiumBlur>
              <div className="text-slate-400 text-xs">Risk Level</div>
            </div>
          </div>

          {/* ═══════════ AI SUMMARY BANNER ════════════════════════ */}
          {prediction?.analysis?.ai_summary && (
            <Card className="bg-gradient-to-br from-purple-900/20 via-slate-800/60 to-slate-900/60 border-purple-500/30 overflow-hidden relative">
              <div className="absolute -top-16 -right-16 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl" />
              <div className="relative p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Brain className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      AI Analysis Summary
                    </h3>
                    <p className="text-slate-400 text-xs">
                      Powered by BetGenius AI
                    </p>
                  </div>
                </div>
                <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-700/60">
                  <div className="text-slate-300 leading-relaxed whitespace-pre-line text-sm">
                    {prediction.analysis.ai_summary}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* ═══════════ FINISHED MATCH BANNER ════════════════════ */}
          {isFinished && (
            <Card className="bg-gradient-to-r from-emerald-900/40 to-blue-900/40 border-emerald-500/50">
              <div className="p-6">
                <div className="flex items-center justify-center gap-3">
                  <Trophy className="w-6 h-6 text-emerald-400" />
                  <div className="text-center">
                    <div className="text-white font-bold text-lg">
                      Match Finished
                    </div>
                    <div className="text-slate-300 text-sm">
                      This match has been completed
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {isFinished && (
            <FinishedMatchStats
              matchData={matchData as Record<string, unknown> as Parameters<typeof FinishedMatchStats>[0]["matchData"]}
              predictionData={prediction}
            />
          )}

          {/* ═══════════ LIVE MATCH COMPONENTS ════════════════════ */}
          {isLive && !isFinished && (
            <div className="space-y-6">
              {(() => {
                const score =
                  matchData.live_data?.current_score ||
                  matchData.score ||
                  matchData.final_result?.score || { home: 0, away: 0 }
                const minute =
                  matchData.live_data?.minute ||
                  matchData.momentum?.minute ||
                  0
                const period = matchData.live_data?.period || "Live"
                return (
                  <LiveScoreCard
                    score={score}
                    minute={minute}
                    period={period}
                    status={matchData.status}
                  />
                )
              })()}
              {matchData.momentum && (
                <MomentumIndicator
                  momentum={matchData.momentum}
                  homeTeamName={matchData.home.name}
                  awayTeamName={matchData.away.name}
                />
              )}
              {matchData.live_data?.statistics && (
                <LiveMatchStats
                  liveData={matchData.live_data}
                  homeTeamName={matchData.home.name}
                  awayTeamName={matchData.away.name}
                />
              )}
              {matchData.ai_analysis && (
                <LiveAIAnalysis aiAnalysis={matchData.ai_analysis} />
              )}
            </div>
          )}

          {/* ═══════════ MAIN GRID (Content + Sidebar) ═══════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* ── Main Column ────────────────────────────── */}
            <div className="lg:col-span-2 space-y-6">
              {/* ── Win Probability ─────────────────────── */}
              {v1Model?.probs && !isFinished && (
                <Card className="bg-slate-800/60 border-slate-700">
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <BarChart3 className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          Win Probability
                        </h3>
                        <p className="text-slate-400 text-xs">
                          AI Model V1 — Market Weighted Consensus
                        </p>
                      </div>
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/40 ml-auto">
                        V1
                      </Badge>
                    </div>

                    <div className="space-y-4">
                      {/* Home */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            {matchData.home?.logo_url && (
                              <img
                                src={matchData.home.logo_url}
                                alt=""
                                className="w-5 h-5 object-contain"
                                onError={(e) => {
                                  ;(e.target as HTMLImageElement).style.display =
                                    "none"
                                }}
                              />
                            )}
                            <span className="text-slate-300 text-sm font-medium">
                              {matchData.home.name}
                            </span>
                          </div>
                          <span
                            className={`text-sm font-semibold ${v1Model.pick === "home" ? "text-emerald-400" : "text-slate-400"}`}
                          >
                            {(v1Model.probs.home * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${v1Model.pick === "home" ? "bg-emerald-500" : "bg-slate-600"}`}
                            style={{
                              width: `${v1Model.probs.home * 100}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Draw */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-slate-300 text-sm font-medium">
                            Draw
                          </span>
                          <span
                            className={`text-sm font-semibold ${v1Model.pick === "draw" ? "text-emerald-400" : "text-slate-400"}`}
                          >
                            {(v1Model.probs.draw * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${v1Model.pick === "draw" ? "bg-emerald-500" : "bg-slate-600"}`}
                            style={{
                              width: `${v1Model.probs.draw * 100}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Away */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            {matchData.away?.logo_url && (
                              <img
                                src={matchData.away.logo_url}
                                alt=""
                                className="w-5 h-5 object-contain"
                                onError={(e) => {
                                  ;(e.target as HTMLImageElement).style.display =
                                    "none"
                                }}
                              />
                            )}
                            <span className="text-slate-300 text-sm font-medium">
                              {matchData.away.name}
                            </span>
                          </div>
                          <span
                            className={`text-sm font-semibold ${v1Model.pick === "away" ? "text-emerald-400" : "text-slate-400"}`}
                          >
                            {(v1Model.probs.away * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${v1Model.pick === "away" ? "bg-emerald-500" : "bg-slate-600"}`}
                            style={{
                              width: `${v1Model.probs.away * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Confidence bar — PREMIUM */}
                    <PremiumBlur locked={premiumLocked} onUnlock={handlePurchaseClick}>
                      <div className="mt-6 pt-4 border-t border-slate-700">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-slate-400 text-xs">
                            Model Confidence
                          </span>
                          <span
                            className={`text-sm font-bold ${getConfidenceColor(v1Model.confidence * 100)}`}
                          >
                            {Math.round(v1Model.confidence * 100)}%
                          </span>
                        </div>
                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${
                              v1Model.confidence * 100 >= 70
                                ? "bg-emerald-500"
                                : v1Model.confidence * 100 >= 50
                                  ? "bg-yellow-500"
                                  : "bg-red-500"
                            }`}
                            style={{
                              width: `${Math.min(v1Model.confidence * 100, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </PremiumBlur>
                  </div>
                </Card>
              )}

              {/* ── Model Comparison (V1 vs V2) — PREMIUM ────── */}
              {v2FromPrediction && v1FromPrediction && !isFinished && (
                <PremiumSection
                  locked={premiumLocked}
                  onUnlock={handlePurchaseClick}
                  title="Unlock Model Comparison"
                  price={premiumPrice}
                >
                  <Card className="bg-slate-800/60 border-slate-700">
                    <div className="p-6">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-amber-500/10 rounded-lg">
                          <Zap className="h-5 w-5 text-amber-400" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-white">
                            Model Comparison
                          </h3>
                          <p className="text-slate-400 text-xs">
                            V1 Consensus vs V2 Unified Context
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {/* V1 */}
                        <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-700/60">
                          <div className="flex items-center gap-2 mb-3">
                            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/40 text-xs">
                              V1
                            </Badge>
                            <span className="text-slate-400 text-xs">
                              Market Consensus
                            </span>
                          </div>
                          <div className="text-white font-bold text-lg mb-1">
                            {v1FromPrediction.recommended_bet
                              ?.replace(/_/g, " ")
                              .replace(/\b\w/g, (l) => l.toUpperCase())}
                          </div>
                          <div
                            className={`text-2xl font-bold ${getConfidenceColor((v1FromPrediction.confidence || 0) * 100)}`}
                          >
                            {((v1FromPrediction.confidence || 0) * 100).toFixed(
                              1
                            )}
                            %
                          </div>
                          <div className="text-slate-400 text-xs mt-1">
                            Confidence
                          </div>
                          {v1FromPrediction.predictions && (
                            <div className="mt-3 space-y-1 text-xs">
                              <div className="flex justify-between text-slate-400">
                                <span>Home</span>
                                <span>
                                  {(
                                    (v1FromPrediction.predictions.home_win || 0) *
                                    100
                                  ).toFixed(1)}
                                  %
                                </span>
                              </div>
                              <div className="flex justify-between text-slate-400">
                                <span>Draw</span>
                                <span>
                                  {(
                                    (v1FromPrediction.predictions.draw || 0) * 100
                                  ).toFixed(1)}
                                  %
                                </span>
                              </div>
                              <div className="flex justify-between text-slate-400">
                                <span>Away</span>
                                <span>
                                  {(
                                    (v1FromPrediction.predictions.away_win || 0) *
                                    100
                                  ).toFixed(1)}
                                  %
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* V2 */}
                        <div className="bg-slate-900/40 rounded-xl p-4 border border-amber-500/30">
                          <div className="flex items-center gap-2 mb-3">
                            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs">
                              V2
                            </Badge>
                            <span className="text-slate-400 text-xs">
                              Unified Context
                            </span>
                          </div>
                          <div className="text-white font-bold text-lg mb-1">
                            {v2FromPrediction.recommended_bet
                              ?.replace(/_/g, " ")
                              .replace(/\b\w/g, (l) => l.toUpperCase())}
                          </div>
                          <div
                            className={`text-2xl font-bold ${getConfidenceColor((v2FromPrediction.confidence || 0) * 100)}`}
                          >
                            {((v2FromPrediction.confidence || 0) * 100).toFixed(
                              1
                            )}
                            %
                          </div>
                          <div className="text-slate-400 text-xs mt-1">
                            Confidence
                          </div>
                          {v2FromPrediction.predictions && (
                            <div className="mt-3 space-y-1 text-xs">
                              <div className="flex justify-between text-slate-400">
                                <span>Home</span>
                                <span>
                                  {(
                                    (v2FromPrediction.predictions.home_win || 0) *
                                    100
                                  ).toFixed(1)}
                                  %
                                </span>
                              </div>
                              <div className="flex justify-between text-slate-400">
                                <span>Draw</span>
                                <span>
                                  {(
                                    (v2FromPrediction.predictions.draw || 0) * 100
                                  ).toFixed(1)}
                                  %
                                </span>
                              </div>
                              <div className="flex justify-between text-slate-400">
                                <span>Away</span>
                                <span>
                                  {(
                                    (v2FromPrediction.predictions.away_win || 0) *
                                    100
                                  ).toFixed(1)}
                                  %
                                </span>
                              </div>
                            </div>
                          )}
                          {v2FromPrediction.agreement?.agrees_with_v1 !==
                            undefined && (
                            <div className="mt-3 pt-2 border-t border-slate-700/60">
                              <Badge
                                className={`text-[10px] ${v2FromPrediction.agreement.agrees_with_v1 ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}`}
                              >
                                {v2FromPrediction.agreement.agrees_with_v1
                                  ? "✓ Models Agree"
                                  : "✗ Models Disagree"}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </PremiumSection>
              )}

              {/* ── Team Analysis ───────────────────────────── */}
              {prediction?.analysis?.team_analysis && (
                <Card className="bg-slate-800/60 border-slate-700">
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <Trophy className="h-5 w-5 text-blue-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-white">
                        Team Analysis
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {prediction.analysis.team_analysis.home_team && (
                        <TeamAnalysisCard
                          teamName={matchData.home.name}
                          analysis={
                            prediction.analysis.team_analysis.home_team
                          }
                          isHome
                        />
                      )}
                      {prediction.analysis.team_analysis.away_team && (
                        <TeamAnalysisCard
                          teamName={matchData.away.name}
                          analysis={
                            prediction.analysis.team_analysis.away_team
                          }
                        />
                      )}
                    </div>
                  </div>
                </Card>
              )}

              {/* ── Prediction Analysis ─────────────────────── */}
              {prediction?.analysis?.prediction_analysis && (
                <Card className="bg-slate-800/60 border-slate-700">
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-yellow-500/10 rounded-lg">
                        <Target className="h-5 w-5 text-yellow-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-white">
                        Prediction Analysis
                      </h3>
                    </div>

                    <div className="space-y-4">
                      {prediction.analysis.prediction_analysis
                        .model_assessment && (
                        <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-700/60">
                          <div className="flex items-center gap-2 mb-2">
                            <Activity className="h-4 w-4 text-yellow-400" />
                            <span className="text-yellow-400 font-medium text-sm">
                              Model Assessment
                            </span>
                          </div>
                          <p className="text-slate-300 text-sm">
                            {
                              prediction.analysis.prediction_analysis
                                .model_assessment
                            }
                          </p>
                        </div>
                      )}

                      {prediction.analysis.prediction_analysis
                        .value_assessment && (
                        <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-700/60">
                          <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="h-4 w-4 text-blue-400" />
                            <span className="text-blue-400 font-medium text-sm">
                              Value Assessment
                            </span>
                          </div>
                          <p className="text-slate-300 text-sm">
                            {
                              prediction.analysis.prediction_analysis
                                .value_assessment
                            }
                          </p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {prediction.analysis.prediction_analysis
                          .confidence_factors &&
                          prediction.analysis.prediction_analysis
                            .confidence_factors.length > 0 && (
                            <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-700/60">
                              <div className="flex items-center gap-2 mb-3">
                                <CheckCircle className="h-4 w-4 text-emerald-400" />
                                <span className="text-emerald-400 font-medium text-sm">
                                  Confidence Factors
                                </span>
                              </div>
                              <ul className="space-y-2">
                                {prediction.analysis.prediction_analysis.confidence_factors.map(
                                  (f, i) => (
                                    <li
                                      key={i}
                                      className="text-slate-300 text-sm flex items-start gap-2"
                                    >
                                      <span className="text-emerald-400 mt-0.5">
                                        •
                                      </span>
                                      {f}
                                    </li>
                                  )
                                )}
                              </ul>
                            </div>
                          )}

                        {prediction.analysis.prediction_analysis
                          .risk_factors &&
                          prediction.analysis.prediction_analysis.risk_factors
                            .length > 0 && (
                            <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-700/60">
                              <div className="flex items-center gap-2 mb-3">
                                <AlertTriangle className="h-4 w-4 text-red-400" />
                                <span className="text-red-400 font-medium text-sm">
                                  Risk Factors
                                </span>
                              </div>
                              <ul className="space-y-2">
                                {prediction.analysis.prediction_analysis.risk_factors.map(
                                  (f, i) => (
                                    <li
                                      key={i}
                                      className="text-slate-300 text-sm flex items-start gap-2"
                                    >
                                      <span className="text-red-400 mt-0.5">
                                        •
                                      </span>
                                      {f}
                                    </li>
                                  )
                                )}
                              </ul>
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* ── Betting Recommendations — PREMIUM ─────────── */}
              {prediction?.analysis?.betting_recommendations && (
                <PremiumSection
                  locked={premiumLocked}
                  onUnlock={handlePurchaseClick}
                  title="Unlock Betting Recommendations"
                  price={premiumPrice}
                >
                  <Card className="bg-slate-800/60 border-slate-700">
                    <div className="p-6">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                          <Shield className="h-5 w-5 text-emerald-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-white">
                          Betting Recommendations
                        </h3>
                      </div>

                      <div className="space-y-4">
                        {prediction.analysis.betting_recommendations
                          .primary_bet && (
                          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Sparkles className="h-4 w-4 text-emerald-400" />
                              <span className="text-emerald-400 font-medium text-sm">
                                Primary Recommendation
                              </span>
                            </div>
                            <p className="text-slate-200 text-sm">
                              {
                                prediction.analysis.betting_recommendations
                                  .primary_bet
                              }
                            </p>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-3">
                          {prediction.analysis.betting_recommendations
                            .risk_level && (
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400 text-xs">
                                Risk:
                              </span>
                              <Badge
                                className={getRiskColor(
                                  prediction.analysis.betting_recommendations
                                    .risk_level
                                )}
                              >
                                {
                                  prediction.analysis.betting_recommendations
                                    .risk_level
                                }
                              </Badge>
                            </div>
                          )}
                          {prediction.analysis.betting_recommendations
                            .suggested_stake && (
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400 text-xs">
                                Stake:
                              </span>
                              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                                {
                                  prediction.analysis.betting_recommendations
                                    .suggested_stake
                                }
                              </Badge>
                            </div>
                          )}
                        </div>

                        {prediction.analysis.betting_recommendations
                          .alternative_bets &&
                          prediction.analysis.betting_recommendations
                            .alternative_bets.length > 0 && (
                            <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-700/60">
                              <div className="text-slate-400 text-xs font-medium mb-2">
                                Alternative Bets
                              </div>
                              <ul className="space-y-2">
                                {prediction.analysis.betting_recommendations.alternative_bets.map(
                                  (b, i) => (
                                    <li
                                      key={i}
                                      className="text-slate-300 text-sm flex items-start gap-2"
                                    >
                                      <span className="text-blue-400 mt-0.5">
                                        •
                                      </span>
                                      {b}
                                    </li>
                                  )
                                )}
                              </ul>
                            </div>
                          )}
                      </div>
                    </div>
                  </Card>
                </PremiumSection>
              )}

              {/* ── Smart Value Picks ────────────────────────── */}
              {valuePicks.length > 0 && !isFinished && (
                <Card className="bg-slate-800/60 border-slate-700">
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-emerald-500/10 rounded-lg">
                        <DollarSign className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          Smart Value Picks
                        </h3>
                        <p className="text-slate-400 text-xs">
                          AI-powered recommendations — tap to add to your bet
                          slip
                        </p>
                      </div>
                    </div>

                    {/* Match Result — all 1X2 picks so users can select any team */}
                    {matchResultPicks.length > 0 && (
                      <div className="mb-6">
                        <div className="flex items-center gap-2 mb-3">
                          <Zap className="h-4 w-4 text-emerald-400" />
                          <span className="text-emerald-400 font-medium text-sm">
                            Match Result — Pick a Side
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {matchResultPicks.map((pick) => (
                            <SelectablePickCard
                              key={pick.id}
                              pick={pick}
                              onToggle={toggleBetSlip}
                              isSelected={isInSlip(pick.id)}
                              showEdge
                              premiumLocked={premiumLocked}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Other positive-edge picks (non-1X2 markets) */}
                    {otherPositiveEdgePicks.length > 0 && (
                      <div className="mb-6">
                        <div className="flex items-center gap-2 mb-3">
                          <Zap className="h-4 w-4 text-amber-400" />
                          <span className="text-amber-400 font-medium text-sm">
                            Value Bets — Positive Edge
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {otherPositiveEdgePicks.map((pick) => (
                            <SelectablePickCard
                              key={pick.id}
                              pick={pick}
                              onToggle={toggleBetSlip}
                              isSelected={isInSlip(pick.id)}
                              showEdge
                              premiumLocked={premiumLocked}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Top model picks */}
                    {topModelPicks.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Target className="h-4 w-4 text-blue-400" />
                          <span className="text-blue-400 font-medium text-sm">
                            Top Model Picks — Build Your Slip
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                          {topModelPicks.map((pick) => (
                            <SelectablePickCard
                              key={pick.id}
                              pick={pick}
                              onToggle={toggleBetSlip}
                              isSelected={isInSlip(pick.id)}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* ── Advanced Markets ────────────────────────── */}
              {prediction?.additional_markets_v2 && (
                <Card className="bg-slate-800/60 border-slate-700">
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-purple-500/10 rounded-lg">
                        <TrendingUp className="h-5 w-5 text-purple-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-white">
                        Advanced Markets
                      </h3>
                      <span className="ml-auto text-slate-500 text-xs">
                        Tap any item to add to slip
                      </span>
                    </div>
                    <AdvancedMarketsSection
                      markets={prediction.additional_markets_v2}
                      matchData={matchData}
                      onToggleSlip={toggleBetSlip}
                      isInSlip={isInSlip}
                    />
                  </div>
                </Card>
              )}

              {/* ── Correct Score Predictions ───────────────── */}
              {(prediction?.additional_markets_v2 as Record<string, unknown>)?.correct_scores && (
                <Card className="bg-slate-800/60 border-slate-700">
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-emerald-500/10 rounded-lg">
                        <Crosshair className="h-5 w-5 text-emerald-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-white">
                        Correct Score Predictions
                      </h3>
                      <span className="ml-auto text-slate-500 text-xs">
                        Tap to add to slip
                      </span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                      {((prediction.additional_markets_v2 as Record<string, unknown>)
                        .correct_scores as Array<{
                        score: string
                        p: number
                      }>)
                        ?.filter((s) => s.score !== "Other")
                        .slice(0, 10)
                        .map((s, i) => {
                          const csId = `cs-${s.score}`
                          const selected = isInSlip(csId)
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() =>
                                toggleBetSlip({
                                  id: csId,
                                  market: "Correct Score",
                                  selection: s.score,
                                  probability: s.p,
                                  decimalOdds: +(1 / s.p).toFixed(2),
                                })
                              }
                              className={`text-center p-3 rounded-lg border transition-all duration-200 relative ${
                                selected
                                  ? "bg-emerald-500/20 border-emerald-500/50 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/30"
                                  : i === 0
                                    ? "bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/50"
                                    : "bg-slate-900/40 border-slate-700/60 hover:border-slate-600"
                              }`}
                            >
                              {selected && (
                                <div className="absolute -top-1.5 -right-1.5 bg-emerald-500 rounded-full p-0.5">
                                  <Check className="h-2.5 w-2.5 text-white" />
                                </div>
                              )}
                              <div
                                className={`font-bold text-lg ${selected ? "text-emerald-400" : i === 0 ? "text-emerald-400" : "text-white"}`}
                              >
                                {s.score}
                              </div>
                              <div className="text-slate-400 text-xs">
                                {(s.p * 100).toFixed(1)}%
                              </div>
                              <div className="text-slate-500 text-[10px] mt-0.5">
                                {(1 / s.p).toFixed(1)}x
                              </div>
                            </button>
                          )
                        })}
                    </div>
                  </div>
                </Card>
              )}

              {/* ── Finished Match Full Analysis ────────────── */}
              {isFinished && prediction && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-white">
                    Match Analysis & Prediction
                  </h2>
                  <PredictionCard
                    mode="full"
                    prediction={prediction}
                    matchData={matchData}
                    isPurchased={true}
                    purchaseSource="match_detail"
                  />
                </div>
              )}

              {/* ── Real-time Advanced Markets (live) ────────── */}
              {isLive &&
                !isFinished &&
                matchData.odds?.novig_current && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-bold text-white">
                        Real-time Advanced Markets
                      </h2>
                      <Badge className="bg-green-500 text-white animate-pulse">
                        LIVE
                      </Badge>
                    </div>
                    <RealtimeAdvancedMarkets
                      odds={matchData.odds.novig_current}
                      currentScore={matchData.live_data?.current_score}
                      minute={matchData.live_data?.minute ?? null}
                      homeTeamName={matchData.home.name}
                      awayTeamName={matchData.away.name}
                      baselineMarkets={
                        prediction?.additional_markets_v2 || null
                      }
                    />
                  </div>
                )}

              {/* ── Live Markets Card ───────────────────────── */}
              {isLive && !isFinished && matchData.model_markets && (
                <LiveMarketsCard markets={matchData.model_markets} />
              )}
            </div>

            {/* ── Sidebar ────────────────────────────────── */}
            <div className="lg:col-span-1 space-y-6">
              {/* Match Info */}
              <Card className="bg-slate-800/60 border-slate-700">
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Info className="h-4 w-4 text-slate-400" />
                    <h3 className="text-base font-semibold text-white">
                      Match Info
                    </h3>
                  </div>
                  <div className="space-y-3 text-sm">
                    {matchData.league?.name && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">League</span>
                        <span className="text-slate-200 font-medium">
                          {matchData.league.name}
                        </span>
                      </div>
                    )}
                    {prediction?.match_info?.venue && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Venue</span>
                        <span className="text-slate-200 text-right font-medium max-w-[160px] truncate">
                          {(prediction.match_info as Record<string, string>).venue}
                        </span>
                      </div>
                    )}
                    {prediction?.model_info && (
                      <>
                        <div className="pt-3 border-t border-slate-700">
                          <div className="text-slate-400 text-xs mb-2">
                            Data Quality
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{
                                  width: `${(prediction.model_info.quality_score || 0) * 100}%`,
                                }}
                              />
                            </div>
                            <span className="text-emerald-400 text-xs font-medium">
                              {prediction.model_info.data_quality || "N/A"}
                            </span>
                          </div>
                        </div>
                        {prediction.model_info.bookmaker_count && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Bookmakers</span>
                            <span className="text-slate-200 font-medium">
                              {prediction.model_info.bookmaker_count}
                            </span>
                          </div>
                        )}
                        {prediction.model_info.data_sources && (
                          <div className="pt-2">
                            <div className="text-slate-400 text-xs mb-2">
                              Data Sources
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {prediction.model_info.data_sources.map(
                                (src, i) => (
                                  <Badge
                                    key={i}
                                    className="bg-slate-700/50 text-slate-300 border-slate-600 text-[10px]"
                                  >
                                    {src}
                                  </Badge>
                                )
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </Card>

              {/* Bookmaker Odds */}
              {matchData.odds?.books &&
                Object.keys(matchData.odds.books).length > 0 && (
                  <div>
                    <BookmakerOdds
                      books={
                        matchData.odds.books as Record<string, { home: number; draw: number; away: number }>
                      }
                      matchData={matchData}
                      novig={matchData.odds.novig_current}
                    />
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ BET SLIP (floating panel) ═══════════════════ */}
      <BetSlip
        items={betSlip}
        stake={betStake}
        onStakeChange={setBetStake}
        onRemove={removeFromSlip}
        onClear={clearSlip}
        matchName={`${matchData.home.name} vs ${matchData.away.name}`}
        leagueName={matchData.league?.name}
        premiumLocked={premiumLocked}
        onUnlockPremium={handlePurchaseClick}
      />

      {/* ═══════════ PURCHASE MODAL (kept for future use) ═══════ */}
      {showPurchaseModal && quickPurchaseInfo && (
        <QuickPurchaseModal
          isOpen={showPurchaseModal}
          onClose={() => setShowPurchaseModal(false)}
          onViewTipHere={async () => {
            await new Promise((r) => setTimeout(r, 1500))
            await fetchMatchDetails()
            setShowFullAnalysis(true)
            if (!fullPrediction) fetchFullPrediction()
          }}
          item={{
            id: quickPurchaseInfo.id,
            name: quickPurchaseInfo.name,
            price: quickPurchaseInfo.price,
            originalPrice: quickPurchaseInfo.originalPrice,
            description:
              quickPurchaseInfo.description ||
              `AI prediction for ${matchData.home.name} vs ${matchData.away.name}`,
            features: [
              "Full V2 AI Analysis",
              "Team Analysis (Strengths/Weaknesses)",
              "Advanced Markets (Totals, BTTS, Handicaps)",
              "Risk Assessment",
              "Betting Recommendations",
              "Model Performance Metrics",
            ],
            type: "prediction",
            iconName: "Brain",
            colorGradientFrom: "#3B82F6",
            colorGradientTo: "#1D4ED8",
            confidenceScore:
              quickPurchaseInfo.confidenceScore || undefined,
            matchData: {
              home_team: matchData.home.name,
              away_team: matchData.away.name,
              league: (matchData.league?.name ?? "") as string,
              date: matchData.kickoff_at,
            },
            country: quickPurchaseInfo.country,
            predictionType: quickPurchaseInfo.predictionType || undefined,
            valueRating: quickPurchaseInfo.valueRating || undefined,
            analysisSummary:
              quickPurchaseInfo.analysisSummary || undefined,
          }}
        />
      )}
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   HELPER COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

/** Individual team analysis card */
function TeamAnalysisCard({
  teamName,
  analysis,
  isHome,
}: {
  teamName: string
  analysis: TeamAnalysis
  isHome?: boolean
}) {
  return (
    <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-700/60">
      <h4 className="text-white font-medium mb-3 flex items-center gap-2">
        {isHome ? (
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">
            HOME
          </Badge>
        ) : (
          <Badge className="bg-slate-600/40 text-slate-300 border-slate-500/30 text-[10px]">
            AWAY
          </Badge>
        )}
        {teamName}
      </h4>
      <div className="space-y-3">
        {analysis.strengths && analysis.strengths.length > 0 && (
          <div>
            <div className="text-sm text-emerald-400 font-medium mb-1.5">
              Strengths
            </div>
            <ul className="space-y-1">
              {analysis.strengths.map((s, i) => (
                <li
                  key={i}
                  className="text-slate-300 text-sm flex items-start gap-2"
                >
                  <span className="text-emerald-400 mt-0.5">•</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.weaknesses && analysis.weaknesses.length > 0 && (
          <div>
            <div className="text-sm text-red-400 font-medium mb-1.5">
              Weaknesses
            </div>
            <ul className="space-y-1">
              {analysis.weaknesses.map((w, i) => (
                <li
                  key={i}
                  className="text-slate-300 text-sm flex items-start gap-2"
                >
                  <span className="text-red-400 mt-0.5">•</span>
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.form_assessment && (
          <div>
            <div className="text-sm text-blue-400 font-medium mb-1">
              Form Assessment
            </div>
            <p className="text-slate-300 text-sm">{analysis.form_assessment}</p>
          </div>
        )}
        {analysis.injury_impact && (
          <div>
            <div className="text-sm text-orange-400 font-medium mb-1">
              Injury Impact
            </div>
            <p className="text-slate-300 text-sm">{analysis.injury_impact}</p>
          </div>
        )}
      </div>
    </div>
  )
}

/** A single selectable pick card — used in Smart Value Picks */
function SelectablePickCard({
  pick,
  onToggle,
  isSelected,
  showEdge = false,
  premiumLocked = false,
}: {
  pick: BetSlipItem & { edge?: number; category?: string }
  onToggle: (item: BetSlipItem) => void
  isSelected: boolean
  showEdge?: boolean
  premiumLocked?: boolean
}) {
  const edge = pick.edge ?? 0
  const cat = pick.category ?? pick.market
  return (
    <button
      type="button"
      onClick={() => onToggle(pick)}
      className={`text-left p-3 rounded-xl border transition-all duration-200 group ${
        isSelected
          ? "bg-emerald-500/15 border-emerald-500/50 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/30"
          : "bg-slate-900/40 border-slate-700/60 hover:border-slate-600 hover:bg-slate-800/60"
      }`}
    >
      <div className="flex items-start justify-between gap-1 mb-2">
        <Badge
          className={`text-[9px] px-1.5 py-0 ${
            cat === "1X2"
              ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
              : cat === "Correct Score"
                ? "bg-purple-500/20 text-purple-400 border-purple-500/30"
                : cat === "BTTS"
                  ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                  : cat === "Totals"
                    ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
                    : "bg-slate-600/40 text-slate-300 border-slate-500/30"
          }`}
        >
          {cat}
        </Badge>
        <div
          className={`p-0.5 rounded-full transition-colors ${
            isSelected
              ? "bg-emerald-500 text-white"
              : "bg-slate-700 text-slate-400 group-hover:bg-slate-600"
          }`}
        >
          {isSelected ? (
            <Check className="h-3 w-3" />
          ) : (
            <Plus className="h-3 w-3" />
          )}
        </div>
      </div>
      <div className="font-semibold text-white text-sm mb-1 truncate">
        {pick.selection}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-slate-400 text-xs">
          {(pick.probability * 100).toFixed(0)}% prob
        </span>
        <span className="text-emerald-400 font-bold text-sm tabular-nums">
          {pick.decimalOdds.toFixed(2)}
        </span>
      </div>
      {showEdge && edge !== 0 && (
        <div className="mt-1.5 pt-1.5 border-t border-slate-700/60">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[10px]">Edge</span>
            {premiumLocked ? (
              <span className="font-semibold text-xs text-amber-400/60 blur-[4px] select-none">
                +X.X%
              </span>
            ) : (
              <span
                className={`font-semibold text-xs ${
                  edge > 5
                    ? "text-emerald-400"
                    : edge > 0
                      ? "text-blue-400"
                      : "text-red-400"
                }`}
              >
                {edge > 0 ? "+" : ""}{edge.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      )}
    </button>
  )
}

/** Selectable row helper — used in Advanced Markets for line items */
function SelectableRow({
  id,
  market,
  label,
  probability,
  onToggle,
  isSelected,
}: {
  id: string
  market: string
  label: string
  probability: number
  onToggle: (item: BetSlipItem) => void
  isSelected: boolean
}) {
  return (
    <button
      type="button"
      onClick={() =>
        onToggle({
          id,
          market,
          selection: label,
          probability,
          decimalOdds: +(1 / probability).toFixed(2),
        })
      }
      className={`flex items-center justify-between w-full px-2 py-1.5 -mx-2 rounded-lg transition-all duration-150 ${
        isSelected
          ? "bg-emerald-500/10 ring-1 ring-emerald-500/30"
          : "hover:bg-slate-800/60"
      }`}
    >
      <span
        className={`text-xs ${isSelected ? "text-emerald-300 font-medium" : "text-slate-300"}`}
      >
        {label}
      </span>
      <div className="flex items-center gap-2">
        <span className="text-white text-xs font-semibold tabular-nums">
          {(probability * 100).toFixed(1)}%
        </span>
        {isSelected && <Check className="h-3 w-3 text-emerald-400" />}
      </div>
    </button>
  )
}

/** Advanced markets display — BTTS, Totals, Double Chance, etc. (selectable) */
function AdvancedMarketsSection({
  markets,
  matchData,
  onToggleSlip,
  isInSlip,
}: {
  markets: Record<string, unknown>
  matchData: MatchData
  onToggleSlip: (item: BetSlipItem) => void
  isInSlip: (id: string) => boolean
}) {
  const m = markets as Record<string, Record<string, unknown>>
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* BTTS */}
      {m.btts && (
        <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-700/60">
          <h5 className="text-white font-medium mb-3 text-sm">
            Both Teams to Score
          </h5>
          <div className="flex justify-around items-center gap-3">
            {(["yes", "no"] as const).map((sel) => {
              const prob = (m.btts as Record<string, number>)[sel]
              const id = `btts-${sel}`
              const selected = isInSlip(id)
              return (
                <button
                  key={sel}
                  type="button"
                  onClick={() =>
                    onToggleSlip({
                      id,
                      market: "Both Teams to Score",
                      selection: `BTTS ${sel === "yes" ? "Yes" : "No"}`,
                      probability: prob,
                      decimalOdds: +(1 / prob).toFixed(2),
                    })
                  }
                  className={`flex-1 text-center p-3 rounded-lg border transition-all duration-200 ${
                    selected
                      ? "bg-emerald-500/15 border-emerald-500/50 ring-1 ring-emerald-500/30"
                      : "border-transparent hover:bg-slate-800/60"
                  }`}
                >
                  <div
                    className={`font-bold text-xl ${sel === "yes" ? "text-emerald-400" : "text-red-400"}`}
                  >
                    {(prob * 100).toFixed(1)}%
                  </div>
                  <div className="text-slate-400 text-xs">
                    {sel === "yes" ? "Yes" : "No"}
                  </div>
                  {selected && (
                    <Check className="h-3 w-3 text-emerald-400 mx-auto mt-1" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Double Chance */}
      {m.double_chance && (
        <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-700/60">
          <h5 className="text-white font-medium mb-3 text-sm">
            Double Chance
          </h5>
          <div className="space-y-1">
            {Object.entries(m.double_chance as Record<string, number>).map(
              ([key, val]) => {
                const label =
                  key === "1X"
                    ? `${matchData.home.name} or Draw`
                    : key === "X2"
                      ? `Draw or ${matchData.away.name}`
                      : `${matchData.home.name} or ${matchData.away.name}`
                return (
                  <SelectableRow
                    key={key}
                    id={`dc-${key}`}
                    market="Double Chance"
                    label={label}
                    probability={val}
                    onToggle={onToggleSlip}
                    isSelected={isInSlip(`dc-${key}`)}
                  />
                )
              }
            )}
          </div>
        </div>
      )}

      {/* Totals */}
      {m.totals && (
        <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-700/60">
          <h5 className="text-white font-medium mb-3 text-sm">Total Goals</h5>
          <div className="space-y-2">
            {Object.entries(m.totals as Record<string, Record<string, number>>)
              .sort(
                ([a], [b]) =>
                  parseFloat(a.replace("_", ".")) -
                  parseFloat(b.replace("_", "."))
              )
              .map(([line, vals]) => {
                const label = line.replace("_", ".")
                const overId = `total-over-${line}`
                const underId = `total-under-${line}`
                const overSelected = isInSlip(overId)
                const underSelected = isInSlip(underId)
                return (
                  <div key={line}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-400">{label}</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            onToggleSlip({
                              id: overId,
                              market: "Total Goals",
                              selection: `Over ${label}`,
                              probability: vals.over,
                              decimalOdds: +(1 / vals.over).toFixed(2),
                            })
                          }
                          className={`px-2 py-0.5 rounded transition-all text-xs ${
                            overSelected
                              ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
                              : "text-emerald-400 hover:bg-emerald-500/10"
                          }`}
                        >
                          Over {(vals.over * 100).toFixed(0)}%
                          {overSelected && " ✓"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onToggleSlip({
                              id: underId,
                              market: "Total Goals",
                              selection: `Under ${label}`,
                              probability: vals.under,
                              decimalOdds: +(1 / vals.under).toFixed(2),
                            })
                          }
                          className={`px-2 py-0.5 rounded transition-all text-xs ${
                            underSelected
                              ? "bg-red-500/20 text-red-300 ring-1 ring-red-500/40"
                              : "text-red-400 hover:bg-red-500/10"
                          }`}
                        >
                          Under {(vals.under * 100).toFixed(0)}%
                          {underSelected && " ✓"}
                        </button>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-emerald-500/70 rounded-l-full"
                        style={{ width: `${vals.over * 100}%` }}
                      />
                      <div
                        className="h-full bg-red-500/70 rounded-r-full"
                        style={{ width: `${vals.under * 100}%` }}
                      />
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Win to Nil */}
      {m.win_to_nil && (
        <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-700/60">
          <h5 className="text-white font-medium mb-3 text-sm">Win to Nil</h5>
          <div className="space-y-1">
            {(["home", "away"] as const).map((side) => {
              const prob = (m.win_to_nil as Record<string, number>)[side]
              const teamName =
                side === "home" ? matchData.home.name : matchData.away.name
              return (
                <SelectableRow
                  key={side}
                  id={`wtn-${side}`}
                  market="Win to Nil"
                  label={`${teamName} Win to Nil`}
                  probability={prob}
                  onToggle={onToggleSlip}
                  isSelected={isInSlip(`wtn-${side}`)}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/** Icon for the Crosshair used in correct scores — import helper */
function Crosshair(props: React.SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="22" y1="12" x2="18" y2="12" />
      <line x1="6" y1="12" x2="2" y2="12" />
      <line x1="12" y1="6" x2="12" y2="2" />
      <line x1="12" y1="22" x2="12" y2="18" />
    </svg>
  )
}
