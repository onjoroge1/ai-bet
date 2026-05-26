/**
 * Audit data availability for Same-Game-Parlay (SGP) construction
 * on top of premium picks. Read-only.
 */
import prisma from '../lib/db'

;(async () => {
  console.log('\n══════════════════════════════════════════════════════════')
  console.log(' SGP Data Audit')
  console.log('══════════════════════════════════════════════════════════\n')

  const premium = await prisma.premiumPickHistory.findMany({
    where: { tier: 'premium', result: { in: ['win', 'loss'] } },
    select: {
      id: true, marketMatchId: true, externalMatchId: true,
      homeTeam: true, awayTeam: true, pick: true, oddsAtPublish: true,
      kickoffDate: true, result: true,
    },
    orderBy: { kickoffDate: 'desc' },
  })
  console.log(`Settled premium picks: ${premium.length}`)

  // AdditionalMarketData uses external matchId (string), not internal cuid
  const externalMatchIds = premium.map(p => p.externalMatchId)

  const adm = await prisma.additionalMarketData.findMany({
    where: { matchId: { in: externalMatchIds } },
    select: {
      id: true, matchId: true, marketType: true, marketSubtype: true,
      line: true,
      consensusProb: true, consensusConfidence: true,
      decimalOdds: true, impliedProb: true,
      v1Pick: true, v1Confidence: true,
      v2Pick: true, v2Confidence: true,
    },
  })
  console.log(`AdditionalMarketData rows: ${adm.length}`)
  const admByMatch = new Map<string, typeof adm>()
  for (const r of adm) {
    const arr = admByMatch.get(r.matchId) || []
    arr.push(r)
    admByMatch.set(r.matchId, arr)
  }
  console.log(`Premium-pick matches with ANY ADM row: ${admByMatch.size} / ${premium.length}`)

  const byMarketType = await prisma.additionalMarketData.groupBy({
    by: ['marketType'],
    _count: { _all: true },
    where: { matchId: { in: externalMatchIds } },
  })
  console.log('\nMarket types available on premium-pick matches:')
  for (const r of byMarketType.sort((a, b) => b._count._all - a._count._all)) {
    console.log(`  ${r.marketType.padEnd(20)} ${r._count._all}`)
  }

  // Per-pick: enumerate available secondary markets for first 5 picks
  console.log('\nPer-pick secondary market availability (first 5 settled picks):')
  for (const p of premium.slice(0, 5)) {
    const markets = admByMatch.get(p.externalMatchId) || []
    console.log(`\n  ${p.homeTeam} vs ${p.awayTeam} [${p.result.toUpperCase()}] (pick: ${p.pick})`)
    console.log(`    Secondary markets: ${markets.length}`)
    for (const m of markets.slice(0, 8)) {
      const line = m.line ? ` line=${m.line}` : ''
      const sub = m.marketSubtype ? ` (${m.marketSubtype})` : ''
      const odds = m.decimalOdds ? ` odds=${Number(m.decimalOdds).toFixed(2)}` : ''
      const v1 = m.v1Pick ? ` v1=${m.v1Pick}` : ''
      console.log(`      ${m.marketType}${sub}${line}${odds} consensus=${Number(m.consensusProb).toFixed(3)}${v1}`)
    }
  }

  // Score availability — can we derive secondary outcomes?
  console.log('\n\nFinalResult.score coverage (need for BTTS / O/U reconstruction):')
  let withScore = 0
  let withoutScore = 0
  const finishedMatches = await prisma.marketMatch.findMany({
    where: { id: { in: premium.map(p => p.marketMatchId) }, status: 'FINISHED' },
    select: { matchId: true, finalResult: true },
  })
  for (const m of finishedMatches) {
    const fr = m.finalResult as { score?: { home?: number; away?: number } } | null
    if (fr?.score && typeof fr.score.home === 'number' && typeof fr.score.away === 'number') withScore++
    else withoutScore++
  }
  console.log(`  With score: ${withScore} / ${finishedMatches.length}`)
  console.log(`  Without score: ${withoutScore}`)

  // For matches that have BOTH (ADM + score), we can do the backtest
  const matchesWithBoth = finishedMatches.filter(m => {
    const fr = m.finalResult as { score?: { home?: number; away?: number } } | null
    return admByMatch.has(m.matchId) && fr?.score && typeof fr.score.home === 'number'
  })
  console.log(`\nMatches with BOTH ADM + score (can backtest SGP): ${matchesWithBoth.length} / ${premium.length}`)

  console.log('\n══════════════════════════════════════════════════════════\n')
  await prisma.$disconnect()
})()
