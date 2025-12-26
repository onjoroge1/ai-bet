import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'
import { randomUUID } from 'crypto'

interface MarketData {
  dnb?: { home: number; away: number }
  btts?: { yes: number; no: number }
  totals?: Record<string, { over: number; under: number }>
  asian_handicap?: {
    home?: Record<string, { win: number; lose: number; push?: number }>
    away?: Record<string, { win: number; lose: number; push?: number }>
  }
  double_chance?: { "12": number; "1X": number; "X2": number }
  win_to_nil?: { home: number; away: number }
  clean_sheet?: { home: number; away: number }
  team_totals?: {
    home?: Record<string, { over: number; under: number }>
    away?: Record<string, { over: number; under: number }>
  }
  winning_margin?: Record<string, number>
  odd_even_total?: { odd: number; even: number }
}

interface SGP {
  matchId: string
  homeTeam: string
  awayTeam: string
  league: string
  kickoffDate: Date
  legs: Array<{
    market: string
    side: string
    probability: number
    description: string
    outcome: string // "H", "D", "A", "OVER", "UNDER", "YES", "NO", etc.
  }>
  combinedProb: number
  fairOdds: number
  confidence: 'high' | 'medium' | 'low'
}

/**
 * Generate single-game parlays from QuickPurchase predictionData
 */
