/**
 * One-shot backfill for PremiumPickHistory using deterministic replay of the
 * same qualification + odds + outcome logic the live capture/settle crons
 * use. Reads FINISHED MarketMatch rows in the given window, replays the
 * qualification rules, derives oddsAtPublish from consensusOdds (1/p),
 * derives outcome from finalResult, computes flat-$100 P/L, and writes
 * already-settled rows to PremiumPickHistory.
 *
 * Why: forward-only capture means the tracker card / /performance page is
 * empty until ~30d of capture accumulates. The pre-flight (2026-05-11)
 * proved we can deterministically reconstruct picks from existing data:
 * 83.5% consensusOdds coverage, premium tier +12.9% ROI over 30d. Backfill
 * unlocks meaningful numbers on day 1 without changing the math contract.
 *
 * Safety:
 *   - Default mode is --dry-run (prints what would be inserted, writes
 *     nothing). Pass --commit to actually write.
 *   - Idempotent via (marketMatchId, market) unique constraint —
 *     re-running is safe. Existing rows from live capture are NEVER
 *     overwritten.
 *   - All backfilled rows have surfacedBy='backfill' so audit table + UI
 *     can label them transparently.
 *   - publishedAt is set to kickoffDate − 24h (approximate publish time).
 *
 * Usage:
 *   npx tsx scripts/premium-tracker-backfill.ts --window=90 --dry-run
 *   npx tsx scripts/premium-tracker-backfill.ts --window=90 --commit
 *   npx tsx scripts/premium-tracker-backfill.ts --window=90 --tier=premium --commit
 *
 * Reversible:
 *   DELETE FROM "PremiumPickHistory" WHERE "surfacedBy" = 'backfill'
 */

import prisma from '../lib/db'
import {
  qualifyForTracker,
  consensusToDecimalOdds,
  pickToMarket,
  pickToLabel,
  outcomeFromFinalResult,
  settlePick,
  type Pick3,
} from '../lib/premium-tracker/capture-helpers'

interface Args {
  windowDays: number
  commit: boolean
  tierFilter: 'all' | 'premium' | 'strong'
}

function parseArgs(): Args {
  const args = process.argv.slice(2)
  let windowDays = 90
  let commit = false
  let tierFilter: Args['tierFilter'] = 'all'
  for (const a of args) {
    if (a === '--commit') commit = true
    else if (a === '--dry-run') commit = false
    else if (a.startsWith('--window=')) windowDays = parseInt(a.slice('--window='.length), 10) || 90
    else if (a.startsWith('--tier=')) {
      const t = a.slice('--tier='.length)
      if (t === 'all' || t === 'premium' || t === 'strong') tierFilter = t
    }
  }
  return { windowDays, commit, tierFilter }
}

