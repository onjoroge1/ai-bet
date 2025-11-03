"use client"

import { useState } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Trophy, TrendingUp, Target, Shield, Brain, ChevronDown, ChevronUp, Lock, Unlock, ExternalLink, CheckCircle, X } from "lucide-react"

interface PredictionCardProps {
  mode: 'preview' | 'compact' | 'full'
  prediction: any // FullPrediction type
  matchData: any // MatchData type
  isPurchased: boolean
  quickPurchaseInfo?: {
    confidenceScore?: number | null
    valueRating?: string | null
    analysisSummary?: string | null
    predictionType?: string | null
    name?: string
  }
  onPurchaseClick?: () => void
  onViewDetails?: () => void
  purchaseSource?: 'match_detail' | 'my_tips'
}

/**
 * Unified Prediction Card Component
 * Works in preview (pre-purchase), compact, and full modes
 * Matches my-tips page design for consistency
 */
export function PredictionCard({
  mode = 'full',
  prediction,
  matchData,
  isPurchased,
  quickPurchaseInfo,
  onPurchaseClick,
  onViewDetails,
  purchaseSource = 'match_detail'
}: PredictionCardProps) {
  const [isExpanded, setIsExpanded] = useState(isPurchased) // Auto-expand if purchased

  // Preview mode: Show limited info + purchase CTA
  if (mode === 'preview') {
    return (
      <Card className="bg-slate-800/60 border-slate-700">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-400" />
              <h2 className="text-xl font-bold text-white">Premium V2 Prediction</h2>
            </div>
            <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/40">Premium</Badge>
          </div>

          {/* Preview Info */}
          <div className="space-y-4 mb-6">
            {quickPurchaseInfo?.confidenceScore && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-slate-400 text-sm mb-1">Confidence</div>
                  <div className="text-2xl font-bold text-emerald-400">
                    {quickPurchaseInfo.confidenceScore}%
                  </div>
                </div>
                {quickPurchaseInfo.valueRating && (
                  <div>
                    <div className="text-slate-400 text-sm mb-1">Value Rating</div>
                    <Badge className={`${
                      quickPurchaseInfo.valueRating.toLowerCase() === 'very high' ? 'bg-red-500' :
                      quickPurchaseInfo.valueRating.toLowerCase() === 'high' ? 'bg-orange-500' :
                      quickPurchaseInfo.valueRating.toLowerCase() === 'medium' ? 'bg-yellow-500' :
                      'bg-green-500'
                    } text-white`}>
                      {quickPurchaseInfo.valueRating}
                    </Badge>
                  </div>
                )}
              </div>
            )}

            {quickPurchaseInfo?.analysisSummary && (
              <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600">
                <p className="text-slate-300 text-sm line-clamp-2">{quickPurchaseInfo.analysisSummary}</p>
              </div>
            )}
          </div>

          {/* What's Included */}
          <div className="border-t border-slate-700 pt-4 mb-6">
            <div className="text-slate-400 text-sm mb-2">What's Included:</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2 text-slate-300">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></div>
                Full V2 AI Analysis
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></div>
                Team Analysis
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></div>
                Advanced Markets
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></div>
                Risk Assessment
              </div>
            </div>
          </div>

          {/* Purchase Button */}
          {onPurchaseClick && (
            <Button 
              onClick={onPurchaseClick}
              className="w-full bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 text-white font-semibold"
              size="lg"
            >
              <Lock className="w-4 h-4 mr-2" />
              Unlock Full Analysis
            </Button>
          )}
        </div>
      </Card>
    )
  }

  // Compact mode: Collapsed card with expand option
  if (mode === 'compact') {
    return (
      <Card className="bg-slate-800/60 border-slate-700 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Unlock className="w-4 h-4 text-emerald-400" />
              <h3 className="text-lg font-bold text-white">Premium Analysis</h3>
            </div>
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </div>
          
          {!isExpanded && (
            <div className="flex items-center gap-4 text-sm">
              {quickPurchaseInfo?.confidenceScore && (
                <div className="text-emerald-400">
                  {quickPurchaseInfo.confidenceScore}% Confidence
                </div>
              )}
              {quickPurchaseInfo?.valueRating && (
                <Badge className={`${
                  quickPurchaseInfo.valueRating.toLowerCase() === 'very high' ? 'bg-red-500' :
                  quickPurchaseInfo.valueRating.toLowerCase() === 'high' ? 'bg-orange-500' :
                  quickPurchaseInfo.valueRating.toLowerCase() === 'medium' ? 'bg-yellow-500' :
                  'bg-green-500'
                } text-white text-xs`}>
                  {quickPurchaseInfo.valueRating}
                </Badge>
              )}
            </div>
          )}
        </div>

        {isExpanded && (
          <FullAnalysisDisplay prediction={prediction} matchData={matchData} />
        )}
      </Card>
    )
  }

  // Full mode: Complete analysis display
  return (
    <div className="space-y-6">
      {/* Hero Section - Recommended Bet (only for non-finished matches) */}
      {prediction.predictions?.recommended_bet && (
        <Card className="bg-gradient-to-r from-emerald-800/30 to-blue-800/30 border-emerald-500/30">
          <div className="p-6">
            <div className="text-center">
              <div className="text-slate-400 text-sm mb-2">Recommended Bet</div>
              <div className="text-3xl font-bold text-emerald-400 mb-2">
                {prediction.predictions.recommended_bet.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
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

      {/* Full Analysis Sections */}
      <FullAnalysisDisplay prediction={prediction} matchData={matchData} />

      {/* Action Buttons */}
      {purchaseSource === 'match_detail' && (
        <div className="flex gap-3">
          <Link href="/dashboard/my-tips">
            <Button variant="outline" className="border-slate-600 text-slate-300">
              <ExternalLink className="w-4 h-4 mr-2" />
              View in My Tips
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}

/**
 * Full Analysis Display Component
 * Contains all prediction analysis sections
 */
function FullAnalysisDisplay({ prediction, matchData }: { prediction: any, matchData: any }) {
  return (
    <div className="space-y-6">
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
                    {prediction.analysis.prediction_analysis.confidence_factors.map((factor: string, index: number) => (
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
                    {prediction.analysis.prediction_analysis.risk_factors.map((risk: string, index: number) => (
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
                    {prediction.analysis.betting_recommendations.alternative_bets.map((bet: string, index: number) => (
                      <li key={index} className="text-slate-300 text-sm flex items-start">
                        <span className="text-blue-400 mr-2">•</span>
                        {bet}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {prediction.analysis.betting_recommendations.avoid_bets && prediction.analysis.betting_recommendations.avoid_bets.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <div className="text-red-400 font-medium mb-2 flex items-center">
                    <Shield className="w-4 h-4 mr-2" />
                    Bets to Avoid:
                  </div>
                  <ul className="space-y-1">
                    {prediction.analysis.betting_recommendations.avoid_bets.map((bet: string, index: number) => (
                      <li key={index} className="text-slate-300 text-sm flex items-start">
                        <span className="text-red-400 mr-2">⚠</span>
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

/**
 * Team Analysis Card Component
 * Displays strengths, weaknesses, form, injury impact for a team
 */
function TeamAnalysisCard({ teamName, analysis }: { teamName: string; analysis: any }) {
  return (
    <div className="space-y-4">
      <h4 className="text-md font-medium text-white flex items-center">
        <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
        {teamName}
      </h4>
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
            <div className="text-slate-300 text-sm">
              {analysis.form_assessment}
            </div>
          </div>
        )}
        
        {analysis.injury_impact && (
          <div>
            <div className="text-sm text-orange-400 font-medium mb-2">Injury Impact:</div>
            <div className="text-slate-300 text-sm">
              {analysis.injury_impact}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Additional Markets Display Component
 * Shows Totals, BTTS, Asian Handicap markets
 */
function AdditionalMarketsDisplay({ markets, matchData }: { markets: any; matchData: any }) {
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
                    // Handle both object format {win, lose, push} and direct number format
                    const handicap = key.replace('_minus_', '-').replace('_plus_', '+').replace('_', '.')
                    const isObject = typeof value === 'object' && value !== null && !Array.isArray(value)
                    
                    if (isObject && (value.win !== undefined || value.lose !== undefined)) {
                      // Object format with win/lose/push
                      const winProb = typeof value.win === 'number' ? (value.win * 100).toFixed(0) : 'N/A'
                      const loseProb = typeof value.lose === 'number' ? (value.lose * 100).toFixed(0) : 'N/A'
                      const pushProb = typeof value.push === 'number' ? (value.push * 100).toFixed(0) : null
                      
                      return (
                        <div key={key} className="flex justify-between items-center text-xs">
                          <span className="text-slate-300">{handicap}</span>
                          <div className="flex space-x-2">
                            <span className="text-green-400">W: {winProb}%</span>
                            {pushProb && <span className="text-yellow-400">P: {pushProb}%</span>}
                            <span className="text-red-400">L: {loseProb}%</span>
                          </div>
                        </div>
                      )
                    } else {
                      // Direct number format
                      const numValue = typeof value === 'number' ? value : typeof value === 'string' ? parseFloat(value) : 0
                      if (isNaN(numValue) || numValue === 0) return null
                      
                      return (
                        <div key={key} className="flex justify-between text-xs">
                          <span className="text-slate-400">{handicap}:</span>
                          <span className="text-green-400 font-medium">{(numValue * 100).toFixed(1)}%</span>
                        </div>
                      )
                    }
                  })}
                </div>
              </div>
            )}
            {markets.asian_handicap.away && (
              <div>
                <div className="text-slate-300 text-sm font-medium mb-2">{matchData.away.name}</div>
                <div className="space-y-1">
                  {Object.entries(markets.asian_handicap.away).map(([key, value]: [string, any]) => {
                    // Handle both object format {win, lose, push} and direct number format
                    const handicap = key.replace('_minus_', '-').replace('_plus_', '+').replace('_', '.')
                    const isObject = typeof value === 'object' && value !== null && !Array.isArray(value)
                    
                    if (isObject && (value.win !== undefined || value.lose !== undefined)) {
                      // Object format with win/lose/push
                      const winProb = typeof value.win === 'number' ? (value.win * 100).toFixed(0) : 'N/A'
                      const loseProb = typeof value.lose === 'number' ? (value.lose * 100).toFixed(0) : 'N/A'
                      const pushProb = typeof value.push === 'number' ? (value.push * 100).toFixed(0) : null
                      
                      return (
                        <div key={key} className="flex justify-between items-center text-xs">
                          <span className="text-slate-300">{handicap}</span>
                          <div className="flex space-x-2">
                            <span className="text-green-400">W: {winProb}%</span>
                            {pushProb && <span className="text-yellow-400">P: {pushProb}%</span>}
                            <span className="text-red-400">L: {loseProb}%</span>
                          </div>
                        </div>
                      )
                    } else {
                      // Direct number format
                      const numValue = typeof value === 'number' ? value : typeof value === 'string' ? parseFloat(value) : 0
                      if (isNaN(numValue) || numValue === 0) return null
                      
                      return (
                        <div key={key} className="flex justify-between text-xs">
                          <span className="text-slate-400">{handicap}:</span>
                          <span className="text-green-400 font-medium">{(numValue * 100).toFixed(1)}%</span>
                        </div>
                      )
                    }
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

