/**
 * Compare old V3 ≥0.60 (all leagues) gate vs new per-league gates
 * against last 90d of settled soccer matches. Pure read.
 */
import prisma from '../lib/db'
import { getLeaguePremiumGate } from '../lib/premium-picks-engine'

function pick(m: unknown): 'home' | 'away' | 'draw' | null {
  if (!m || typeof m !== 'object') return null
  const p = (m as { pick?: string }).pick
  if (typeof p !== 'string') return null
  const lo = p.toLowerCase()
  if (lo === 'home' || lo === 'h') return 'home'
  if (lo === 'away' || lo === 'a') return 'away'
  if (lo === 'draw' || lo === 'd') return 'draw'
  return null
}

function outcome(fr: unknown): 'home' | 'away' | 'draw' | null {
  if (typeof fr === 'string') {
    const u = fr.toUpperCase()
    if (u === 'H') return 'home'
    if (u === 'A') return 'away'
    if (u === 'D') return 'draw'
  }
  const o = (fr as { outcome?: string; score?: { home?: number; away?: number } } | null)
  if (o?.outcome) {
    const u = o.outcome.toLowerCase()
    if (u === 'home') return 'home'; if (u === 'away') return 'away'; if (u === 'draw') return 'draw'
  }
  if (o?.score && typeof o.score.home === 'number' && typeof o.score.away === 'number') {
    if (o.score.home > o.score.away) return 'home'
    if (o.score.away > o.score.home) return 'away'
    return 'draw'
  }
  return null
}

;(async () => {
  const d90 = new Date(Date.now() - 90 * 86400 * 1000)
  const matches = await prisma.marketMatch.findMany({
    where: {
      status: 'FINISHED',
      isActive: true,
      kickoffDate: { gte: d90 },
      finalResult: { not: { equals: null as unknown as object } },
      v3Model: { not: { equals: null as unknown as object } },
    },
    select: { league: true, v3Model: true, finalResult: true },
    take: 5000,
  })

  let oldHit = 0, oldN = 0
  let newHit = 0, newN = 0
  let droppedCount = 0
  for (const m of matches) {
    const v3 = m.v3Model as { pick?: string; confidence?: number }
    const v3Pick = pick(v3)
    const v3Conf = typeof v3?.confidence === 'number' ? v3.confidence : 0
    const actual = outcome(m.finalResult)
    if (!v3Pick || !actual) continue

    // Old: V3 ≥0.60 across all leagues
    if (v3Conf >= 0.60) {
      oldN++
      if (v3Pick === actual) oldHit++
    }

    // New: per-league gate, drop anti-signal leagues
    const lg = getLeaguePremiumGate(m.league)
    if (lg.dropped) { droppedCount++; continue }
    if (v3Conf >= lg.gate) {
      newN++
      if (v3Pick === actual) newHit++
    }
  }

  console.log('\n══════════════════════════════════════════════════════════')
  console.log('  Gate Comparison · last 90d soccer V3 picks')
  console.log('══════════════════════════════════════════════════════════\n')
  console.log(`  OLD GATE (V3 ≥0.60, all leagues):`)
  console.log(`    Hit:  ${oldHit}/${oldN}  (${oldN > 0 ? ((oldHit / oldN) * 100).toFixed(1) : 0}%)`)
  console.log(`    Yield: ${(oldN / 90).toFixed(2)} picks/day · ${(oldN * 4).toFixed(0)}/year`)
  console.log()
  console.log(`  NEW GATE (per-league + drop anti-signal):`)
  console.log(`    Hit:  ${newHit}/${newN}  (${newN > 0 ? ((newHit / newN) * 100).toFixed(1) : 0}%)`)
  console.log(`    Yield: ${(newN / 90).toFixed(2)} picks/day · ${(newN * 4).toFixed(0)}/year`)
  console.log(`    Matches dropped (anti-signal leagues): ${droppedCount}`)
  console.log()
  console.log(`  Delta: ${newN > oldN ? '+' : ''}${newN - oldN} picks  ·  ${newN > 0 && oldN > 0 ? (((newHit / newN) - (oldHit / oldN)) * 100).toFixed(1) : 0}pp hit-rate`)
  console.log()
  await prisma.$disconnect()
})()
