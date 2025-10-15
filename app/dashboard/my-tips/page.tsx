"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Loader2, Calendar, MapPin, Trophy, Target, TrendingUp, Shield } from "lucide-react"

interface Tip {
  id: string
  purchaseDate: string
  amount: number
  paymentMethod: string
  tipType: 'purchase' | 'credit_claim'
  creditsSpent?: number
  // Match information
  homeTeam: string
  awayTeam: string
  matchDate: string | null
  venue: string | null
  league: string | null
  matchStatus: string | null
  // Prediction data
  predictionType: string | null
  confidenceScore: number | null
  odds: number | null
  valueRating: string | null
  analysisSummary: string | null
  // QuickPurchase details
  name: string
  type: string
  price: number
  description: string
  features: string[]
  isUrgent: boolean
  timeLeft: string | null
  currencySymbol: string
  currencyCode: string
  // Raw prediction data from database
  predictionData: PredictionData | null
  // Formatted prediction data for frontend components
  prediction: {
    match: MatchData
    prediction: string
    odds: string
    confidence: number
    analysis: string
    valueRating: string
    detailedReasoning: string[]
    extraMarkets: ExtraMarket[]
    thingsToAvoid: string[]
    riskLevel: string
    confidenceStars: number
    probabilitySnapshot: ProbabilitySnapshot
    aiVerdict: AIVerdict
    mlPrediction: MLPrediction
    riskAnalysis: RiskAnalysis
    bettingIntelligence: BettingIntelligence
    confidenceBreakdown: string
    additionalMarkets: AdditionalMarkets
    analysisMetadata: AnalysisMetadata
    processingTime: number
    timestamp: string
  } | null
  // Additional credit claim info
  expiresAt?: string | null
  status?: string | null
}

// Define proper types for prediction data structures
interface PredictionData {
  [key: string]: unknown
}

interface MatchData {
  homeTeam: string
  awayTeam: string
  date: string
  venue?: string
  league?: string
  [key: string]: unknown
}

interface ExtraMarket {
  name: string
  odds: number
  prediction?: string
  reasoning?: string
  [key: string]: unknown
}

interface ProbabilitySnapshot {
  homeWin: number
  awayWin: number
  draw: number
  home?: number
  away?: number
  [key: string]: unknown
}

interface AIVerdict {
  confidence: number
  reasoning: string
  recommended_outcome?: string
  confidence_level?: string
  probability_assessment?: string
  [key: string]: unknown
}

interface MLPrediction {
  model: string
  prediction: string
  confidence: number
  home_win?: number
  draw?: number
  away_win?: number
  [key: string]: unknown
}

interface RiskAnalysis {
  level: string
  factors: string[]
  overall_risk?: string
  key_risks?: string[]
  [key: string]: unknown
}

interface BettingIntelligence {
  value: string
  reasoning: string
  primary_bet?: string
  [key: string]: unknown
}

interface AdditionalMarkets {
  [key: string]: unknown
}

interface AnalysisMetadata {
  version: string
  timestamp: string
  analysis_timestamp?: string
  [key: string]: unknown
}

