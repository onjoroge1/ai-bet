/**
 * Backfill SGP (Same-Game-Parlay) variants on top of historical premium
 * picks. For each settled premium pick that has AdditionalMarketData
 * + a final score, generate every SGP archetype and write it into
 * PremiumParlay (archetype='sgp_single_match', surfacedBy='backfill').
 *
 * Usage:
 *   npx tsx scripts/premium-sgp-backfill.ts --dry-run
 *   npx tsx scripts/premium-sgp-backfill.ts --commit
 */
import prisma from '../lib/db'
import { buildSgpVariants, type SecondaryMarketRow, type PremiumPickLike } from '../lib/premium-tracker/parlay-builder'

;(async () => {
  const commit = process.argv.includes('--commit')

  console.log('\n══════════════════════════════════════════════════════════')
  console.log(` Premium SGP Backfill · ${commit ? '🔴 COMMIT' : '🟡 DRY-RUN'}`)
  console.log('══════════════════════════════════════════════════════════\n')

  // Pull settled premium picks
  const premium = await prisma.premiumPickHistory.findMany({
    where: { tier: 'premium', result: { in: ['win', 'loss'] } },
    select: {
      id: true, marketMatchId: true, externalMatchId: true,
      market: true, pick: true, oddsAtPublish: true,
      homeTeam: true, awayTeam: true, league: true,
      kickoffDate: true, result: true,
    },
    orderBy: { kickoffDate: 'asc' },
  })
  console.log(`Settled premium picks: ${premium.length}`)

  const externalIds = premium.map(p => p.externalMatchId)
  const adm = await prisma.additionalMarketData.findMany({
    where: { matchId: { in: externalIds } },
    select: {
      matchId: true, marketType: true, marketSubtype: true,
      line: true, consensusProb: true,
    },
  })
  const admByMatch = new Map<string, SecondaryMarketRow[]>()
  for (const r of adm) {
    if (!r.marketSubtype || r.consensusProb === null) continue
    const arr = admByMatch.get(r.matchId) || []
    arr.push({
      matchId: r.matchId,
      marketType: r.marketType,
      marketSubtype: r.marketSubtype,
      line: r.line !== null ? Number(r.line) : null,
      consensusProb: Number(r.consensusProb),
    })
    admByMatch.set(r.matchId, arr)
  }

  // Final scores for each premium-pick match
  const internalIds = premium.map(p => p.marketMatchId)
  const matches = await prisma.marketMatch.findMany({
    where: { id: { in: internalIds }, status: 'FINISHED' },
    select: { id: true, finalResult: true },
  })
  const scoreById = new Map<string, { home: number; away: number } | null>()
  for (const m of matches) {
    const fr = m.finalResult as { score?: { home?: number; away?: number } } | null
    if (fr?.score && typeof fr.score.home === 'number' && typeof fr.score.away === 'number') {
      scoreById.set(m.id, { home: fr.score.home, away: fr.score.away })
    } else {
      scoreById.set(m.id, null)
    }
  }

  // Pre-load existing SGP parlay rows so we don't double-insert
  const existing = await prisma.premiumParlay.findMany({
    where: { archetype: 'sgp_single_match' },
    select: { id: true, notes: true, baseMatchId: true, legs: { select: { market: true, selection: true, line: true } } },
  })
  // Idempotency key: baseMatchId + archetype-fingerprint
  function parlayFingerprint(baseMatchId: string, legs: Array<{ market: string; selection: string; line: number | null }>): string {
    return [baseMatchId, ...legs.map(l => `${l.market}:${l.selection}:${l.line ?? ''}`).sort()].join('|')
  }
  const existingKeys = new Set<string>()
  for (const e of existing) {
    if (!e.baseMatchId) continue
    existingKeys.add(parlayFingerprint(e.baseMatchId, e.legs.map(l => ({
      market: l.market, selection: l.selection, line: l.line !== null ? Number(l.line) : null,
    }))))
  }

  // Build variants
  type Bucket = { total: number; wins: number; losses: number; voids: number; net: number; staked: number }
  const byArchetype = new Map<string, Bucket>()
  function ensure(name: string): Bucket {
    let b = byArchetype.get(name)
    if (!b) { b = { total: 0, wins: 0, losses: 0, voids: 0, net: 0, staked: 0 }; byArchetype.set(name, b) }
    return b
  }

  let candidatesTotal = 0
  let toWrite = 0
  let skippedDuplicate = 0
  type Stage = {
    archetype: string
    legCount: number
    combinedOdds: number
    earliestKickoff: Date
    latestKickoff: Date
    result: 'pending' | 'win' | 'loss' | 'void'
    netDollars: number | null
    baseMatchId: string
    legs: ReturnType<typeof buildSgpVariants>[number]['legs']
    externalMatchId: string
  }
  const stage: Stage[] = []

  for (const p of premium) {
    const rows = admByMatch.get(p.externalMatchId) || []
    if (rows.length === 0) continue
    const score = scoreById.get(p.marketMatchId)
    if (!score) continue

    const basePick: PremiumPickLike = {
      id: p.id,
      marketMatchId: p.marketMatchId,
      market: p.market,
      oddsAtPublish: Number(p.oddsAtPublish),
      homeTeam: p.homeTeam,
      awayTeam: p.awayTeam,
      league: p.league,
      selection: p.pick,
      kickoffDate: p.kickoffDate,
      result: p.result as PremiumPickLike['result'],
    }
    const variants = buildSgpVariants(basePick, rows, { score, stakeDollars: 10 })
    candidatesTotal += variants.length

    for (const v of variants) {
      const fingerprint = parlayFingerprint(p.marketMatchId,
        v.legs.map(l => ({ market: l.market, selection: l.selection, line: l.line })))
      const dup = existingKeys.has(fingerprint)

      const b = ensure(v.archetype)
      b.total++
      if (v.result === 'win') { b.wins++; b.staked += 10; b.net += v.netDollars ?? 0 }
      else if (v.result === 'loss') { b.losses++; b.staked += 10; b.net += v.netDollars ?? 0 }
      else if (v.result === 'void') b.voids++

      if (!dup) {
        toWrite++
        stage.push({
          archetype: v.archetype,
          legCount: v.legCount,
          combinedOdds: v.combinedOdds,
          earliestKickoff: v.earliestKickoff,
          latestKickoff: v.latestKickoff,
          result: v.result,
          netDollars: v.netDollars,
          baseMatchId: p.marketMatchId,
          legs: v.legs.map(l => ({ ...l, externalMatchId: p.externalMatchId })),
          externalMatchId: p.externalMatchId,
        })
      } else {
        skippedDuplicate++
      }
    }
  }

  console.log('\n── HYPOTHETICAL RESULTS BY ARCHETYPE ──')
  console.log('  archetype                · n  · W- L- V  · hit%  · net @ $10 · ROI')
  for (const [name, b] of byArchetype) {
    const settled = b.wins + b.losses
    const hit = settled > 0 ? (b.wins / settled * 100) : 0
    const roi = b.staked > 0 ? (b.net / b.staked * 100) : 0
    console.log(
      `  ${name.padEnd(24)} · ${b.total.toString().padStart(2)} · ${b.wins.toString().padStart(2)}-${b.losses.toString().padStart(2)}-${b.voids.toString().padStart(2)} · ${hit.toFixed(1).padStart(5)}% · ${b.net >= 0 ? '+' : ''}${b.net.toFixed(2).padStart(8)} · ${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%`
    )
  }
  console.log(`\nCandidates total: ${candidatesTotal}`)
  console.log(`To insert:        ${toWrite}`)
  console.log(`Existing (dup):   ${skippedDuplicate}`)

  if (!commit) {
    console.log('\n🟡 DRY-RUN — re-run with --commit to write.\n')
    await prisma.$disconnect()
    process.exit(0)
  }

  console.log(`\n🔴 Writing ${toWrite} SGP parlays...`)
  let inserted = 0
  let errors = 0
  for (const s of stage) {
    try {
      await prisma.premiumParlay.create({
        data: {
          legCount: s.legCount,
          combinedOdds: s.combinedOdds,
          stakeDollars: 10,
          archetype: 'sgp_single_match',
          baseMatchId: s.baseMatchId,
          sgpLegCount: s.legs.filter(l => l.legType === 'sgp_overlay').length,
          publishedAt: new Date(s.earliestKickoff.getTime() - 24 * 3600 * 1000),
          earliestKickoff: s.earliestKickoff,
          latestKickoff: s.latestKickoff,
          result: s.result,
          settledAt: s.result !== 'pending' ? new Date(s.latestKickoff.getTime() + 2 * 3600 * 1000) : null,
          netDollars: s.netDollars,
          surfacedBy: 'backfill',
          notes: `SGP backfill (archetype=${s.archetype})`,
          legs: {
            create: s.legs.map((l, i) => ({
              pickId: l.legType === 'premium_1x2' ? l.pickId : null,
              legType: l.legType,
              legOrder: i,
              oddsAtPublish: l.oddsAtPublish,
              homeTeam: l.homeTeam,
              awayTeam: l.awayTeam,
              league: l.league,
              market: l.market,
              selection: l.selection,
              line: l.line !== null ? l.line : null,
              kickoffDate: l.kickoffDate,
              marketMatchId: l.marketMatchId,
            })),
          },
          rawSnapshot: { archetype: s.archetype, externalMatchId: s.externalMatchId },
        },
      })
      inserted++
    } catch (e) {
      errors++
      console.error('Insert failed:', e instanceof Error ? e.message : e)
    }
  }
  console.log(`\n✅ DONE. Inserted ${inserted} rows. Errors ${errors}.`)
  console.log(`\nTo revert:  DELETE FROM "PremiumParlay" WHERE "archetype" = 'sgp_single_match' AND "surfacedBy" = 'backfill';\n`)
  await prisma.$disconnect()
  process.exit(0)
})()
