"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Brain, TrendingUp, AlertCircle, Target, DollarSign, Zap, Loader2, RefreshCw, Activity, Layers, ExternalLink, Sparkles, Clock } from "lucide-react"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface BettingInsight {
  type: "strength" | "weakness" | "opportunity" | "warning"
  title: string
  description: string
  recommendation?: string
  data?: any
}

interface CLVOpportunity {
  alert_id: string
  match_id: number
  home_team: string
  away_team: string
  league: string
  outcome: string
  entry_odds: number
  consensus_odds: number
  clv_pct: number
  confidence_score: number
  books_used: number
  expires_at: string
}

interface ParlayLeg {
  leg_order: number
  home_team: string
  away_team: string
  outcome: string
  edge: number
  odds: number
  model_prob: number
}

interface ActiveParlay {
  parlay_id: string
  leg_count: number
  edge_pct: number
  implied_odds: number
  win_probability: number
  confidence_tier: string
  legs: ParlayLeg[]
}

interface CLVTradingPlan {
  as_of: string
  ranked_bets: Array<{
    match_id: number
    match: string
    market: string
    recommendation: "TAKE" | "OPTIONAL" | "PASS"
    rank: number
    why: string[]
    entry: {
      side: string
      price_min: number
      price_target: number
      timing: "immediate" | "wait_for_price" | "skip"
    }
    staking: {
      units: number
      method: string
      notes: string
    }
    monitoring_plan: {
      checkpoints: string[]
      what_to_watch: string[]
    }
    exit_plan: {
      type: string
      targets: Array<{
        trigger_price: number
        action: string
        fraction: number
      }>
    }
    risk_notes: string[]
    confidence: number
  }>
  portfolio_summary: {
    allocation: Array<{ match_id: number; percent: number }>
    notes: string[]
  }
}

interface AIAnalysis {
  overallScore: number
  insights: BettingInsight[]
  recommendations: string[]
  performanceSummary: {
    totalBets: number
    winRate: number
    roi: number
    avgStake: number
    bestPerformingLeague?: string
    worstPerformingLeague?: string
  }
  rollingData?: {
    clvOpportunities: CLVOpportunity[]
    activeParlays: ActiveParlay[]
  }
  clvTradingPlan?: CLVTradingPlan
  generatedAt: string
}

