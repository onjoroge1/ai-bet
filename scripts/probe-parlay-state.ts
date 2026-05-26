/**
 * Read-only diagnostic: why does /api/parlays/preview return 0 rows?
 */
import prisma from '../lib/db'

;(async () => {
  const now = new Date()

  const totals = await prisma.premiumParlay.groupBy({
    by: ['archetype', 'surfacedBy', 'result'],
    _count: { _all: true },
  })
  console.log('PremiumParlay inventory (all):')
  for (const t of totals) {
    console.log(`  ${t.archetype.padEnd(20)} ${t.surfacedBy.padEnd(10)} ${t.result.padEnd(10)} ${t._count._all}`)
  }

  const liveActive = await prisma.premiumParlay.count({
    where: {
      surfacedBy: 'live',
      result: 'pending',
      latestKickoff: { gte: now },
    },
  })
  console.log(`\nLive+pending+upcoming parlays: ${liveActive}`)

  // Pending premium picks the live capture cron should be turning into parlays
  const pendingPicks = await prisma.premiumPickHistory.findMany({
    where: {
      tier: 'premium',
      result: 'pending',
      kickoffDate: { gte: now },
    },
    select: { id: true, homeTeam: true, awayTeam: true, kickoffDate: true, league: true, oddsAtPublish: true },
    orderBy: { kickoffDate: 'asc' },
  })
  console.log(`\nPending premium picks (future kickoff): ${pendingPicks.length}`)
  for (const p of pendingPicks.slice(0, 10)) {
    console.log(`  ${p.kickoffDate.toISOString()} · ${p.homeTeam} vs ${p.awayTeam} (${p.league}) @ ${p.oddsAtPublish}`)
  }

  // Strong-tier (lower bar) — could we offer those too?
  const pendingStrong = await prisma.premiumPickHistory.count({
    where: { tier: 'strong', result: 'pending', kickoffDate: { gte: now } },
  })
  console.log(`\nPending strong-tier picks (future kickoff): ${pendingStrong}`)

  // Same-match ADM data for those pending premium picks → SGP capture viability
  const externalIds = pendingPicks.map(p => p.id)  // wrong — need externalMatchId
  const fullPicks = await prisma.premiumPickHistory.findMany({
    where: { id: { in: externalIds } },
    select: { id: true, externalMatchId: true },
  })
  const extIds = fullPicks.map(p => p.externalMatchId)
  if (extIds.length > 0) {
    const adm = await prisma.additionalMarketData.count({ where: { matchId: { in: extIds } } })
    console.log(`\nADM rows for pending premium-pick matches: ${adm}`)
  }

  await prisma.$disconnect()
})()
