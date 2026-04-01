/**
 * Arbitrage & Edge Detection Engine
 *
 * Scans MarketMatch records with bookmaker odds to find:
 * 1. Arbitrage opportunities (guaranteed profit across books)
 * 2. Positive EV bets (model probability > implied probability)
 * 3. Best line shopping (best odds per outcome per match)
 *
 * Arbitrage formula:
 *   arbPct = (1/bestHome + 1/bestDraw + 1/bestAway) * 100
 *   If arbPct < 100 → guaranteed profit
 *   profitPct = (100/arbPct - 1) * 100
 */

import prisma from '@/lib/db'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BestOdds {
  outcome: 'home' | 'draw' | 'away'
  odds: number
  book: string
  impliedProb: number
}

export interface ArbitrageOpportunity {
  matchId: string
  homeTeam: string
  awayTeam: string
  league: string
  kickoff: string
  arbPercent: number      // < 100 means arb exists
  profitPercent: number   // guaranteed profit %
  bets: {
    outcome: string
    book: string
    odds: number
    stakePercent: number  // % of total stake
    stakeAmount: number   // for $100 total stake
  }[]
  totalStake: number
  guaranteedReturn: number
  slug: string
}

export interface PositiveEVBet {
  matchId: string
  homeTeam: string
  awayTeam: string
  league: string
  kickoff: string
  outcome: string          // "Home", "Draw", "Away"
  outcomeTeam: string      // Actual team name
  modelProb: number        // Model's probability (0-1)
  impliedProb: number      // Market implied probability (0-1)
  edgePercent: number      // modelProb - impliedProb (as %)
  bestOdds: number
  bestBook: string
  fairOdds: number         // 1/modelProb
  kellyStake: number       // Kelly criterion % of bankroll
  confidence: number       // Model confidence (0-100)
  slug: string
}

export interface LineShopResult {
  matchId: string
  homeTeam: string
  awayTeam: string
  league: string
  kickoff: string
  bookmakers: {
    name: string
    home: number
    draw: number
    away: number
    overround: number
  }[]
  bestOdds: {
    home: BestOdds
    draw: BestOdds
    away: BestOdds
  }
  marketOverround: number  // Average overround
  slug: string
}

// ─── Arbitrage Detection ────────────────────────────────────────────────────

export async function findArbitrageOpportunities(limit: number = 50): Promise<ArbitrageOpportunity[]> {
  const opportunities: ArbitrageOpportunity[] = []

  try {
    const matches = await prisma.marketMatch.findMany({
      where: {
        status: 'UPCOMING',
        kickoffDate: { gte: new Date() },
        allBookmakers: { not: undefined },
        booksCount: { gte: 5 },
      },
      orderBy: { kickoffDate: 'asc' },
      take: 200,
    })

    for (const match of matches) {
      const books = match.allBookmakers as Record<string, { home?: number; draw?: number; away?: number }> | null
      if (!books || Object.keys(books).length < 3) continue

      const best = findBestOddsFromBooks(books)
      if (!best.home.odds || !best.draw.odds || !best.away.odds) continue

      const arbPct = (1 / best.home.odds + 1 / best.draw.odds + 1 / best.away.odds) * 100

      // Only include if close to arb (< 102%) or actual arb (< 100%)
      if (arbPct > 102) continue

      const profitPct = arbPct < 100 ? ((100 / arbPct) - 1) * 100 : 0
      const totalStake = 100

      // Calculate optimal stakes
      const homeStake = (totalStake / best.home.odds) / (1 / best.home.odds + 1 / best.draw.odds + 1 / best.away.odds)
      const drawStake = (totalStake / best.draw.odds) / (1 / best.home.odds + 1 / best.draw.odds + 1 / best.away.odds)
      const awayStake = (totalStake / best.away.odds) / (1 / best.home.odds + 1 / best.draw.odds + 1 / best.away.odds)

      const guaranteedReturn = homeStake * best.home.odds // All outcomes return same

      const slug = `/match/${match.homeTeam.toLowerCase().replace(/\s+/g, '-')}-vs-${match.awayTeam.toLowerCase().replace(/\s+/g, '-')}-${match.matchId}`

      opportunities.push({
        matchId: match.matchId,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        league: match.league,
        kickoff: match.kickoffDate.toISOString(),
        arbPercent: Math.round(arbPct * 100) / 100,
        profitPercent: Math.round(profitPct * 100) / 100,
        bets: [
          { outcome: 'Home', book: best.home.book, odds: best.home.odds, stakePercent: Math.round(homeStake), stakeAmount: Math.round(homeStake * 100) / 100 },
          { outcome: 'Draw', book: best.draw.book, odds: best.draw.odds, stakePercent: Math.round(drawStake), stakeAmount: Math.round(drawStake * 100) / 100 },
          { outcome: 'Away', book: best.away.book, odds: best.away.odds, stakePercent: Math.round(awayStake), stakeAmount: Math.round(awayStake * 100) / 100 },
        ],
        totalStake,
        guaranteedReturn: Math.round(guaranteedReturn * 100) / 100,
        slug,
      })
    }

    // Sort by arbPercent (lowest = best arb)
    opportunities.sort((a, b) => a.arbPercent - b.arbPercent)
  } catch (error) {
    console.error('[Arbitrage Engine] Error:', error)
  }

  return opportunities.slice(0, limit)
}

