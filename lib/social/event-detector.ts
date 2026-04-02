/**
 * Event Detector — detects score changes and card events during live sync
 * and creates MatchEvent records for social media posting.
 */

import prisma from '@/lib/db'
import crypto from 'crypto'

/**
 * Detect score changes between old and new match data.
 * Creates MatchEvent records for goals.
 */
export async function detectScoreChange(
  oldScore: { home: number; away: number } | null,
  newScore: { home: number; away: number } | null,
  matchId: string,
  marketMatchId: string,
  minute?: number,
  homeTeam?: string,
  awayTeam?: string
): Promise<void> {
  if (!newScore || !oldScore) return

  const min = minute || 0

  // Home goal
  if (newScore.home > oldScore.home) {
    const hash = `${matchId}-goal-${min}-home-${newScore.home}-${newScore.away}`
    const eventHash = crypto.createHash('md5').update(hash).digest('hex')

    try {
      await prisma.matchEvent.upsert({
        where: { eventHash },
        update: {},
        create: {
          matchId,
          marketMatchId,
          eventType: 'goal',
          minute: min,
          team: 'home',
          description: `${homeTeam || 'Home'} scores! ${newScore.home}-${newScore.away}`,
          scoreHome: newScore.home,
          scoreAway: newScore.away,
          eventHash,
        },
      })
    } catch { /* duplicate — already exists */ }
  }

  // Away goal
  if (newScore.away > oldScore.away) {
    const hash = `${matchId}-goal-${min}-away-${newScore.home}-${newScore.away}`
    const eventHash = crypto.createHash('md5').update(hash).digest('hex')

    try {
      await prisma.matchEvent.upsert({
        where: { eventHash },
        update: {},
        create: {
          matchId,
          marketMatchId,
          eventType: 'goal',
          minute: min,
          team: 'away',
          description: `${awayTeam || 'Away'} scores! ${newScore.home}-${newScore.away}`,
          scoreHome: newScore.home,
          scoreAway: newScore.away,
          eventHash,
        },
      })
    } catch { /* duplicate */ }
  }
}

/**
 * Detect red card changes between old and new live statistics.
 */
export async function detectRedCard(
  oldStats: any,
  newStats: any,
  matchId: string,
  marketMatchId: string,
  minute?: number
): Promise<void> {
  if (!newStats || !oldStats) return

  const oldRed = {
    home: oldStats?.red_cards?.home || oldStats?.cards?.red?.home || 0,
    away: oldStats?.red_cards?.away || oldStats?.cards?.red?.away || 0,
  }
  const newRed = {
    home: newStats?.red_cards?.home || newStats?.cards?.red?.home || 0,
    away: newStats?.red_cards?.away || newStats?.cards?.red?.away || 0,
  }

  const min = minute || 0

  if (newRed.home > oldRed.home) {
    const hash = `${matchId}-red_card-${min}-home-${newRed.home}`
    const eventHash = crypto.createHash('md5').update(hash).digest('hex')
    try {
      await prisma.matchEvent.upsert({
        where: { eventHash },
        update: {},
        create: {
          matchId, marketMatchId, eventType: 'red_card', minute: min,
          team: 'home', description: 'Red card for home team',
          eventHash,
        },
      })
    } catch { /* duplicate */ }
  }

  if (newRed.away > oldRed.away) {
    const hash = `${matchId}-red_card-${min}-away-${newRed.away}`
    const eventHash = crypto.createHash('md5').update(hash).digest('hex')
    try {
      await prisma.matchEvent.upsert({
        where: { eventHash },
        update: {},
        create: {
          matchId, marketMatchId, eventType: 'red_card', minute: min,
          team: 'away', description: 'Red card for away team',
          eventHash,
        },
      })
    } catch { /* duplicate */ }
  }
}
