"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Calendar, MapPin, Trophy, Target, TrendingUp, Shield, Lock, Unlock, ArrowLeft, CheckCircle, Brain, Star, Zap } from "lucide-react"
import ConsensusRow from "./ConsensusRow"
import BookmakerOdds from "./BookmakerOdds"
import { QuickPurchaseModal } from "@/components/quick-purchase-modal"
// QuickPurchaseItem type defined inline below
import { PredictionCard } from "@/components/predictions/PredictionCard"
import { useLiveMatchWebSocket, mergeDeltaUpdate } from "@/hooks/use-live-match-websocket"
import { LiveScoreCard } from "@/components/live/LiveScoreCard"
import { MomentumIndicator } from "@/components/live/MomentumIndicator"
import { LiveMarketsCard } from "@/components/live/LiveMarketsCard"
import { LiveMatchStats } from "@/components/live/LiveMatchStats"
import { LiveAIAnalysis } from "@/components/live/LiveAIAnalysis"
import { UnifiedPremiumValue } from "@/components/match/UnifiedPremiumValue"
import { RealtimeAdvancedMarkets } from "@/components/live/RealtimeAdvancedMarkets"
import { FinishedMatchStats } from "@/components/match/FinishedMatchStats"
import { BettingIntelligence } from "@/components/match/BettingIntelligence"
import { edgeEV } from "@/lib/odds"
import type { EnhancedMatchData } from "@/types/live-match"

