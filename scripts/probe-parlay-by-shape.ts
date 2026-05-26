/**
 * Break down the public-facing /parlays stats by (archetype, legCount)
 * so we can pick the right default filter.
 */
import prisma from '../lib/db'

;(async () => {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400 * 1000)

  const rows = await prisma.premiumParlay.findMany({
    where: {
      result: { in: ['win', 'loss'] },
      settledAt: { gte: thirtyDaysAgo },
    },
    select: {
      archetype: true, legCount: true, result: true,
      stakeDollars: true, netDollars: true, combinedOdds: true,
    },
  })

  type Bucket = { count: number; wins: number; net: number; stake: number; oddsSum: number }
  const map = new Map<string, Bucket>()
  for (const r of rows) {
    const key = `${r.archetype}/${r.legCount}leg`
    const b = map.get(key) || { count: 0, wins: 0, net: 0, stake: 0, oddsSum: 0 }
    b.count++
    if (r.result === 'win') b.wins++
    b.net += r.netDollars !== null ? Number(r.netDollars) : 0
    b.stake += Number(r.stakeDollars)
    b.oddsSum += Number(r.combinedOdds)
    map.set(key, b)
  }

  console.log('30d settled parlays by archetype/legCount (all in DB):\n')
  console.log('  archetype/legs            · n   · W- L  · hit%  · avg odds · net $    · ROI')
  for (const [key, b] of [...map.entries()].sort()) {
    const settled = b.count
    const losses = settled - b.wins
    const hit = settled > 0 ? (b.wins / settled * 100) : 0
    const roi = b.stake > 0 ? (b.net / b.stake * 100) : 0
    const avgOdds = settled > 0 ? b.oddsSum / settled : 0
    console.log(
      `  ${key.padEnd(26)} · ${settled.toString().padStart(3)} · ${b.wins.toString().padStart(2)}-${losses.toString().padStart(2)} · ${hit.toFixed(1).padStart(5)}% · ${avgOdds.toFixed(2).padStart(7)} · ${b.net >= 0 ? '+' : ''}${b.net.toFixed(0).padStart(7)} · ${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%`
    )
  }
  await prisma.$disconnect()
})()
