"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Brain, TrendingUp, AlertTriangle, Lightbulb, Target, Zap } from "lucide-react"

export function AIInsights() {
  const insights = [
    {
      type: "pattern",
      title: "Winning Pattern Detected",
      description: "You have 89% success rate on Over 2.5 goals in Premier League matches",
      action: "Focus on similar bets",
      confidence: 94,
      icon: Target,
    },
    {
      type: "risk",
      title: "Risk Alert",
      description: "Your recent bets show increased risk tolerance. Consider smaller stakes",
      action: "Review strategy",
      confidence: 78,
      icon: AlertTriangle,
    },
    {
      type: "opportunity",
      title: "Market Opportunity",
      description: "La Liga matches show 23% better value than your usual Premier League bets",
      action: "Explore La Liga",
      confidence: 86,
      icon: Lightbulb,
    },
    {
      type: "optimization",
      title: "Bankroll Optimization",
      description: "Increase stakes by 15% based on your recent performance",
      action: "Adjust strategy",
      confidence: 91,
      icon: TrendingUp,
    },
  ]

  const getInsightColor = (type: string) => {
    switch (type) {
      case "pattern":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
      case "risk":
        return "bg-red-500/20 text-red-400 border-red-500/30"
      case "opportunity":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30"
      case "optimization":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30"
      default:
        return "bg-slate-500/20 text-slate-400 border-slate-500/30"
    }
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-white font-semibold flex items-center">
          <Brain className="w-5 h-5 mr-2 text-emerald-400" />
          AI Insights & Recommendations
        </h3>
        <Button variant="ghost" size="sm" className="text-slate-400">
          <Zap className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="space-y-4">
        {insights.map((insight, index) => (
          <div key={index} className="bg-slate-900/50 rounded-lg p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start space-x-3">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    insight.type === "pattern"
                      ? "bg-emerald-500/20"
                      : insight.type === "risk"
                        ? "bg-red-500/20"
                        : insight.type === "opportunity"
                          ? "bg-blue-500/20"
                          : "bg-purple-500/20"
                  }`}
                >
                  <insight.icon
                    className={`w-4 h-4 ${
                      insight.type === "pattern"
                        ? "text-emerald-400"
                        : insight.type === "risk"
                          ? "text-red-400"
                          : insight.type === "opportunity"
                            ? "text-blue-400"
                            : "text-purple-400"
                    }`}
                  />
                </div>
                <div className="flex-1">
                  <div className="text-white font-medium text-sm mb-1">{insight.title}</div>
                  <div className="text-slate-300 text-sm mb-2">{insight.description}</div>
                </div>
              </div>
              <Badge className={getInsightColor(insight.type)}>{insight.confidence}%</Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-slate-400 text-xs">AI Recommendation</div>
              <Button size="sm" variant="outline" className="border-slate-600 text-slate-300">
                {insight.action}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* AI Learning Status */}
      <div className="mt-6 p-3 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30 rounded-lg">
        <div className="flex items-center space-x-2">
          <Brain className="w-4 h-4 text-emerald-400" />
          <span className="text-emerald-400 text-sm font-medium">AI is learning from your betting patterns</span>
        </div>
        <div className="text-slate-300 text-xs mt-1">
          Based on 156 bets analyzed • Accuracy improving by 2.3% weekly
        </div>
      </div>
    </Card>
  )
}