// Using EnhancedMatchData for live match support
type MatchData = EnhancedMatchData

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
  }
  analysis?: {
    ai_summary?: string
    team_analysis?: {
      home_team?: any
      away_team?: any
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
  additional_markets?: any
  additional_markets_v2?: any
  model_info?: any
  data_freshness?: any
}

/**
 * MatchDetailPage - Server-Side First Authentication
 * 
 * 🔥 NEW ARCHITECTURE: Uses /api/auth/session as primary source of truth
 * - Checks server-side session directly (no waiting for useSession() sync)
 * - Fast and reliable authentication decisions
 * - No blocking on client-side auth sync
 */
export default function MatchDetailPage() {
  const params = useParams()
  const router = useRouter()
  const matchId = params.match_id as string

  const [matchData, setMatchData] = useState<MatchData | null>(null)
  const [quickPurchaseInfo, setQuickPurchaseInfo] = useState<QuickPurchaseInfo | null>(null)
  const [purchaseStatus, setPurchaseStatus] = useState<PurchaseStatus | null>(null)
  const [fullPrediction, setFullPrediction] = useState<FullPrediction | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const [showFullAnalysis, setShowFullAnalysis] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false) // Server-side auth state

  // Check match status
  const isFinished = matchData?.status === 'FINISHED' || matchData?.final_result !== undefined
  const isLive = !isFinished && (matchData?.status === 'LIVE' || 
                 (matchData?.momentum !== undefined || matchData?.model_markets !== undefined))
  const { delta, isConnected, clearDelta } = useLiveMatchWebSocket(matchId, isLive || false)

  // Merge WebSocket delta updates into matchData (including odds changes)
  useEffect(() => {
    if (delta && matchData) {
      const updated = mergeDeltaUpdate(matchData, delta)
      setMatchData(updated)
      clearDelta()
      // Real-time Advanced Markets component will automatically recalculate with new odds
      // because it uses useMemo with odds as dependency
    }
  }, [delta, matchData, clearDelta])
  
  // 🔥 NEW: Check server-side session on mount (fast, non-blocking)
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/session', {
          cache: 'no-store',
          credentials: 'include',
        })
        const session = await res.json()
        setIsAuthenticated(!!session?.user)
      } catch (error) {
        console.error('[Match Detail] Auth check error:', error)
        setIsAuthenticated(false)
      }
    }
    checkAuth()
  }, [])

  // Auto-load predictionData when quickPurchaseInfo is available and purchased OR when match is finished
  useEffect(() => {
    // For finished matches, always show prediction data (blog mode)
    if (matchData && (matchData.status === 'FINISHED' || matchData.final_result !== undefined)) {
      if (quickPurchaseInfo?.predictionData && !fullPrediction) {
        console.log('[Match Detail] Auto-loading predictionData for finished match')
        setFullPrediction(quickPurchaseInfo.predictionData)
        setShowFullAnalysis(true)
      }
    } 
    // For purchased matches, show prediction data
    else if (quickPurchaseInfo?.predictionData && purchaseStatus?.isPurchased && !fullPrediction) {
      console.log('[Match Detail] Auto-loading predictionData from QuickPurchase')
      setFullPrediction(quickPurchaseInfo.predictionData)
      setShowFullAnalysis(true)
    }
  }, [matchData, quickPurchaseInfo?.predictionData, purchaseStatus?.isPurchased, fullPrediction])

  // 🔥 NEW: Fetch match details immediately (no blocking on authLoading)
  useEffect(() => {
    fetchMatchDetails()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]) // Only re-fetch when matchId changes

  const fetchMatchDetails = async (): Promise<void> => {
    try {
      setLoading(true)
      setError(null)

      // 🔥 NEW: Check server-side session first (fast, reliable)
      let serverIsAuthenticated = false
      try {
        const authRes = await fetch('/api/auth/session', {
          cache: 'no-store',
          credentials: 'include',
        })
        const session = await authRes.json()
        serverIsAuthenticated = !!session?.user
        setIsAuthenticated(serverIsAuthenticated)
      } catch (authError) {
        console.error('[Match Detail] Auth check error:', authError)
        serverIsAuthenticated = false
      }

      // Run match and purchase-status in parallel
      const matchPromise = (async () => {
        const resp = await fetch(`/api/match/${matchId}`)
        if (!resp.ok) throw new Error('Failed to fetch match details')
        const json = await resp.json()
        setMatchData(json.match)
        setQuickPurchaseInfo(json.quickPurchase)
        
        // Debug: Log AI analysis availability
        if (json.match?.ai_analysis) {
          console.log('[Match Detail] AI Analysis received from API:', {
            minute: json.match.ai_analysis.minute,
            hasMomentum: !!json.match.ai_analysis.momentum,
            observationsCount: json.match.ai_analysis.observations?.length || 0
          })
        } else {
          console.log('[Match Detail] No AI Analysis in match data')
        }
      })()

      // 🔥 NEW: Use server-side auth check for purchase status
      const purchasePromise = (async () => {
        if (!serverIsAuthenticated) {
          setPurchaseStatus({ isPurchased: false, isAuthenticated: false, quickPurchaseId: null, purchaseDate: null })
          console.log('[Match Detail] User not authenticated (server-side check), purchase status: false')
          return
        }
        const resp = await fetch(`/api/match/${matchId}/purchase-status`, {
          cache: 'no-store',
          credentials: 'include',
        })
        if (!resp.ok) {
          console.log('[Match Detail] Purchase status fetch failed:', resp.status)
          return
        }
        const purchaseResult = await resp.json()
        console.log('[Match Detail] Purchase status:', purchaseResult)
        setPurchaseStatus(purchaseResult)
        if (purchaseResult.isPurchased) {
          // Automatically show full analysis when purchased
          setShowFullAnalysis(true)
          // Fetch prediction data
          fetchFullPrediction()
        }
      })()

      await Promise.allSettled([matchPromise, purchasePromise])

      // Fire-and-forget warm-up (only for non-finished matches)
      // The useEffect hook will handle loading prediction data for finished matches
      try {
        fetch('/api/predictions/warm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ match_id: Number(matchId) }),
          keepalive: true,
        }).catch(() => {})
      } catch {}
    } catch (err) {
      console.error('Error fetching match details:', err)
      setError(err instanceof Error ? err.message : 'Failed to load match details')
    } finally {
      setLoading(false)
    }
  }

  const fetchFullPrediction = async () => {
    try {
      // First check if predictionData is already available from quickPurchaseInfo
      if (quickPurchaseInfo?.predictionData) {
        console.log('[Match Detail] Using predictionData from QuickPurchase:', quickPurchaseInfo.predictionData)
        setFullPrediction(quickPurchaseInfo.predictionData)
        return
      }

      // If purchased, try to get from purchase record
      if (purchaseStatus?.isPurchased && purchaseStatus?.quickPurchaseId) {
        try {
          const purchaseResponse = await fetch(`/api/my-tips?latest=1&quickPurchaseId=${purchaseStatus.quickPurchaseId}`)
          if (purchaseResponse.ok) {
            const purchaseData = await purchaseResponse.json()
            if (purchaseData.tips && purchaseData.tips[0]?.predictionData) {
              console.log('[Match Detail] Using predictionData from purchase record')
              setFullPrediction(purchaseData.tips[0].predictionData)
              return
            }
          }
        } catch (err) {
          console.error('Error fetching from purchase record:', err)
        }
      }

      // Otherwise, fetch from /predict API
      const response = await fetch('/api/predictions/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: parseInt(matchId) })
      })
      if (response.ok) {
        const data = await response.json()
        setFullPrediction(data)
      }
    } catch (err) {
      console.error('Error fetching full prediction:', err)
    }
  }

  const handlePurchaseClick = async () => {
    // 🔥 NEW: Check server-side session for immediate auth decision
    try {
      const res = await fetch('/api/auth/session', {
        cache: 'no-store',
        credentials: 'include',
      })
      const session = await res.json()
      const serverIsAuthenticated = !!session?.user
      
      if (!serverIsAuthenticated) {
        router.push(`/signin?callbackUrl=/match/${matchId}`)
        return
      }
      
      // Update local state
      setIsAuthenticated(true)
    } catch (error) {
      console.error('[Match Detail] Auth check error in handlePurchaseClick:', error)
      router.push(`/signin?callbackUrl=/match/${matchId}`)
      return
    }

    if (!quickPurchaseInfo) {
      setError('Purchase information not available')
      return
    }

    const purchaseItem: any = {
      id: quickPurchaseInfo.id,
      name: quickPurchaseInfo.name,
      price: quickPurchaseInfo.price,
      originalPrice: quickPurchaseInfo.originalPrice,
      description: quickPurchaseInfo.description || `AI prediction for ${matchData?.home.name} vs ${matchData?.away.name}`,
      features: [
        'Full V2 AI Analysis',
        'Team Analysis (Strengths/Weaknesses)',
        'Advanced Markets (Totals, BTTS, Handicaps)',
        'Risk Assessment',
        'Betting Recommendations',
        'Model Performance Metrics'
      ],
      type: 'prediction' as const,
      iconName: 'Brain',
      colorGradientFrom: '#3B82F6',
      colorGradientTo: '#1D4ED8',
      confidenceScore: quickPurchaseInfo.confidenceScore || undefined,
      matchData: matchData ? {
        home_team: matchData.home.name,
        away_team: matchData.away.name,
        league: matchData.league?.name || undefined,
        date: matchData.kickoff_at
      } : undefined,
      country: quickPurchaseInfo.country,
      predictionType: quickPurchaseInfo.predictionType || undefined,
      valueRating: quickPurchaseInfo.valueRating || undefined,
      analysisSummary: quickPurchaseInfo.analysisSummary || undefined
    }

    setShowPurchaseModal(true)
  }

  // Track if modal was ever opened to detect purchase completion
  const [modalWasOpen, setModalWasOpen] = useState(false)

  useEffect(() => {
    if (showPurchaseModal) {
      setModalWasOpen(true)
    } else if (modalWasOpen && !showPurchaseModal) {
      // Modal was closed after being open - refresh data after delay for webhook processing
      // 🔥 NEW: Refresh auth state and purchase status after purchase
      const timer = setTimeout(async () => {
        // Refresh server-side auth state
        try {
          const res = await fetch('/api/auth/session', {
            cache: 'no-store',
            credentials: 'include',
          })
          const session = await res.json()
          setIsAuthenticated(!!session?.user)
        } catch (error) {
          console.error('[Match Detail] Auth refresh error:', error)
        }
        
        // Refresh match details (includes purchase status)
        fetchMatchDetails().then(() => {
          setModalWasOpen(false)
          // Check if purchase was completed - fetchFullPrediction will be called by purchasePromise
        })
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [showPurchaseModal, modalWasOpen])

  const formatKickoffTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getSideName = (side: string, match: MatchData) => {
    if (side === 'home') return match.home.name
    if (side === 'away') return match.away.name
    return 'Draw'
  }

  const getConfidenceColorClass = (confidence: number) => {
    if (confidence >= 80) return 'text-emerald-400'
    if (confidence >= 60) return 'text-yellow-400'
    return 'text-red-400'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-emerald-400 mx-auto mb-4" />
          <div className="text-white text-lg font-semibold">Loading match details...</div>
        </div>
      </div>
    )
  }

  if (error || !matchData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
        <Card className="bg-slate-800/60 border-slate-700 p-8 max-w-md">
          <div className="text-center">
            <div className="text-red-400 text-xl font-semibold mb-2">Match Not Found</div>
            <div className="text-slate-300 mb-6">{error || 'The match you are looking for does not exist.'}</div>
            <Button onClick={() => router.push('/')} variant="outline" className="border-slate-600">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Homepage
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  const v1Model = matchData.models?.v1_consensus
  const v2Model = matchData.models?.v2_lightgbm
  const isPurchased = purchaseStatus?.isPurchased || false
  const hasV2 = !!v2Model

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Back Button */}
        <Button
          onClick={() => router.push('/')}
          variant="ghost"
          className="text-slate-300 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Homepage
        </Button>

        {/* Match Overview Section */}
        <Card className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 border-slate-700">
          <div className="p-6">
            {/* Top Row: League, Date, Status */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-700">
              <div className="flex items-center gap-4 flex-wrap">
                {matchData.league?.name && (
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-amber-400" />
                    <span className="text-slate-300 font-medium">{matchData.league.name}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-400" />
                  <span className="text-slate-300 text-sm">{formatKickoffTime(matchData.kickoff_at)}</span>
                </div>
              </div>
              {(matchData.status === 'LIVE' || isFinished) && (() => {
                const score = isFinished 
                  ? (matchData.final_result?.score || matchData.score)
                  : matchData.score
                if (!score || score.home === undefined || score.away === undefined) return null
                return (
                  <div className={`flex items-center gap-2 ${matchData.status === 'LIVE' ? 'text-emerald-400' : 'text-slate-300'}`}>
                    {matchData.status === 'LIVE' && (
                      <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                    )}
                    <span className="font-bold text-lg">
                      {score.home} - {score.away}
                    </span>
                    {matchData.status === 'LIVE' && matchData.live_data?.minute && (
                      <span className="text-slate-400 text-sm">
                        {matchData.live_data.minute}'
                      </span>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* Main Content: Teams vs Odds */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: Home Team */}
              <div className="flex flex-col items-center lg:items-start">
                <div className="flex items-center gap-3 mb-2">
                  {matchData.home?.logo_url && (
                    <img 
                      src={matchData.home.logo_url} 
                      alt={matchData.home.name}
                      className="w-12 h-12 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  )}
                  <h2 className="text-xl lg:text-2xl font-bold text-white text-center lg:text-left">
                    {matchData.home.name}
                  </h2>
                </div>
                {matchData.odds?.novig_current && matchData.odds?.books && (() => {
                  const homeProb = matchData.odds.novig_current.home
                  const homeOdds = (1 / homeProb).toFixed(2)
                  const bestHome = Math.max(...Object.values(matchData.odds.books).map(b => b.home))
                  const ev = edgeEV(homeProb, bestHome)
                  const evColor = ev >= 0.02 ? 'text-emerald-400' : ev > 0 ? 'text-blue-400' : 'text-slate-400'
                  return (
                    <div className="w-full mt-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-400 text-xs">Consensus Odds</span>
                        <span className="text-white font-semibold text-lg">{homeOdds}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-xs">Best Available</span>
                        <span className="text-slate-300 text-sm">{bestHome.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-700">
                        <span className="text-slate-400 text-xs">Expected Value</span>
                        <span className={`font-semibold text-sm ${evColor}`}>
                          {ev >= 0 ? '+' : ''}{(ev * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* Center: VS Badge + Match Info */}
              <div className="flex flex-col items-center justify-center">
                <div className="bg-slate-700/50 rounded-full px-4 py-2 mb-4">
                  <span className="text-slate-400 font-semibold text-sm">VS</span>
                </div>
                {matchData.status === 'LIVE' && (
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

              {/* Right: Away Team */}
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
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  )}
                </div>
                {matchData.odds?.novig_current && matchData.odds?.books && (() => {
                  const awayProb = matchData.odds.novig_current.away
                  const awayOdds = (1 / awayProb).toFixed(2)
                  const bestAway = Math.max(...Object.values(matchData.odds.books).map(b => b.away))
                  const ev = edgeEV(awayProb, bestAway)
                  const evColor = ev >= 0.02 ? 'text-emerald-400' : ev > 0 ? 'text-blue-400' : 'text-slate-400'
                  return (
                    <div className="w-full mt-3 text-right lg:text-right">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-semibold text-lg">{awayOdds}</span>
                        <span className="text-slate-400 text-xs">Consensus Odds</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300 text-sm">{bestAway.toFixed(2)}</span>
                        <span className="text-slate-400 text-xs">Best Available</span>
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-700">
                        <span className={`font-semibold text-sm ${evColor}`}>
                          {ev >= 0 ? '+' : ''}{(ev * 100).toFixed(1)}%
                        </span>
                        <span className="text-slate-400 text-xs">Expected Value</span>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* Draw Odds Row (if available) */}
            {matchData.odds?.novig_current && matchData.odds?.books && (() => {
              if (!matchData.odds.novig_current || !matchData.odds.books) return null
              
              const drawProb = matchData.odds.novig_current.draw
              const drawOdds = (1 / drawProb).toFixed(2)
              const books = matchData.odds.books
              const bestDraw = Math.max(...Object.values(books).map(b => b.draw))
              const drawEV = edgeEV(drawProb, bestDraw)
              const drawEVColor = drawEV >= 0.02 ? 'text-emerald-400' : drawEV > 0 ? 'text-blue-400' : 'text-slate-400'
              const bestDrawBookmaker = Object.keys(books).find(key => {
                const bookOdds = books[key]
                return bookOdds && bookOdds.draw === bestDraw
              }) || '—'
              
              return (
                <div className="mt-6 pt-6 border-t border-slate-700">
                  <div className="flex items-center justify-center gap-6">
                    <div className="text-center">
                      <div className="text-slate-400 text-xs mb-1">Draw</div>
                      <div className="text-white font-semibold text-lg mb-1">
                        {drawOdds}
                      </div>
                      <div className="text-slate-500 text-xs">
                        Consensus
                      </div>
                    </div>
                    <div className="h-8 w-px bg-slate-700" />
                    <div className="text-center">
                      <div className="text-slate-400 text-xs mb-1">Best Available</div>
                      <div className="text-slate-300 text-base mb-1">
                        {bestDraw.toFixed(2)}
                      </div>
                      <div className="text-slate-500 text-xs">
                        {bestDrawBookmaker}
                      </div>
                    </div>
                    <div className="h-8 w-px bg-slate-700" />
                    <div className="text-center">
                      <div className="text-slate-400 text-xs mb-1">Expected Value</div>
                      <div className={`font-semibold text-base mb-1 ${drawEVColor}`}>
                        {drawEV >= 0 ? '+' : ''}{(drawEV * 100).toFixed(1)}%
                      </div>
                      <div className="text-slate-500 text-xs">EV</div>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Enhanced Consensus Row (if available) */}
            {matchData.odds?.books && matchData.odds?.novig_current && (
              <div className="mt-6 pt-6 border-t border-slate-700">
                <ConsensusRow novig={matchData.odds.novig_current as any} books={matchData.odds.books as any} />
              </div>
            )}
          </div>
        </Card>

        {/* Finished Match Banner */}
        {isFinished && (
          <Card className="bg-gradient-to-r from-emerald-900/40 to-blue-900/40 border-emerald-500/50">
            <div className="p-6">
              <div className="flex items-center justify-center gap-3">
                <Trophy className="w-6 h-6 text-emerald-400" />
                <div className="text-center">
                  <div className="text-white font-bold text-lg">Match Finished</div>
                  <div className="text-slate-300 text-sm">This match has been completed</div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Finished Match Components */}
        {isFinished && (
          <FinishedMatchStats
            matchData={matchData as any}
            predictionData={quickPurchaseInfo?.predictionData || fullPrediction}
          />
        )}

        {/* Live Match Components - Only when status=LIVE and not finished */}
        {isLive && !isFinished && (
          <div className="space-y-6">
            {/* Live Score Card - use momentum.minute and score if live_data not available */}
            {(matchData.live_data || (matchData.momentum && matchData.score)) && (
              <LiveScoreCard
                score={
                  matchData.live_data?.current_score || 
                  { home: matchData.score?.home || 0, away: matchData.score?.away || 0 }
                }
                minute={matchData.live_data?.minute || matchData.momentum?.minute || 0}
                period={matchData.live_data?.period || 'Live'}
                status={matchData.status}
              />
            )}
            
            {/* Momentum Indicator */}
            {matchData.momentum && (
              <MomentumIndicator 
                momentum={matchData.momentum}
                homeTeamName={matchData.home.name}
                awayTeamName={matchData.away.name}
              />
            )}
            
            {/* Live Match Statistics */}
            {matchData.live_data && matchData.live_data.statistics && (
              <LiveMatchStats
                liveData={matchData.live_data}
                homeTeamName={matchData.home.name}
                awayTeamName={matchData.away.name}
              />
            )}

            {/* AI Analysis - Live insights and observations (Premium - requires purchase) */}
            {(() => {
              const hasAIAnalysis = !!matchData.ai_analysis
              const isPurchasedStatus = isPurchased
              if (hasAIAnalysis && !isPurchasedStatus) {
                console.log('[Match Detail] AI Analysis available but not purchased', {
                  hasAIAnalysis,
                  isPurchased: isPurchasedStatus,
                  purchaseStatus
                })
              }
              return matchData.ai_analysis && isPurchased && (
                <LiveAIAnalysis aiAnalysis={matchData.ai_analysis} />
              )
            })()}

            {/* AI Analysis Premium Teaser - Show when available but not purchased */}
            {matchData.ai_analysis && !isPurchased && (
              <Card className="bg-gradient-to-br from-purple-900/20 via-slate-800/60 to-slate-900/60 border-purple-500/30 border-2 border-dashed">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-500/20 rounded-lg">
                        <Brain className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">AI Live Analysis</h3>
                        <p className="text-slate-400 text-sm mt-1">
                          Real-time insights and betting angles
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40">
                      <Lock className="w-3 h-3 mr-1" />
                      Premium
                    </Badge>
                  </div>
                  <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/50 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm font-semibold text-emerald-400">Live Analysis Available</span>
                    </div>
                    <p className="text-slate-400 text-sm">
                      Get real-time AI-powered momentum analysis, key observations, and betting angles as the match unfolds.
                    </p>
                  </div>
                  <Button
                    onClick={handlePurchaseClick}
                    className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white"
                  >
                    <Unlock className="w-4 h-4 mr-2" />
                    Unlock AI Live Analysis
                  </Button>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Predictions + Sidebar (Bookmakers) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-6">
          {/* V1 Free Prediction - Hide for finished matches */}
          {v1Model && !isFinished && (
            <Card className="bg-slate-800/60 border-slate-700">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-white">Free Prediction (V1)</h2>
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/40">V1</Badge>
                    {hasV2 && !isPurchased && (
                      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs animate-pulse">
                        <Star className="w-3 h-3 mr-1 inline" />
                        V2 Available
                      </Badge>
                    )}
                  </div>
                  {hasV2 && !isPurchased && (
                    <Button
                      onClick={handlePurchaseClick}
                      variant="outline"
                      size="sm"
                      className="border-amber-500/50 text-amber-300 hover:bg-amber-500/20"
                    >
                      <Zap className="w-3 h-3 mr-1" />
                      Upgrade to V2
                    </Button>
                  )}
                </div>
                
                {/* Two-column layout: Prediction on left, Probabilities on right */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left: Main Prediction */}
                  <div className="space-y-4">
                    <div>
                      <div className="text-slate-400 text-sm mb-2">Our Prediction</div>
                      <div className="text-white font-semibold text-xl mb-1">
                        {getSideName(v1Model.pick, matchData)}
                      </div>
                      <div className="text-slate-500 text-xs">
                        {v1Model.pick === 'home' && 'Home team to win'}
                        {v1Model.pick === 'away' && 'Away team to win'}
                        {v1Model.pick === 'draw' && 'Match to end in a draw'}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-slate-400 text-sm">Confidence Score (V1)</div>
                        {hasV2 && !isPurchased && v2Model && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-slate-500">V2:</span>
                            <span className="text-amber-400 font-semibold">
                              {Math.round(v2Model.confidence * 100)}%
                            </span>
                            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] px-1.5 py-0">
                              +{Math.round((v2Model.confidence - v1Model.confidence) * 100)}%
                            </Badge>
                          </div>
                        )}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <div className={`text-4xl font-bold ${getConfidenceColorClass(v1Model.confidence * 100)}`}>
                          {Math.round(v1Model.confidence * 100)}
                        </div>
                        <div className="text-slate-400 text-lg">%</div>
                      </div>
                      {/* Confidence bar */}
                      <div className="mt-2 h-2 bg-slate-700 rounded-full overflow-hidden relative">
                        <div 
                          className={`h-full ${
                            v1Model.confidence * 100 >= 80 ? 'bg-emerald-500' :
                            v1Model.confidence * 100 >= 60 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(v1Model.confidence * 100, 100)}%` }}
                        />
                        {/* V2 confidence indicator if available */}
                        {hasV2 && !isPurchased && v2Model && (
                          <div 
                            className="absolute top-0 h-full border-r-2 border-amber-400/60"
                            style={{ left: `${Math.min(v2Model.confidence * 100, 100)}%` }}
                            title={`V2 Confidence: ${Math.round(v2Model.confidence * 100)}%`}
                          />
                        )}
                      </div>
                      {hasV2 && !isPurchased && (
                        <div className="mt-2 text-xs text-slate-500">
                          V2 model provides enhanced accuracy with deeper analysis
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Probability Breakdown */}
                  {v1Model.probs && (
                    <div className="space-y-4">
                      <div className="text-slate-400 text-sm mb-3">Win Probability</div>
                      <div className="space-y-3">
                        {/* Home Win */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              {matchData.home?.logo_url && (
                                <img 
                                  src={matchData.home.logo_url} 
                                  alt={matchData.home.name}
                                  className="w-5 h-5 object-contain"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none'
                                  }}
                                />
                              )}
                              <span className="text-slate-300 text-sm font-medium">{matchData.home.name}</span>
                            </div>
                            <span className={`text-sm font-semibold ${v1Model.pick === 'home' ? 'text-emerald-400' : 'text-slate-400'}`}>
                              {(v1Model.probs.home * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${v1Model.pick === 'home' ? 'bg-emerald-500' : 'bg-slate-600'}`}
                              style={{ width: `${(v1Model.probs.home * 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* Draw */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-slate-300 text-sm font-medium">Draw</span>
                            <span className={`text-sm font-semibold ${v1Model.pick === 'draw' ? 'text-emerald-400' : 'text-slate-400'}`}>
                              {(v1Model.probs.draw * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${v1Model.pick === 'draw' ? 'bg-emerald-500' : 'bg-slate-600'}`}
                              style={{ width: `${(v1Model.probs.draw * 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* Away Win */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              {matchData.away?.logo_url && (
                                <img 
                                  src={matchData.away.logo_url} 
                                  alt={matchData.away.name}
                                  className="w-5 h-5 object-contain"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none'
                                  }}
                                />
                              )}
                              <span className="text-slate-300 text-sm font-medium">{matchData.away.name}</span>
                            </div>
                            <span className={`text-sm font-semibold ${v1Model.pick === 'away' ? 'text-emerald-400' : 'text-slate-400'}`}>
                              {(v1Model.probs.away * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${v1Model.pick === 'away' ? 'bg-emerald-500' : 'bg-slate-600'}`}
                              style={{ width: `${(v1Model.probs.away * 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* V2 Premium Prediction - Only show when purchased */}
          {hasV2 && !isFinished && isPurchased && (
            <Card className="bg-slate-800/60 border-2 border-emerald-500/50">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">Premium Prediction (V2)</h2>
                  <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40">V2</Badge>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Unlock className="h-5 w-5" />
                    <span className="font-semibold">Full Access Granted</span>
                  </div>
                  <div>
                    <div className="text-slate-400 text-sm mb-2">Our Prediction</div>
                    <div className="text-white font-semibold text-lg">
                      {getSideName(v2Model.pick, matchData)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-sm mb-2">Confidence</div>
                    <div className={`text-3xl font-bold ${getConfidenceColorClass(v2Model.confidence * 100)}`}>
                      {Math.round(v2Model.confidence * 100)}%
                    </div>
                  </div>
                  {v2Model.probs && (
                    <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-700">
                      <div className="text-center">
                        <div className="text-slate-400 text-xs mb-1">Home Win</div>
                        <div className="text-slate-300 font-medium">{(v2Model.probs.home * 100).toFixed(1)}%</div>
                      </div>
                      <div className="text-center">
                        <div className="text-slate-400 text-xs mb-1">Draw</div>
                        <div className="text-slate-300 font-medium">{(v2Model.probs.draw * 100).toFixed(1)}%</div>
                      </div>
                      <div className="text-center">
                        <div className="text-slate-400 text-xs mb-1">Away Win</div>
                        <div className="text-slate-300 font-medium">{(v2Model.probs.away * 100).toFixed(1)}%</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Betting Intelligence Section - Only show when purchased */}
          {!isFinished && isPurchased && (
            <Card className="bg-slate-800/60 border-2 border-emerald-500/50">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Brain className="h-5 w-5 text-purple-400" />
                    Betting Intelligence
                  </h2>
                  <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40">Premium</Badge>
                </div>
                <BettingIntelligence 
                  matchId={matchId} 
                  bankroll={1000}
                  model={hasV2 ? 'v2' : 'best'}
                  showCard={false}
                />
              </div>
            </Card>
          )}

          {/* For Finished Matches: Always show full prediction data (blog mode) */}
          {isFinished && (quickPurchaseInfo?.predictionData || fullPrediction) && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white">Match Analysis & Prediction</h2>
              <PredictionCard
                mode="full"
                prediction={quickPurchaseInfo?.predictionData || fullPrediction || null}
                matchData={matchData}
                isPurchased={true}
                purchaseSource="match_detail"
              />
            </div>
          )}

          {/* Unified Premium Value Proposition - Shows all premium features in one section */}
          {!isFinished && !isPurchased && (
            <UnifiedPremiumValue
              matchData={matchData}
              quickPurchaseInfo={quickPurchaseInfo}
              v2Model={v2Model}
              onPurchaseClick={handlePurchaseClick}
            />
          )}

          {/* Purchase Success Message - Only for non-finished matches */}
          {!isFinished && isPurchased && !showFullAnalysis && (
          <Card className="bg-emerald-500/10 border-emerald-500/20">
            <div className="p-6 text-center">
              <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Full Access Granted</h3>
              <p className="text-slate-300 mb-4">You have purchased this prediction. View the complete analysis below.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  onClick={() => {
                    setShowFullAnalysis(true)
                    if (!fullPrediction) {
                      fetchFullPrediction()
                    }
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  View Complete Analysis
                </Button>
                <Button
                  onClick={() => router.push('/dashboard/my-tips')}
                  variant="outline"
                  className="border-slate-600 text-slate-300 hover:bg-slate-800"
                >
                  View in My Tips
                </Button>
              </div>
            </div>
          </Card>
          )}

          {/* Full Analysis Section (After Purchase) - Only for non-finished matches */}
          {!isFinished && isPurchased && showFullAnalysis && fullPrediction && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Complete Analysis</h2>
              <Button
                onClick={() => router.push('/dashboard/my-tips')}
                variant="outline"
                className="border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                View in My Tips
              </Button>
            </div>
            <PredictionCard
              mode="full"
              prediction={fullPrediction}
              matchData={matchData}
              isPurchased={true}
              purchaseSource="match_detail"
            />
          </div>
          )}

          {/* Real-time Advanced Markets (For Live Matches with Purchase) */}
          {isPurchased && isLive && matchData.odds?.novig_current && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Real-time Advanced Markets</h2>
                <Badge className="bg-green-500 text-white animate-pulse">LIVE</Badge>
              </div>
              <RealtimeAdvancedMarkets
                odds={matchData.odds.novig_current}
                currentScore={matchData.live_data?.current_score}
                minute={matchData.live_data?.minute ?? null}
                homeTeamName={matchData.home.name}
                awayTeamName={matchData.away.name}
                baselineMarkets={fullPrediction?.additional_markets_v2 || quickPurchaseInfo?.predictionData?.additional_markets_v2 || null}
              />
            </div>
          )}

          {/* Live Markets Card - Show when we have model_markets data */}
          {matchData.model_markets && (
            <LiveMarketsCard markets={matchData.model_markets} />
          )}

          </div>

          {/* Sidebar column */}
          <div className="lg:col-span-1">
            {matchData.odds?.books && Object.keys(matchData.odds.books).length > 0 && (
              <div className="lg:sticky lg:top-6">
                <BookmakerOdds 
                  books={matchData.odds.books as any} 
                  matchData={matchData}
                  novig={matchData.odds.novig_current}
                />
              </div>
            )}
          </div>
        </div>

        {/* Purchase Modal */}
        {showPurchaseModal && quickPurchaseInfo && (
          <QuickPurchaseModal
            isOpen={showPurchaseModal}
            onClose={() => setShowPurchaseModal(false)}
            item={{
              id: quickPurchaseInfo.id,
              name: quickPurchaseInfo.name,
              price: quickPurchaseInfo.price,
              originalPrice: quickPurchaseInfo.originalPrice,
              description: quickPurchaseInfo.description || `AI prediction for ${matchData.home.name} vs ${matchData.away.name}`,
              features: [
                'Full V2 AI Analysis',
                'Team Analysis (Strengths/Weaknesses)',
                'Advanced Markets (Totals, BTTS, Handicaps)',
                'Risk Assessment',
                'Betting Recommendations',
                'Model Performance Metrics'
              ],
              type: 'prediction',
              iconName: 'Brain',
              colorGradientFrom: '#3B82F6',
              colorGradientTo: '#1D4ED8',
              confidenceScore: quickPurchaseInfo.confidenceScore || undefined,
              matchData: {
                home_team: matchData.home.name,
                away_team: matchData.away.name,
                league: (matchData.league?.name ?? '') as string,
                date: matchData.kickoff_at
              },
              country: quickPurchaseInfo.country,
              predictionType: quickPurchaseInfo.predictionType || undefined,
              valueRating: quickPurchaseInfo.valueRating || undefined,
              analysisSummary: quickPurchaseInfo.analysisSummary || undefined
            }}
          />
        )}
      </div>
    </div>
  )
}

// Full Analysis Component (Reused from my-tips page structure)
function FullAnalysisSection({ 
  prediction, 
  matchData,
  v1Model
}: { 
  prediction: FullPrediction
  matchData: MatchData
  v1Model?: any
}) {
  return (
    <div className="space-y-6">
      {/* Hero Section */}
      {prediction.predictions?.recommended_bet && (
        <Card className="bg-gradient-to-r from-emerald-800/30 to-blue-800/30 border-emerald-500/30">
          <div className="p-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="text-slate-400 text-sm">Recommended Bet</div>
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-xs">
                  V2 Premium AI
                </Badge>
              </div>
              <div className="text-3xl font-bold text-emerald-400 mb-2">
                {prediction.predictions.recommended_bet.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </div>
              <div className="flex items-center justify-center gap-4">
                {prediction.predictions.confidence && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-300 text-sm">V2 Confidence:</span>
                    <span className="text-emerald-400 font-bold text-lg">
                      {(prediction.predictions.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
                {v1Model?.confidence && (
                  <>
                    <div className="h-4 w-px bg-slate-600" />
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-sm">V1:</span>
                      <span className="text-slate-400 text-sm">
                        {Math.round(v1Model.confidence * 100)}%
                      </span>
                      {prediction.predictions.confidence && (
                        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] px-1.5 py-0">
                          +{Math.round((prediction.predictions.confidence - v1Model.confidence) * 100)}%
                        </Badge>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* AI Analysis Summary */}
      {prediction.analysis?.ai_summary && (
        <Card className="bg-slate-800/60 border-slate-700">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-purple-400" />
              AI Analysis Summary
            </h3>
            <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
              <div className="text-slate-300 leading-relaxed whitespace-pre-line">
                {prediction.analysis.ai_summary}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Team Analysis */}
      {prediction.analysis?.team_analysis && (
        <Card className="bg-slate-800/60 border-slate-700">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <Trophy className="w-5 h-5 mr-2 text-blue-400" />
              Team Analysis
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {prediction.analysis.team_analysis.home_team && (
                <TeamAnalysisCard 
                  teamName={matchData.home.name}
                  analysis={prediction.analysis.team_analysis.home_team}
                />
              )}
              {prediction.analysis.team_analysis.away_team && (
                <TeamAnalysisCard 
                  teamName={matchData.away.name}
                  analysis={prediction.analysis.team_analysis.away_team}
                />
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Prediction Analysis */}
      {prediction.analysis?.prediction_analysis && (
        <Card className="bg-slate-800/60 border-slate-700">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <Target className="w-5 h-5 mr-2 text-yellow-400" />
              Prediction Analysis
            </h3>
            <div className="space-y-4">
              {prediction.analysis.prediction_analysis.model_assessment && (
                <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
                  <div className="text-yellow-400 font-medium mb-2">Model Assessment:</div>
                  <div className="text-slate-300">{prediction.analysis.prediction_analysis.model_assessment}</div>
                </div>
              )}
              {prediction.analysis.prediction_analysis.value_assessment && (
                <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
                  <div className="text-blue-400 font-medium mb-2">Value Assessment:</div>
                  <div className="text-slate-300">{prediction.analysis.prediction_analysis.value_assessment}</div>
                </div>
              )}
              {prediction.analysis.prediction_analysis.confidence_factors && (
                <div>
                  <div className="text-green-400 font-medium mb-2">Confidence Factors:</div>
                  <ul className="space-y-1">
                    {prediction.analysis.prediction_analysis.confidence_factors.map((factor, index) => (
                      <li key={index} className="text-slate-300 text-sm flex items-start">
                        <span className="text-green-400 mr-2">•</span>
                        {factor}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {prediction.analysis.prediction_analysis.risk_factors && (
                <div>
                  <div className="text-red-400 font-medium mb-2">Risk Factors:</div>
                  <ul className="space-y-1">
                    {prediction.analysis.prediction_analysis.risk_factors.map((risk, index) => (
                      <li key={index} className="text-slate-300 text-sm flex items-start">
                        <span className="text-red-400 mr-2">•</span>
                        {risk}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Betting Recommendations */}
      {prediction.analysis?.betting_recommendations && (
        <Card className="bg-slate-800/60 border-slate-700">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <Shield className="w-5 h-5 mr-2 text-emerald-400" />
              Betting Recommendations
            </h3>
            <div className="space-y-4">
              {prediction.analysis.betting_recommendations.primary_bet && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                  <div className="text-emerald-400 font-medium mb-2">Primary Recommendation:</div>
                  <div className="text-slate-200">{prediction.analysis.betting_recommendations.primary_bet}</div>
                </div>
              )}
              <div className="flex items-center gap-4">
                {prediction.analysis.betting_recommendations.risk_level && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Risk Level:</span>
                    <Badge className={`${
                      prediction.analysis.betting_recommendations.risk_level === 'Low' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                      prediction.analysis.betting_recommendations.risk_level === 'Medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                      'bg-red-500/20 text-red-400 border-red-500/30'
                    }`}>
                      {prediction.analysis.betting_recommendations.risk_level}
                    </Badge>
                  </div>
                )}
                {prediction.analysis.betting_recommendations.suggested_stake && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Suggested Stake:</span>
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                      {prediction.analysis.betting_recommendations.suggested_stake}
                    </Badge>
                  </div>
                )}
              </div>
              {prediction.analysis.betting_recommendations.alternative_bets && (
                <div>
                  <div className="text-slate-400 font-medium mb-2">Alternative Options:</div>
                  <ul className="space-y-1">
                    {prediction.analysis.betting_recommendations.alternative_bets.map((bet, index) => (
                      <li key={index} className="text-slate-300 text-sm flex items-start">
                        <span className="text-blue-400 mr-2">•</span>
                        {bet}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Additional Markets */}
      {prediction.additional_markets_v2 && (
        <Card className="bg-slate-800/60 border-slate-700">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-purple-400" />
              Advanced Markets Analysis
            </h3>
            <AdditionalMarketsDisplay markets={prediction.additional_markets_v2} matchData={matchData} />
          </div>
        </Card>
      )}
    </div>
  )
}

// Team Analysis Card Component
function TeamAnalysisCard({ teamName, analysis }: { teamName: string; analysis: any }) {
  return (
    <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
      <h4 className="text-md font-medium text-white mb-3">{teamName}</h4>
      <div className="space-y-3">
        {analysis.strengths && (
          <div>
            <div className="text-sm text-green-400 font-medium mb-2">Strengths:</div>
            <ul className="space-y-1">
              {analysis.strengths.map((strength: string, index: number) => (
                <li key={index} className="text-slate-300 text-sm flex items-start">
                  <span className="text-green-400 mr-2">•</span>
                  {strength}
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.weaknesses && (
          <div>
            <div className="text-sm text-red-400 font-medium mb-2">Weaknesses:</div>
            <ul className="space-y-1">
              {analysis.weaknesses.map((weakness: string, index: number) => (
                <li key={index} className="text-slate-300 text-sm flex items-start">
                  <span className="text-red-400 mr-2">•</span>
                  {weakness}
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.form_assessment && (
          <div>
            <div className="text-sm text-blue-400 font-medium mb-2">Form Assessment:</div>
            <div className="text-slate-300 text-sm">{analysis.form_assessment}</div>
          </div>
        )}
        {analysis.injury_impact && (
          <div>
            <div className="text-sm text-orange-400 font-medium mb-2">Injury Impact:</div>
            <div className="text-slate-300 text-sm">{analysis.injury_impact}</div>
          </div>
        )}
      </div>
    </div>
  )
}

// Additional Markets Display Component
function AdditionalMarketsDisplay({ markets, matchData }: { markets: any; matchData: MatchData }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Totals */}
      {markets.totals && (
        <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
          <h5 className="text-white font-medium mb-3">Total Goals Markets</h5>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {Object.entries(markets.totals).map(([key, value]: [string, any]) => (
              <div key={key} className="space-y-1">
                <div className="text-slate-400 text-xs font-medium">{key.replace('_', '.').toUpperCase()}</div>
                <div className="flex justify-between">
                  <span className="text-slate-300 text-xs">Over:</span>
                  <span className="text-green-400 text-xs font-medium">{(value.over * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300 text-xs">Under:</span>
                  <span className="text-red-400 text-xs font-medium">{(value.under * 100).toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BTTS */}
      {markets.btts && (
        <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
          <h5 className="text-white font-medium mb-3">Both Teams to Score</h5>
          <div className="flex justify-between items-center">
            <div className="text-center">
              <div className="text-slate-400 text-xs">Yes</div>
              <div className="text-green-400 font-bold text-lg">{(markets.btts.yes * 100).toFixed(1)}%</div>
            </div>
            <div className="text-center">
              <div className="text-slate-400 text-xs">No</div>
              <div className="text-red-400 font-bold text-lg">{(markets.btts.no * 100).toFixed(1)}%</div>
            </div>
          </div>
        </div>
      )}

      {/* Asian Handicap */}
      {markets.asian_handicap && (
        <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
          <h5 className="text-white font-medium mb-3">Asian Handicap</h5>
          <div className="space-y-3">
            {markets.asian_handicap.home && (
              <div>
                <div className="text-slate-300 text-sm font-medium mb-2">{matchData.home.name}</div>
                <div className="space-y-1">
                  {Object.entries(markets.asian_handicap.home).map(([key, value]: [string, any]) => {
                    const handicap = key.replace('_minus_', '-').replace('_', '.')
                    return (
                      <div key={key} className="flex justify-between items-center text-xs">
                        <span className="text-slate-300">{handicap}</span>
                        <div className="flex space-x-2">
                          <span className="text-green-400">W: {(value.win * 100).toFixed(0)}%</span>
                          {value.push && <span className="text-yellow-400">P: {(value.push * 100).toFixed(0)}%</span>}
                          <span className="text-red-400">L: {(value.lose * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {markets.asian_handicap.away && (
              <div>
                <div className="text-slate-300 text-sm font-medium mb-2">{matchData.away.name}</div>
                <div className="space-y-1">
                  {Object.entries(markets.asian_handicap.away).map(([key, value]: [string, any]) => {
                    const handicap = key.replace('_plus_', '+').replace('_', '.')
                    return (
                      <div key={key} className="flex justify-between items-center text-xs">
                        <span className="text-slate-300">{handicap}</span>
                        <div className="flex space-x-2">
                          <span className="text-green-400">W: {(value.win * 100).toFixed(0)}%</span>
                          {value.push && <span className="text-yellow-400">P: {(value.push * 100).toFixed(0)}%</span>}
                          <span className="text-red-400">L: {(value.lose * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

