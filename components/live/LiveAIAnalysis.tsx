"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Brain, Eye, TrendingUp } from "lucide-react"

interface LiveAIAnalysisProps {
  aiAnalysis: {
    minute: number
    trigger: string
    momentum: string
    observations: string[]
    betting_angles?: Array<{
      market: string
      reasoning: string
      confidence: string
    }>
    generated_at: string
  }
}

/**
 * Live AI Analysis Component
 * Displays real-time AI-generated analysis including momentum description and observations
 */
export function LiveAIAnalysis({ aiAnalysis }: LiveAIAnalysisProps) {
  return (
    <Card className="bg-gradient-to-br from-purple-900/30 via-slate-800/80 to-slate-900/80 border-purple-500/30">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Brain className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">AI Live Analysis</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-xs">
                  Minute {aiAnalysis.minute}'
                </Badge>
                <span className="text-slate-400 text-xs">
                  {new Date(aiAnalysis.generated_at).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Momentum Description */}
        {aiAnalysis.momentum && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h4 className="text-sm font-semibold text-emerald-400 uppercase tracking-wide">
                Current Momentum
              </h4>
            </div>
            <div className="bg-slate-700/40 rounded-lg p-4 border border-slate-600/50">
              <p className="text-slate-200 leading-relaxed">{aiAnalysis.momentum}</p>
            </div>
          </div>
        )}

        {/* Observations */}
        {aiAnalysis.observations && aiAnalysis.observations.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Eye className="w-4 h-4 text-blue-400" />
              <h4 className="text-sm font-semibold text-blue-400 uppercase tracking-wide">
                Key Observations
              </h4>
            </div>
            <div className="space-y-2">
              {aiAnalysis.observations.map((observation, index) => (
                <div
                  key={index}
                  className="bg-slate-700/30 rounded-lg p-3 border-l-2 border-blue-500/50"
                >
                  <p className="text-slate-300 text-sm leading-relaxed">{observation}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Betting Angles (if available) */}
        {aiAnalysis.betting_angles && aiAnalysis.betting_angles.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-amber-400 uppercase tracking-wide mb-3">
              Betting Angles
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {aiAnalysis.betting_angles.map((angle, index) => (
                <div
                  key={index}
                  className="bg-slate-700/30 rounded-lg p-3 border border-amber-500/20"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-amber-300 font-medium text-sm">{angle.market}</span>
                    <Badge
                      className={`text-xs ${
                        angle.confidence === 'high'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : angle.confidence === 'medium'
                          ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
                          : 'bg-slate-500/20 text-slate-300 border-slate-500/40'
                      }`}
                    >
                      {angle.confidence}
                    </Badge>
                  </div>
                  <p className="text-slate-400 text-xs">{angle.reasoning}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

