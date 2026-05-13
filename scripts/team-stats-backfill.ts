/**
 * One-shot backfill for TeamStats. Runs the same rollup logic the daily
 * cron uses, populating every qualifying team's row.
 *
 * Usage:
 *   npx tsx scripts/team-stats-backfill.ts --dry-run   (default)
 *   npx tsx scripts/team-stats-backfill.ts --commit
 *
 * Safe to run repeatedly — upserts by slug.
 */
import prisma from '../lib/db'
import { rollupAllTeams } from '../lib/team-stats/cron-impl'

;(async () => {
  const commit = process.argv.includes('--commit')
  const mode = commit ? '🔴 COMMIT' : '🟡 DRY-RUN'

  console.log('\n══════════════════════════════════════════════════════════')
  console.log(' Team Stats — BACKFILL')
  console.log(` Mode: ${mode}`)
  console.log('══════════════════════════════════════════════════════════\n')

  if (!commit) {
    // Dry-run: count candidate teams via raw query but skip writes
    const candidateCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
      WITH unioned AS (
        SELECT "homeTeam" AS name FROM "MarketMatch" WHERE "homeTeam" IS NOT NULL AND "homeTeam" <> ''
        UNION
        SELECT "awayTeam" AS name FROM "MarketMatch" WHERE "awayTeam" IS NOT NULL AND "awayTeam" <> ''
      )
      SELECT COUNT(DISTINCT name)::bigint AS count FROM unioned
    `
    console.log(`Distinct team names in MarketMatch: ${Number(candidateCount[0].count)}`)
    console.log('\n🟡 DRY-RUN — call with --commit to actually populate TeamStats.')
    console.log('   Cron impl will: filter to ≥10 historical matches + recent/upcoming activity,')
    console.log('   then upsert TeamStats rows for each qualifying team.\n')
    await prisma.$disconnect()
    process.exit(0)
  }

  console.log('Starting rollup...\n')
  const result = await rollupAllTeams()

  console.log('\n── RESULT ──')
  console.log(`Candidates (qualifying teams): ${result.candidateCount}`)
  console.log(`Rolled (upserted):              ${result.rolled}`)
  console.log(`Skipped:                        ${result.skipped}`)
  console.log(`Errors:                         ${result.errors}`)
  console.log(`Duration:                       ${(result.durationMs / 1000).toFixed(1)}s`)

  // Quick sanity sample
  const sample = await prisma.teamStats.findMany({
    take: 5,
    orderBy: { matchesPlayed: 'desc' },
    select: {
      slug: true,
      name: true,
      league: true,
      matchesPlayed: true,
      wins: true,
      draws: true,
      losses: true,
      formLast10: true,
      v1ModelAccuracy: true,
      v3ModelAccuracy: true,
      recommendedModel: true,
    },
  })
  console.log('\n── SAMPLE (top 5 by matches played) ──')
  for (const s of sample) {
    const v1 = s.v1ModelAccuracy ? `V1 ${(Number(s.v1ModelAccuracy) * 100).toFixed(1)}%` : 'V1 —'
    const v3 = s.v3ModelAccuracy ? `V3 ${(Number(s.v3ModelAccuracy) * 100).toFixed(1)}%` : 'V3 —'
    console.log(`  ${s.slug.padEnd(35).slice(0, 35)} · ${s.league?.padEnd(20).slice(0, 20)} · ${s.matchesPlayed}mp ${s.wins}W-${s.draws}D-${s.losses}L · ${v1} ${v3} ${s.recommendedModel ? `[reco:${s.recommendedModel}]` : ''} · form ${s.formLast10 || '—'}`)
  }

  console.log('\n✅ Done.\n')
  await prisma.$disconnect()
  process.exit(0)
})()
