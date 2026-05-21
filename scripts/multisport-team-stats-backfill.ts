/**
 * One-shot backfill for multisport TeamStats — NBA + NHL.
 * NCAAB skipped (season is over; resume in November 2026).
 *
 * Usage:
 *   npx tsx scripts/multisport-team-stats-backfill.ts --dry-run
 *   npx tsx scripts/multisport-team-stats-backfill.ts --commit
 *   npx tsx scripts/multisport-team-stats-backfill.ts --commit --sport=basketball_nba
 */
import prisma from '../lib/db'
import { rollupSportTeams } from '../lib/team-stats/multisport-cron-impl'

;(async () => {
  const commit = process.argv.includes('--commit')
  const sportArg = process.argv.find(a => a.startsWith('--sport='))?.slice('--sport='.length)
  const sports = sportArg ? [sportArg] : ['basketball_nba', 'icehockey_nhl']

  console.log(`\nMultisport TeamStats Backfill · ${commit ? '🔴 COMMIT' : '🟡 DRY-RUN'} · sports=${sports.join(', ')}\n`)

  if (!commit) {
    for (const sport of sports) {
      const count = await prisma.multisportMatch.count({ where: { sport } })
      const distinctRow = await prisma.$queryRaw<Array<{ count: bigint }>>`
        WITH unioned AS (
          SELECT "homeTeam" AS name FROM "MultisportMatch" WHERE "sport" = ${sport} AND "homeTeam" IS NOT NULL AND "homeTeam" <> ''
          UNION
          SELECT "awayTeam" AS name FROM "MultisportMatch" WHERE "sport" = ${sport} AND "awayTeam" IS NOT NULL AND "awayTeam" <> ''
        )
        SELECT COUNT(DISTINCT name)::bigint AS count FROM unioned
      `
      console.log(`  ${sport}: ${count} rows, ${Number(distinctRow[0].count)} distinct teams`)
    }
    console.log('\n🟡 DRY-RUN — pass --commit to actually populate TeamStats.\n')
    await prisma.$disconnect()
    process.exit(0)
  }

  for (const sport of sports) {
    console.log(`\n── Rolling up ${sport}...`)
    const result = await rollupSportTeams(sport)
    console.log(`   candidates=${result.candidateCount} rolled=${result.rolled} skipped=${result.skipped} errors=${result.errors} duration=${(result.durationMs / 1000).toFixed(1)}s`)
  }

  // Sanity sample
  console.log('\n── SAMPLE (after backfill) ──')
  const sample = await prisma.teamStats.findMany({
    where: { sport: { in: sports } },
    orderBy: { matchesPlayed: 'desc' },
    take: 10,
    select: { slug: true, sport: true, name: true, league: true, matchesPlayed: true, wins: true, losses: true, formLast10: true, v3ModelAccuracy: true, v3ModelSampleN: true },
  })
  for (const s of sample) {
    const acc = s.v3ModelAccuracy ? `${(Number(s.v3ModelAccuracy) * 100).toFixed(1)}% (n=${s.v3ModelSampleN})` : '—'
    console.log(`  ${s.slug.padEnd(20)} ${s.sport.padEnd(20)} ${s.name.padEnd(28).slice(0, 28)} ${s.matchesPlayed}mp ${s.wins}W-${s.losses}L · model ${acc} · form ${s.formLast10 || '—'}`)
  }

  console.log('\n✅ Done.\n')
  await prisma.$disconnect()
})()