export function AIBettingIntelligence() {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchIntelligence = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/premium/ai-intelligence')
      
      if (!response.ok) {
        throw new Error('Failed to fetch AI intelligence')
      }

      const data = await response.json()
      setAnalysis(data)
      setLastUpdate(new Date())

      // If we have CLV opportunities, fetch OpenAI trading plan
      if (data.rollingData?.clvOpportunities && data.rollingData.clvOpportunities.length > 0) {
        try {
          const clvResponse = await fetch('/api/premium/ai-intelligence/clv-openai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clvOpportunities: data.rollingData.clvOpportunities,
              bankrollUnits: 100,
            }),
          })

          if (clvResponse.ok) {
            const clvData = await clvResponse.json()
            if (clvData.tradingPlan) {
              setAnalysis(prev => prev ? { ...prev, clvTradingPlan: clvData.tradingPlan } : null)
            }
          }
        } catch (clvError) {
          console.error('Error fetching CLV trading plan:', clvError)
          // Don't show error toast for CLV plan, it's optional
        }
      }
    } catch (error) {
      console.error('Error fetching AI intelligence:', error)
      toast.error('Failed to load AI insights')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchIntelligence()

    // Auto-refresh every 30 seconds if enabled
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchIntelligence()
      }, 30000) // 30 seconds

      return () => clearInterval(interval)
    }
  }, [fetchIntelligence, autoRefresh])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchIntelligence()
    setRefreshing(false)
    toast.success('AI insights refreshed')
  }

  const getInsightIcon = (type: string) => {
    switch (type) {
      case "strength": return <TrendingUp className="h-5 w-5 text-emerald-400" />
      case "weakness": return <AlertCircle className="h-5 w-5 text-red-400" />
      case "opportunity": return <Target className="h-5 w-5 text-blue-400" />
      case "warning": return <AlertCircle className="h-5 w-5 text-yellow-400" />
      default: return <Brain className="h-5 w-5 text-slate-400" />
    }
  }

  const getInsightColor = (type: string) => {
    switch (type) {
      case "strength": return "bg-emerald-500/20 border-emerald-500/50"
      case "weakness": return "bg-red-500/20 border-red-500/50"
      case "opportunity": return "bg-blue-500/20 border-blue-500/50"
      case "warning": return "bg-yellow-500/20 border-yellow-500/50"
      default: return "bg-slate-500/20 border-slate-500/50"
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-400"
    if (score >= 60) return "text-blue-400"
    if (score >= 40) return "text-yellow-400"
    return "text-red-400"
  }

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case "TAKE": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/50"
      case "OPTIONAL": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50"
      case "PASS": return "bg-red-500/20 text-red-400 border-red-500/50"
      default: return "bg-slate-500/20 text-slate-400 border-slate-500/50"
    }
  }

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-slate-700 shadow-2xl">
        <CardContent className="p-12">
          <div className="flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
            <p className="text-slate-400">Analyzing your betting patterns...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!analysis) {
    return (
      <Card className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-slate-700 shadow-2xl">
        <CardContent className="p-12 text-center">
          <AlertCircle className="h-12 w-12 text-slate-500 mx-auto mb-4" />
          <p className="text-slate-400 mb-4">No betting data available for analysis</p>
          <p className="text-sm text-slate-500">
            Start placing bets to get AI-powered insights and recommendations
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-slate-700 shadow-2xl">
      <CardHeader className="border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-emerald-500/30">
              <Brain className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <CardTitle className="text-white text-2xl font-bold">AI Betting Intelligence</CardTitle>
              <p className="text-slate-400 text-sm mt-1 flex items-center gap-2">
                <Clock className="h-3 w-3" />
                {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : 'Real-time analysis'}
                {autoRefresh && <Badge variant="outline" className="ml-2 text-xs border-emerald-500/50 text-emerald-400">Live</Badge>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`text-slate-400 hover:text-white ${autoRefresh ? 'bg-emerald-500/10 text-emerald-400' : ''}`}
            >
              <Activity className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-pulse' : ''}`} />
              {autoRefresh ? 'Auto' : 'Manual'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-slate-800/50 border border-slate-700">
            <TabsTrigger value="overview" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
              Overview
            </TabsTrigger>
            <TabsTrigger value="clv" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400">
              CLV Trading
            </TabsTrigger>
            <TabsTrigger value="parlays" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
              Parlays
            </TabsTrigger>
            <TabsTrigger value="insights" className="data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-400">
              Insights
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* Overall Score */}
            <div className="bg-gradient-to-r from-slate-800/80 to-slate-700/80 rounded-xl p-6 border border-slate-600/50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-emerald-400" />
                  Overall Performance Score
                </h3>
                <Badge className={`${getScoreColor(analysis.overallScore)} bg-slate-700/50 border-slate-600 text-2xl px-4 py-2`}>
                  {analysis.overallScore}/100
                </Badge>
              </div>
              <div className="w-full bg-slate-700/50 rounded-full h-4 mb-6">
                <div
                  className={`h-4 rounded-full transition-all ${
                    analysis.overallScore >= 80 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' :
                    analysis.overallScore >= 60 ? 'bg-gradient-to-r from-blue-500 to-blue-400' :
                    analysis.overallScore >= 40 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' : 
                    'bg-gradient-to-r from-red-500 to-red-400'
                  }`}
                  style={{ width: `${analysis.overallScore}%` }}
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/30">
                  <div className="text-xs text-slate-400 mb-1">Total Bets</div>
                  <div className="text-2xl font-bold text-white">{analysis.performanceSummary.totalBets}</div>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/30">
                  <div className="text-xs text-slate-400 mb-1">Win Rate</div>
                  <div className="text-2xl font-bold text-emerald-400">
                    {analysis.performanceSummary.winRate.toFixed(1)}%
                  </div>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/30">
                  <div className="text-xs text-slate-400 mb-1">ROI</div>
                  <div className={`text-2xl font-bold ${analysis.performanceSummary.roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {analysis.performanceSummary.roi >= 0 ? '+' : ''}{analysis.performanceSummary.roi.toFixed(1)}%
                  </div>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/30">
                  <div className="text-xs text-slate-400 mb-1">Avg Stake</div>
                  <div className="text-2xl font-bold text-white">
                    ${analysis.performanceSummary.avgStake.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Recommendations */}
            {analysis.recommendations.length > 0 && (
              <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-xl p-6 border border-blue-500/30">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-400" />
                  AI Recommendations
                </h3>
                <div className="space-y-3">
                  {analysis.recommendations.map((rec, index) => (
                    <div
                      key={index}
                      className="bg-slate-800/50 rounded-lg p-4 flex items-start gap-3 border border-slate-700/50"
                    >
                      <div className="p-1.5 rounded bg-blue-500/20 mt-0.5">
                        <DollarSign className="h-4 w-4 text-blue-400" />
                      </div>
                      <p className="text-slate-300 flex-1">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* CLV Trading Tab */}
          <TabsContent value="clv" className="space-y-6 mt-6">
            {/* OpenAI Trading Plan */}
            {analysis.clvTradingPlan && analysis.clvTradingPlan.ranked_bets.length > 0 && (
              <div className="bg-gradient-to-r from-emerald-900/30 to-blue-900/30 rounded-xl p-6 border border-emerald-500/30">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-emerald-400" />
                    AI Trading Plan (OpenAI)
                  </h3>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50">
                    {analysis.clvTradingPlan.ranked_bets.filter(b => b.recommendation === 'TAKE').length} Active
                  </Badge>
                </div>
                <div className="space-y-4">
                  {analysis.clvTradingPlan.ranked_bets.map((bet) => (
                    <div key={bet.match_id} className="bg-slate-800/60 rounded-lg p-5 border border-slate-700/50">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Badge className={getRecommendationColor(bet.recommendation)}>
                              {bet.recommendation}
                            </Badge>
                            <span className="text-sm font-semibold text-white">Rank #{bet.rank}</span>
                            <span className="text-xs text-slate-400">Confidence: {bet.confidence.toFixed(0)}%</span>
                          </div>
                          <h4 className="text-lg font-bold text-white mb-1">{bet.match}</h4>
                          <p className="text-sm text-slate-300 mb-2">{bet.market}</p>
                          <div className="flex flex-wrap gap-4 text-xs text-slate-400 mb-3">
                            <span>Entry: {bet.entry.price_target.toFixed(2)}</span>
                            <span>Timing: {bet.entry.timing}</span>
                            <span>Stake: {bet.staking.units.toFixed(2)} units ({bet.staking.method})</span>
                          </div>
                          <div className="space-y-2">
                            <div>
                              <div className="text-xs font-semibold text-emerald-400 mb-1">Why:</div>
                              <ul className="text-xs text-slate-300 space-y-1">
                                {bet.why.map((reason, idx) => (
                                  <li key={idx} className="flex items-start gap-2">
                                    <span className="text-emerald-400 mt-0.5">•</span>
                                    <span>{reason}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                            {bet.risk_notes.length > 0 && (
                              <div>
                                <div className="text-xs font-semibold text-yellow-400 mb-1">Risk Notes:</div>
                                <ul className="text-xs text-slate-300 space-y-1">
                                  {bet.risk_notes.map((note, idx) => (
                                    <li key={idx} className="flex items-start gap-2">
                                      <span className="text-yellow-400 mt-0.5">⚠</span>
                                      <span>{note}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {analysis.clvTradingPlan.portfolio_summary.notes.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <div className="text-xs font-semibold text-blue-400 mb-2">Portfolio Notes:</div>
                    <ul className="text-xs text-slate-300 space-y-1">
                      {analysis.clvTradingPlan.portfolio_summary.notes.map((note, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-blue-400 mt-0.5">•</span>
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* CLV Opportunities List */}
            {analysis.rollingData?.clvOpportunities && analysis.rollingData.clvOpportunities.length > 0 && (
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Activity className="h-5 w-5 text-blue-400" />
                    CLV Opportunities
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-blue-400 hover:text-blue-300"
                    onClick={() => window.location.href = '/dashboard/clv'}
                  >
                    View All <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </div>
                <div className="space-y-3">
                  {analysis.rollingData.clvOpportunities.slice(0, 5).map((opp) => (
                    <div key={opp.alert_id} className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/50 hover:border-blue-500/50 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-white mb-1">
                            {opp.home_team} vs {opp.away_team}
                          </div>
                          <div className="text-xs text-slate-400 mb-2">
                            {opp.league} • {opp.outcome}
                          </div>
                          <div className="flex items-center gap-4 text-xs">
                            <div>
                              <span className="text-slate-400">Entry:</span>
                              <span className="text-emerald-400 font-semibold ml-1">{opp.entry_odds.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Consensus:</span>
                              <span className="text-white ml-1">{opp.consensus_odds.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">CLV:</span>
                              <span className="text-emerald-400 font-semibold ml-1">+{opp.clv_pct.toFixed(2)}%</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Confidence:</span>
                              <span className="text-blue-400 ml-1">{opp.confidence_score}/100</span>
                            </div>
                          </div>
                        </div>
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50 ml-2">
                          {opp.books_used} books
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Parlays Tab */}
          <TabsContent value="parlays" className="space-y-6 mt-6">
            {analysis.rollingData?.activeParlays && analysis.rollingData.activeParlays.length > 0 ? (
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Layers className="h-5 w-5 text-purple-400" />
                    Top Parlay Opportunities
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-purple-400 hover:text-purple-300"
                    onClick={() => window.location.href = '/dashboard/parlays'}
                  >
                    View All <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </div>
                <div className="space-y-4">
                  {analysis.rollingData.activeParlays.slice(0, 5).map((parlay) => (
                    <div key={parlay.parlay_id} className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/50 hover:border-purple-500/50 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/50">
                              {parlay.leg_count}-Leg Parlay
                            </Badge>
                            <span className="text-sm font-semibold text-emerald-400">
                              +{parlay.edge_pct.toFixed(1)}% Edge
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mb-3">
                            Win Prob: {parlay.win_probability.toFixed(1)}% • Odds: {parlay.implied_odds.toFixed(2)} • {parlay.confidence_tier}
                          </div>
                          <div className="space-y-2">
                            {parlay.legs.map((leg) => (
                              <div key={leg.leg_order} className="bg-slate-600/20 rounded p-2 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="text-white">
                                    <span className="text-slate-400">Leg {leg.leg_order}:</span> {leg.home_team} vs {leg.away_team}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-400">{leg.outcome}</span>
                                    <span className="text-emerald-400">+{leg.edge.toFixed(1)}%</span>
                                    <span className="text-slate-500">{leg.odds.toFixed(2)}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {parlay.leg_count > parlay.legs.length && (
                              <div className="text-xs text-slate-500 italic">
                                +{parlay.leg_count - parlay.legs.length} more leg{parlay.leg_count - parlay.legs.length > 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 text-center">
                <Layers className="h-12 w-12 text-slate-500 mx-auto mb-4" />
                <p className="text-slate-400">No active parlays available</p>
              </div>
            )}
          </TabsContent>

          {/* Insights Tab */}
          <TabsContent value="insights" className="space-y-6 mt-6">
            {analysis.insights.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analysis.insights.map((insight, index) => (
                  <Card
                    key={index}
                    className={`bg-slate-800/60 border ${getInsightColor(insight.type)}`}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start gap-3">
                        {getInsightIcon(insight.type)}
                        <div className="flex-1">
                          <h4 className="font-semibold text-white mb-2">{insight.title}</h4>
                          <p className="text-sm text-slate-300 mb-3">{insight.description}</p>
                          {insight.recommendation && (
                            <div className="mt-3 pt-3 border-t border-slate-700">
                              <p className="text-xs text-slate-400">
                                <strong className="text-emerald-400">Recommendation:</strong> {insight.recommendation}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 text-center">
                <Brain className="h-12 w-12 text-slate-500 mx-auto mb-4" />
                <p className="text-slate-400">No insights available yet</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
