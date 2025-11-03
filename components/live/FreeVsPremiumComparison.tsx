"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, X, Zap, Target, TrendingUp, Shield, Brain, BarChart3, DollarSign, AlertTriangle } from "lucide-react"

interface FreeVsPremiumComparisonProps {
  isPurchased: boolean
  onPurchaseClick: () => void
}

/**
 * Free vs Premium Comparison Component
 * Side-by-side feature comparison to showcase premium value
 */
export function FreeVsPremiumComparison({ isPurchased, onPurchaseClick }: FreeVsPremiumComparisonProps) {
  if (isPurchased) return null

  const features = [
    {
      name: "AI Prediction",
      free: true,
      premium: true,
      premiumBadge: "Advanced V2 Model"
    },
    {
      name: "Confidence Score",
      free: true,
      premium: true,
      premiumBadge: "Enhanced Accuracy"
    },
    {
      name: "Basic Probabilities",
      free: true,
      premium: true,
      premiumBadge: "Detailed Breakdown"
    },
    {
      name: "Betting Recommendations",
      free: false,
      premium: true,
      icon: Target
    },
    {
      name: "Value Bet Identification",
      free: false,
      premium: true,
      icon: TrendingUp
    },
    {
      name: "Risk Analysis",
      free: false,
      premium: true,
      icon: Shield
    },
    {
      name: "Team Strengths/Weaknesses",
      free: false,
      premium: true,
      icon: Brain
    },
    {
      name: "Advanced Markets (BTTS, Handicaps)",
      free: false,
      premium: true,
      icon: BarChart3
    },
    {
      name: "Stake Recommendations",
      free: false,
      premium: true,
      icon: Zap
    },
    {
      name: "Bets to Avoid List",
      free: false,
      premium: true,
      icon: AlertTriangle
    }
  ]

  return (
    <Card className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 border-slate-700 mb-6">
      <div className="p-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Free vs Premium</h2>
          <p className="text-slate-400 text-sm">See what intelligence you're missing</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Free (V1) Column */}
          <Card className="bg-slate-800/60 border-slate-700">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Free (V1)</h3>
                <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40 text-xs">Basic</Badge>
              </div>
              
              <div className="space-y-3">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1">
                      {feature.free ? (
                        <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                      ) : (
                        <X className="w-4 h-4 text-slate-600 flex-shrink-0" />
                      )}
                      <span className={`text-sm ${feature.free ? 'text-slate-200' : 'text-slate-500'}`}>
                        {feature.name}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Premium (V2) Column */}
          <Card className="bg-gradient-to-br from-amber-500/10 via-purple-500/10 to-amber-500/10 border-amber-500/30 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse"></div>
            <div className="p-5 relative z-10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Premium (V2)</h3>
                <div className="flex flex-col gap-1">
                  <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 text-xs px-2 py-0.5">
                    <Zap className="w-3 h-3 mr-1 inline" />
                    Premium
                  </Badge>
                  <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-xs px-2 py-0.5">
                    AI-Powered
                  </Badge>
                </div>
              </div>
              
              <div className="space-y-3 mb-4">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1">
                      <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-slate-200">{feature.name}</span>
                        {feature.premiumBadge && (
                          <Badge className="bg-green-500/20 text-green-300 border-green-500/40 text-xs px-1.5 py-0">
                            {feature.premiumBadge}
                          </Badge>
                        )}
                        {feature.icon && (
                          <feature.icon className="w-4 h-4 text-amber-400" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                onClick={onPurchaseClick}
                className="w-full bg-gradient-to-r from-orange-500 to-purple-600 hover:from-orange-600 hover:to-purple-700 text-white font-semibold py-2.5 shadow-lg shadow-orange-500/20"
              >
                Upgrade to Premium
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </Card>
  )
}
