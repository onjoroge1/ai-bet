"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy, Target, BarChart3, Users, CornerDownRight, Zap, Shield, AlertCircle, CheckCircle, X } from "lucide-react"

interface FinishedMatchStatsProps {
  matchData: {
    home: { name: string }
    away: { name: string }
    final_result?: {
      score: { home: number; away: number }
      outcome: string
      outcome_text: string
    }
    score?: { home: number; away: number }
    live_data?: {
      statistics?: {
        shots?: { home: number; away: number }
        shots_on_target?: { home: number; away: number }
        possession?: { home: number; away: number }
        corners?: { home: number; away: number }
        fouls?: { home: number; away: number }
        yellow_cards?: { home: number; away: number }
        red_cards?: { home: number; away: number }
        passes?: { home: number; away: number }
        pass_accuracy?: { home: number; away: number }
        saves?: { home: number; away: number }
        tackles?: { home: number; away: number }
        offsides?: { home: number; away: number }
      }
    }
  }
  predictionData?: any
}

/**
 * Finished Match Stats Component
 * Displays final score, outcome, and detailed match statistics for completed matches
 */
export function FinishedMatchStats({ matchData, predictionData }: FinishedMatchStatsProps) {
  // Extract score with comprehensive logging
  console.log('[FinishedMatchStats] 🔍 Component received matchData:', {
    hasFinalResult: !!matchData.final_result,
    finalResult: matchData.final_result,
    hasScore: !!matchData.score,
    score: matchData.score,
    status: (matchData as any).status,
    live_data: matchData.live_data,
    fullMatchData: matchData
  })
  
  const scoreFromFinalResult = matchData.final_result?.score
  const scoreFromScore = matchData.score
  const finalScore = scoreFromFinalResult || scoreFromScore || { home: 0, away: 0 }
  
  // Log if we're using fallback (0-0)
  if (!scoreFromFinalResult && !scoreFromScore) {
    console.error('[FinishedMatchStats] ❌ No score found, using 0-0 fallback', {
      hasFinalResult: !!matchData.final_result,
      hasScore: !!matchData.score,
      finalResult: matchData.final_result,
      score: matchData.score,
      matchDataKeys: Object.keys(matchData),
      matchData: matchData
    })
  } else {
    console.log('[FinishedMatchStats] ✅ Score found', {
      score: finalScore,
      source: scoreFromFinalResult ? 'final_result.score' : 'score',
      hasFinalResult: !!matchData.final_result,
      finalResult: matchData.final_result
    })
  }
  
  const outcome = matchData.final_result?.outcome_text || 
                  (finalScore.home > finalScore.away ? 'Home Win' :
                   finalScore.away > finalScore.home ? 'Away Win' : 'Draw')
  const stats = matchData.live_data?.statistics || {}

  // Determine winner
  const winner = finalScore.home > finalScore.away ? 'home' :
                 finalScore.away > finalScore.home ? 'away' : 'draw'

  // Check if prediction was correct
  const predictionCorrect = predictionData?.predictions?.v2?.pick || predictionData?.predictions?.v1?.pick
  const predictionWasCorrect = predictionCorrect && (
    (predictionCorrect === 'home' && winner === 'home') ||
    (predictionCorrect === 'away' && winner === 'away') ||
    (predictionCorrect === 'draw' && winner === 'draw')
  )

  const statItems = [
    { label: 'Shots', home: stats.shots?.home, away: stats.shots?.away, icon: Target },
    { label: 'Shots on Target', home: stats.shots_on_target?.home, away: stats.shots_on_target?.away, icon: Zap },
    { label: 'Possession', home: stats.possession?.home, away: stats.possession?.away, icon: Users, isPercentage: true },
    { label: 'Corners', home: stats.corners?.home, away: stats.corners?.away, icon: CornerDownRight },
    { label: 'Fouls', home: stats.fouls?.home, away: stats.fouls?.away, icon: AlertCircle },
    { label: 'Yellow Cards', home: stats.yellow_cards?.home, away: stats.yellow_cards?.away, icon: Shield },
    { label: 'Passes', home: stats.passes?.home, away: stats.passes?.away, icon: BarChart3 },
    { label: 'Pass Accuracy', home: stats.pass_accuracy?.home, away: stats.pass_accuracy?.away, icon: Target, isPercentage: true },
    { label: 'Saves', home: stats.saves?.home, away: stats.saves?.away, icon: Shield },
    { label: 'Tackles', home: stats.tackles?.home, away: stats.tackles?.away, icon: Target },
    { label: 'Offsides', home: stats.offsides?.home, away: stats.offsides?.away, icon: AlertCircle },
  ].filter(item => item.home !== undefined || item.away !== undefined)

  // Get prediction pick to display
  const v2Pick = predictionData?.predictions?.v2?.pick
  const v1Pick = predictionData?.predictions?.v1?.pick
  const recommendedBet = predictionData?.predictions?.recommended_bet
  const predictionPick = v2Pick || v1Pick || (recommendedBet ? recommendedBet.split('_')[0] : null)
  const getPredictionLabel = () => {
    if (!predictionPick) return null
    const normalized = predictionPick.toLowerCase()
    if (normalized === 'home' || normalized === 'h') return matchData.home.name
    if (normalized === 'away' || normalized === 'a') return matchData.away.name
    if (normalized === 'draw' || normalized === 'd') return 'Draw'
    return predictionPick
  }
  const predictionLabel = getPredictionLabel()

  return (
    <div className="space-y-6">
      {/* Final Result Card with Prediction Score */}
      <Card className="bg-gradient-to-r from-emerald-900/30 to-blue-900/30 border-emerald-500/30">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">Final Result</h2>
              <p className="text-slate-400 text-sm">Match Completed</p>
            </div>
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
              <Trophy className="w-4 h-4 mr-1" />
              FINISHED
            </Badge>
          </div>

          {/* Score Display */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1 text-center">
              <div className="text-slate-300 text-sm mb-2">{matchData.home.name}</div>
              <div className={`text-5xl font-bold ${winner === 'home' ? 'text-emerald-400' : 'text-slate-400'}`}>
                {finalScore.home}
              </div>
            </div>
            <div className="text-slate-500 text-2xl font-bold mx-8">-</div>
            <div className="flex-1 text-center">
              <div className="text-slate-300 text-sm mb-2">{matchData.away.name}</div>
              <div className={`text-5xl font-bold ${winner === 'away' ? 'text-emerald-400' : 'text-slate-400'}`}>
                {finalScore.away}
              </div>
            </div>
          </div>

          {/* Outcome and Prediction Accuracy */}
          <div className="text-center space-y-3 pt-4 border-t border-emerald-500/20">
            <div className="text-xl font-semibold text-white">{outcome}</div>
            
            {/* Prediction Display */}
            {predictionLabel && (
              <div className="flex items-center justify-center gap-3">
                <div className="text-slate-400 text-sm">Our Prediction:</div>
                <div className="text-white font-semibold">{predictionLabel}</div>
              </div>
            )}
            
            {/* Prediction Accuracy Badge */}
            {predictionWasCorrect !== undefined && (
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold ${
                predictionWasCorrect
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-red-500/20 text-red-300 border border-red-500/40'
              }`}>
                {predictionWasCorrect ? (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    <span>Prediction Correct ✓</span>
                  </>
                ) : (
                  <>
                    <X className="w-5 h-5" />
                    <span>Prediction Incorrect ✗</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Match Statistics */}
      {statItems.length > 0 && (
        <Card className="bg-slate-800/60 border-slate-700">
          <div className="p-6">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center">
              <BarChart3 className="w-5 h-5 mr-2 text-blue-400" />
              Match Statistics
            </h3>
            <div className="space-y-4">
              {statItems.map((stat, index) => {
                const StatIcon = stat.icon
                const homeValue = stat.home ?? 0
                const awayValue = stat.away ?? 0
                const total = homeValue + awayValue
                const homePercent = total > 0 ? (homeValue / total) * 100 : 50
                const awayPercent = total > 0 ? (awayValue / total) * 100 : 50

                return (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-slate-300">
                        <StatIcon className="w-4 h-4" />
                        <span>{stat.label}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-white font-semibold w-12 text-right">
                          {stat.isPercentage ? `${homeValue}%` : homeValue}
                        </span>
                        <span className="text-slate-500">-</span>
                        <span className="text-white font-semibold w-12 text-left">
                          {stat.isPercentage ? `${awayValue}%` : awayValue}
                        </span>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="flex h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-500 transition-all"
                        style={{ width: `${homePercent}%` }}
                      />
                      <div
                        className="bg-red-500 transition-all"
                        style={{ width: `${awayPercent}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

