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
      <h1 className="text-2xl font-bold text-white mb-6">My Purchased Predictions</h1>
      
      {tips.length === 0 ? (
        <Card className="bg-slate-800 border-slate-700 p-6 text-center">
          <p className="text-slate-400">You haven&apos;t purchased any predictions yet.</p>
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
                    <span className="text-slate-400">Price:</span>
                    <span className="text-emerald-400 font-medium">
                      {tip.currencySymbol}{tip.price}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm mt-1">
                    <span className="text-slate-400">Purchased:</span>
                    <span className="text-slate-300">
                      {new Date(tip.purchaseDate).toLocaleDateString()}
                    </span>
                  </div>
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
                    {selectedTip.predictionType && selectedTip.odds && typeof selectedTip.odds === 'number' ? (
                      <>
                        <div className="text-3xl font-bold text-emerald-400">
                          {getPredictionTypeLabel(selectedTip.predictionType)} @ {selectedTip.odds.toFixed(2)}
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
                    ) : (
                      <div className="text-xl text-slate-400">No prediction available</div>
                    )}
                  </div>
                </div>
              </Card>

              {/* 2. Probability Snapshot */}
              {selectedTip.predictionData && (
                <Card className="bg-slate-800 border-slate-700 p-6">
                  <h4 className="text-lg font-semibold text-white mb-4">Probability Assessment</h4>
                  <div className="grid grid-cols-3 gap-4">
                    {['home_win', 'draw', 'away_win'].map((type) => {
                      // Get probability from comprehensive analysis if available
                      const probability = selectedTip.predictionData?.comprehensive_analysis?.ai_verdict?.probability_assessment?.[type.replace('_win', '')] || 
                                        selectedTip.predictionData?.comprehensive_analysis?.ml_prediction?.[type] || 0
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
              {selectedTip.predictionData?.additional_markets && (
                <Card className="bg-slate-800 border-slate-700 p-6">
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2 text-emerald-400" />
                    Additional Markets
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Total Goals */}
                    {selectedTip.predictionData.additional_markets.total_goals && (
                      <div className="space-y-2">
                        <div className="text-sm text-slate-400 font-medium">Total Goals</div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-300">Over 2.5:</span>
                            <span className="text-emerald-400">{(selectedTip.predictionData.additional_markets.total_goals.over_2_5 * 100).toFixed(0)}%</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-300">Under 2.5:</span>
                            <span className="text-emerald-400">{(selectedTip.predictionData.additional_markets.total_goals.under_2_5 * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Both Teams Score */}
                    {selectedTip.predictionData.additional_markets.both_teams_score && (
                      <div className="space-y-2">
                        <div className="text-sm text-slate-400 font-medium">Both Teams Score</div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-300">Yes:</span>
                            <span className="text-emerald-400">{(selectedTip.predictionData.additional_markets.both_teams_score.yes * 100).toFixed(0)}%</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-300">No:</span>
                            <span className="text-emerald-400">{(selectedTip.predictionData.additional_markets.both_teams_score.no * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Asian Handicap */}
                    {selectedTip.predictionData.additional_markets.asian_handicap && (
                      <div className="space-y-2">
                        <div className="text-sm text-slate-400 font-medium">Asian Handicap</div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-300">Home:</span>
                            <span className="text-emerald-400">{selectedTip.predictionData.additional_markets.asian_handicap.home_handicap}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-300">Away:</span>
                            <span className="text-emerald-400">{selectedTip.predictionData.additional_markets.asian_handicap.away_handicap}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* 4. Quick AI Synopsis */}
              {selectedTip.analysisSummary && (
                <Card className="bg-slate-800 border-slate-700 p-6">
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <Target className="w-5 h-5 mr-2 text-emerald-400" />
                    AI Analysis
                  </h4>
                  <div className="space-y-4">
                    <p className="text-slate-300 leading-relaxed">{selectedTip.analysisSummary}</p>
                    
                    {/* Confidence Breakdown */}
                    {selectedTip.predictionData?.comprehensive_analysis?.confidence_breakdown && (
                      <div className="space-y-2">
                        <div className="text-sm text-slate-400 font-medium">Confidence Breakdown:</div>
                        <p className="text-slate-300 text-sm leading-relaxed">
                          {selectedTip.predictionData.comprehensive_analysis.confidence_breakdown}
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* 5. Detailed Reasoning */}
              {selectedTip.predictionData?.comprehensive_analysis?.detailed_reasoning && (
                <Card className="bg-slate-800 border-slate-700 p-6">
                  <h4 className="text-lg font-semibold text-white mb-4">Detailed Reasoning</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 space-y-4">
                    {Object.entries(selectedTip.predictionData.comprehensive_analysis.detailed_reasoning).map(([key, value]) => (
                      <div key={key} className="space-y-2">
                        <div className="text-sm text-slate-400 font-medium capitalize">
                          {key.replace(/_/g, ' ')}:
                        </div>
                        <div className="text-slate-300 text-sm">
                          {value as string}
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
                    {/* Primary Bet */}
                    {selectedTip.predictionData?.comprehensive_analysis?.betting_intelligence?.primary_bet && (
                      <div className="space-y-2">
                        <div className="text-sm text-slate-400 font-medium">Primary Bet:</div>
                        <div className="text-emerald-400 text-sm">
                          {selectedTip.predictionData.comprehensive_analysis.betting_intelligence.primary_bet}
                        </div>
                      </div>
                    )}

                    {/* Value Bets */}
                    {selectedTip.predictionData?.comprehensive_analysis?.betting_intelligence?.value_bets && (
                      <div className="space-y-2">
                        <div className="text-sm text-slate-400 font-medium">Value Bets:</div>
                        <div className="space-y-1">
                          {selectedTip.predictionData.comprehensive_analysis.betting_intelligence.value_bets.map((bet: string, index: number) => (
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

                <Card className="bg-slate-800 border-slate-700 p-6">
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <span className="text-2xl mr-2">🚫</span>
                    Avoid Bets
                  </h4>
                  <div className="space-y-2">
                    {selectedTip.predictionData?.comprehensive_analysis?.betting_intelligence?.avoid_bets ? (
                      selectedTip.predictionData.comprehensive_analysis.betting_intelligence.avoid_bets.map((bet: string, index: number) => (
                        <div key={index} className="text-slate-300 text-sm flex items-center">
                          <span className="text-red-400 mr-2">•</span>
                          {bet}
                        </div>
                      ))
                    ) : (
                      <div className="text-slate-400 text-sm">No specific bets to avoid</div>
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
                      {selectedTip.predictionData?.comprehensive_analysis?.risk_analysis?.overall_risk || selectedTip.valueRating || 'Unknown'}
                    </Badge>
                  </div>
                  
                  {/* Key Risks */}
                  {selectedTip.predictionData?.comprehensive_analysis?.risk_analysis?.key_risks && (
                    <div>
                      <div className="text-sm text-slate-400 mb-2">Key Risks:</div>
                      <ul className="space-y-1">
                        {selectedTip.predictionData.comprehensive_analysis.risk_analysis.key_risks.map((risk: string, index: number) => (
                          <li key={index} className="text-slate-300 text-sm flex items-start">
                            <span className="text-orange-400 mr-2">•</span>
                            {risk}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* Upset Potential */}
                  {selectedTip.predictionData?.comprehensive_analysis?.risk_analysis?.upset_potential && (
                    <div>
                      <span className="text-slate-400 text-sm">Upset Potential: </span>
                      <span className="text-slate-300 text-sm">{selectedTip.predictionData.comprehensive_analysis.risk_analysis.upset_potential}</span>
                    </div>
                  )}
                </div>
              </Card>

              {/* 8. Action Buttons */}
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

              {/* 9. Match & Analysis Metadata */}
              <Card className="bg-slate-800 border-slate-700 p-6">
                <h4 className="text-lg font-semibold text-white mb-4">Analysis Metadata</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-400">Analysis timestamp:</span>
                    <div className="text-slate-300">
                      {selectedTip.predictionData?.comprehensive_analysis?.analysis_metadata?.analysis_timestamp ? 
                        new Date(selectedTip.predictionData.comprehensive_analysis.analysis_metadata.analysis_timestamp).toLocaleDateString('en-US', {
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
                      {selectedTip.predictionData?.comprehensive_analysis?.analysis_metadata?.data_sources?.join(' • ') || 'ML model • injury reports • team news • tactical DB'}
                    </div>
                  </div>
                  {selectedTip.predictionData?.comprehensive_analysis?.analysis_metadata?.ml_model_accuracy && (
                    <div>
                      <span className="text-slate-400">ML model accuracy:</span>
                      <div className="text-slate-300">{selectedTip.predictionData.comprehensive_analysis.analysis_metadata.ml_model_accuracy} back-test</div>
                    </div>
                  )}
                  {selectedTip.predictionData?.comprehensive_analysis?.analysis_metadata?.processing_time && (
                    <div>
                      <span className="text-slate-400">Processing time:</span>
                      <div className="text-slate-300">{selectedTip.predictionData.comprehensive_analysis.analysis_metadata.processing_time}s</div>
                    </div>
                  )}
                  {selectedTip.predictionData?.comprehensive_analysis?.analysis_metadata?.ai_model && (
                    <div>
                      <span className="text-slate-400">AI Model:</span>
                      <div className="text-slate-300">{selectedTip.predictionData.comprehensive_analysis.analysis_metadata.ai_model}</div>
                    </div>
                  )}
                  {selectedTip.predictionData?.comprehensive_analysis?.analysis_metadata?.analysis_type && (
                    <div>
                      <span className="text-slate-400">Analysis Type:</span>
                      <div className="text-slate-300">{selectedTip.predictionData.comprehensive_analysis.analysis_metadata.analysis_type.replace(/_/g, ' ')}</div>
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
                    <span className="text-slate-300">AI Sports Tipster</span>
                  </div>
                  <div className="text-center text-slate-400 pt-2 border-t border-slate-700">
                    Need help? support@aisportstipster.com | T&Cs
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