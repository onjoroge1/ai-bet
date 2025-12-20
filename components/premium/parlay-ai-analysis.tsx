"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Brain, TrendingUp, AlertCircle, Target, DollarSign, Loader2, CheckCircle, XCircle, Layers } from "lucide-react"
import { toast } from "sonner"

interface ParlayAnalysis {
  parlay: {
    id: string
    leg_count: number
    edge_pct: string
    edge_tier: string
    implied_odds: string
    win_probability: string
    confidence_tier: string
    correlation_penalty: string
  }
  legs: any[]
  leg_analysis: {
    strongest_leg: any
    weakest_leg: any
    average_leg_edge: string
    leg_consistency: string
  }
  trading_analysis: {
    verdict: string
    rationale: string
    execution_plan: any
    risk_assessment: any
    portfolio_guidance: any
  }
  recommendations: string[]
  warnings: string[]
}

interface ParlayAIAnalysisProps {
  parlayId: string
}

export function ParlayAIAnalysis({ parlayId }: ParlayAIAnalysisProps) {
  const [analysis, setAnalysis] = useState<ParlayAnalysis | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchAnalysis = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/premium/ai-intelligence/parlay-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parlay_id: parlayId }),
      })

      if (!response.ok) {
        throw new Error('Failed to fetch analysis')
      }

      const data = await response.json()
      setAnalysis(data)
    } catch (error) {
      console.error('Error fetching parlay analysis:', error)
      toast.error('Failed to load AI analysis')
    } finally {
      setLoading(false)
    }
  }

  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case 'STRONG_BUY': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
      case 'BUY': return 'bg-blue-500/20 text-blue-400 border-blue-500/50'
      case 'CONSIDER': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
      default: return 'bg-red-500/20 text-red-400 border-red-500/50'
    }
  }

  if (loading) {
    return (
      <Card className="bg-slate-800/60 border-slate-700">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
            <span className="ml-2 text-slate-400">Generating AI analysis...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!analysis) {
    return (
      <Card className="bg-slate-800/60 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-400" />
            AI Parlay Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchAnalysis} className="w-full bg-purple-600 hover:bg-purple-700">
            <Brain className="h-4 w-4 mr-2" />
            Generate AI Analysis
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 border-purple-500/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-400" />
            AI Parlay Trading Analysis
          </CardTitle>
          <Badge className={getVerdictColor(analysis.trading_analysis.verdict)}>
            {analysis.trading_analysis.verdict.replace('_', ' ')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Parlay Overview */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-lg font-semibold text-white">
                {analysis.parlay.leg_count}-Leg Parlay
              </h3>
              <div className="text-sm text-slate-400 mt-1">
                Edge: +{analysis.parlay.edge_pct}% • Win Prob: {analysis.parlay.win_probability}%
              </div>
            </div>
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50">
              {analysis.parlay.edge_tier}
            </Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
            <div>
              <div className="text-xs text-slate-400 mb-1">Implied Odds</div>
              <div className="text-sm font-semibold text-white">{analysis.parlay.implied_odds}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Correlation Penalty</div>
              <div className="text-sm font-semibold text-red-400">-{analysis.parlay.correlation_penalty}%</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Confidence</div>
              <div className="text-sm font-semibold text-blue-400">{analysis.parlay.confidence_tier}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Avg Leg Edge</div>
              <div className="text-sm font-semibold text-emerald-400">+{analysis.leg_analysis.average_leg_edge}%</div>
            </div>
          </div>
        </div>

        {/* Leg Analysis */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Layers className="h-4 w-4 text-blue-400" />
            Leg Analysis
          </h3>
          <div className="space-y-3">
            {analysis.legs.map((leg, idx) => (
              <div key={idx} className="bg-slate-700/30 rounded p-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="border-blue-500/50 text-blue-400">
                        Leg {leg.leg_number}
                      </Badge>
                      <span className="text-sm font-semibold text-white">
                        {leg.match.home_team} vs {leg.match.away_team}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">
                      {leg.outcome} • {leg.odds} odds • {leg.model_prob.toFixed(1)}% prob
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-emerald-400">
                      +{leg.edge.toFixed(2)}%
                    </div>
                    <Badge className={`text-xs mt-1 ${
                      leg.strength === 'Strong' ? 'bg-emerald-500/20 text-emerald-400' :
                      leg.strength === 'Moderate' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {leg.strength}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-slate-400 mb-1">Strongest Leg</div>
              <div className="text-sm text-emerald-400">
                {analysis.leg_analysis.strongest_leg.match.home_team} vs {analysis.leg_analysis.strongest_leg.match.away_team}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Weakest Leg</div>
              <div className="text-sm text-red-400">
                {analysis.leg_analysis.weakest_leg.match.home_team} vs {analysis.leg_analysis.weakest_leg.match.away_team}
              </div>
            </div>
          </div>
        </div>

        {/* Rationale */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
            <Target className="h-4 w-4 text-blue-400" />
            How I Would Trade This Parlay
          </h3>
          <p className="text-sm text-slate-300 leading-relaxed">{analysis.trading_analysis.rationale}</p>
        </div>

        {/* Execution Plan */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Execution Plan</h3>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-slate-400 mb-1">Entry</div>
              <div className="text-sm text-white font-medium">{analysis.trading_analysis.execution_plan.entry.action}</div>
              <div className="text-xs text-slate-400 mt-1">Stake: {analysis.trading_analysis.execution_plan.entry.stake_size}</div>
              {analysis.trading_analysis.execution_plan.entry.notes.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {analysis.trading_analysis.execution_plan.entry.notes.map((note: string, idx: number) => (
                    <li key={idx} className="text-xs text-slate-400 flex items-start gap-2">
                      <span className="text-slate-500 mt-0.5">•</span>
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Management</div>
              <div className="text-xs text-slate-300">
                {analysis.trading_analysis.execution_plan.management.monitor_legs ? 'Monitor each leg as matches progress' : 'Simple tracking'}
              </div>
              {analysis.trading_analysis.execution_plan.management.notes.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {analysis.trading_analysis.execution_plan.management.notes.map((note: string, idx: number) => (
                    <li key={idx} className="text-xs text-slate-400 flex items-start gap-2">
                      <span className="text-slate-500 mt-0.5">•</span>
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Exit Philosophy</div>
              <div className="text-xs text-slate-300 italic">{analysis.trading_analysis.execution_plan.exit_philosophy}</div>
            </div>
          </div>
        </div>

        {/* Risk Assessment */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Risk Assessment</h3>
          <Badge className={`mb-3 ${
            analysis.trading_analysis.risk_assessment.risk_level === 'MODERATE_LOW' ? 'bg-emerald-500/20 text-emerald-400' :
            analysis.trading_analysis.risk_assessment.risk_level === 'MODERATE' ? 'bg-yellow-500/20 text-yellow-400' :
            'bg-red-500/20 text-red-400'
          }`}>
            {analysis.trading_analysis.risk_assessment.risk_level.replace('_', ' ')} Risk
          </Badge>
          {analysis.trading_analysis.risk_assessment.risks.length > 0 && (
            <div className="mb-3">
              <div className="text-xs text-slate-400 mb-1">Risks</div>
              <ul className="space-y-1">
                {analysis.trading_analysis.risk_assessment.risks.map((risk: string, idx: number) => (
                  <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                    <AlertCircle className="h-3 w-3 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <span>{risk}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {analysis.trading_analysis.risk_assessment.mitigations.length > 0 && (
            <div>
              <div className="text-xs text-slate-400 mb-1">Mitigations</div>
              <ul className="space-y-1">
                {analysis.trading_analysis.risk_assessment.mitigations.map((mit: string, idx: number) => (
                  <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                    <CheckCircle className="h-3 w-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span>{mit}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Portfolio Guidance */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Portfolio-Level Guidance</h3>
          <div className="mb-3">
            <div className="text-xs text-slate-400 mb-1">Allocation</div>
            <div className="text-sm text-white">
              {analysis.trading_analysis.portfolio_guidance.allocation.replace('_', ' ')}
            </div>
            {analysis.trading_analysis.portfolio_guidance.notes.length > 0 && (
              <ul className="mt-2 space-y-1">
                {analysis.trading_analysis.portfolio_guidance.notes.map((note: string, idx: number) => (
                  <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                    <span className="text-slate-500 mt-0.5">•</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {analysis.trading_analysis.portfolio_guidance.do_not.length > 0 && (
            <div>
              <div className="text-xs text-slate-400 mb-1">What NOT to Do</div>
              <ul className="space-y-1">
                {analysis.trading_analysis.portfolio_guidance.do_not.map((item: string, idx: number) => (
                  <li key={idx} className="text-xs text-red-400 flex items-start gap-2">
                    <XCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Recommendations */}
        <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-emerald-400 mb-2">Bottom Line</h3>
          <ul className="space-y-1">
            {analysis.recommendations.map((rec, idx) => (
              <li key={idx} className="text-sm text-slate-300">{rec}</li>
            ))}
          </ul>
        </div>

        {/* Warnings */}
        {analysis.warnings.length > 0 && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-red-400 mb-2">Warnings</h3>
            <ul className="space-y-1">
              {analysis.warnings.map((warning, idx) => (
                <li key={idx} className="text-sm text-slate-300">{warning}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