export default function MyTipsPage() {
  const [tips, setTips] = useState<Tip[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTip, setSelectedTip] = useState<Tip | null>(null)
  const [showPrediction, setShowPrediction] = useState(false)

  useEffect(() => {
    fetchTips()
  }, [])

  const fetchTips = async () => {
    try {
      console.log("🔍 DEBUG: Fetching tips from /api/my-tips")
      const response = await fetch("/api/my-tips")
      console.log("🔍 DEBUG: Response status:", response.status)
      if (!response.ok) {
        console.error("❌ DEBUG: Response not OK:", response.status, response.statusText)
        throw new Error("Failed to fetch tips")
      }
      const data = await response.json()
      console.log("🔍 DEBUG: Received tips data:", data.length, "tips")
      console.log("🔍 DEBUG: First tip:", data[0])
      setTips(data)
    } catch (error) {
      console.error("❌ DEBUG: Error fetching tips:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleViewPrediction = (tip: Tip) => {
    setSelectedTip(tip)
    setShowPrediction(true)
  }

  // Filter tips by match status
  const getUpcomingTips = (tips: Tip[]) => {
    return tips.filter(tip => {
      if (!tip.matchDate) return false
      const matchDate = new Date(tip.matchDate)
      const now = new Date()
      return matchDate > now
    }).sort((a, b) => {
      // Sort by match date (soonest first)
      const dateA = a.matchDate ? new Date(a.matchDate) : new Date(0)
      const dateB = b.matchDate ? new Date(b.matchDate) : new Date(0)
      return dateA.getTime() - dateB.getTime()
    })
  }

  const getCompletedTips = (tips: Tip[]) => {
    return tips.filter(tip => {
      if (!tip.matchDate) return true // Treat tips without match date as completed
      const matchDate = new Date(tip.matchDate)
      const now = new Date()
      return matchDate <= now
    }).sort((a, b) => {
      // Sort by match date (most recent first)
      const dateA = a.matchDate ? new Date(a.matchDate) : new Date(0)
      const dateB = b.matchDate ? new Date(b.matchDate) : new Date(0)
      return dateB.getTime() - dateA.getTime()
    })
  }

  const formatMatchDate = (dateString: string | null) => {
    if (!dateString) return 'TBD'
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getTimeRemaining = (dateString: string | null) => {
    if (!dateString) return null
    const matchDate = new Date(dateString)
    const now = new Date()
    const timeDiff = matchDate.getTime() - now.getTime()
    
    if (timeDiff <= 0) return null
    
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const getPredictionTypeLabel = (type: string | null) => {
    if (!type) return 'No Prediction'
    switch (type) {
      case 'home_win': return 'Home Win'
      case 'away_win': return 'Away Win'
      case 'draw': return 'Draw'
      default: return type
    }
  }

  const getValueRatingColor = (rating: string | null) => {
    if (!rating) return 'bg-gray-500'
    switch (rating.toLowerCase()) {
      case 'very high': return 'bg-red-500'
      case 'high': return 'bg-orange-500'
      case 'medium': return 'bg-yellow-500'
      case 'low': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  // Component for upcoming match cards (full-size)
  const UpcomingMatchCard = ({ tip }: { tip: Tip }) => {
    const timeRemaining = getTimeRemaining(tip.matchDate)

  return (
            <Card 
        className="bg-slate-800/60 border-slate-600/50 backdrop-blur-sm hover:border-emerald-400/50 hover:bg-slate-800/70 transition-all duration-200 cursor-pointer"
              onClick={() => handleViewPrediction(tip)}
            >
        <div className="p-6 space-y-4">
          {/* Header with time remaining */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-emerald-400 text-sm font-medium">
                    <Calendar className="w-4 h-4" />
                    <span>{formatMatchDate(tip.matchDate)}</span>
                  </div>
            {timeRemaining && (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                Starts in {timeRemaining}
              </Badge>
            )}
          </div>

          {/* Match Teams */}
          <div className="text-center">
            <div className="text-white font-bold text-xl mb-2">
                    {tip.homeTeam} vs {tip.awayTeam}
                  </div>
                  {tip.league && (
              <div className="flex items-center justify-center text-slate-400 text-sm">
                      <Trophy className="w-4 h-4 mr-1" />
                      {tip.league}
                    </div>
                  )}
                </div>

                {/* Prediction Info */}
                {tip.predictionType && (
            <div className="text-center space-y-3">
              <Badge className="bg-emerald-600 text-white text-sm px-3 py-1">
                      {getPredictionTypeLabel(tip.predictionType)}
                    </Badge>
              <div className="flex items-center justify-center space-x-4">
                    {tip.confidenceScore && (
                      <div className="text-emerald-400 text-sm">
                    <span className="font-medium">{tip.confidenceScore}%</span> confidence
                      </div>
                    )}
                    {tip.valueRating && (
                  <Badge className={`${getValueRatingColor(tip.valueRating)} text-white text-xs`}>
                        {tip.valueRating} Value
                      </Badge>
                    )}
              </div>
                  </div>
                )}

                {/* Purchase Info */}
          <div className="border-t border-slate-700 pt-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400">
                      {tip.tipType === 'credit_claim' ? 'Claimed:' : 'Purchased:'}
                    </span>
                    <span className="text-slate-300">
                      {new Date(tip.purchaseDate).toLocaleDateString()}
                    </span>
                  </div>
          </div>

          <Button 
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            onClick={(e) => {
              e.stopPropagation()
              handleViewPrediction(tip)
            }}
          >
            View Prediction
          </Button>
        </div>
      </Card>
    )
  }

  // Component for completed match cards (compact)
  const CompletedMatchCard = ({ tip }: { tip: Tip }) => {
    return (
      <Card 
        className="bg-slate-800/60 border-slate-600/50 backdrop-blur-sm hover:border-slate-500/30 hover:bg-slate-800/70 transition-all duration-200 cursor-pointer"
        onClick={() => handleViewPrediction(tip)}
      >
        <div className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-slate-400 text-sm">
              <Calendar className="w-3 h-3" />
              <span>{formatMatchDate(tip.matchDate)}</span>
            </div>
            <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30 text-xs">
              Completed
            </Badge>
          </div>

          {/* Match Teams */}
          <div className="text-center">
            <div className="text-white font-semibold text-lg">
              {tip.homeTeam} vs {tip.awayTeam}
            </div>
            {tip.league && (
              <div className="text-slate-400 text-xs mt-1">
                {tip.league}
                    </div>
                  )}
                </div>

          {/* Prediction Info - Compact */}
          {tip.predictionType && (
            <div className="text-center">
              <div className="flex items-center justify-center space-x-2">
                <Badge className="bg-slate-600 text-white text-xs">
                  {getPredictionTypeLabel(tip.predictionType)}
                </Badge>
                {tip.confidenceScore && (
                  <span className="text-slate-400 text-xs">
                    {tip.confidenceScore}%
                  </span>
                )}
              </div>
            </div>
          )}


                <Button 
            size="sm"
            className="w-full bg-slate-600 hover:bg-slate-700 text-white text-sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleViewPrediction(tip)
                  }}
                >
            View Details
                </Button>
              </div>
            </Card>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  // Get filtered and sorted tips
  const upcomingTips = getUpcomingTips(tips)
  const completedTips = getCompletedTips(tips)

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">My Predictions</h1>
        <p className="text-slate-400">
          View and manage your purchased predictions and claimed tips
        </p>
      </div>
      
      {tips.length === 0 ? (
        <Card className="bg-slate-800/60 border-slate-600/50 backdrop-blur-sm p-12">
          <div className="text-center">
            <Target className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No predictions yet</h3>
            <p className="text-slate-400 mb-4">
              You haven&apos;t purchased or claimed any predictions yet.
            </p>
            <p className="text-slate-500 text-sm">
              Start by claiming tips with credits or purchasing premium predictions!
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Upcoming Matches Section */}
          {upcomingTips.length > 0 && (
            <div>
              <div className="flex items-center space-x-3 mb-6">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                  <h2 className="text-xl font-bold text-white">🔥 Upcoming Matches</h2>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                  {upcomingTips.length} match{upcomingTips.length !== 1 ? 'es' : ''}
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {upcomingTips.map((tip) => (
                  <UpcomingMatchCard key={tip.id} tip={tip} />
                ))}
              </div>
            </div>
          )}

          {/* Completed Matches Section */}
          {completedTips.length > 0 && (
            <div>
              <div className="flex items-center space-x-3 mb-6">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-slate-500 rounded-full"></div>
                  <h2 className="text-xl font-bold text-white">📊 Completed Matches</h2>
                </div>
                <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">
                  {completedTips.length} match{completedTips.length !== 1 ? 'es' : ''}
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {completedTips.map((tip) => (
                  <CompletedMatchCard key={tip.id} tip={tip} />
                ))}
              </div>
            </div>
          )}

          {/* No matches message */}
          {upcomingTips.length === 0 && completedTips.length === 0 && (
            <Card className="bg-slate-800/60 border-slate-600/50 backdrop-blur-sm p-12">
              <div className="text-center">
                <Target className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">No matches found</h3>
                <p className="text-slate-400">No matches found in your predictions.</p>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Prediction Detail Modal */}
      {selectedTip && (
        <Dialog open={showPrediction} onOpenChange={setShowPrediction}>
          <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto bg-slate-900 border-slate-700">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Prediction Details</h2>
                <Button variant="outline" onClick={() => setShowPrediction(false)} className="border-slate-600 text-slate-300">
                  Close
                </Button>
              </div>

              {/* Match Info */}
              <Card className="bg-slate-800 border-slate-700 p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                      <Calendar className="w-5 h-5 mr-2 text-blue-400" />
                      Match Information
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Home Team:</span>
                        <span className="text-white font-medium">{selectedTip.homeTeam}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Away Team:</span>
                        <span className="text-white font-medium">{selectedTip.awayTeam}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Match Date:</span>
                        <span className="text-white">{selectedTip.matchDate ? new Date(selectedTip.matchDate).toLocaleDateString() : 'TBD'}</span>
                      </div>
                      {selectedTip.venue && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Venue:</span>
                          <span className="text-white flex items-center">
                            <MapPin className="w-4 h-4 mr-1 text-slate-400" />
                            {selectedTip.venue}
                          </span>
                        </div>
                      )}
                      {selectedTip.league && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">League:</span>
                          <span className="text-white flex items-center">
                            <Trophy className="w-4 h-4 mr-1 text-yellow-400" />
                            {selectedTip.league}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                      <Target className="w-5 h-5 mr-2 text-emerald-400" />
                      Prediction Details
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Prediction:</span>
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                          {selectedTip.predictionType || 'N/A'}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Confidence:</span>
                        <span className="text-white font-medium">
                          {selectedTip.confidenceScore ? `${selectedTip.confidenceScore.toFixed(1)}%` : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Purchase Type:</span>
                        <Badge className={selectedTip.tipType === 'credit_claim' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-green-500/20 text-green-400 border-green-500/30'}>
                          {selectedTip.tipType === 'credit_claim' ? 'Credit Claim' : 'Purchase'}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Purchase Date:</span>
                        <span className="text-white">{new Date(selectedTip.purchaseDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Hero Section - Main Prediction */}
              <Card className="bg-gradient-to-r from-emerald-800/30 to-blue-800/30 border-emerald-500/30 p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Side - Match Info */}
                  <div className="space-y-4">
                    <div className="text-center lg:text-left">
                      <h3 className="text-2xl font-bold text-white mb-2">
                        {selectedTip.homeTeam} vs {selectedTip.awayTeam}
                      </h3>
                      <div className="flex items-center justify-center lg:justify-start space-x-4 text-slate-400 text-sm">
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {selectedTip.matchDate ? new Date(selectedTip.matchDate).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : 'TBD'}
                        </div>
                        {selectedTip.league && (
                          <div className="flex items-center">
                            <Trophy className="w-4 h-4 mr-1" />
                            {selectedTip.league}
                          </div>
                        )}
                        {selectedTip.venue && (
                          <div className="flex items-center">
                            <MapPin className="w-4 h-4 mr-1" />
                            {selectedTip.venue}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Side - Main Prediction */}
                  <div className="text-center lg:text-right space-y-3">
                    <div className="text-slate-400 text-sm">Our Prediction</div>
                    {(selectedTip.predictionData as any)?.predictions?.recommended_bet && (
                      <>
                        <div className="text-3xl font-bold text-emerald-400">
                          {(selectedTip.predictionData as any).predictions.recommended_bet.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </div>
                        {(selectedTip.predictionData as any)?.predictions?.confidence && (
                          <div className="flex items-center justify-center lg:justify-end space-x-2">
                            <span className="text-slate-300">Confidence</span>
                            <span className="text-emerald-400 font-bold text-xl">
                              {((selectedTip.predictionData as any).predictions.confidence * 100).toFixed(1)}%
                                </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </Card>


              {/* AI Analysis Summary */}
              {(selectedTip.predictionData as any)?.analysis?.ai_summary && (
                <Card className="bg-slate-800 border-slate-700 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2 text-purple-400" />
                    AI Analysis Summary
                  </h3>
                  <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
                    <div className="text-slate-300 leading-relaxed whitespace-pre-line">
                      {(selectedTip.predictionData as any).analysis.ai_summary}
                          </div>
                  </div>
                </Card>
              )}

              {/* Team Analysis */}
              {(selectedTip.predictionData as any)?.analysis?.team_analysis && (
                <Card className="bg-slate-800 border-slate-700 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <Trophy className="w-5 h-5 mr-2 text-blue-400" />
                    Team Analysis
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Home Team */}
                    {(selectedTip.predictionData as any).analysis.team_analysis.home_team && (
                      <div className="space-y-4">
                        <h4 className="text-md font-medium text-white flex items-center">
                          <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
                          {selectedTip.homeTeam}
                        </h4>
                        <div className="space-y-3">
                          {/* Strengths */}
                          {(selectedTip.predictionData as any).analysis.team_analysis.home_team.strengths && (
                            <div>
                              <div className="text-sm text-green-400 font-medium mb-2">Strengths:</div>
                              <ul className="space-y-1">
                                {(selectedTip.predictionData as any).analysis.team_analysis.home_team.strengths.map((strength: string, index: number) => (
                                  <li key={index} className="text-slate-300 text-sm flex items-start">
                                    <span className="text-green-400 mr-2">•</span>
                                    {strength}
                                  </li>
                                ))}
                              </ul>
                  </div>
                          )}
                          
                          {/* Weaknesses */}
                          {(selectedTip.predictionData as any).analysis.team_analysis.home_team.weaknesses && (
                            <div>
                              <div className="text-sm text-red-400 font-medium mb-2">Weaknesses:</div>
                              <ul className="space-y-1">
                                {(selectedTip.predictionData as any).analysis.team_analysis.home_team.weaknesses.map((weakness: string, index: number) => (
                                  <li key={index} className="text-slate-300 text-sm flex items-start">
                                    <span className="text-red-400 mr-2">•</span>
                                    {weakness}
                                  </li>
                                ))}
                              </ul>
                      </div>
                    )}
                    
                          {/* Form Assessment */}
                          {(selectedTip.predictionData as any).analysis.team_analysis.home_team.form_assessment && (
                            <div>
                              <div className="text-sm text-blue-400 font-medium mb-2">Form Assessment:</div>
                              <div className="text-slate-300 text-sm">
                                {(selectedTip.predictionData as any).analysis.team_analysis.home_team.form_assessment}
                        </div>
                      </div>
                    )}
                    
                          {/* Injury Impact */}
                          {(selectedTip.predictionData as any).analysis.team_analysis.home_team.injury_impact && (
                            <div>
                              <div className="text-sm text-orange-400 font-medium mb-2">Injury Impact:</div>
                              <div className="text-slate-300 text-sm">
                                {(selectedTip.predictionData as any).analysis.team_analysis.home_team.injury_impact}
                        </div>
                          </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Away Team */}
                    {(selectedTip.predictionData as any).analysis.team_analysis.away_team && (
                  <div className="space-y-4">
                        <h4 className="text-md font-medium text-white flex items-center">
                          <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
                          {selectedTip.awayTeam}
                        </h4>
                        <div className="space-y-3">
                          {/* Strengths */}
                          {(selectedTip.predictionData as any).analysis.team_analysis.away_team.strengths && (
                            <div>
                              <div className="text-sm text-green-400 font-medium mb-2">Strengths:</div>
                              <ul className="space-y-1">
                                {(selectedTip.predictionData as any).analysis.team_analysis.away_team.strengths.map((strength: string, index: number) => (
                                  <li key={index} className="text-slate-300 text-sm flex items-start">
                                    <span className="text-green-400 mr-2">•</span>
                                    {strength}
                                  </li>
                                ))}
                              </ul>
                      </div>
                          )}
                          
                          {/* Weaknesses */}
                          {(selectedTip.predictionData as any).analysis.team_analysis.away_team.weaknesses && (
                            <div>
                              <div className="text-sm text-red-400 font-medium mb-2">Weaknesses:</div>
                              <ul className="space-y-1">
                                {(selectedTip.predictionData as any).analysis.team_analysis.away_team.weaknesses.map((weakness: string, index: number) => (
                                  <li key={index} className="text-slate-300 text-sm flex items-start">
                                    <span className="text-red-400 mr-2">•</span>
                                    {weakness}
                                  </li>
                                ))}
                              </ul>
                  </div>
                          )}

                          {/* Form Assessment */}
                          {(selectedTip.predictionData as any).analysis.team_analysis.away_team.form_assessment && (
                            <div>
                              <div className="text-sm text-blue-400 font-medium mb-2">Form Assessment:</div>
                              <div className="text-slate-300 text-sm">
                                {(selectedTip.predictionData as any).analysis.team_analysis.away_team.form_assessment}
                        </div>
                      </div>
                    )}
                    
                          {/* Injury Impact */}
                          {(selectedTip.predictionData as any).analysis.team_analysis.away_team.injury_impact && (
                            <div>
                              <div className="text-sm text-orange-400 font-medium mb-2">Injury Impact:</div>
                              <div className="text-slate-300 text-sm">
                                {(selectedTip.predictionData as any).analysis.team_analysis.away_team.injury_impact}
                        </div>
                      </div>
                    )}
                  </div>
                        </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Prediction Analysis */}
              {(selectedTip.predictionData as any)?.analysis?.prediction_analysis && (
              <Card className="bg-slate-800 border-slate-700 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <Target className="w-5 h-5 mr-2 text-yellow-400" />
                    Prediction Analysis
                  </h3>
                <div className="space-y-4">
                    {/* Model Assessment */}
                    {(selectedTip.predictionData as any).analysis.prediction_analysis.model_assessment && (
                      <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
                        <div className="text-yellow-400 font-medium mb-2">Model Assessment:</div>
                        <div className="text-slate-300">
                          {(selectedTip.predictionData as any).analysis.prediction_analysis.model_assessment}
                  </div>
                      </div>
                    )}

                    {/* Value Assessment */}
                    {(selectedTip.predictionData as any).analysis.prediction_analysis.value_assessment && (
                      <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
                        <div className="text-blue-400 font-medium mb-2">Value Assessment:</div>
                        <div className="text-slate-300">
                          {(selectedTip.predictionData as any).analysis.prediction_analysis.value_assessment}
                        </div>
                      </div>
                    )}

                    {/* Confidence Factors */}
                    {(selectedTip.predictionData as any).analysis.prediction_analysis.confidence_factors && (
                    <div>
                        <div className="text-green-400 font-medium mb-2">Confidence Factors:</div>
                      <ul className="space-y-1">
                          {(selectedTip.predictionData as any).analysis.prediction_analysis.confidence_factors.map((factor: string, index: number) => (
                          <li key={index} className="text-slate-300 text-sm flex items-start">
                              <span className="text-green-400 mr-2">•</span>
                              {factor}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                    {/* Risk Factors */}
                    {(selectedTip.predictionData as any).analysis.prediction_analysis.risk_factors && (
                    <div>
                        <div className="text-red-400 font-medium mb-2">Risk Factors:</div>
                        <ul className="space-y-1">
                          {(selectedTip.predictionData as any).analysis.prediction_analysis.risk_factors.map((risk: string, index: number) => (
                            <li key={index} className="text-slate-300 text-sm flex items-start">
                              <span className="text-red-400 mr-2">•</span>
                              {risk}
                            </li>
                          ))}
                        </ul>
                    </div>
                  )}
                </div>
              </Card>
              )}

              {/* Betting Recommendations */}
              {(selectedTip.predictionData as any)?.analysis?.betting_recommendations && (
                <Card className="bg-slate-800 border-slate-700 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <Shield className="w-5 h-5 mr-2 text-emerald-400" />
                    Betting Recommendations
                  </h3>
                    <div className="space-y-4">
                    {/* Primary Bet */}
                    {(selectedTip.predictionData as any).analysis.betting_recommendations.primary_bet && (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                        <div className="text-emerald-400 font-medium mb-2">Primary Recommendation:</div>
                        <div className="text-slate-200">
                          {(selectedTip.predictionData as any).analysis.betting_recommendations.primary_bet}
                          </div>
                          </div>
                    )}
                    
                    {/* Risk Level */}
                    {(selectedTip.predictionData as any).analysis.betting_recommendations.risk_level && (
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-400 font-medium">Risk Level:</span>
                        <Badge className={`${
                          (selectedTip.predictionData as any).analysis.betting_recommendations.risk_level === 'Low' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                          (selectedTip.predictionData as any).analysis.betting_recommendations.risk_level === 'Medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                          'bg-red-500/20 text-red-400 border-red-500/30'
                        }`}>
                          {(selectedTip.predictionData as any).analysis.betting_recommendations.risk_level}
                        </Badge>
                        </div>
                    )}

                    {/* Suggested Stake */}
                    {(selectedTip.predictionData as any).analysis.betting_recommendations.suggested_stake && (
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-400 font-medium">Suggested Stake:</span>
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                          {(selectedTip.predictionData as any).analysis.betting_recommendations.suggested_stake}
                        </Badge>
                        </div>
                    )}

                    {/* Alternative Bets */}
                    {(selectedTip.predictionData as any).analysis.betting_recommendations.alternative_bets && (
                      <div>
                        <div className="text-slate-400 font-medium mb-2">Alternative Options:</div>
                        <ul className="space-y-1">
                          {(selectedTip.predictionData as any).analysis.betting_recommendations.alternative_bets.map((bet: string, index: number) => (
                            <li key={index} className="text-slate-300 text-sm flex items-start">
                              <span className="text-blue-400 mr-2">•</span>
                              {bet}
                            </li>
                          ))}
                        </ul>
                                </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Additional Markets */}
              {(selectedTip.predictionData as any)?.additional_markets && (
                <Card className="bg-slate-800 border-slate-700 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <Target className="w-5 h-5 mr-2 text-orange-400" />
                    Additional Markets
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Total Goals */}
                    {(selectedTip.predictionData as any).additional_markets.total_goals && (
                      <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
                        <h5 className="text-white font-medium mb-3">Total Goals</h5>
                      <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Over 2.5:</span>
                            <span className="text-white font-medium">
                              {((selectedTip.predictionData as any).additional_markets.total_goals['over_2_5'] * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Under 2.5:</span>
                            <span className="text-white font-medium">
                              {((selectedTip.predictionData as any).additional_markets.total_goals['under_2_5'] * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Both Teams to Score */}
                    {(selectedTip.predictionData as any).additional_markets.both_teams_score && (
                      <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
                        <h5 className="text-white font-medium mb-3">Both Teams to Score</h5>
                      <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Yes:</span>
                            <span className="text-white font-medium">
                              {((selectedTip.predictionData as any).additional_markets.both_teams_score.yes * 100).toFixed(1)}%
                            </span>
                            </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">No:</span>
                            <span className="text-white font-medium">
                              {((selectedTip.predictionData as any).additional_markets.both_teams_score.no * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Asian Handicap */}
                    {(selectedTip.predictionData as any).additional_markets.asian_handicap && (
                      <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
                        <h5 className="text-white font-medium mb-3">Asian Handicap</h5>
                      <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Home -0.5:</span>
                            <span className="text-white font-medium">
                              {((selectedTip.predictionData as any).additional_markets.asian_handicap['home_-0.5'] * 100).toFixed(1)}%
                            </span>
                            </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Away +0.5:</span>
                            <span className="text-white font-medium">
                              {((selectedTip.predictionData as any).additional_markets.asian_handicap['away_+0.5'] * 100).toFixed(1)}%
                            </span>
                        </div>
                      </div>
                  </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Additional Markets V2 - Enhanced Condensed Display */}
              {(selectedTip.predictionData as any)?.additional_markets_v2 && (
                <Card className="bg-slate-800 border-slate-700 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2 text-purple-400" />
                    Advanced Markets Analysis
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* Totals Section */}
                    {(selectedTip.predictionData as any).additional_markets_v2.totals && (
                      <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
                        <h5 className="text-white font-medium mb-3 flex items-center">
                          <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                          Total Goals Markets
                        </h5>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          {Object.entries((selectedTip.predictionData as any).additional_markets_v2.totals).map(([key, value]: [string, any]) => (
                            <div key={key} className="space-y-1">
                              <div className="text-slate-400 text-xs font-medium">
                                {key.replace('_', '.').toUpperCase()}
                              </div>
                              <div className="space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-slate-300 text-xs">Over:</span>
                                  <span className="text-green-400 text-xs font-medium">
                                    {(value.over * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-300 text-xs">Under:</span>
                                  <span className="text-red-400 text-xs font-medium">
                                    {(value.under * 100).toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Team Totals Section */}
                    {(selectedTip.predictionData as any).additional_markets_v2.team_totals && (
                      <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
                        <h5 className="text-white font-medium mb-3 flex items-center">
                          <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                          Team Total Goals
                        </h5>
                        <div className="space-y-4">
                          {/* Home Team Totals */}
                          {(selectedTip.predictionData as any).additional_markets_v2.team_totals.home && (
                            <div>
                              <div className="text-slate-300 text-sm font-medium mb-2">{selectedTip.homeTeam}</div>
                              <div className="grid grid-cols-3 gap-2 text-xs">
                                {Object.entries((selectedTip.predictionData as any).additional_markets_v2.team_totals.home).map(([key, value]: [string, any]) => (
                                  <div key={key} className="space-y-1">
                                    <div className="text-slate-400">{key.replace('_', '.').toUpperCase()}</div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-300">O:</span>
                                      <span className="text-green-400">{(value.over * 100).toFixed(0)}%</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-300">U:</span>
                                      <span className="text-red-400">{(value.under * 100).toFixed(0)}%</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Away Team Totals */}
                          {(selectedTip.predictionData as any).additional_markets_v2.team_totals.away && (
                            <div>
                              <div className="text-slate-300 text-sm font-medium mb-2">{selectedTip.awayTeam}</div>
                              <div className="grid grid-cols-3 gap-2 text-xs">
                                {Object.entries((selectedTip.predictionData as any).additional_markets_v2.team_totals.away).map(([key, value]: [string, any]) => (
                                  <div key={key} className="space-y-1">
                                    <div className="text-slate-400">{key.replace('_', '.').toUpperCase()}</div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-300">O:</span>
                                      <span className="text-green-400">{(value.over * 100).toFixed(0)}%</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-300">U:</span>
                                      <span className="text-red-400">{(value.under * 100).toFixed(0)}%</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* BTTS Section */}
                    {(selectedTip.predictionData as any).additional_markets_v2.btts && (
                      <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
                        <h5 className="text-white font-medium mb-3 flex items-center">
                          <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                          Both Teams to Score
                        </h5>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center space-x-4">
                            <div className="text-center">
                              <div className="text-slate-400 text-xs">Yes</div>
                              <div className="text-green-400 font-bold text-lg">
                                {((selectedTip.predictionData as any).additional_markets_v2.btts.yes * 100).toFixed(1)}%
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-slate-400 text-xs">No</div>
                              <div className="text-red-400 font-bold text-lg">
                                {((selectedTip.predictionData as any).additional_markets_v2.btts.no * 100).toFixed(1)}%
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Double Chance Section */}
                    {(selectedTip.predictionData as any).additional_markets_v2.double_chance && (
                      <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
                        <h5 className="text-white font-medium mb-3 flex items-center">
                          <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                          Double Chance
                        </h5>
                        <div className="space-y-2">
                          {Object.entries((selectedTip.predictionData as any).additional_markets_v2.double_chance).map(([key, value]: [string, any]) => (
                            <div key={key} className="flex justify-between items-center">
                              <span className="text-slate-300 text-sm">
                                {key === '1X' ? 'Home or Draw' : key === '12' ? 'Home or Away' : key === 'X2' ? 'Draw or Away' : key}
                              </span>
                              <span className="text-white font-medium">
                                {(value * 100).toFixed(1)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Draw No Bet Section */}
                    {(selectedTip.predictionData as any).additional_markets_v2.dnb && (
                      <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
                        <h5 className="text-white font-medium mb-3 flex items-center">
                          <span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
                          Draw No Bet
                        </h5>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-300 text-sm">Home</span>
                            <span className="text-green-400 font-medium">
                              {((selectedTip.predictionData as any).additional_markets_v2.dnb.home * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-300 text-sm">Away</span>
                            <span className="text-red-400 font-medium">
                              {((selectedTip.predictionData as any).additional_markets_v2.dnb.away * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Asian Handicap Section */}
                    {(selectedTip.predictionData as any).additional_markets_v2.asian_handicap && (
                      <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
                        <h5 className="text-white font-medium mb-3 flex items-center">
                          <span className="w-2 h-2 bg-cyan-500 rounded-full mr-2"></span>
                          Asian Handicap
                        </h5>
                        <div className="space-y-3">
                          {/* Home Handicaps */}
                          {(selectedTip.predictionData as any).additional_markets_v2.asian_handicap.home && (
                            <div>
                              <div className="text-slate-300 text-sm font-medium mb-2">{selectedTip.homeTeam}</div>
                              <div className="space-y-1">
                                {Object.entries((selectedTip.predictionData as any).additional_markets_v2.asian_handicap.home).map(([key, value]: [string, any]) => {
                                  const handicap = key.replace('_minus_', '-').replace('_', '.');
                                  return (
                                    <div key={key} className="flex justify-between items-center text-xs">
                                      <span className="text-slate-300">{handicap}</span>
                                      <div className="flex space-x-2">
                                        <span className="text-green-400">W: {(value.win * 100).toFixed(0)}%</span>
                                        {value.push && <span className="text-yellow-400">P: {(value.push * 100).toFixed(0)}%</span>}
                                        <span className="text-red-400">L: {(value.lose * 100).toFixed(0)}%</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          
                          {/* Away Handicaps */}
                          {(selectedTip.predictionData as any).additional_markets_v2.asian_handicap.away && (
                            <div>
                              <div className="text-slate-300 text-sm font-medium mb-2">{selectedTip.awayTeam}</div>
                              <div className="space-y-1">
                                {Object.entries((selectedTip.predictionData as any).additional_markets_v2.asian_handicap.away).map(([key, value]: [string, any]) => {
                                  const handicap = key.replace('_plus_', '+').replace('_', '.');
                                  return (
                                    <div key={key} className="flex justify-between items-center text-xs">
                                      <span className="text-slate-300">{handicap}</span>
                                      <div className="flex space-x-2">
                                        <span className="text-green-400">W: {(value.win * 100).toFixed(0)}%</span>
                                        {value.push && <span className="text-yellow-400">P: {(value.push * 100).toFixed(0)}%</span>}
                                        <span className="text-red-400">L: {(value.lose * 100).toFixed(0)}%</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Winning Margin Section */}
                    {(selectedTip.predictionData as any).additional_markets_v2.winning_margin && (
                      <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
                        <h5 className="text-white font-medium mb-3 flex items-center">
                          <span className="w-2 h-2 bg-pink-500 rounded-full mr-2"></span>
                          Winning Margin
                        </h5>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {Object.entries((selectedTip.predictionData as any).additional_markets_v2.winning_margin).map(([key, value]: [string, any]) => (
                            <div key={key} className="flex justify-between items-center">
                              <span className="text-slate-300">
                                {key === '-3+' ? 'Home 3+' : key === '+3+' ? 'Away 3+' : key}
                              </span>
                              <span className="text-white font-medium">
                                {(value * 100).toFixed(1)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Correct Scores Section */}
                    {(selectedTip.predictionData as any).additional_markets_v2.correct_scores && (
                      <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
                        <h5 className="text-white font-medium mb-3 flex items-center">
                          <span className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></span>
                          Most Likely Scores
                        </h5>
                        <div className="space-y-1">
                          {(selectedTip.predictionData as any).additional_markets_v2.correct_scores.slice(0, 6).map((score: any, index: number) => (
                            <div key={index} className="flex justify-between items-center text-xs">
                              <span className="text-slate-300">{score.score}</span>
                              <span className="text-white font-medium">
                                {(score.p * 100).toFixed(1)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Odd/Even Total Section */}
                    {(selectedTip.predictionData as any).additional_markets_v2.odd_even_total && (
                      <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
                        <h5 className="text-white font-medium mb-3 flex items-center">
                          <span className="w-2 h-2 bg-teal-500 rounded-full mr-2"></span>
                          Odd/Even Total Goals
                        </h5>
                        <div className="flex justify-between items-center">
                          <div className="text-center">
                            <div className="text-slate-400 text-xs">Odd</div>
                            <div className="text-blue-400 font-bold">
                              {((selectedTip.predictionData as any).additional_markets_v2.odd_even_total.odd * 100).toFixed(1)}%
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-slate-400 text-xs">Even</div>
                            <div className="text-purple-400 font-bold">
                              {((selectedTip.predictionData as any).additional_markets_v2.odd_even_total.even * 100).toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Clean Sheet Section */}
                    {(selectedTip.predictionData as any).additional_markets_v2.clean_sheet && (
                      <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
                        <h5 className="text-white font-medium mb-3 flex items-center">
                          <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2"></span>
                          Clean Sheet Probability
                        </h5>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-300 text-sm">{selectedTip.homeTeam}</span>
                            <span className="text-green-400 font-medium">
                              {((selectedTip.predictionData as any).additional_markets_v2.clean_sheet.home * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-300 text-sm">{selectedTip.awayTeam}</span>
                            <span className="text-red-400 font-medium">
                              {((selectedTip.predictionData as any).additional_markets_v2.clean_sheet.away * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Win to Nil Section */}
                    {(selectedTip.predictionData as any).additional_markets_v2.win_to_nil && (
                      <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
                        <h5 className="text-white font-medium mb-3 flex items-center">
                          <span className="w-2 h-2 bg-rose-500 rounded-full mr-2"></span>
                          Win to Nil Probability
                        </h5>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-300 text-sm">{selectedTip.homeTeam}</span>
                            <span className="text-green-400 font-medium">
                              {((selectedTip.predictionData as any).additional_markets_v2.win_to_nil.home * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-300 text-sm">{selectedTip.awayTeam}</span>
                            <span className="text-red-400 font-medium">
                              {((selectedTip.predictionData as any).additional_markets_v2.win_to_nil.away * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Model Information */}
              {(selectedTip.predictionData as any)?.model_info && (
              <Card className="bg-slate-800 border-slate-700 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <Shield className="w-5 h-5 mr-2 text-purple-400" />
                    Model Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Model Type:</span>
                        <span className="text-white">{(selectedTip.predictionData as any).model_info.type}</span>
                    </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Version:</span>
                        <span className="text-white">{(selectedTip.predictionData as any).model_info.version}</span>
                  </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Performance:</span>
                        <span className="text-white">{(selectedTip.predictionData as any).model_info.performance}</span>
                    </div>
                  </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Quality Score:</span>
                        <span className="text-white">{(selectedTip.predictionData as any).model_info.quality_score ? ((selectedTip.predictionData as any).model_info.quality_score * 100).toFixed(1) + '%' : 'N/A'}</span>
                    </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Bookmaker Count:</span>
                        <span className="text-white">{(selectedTip.predictionData as any).model_info.bookmaker_count}</span>
                    </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Data Sources:</span>
                        <span className="text-white">{(selectedTip.predictionData as any).model_info.data_sources?.join(', ')}</span>
                    </div>
                    </div>
                </div>
              </Card>
              )}

              {/* Data Freshness */}
              {(selectedTip.predictionData as any)?.data_freshness && (
              <Card className="bg-slate-800 border-slate-700 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <Calendar className="w-5 h-5 mr-2 text-blue-400" />
                    Data Freshness
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-400">{(selectedTip.predictionData as any).data_freshness.h2h_matches}</div>
                      <div className="text-slate-400 text-sm">H2H Matches</div>
                  </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-400">{(selectedTip.predictionData as any).data_freshness.form_matches}</div>
                      <div className="text-slate-400 text-sm">Form Matches</div>
                  </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-400">{(selectedTip.predictionData as any).data_freshness.home_injuries}</div>
                      <div className="text-slate-400 text-sm">Home Injuries</div>
                  </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-400">{(selectedTip.predictionData as any).data_freshness.away_injuries}</div>
                      <div className="text-slate-400 text-sm">Away Injuries</div>
                </div>
                  </div>
                  {(selectedTip.predictionData as any).data_freshness.collection_time && (
                    <div className="mt-4 pt-4 border-t border-slate-600">
                      <div className="text-slate-400 text-sm">
                        Last Updated: {new Date((selectedTip.predictionData as any).data_freshness.collection_time).toLocaleString()}
                      </div>
                    </div>
                  )}
              </Card>
              )}


              {/* Regulatory Disclaimer */}
              <div className="text-center text-xs text-slate-500 bg-slate-800/50 p-3 rounded-lg">
                Predictions are estimates, not guarantees. Gamble responsibly 18+.
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
} 