"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, X, Zap, Brain, Shield, TrendingUp, Target, BarChart3 } from "lucide-react"

interface FreeVsPremiumComparisonProps {
  isPurchased: boolean
  onPurchaseClick: () => void
}

/**
 * Free vs Premium Comparison Component
 * Shows what bettors get for free vs premium
 * Creates clear value differentiation
 */
export function FreeVsPremiumComparison({ 
  isPurchased, 
  onPurchaseClick 
}: FreeVsPremiumComparisonProps) {
  if (isPurchased) return null

  const features = [
    {
      feature: "AI Prediction",
      free: true,
      premium: true,
      premiumNote: "Advanced V2 Model"
    },
    {
      feature: "Confidence Score",
      free: true,
      premium: true,
      premiumNote: "Enhanced Accuracy"
    },
    {
      feature: "Basic Probabilities",
      free: true,
      premium: true,
      premiumNote: "Detailed Breakdown"
    },
    {
      feature: "Betting Recommendations",
      free: false,
      premium: true,
      icon: Target
    },
    {
      feature: "Value Bet Identification",
      free: false,
      premium: true,
      icon: TrendingUp
    },
    {
      feature: "Risk Analysis",
      free: false,
      premium: true,
      icon: Shield
    },
    {
      feature: "Team Strengths/Weaknesses",
      free: false,
      premium: true,
      icon: Brain
    },
    {
      feature: "Advanced Markets (BTTS, Handicaps)",
      free: false,
      premium: true,
      icon: BarChart3
    },
    {
      feature: "Stake Recommendations",
      free: false,
      premium: true,
      icon: Zap
    },
    {
      feature: "Bets to Avoid List",
      free: false,
      premium: true,
      icon: Shield
    }
  ]

  return (
    <Card className="bg-slate-800/60 border-slate-700 mb-6">
      <div className="p-6">
        <div className="text-center mb-6">
          <h3 className="text-xl font-bold text-white mb-2">Free vs Premium</h3>
          <p className="text-sm text-slate-400">
            See what intelligence you're missing
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Free Column */}
          <div className="bg-slate-700/30 rounded-lg p-5 border border-slate-600">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-white">Free (V1)</h4>
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/40">Basic</Badge>
            </div>
            <div className="space-y-3">
              {features.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    {item.free ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <X className="w-4 h-4 text-slate-600" />
                    )}
                    <span className={`text-sm ${item.free ? 'text-slate-300' : 'text-slate-600'}`}>
                      {item.feature}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Premium Column */}
          <div className="bg-gradient-to-br from-amber-900/20 to-purple-900/20 rounded-lg p-5 border-2 border-amber-500/30 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-amber-500/20 px-3 py-1 rounded-bl-lg">
              <Badge className="bg-amber-500/30 text-amber-300 border-amber-500/50 text-xs">
                <Zap className="w-3 h-3 mr-1" />
                Premium
              </Badge>
            </div>
            
            <div className="flex items-center justify-between mb-4 mt-1">
              <h4 className="text-lg font-semibold text-white">Premium (V2)</h4>
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40">AI-Powered</Badge>
            </div>
            <div className="space-y-3">
              {features.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    {item.premium ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <X className="w-4 h-4 text-red-500" />
                    )}
                    <div className="flex items-center gap-2 flex-1">
                      {item.icon && <item.icon className="w-4 h-4 text-amber-400" />}
                      <span className="text-sm text-white font-medium">
                        {item.feature}
                      </span>
                    </div>
                  </div>
                  {item.premiumNote && (
                    <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/30 text-emerald-400 text-xs ml-2">
                      {item.premiumNote}
                    </Badge>
                  )}
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="mt-6 pt-4 border-t border-amber-500/20">
              <button
                onClick={onPurchaseClick}
                className="w-full bg-gradient-to-r from-amber-500 to-purple-500 hover:from-amber-600 hover:to-purple-600 text-white font-semibold py-2.5 rounded-lg transition-all shadow-lg hover:shadow-xl"
              >
                Upgrade to Premium
              </button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