// ─── Positive EV Detection ──────────────────────────────────────────────────

export async function findPositiveEVBets(limit: number = 30): Promise<PositiveEVBet[]> {
  const evBets: PositiveEVBet[] = []

  try {
    const matches = await prisma.marketMatch.findMany({
      where: {
        status: 'UPCOMING',
        kickoffDate: { gte: new Date() },
        allBookmakers: { not: undefined },
        v1Model: { not: undefined },
      },
      orderBy: { kickoffDate: 'asc' },
      take: 200,
    })

    for (const match of matches) {
      const books = match.allBookmakers as Record<string, { home?: number; draw?: number; away?: number }> | null
      const v1 = match.v1Model as any
      const consensus = match.consensusOdds as any

      if (!books || !v1?.probs) continue

      const best = findBestOddsFromBooks(books)
      const probs = v1.probs as { home?: number; draw?: number; away?: number }

      const slug = `/match/${match.homeTeam.toLowerCase().replace(/\s+/g, '-')}-vs-${match.awayTeam.toLowerCase().replace(/\s+/g, '-')}-${match.matchId}`

      // Check each outcome for +EV
      const outcomes: Array<{ key: 'home' | 'draw' | 'away'; label: string; team: string }> = [
        { key: 'home', label: 'Home', team: match.homeTeam },
        { key: 'draw', label: 'Draw', team: 'Draw' },
        { key: 'away', label: 'Away', team: match.awayTeam },
      ]

      for (const { key, label, team } of outcomes) {
        const modelProb = probs[key] || 0
        const bestOddsVal = best[key].odds
        if (!bestOddsVal || bestOddsVal <= 1 || modelProb <= 0) continue

        const impliedProb = 1 / bestOddsVal
        const edge = modelProb - impliedProb

        // Only include if model sees positive edge
        if (edge <= 0.02) continue // At least 2% edge

        const fairOdds = 1 / modelProb
        // Kelly criterion: (bp - q) / b where b = odds-1, p = prob, q = 1-prob
        const b = bestOddsVal - 1
        const kelly = Math.max(0, (b * modelProb - (1 - modelProb)) / b)

        evBets.push({
          matchId: match.matchId,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          league: match.league,
          kickoff: match.kickoffDate.toISOString(),
          outcome: label,
          outcomeTeam: team,
          modelProb,
          impliedProb,
          edgePercent: Math.round(edge * 1000) / 10,
          bestOdds: bestOddsVal,
          bestBook: best[key].book,
          fairOdds: Math.round(fairOdds * 100) / 100,
          kellyStake: Math.round(kelly * 1000) / 10, // As % of bankroll
          confidence: Math.round((v1.confidence || 0) * 100),
          slug,
        })
      }
    }

    // Sort by edge (highest first)
    evBets.sort((a, b) => b.edgePercent - a.edgePercent)
  } catch (error) {
    console.error('[EV Engine] Error:', error)
  }

  return evBets.slice(0, limit)
}

// ─── Line Shopping ──────────────────────────────────────────────────────────

