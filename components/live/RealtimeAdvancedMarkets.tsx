"use client"

import { useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, Target, BarChart3 } from "lucide-react"

interface RealtimeAdvancedMarketsProps {
  odds: {
    home: number
    draw: number
    away: number
  } | null
  currentScore?: {
    home: number | null
    away: number | null
  } | null
  minute?: number | null
  homeTeamName: string
  awayTeamName: string
}

interface MarketCalculation {
  over: number
  under: number
  probability: {
    over: number
    under: number
  }
}

/**
 * Real-time Advanced Markets Calculator
 * Calculates betting markets based on current odds and match state
 */
export function RealtimeAdvancedMarkets({
  odds,
  currentScore,
  minute,
  homeTeamName,
  awayTeamName
}: RealtimeAdvancedMarketsProps) {
  
  // Convert decimal odds to implied probability
  const impliedProbability = (decimalOdds: number): number => {
    if (!decimalOdds || decimalOdds <= 0) return 0.33 // Default to equal probability
    return 1 / decimalOdds
  }

  // Calculate market probabilities based on current odds
  const calculateMarket = useMemo(() => {
    if (!odds || !odds.home || !odds.draw || !odds.away) return null

    const homeProb = impliedProbability(odds.home)
    const drawProb = impliedProbability(odds.draw)
    const awayProb = impliedProbability(odds.away)

    // Normalize probabilities (remove bookmaker margin)
    const totalProb = homeProb + drawProb + awayProb
    const normalizedHome = homeProb / totalProb
    const normalizedDraw = drawProb / totalProb
    const normalizedAway = awayProb / totalProb

    // Get current goals from score
    const homeGoals = currentScore?.home ?? 0
    const awayGoals = currentScore?.away ?? 0
    const totalGoals = homeGoals + awayGoals

    // Calculate expected goals based on win probabilities
    // Model: stronger team (higher win probability) = more goals expected
    // Formula: expected goals = win_prob * 1.5 + draw_prob * 0.5
    const homeExpectedGoals = normalizedHome * 1.5 + normalizedDraw * 0.5
    const awayExpectedGoals = normalizedAway * 1.5 + normalizedDraw * 0.5
    
    // Adjust based on current score and time remaining
    // Real-time calculation: account for goals already scored and time left
    const timeElapsed = minute ?? 90
    const timeRemaining = Math.max(0, 90 - timeElapsed)
    const timeFactor = timeRemaining / 90  // 0 = match over, 1 = match just started

    // Calculate remaining expected goals (scaled by time remaining)
    const remainingHomeExpected = homeExpectedGoals * timeFactor
    const remainingAwayExpected = awayExpectedGoals * timeFactor
    
    // Total expected goals = current goals + remaining expected goals
    // Example: If score is 1-0 at 45', and expected remaining goals are 0.5 each,
    // totalExpectedGoals = 1 + 0 + 0.5 + 0.5 = 2.0 goals
    const totalExpectedGoals = homeGoals + awayGoals + remainingHomeExpected + remainingAwayExpected

    // Over/Under markets calculation
    // Uses Poisson distribution approximation: P(over line) = 1 - e^(-lambda/(line+1))
    // where lambda = expected total goals
    const calculateOverUnder = (line: number): MarketCalculation => {
      const lambda = Math.max(0.1, totalExpectedGoals)
      
      // Poisson approximation for probability of exceeding the line
      const overProb = Math.max(0.01, Math.min(0.99, 1 - Math.exp(-lambda / (line + 1))))
      const underProb = 1 - overProb
      
      return {
        over: totalGoals > line ? 1 : overProb,
        under: totalGoals <= line ? 1 : underProb,
        probability: {
          over: overProb * 100,
          under: underProb * 100
        }
      }
    }

    // Team Total Goals markets
    const calculateTeamTotals = (teamGoals: number, teamExpected: number, line: number): MarketCalculation => {
      const remainingExpected = teamExpected * timeFactor
      const totalExpected = teamGoals + remainingExpected
      
      const overProb = Math.max(0.01, Math.min(0.99, 1 - Math.exp(-totalExpected / (line + 1))))
      const underProb = 1 - overProb
      
      return {
        over: teamGoals > line ? 1 : overProb,
        under: teamGoals <= line ? 1 : underProb,
        probability: {
          over: overProb * 100,
          under: underProb * 100
        }
      }
    }

    // Both Teams to Score
    const homeScoreProb = Math.max(0.01, Math.min(0.99, normalizedHome * 0.7 + normalizedDraw * 0.5))
    const awayScoreProb = Math.max(0.01, Math.min(0.99, normalizedAway * 0.7 + normalizedDraw * 0.5))
    const bttsYesProb = homeScoreProb * awayScoreProb
    const bttsNoProb = 1 - bttsYesProb

    // Asian Handicap calculations
    const calculateAsianHandicap = (handicap: number): { home: number; away: number } => {
      // Simplified: handicap affects win probability
      const adjustedHomeProb = normalizedHome + (handicap > 0 ? 0.1 : -0.1) * Math.abs(handicap)
      const adjustedAwayProb = normalizedAway - (handicap > 0 ? 0.1 : -0.1) * Math.abs(handicap)
      
      return {
        home: Math.max(0.01, Math.min(0.99, adjustedHomeProb)) * 100,
        away: Math.max(0.01, Math.min(0.99, adjustedAwayProb)) * 100
      }
    }

    return {
      overUnder: {
        "0.5": calculateOverUnder(0.5),
        "1.5": calculateOverUnder(1.5),
        "2.5": calculateOverUnder(2.5),
        "3.5": calculateOverUnder(3.5),
        "4.5": calculateOverUnder(4.5)
      },
      teamTotals: {
        home: {
          "0.5": calculateTeamTotals(homeGoals, homeExpectedGoals, 0.5),
          "1.5": calculateTeamTotals(homeGoals, homeExpectedGoals, 1.5),
          "2.5": calculateTeamTotals(homeGoals, homeExpectedGoals, 2.5)
        },
        away: {
          "0.5": calculateTeamTotals(awayGoals, awayExpectedGoals, 0.5),
          "1.5": calculateTeamTotals(awayGoals, awayExpectedGoals, 1.5),
          "2.5": calculateTeamTotals(awayGoals, awayExpectedGoals, 2.5)
        }
      },
      btts: {
        yes: bttsYesProb * 100,
        no: bttsNoProb * 100
      },
      asianHandicap: {
        "-1.5": calculateAsianHandicap(-1.5),
        "-1": calculateAsianHandicap(-1),
        "-0.5": calculateAsianHandicap(-0.5),
        "0": { home: normalizedHome * 100, away: normalizedAway * 100 },
        "0.5": calculateAsianHandicap(0.5),
        "1": calculateAsianHandicap(1),
        "1.5": calculateAsianHandicap(1.5)
      },
      totalExpectedGoals,
      homeExpectedGoals: homeGoals + remainingHomeExpected,
      awayExpectedGoals: awayGoals + remainingAwayExpected
    }
  }, [odds, currentScore, minute, homeTeamName, awayTeamName])

  if (!calculateMarket || !odds) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Over/Under Totals */}
      <Card className="bg-slate-800 border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <BarChart3 className="w-5 h-5 mr-2 text-purple-400" />
            Over/Under Totals
          </h3>
          <div className="text-right">
            <div className="text-slate-400 text-xs">Expected Total Goals</div>
            <div className="text-white font-bold text-lg">{calculateMarket.totalExpectedGoals.toFixed(1)}</div>
            <div className="text-slate-500 text-xs">Based on odds & time</div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Object.entries(calculateMarket.overUnder).map(([line, market]) => (
            <div key={line} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
              <div className="text-center mb-3">
                <div className="text-slate-300 text-sm font-semibold mb-1">Over/Under {line}</div>
                <div className="text-slate-400 text-xs">Probability</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="text-center">
                  <div className="text-green-400 text-xs font-medium mb-1">Over</div>
                  <div className="text-green-400 font-bold text-lg">{market.probability.over.toFixed(1)}%</div>
                </div>
                <div className="text-center">
                  <div className="text-red-400 text-xs font-medium mb-1">Under</div>
                  <div className="text-red-400 font-bold text-lg">{market.probability.under.toFixed(1)}%</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Team Total Goals */}
      <Card className="bg-slate-800 border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <Target className="w-5 h-5 mr-2 text-blue-400" />
            Team Total Goals
          </h3>
        </div>
        
        {/* Callout explaining calculations */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <Target className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-slate-300">
              <span className="font-semibold text-blue-400">How it works:</span> Expected goals per team are calculated from win probabilities (derived from current odds) and adjusted for time remaining. Probabilities use Poisson distribution to estimate each team exceeding their totals.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Home Team */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-white font-medium">{homeTeamName}</h4>
              <div className="text-right">
                <div className="text-slate-400 text-xs">Expected Goals</div>
                <div className="text-white font-bold text-sm">{calculateMarket.homeExpectedGoals.toFixed(1)}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(calculateMarket.teamTotals.home).map(([line, market]) => (
                <div key={line} className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
                  <div className="text-center mb-2">
                    <div className="text-slate-400 text-xs mb-1">Over/Under {line}</div>
                    <div className="text-slate-500 text-xs">Probability</div>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <div className="text-center">
                      <div className="text-green-400 text-xs font-medium mb-0.5">Over</div>
                      <div className="text-green-400 font-bold text-sm">{market.probability.over.toFixed(0)}%</div>
                    </div>
                    <div className="text-center">
                      <div className="text-red-400 text-xs font-medium mb-0.5">Under</div>
                      <div className="text-red-400 font-bold text-sm">{market.probability.under.toFixed(0)}%</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Away Team */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-white font-medium">{awayTeamName}</h4>
              <div className="text-right">
                <div className="text-slate-400 text-xs">Expected Goals</div>
                <div className="text-white font-bold text-sm">{calculateMarket.awayExpectedGoals.toFixed(1)}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(calculateMarket.teamTotals.away).map(([line, market]) => (
                <div key={line} className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
                  <div className="text-center mb-2">
                    <div className="text-slate-400 text-xs mb-1">Over/Under {line}</div>
                    <div className="text-slate-500 text-xs">Probability</div>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <div className="text-center">
                      <div className="text-green-400 text-xs font-medium mb-0.5">Over</div>
                      <div className="text-green-400 font-bold text-sm">{market.probability.over.toFixed(0)}%</div>
                    </div>
                    <div className="text-center">
                      <div className="text-red-400 text-xs font-medium mb-0.5">Under</div>
                      <div className="text-red-400 font-bold text-sm">{market.probability.under.toFixed(0)}%</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Both Teams to Score */}
      <Card className="bg-slate-800 border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
          <TrendingUp className="w-5 h-5 mr-2 text-yellow-400" />
          Both Teams to Score
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600 text-center">
            <div className="text-slate-400 text-sm mb-2">Yes</div>
            <div className="text-green-400 font-bold text-3xl">{calculateMarket.btts.yes.toFixed(1)}%</div>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600 text-center">
            <div className="text-slate-400 text-sm mb-2">No</div>
            <div className="text-red-400 font-bold text-3xl">{calculateMarket.btts.no.toFixed(1)}%</div>
          </div>
        </div>
      </Card>

      {/* Asian Handicap */}
      <Card className="bg-slate-800 border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
          <Target className="w-5 h-5 mr-2 text-emerald-400" />
          Asian Handicap
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(calculateMarket.asianHandicap).map(([handicap, probs]) => (
            <div key={handicap} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
              <div className="text-center mb-3">
                <div className="text-slate-400 text-xs mb-1">Handicap {handicap}</div>
                <div className="text-white font-medium">{homeTeamName} {handicap}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center">
                  <div className="text-slate-400 text-xs mb-1">{homeTeamName}</div>
                  <div className="text-blue-400 font-bold text-lg">{probs.home.toFixed(1)}%</div>
                </div>
                <div className="text-center">
                  <div className="text-slate-400 text-xs mb-1">{awayTeamName}</div>
                  <div className="text-red-400 font-bold text-lg">{probs.away.toFixed(1)}%</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Live Update Indicator */}
      <div className="text-center text-slate-500 text-xs flex items-center justify-center">
        <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
        Real-time calculations based on current odds
        {minute && (
          <span className="ml-2">• {minute}'</span>
        )}
      </div>
    </div>
  )
}

