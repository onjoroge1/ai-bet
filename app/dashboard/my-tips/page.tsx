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
  predictionData: any | null
  // Formatted prediction data for frontend components
  prediction: {
    match: any
    prediction: string
    odds: string
    confidence: number
    analysis: string
    valueRating: string
    detailedReasoning: string[]
    extraMarkets: any[]
    thingsToAvoid: string[]
    riskLevel: string
    confidenceStars: number
    probabilitySnapshot: any
    aiVerdict: any
    mlPrediction: any
    riskAnalysis: any
    bettingIntelligence: any
    confidenceBreakdown: string
    additionalMarkets: any
    analysisMetadata: any
    processingTime: number
    timestamp: string
  } | null
  // Additional credit claim info
  expiresAt?: string | null
  status?: string | null
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
      const response = await fetch("/api/my-tips")
      if (!response.ok) throw new Error("Failed to fetch tips")
      const data = await response.json()
      setTips(data)
    } catch (error) {
      console.error("Error fetching tips:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleViewPrediction = (tip: Tip) => {
    setSelectedTip(tip)
    setShowPrediction(true)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold text-white mb-6">My Predictions</h1>
      
      {tips.length === 0 ? (
        <Card className="bg-slate-800 border-slate-700 p-6 text-center">
          <p className="text-slate-400">You haven&apos;t purchased or claimed any predictions yet.</p>
          <p className="text-slate-500 text-sm mt-2">Start by claiming tips with credits or purchasing premium predictions!</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tips.map((tip) => (
            <Card 
              key={tip.id} 
              className="bg-slate-800 border-slate-700 p-4 hover:border-emerald-500 transition-colors cursor-pointer"
              onClick={() => handleViewPrediction(tip)}
            >
              <div className="space-y-4">
                {/* Match Teams */}
                <div className="text-center">
                  <div className="flex items-center justify-between text-sm text-slate-400 mb-2">
                    <Calendar className="w-4 h-4" />
                    <span>{formatMatchDate(tip.matchDate)}</span>
                  </div>
                  <div className="text-white font-semibold text-lg">
                    {tip.homeTeam} vs {tip.awayTeam}
                  </div>
                  {tip.league && (
                    <div className="flex items-center justify-center text-slate-400 text-sm mt-1">
                      <Trophy className="w-4 h-4 mr-1" />
                      {tip.league}
                    </div>
                  )}
                </div>

                {/* Prediction Info */}
                {tip.predictionType && (
                  <div className="text-center">
                    <Badge className="bg-emerald-600 text-white mb-2">
                      {getPredictionTypeLabel(tip.predictionType)}
                    </Badge>
                    {tip.confidenceScore && (
                      <div className="text-emerald-400 text-sm">
                        Confidence: {tip.confidenceScore}%
                      </div>
                    )}
                    {tip.valueRating && (
                      <Badge className={`${getValueRatingColor(tip.valueRating)} text-white text-xs ml-2`}>
                        {tip.valueRating} Value
                      </Badge>
                    )}
                  </div>
                )}

                {/* Purchase Info */}
                <div className="border-t border-slate-700 pt-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400">
                      {tip.tipType === 'credit_claim' ? 'Cost:' : 'Price:'}
                    </span>
                    <span className="text-emerald-400 font-medium">
                      {tip.tipType === 'credit_claim' 
                        ? `${tip.currencySymbol}${tip.creditsSpent} credit${tip.creditsSpent !== 1 ? 's' : ''}`
                        : `${tip.currencySymbol}${tip.price}`
                      }
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm mt-1">
                    <span className="text-slate-400">
                      {tip.tipType === 'credit_claim' ? 'Claimed:' : 'Purchased:'}
                    </span>
                    <span className="text-slate-300">
                      {new Date(tip.purchaseDate).toLocaleDateString()}
                    </span>
                  </div>
                  {tip.tipType === 'credit_claim' && tip.expiresAt && (
                    <div className="flex justify-between items-center text-sm mt-1">
                      <span className="text-slate-400">Expires:</span>
                      <span className="text-orange-400">
                        {new Date(tip.expiresAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                <Button 
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleViewPrediction(tip)
                  }}
                >
                  View Prediction
                </Button>
              </div>
            </Card>
          ))}
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

              {/* 1. Hero Section (The Bet) */}
              <Card className="bg-gradient-to-r from-slate-800 to-slate-700 border-slate-600 p-6">
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
                          {formatMatchDate(selectedTip.matchDate)}
                        </div>
                        {selectedTip.league && (
                          <div className="flex items-center">
                            <Trophy className="w-4 h-4 mr-1" />
                            {selectedTip.league}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Side - Recommended Bet */}
                  <div className="text-center lg:text-right space-y-3">
                    <div className="text-slate-400 text-sm">Recommended Bet</div>
                    {selectedTip.predictionType && selectedTip.odds ? (
                      <>
                        <div className="text-3xl font-bold text-emerald-400">
                          {getPredictionTypeLabel(selectedTip.predictionType)} @ {typeof selectedTip.odds === 'number' ? selectedTip.odds.toFixed(2) : selectedTip.odds}
                        </div>
                        {selectedTip.confidenceScore && (
                          <div className="flex items-center justify-center lg:justify-end space-x-2">
                            <span className="text-slate-300">Confidence</span>
                            <div className="flex space-x-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <span key={star} className="text-yellow-400">
                                  {star <= Math.ceil(selectedTip.confidenceScore! / 20) ? '★' : '☆'}
                                </span>
                              ))}
                            </div>
                            <span className="text-emerald-400 font-medium">({selectedTip.confidenceScore}%)</span>
                          </div>
                        )}
                      </>
                    ) : selectedTip.prediction?.prediction ? (
                      <>
                        <div className="text-3xl font-bold text-emerald-400">
                          {selectedTip.prediction.prediction.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} @ {selectedTip.prediction.odds}
                        </div>
                        {selectedTip.prediction?.confidence && (
                          <div className="flex items-center justify-center lg:justify-end space-x-2">
                            <span className="text-slate-300">Confidence</span>
                            <div className="flex space-x-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <span key={star} className="text-yellow-400">
                                  {star <= Math.ceil(selectedTip.prediction!.confidence / 20) ? '★' : '☆'}
                                </span>
                              ))}
                            </div>
                            <span className="text-emerald-400 font-medium">({selectedTip.prediction!.confidence}%)</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-xl text-slate-400">No prediction available</div>
                    )}
                  </div>
                </div>
              </Card>

              {/* 2. Probability Snapshot */}
              {selectedTip.prediction && (
                <Card className="bg-slate-800 border-slate-700 p-6">
                  <h4 className="text-lg font-semibold text-white mb-4">Probability Assessment</h4>
                  <div className="grid grid-cols-3 gap-4">
                    {['home_win', 'draw', 'away_win'].map((type) => {
                      // Get probability from formatted prediction data
                      const probability = selectedTip.prediction?.probabilitySnapshot?.[type.replace('_win', '')] || 0
                      const percentage = (probability * 100).toFixed(0)
                      const isSelected = selectedTip.predictionType === type
                      return (
                        <div key={type} className={`text-center p-4 rounded-lg ${isSelected ? 'bg-emerald-600/20 border-emerald-500' : 'bg-slate-700/50 border-slate-600'} border`}>
                          <div className="text-sm text-slate-400 mb-1">{getPredictionTypeLabel(type)}</div>
                          <div className="text-2xl font-bold text-white">{percentage}%</div>
                          <div className="w-full bg-slate-600 rounded-full h-2 mt-2">
                            <div 
                              className={`h-2 rounded-full ${isSelected ? 'bg-emerald-500' : 'bg-slate-500'}`}
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              )}

              {/* 3. Additional Markets */}
              {selectedTip.prediction?.extraMarkets && selectedTip.prediction.extraMarkets.length > 0 && (
                <Card className="bg-slate-800/50 border-slate-600 p-6">
                  <div className="flex items-center space-x-2 mb-4">
                    <Target className="w-5 h-5 text-blue-400" />
                    <h3 className="text-lg font-semibold text-white">Additional Markets</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedTip.prediction?.extraMarkets.map((market, index) => (
                      <div key={index} className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white font-medium text-sm">{market.market}</span>
                          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                            {market.probability != null ? market.probability : 0}%
                          </Badge>
                        </div>
                        <div className="text-emerald-400 font-semibold text-sm mb-1">
                          {market.prediction}
                        </div>
                        <div className="text-slate-400 text-xs">
                          {market.reasoning}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* 4. AI Analysis */}
              {selectedTip.prediction?.analysis && (
                <Card className="bg-slate-800 border-slate-700 p-6">
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <Target className="w-5 h-5 mr-2 text-emerald-400" />
                    AI Analysis
                  </h4>
                  <div className="space-y-4">
                    <p className="text-slate-300 leading-relaxed">{selectedTip.prediction.analysis}</p>
                    
                    {/* Confidence Breakdown */}
                    {selectedTip.prediction?.confidenceStars && (
                      <div className="space-y-2">
                        <div className="text-sm text-slate-400 font-medium">Confidence Rating:</div>
                        <div className="flex space-x-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <span key={star} className="text-yellow-400">
                              {star <= (selectedTip.prediction?.confidenceStars || 0) ? '★' : '☆'}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* 5. Detailed Reasoning */}
              {selectedTip.prediction?.detailedReasoning && selectedTip.prediction.detailedReasoning.length > 0 && (
                <Card className="bg-slate-800 border-slate-700 p-6">
                  <h4 className="text-lg font-semibold text-white mb-4">Detailed Reasoning</h4>
                  <div className="space-y-4">
                    {selectedTip.prediction.detailedReasoning.map((reasoning: string, index: number) => (
                      <div key={index} className="space-y-2">
                        <div className="text-slate-300 text-sm leading-relaxed">
                          {reasoning}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* 6. Value-Adds & Warnings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-slate-800 border-slate-700 p-6">
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <span className="text-2xl mr-2">💎</span>
                    Betting Intelligence
                  </h4>
                  <div className="space-y-4">
                    {/* Value Rating */}
                    {selectedTip.prediction?.valueRating && (
                      <div className="space-y-2">
                        <div className="text-sm text-slate-400 font-medium">Value Rating:</div>
                        <div className="text-emerald-400 text-sm">
                          {selectedTip.prediction.valueRating}
                        </div>
                      </div>
                    )}
                    
                    {/* Risk Level */}
                    {selectedTip.prediction?.riskLevel && (
                      <div className="space-y-2">
                        <div className="text-sm text-slate-400 font-medium">Risk Level:</div>
                        <div className="text-orange-400 text-sm">
                          {selectedTip.prediction.riskLevel}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

                <Card className="bg-slate-800 border-slate-700 p-6">
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <Shield className="w-5 h-5 mr-2 text-red-400" />
                    Things to Avoid
                  </h4>
                  <div className="space-y-2">
                    {selectedTip.prediction?.thingsToAvoid && selectedTip.prediction.thingsToAvoid.length > 0 ? (
                      selectedTip.prediction.thingsToAvoid.map((warning: string, index: number) => (
                        <div key={index} className="flex items-start space-x-2">
                          <span className="text-red-400 text-sm">•</span>
                          <span className="text-slate-300 text-sm">{warning}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-400 text-sm">No specific warnings for this prediction.</p>
                    )}
                  </div>
                </Card>
              </div>

              {/* 7. Risk Assessment */}
              <Card className="bg-slate-800 border-slate-700 p-6">
                <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <Shield className="w-5 h-5 mr-2 text-orange-400" />
                  Risk Assessment
                </h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Overall Risk:</span>
                    <Badge className={`${getValueRatingColor(selectedTip.valueRating)} text-white`}>
                      {selectedTip.prediction?.riskAnalysis?.overall_risk || selectedTip.valueRating || 'Unknown'}
                    </Badge>
                  </div>
                  
                  {/* Key Risks */}
                  {selectedTip.prediction?.riskAnalysis?.key_risks && (
                    <div>
                      <div className="text-sm text-slate-400 mb-2">Key Risks:</div>
                      <ul className="space-y-1">
                        {selectedTip.prediction.riskAnalysis.key_risks.map((risk: string, index: number) => (
                          <li key={index} className="text-slate-300 text-sm flex items-start">
                            <span className="text-orange-400 mr-2">•</span>
                            {risk}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* Upset Potential */}
                  {selectedTip.prediction?.riskAnalysis?.upset_potential && (
                    <div>
                      <span className="text-slate-400 text-sm">Upset Potential: </span>
                      <span className="text-slate-300 text-sm">{selectedTip.prediction.riskAnalysis.upset_potential}</span>
                    </div>
                  )}
                </div>
              </Card>

              {/* 8. AI Verdict & ML Prediction */}
              {selectedTip.prediction?.aiVerdict && (
                <Card className="bg-slate-800 border-slate-700 p-6">
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <Target className="w-5 h-5 mr-2 text-blue-400" />
                    AI Verdict & ML Prediction
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* AI Verdict */}
                    <div className="space-y-3">
                      <h5 className="text-md font-medium text-white">AI Verdict</h5>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Recommended Outcome:</span>
                          <span className="text-emerald-400 font-medium">{selectedTip.prediction.aiVerdict.recommended_outcome}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Confidence Level:</span>
                          <span className="text-blue-400">{selectedTip.prediction.aiVerdict.confidence_level}</span>
                        </div>
                        {selectedTip.prediction.aiVerdict.probability_assessment && (
                          <div className="space-y-1">
                            <div className="text-sm text-slate-400">Probability Assessment:</div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div className="text-center">
                                <div className="text-slate-300">Home</div>
                                <div className="text-emerald-400">{(selectedTip.prediction.aiVerdict.probability_assessment.home * 100).toFixed(0)}%</div>
                              </div>
                              <div className="text-center">
                                <div className="text-slate-300">Draw</div>
                                <div className="text-yellow-400">{(selectedTip.prediction.aiVerdict.probability_assessment.draw * 100).toFixed(0)}%</div>
                              </div>
                              <div className="text-center">
                                <div className="text-slate-300">Away</div>
                                <div className="text-red-400">{(selectedTip.prediction.aiVerdict.probability_assessment.away * 100).toFixed(0)}%</div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ML Prediction */}
                    {selectedTip.prediction?.mlPrediction && (
                      <div className="space-y-3">
                        <h5 className="text-md font-medium text-white">ML Prediction</h5>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Model Type:</span>
                            <span className="text-purple-400">{selectedTip.prediction.mlPrediction.model_type}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Confidence:</span>
                            <span className="text-emerald-400">{selectedTip.prediction.mlPrediction.confidence.toFixed(1)}%</span>
                          </div>
                          <div className="space-y-1">
                            <div className="text-sm text-slate-400">Predictions:</div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div className="text-center">
                                <div className="text-slate-300">Home Win</div>
                                <div className="text-emerald-400">{(selectedTip.prediction.mlPrediction.home_win * 100).toFixed(0)}%</div>
                              </div>
                              <div className="text-center">
                                <div className="text-slate-300">Draw</div>
                                <div className="text-yellow-400">{(selectedTip.prediction.mlPrediction.draw * 100).toFixed(0)}%</div>
                              </div>
                              <div className="text-center">
                                <div className="text-slate-300">Away Win</div>
                                <div className="text-red-400">{(selectedTip.prediction.mlPrediction.away_win * 100).toFixed(0)}%</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* 9. Betting Intelligence */}
              {selectedTip.prediction?.bettingIntelligence && (
                <Card className="bg-slate-800 border-slate-700 p-6">
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <span className="text-2xl mr-2">💎</span>
                    Betting Intelligence
                  </h4>
                  <div className="space-y-4">
                    {/* Primary Bet */}
                    {selectedTip.prediction.bettingIntelligence.primary_bet && (
                      <div className="space-y-2">
                        <div className="text-sm text-slate-400 font-medium">Primary Bet:</div>
                        <div className="text-emerald-400 text-sm">
                          {selectedTip.prediction.bettingIntelligence.primary_bet}
                        </div>
                      </div>
                    )}
                    
                    {/* Value Bets */}
                    {selectedTip.prediction.bettingIntelligence.value_bets && selectedTip.prediction.bettingIntelligence.value_bets.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-sm text-slate-400 font-medium">Value Bets:</div>
                        <div className="space-y-1">
                          {selectedTip.prediction.bettingIntelligence.value_bets.map((bet: string, index: number) => (
                            <div key={index} className="text-slate-300 text-sm flex items-center">
                              <span className="text-emerald-400 mr-2">•</span>
                              {bet}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* 10. Confidence Breakdown */}
              {selectedTip.prediction?.confidenceBreakdown && (
                <Card className="bg-slate-800 border-slate-700 p-6">
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <Target className="w-5 h-5 mr-2 text-yellow-400" />
                    Confidence Breakdown
                  </h4>
                  <div className="space-y-4">
                    <p className="text-slate-300 leading-relaxed">{selectedTip.prediction.confidenceBreakdown}</p>
                  </div>
                </Card>
              )}

              {/* 11. Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <Button className="bg-emerald-600 hover:bg-emerald-700 flex-1">
                  Add to Bet-slip
                </Button>
                <Button variant="outline" className="border-slate-600 text-slate-300">
                  Share Pick
                </Button>
                <Button variant="outline" className="border-slate-600 text-slate-300">
                  Set Result Alert
                </Button>
              </div>

              {/* 12. Match & Analysis Metadata */}
              <Card className="bg-slate-800 border-slate-700 p-6">
                <h4 className="text-lg font-semibold text-white mb-4">Analysis Metadata</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-400">Analysis timestamp:</span>
                    <div className="text-slate-300">
                      {selectedTip.prediction?.analysisMetadata?.analysis_timestamp ? 
                        new Date(selectedTip.prediction.analysisMetadata.analysis_timestamp).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) + ' UTC' :
                        new Date(selectedTip.purchaseDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) + ' UTC'
                      }
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400">Data sources:</span>
                    <div className="text-slate-300">
                      {selectedTip.prediction?.analysisMetadata?.data_sources?.join(' • ') || 'ML model • injury reports • team news • tactical DB'}
                    </div>
                  </div>
                  {selectedTip.prediction?.analysisMetadata?.ml_model_accuracy && (
                    <div>
                      <span className="text-slate-400">ML model accuracy:</span>
                      <div className="text-slate-300">{selectedTip.prediction.analysisMetadata.ml_model_accuracy} back-test</div>
                    </div>
                  )}
                  {selectedTip.prediction?.processingTime && (
                    <div>
                      <span className="text-slate-400">Processing time:</span>
                      <div className="text-slate-300">{selectedTip.prediction.processingTime}s</div>
                    </div>
                  )}
                  {selectedTip.prediction?.analysisMetadata?.ai_model && (
                    <div>
                      <span className="text-slate-400">AI Model:</span>
                      <div className="text-slate-300">{selectedTip.prediction.analysisMetadata.ai_model}</div>
                    </div>
                  )}
                  {selectedTip.prediction?.analysisMetadata?.analysis_type && (
                    <div>
                      <span className="text-slate-400">Analysis Type:</span>
                      <div className="text-slate-300">{selectedTip.prediction.analysisMetadata.analysis_type.replace(/_/g, ' ')}</div>
                    </div>
                  )}
                </div>
              </Card>

              {/* 10. Transaction Footer */}
              <Card className="bg-slate-800 border-slate-700 p-6">
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">You paid:</span>
                    <span className="text-emerald-400 font-medium">
                      {selectedTip.currencySymbol}{selectedTip.amount} (Premium Tip)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Payment method:</span>
                    <span className="text-slate-300">**** 1234 • {selectedTip.paymentMethod}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Billed by:</span>
                    <span className="text-slate-300">SnapBet</span>
                  </div>
                  <div className="text-center text-slate-400 pt-2 border-t border-slate-700">
                    Need help? support@snapbet.com | T&Cs
                  </div>
                </div>
              </Card>

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