/**
 * Read-only diagnostic: parlay performance vs. hypothetical premium-only
 * parlays. Compares:
 *   - Current ParlayConsensus inventory (what we offer)
 *   - Actual leg-by-leg outcomes from MarketMatch.finalResult (settlement
 *     is not yet implemented in production, so we reconstruct it here)
 *   - Premium-tier pick performance (PremiumPickHistory, already settled)
 *   - Hypothetical premium-only parlays: combine 2 / 3 / 4 premium picks
 *     per day and compute the flat-stake P/L
 *
 * Read-only. No writes. Just numbers.
 */
import prisma from '../lib/db'

;(async () => {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400 * 1000)
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400 * 1000)
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400 * 1000)

  console.log('\n══════════════════════════════════════════════════════════')
  console.log(' Parlay vs Premium-Only Analysis')
  console.log('══════════════════════════════════════════════════════════\n')

  // ─── PART A: Current parlay inventory ─────────────────────────────
  console.log('PART A · CURRENT PARLAY INVENTORY')

  const totalParlays = await prisma.parlayConsensus.count()
  const activeParlays = await prisma.parlayConsensus.count({ where: { status: 'active' } })
  const recentParlays = await prisma.parlayConsensus.count({
    where: { createdAt: { gte: thirtyDaysAgo } },
  })

  const byTier = await prisma.parlayConsensus.groupBy({
    by: ['confidenceTier'],
    _count: { _all: true },
    where: { createdAt: { gte: thirtyDaysAgo } },
  })

  const byLegCount = await prisma.parlayConsensus.groupBy({
    by: ['legCount'],
    _count: { _all: true },
    where: { createdAt: { gte: thirtyDaysAgo } },
  })

  console.log(`  Total ParlayConsensus rows: ${totalParlays}`)
  console.log(`  Active right now:           ${activeParlays}`)
  console.log(`  Created last 30d:           ${recentParlays}`)
  console.log(`  By tier (30d):`)
  for (const t of byTier) console.log(`    ${(t.confidenceTier ?? 'null').padEnd(8)}  ${t._count._all}`)
  console.log(`  By leg count (30d):`)
  for (const lc of byLegCount.sort((a, b) => a.legCount - b.legCount)) {
    console.log(`    ${lc.legCount} legs  ${lc._count._all}`)
  }

  // ─── PART B: Settle existing parlays via finalResult reconstruction ──
  console.log('\nPART B · RECONSTRUCTED PARLAY PERFORMANCE (last 60d)')
  console.log('  Settlement is not yet wired in prod; we reconstruct from')
  console.log('  MarketMatch.finalResult for parlays whose ALL legs settled.\n')

  // Pull legs for parlays whose kickoffWindow has passed
  const candidateParlays = await prisma.parlayConsensus.findMany({
    where: {
      createdAt: { gte: sixtyDaysAgo },
      legs: { some: {} },
    },
    select: {
      parlayId: true,
      legCount: true,
      adjustedProb: true,
      impliedOdds: true,
      edgePct: true,
      confidenceTier: true,
      parlayType: true,
      premiumTier: true,
      avgLegPremiumScore: true,
      createdAt: true,
      legs: {
        select: {
          matchId: true,
          outcome: true,
          modelProb: true,
          decimalOdds: true,
          legOrder: true,
        },
      },
    },
    take: 5000,
  })

  // Pull match results for ALL leg matchIds in one go
  const matchIds = Array.from(new Set(candidateParlays.flatMap(p => p.legs.map(l => l.matchId))))
  const matches = await prisma.marketMatch.findMany({
    where: { matchId: { in: matchIds }, status: 'FINISHED' },
    select: { matchId: true, finalResult: true },
  })
  const finalByMatchId = new Map(matches.map(m => [m.matchId, m.finalResult as { outcome?: string; score?: { home?: number; away?: number } } | null]))

  // For each parlay, check ALL legs have settled. Score each leg.
  type LegOutcome = 'win' | 'loss' | 'unknown'
  function scoreLeg(legOutcome: string, finalResult: unknown): LegOutcome {
    if (!finalResult) return 'unknown'
    const fr = finalResult as { outcome?: string; score?: { home?: number; away?: number } }
    const actual = fr.outcome?.toUpperCase()
    const score = fr.score
    const lo = legOutcome.toUpperCase()
    // 1X2 markets
    if (lo === 'H' || lo === 'HOME') return actual === 'HOME' || actual === 'H' ? 'win' : actual ? 'loss' : 'unknown'
    if (lo === 'A' || lo === 'AWAY') return actual === 'AWAY' || actual === 'A' ? 'win' : actual ? 'loss' : 'unknown'
    if (lo === 'D' || lo === 'DRAW') return actual === 'DRAW' || actual === 'D' ? 'win' : actual ? 'loss' : 'unknown'
    // BTTS
    if (lo === 'BTTS_YES' || lo === 'YES') {
      if (!score || typeof score.home !== 'number') return 'unknown'
      return score.home > 0 && score.away! > 0 ? 'win' : 'loss'
    }
    if (lo === 'BTTS_NO' || lo === 'NO') {
      if (!score || typeof score.home !== 'number') return 'unknown'
      return score.home === 0 || score.away === 0 ? 'win' : 'loss'
    }
    // Over/Under — outcome usually has format like 'OVER_2.5'
    const overMatch = lo.match(/^OVER[_\s]?(\d+(?:\.\d+)?)$/)
    if (overMatch && score) {
      const line = parseFloat(overMatch[1])
      const total = (score.home ?? 0) + (score.away ?? 0)
      return total > line ? 'win' : 'loss'
    }
    const underMatch = lo.match(/^UNDER[_\s]?(\d+(?:\.\d+)?)$/)
    if (underMatch && score) {
      const line = parseFloat(underMatch[1])
      const total = (score.home ?? 0) + (score.away ?? 0)
      return total < line ? 'win' : 'loss'
    }
    // Double chance — '1X', '12', 'X2'
    if (lo === '1X') return (actual === 'HOME' || actual === 'DRAW') ? 'win' : actual ? 'loss' : 'unknown'
    if (lo === '12') return (actual === 'HOME' || actual === 'AWAY') ? 'win' : actual ? 'loss' : 'unknown'
    if (lo === 'X2') return (actual === 'AWAY' || actual === 'DRAW') ? 'win' : actual ? 'loss' : 'unknown'
    return 'unknown'
  }

  type ParlayResult = {
    parlayId: string
    legCount: number
    impliedOdds: number
    confidenceTier: string | null
    parlayType: string | null
    premiumTier: string | null
    avgLegPremiumScore: number | null
    legsWon: number
    legsLost: number
    legsUnknown: number
    parlayResult: 'win' | 'loss' | 'incomplete'
    netDollars: number  // at flat $10 stake
  }
  const STAKE = 10

  const settled: ParlayResult[] = []
  for (const p of candidateParlays) {
    let won = 0, lost = 0, unknown = 0
    for (const leg of p.legs) {
      const r = scoreLeg(leg.outcome, finalByMatchId.get(leg.matchId))
      if (r === 'win') won++
      else if (r === 'loss') lost++
      else unknown++
    }
    let result: ParlayResult['parlayResult']
    let net: number
    if (unknown > 0) { result = 'incomplete'; net = 0 }
    else if (lost === 0 && won === p.legCount) {
      result = 'win'
      net = +(STAKE * (Number(p.impliedOdds) - 1)).toFixed(2)
    } else {
      result = 'loss'
      net = -STAKE
    }
    settled.push({
      parlayId: p.parlayId,
      legCount: p.legCount,
      impliedOdds: Number(p.impliedOdds),
      confidenceTier: p.confidenceTier,
      parlayType: p.parlayType,
      premiumTier: p.premiumTier,
      avgLegPremiumScore: p.avgLegPremiumScore ? Number(p.avgLegPremiumScore) : null,
      legsWon: won, legsLost: lost, legsUnknown: unknown,
      parlayResult: result,
      netDollars: net,
    })
  }

  const complete = settled.filter(s => s.parlayResult !== 'incomplete')
  const wins = complete.filter(s => s.parlayResult === 'win')
  const losses = complete.filter(s => s.parlayResult === 'loss')
  const totalStaked = complete.length * STAKE
  const netDollars = complete.reduce((sum, s) => sum + s.netDollars, 0)
  const roi = totalStaked > 0 ? (netDollars / totalStaked) * 100 : 0

  console.log(`  Candidate parlays in window: ${candidateParlays.length}`)
  console.log(`  Fully settled:                ${complete.length}`)
  console.log(`  Incomplete (legs unsettled):  ${settled.length - complete.length}`)
  console.log(`  Wins:                         ${wins.length}`)
  console.log(`  Losses:                       ${losses.length}`)
  if (complete.length > 0) {
    console.log(`  Hit rate:                     ${(wins.length / complete.length * 100).toFixed(1)}%`)
    console.log(`  Total staked @ $${STAKE} flat:        $${totalStaked.toLocaleString()}`)
    console.log(`  Net P/L:                      ${netDollars >= 0 ? '+' : ''}$${netDollars.toFixed(2)}`)
    console.log(`  ROI:                          ${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%`)
  }

  // Break down by leg count
  console.log(`\n  Performance by leg count (settled only):`)
  for (const lc of [2, 3, 4, 5]) {
    const subset = complete.filter(s => s.legCount === lc)
    if (subset.length === 0) continue
    const subWins = subset.filter(s => s.parlayResult === 'win').length
    const subNet = subset.reduce((sum, s) => sum + s.netDollars, 0)
    const subRoi = (subNet / (subset.length * STAKE)) * 100
    console.log(`    ${lc} legs:  ${subset.length.toString().padStart(4)} parlays · ${subWins}W-${subset.length - subWins}L · hit ${(subWins / subset.length * 100).toFixed(1)}% · ROI ${subRoi >= 0 ? '+' : ''}${subRoi.toFixed(2)}%`)
  }

  // Break down by confidence tier
  console.log(`\n  Performance by confidence tier (settled only):`)
  for (const tier of ['high', 'medium', 'low'] as const) {
    const subset = complete.filter(s => s.confidenceTier === tier)
    if (subset.length === 0) continue
    const subWins = subset.filter(s => s.parlayResult === 'win').length
    const subNet = subset.reduce((sum, s) => sum + s.netDollars, 0)
    const subRoi = (subNet / (subset.length * STAKE)) * 100
    console.log(`    ${tier.padEnd(6)}:  ${subset.length.toString().padStart(4)} parlays · ${subWins}W-${subset.length - subWins}L · hit ${(subWins / subset.length * 100).toFixed(1)}% · ROI ${subRoi >= 0 ? '+' : ''}${subRoi.toFixed(2)}%`)
  }

  // ─── PART C: Premium-only pick baseline ──────────────────────────
  console.log('\nPART C · PREMIUM-ONLY SINGLE-PICK BASELINE')

  const premiumLast30 = await prisma.premiumPickHistory.findMany({
    where: {
      tier: 'premium',
      publishedAt: { gte: thirtyDaysAgo },
    },
    select: {
      result: true, netDollars: true, oddsAtPublish: true,
      stakeDollars: true, publishedAt: true, kickoffDate: true,
    },
  })
  const premiumLast90 = await prisma.premiumPickHistory.findMany({
    where: {
      tier: 'premium',
      publishedAt: { gte: ninetyDaysAgo },
    },
    select: { result: true, netDollars: true, oddsAtPublish: true, stakeDollars: true, publishedAt: true, kickoffDate: true },
  })

  for (const [label, rows] of [['30d', premiumLast30], ['90d', premiumLast90]] as const) {
    const settled = rows.filter(r => r.result === 'win' || r.result === 'loss')
    const wins = settled.filter(r => r.result === 'win').length
    const losses = settled.filter(r => r.result === 'loss').length
    const net = settled.reduce((sum, r) => sum + (Number(r.netDollars) || 0), 0)
    const staked = settled.length * 100
    const roi = staked > 0 ? (net / staked) * 100 : 0
    const avgOdds = settled.length > 0
      ? settled.reduce((sum, r) => sum + Number(r.oddsAtPublish), 0) / settled.length
      : 0
    console.log(`  Last ${label}: ${settled.length} picks · ${wins}W-${losses}L · hit ${settled.length > 0 ? (wins / settled.length * 100).toFixed(1) : 0}% · avg odds ${avgOdds.toFixed(2)} · net ${net >= 0 ? '+' : ''}$${net.toFixed(2)} · ROI ${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%`)
  }

  // ─── PART D: Hypothetical premium-only parlays ────────────────────
  console.log('\nPART D · HYPOTHETICAL PREMIUM-ONLY PARLAYS')
  console.log('  Group premium picks by kickoff date; for each day with ≥N premium')
  console.log('  picks, build a same-day parlay using all of them.\n')

  const allPremium = await prisma.premiumPickHistory.findMany({
    where: { tier: 'premium', publishedAt: { gte: ninetyDaysAgo } },
    select: {
      result: true, oddsAtPublish: true, kickoffDate: true, publishedAt: true,
    },
  })

  // Group by kickoff date (UTC day)
  const byDay = new Map<string, typeof allPremium>()
  for (const p of allPremium) {
    if (p.result !== 'win' && p.result !== 'loss') continue
    const day = p.kickoffDate.toISOString().slice(0, 10)
    const arr = byDay.get(day) || []
    arr.push(p)
    byDay.set(day, arr)
  }

  // For each day with ≥N premium picks, simulate a parlay
  for (const minLegs of [2, 3, 4]) {
    const days = [...byDay.entries()].filter(([, picks]) => picks.length >= minLegs)
    let wins = 0
    let totalNet = 0
    const parlaysCount = days.length
    for (const [, picks] of days) {
      const legs = picks.slice(0, minLegs)
      const allWin = legs.every(l => l.result === 'win')
      const combinedOdds = legs.reduce((prod, l) => prod * Number(l.oddsAtPublish), 1)
      if (allWin) {
        wins++
        totalNet += STAKE * (combinedOdds - 1)
      } else {
        totalNet -= STAKE
      }
    }
    const staked = parlaysCount * STAKE
    const roi = staked > 0 ? (totalNet / staked) * 100 : 0
    console.log(`  ${minLegs}-leg same-day parlays of premium picks:`)
    console.log(`    Days qualifying: ${parlaysCount} · Wins: ${wins} (${parlaysCount > 0 ? (wins / parlaysCount * 100).toFixed(1) : 0}%)`)
    console.log(`    Total staked: $${staked} · Net: ${totalNet >= 0 ? '+' : ''}$${totalNet.toFixed(2)} · ROI ${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%`)
  }

  // ─── PART E: Multi-day parlay options ────────────────────────────
  console.log('\nPART E · MULTI-DAY ROLLING PARLAYS (every N consecutive premium picks)')
  const sortedPremium = allPremium
    .filter(p => p.result === 'win' || p.result === 'loss')
    .sort((a, b) => a.kickoffDate.getTime() - b.kickoffDate.getTime())

  for (const legCount of [2, 3, 4]) {
    let wins = 0
    let totalNet = 0
    let count = 0
    for (let i = 0; i + legCount <= sortedPremium.length; i++) {
      const legs = sortedPremium.slice(i, i + legCount)
      const allWin = legs.every(l => l.result === 'win')
      const combinedOdds = legs.reduce((prod, l) => prod * Number(l.oddsAtPublish), 1)
      if (allWin) {
        wins++
        totalNet += STAKE * (combinedOdds - 1)
      } else {
        totalNet -= STAKE
      }
      count++
    }
    const staked = count * STAKE
    const roi = staked > 0 ? (totalNet / staked) * 100 : 0
    console.log(`  ${legCount}-leg sliding parlays (n=${count}): ${wins}W (${count > 0 ? (wins / count * 100).toFixed(1) : 0}% hit) · net ${totalNet >= 0 ? '+' : ''}$${totalNet.toFixed(2)} · ROI ${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%`)
  }

  console.log('\n══════════════════════════════════════════════════════════\n')
  await prisma.$disconnect()
})()
