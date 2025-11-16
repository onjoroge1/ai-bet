"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calculator, TrendingUp, Target, DollarSign, AlertCircle, Loader2 } from "lucide-react"

interface BettingIntelligenceData {
  betting_intelligence: {
    clv: {
      home: number
      draw: number
      away: number
    }
    best_bet: {
      pick: string
      edge: number
      recommendation: string
    }
    kelly_sizing: {
      full_kelly: number
      fractional_kelly: number
      recommended_stake_pct?: number
      max_stake_pct: number
      bankroll_stake?: number
      expected_value?: number
    }
  }
  home: {
    name: string
  }
  away: {
    name: string
  }
}

interface BettingIntelligenceProps {
  matchId: string
  bankroll?: number
  model?: 'v1' | 'v2' | 'best'
  showCard?: boolean
}

export function BettingIntelligence({ matchId, bankroll = 1000, model = 'best', showCard = true }: BettingIntelligenceProps) {
  const [data, setData] = useState<BettingIntelligenceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchBettingIntelligence = async () => {
      try {
        setLoading(true)
        setError(null)

        const url = `/api/betting-intelligence/${matchId}?bankroll=${bankroll}&model=${model}`
        const response = await fetch(url)

        if (!response.ok) {
          throw new Error('Failed to fetch betting intelligence')
        }

        const result = await response.json()

        if (result.betting_intelligence) {
          setData(result)
        } else {
          setError('Betting intelligence not available for this match')
        }
      } catch (err) {
        console.error('Error fetching betting intelligence:', err)
        setError(err instanceof Error ? err.message : 'Failed to load betting intelligence')
      } finally {
        setLoading(false)
      }
    }

    fetchBettingIntelligence()
  }, [matchId, bankroll, model])

  const loadingContent = (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
      <span className="ml-2 text-slate-400">Loading betting intelligence...</span>
    </div>
  )

  const errorContent = (
    <div className="flex items-center gap-2 text-slate-400">
      <AlertCircle className="h-5 w-5" />
      <span>{error || 'Betting intelligence not available for this match'}</span>
    </div>
  )

  if (loading) {
    return showCard ? (
      <Card className="bg-slate-800/60 border-slate-700">
        <div className="p-6">{loadingContent}</div>
      </Card>
    ) : loadingContent
  }

  if (error || !data?.betting_intelligence) {
    return showCard ? (
      <Card className="bg-slate-800/60 border-slate-700">
        <div className="p-6">{errorContent}</div>
      </Card>
    ) : errorContent
  }

  const { betting_intelligence, home, away } = data
  const { best_bet, kelly_sizing, clv } = betting_intelligence

  // Add null checks and default values
  const edge = best_bet?.edge ?? 0
  const pick = best_bet?.pick ?? 'home'
  const recommendation = best_bet?.recommendation ?? 'PASS'
  const homeName = home?.name ?? 'Home'
  const awayName = away?.name ?? 'Away'
  
  const clvHome = clv?.home ?? 0
  const clvDraw = clv?.draw ?? 0
  const clvAway = clv?.away ?? 0
  
  const fullKelly = kelly_sizing?.full_kelly ?? 0
  const fractionalKelly = kelly_sizing?.fractional_kelly ?? 0
  const maxStakePct = kelly_sizing?.max_stake_pct ?? 0
  
  // Calculate recommended stake - use bankroll_stake if available (direct dollar amount)
  // Otherwise calculate from recommended_stake_pct
  const bankrollStake = kelly_sizing?.bankroll_stake
  const recommendedStakePct = kelly_sizing?.recommended_stake_pct
  
  // If bankroll_stake is provided directly, use it; otherwise calculate from percentage
  const stakeAmount = bankrollStake !== undefined 
    ? bankrollStake 
    : (recommendedStakePct !== undefined ? bankroll * (recommendedStakePct / 100) : 0)
  
  // Calculate percentage for display if we have bankroll_stake but not recommended_stake_pct
  const displayStakePct = recommendedStakePct !== undefined 
    ? recommendedStakePct 
    : (bankrollStake !== undefined && bankroll > 0 ? (bankrollStake / bankroll) * 100 : 0)

  const getPickName = (pickValue: string) => {
    if (pickValue === 'home') return homeName
    if (pickValue === 'away') return awayName
    return 'Draw'
  }

  const getRecommendationColor = (rec: string) => {
    if (rec === 'STRONG BET') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
    if (rec === 'VALUE BET') return 'bg-blue-500/20 text-blue-400 border-blue-500/40'
    return 'bg-slate-500/20 text-slate-400 border-slate-500/40'
  }

  const getEdgeColor = (edgeValue: number) => {
    if (edgeValue >= 0.05) return 'text-emerald-400'
    if (edgeValue >= 0.02) return 'text-blue-400'
    return 'text-yellow-400'
  }

  const content = (
    <div className="space-y-6">
      {showCard && (
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Calculator className="h-5 w-5 text-emerald-400" />
            Betting Intelligence
          </h3>
          <Badge className={getRecommendationColor(recommendation)}>
            {recommendation}
          </Badge>
        </div>
      )}

      {!showCard && (
        <div className="flex items-center justify-end mb-4">
          <Badge className={getRecommendationColor(recommendation)}>
            {recommendation}
          </Badge>
        </div>
      )}

      <div className="space-y-6">
          {/* Best Bet Section */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-emerald-400" />
              <span className="text-slate-400 text-sm font-medium">Best Bet</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Pick:</span>
                <span className="text-white font-semibold">{getPickName(pick)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Edge:</span>
                <span className={`font-bold text-lg ${getEdgeColor(edge)}`}>
                  {(edge * 100).toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          {/* CLV (Closing Line Value) */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-blue-400" />
              <span className="text-slate-400 text-sm font-medium">Closing Line Value (CLV)</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="text-slate-400 text-xs mb-1">Home</div>
                <div className={`text-sm font-medium ${clvHome >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {(clvHome * 100).toFixed(1)}%
                </div>
              </div>
              <div className="text-center">
                <div className="text-slate-400 text-xs mb-1">Draw</div>
                <div className={`text-sm font-medium ${clvDraw >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {(clvDraw * 100).toFixed(1)}%
                </div>
              </div>
              <div className="text-center">
                <div className="text-slate-400 text-xs mb-1">Away</div>
                <div className={`text-sm font-medium ${clvAway >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {(clvAway * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          {/* Kelly Sizing */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="h-4 w-4 text-purple-400" />
              <span className="text-slate-400 text-sm font-medium">Kelly Criterion Sizing</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 text-sm">Recommended Stake:</span>
                <div className="text-right">
                  <div className="text-white font-semibold">
                    ${stakeAmount.toFixed(2)}
                  </div>
                  <div className="text-slate-400 text-xs">
                    {displayStakePct.toFixed(1)}% of ${bankroll.toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-700">
                <span className="text-slate-400 text-xs">Full Kelly:</span>
                <span className="text-slate-300 text-xs">{fullKelly.toFixed(3)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-xs">Fractional (Half Kelly):</span>
                <span className="text-slate-300 text-xs">{fractionalKelly.toFixed(3)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-xs">Max Stake:</span>
                <span className="text-slate-300 text-xs">{maxStakePct.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          {/* Info Note */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <p className="text-blue-300 text-xs">
              <strong>Note:</strong> Kelly sizing uses fractional (half Kelly) for risk management. 
              Never exceed the maximum stake percentage.
            </p>
          </div>
        </div>
    </div>
  )

  return showCard ? (
    <Card className="bg-gradient-to-br from-emerald-900/20 to-blue-900/20 border-emerald-500/30">
      <div className="p-6">{content}</div>
    </Card>
  ) : content
}

