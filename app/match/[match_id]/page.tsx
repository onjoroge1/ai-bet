"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Calendar, MapPin, Trophy, Target, TrendingUp, Shield, Lock, Unlock, ArrowLeft, CheckCircle, Brain } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { QuickPurchaseModal } from "@/components/quick-purchase-modal"
import type { QuickPurchaseItem } from "@/components/quick-purchase-modal"

interface MatchData {
  match_id: string | number
  status: string
  kickoff_at: string
  league?: {
    id: number | null
    name: string | null
  }
  home: {
    name: string
    team_id?: number | null
    logo_url?: string | null
  }
  away: {
    name: string
    team_id?: number | null
    logo_url?: string | null
  }
  odds?: {
    novig_current?: {
      home: number
      draw: number
      away: number
    }
    books?: any
  }
  models?: {
    v1_consensus?: {
      pick: string
      confidence: number
      probs?: {
        home: number
        draw: number
        away: number
      }
    } | null
    v2_lightgbm?: {
      pick: string
      confidence: number
      probs?: {
        home: number
        draw: number
        away: number
      }
    } | null
  }
  score?: {
    home: number
    away: number
  }
}

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
    }
  }
  additional_markets?: any
  additional_markets_v2?: any
  model_info?: any
  data_freshness?: any
}