export async function getLineShop(matchId?: string, limit: number = 20): Promise<LineShopResult[]> {
  const results: LineShopResult[] = []

  try {
    const where: any = {
      status: 'UPCOMING',
      kickoffDate: { gte: new Date() },
      allBookmakers: { not: undefined },
      booksCount: { gte: 3 },
    }
    if (matchId) where.matchId = matchId

    const matches = await prisma.marketMatch.findMany({
      where,
      orderBy: { kickoffDate: 'asc' },
      take: matchId ? 1 : limit,
    })

    for (const match of matches) {
      const books = match.allBookmakers as Record<string, { home?: number; draw?: number; away?: number }> | null
      if (!books) continue

      const bookmakers: LineShopResult['bookmakers'] = []
      let totalOverround = 0

      for (const [name, odds] of Object.entries(books)) {
        const h = odds.home || 0
        const d = odds.draw || 0
        const a = odds.away || 0
        if (!h || !d || !a) continue

        const overround = ((1 / h + 1 / d + 1 / a) - 1) * 100

        // Clean up book name (remove "theodds:" prefix)
        const cleanName = name.replace(/^theodds:/, '').replace(/_/g, ' ')

        bookmakers.push({
          name: cleanName,
          home: h,
          draw: d,
          away: a,
          overround: Math.round(overround * 10) / 10,
        })
        totalOverround += overround
      }

      // Sort by overround (lowest = sharpest book)
      bookmakers.sort((a, b) => a.overround - b.overround)

      const best = findBestOddsFromBooks(books)
      const slug = `/match/${match.homeTeam.toLowerCase().replace(/\s+/g, '-')}-vs-${match.awayTeam.toLowerCase().replace(/\s+/g, '-')}-${match.matchId}`

      results.push({
        matchId: match.matchId,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        league: match.league,
        kickoff: match.kickoffDate.toISOString(),
        bookmakers,
        bestOdds: {
          home: best.home,
          draw: best.draw,
          away: best.away,
        },
        marketOverround: bookmakers.length > 0 ? Math.round(totalOverround / bookmakers.length * 10) / 10 : 0,
        slug,
      })
    }
  } catch (error) {
    console.error('[Line Shop] Error:', error)
  }

  return results
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function findBestOddsFromBooks(
  books: Record<string, { home?: number; draw?: number; away?: number }>
): { home: BestOdds; draw: BestOdds; away: BestOdds } {
  const best = {
    home: { outcome: 'home' as const, odds: 0, book: '', impliedProb: 1 },
    draw: { outcome: 'draw' as const, odds: 0, book: '', impliedProb: 1 },
    away: { outcome: 'away' as const, odds: 0, book: '', impliedProb: 1 },
  }

  for (const [bookName, odds] of Object.entries(books)) {
    const cleanName = bookName.replace(/^theodds:/, '').replace(/_/g, ' ')

    if (odds.home && odds.home > best.home.odds) {
      best.home = { outcome: 'home', odds: odds.home, book: cleanName, impliedProb: 1 / odds.home }
    }
    if (odds.draw && odds.draw > best.draw.odds) {
      best.draw = { outcome: 'draw', odds: odds.draw, book: cleanName, impliedProb: 1 / odds.draw }
    }
    if (odds.away && odds.away > best.away.odds) {
      best.away = { outcome: 'away', odds: odds.away, book: cleanName, impliedProb: 1 / odds.away }
    }
  }

  return best
}

/**
 * Quick stats for the Edge Finder dashboard header
 */
export async function getEdgeStats() {
  const [arbs, evBets] = await Promise.all([
    findArbitrageOpportunities(50),
    findPositiveEVBets(50),
  ])

  const trueArbs = arbs.filter(a => a.arbPercent < 100)
  const nearArbs = arbs.filter(a => a.arbPercent >= 100 && a.arbPercent < 101)
  const highEV = evBets.filter(e => e.edgePercent >= 5)

  return {
    totalArbs: trueArbs.length,
    nearArbs: nearArbs.length,
    totalEVBets: evBets.length,
    highEVBets: highEV.length,
    avgEdge: evBets.length > 0 ? Math.round(evBets.reduce((s, e) => s + e.edgePercent, 0) / evBets.length * 10) / 10 : 0,
    bestArb: trueArbs.length > 0 ? trueArbs[0].profitPercent : 0,
    bestEdge: evBets.length > 0 ? evBets[0].edgePercent : 0,
  }
}
