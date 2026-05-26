/**
 * Backfill premium-only parlays from the existing PremiumPickHistory.
 *
 * Generates ALL valid 2/3/4/5-leg combinations across same-day windows
 * (configurable). Each combo gets a row in PremiumParlay marked
 * surfacedBy='backfill', already settled if all legs have results.
 *
 * Usage:
 *   npx tsx scripts/premium-parlay-backfill.ts --window=48 --dry-run
 *   npx tsx scripts/premium-parlay-backfill.ts --window=48 --commit
 *   npx tsx scripts/premium-parlay-backfill.ts --window=168 --commit (7d window)
 */
import prisma from '../lib/db'
import { buildParlayCandidates, parlayKey, type PremiumPickLike } from '../lib/premium-tracker/parlay-builder'

interface Args {
  commit: boolean
  windowHours: number
  legCounts: number[]
}

function parseArgs(): Args {
  const args = process.argv.slice(2)
  let commit = false
  let windowHours = 48
  let legCounts = [2, 3, 4, 5]
  for (const a of args) {
    if (a === '--commit') commit = true
    else if (a === '--dry-run') commit = false
    else if (a.startsWith('--window=')) windowHours = parseInt(a.slice('--window='.length), 10) || 48
    else if (a.startsWith('--legs=')) {
      legCounts = a.slice('--legs='.length).split(',').map(n => parseInt(n, 10)).filter(Boolean)
    }
  }
  return { commit, windowHours, legCounts }
}

