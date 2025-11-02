"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Brain, 
  TrendingUp, 
  Shield, 
  Target, 
  AlertTriangle, 
  DollarSign, 
  Zap,
  Lock,
  ChevronRight,
  Star,
  BarChart3
} from "lucide-react"
import type { EnhancedMatchData } from "@/types/live-match"

interface PremiumBettingIntelligenceProps {
  matchData: EnhancedMatchData
  isPurchased: boolean
  onPurchaseClick: () => void
  quickPurchaseInfo?: {
    confidenceScore?: number | null
    valueRating?: string | null
    price?: number
    currencySymbol?: string
  }
  predictionData?: {
    analysis?: {
      betting_recommendations?: {
        primary_bet?: string
        alternative_bets?: string[]
        risk_level?: string
        suggested_stake?: string
      }
      prediction_analysis?: {
        confidence_factors?: string[]
        risk_factors?: string[]
        value_assessment?: string
      }
    }
    predictions?: {
      recommended_bet?: string
      confidence?: number
    }
    additional_markets?: any
  }
}

/**
 * Premium Betting Intelligence Component
 * Shows betting insights, value opportunities, and risk analysis
 * Designed to entice users to upgrade to premium
 */
export function PremiumBettingIntelligence({
  matchData,
  isPurchased,
  onPurchaseClick,
  quickPurchaseInfo,
  predictionData
}: PremiumBettingIntelligenceProps) {
  // Don't show if already purchased - they should see full analysis instead
  if (isPurchased) return null

  const hasIntelligence = predictionData?.analysis?.betting_recommendations || 
                         predictionData?.analysis?.prediction_analysis ||
                         predictionData?.predictions?.recommended_bet

  if (!hasIntelligence) return null

  const recommendations = predictionData?.analysis?.betting_recommendations
  const riskAnalysis = predictionData?.analysis?.prediction_analysis
  const primaryBet = recommendations?.primary_bet || predictionData?.predictions?.recommended_bet

  return (
    <Card className="bg-gradient-to-br from-purple-900/20 via-slate-800/80 to-amber-900/20 border-2 border-amber-500/30 shadow-xl mb-6 overflow-hidden relative">
      {/* Decorative gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-transparent to-amber-500/5 pointer-events-none" />
      
      <div className="p-6 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500/20 to-amber-500/20 rounded-lg">
              <Brain className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                Premium Betting Intelligence
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 ml-2">
                  <Star className="w-3 h-3 mr-1" />
                  V2 AI
                </Badge>
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Advanced AI analysis for smarter betting decisions
              </p>
            </div>
          </div>
          <Lock className="w-6 h-6 text-amber-400 animate-pulse" />
        </div>

        {/* Value Proposition Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Primary Bet Recommendation - Teaser */}
          {primaryBet && (
            <div className="bg-slate-700/40 rounded-lg p-4 border border-slate-600/50 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-medium text-slate-300">Recommended Bet</span>
              </div>
              <div className="space-y-2">
                <div className="text-white font-bold text-lg line-clamp-2">
                  {primaryBet.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </div>
                {recommendations?.risk_level && (
                  <Badge 
                    className={`text-xs ${
                      recommendations.risk_level === 'Low' ? 'bg-green-500/20 text-green-400 border-green-500/40' :
                      recommendations.risk_level === 'Medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' :
                      'bg-red-500/20 text-red-400 border-red-500/40'
                    }`}
                  >
                    Risk: {recommendations.risk_level}
                  </Badge>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-600/50">
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <Lock className="w-3 h-3" />
                  <span>Unlock full analysis</span>
                </div>
              </div>
            </div>
          )}

          {/* Value Opportunities - Teaser */}
          {recommendations?.alternative_bets && recommendations.alternative_bets.length > 0 && (
            <div className="bg-slate-700/40 rounded-lg p-4 border border-slate-600/50 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-green-400" />
                <span className="text-xs font-medium text-slate-300">Value Opportunities</span>
              </div>
              <div className="space-y-2">
                <div className="text-white font-semibold text-sm">
                  {recommendations.alternative_bets.length} Alternative Bets Identified
                </div>
                <div className="text-slate-400 text-xs line-clamp-2">
                  {recommendations.alternative_bets.slice(0, 2).join(', ')}
                  {recommendations.alternative_bets.length > 2 && '...'}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-600/50">
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <Lock className="w-3 h-3" />
                  <span>See all {recommendations.alternative_bets.length} opportunities</span>
                </div>
              </div>
            </div>
          )}

          {/* Risk Intelligence - Teaser */}
          {riskAnalysis && (
            <div className="bg-slate-700/40 rounded-lg p-4 border border-slate-600/50 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-medium text-slate-300">Risk Intelligence</span>
              </div>
              <div className="space-y-2">
                {riskAnalysis.confidence_factors && riskAnalysis.confidence_factors.length > 0 && (
                  <div className="text-emerald-400 text-sm font-semibold">
                    {riskAnalysis.confidence_factors.length} Confidence Factors
                  </div>
                )}
                {riskAnalysis.risk_factors && riskAnalysis.risk_factors.length > 0 && (
                  <div className="text-red-400 text-sm font-semibold">
                    {riskAnalysis.risk_factors.length} Risk Factors
                  </div>
                )}
                {riskAnalysis.value_assessment && (
                  <div className="text-slate-400 text-xs line-clamp-2">
                    {riskAnalysis.value_assessment}
                  </div>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-600/50">
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <Lock className="w-3 h-3" />
                  <span>Full risk breakdown</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* What You Get Section */}
        <div className="bg-slate-900/40 rounded-lg p-4 mb-6 border border-slate-700/50">
          <div className="text-sm font-semibold text-white mb-3">What's Inside Premium Analysis:</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="flex items-center gap-2 text-slate-300 text-xs">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></div>
              <span>AI-Powered Bet Selection</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300 text-xs">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></div>
              <span>Value Bet Identification</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300 text-xs">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></div>
              <span>Risk Assessment</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300 text-xs">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></div>
              <span>Confidence Breakdown</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300 text-xs">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></div>
              <span>Team Strengths/Weaknesses</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300 text-xs">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></div>
              <span>Advanced Markets Analysis</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300 text-xs">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></div>
              <span>Stake Recommendations</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300 text-xs">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></div>
              <span>Bet-to-Avoid List</span>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-gradient-to-r from-amber-500/10 to-purple-500/10 rounded-lg border border-amber-500/20">
          <div className="flex-1">
            <div className="text-white font-semibold mb-1">Unlock Full Betting Intelligence</div>
            <div className="text-sm text-slate-300">
              Get AI-powered recommendations, risk analysis, and value betting opportunities
            </div>
          </div>
          <Button
            onClick={onPurchaseClick}
            className="bg-gradient-to-r from-amber-500 to-purple-500 hover:from-amber-600 hover:to-purple-600 text-white font-semibold px-6 py-2 shadow-lg hover:shadow-xl transition-all"
          >
            <Zap className="w-4 h-4 mr-2" />
            Unlock Premium
            {quickPurchaseInfo?.price && (
              <span className="ml-2 text-sm">
                • {quickPurchaseInfo.currencySymbol || '$'}{quickPurchaseInfo.price.toFixed(2)}
              </span>
            )}
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>

        {/* Trust Indicators */}
        <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-slate-700/50">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <span>96% Model Accuracy</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>Data-Driven Insights</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>Risk-Aware Betting</span>
          </div>
        </div>
      </div>
    </Card>
  )
}

