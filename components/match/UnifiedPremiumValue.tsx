"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Brain, 
  Target, 
  TrendingUp, 
  Shield, 
  Zap, 
  Lock, 
  Check, 
  X, 
  BarChart3, 
  DollarSign,
  Calculator,
  Star,
  ArrowRight,
  Sparkles
} from "lucide-react"

interface UnifiedPremiumValueProps {
  matchData: {
    home: { name: string }
    away: { name: string }
  }
  quickPurchaseInfo: {
    price: number
    country: {
      currencySymbol: string
    }
    analysisSummary?: string | null
  } | null
  v2Model?: {
    pick: string
    confidence: number
  } | null
  onPurchaseClick: () => void
}

/**
 * Unified Premium Value Proposition Component
 * Combines all premium features (V2 Prediction, Betting Intelligence, etc.) into one compelling value prop
 */
export function UnifiedPremiumValue({
  matchData,
  quickPurchaseInfo,
  v2Model,
  onPurchaseClick
}: UnifiedPremiumValueProps) {
  const formatPrice = () => {
    if (!quickPurchaseInfo) return ""
    const currencySymbol = quickPurchaseInfo.country?.currencySymbol || '$'
    return `${currencySymbol}${quickPurchaseInfo.price.toFixed(2)}`
  }

  const premiumFeatures = [
    {
      icon: Brain,
      title: "Advanced V2 AI Model",
      description: "Deep learning model with enhanced accuracy and confidence scoring",
      color: "text-purple-400"
    },
    {
      icon: Calculator,
      title: "Betting Intelligence",
      description: "CLV analysis, Kelly Criterion sizing, and edge calculations",
      color: "text-emerald-400"
    },
    {
      icon: Target,
      title: "Value Bet Identification",
      description: "AI-powered recommendations highlighting optimal betting opportunities",
      color: "text-blue-400"
    },
    {
      icon: TrendingUp,
      title: "Risk Assessment",
      description: "Comprehensive risk analysis with confidence factors and betting strategies",
      color: "text-amber-400"
    },
    {
      icon: Shield,
      title: "Team Analysis",
      description: "Detailed breakdown of team strengths, weaknesses, and form",
      color: "text-indigo-400"
    },
    {
      icon: BarChart3,
      title: "Advanced Markets",
      description: "BTTS, handicaps, and alternative betting markets with recommendations",
      color: "text-cyan-400"
    }
  ]

  const comparisonFeatures = [
    { name: "Basic AI Prediction (V1)", free: true, premium: true, premiumNote: "Advanced V2" },
    { name: "Confidence Score", free: true, premium: true, premiumNote: "Enhanced" },
    { name: "Win Probabilities", free: true, premium: true, premiumNote: "Detailed" },
    { name: "Betting Intelligence (CLV)", free: false, premium: true },
    { name: "Kelly Criterion Sizing", free: false, premium: true },
    { name: "Value Bet Recommendations", free: false, premium: true },
    { name: "Risk Analysis", free: false, premium: true },
    { name: "Team Strengths/Weaknesses", free: false, premium: true },
    { name: "Advanced Markets Analysis", free: false, premium: true },
    { name: "Stake Recommendations", free: false, premium: true }
  ]

  return (
    <Card className="bg-gradient-to-br from-slate-800/90 via-slate-900/90 to-slate-800/90 border-2 border-amber-500/50 relative overflow-hidden">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-amber-600/10 to-purple-600/10 animate-pulse opacity-50" />
      
      <div className="relative p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="h-8 w-8 text-amber-400" />
            <h2 className="text-3xl font-bold text-white">Unlock Premium Intelligence</h2>
            <Sparkles className="h-8 w-8 text-amber-400" />
          </div>
          <p className="text-slate-300 text-lg">
            Get comprehensive AI-powered betting insights for {matchData.home.name} vs {matchData.away.name}
          </p>
          {v2Model && (
            <div className="mt-4 inline-flex items-center gap-2 bg-purple-500/20 border border-purple-500/40 rounded-full px-4 py-2">
              <Star className="h-4 w-4 text-purple-400" />
              <span className="text-purple-300 text-sm font-semibold">
                V2 Model Confidence: {Math.round(v2Model.confidence * 100)}%
              </span>
            </div>
          )}
        </div>

        {/* Premium Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {premiumFeatures.map((feature, index) => {
            const Icon = feature.icon
            return (
              <div
                key={index}
                className="bg-slate-800/60 border border-slate-700 rounded-lg p-4 hover:border-amber-500/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className={`${feature.color} flex-shrink-0`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-sm mb-1">{feature.title}</h3>
                    <p className="text-slate-400 text-xs">{feature.description}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Free vs Premium Comparison */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-white mb-4 text-center">Free vs Premium Comparison</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Free Column */}
            <Card className="bg-slate-800/60 border-slate-700">
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-bold text-white">Free (V1)</h4>
                  <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40">Basic</Badge>
                </div>
                <div className="space-y-2">
                  {comparisonFeatures.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2">
                      {feature.free ? (
                        <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                      ) : (
                        <X className="w-4 h-4 text-slate-600 flex-shrink-0" />
                      )}
                      <span className={`text-sm ${feature.free ? 'text-slate-200' : 'text-slate-500'}`}>
                        {feature.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Premium Column */}
            <Card className="bg-gradient-to-br from-amber-500/10 via-purple-500/10 to-amber-500/10 border-amber-500/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-amber-500/20 px-3 py-1 rounded-bl-lg">
                <span className="text-amber-300 text-xs font-bold">RECOMMENDED</span>
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-bold text-white">Premium (V2)</h4>
                  <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40">Full Access</Badge>
                </div>
                <div className="space-y-2">
                  {comparisonFeatures.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span className="text-sm text-slate-200">
                        {feature.name}
                        {feature.premiumNote && (
                          <span className="text-amber-400 text-xs ml-1">({feature.premiumNote})</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* What You'll Get - Detailed Preview */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-white mb-4 text-center">What You'll Get</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Betting Intelligence Preview */}
            <div className="bg-gradient-to-br from-emerald-900/20 to-blue-900/20 border border-emerald-500/30 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="h-5 w-5 text-emerald-400" />
                <h4 className="text-white font-semibold">Betting Intelligence</h4>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Best Bet Pick:</span>
                  <span className="text-slate-500">Premium Only</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Expected Edge:</span>
                  <span className="text-slate-500">—</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Kelly Sizing:</span>
                  <span className="text-slate-500">—</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>CLV Analysis:</span>
                  <span className="text-slate-500">—</span>
                </div>
              </div>
            </div>

            {/* V2 Prediction Preview */}
            <div className="bg-gradient-to-br from-purple-900/20 to-amber-900/20 border border-purple-500/30 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="h-5 w-5 text-purple-400" />
                <h4 className="text-white font-semibold">Premium Prediction (V2)</h4>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between text-slate-400">
                  <span>AI Prediction:</span>
                  {v2Model ? (
                    <span className="text-white font-semibold">{v2Model.pick === 'home' ? matchData.home.name : v2Model.pick === 'away' ? matchData.away.name : 'Draw'}</span>
                  ) : (
                    <span className="text-slate-500">Premium Only</span>
                  )}
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Confidence:</span>
                  {v2Model ? (
                    <span className="text-emerald-400 font-semibold">{Math.round(v2Model.confidence * 100)}%</span>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Risk Analysis:</span>
                  <span className="text-slate-500">Premium Only</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Team Analysis:</span>
                  <span className="text-slate-500">Premium Only</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="text-center bg-slate-800/40 rounded-lg p-4 border border-slate-700">
            <BarChart3 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
            <div className="text-white font-semibold text-sm">96% Accuracy</div>
            <div className="text-slate-400 text-xs">V2 Model</div>
          </div>
          <div className="text-center bg-slate-800/40 rounded-lg p-4 border border-slate-700">
            <TrendingUp className="w-6 h-6 text-blue-400 mx-auto mb-2" />
            <div className="text-white font-semibold text-sm">Data-Driven</div>
            <div className="text-slate-400 text-xs">Real-time Analysis</div>
          </div>
          <div className="text-center bg-slate-800/40 rounded-lg p-4 border border-slate-700">
            <Shield className="w-6 h-6 text-purple-400 mx-auto mb-2" />
            <div className="text-white font-semibold text-sm">Risk-Aware</div>
            <div className="text-slate-400 text-xs">Kelly Criterion</div>
          </div>
        </div>

        {/* Main CTA */}
        <div className="bg-gradient-to-r from-amber-600/20 via-purple-600/20 to-amber-600/20 border-2 border-amber-500/50 rounded-xl p-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Lock className="h-6 w-6 text-amber-400" />
            <h3 className="text-2xl font-bold text-white">Unlock All Premium Features</h3>
          </div>
          <p className="text-slate-300 mb-6 max-w-2xl mx-auto">
            Get instant access to advanced AI predictions, betting intelligence, risk analysis, and comprehensive match insights. 
            Make smarter betting decisions with data-driven recommendations.
          </p>
          <Button
            onClick={onPurchaseClick}
            className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold px-8 py-4 text-lg shadow-xl shadow-amber-500/30 hover:shadow-amber-500/40 transition-all transform hover:scale-105"
            size="lg"
          >
            <Zap className="w-5 h-5 mr-2" />
            Unlock Premium Analysis
            {quickPurchaseInfo && (
              <span className="ml-2 bg-white/20 px-3 py-1 rounded-full">
                {formatPrice()}
              </span>
            )}
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          {quickPurchaseInfo && (
            <p className="text-slate-400 text-sm mt-4">
              One-time purchase • Instant access • Full analysis included
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}

