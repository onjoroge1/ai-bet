"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Target, DollarSign, Shield, Lock, Star, BarChart3, TrendingUp, Brain, AlertTriangle, Zap, ArrowRight } from "lucide-react"

interface PremiumBettingIntelligenceProps {
  matchData: any
  isPurchased: boolean
  onPurchaseClick: () => void
  quickPurchaseInfo: {
    price: number
    currencySymbol?: string
    analysisSummary?: string | null
    country?: {
      currencySymbol: string
    }
  }
  predictionData?: any | null
}

/**
 * Premium Betting Intelligence Component
 * Displays teasers for premium betting intelligence to encourage purchases
 */
export function PremiumBettingIntelligence({
  matchData,
  isPurchased,
  onPurchaseClick,
  quickPurchaseInfo,
  predictionData
}: PremiumBettingIntelligenceProps) {
  if (isPurchased) return null

  // Extract data from predictionData (with fallbacks if not available)
  const bettingRecommendations = predictionData?.analysis?.betting_recommendations
  const predictionAnalysis = predictionData?.analysis?.prediction_analysis
  const predictions = predictionData?.predictions

  // Get primary bet recommendation with team names if available
  const getPrimaryBet = () => {
    if (bettingRecommendations?.primary_bet) return bettingRecommendations.primary_bet
    if (predictions?.recommended_bet) return predictions.recommended_bet
    if (matchData?.home?.name && matchData?.away?.name) {
      return `Bet on ${matchData.home.name} vs ${matchData.away.name}`
    }
    return "Premium Betting Recommendation"
  }

  const primaryBet = getPrimaryBet()
  const riskLevel = bettingRecommendations?.risk_level || "Medium"
  const alternativeBets = bettingRecommendations?.alternative_bets || []
  const confidenceFactors = predictionAnalysis?.confidence_factors || []
  const riskFactors = predictionAnalysis?.risk_factors || []
  const valueAssessment = predictionAnalysis?.value_assessment || ""
  
  // Use analysisSummary from quickPurchaseInfo if available
  const summary = quickPurchaseInfo.analysisSummary || predictionData?.analysis?.ai_summary || ""

  // Truncate text for teasers
  const truncateText = (text: string, maxLength: number = 60) => {
    if (!text) return ""
    return text.length > maxLength ? text.substring(0, maxLength) + "..." : text
  }

  const formatPrice = () => {
    const currencySymbol = quickPurchaseInfo.currencySymbol || quickPurchaseInfo.country?.currencySymbol || '$'
    return `${currencySymbol}${quickPurchaseInfo.price.toFixed(2)}`
  }

  return (
    <Card className="bg-gradient-to-br from-purple-900/20 via-slate-800 to-amber-900/20 border-purple-500/30 mb-6">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Brain className="w-8 h-8 text-purple-400" />
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">Premium Betting Intelligence</h2>
              <p className="text-slate-400 text-sm">Advanced AI analysis for smarter betting decisions</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/40">
              <Star className="w-3 h-3 mr-1 inline" />
              V2 AI
            </Badge>
            <Lock className="w-5 h-5 text-yellow-400" />
          </div>
        </div>

        {/* Three Column Intelligence Preview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Recommended Bet */}
          <Card className="bg-slate-800/60 border-slate-700">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-5 h-5 text-orange-400" />
                <h3 className="text-sm font-semibold text-white">Recommended Bet</h3>
              </div>
              <div className="text-white font-bold text-lg mb-2">
                {truncateText(primaryBet, 50)}
              </div>
              <Badge className={`mb-3 ${
                riskLevel?.toLowerCase() === 'low' ? 'bg-green-500/20 text-green-300 border-green-500/40' :
                riskLevel?.toLowerCase() === 'high' ? 'bg-red-500/20 text-red-300 border-red-500/40' :
                'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
              }`}>
                Risk: {riskLevel}
              </Badge>
              <Button
                onClick={onPurchaseClick}
                variant="outline"
                className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                <Lock className="w-4 h-4 mr-2" />
                Unlock full analysis
              </Button>
            </div>
          </Card>

          {/* Value Opportunities */}
          <Card className="bg-slate-800/60 border-slate-700">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-5 h-5 text-green-400" />
                <h3 className="text-sm font-semibold text-white">Value Opportunities</h3>
              </div>
              <div className="text-white font-bold text-lg mb-2">
                {alternativeBets.length > 0 ? `${alternativeBets.length} Alternative Bet${alternativeBets.length > 1 ? 's' : ''} Identified` : "Value Bets Available"}
              </div>
              <p className="text-slate-400 text-xs mb-3">
                {alternativeBets.length > 0 
                  ? truncateText(alternativeBets[0] || "Alternative betting opportunities identified", 50)
                  : truncateText(valueAssessment || summary || "AI has identified value opportunities in this match", 50)
                }
              </p>
              <Button
                onClick={onPurchaseClick}
                variant="outline"
                className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                <Lock className="w-4 h-4 mr-2" />
                See all {alternativeBets.length || 'value'} opportunities
              </Button>
            </div>
          </Card>

          {/* Risk Intelligence */}
          <Card className="bg-slate-800/60 border-slate-700">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-semibold text-white">Risk Intelligence</h3>
              </div>
              <div className="mb-2">
                <div className="text-green-400 font-bold text-sm mb-1">
                  {confidenceFactors.length} Confidence Factor{confidenceFactors.length !== 1 ? 's' : ''}
                </div>
                <div className="text-red-400 font-bold text-sm">
                  {riskFactors.length} Risk Factor{riskFactors.length !== 1 ? 's' : ''}
                </div>
              </div>
              <p className="text-slate-400 text-xs mb-3">
                {truncateText(
                  confidenceFactors[0] || riskFactors[0] || summary || "Comprehensive risk and confidence analysis available",
                  50
                )}
              </p>
              <Button
                onClick={onPurchaseClick}
                variant="outline"
                className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                <Lock className="w-4 h-4 mr-2" />
                Full risk breakdown
              </Button>
            </div>
          </Card>
        </div>

        {/* What's Inside Premium Analysis */}
        <Card className="bg-slate-800/40 border-slate-700 mb-6">
          <div className="p-4">
            <h3 className="text-sm font-semibold text-white mb-3">What's Inside Premium Analysis:</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { name: "AI-Powered Bet Selection", icon: Brain },
                { name: "Value Bet Identification", icon: TrendingUp },
                { name: "Risk Assessment", icon: Shield },
                { name: "Confidence Breakdown", icon: BarChart3 },
                { name: "Team Strengths/Weaknesses", icon: Target },
                { name: "Advanced Markets Analysis", icon: BarChart3 },
                { name: "Stake Recommendations", icon: Zap },
                { name: "Bet-to-Avoid List", icon: AlertTriangle }
              ].map((feature, index) => (
                <div key={index} className="flex items-center gap-2 text-xs text-slate-300">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full flex-shrink-0"></div>
                  <span>{feature.name}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* CTA Section */}
        <Card className="bg-gradient-to-r from-purple-600/20 to-amber-600/20 border-purple-500/40">
          <div className="p-6 text-center">
            <h3 className="text-xl font-bold text-white mb-2">Unlock Full Betting Intelligence</h3>
            <p className="text-slate-300 text-sm mb-4">
              Get AI-powered recommendations, risk analysis, and value betting opportunities
            </p>
            <Button
              onClick={onPurchaseClick}
              className="bg-gradient-to-r from-purple-600 to-amber-600 hover:from-purple-700 hover:to-amber-700 text-white font-semibold px-6 py-3 text-lg shadow-lg shadow-purple-500/20"
            >
              <Zap className="w-5 h-5 mr-2 inline" />
              Unlock Premium
              <span className="ml-2">{formatPrice()}</span>
              <ArrowRight className="w-4 h-4 ml-2 inline" />
            </Button>
          </div>
        </Card>

        {/* Trust Indicators */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="text-center">
            <BarChart3 className="w-5 h-5 text-green-400 mx-auto mb-1" />
            <div className="text-white font-semibold text-sm">96% Model Accuracy</div>
          </div>
          <div className="text-center">
            <TrendingUp className="w-5 h-5 text-blue-400 mx-auto mb-1" />
            <div className="text-white font-semibold text-sm">Data-Driven Insights</div>
          </div>
          <div className="text-center">
            <Shield className="w-5 h-5 text-purple-400 mx-auto mb-1" />
            <div className="text-white font-semibold text-sm">Risk-Aware Betting</div>
          </div>
        </div>
      </div>
    </Card>
  )
}