export default function MatchDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const matchId = params.match_id as string

  const [matchData, setMatchData] = useState<MatchData | null>(null)
  const [quickPurchaseInfo, setQuickPurchaseInfo] = useState<QuickPurchaseInfo | null>(null)
  const [purchaseStatus, setPurchaseStatus] = useState<PurchaseStatus | null>(null)
  const [fullPrediction, setFullPrediction] = useState<FullPrediction | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const [showFullAnalysis, setShowFullAnalysis] = useState(false)

  useEffect(() => {
    if (!authLoading) {
      fetchMatchDetails()
    }
  }, [matchId, isAuthenticated, authLoading])

  const fetchMatchDetails = async (): Promise<void> => {
    try {
      setLoading(true)
      setError(null)

      // Fetch match data and QuickPurchase info
      const matchResponse = await fetch(`/api/match/${matchId}`)
      if (!matchResponse.ok) {
        throw new Error('Failed to fetch match details')
      }
      const matchResult = await matchResponse.json()
      setMatchData(matchResult.match)
      setQuickPurchaseInfo(matchResult.quickPurchase)

      // Check purchase status if authenticated
      if (isAuthenticated) {
        const purchaseResponse = await fetch(`/api/match/${matchId}/purchase-status`)
        if (purchaseResponse.ok) {
          const purchaseResult = await purchaseResponse.json()
          setPurchaseStatus(purchaseResult)
          
          // If purchased, fetch full prediction
          if (purchaseResult.isPurchased) {
            await fetchFullPrediction()
            setShowFullAnalysis(true)
          }
        }
      } else {
        setPurchaseStatus({ isPurchased: false, isAuthenticated: false, quickPurchaseId: null, purchaseDate: null })
      }
    } catch (err) {
      console.error('Error fetching match details:', err)
      setError(err instanceof Error ? err.message : 'Failed to load match details')
    } finally {
      setLoading(false)
    }
  }

  const fetchFullPrediction = async () => {
    try {
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

  const handlePurchaseClick = () => {
    if (!isAuthenticated) {
      router.push(`/signin?callbackUrl=/match/${matchId}`)
      return
    }

    if (!quickPurchaseInfo) {
      setError('Purchase information not available')
      return
    }

    const purchaseItem: QuickPurchaseItem = {
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
      const timer = setTimeout(() => {
        fetchMatchDetails().then(() => setModalWasOpen(false))
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
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Back Button */}
        <Button
          onClick={() => router.push('/')}
          variant="ghost"
          className="mb-6 text-slate-300 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Homepage
        </Button>

        {/* Match Overview Section */}
        <Card className="bg-slate-800/60 border-slate-700 mb-6">
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Teams */}
              <div className="lg:col-span-2">
                <div className="text-center lg:text-left mb-4">
                  <h1 className="text-3xl lg:text-4xl font-bold text-white mb-2">
                    {matchData.home.name} vs {matchData.away.name}
                  </h1>
                  {matchData.league?.name && (
                    <div className="flex items-center justify-center lg:justify-start gap-2 text-slate-400">
                      <Trophy className="h-4 w-4" />
                      <span>{matchData.league.name}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-center lg:justify-start gap-4 text-slate-400 mt-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span className="text-sm">{formatKickoffTime(matchData.kickoff_at)}</span>
                    </div>
                    {matchData.status === 'LIVE' && matchData.score && (
                      <div className="text-emerald-400 font-bold text-lg">
                        LIVE: {matchData.score.home} - {matchData.score.away}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Odds */}
              {matchData.odds?.novig_current && (
                <div className="border-t lg:border-t-0 lg:border-l border-slate-700 pt-6 lg:pt-0 lg:pl-6">
                  <div className="text-center lg:text-right">
                    <div className="text-slate-400 text-sm mb-3">Current Odds</div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="flex flex-col items-center gap-1">
                        <div className="text-xs text-slate-400 uppercase">Home</div>
                        <div className="px-3 py-2 rounded-md border border-slate-700 text-slate-200 text-lg font-semibold">
                          {(1 / matchData.odds.novig_current.home).toFixed(2)}
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div className="text-xs text-slate-400 uppercase">Draw</div>
                        <div className="px-3 py-2 rounded-md border border-slate-700 text-slate-200 text-lg font-semibold">
                          {(1 / matchData.odds.novig_current.draw).toFixed(2)}
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div className="text-xs text-slate-400 uppercase">Away</div>
                        <div className="px-3 py-2 rounded-md border border-slate-700 text-slate-200 text-lg font-semibold">
                          {(1 / matchData.odds.novig_current.away).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Predictions Tier Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* V1 Free Prediction */}
          {v1Model && (
            <Card className="bg-slate-800/60 border-slate-700">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">Free Prediction (V1)</h2>
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/40">V1</Badge>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="text-slate-400 text-sm mb-2">Our Prediction</div>
                    <div className="text-white font-semibold text-lg">
                      {getSideName(v1Model.pick, matchData)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-sm mb-2">Confidence</div>
                    <div className={`text-3xl font-bold ${getConfidenceColorClass(v1Model.confidence * 100)}`}>
                      {Math.round(v1Model.confidence * 100)}%
                    </div>
                  </div>
                  {v1Model.probs && (
                    <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-700">
                      <div className="text-center">
                        <div className="text-slate-400 text-xs mb-1">Home Win</div>
                        <div className="text-slate-300 font-medium">{(v1Model.probs.home * 100).toFixed(1)}%</div>
                      </div>
                      <div className="text-center">
                        <div className="text-slate-400 text-xs mb-1">Draw</div>
                        <div className="text-slate-300 font-medium">{(v1Model.probs.draw * 100).toFixed(1)}%</div>
                      </div>
                      <div className="text-center">
                        <div className="text-slate-400 text-xs mb-1">Away Win</div>
                        <div className="text-slate-300 font-medium">{(v1Model.probs.away * 100).toFixed(1)}%</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* V2 Premium Prediction */}
          {hasV2 && (
            <Card className={`bg-slate-800/60 border-2 ${isPurchased ? 'border-emerald-500/50' : 'border-amber-500/50'}`}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">Premium Prediction (V2)</h2>
                  <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40">V2</Badge>
                </div>
                {isPurchased ? (
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
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-amber-400">
                      <Lock className="h-5 w-5" />
                      <span className="font-semibold">Premium Content</span>
                    </div>
                    <div>
                      <div className="text-slate-400 text-sm mb-2">Our Prediction</div>
                      <div className="text-white font-semibold text-lg">
                        {getSideName(v2Model.pick, matchData)}
                      </div>
                    </div>
                    <div>
                      <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-1.5 text-sm font-semibold shadow-[0_0_8px_rgba(245,158,11,0.4)] w-full justify-center">
                        Unlock Premium
                      </Badge>
                    </div>
                    <div className="text-slate-400 text-sm pt-4 border-t border-slate-700">
                      Advanced AI model with deeper analysis, team breakdown, risk assessment, and betting recommendations.
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Purchase/Access CTA Section */}
        {!isPurchased && quickPurchaseInfo && (
          <Card className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border-emerald-500/20 mb-6">
            <div className="p-6">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-white mb-2">Get Full Prediction Analysis</h3>
                <p className="text-slate-300 mb-4">Unlock complete AI-powered insights and betting recommendations</p>
                <div className="flex flex-col items-center gap-2 mb-6">
                  <div className="text-3xl font-bold text-emerald-400">
                    {quickPurchaseInfo.country.currencySymbol}{quickPurchaseInfo.price}
                  </div>
                  {quickPurchaseInfo.originalPrice && quickPurchaseInfo.originalPrice !== quickPurchaseInfo.price && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 line-through text-lg">
                        {quickPurchaseInfo.country.currencySymbol}{quickPurchaseInfo.originalPrice}
                      </span>
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/40 text-xs">
                        {Math.round(((quickPurchaseInfo.originalPrice - quickPurchaseInfo.price) / quickPurchaseInfo.originalPrice) * 100)}% OFF
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-700">
                  <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <Target className="h-5 w-5 text-emerald-400" />
                    What's Included
                  </h4>
                  <ul className="space-y-2 text-slate-300 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span>Full V2 AI Analysis</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span>Team Analysis (Strengths/Weaknesses)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span>Advanced Markets (Totals, BTTS, Handicaps)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span>Risk Assessment & Factors</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span>Betting Recommendations</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span>Model Performance Metrics</span>
                    </li>
                  </ul>
                </div>
                <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-700">
                  <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <Shield className="h-5 w-5 text-blue-400" />
                    Why Choose Premium?
                  </h4>
                  <ul className="space-y-2 text-slate-300 text-sm">
                    <li className="flex items-start gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                      <span>More accurate predictions with advanced ML models</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Brain className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                      <span>Comprehensive analysis not available in free tier</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Target className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                      <span>Actionable betting recommendations</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Shield className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                      <span>Risk-adjusted insights for better decisions</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-center">
                <Button
                  onClick={handlePurchaseClick}
                  size="lg"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-6 text-lg font-semibold"
                >
                  {isAuthenticated ? (
                    <>Purchase Full Prediction</>
                  ) : (
                    <>Sign In to Purchase</>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Purchase Success Message */}
        {isPurchased && !showFullAnalysis && (
          <Card className="bg-emerald-500/10 border-emerald-500/20 mb-6">
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

        {/* Full Analysis Section (After Purchase) */}
        {isPurchased && showFullAnalysis && fullPrediction && (
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
            <FullAnalysisSection 
              prediction={fullPrediction}
              matchData={matchData}
            />
          </div>
        )}

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
                league: matchData.league?.name || undefined,
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
  matchData 
}: { 
  prediction: FullPrediction
  matchData: MatchData
}) {
  return (
    <div className="space-y-6">
      {/* Hero Section */}
      {prediction.predictions?.recommended_bet && (
        <Card className="bg-gradient-to-r from-emerald-800/30 to-blue-800/30 border-emerald-500/30">
          <div className="p-6">
            <div className="text-center">
              <div className="text-slate-400 text-sm mb-2">Recommended Bet</div>
              <div className="text-3xl font-bold text-emerald-400 mb-2">
                {prediction.predictions.recommended_bet.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </div>
              {prediction.predictions.confidence && (
                <div className="text-slate-300">
                  Confidence: <span className="text-emerald-400 font-bold">
                    {(prediction.predictions.confidence * 100).toFixed(1)}%
                  </span>
                </div>
              )}
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