;(async () => {
  const { commit, windowHours, legCounts } = parseArgs()

  console.log('\n══════════════════════════════════════════════════════════')
  console.log(' Premium Parlay Backfill')
  console.log(` Window: ${windowHours}h  ·  Leg counts: ${legCounts.join(', ')}`)
  console.log(` Mode: ${commit ? '🔴 COMMIT (writes to DB)' : '🟡 DRY-RUN (no writes)'}`)
  console.log('══════════════════════════════════════════════════════════\n')

  // Pull all premium-tier picks with settlement status
  const allPicks = await prisma.premiumPickHistory.findMany({
    where: {
      tier: 'premium',
      result: { in: ['win', 'loss'] },  // only settled picks for backfill
    },
    select: {
      id: true, marketMatchId: true, market: true,
      oddsAtPublish: true, homeTeam: true, awayTeam: true, league: true,
      pick: true, kickoffDate: true, result: true,
    },
    orderBy: { kickoffDate: 'asc' },
  })
  console.log(`Settled premium picks available: ${allPicks.length}`)

  const inputs: PremiumPickLike[] = allPicks.map(r => ({
    id: r.id,
    marketMatchId: r.marketMatchId,
    market: r.market,
    oddsAtPublish: Number(r.oddsAtPublish),
    homeTeam: r.homeTeam,
    awayTeam: r.awayTeam,
    league: r.league,
    selection: r.pick,
    kickoffDate: r.kickoffDate,
    result: r.result as PremiumPickLike['result'],
  }))

  const candidates = buildParlayCandidates(inputs, {
    legCounts,
    windowHours,
    // No capPerLegCount — exhaustive for diagnostic completeness
  })

  // Pre-load existing parlay leg sets to skip duplicates
  const existingParlayLegs = await prisma.premiumParlayLeg.findMany({
    where: { pickId: { in: inputs.map(p => p.id) } },
    select: { parlayId: true, pickId: true },
  })
  const setsByParlay = new Map<string, Set<string>>()
  for (const l of existingParlayLegs) {
    const s = setsByParlay.get(l.parlayId) ?? new Set<string>()
    s.add(l.pickId)
    setsByParlay.set(l.parlayId, s)
  }
  const existingKeys = new Set<string>()
  for (const s of setsByParlay.values()) {
    existingKeys.add([...s].sort().join('|'))
  }

  // Stats per leg count
  type Bucket = {
    total: number
    wins: number
    losses: number
    voids: number
    pending: number
    netDollars: number
  }
  const byLeg = new Map<number, Bucket>()
  for (const lc of legCounts) byLeg.set(lc, { total: 0, wins: 0, losses: 0, voids: 0, pending: 0, netDollars: 0 })

  let toWrite = 0
  let skippedDuplicate = 0
  for (const c of candidates) {
    const key = parlayKey({ legs: c.legs })
    const dup = existingKeys.has(key)
    const bucket = byLeg.get(c.legCount)!
    bucket.total++
    if (c.result === 'win') bucket.wins++
    else if (c.result === 'loss') bucket.losses++
    else if (c.result === 'void') bucket.voids++
    else bucket.pending++
    bucket.netDollars += c.netDollars ?? 0

    if (dup) { skippedDuplicate++; continue }
    toWrite++
  }

  console.log('\n── HYPOTHETICAL RESULTS PER LEG COUNT ──')
  console.log('  legs · total  · win - loss · hit%   · net @ $10 · ROI')
  for (const lc of legCounts) {
    const b = byLeg.get(lc)!
    const settledN = b.wins + b.losses
    const hit = settledN > 0 ? (b.wins / settledN) * 100 : 0
    const staked = settledN * 10  // backfill uses default $10 stake
    const roi = staked > 0 ? (b.netDollars / staked) * 100 : 0
    console.log(
      `  ${lc.toString().padStart(4)} · ${b.total.toString().padStart(5)}  · ${b.wins.toString().padStart(4)} - ${b.losses.toString().padStart(4)} · ${hit.toFixed(1).padStart(5)}% · ${b.netDollars >= 0 ? '+' : ''}${b.netDollars.toFixed(2).padStart(8)} · ${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%`
    )
  }

  console.log(`\nTotal candidates: ${candidates.length}`)
  console.log(`To insert:        ${toWrite}`)
  console.log(`Existing:         ${skippedDuplicate}`)

  if (!commit) {
    console.log('\n🟡 DRY-RUN — re-run with --commit to write rows.')
    await prisma.$disconnect()
    process.exit(0)
  }

  console.log(`\n🔴 Writing ${toWrite} parlays...`)
  let inserted = 0
  let raced = 0
  const now = new Date()
  for (const c of candidates) {
    const key = parlayKey({ legs: c.legs })
    if (existingKeys.has(key)) continue
    try {
      await prisma.premiumParlay.create({
        data: {
          legCount: c.legCount,
          combinedOdds: c.combinedOdds,
          stakeDollars: 10,
          publishedAt: new Date(c.legs[0].kickoffDate.getTime() - 24 * 3600 * 1000),
          earliestKickoff: c.earliestKickoff,
          latestKickoff: c.latestKickoff,
          result: c.result,
          settledAt: c.result !== 'pending' ? new Date(c.latestKickoff.getTime() + 2 * 3600 * 1000) : null,
          netDollars: c.netDollars,
          surfacedBy: 'backfill',
          notes: `Backfilled via scripts/premium-parlay-backfill.ts (window=${windowHours}h)`,
          legs: {
            create: c.legs.map((leg, i) => ({
              pickId: leg.id,
              legOrder: i,
              oddsAtPublish: leg.oddsAtPublish,
              homeTeam: leg.homeTeam,
              awayTeam: leg.awayTeam,
              league: leg.league,
              market: leg.market,
              selection: leg.selection,
              kickoffDate: leg.kickoffDate,
            })),
          },
          rawSnapshot: {
            backfilledAt: now.toISOString(),
            windowHours,
          },
        },
      })
      inserted++
      existingKeys.add(key)
    } catch (e) {
      if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2002') {
        raced++
      } else {
        console.error(`Insert failed:`, e instanceof Error ? e.message : e)
      }
    }
  }

  console.log(`\n✅ DONE. Inserted ${inserted} rows. Raced ${raced}.`)
  console.log(`\nTo revert:  DELETE FROM "PremiumParlay" WHERE "surfacedBy" = 'backfill';\n`)
  await prisma.$disconnect()
  process.exit(0)
})()