async function generateSGPs(): Promise<SGP[]> {
  const upcomingMatches = await prisma.marketMatch.findMany({
    where: {
      status: 'UPCOMING',
      kickoffDate: { gte: new Date() },
      isActive: true
    },
    select: {
      matchId: true,
      homeTeam: true,
      awayTeam: true,
      league: true,
      kickoffDate: true
    }
  })

  const upcomingMatchIdSet = new Set(upcomingMatches.map(m => m.matchId))
  const quickPurchases = await prisma.quickPurchase.findMany({
    where: {
      matchId: { in: Array.from(upcomingMatchIdSet) },
      isActive: true,
      isPredictionActive: true,
      predictionData: { not: null }
    },
    select: {
      matchId: true,
      predictionData: true
    }
  })

  const sgps: SGP[] = []

  for (const qp of quickPurchases) {
    const match = upcomingMatches.find(m => m.matchId === qp.matchId)
    if (!match) continue

    const predictionData = qp.predictionData as any
    const marketsV2 = predictionData?.additional_markets_v2 as MarketData | undefined

    if (!marketsV2) continue

    const legs: SGP['legs'] = []
    const minProb = 0.55 // Minimum probability threshold

    // DNB (Draw No Bet)
    if (marketsV2.dnb) {
      if (marketsV2.dnb.home >= minProb) {
        legs.push({
          market: 'DNB',
          side: 'HOME',
          probability: marketsV2.dnb.home,
          description: `${match.homeTeam} Draw No Bet`,
          outcome: 'DNB_H'
        })
      }
      if (marketsV2.dnb.away >= minProb) {
        legs.push({
          market: 'DNB',
          side: 'AWAY',
          probability: marketsV2.dnb.away,
          description: `${match.awayTeam} Draw No Bet`,
          outcome: 'DNB_A'
        })
      }
    }

    // Totals - All lines (0.5, 1.5, 2.5, 3.5, 4.5)
    if (marketsV2.totals) {
      const totalLines = ['0_5', '1_5', '2_5', '3_5', '4_5']
      for (const line of totalLines) {
        const total = marketsV2.totals[line]
        if (total) {
          if (total.over >= minProb) {
            legs.push({
              market: 'TOTALS',
              side: 'OVER',
              probability: total.over,
              description: `Over ${line.replace('_', '.')} Goals`,
              outcome: `OVER_${line}`
            })
          }
          if (total.under >= minProb) {
            legs.push({
              market: 'TOTALS',
              side: 'UNDER',
              probability: total.under,
              description: `Under ${line.replace('_', '.')} Goals`,
              outcome: `UNDER_${line}`
            })
          }
        }
      }
    }

    // BTTS (Both Teams to Score)
    if (marketsV2.btts) {
      if (marketsV2.btts.yes >= minProb) {
        legs.push({
          market: 'BTTS',
          side: 'YES',
          probability: marketsV2.btts.yes,
          description: `Both Teams to Score`,
          outcome: 'BTTS_YES'
        })
      }
      if (marketsV2.btts.no >= minProb) {
        legs.push({
          market: 'BTTS',
          side: 'NO',
          probability: marketsV2.btts.no,
          description: `Both Teams NOT to Score`,
          outcome: 'BTTS_NO'
        })
      }
    }

    // Double Chance
    if (marketsV2.double_chance) {
      if (marketsV2.double_chance['1X'] >= minProb) {
        legs.push({
          market: 'DOUBLE_CHANCE',
          side: '1X',
          probability: marketsV2.double_chance['1X'],
          description: `${match.homeTeam} or Draw`,
          outcome: 'DC_1X'
        })
      }
      if (marketsV2.double_chance['X2'] >= minProb) {
        legs.push({
          market: 'DOUBLE_CHANCE',
          side: 'X2',
          probability: marketsV2.double_chance['X2'],
          description: `Draw or ${match.awayTeam}`,
          outcome: 'DC_X2'
        })
      }
      if (marketsV2.double_chance['12'] >= minProb) {
        legs.push({
          market: 'DOUBLE_CHANCE',
          side: '12',
          probability: marketsV2.double_chance['12'],
          description: `${match.homeTeam} or ${match.awayTeam} to Win`,
          outcome: 'DC_12'
        })
      }
    }

    // Win to Nil
    if (marketsV2.win_to_nil) {
      if (marketsV2.win_to_nil.home >= minProb) {
        legs.push({
          market: 'WIN_TO_NIL',
          side: 'HOME',
          probability: marketsV2.win_to_nil.home,
          description: `${match.homeTeam} Win to Nil`,
          outcome: 'WTN_H'
        })
      }
      if (marketsV2.win_to_nil.away >= minProb) {
        legs.push({
          market: 'WIN_TO_NIL',
          side: 'AWAY',
          probability: marketsV2.win_to_nil.away,
          description: `${match.awayTeam} Win to Nil`,
          outcome: 'WTN_A'
        })
      }
    }

    // Clean Sheet
    if (marketsV2.clean_sheet) {
      if (marketsV2.clean_sheet.home >= minProb) {
        legs.push({
          market: 'CLEAN_SHEET',
          side: 'HOME',
          probability: marketsV2.clean_sheet.home,
          description: `${match.homeTeam} Clean Sheet`,
          outcome: 'CS_H'
        })
      }
      if (marketsV2.clean_sheet.away >= minProb) {
        legs.push({
          market: 'CLEAN_SHEET',
          side: 'AWAY',
          probability: marketsV2.clean_sheet.away,
          description: `${match.awayTeam} Clean Sheet`,
          outcome: 'CS_A'
        })
      }
    }

    // Team Totals (Home)
    if (marketsV2.team_totals?.home) {
      const teamTotalLines = ['0_5', '1_5', '2_5']
      for (const line of teamTotalLines) {
        const total = marketsV2.team_totals.home[line]
        if (total) {
          if (total.over >= minProb) {
            legs.push({
              market: 'TEAM_TOTALS',
              side: 'HOME_OVER',
              probability: total.over,
              description: `${match.homeTeam} Over ${line.replace('_', '.')} Goals`,
              outcome: `TT_H_OVER_${line}`
            })
          }
          if (total.under >= minProb) {
            legs.push({
              market: 'TEAM_TOTALS',
              side: 'HOME_UNDER',
              probability: total.under,
              description: `${match.homeTeam} Under ${line.replace('_', '.')} Goals`,
              outcome: `TT_H_UNDER_${line}`
            })
          }
        }
      }
    }

    // Team Totals (Away)
    if (marketsV2.team_totals?.away) {
      const teamTotalLines = ['0_5', '1_5', '2_5']
      for (const line of teamTotalLines) {
        const total = marketsV2.team_totals.away[line]
        if (total) {
          if (total.over >= minProb) {
            legs.push({
              market: 'TEAM_TOTALS',
              side: 'AWAY_OVER',
              probability: total.over,
              description: `${match.awayTeam} Over ${line.replace('_', '.')} Goals`,
              outcome: `TT_A_OVER_${line}`
            })
          }
          if (total.under >= minProb) {
            legs.push({
              market: 'TEAM_TOTALS',
              side: 'AWAY_UNDER',
              probability: total.under,
              description: `${match.awayTeam} Under ${line.replace('_', '.')} Goals`,
              outcome: `TT_A_UNDER_${line}`
            })
          }
        }
      }
    }

    // Odd/Even Total Goals
    if (marketsV2.odd_even_total) {
      if (marketsV2.odd_even_total.odd >= minProb) {
        legs.push({
          market: 'ODD_EVEN',
          side: 'ODD',
          probability: marketsV2.odd_even_total.odd,
          description: `Odd Total Goals`,
          outcome: 'ODD'
        })
      }
      if (marketsV2.odd_even_total.even >= minProb) {
        legs.push({
          market: 'ODD_EVEN',
          side: 'EVEN',
          probability: marketsV2.odd_even_total.even,
          description: `Even Total Goals`,
          outcome: 'EVEN'
        })
      }
    }

    // Generate combinations with deduplication
    if (legs.length >= 2) {
      const safeLegs = legs.filter(l => l.probability >= minProb)
      const seenCombinations = new Set<string>() // Track seen combinations to avoid duplicates
      
      if (safeLegs.length >= 2) {
        // 2-leg combinations
        for (let i = 0; i < safeLegs.length - 1; i++) {
          for (let j = i + 1; j < safeLegs.length; j++) {
            const leg1 = safeLegs[i]
            const leg2 = safeLegs[j]

            // Skip contradictory combinations
            if (leg1.market === leg2.market && leg1.side !== leg2.side) continue
            // Skip if both are same market type with conflicting outcomes
            if (leg1.outcome === leg2.outcome) continue

            // Create unique key for deduplication
            const comboKey = [leg1.outcome, leg2.outcome].sort().join('|')
            if (seenCombinations.has(comboKey)) continue
            seenCombinations.add(comboKey)

            const combinedProb = leg1.probability * leg2.probability
            const fairOdds = 1 / combinedProb

            sgps.push({
              matchId: match.matchId,
              homeTeam: match.homeTeam,
              awayTeam: match.awayTeam,
              league: match.league,
              kickoffDate: match.kickoffDate,
              legs: [leg1, leg2],
              combinedProb,
              fairOdds,
              confidence: combinedProb >= 0.30 ? 'high' : combinedProb >= 0.20 ? 'medium' : 'low'
            })
          }
        }

        // 3-leg combinations (limit to top 10 legs to avoid too many combinations)
        const topLegs = safeLegs.slice(0, 10)
        if (topLegs.length >= 3) {
          for (let i = 0; i < topLegs.length - 2; i++) {
            for (let j = i + 1; j < topLegs.length - 1; j++) {
              for (let k = j + 1; k < topLegs.length; k++) {
                const leg1 = topLegs[i]
                const leg2 = topLegs[j]
                const leg3 = topLegs[k]

                // Skip contradictory combinations
                if (leg1.market === leg2.market && leg1.side !== leg2.side) continue
                if (leg1.market === leg3.market && leg1.side !== leg3.side) continue
                if (leg2.market === leg3.market && leg2.side !== leg3.side) continue
                if (leg1.outcome === leg2.outcome || leg1.outcome === leg3.outcome || leg2.outcome === leg3.outcome) continue

                // Create unique key for deduplication
                const comboKey = [leg1.outcome, leg2.outcome, leg3.outcome].sort().join('|')
                if (seenCombinations.has(comboKey)) continue
                seenCombinations.add(comboKey)

                const combinedProb3 = leg1.probability * leg2.probability * leg3.probability
                const fairOdds3 = 1 / combinedProb3

                sgps.push({
                  matchId: match.matchId,
                  homeTeam: match.homeTeam,
                  awayTeam: match.awayTeam,
                  league: match.league,
                  kickoffDate: match.kickoffDate,
                  legs: [leg1, leg2, leg3],
                  combinedProb: combinedProb3,
                  fairOdds: fairOdds3,
                  confidence: combinedProb3 >= 0.20 ? 'medium' : 'low'
                })
              }
            }
          }
        }
      }
    }
  }

  // Final deduplication by match + outcomes
  const finalSgps: SGP[] = []
  const finalSeen = new Set<string>()
  
  for (const sgp of sgps) {
    const outcomes = sgp.legs.map(l => l.outcome).sort().join('|')
    const key = `${sgp.matchId}:${outcomes}`
    if (!finalSeen.has(key)) {
      finalSeen.add(key)
      finalSgps.push(sgp)
    }
  }

  return finalSgps.sort((a, b) => b.combinedProb - a.combinedProb)
}

/**
 * POST /api/admin/parlays/generate - Generate parlays from predictionData
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('Generating parlays from predictionData', {
      tags: ['api', 'admin', 'parlays', 'generate']
    })

    const sgps = await generateSGPs()

    logger.info(`Generated ${sgps.length} potential SGPs`, {
      tags: ['api', 'admin', 'parlays', 'generate'],
      data: { count: sgps.length }
    })

    return NextResponse.json({
      success: true,
      count: sgps.length,
      parlays: sgps
    })
  } catch (error) {
    logger.error('Error generating parlays', {
      tags: ['api', 'admin', 'parlays', 'generate'],
      data: { error: error instanceof Error ? error.message : 'Unknown error' }
    })
    return NextResponse.json(
      { error: 'Failed to generate parlays', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