;(async () => {
  const { windowDays, commit, tierFilter } = parseArgs()
  const now = new Date()
  const cutoff = new Date(now.getTime() - windowDays * 86400 * 1000)

  console.log('\n══════════════════════════════════════════════════════════')
  console.log(' Premium Pick Tracker — BACKFILL')
  console.log(` Window: last ${windowDays} days (since ${cutoff.toISOString().slice(0, 10)})`)
  console.log(` Tier filter: ${tierFilter}`)
  console.log(` Mode: ${commit ? '🔴 COMMIT (writes to DB)' : '🟡 DRY-RUN (no writes)'}`)
  console.log('══════════════════════════════════════════════════════════\n')

  // ── Candidate matches: FINISHED + has v3Model + has finalResult ──────
  const matches = await prisma.marketMatch.findMany({
    where: {
      status: 'FINISHED',
      kickoffDate: { gte: cutoff, lt: now },
      v3Model: { not: { equals: null as unknown as object } },
      finalResult: { not: { equals: null as unknown as object } },
      isActive: true,
    },
    select: {
      id: true,
      matchId: true,
      homeTeam: true,
      awayTeam: true,
      homeTeamId: true,
      awayTeamId: true,
      league: true,
      kickoffDate: true,
      v3Model: true,
      finalResult: true,
      consensusOdds: true,
    },
    orderBy: { kickoffDate: 'asc' },
    take: 5000,
  })

  console.log(`FINISHED soccer matches with v3Model + finalResult: ${matches.length}`)

  // ── Pre-load QuickPurchases (for predictionData / premiumScore) ──────
  const matchIds = matches.map(m => m.matchId)
  const qps = await prisma.quickPurchase.findMany({
    where: {
      matchId: { in: matchIds },
      predictionData: { not: { equals: null as unknown as object } },
    },
    select: { matchId: true, predictionData: true, premiumScore: true, premiumTier: true },
  })
  const qpByMatchId = new Map(qps.map(qp => [qp.matchId, qp]))

  // ── Pre-load existing PremiumPickHistory keys (idempotency) ──────────
  const existing = await prisma.premiumPickHistory.findMany({
    where: { marketMatchId: { in: matches.map(m => m.id) } },
    select: { marketMatchId: true, market: true },
  })
  const existingKey = new Set(existing.map(e => `${e.marketMatchId}::${e.market}`))
  console.log(`Existing PremiumPickHistory rows in window: ${existing.length} (will be skipped)`)

  // ── Replay loop ──────────────────────────────────────────────────────
  type CandidateRow = {
    marketMatchId: string
    externalMatchId: string
    sport: string
    league: string | null
    homeTeam: string
    awayTeam: string
    market: string
    pick: string
    pickSide: Pick3
    oddsAtPublish: number
    confidence: number
    tier: 'premium' | 'strong'
    publishedAt: Date
    kickoffDate: Date
    result: 'win' | 'loss' | 'push' | 'void'
    netDollars: number
    netUnits: number
    settledAt: Date
    rawSnapshot: unknown
  }

  const stageRows: CandidateRow[] = []
  let skippedDuplicate = 0
  let skippedNotQualified = 0
  let skippedNoOdds = 0
  let skippedNoOutcome = 0
  let skippedTierFilter = 0

  for (const m of matches) {
    const qp = qpByMatchId.get(m.matchId)
    const qual = qualifyForTracker({
      v3Model: m.v3Model,
      predictionData: qp?.predictionData ?? null,
      premiumScore: qp?.premiumScore ? Number(qp.premiumScore) : null,
      league: m.league,
    })
    if (!qual) { skippedNotQualified++; continue }

    if (tierFilter !== 'all' && qual.tier !== tierFilter) { skippedTierFilter++; continue }

    const market = pickToMarket(qual.pick)
    if (existingKey.has(`${m.id}::${market}`)) { skippedDuplicate++; continue }

    const odds = consensusToDecimalOdds(m.consensusOdds, qual.pick)
    if (odds === null || odds <= 1) { skippedNoOdds++; continue }

    const outcome = outcomeFromFinalResult(m.finalResult)
    if (!outcome) { skippedNoOutcome++; continue }

    const settlement = settlePick(qual.pick, outcome, odds, 100)
    if (!settlement) { skippedNoOutcome++; continue }

    // publishedAt approximates publish time as kickoff − 24h. This keeps
    // window bucketing sensible without claiming we published earlier.
    const publishedAt = new Date(m.kickoffDate.getTime() - 24 * 3600 * 1000)

    stageRows.push({
      marketMatchId: m.id,
      externalMatchId: m.matchId,
      sport: 'soccer',
      league: m.league,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      market,
      pick: pickToLabel(qual.pick, m.homeTeam, m.awayTeam),
      pickSide: qual.pick,
      oddsAtPublish: odds,
      confidence: qual.confidence,
      tier: qual.tier,
      publishedAt,
      kickoffDate: m.kickoffDate,
      result: settlement.result,
      netDollars: settlement.netDollars,
      netUnits: settlement.netUnits,
      settledAt: new Date(m.kickoffDate.getTime() + 2 * 3600 * 1000),  // 2h post-kickoff
      rawSnapshot: {
        v3Model: m.v3Model,
        predictionData: qp?.predictionData ?? null,
        premiumScore: qp?.premiumScore ? Number(qp.premiumScore) : null,
        premiumTier: qp?.premiumTier ?? null,
        consensusOdds: m.consensusOdds,
        finalResult: m.finalResult,
        reasons: qual.reasons,
        backfilledAt: now.toISOString(),
        backfillScriptVersion: 1,
      },
    })
  }

  // ── Summary ──────────────────────────────────────────────────────────
  const byTier = stageRows.reduce<Record<string, number>>((acc, r) => { acc[r.tier] = (acc[r.tier] || 0) + 1; return acc }, {})
  const byResult = stageRows.reduce<Record<string, number>>((acc, r) => { acc[r.result] = (acc[r.result] || 0) + 1; return acc }, {})
  const totalNet = stageRows.reduce((s, r) => s + r.netDollars, 0)
  const totalStaked = stageRows.filter(r => r.result === 'win' || r.result === 'loss').length * 100
  const roi = totalStaked > 0 ? (totalNet / totalStaked) * 100 : 0
  const wins = byResult.win || 0
  const losses = byResult.loss || 0
  const hitRate = (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0

  console.log(`\n── RESULT ──`)
  console.log(`Rows to insert: ${stageRows.length}`)
  console.log(`  by tier:    premium=${byTier.premium || 0} · strong=${byTier.strong || 0}`)
  console.log(`  by result:  win=${byResult.win || 0} · loss=${byResult.loss || 0} · push=${byResult.push || 0} · void=${byResult.void || 0}`)
  console.log(`  totals:     staked $${totalStaked.toLocaleString()} · net ${totalNet >= 0 ? '+' : ''}$${totalNet.toFixed(2)} · ROI ${roi >= 0 ? '+' : ''}${roi.toFixed(2)}% · hit ${hitRate.toFixed(1)}%`)

  // Per-tier breakdown for premium (the marketing headline)
  const premiumRows = stageRows.filter(r => r.tier === 'premium')
  const premiumWL = premiumRows.filter(r => r.result === 'win' || r.result === 'loss')
  const premiumNet = premiumWL.reduce((s, r) => s + r.netDollars, 0)
  const premiumStaked = premiumWL.length * 100
  const premiumRoi = premiumStaked > 0 ? (premiumNet / premiumStaked) * 100 : 0
  const premiumWins = premiumRows.filter(r => r.result === 'win').length
  const premiumLosses = premiumRows.filter(r => r.result === 'loss').length
  console.log(`  premium:    ${premiumWins}W-${premiumLosses}L · net ${premiumNet >= 0 ? '+' : ''}$${premiumNet.toFixed(2)} · ROI ${premiumRoi >= 0 ? '+' : ''}${premiumRoi.toFixed(2)}%`)

  console.log(`\n── SKIP REASONS ──`)
  console.log(`  not qualified (no premium/strong tier): ${skippedNotQualified}`)
  console.log(`  filtered by --tier flag:                 ${skippedTierFilter}`)
  console.log(`  duplicate (already in PremiumPickHistory): ${skippedDuplicate}`)
  console.log(`  no usable consensusOdds:                 ${skippedNoOdds}`)
  console.log(`  no parseable finalResult outcome:        ${skippedNoOutcome}`)

  // ── Sample rows ──────────────────────────────────────────────────────
  console.log(`\n── SAMPLE (first 5) ──`)
  for (const r of stageRows.slice(0, 5)) {
    const sign = r.netDollars >= 0 ? '+' : ''
    console.log(`  ${r.kickoffDate.toISOString().slice(0, 10)} · ${r.tier.padEnd(7)} · ${r.league?.padEnd(20).slice(0, 20)} · ${r.homeTeam} vs ${r.awayTeam} · ${r.market} @ ${r.oddsAtPublish} · ${r.result.toUpperCase()} ${sign}$${r.netDollars.toFixed(2)}`)
  }

  // ── Write phase ──────────────────────────────────────────────────────
  if (!commit) {
    console.log(`\n🟡 DRY-RUN — no rows inserted. Re-run with --commit to write.`)
    await prisma.$disconnect()
    process.exit(0)
  }

  console.log(`\n🔴 COMMIT — writing ${stageRows.length} rows...`)
  let inserted = 0
  let raced = 0
  for (const r of stageRows) {
    try {
      await prisma.premiumPickHistory.create({
        data: {
          marketMatchId: r.marketMatchId,
          externalMatchId: r.externalMatchId,
          sport: r.sport,
          league: r.league,
          homeTeam: r.homeTeam,
          awayTeam: r.awayTeam,
          market: r.market,
          pick: r.pick,
          oddsAtPublish: r.oddsAtPublish,
          stakeUnits: 1.0,
          stakeDollars: 100,
          tier: r.tier,
          confidence: r.confidence,
          surfacedBy: 'backfill',
          publishedAt: r.publishedAt,
          kickoffDate: r.kickoffDate,
          result: r.result,
          settledAt: r.settledAt,
          netDollars: r.netDollars,
          netUnits: r.netUnits,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rawSnapshot: r.rawSnapshot as any,
          notes: 'Reconstructed via scripts/premium-tracker-backfill.ts',
        },
      })
      inserted++
    } catch (e) {
      if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2002') {
        raced++  // unique-constraint race — fine to skip
      } else {
        console.error(`  insert failed for ${r.externalMatchId}:`, e)
      }
    }
  }

  console.log(`\n✅ DONE. Inserted ${inserted} rows. Raced (unique conflict) ${raced}.`)
  console.log(`\nTo revert:  DELETE FROM "PremiumPickHistory" WHERE "surfacedBy" = 'backfill';\n`)
  await prisma.$disconnect()
  process.exit(0)
})()
