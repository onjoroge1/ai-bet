/** Read-only: why is getSnapBetPicks() (→ /dashboard/snapbet-picks) empty? */
import prisma from '../lib/db'
import { getSnapBetPicks, getLeaguePremiumGate } from '../lib/premium-picks-engine'

;(async () => {
  const now = new Date()
  const up = await prisma.marketMatch.findMany({
    where: { status: 'UPCOMING', isActive: true, kickoffDate: { gte: now } },
    select: { league: true, v3Model: true, kickoffDate: true, homeTeam: true, awayTeam: true },
    orderBy: { kickoffDate: 'asc' },
    take: 500,
  })
  console.log(`UPCOMING soccer matches: ${up.length}`)
  const withV3 = up.filter(m => m.v3Model)
  console.log(`  with v3Model: ${withV3.length}`)
  const byLeague = new Map<string, { n: number; maxConf: number; gate: string }>()
  for (const m of withV3) {
    const v3 = m.v3Model as { confidence?: number }
    const lg = getLeaguePremiumGate(m.league)
    const e = byLeague.get(m.league) || { n: 0, maxConf: 0, gate: lg.dropped ? 'DROPPED' : String(lg.gate) }
    e.n++; e.maxConf = Math.max(e.maxConf, v3.confidence ?? 0)
    byLeague.set(m.league, e)
  }
  console.log('\nPer league (n / max v3 conf / premium gate):')
  for (const [lg, e] of byLeague) console.log(`  ${lg}: n=${e.n} maxConf=${(e.maxConf * 100).toFixed(0)}% gate=${e.gate}`)

  const withEdge = withV3.filter(m => 'edge_validated' in (m.v3Model as object))
  console.log(`\nv3Model rows carrying edge keys: ${withEdge.length}`)
  for (const m of withEdge.slice(0, 6)) {
    const v3 = m.v3Model as Record<string, unknown>
    console.log(`  ${m.homeTeam} vs ${m.awayTeam} (${m.league}): validated=${v3.edge_validated} ev=${v3.value_ev} rating=${v3.value_rating}`)
  }

  const picks = await getSnapBetPicks(30)
  console.log(`\ngetSnapBetPicks(30) → ${picks.length} picks`)
  for (const p of picks.slice(0, 10)) console.log(`  [${p.sport}/${p.tier}] ${p.homeTeam} vs ${p.awayTeam} (${p.league}) conf=${p.confidence}`)
  await prisma.$disconnect()
})()
