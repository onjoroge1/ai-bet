/**
 * One-shot cleanup: removes TeamStats rows written by the initial backfill
 * (commit pre-d2cd571 era) that have ugly redundant slugs like
 * "arsenal-Arsenal" — caused by a bug where externalTeamId === name but
 * the slug builder still appended it.
 *
 * Identifies broken rows by: slug contains a capital letter (clean slugs
 * are fully lowercased), OR slug ends with " " + the team name verbatim.
 * Removes ONLY those. Clean rows from a subsequent re-backfill are not
 * touched.
 *
 * Run with --dry-run (default) first; --commit to actually delete.
 */
import prisma from '../lib/db'

;(async () => {
  const commit = process.argv.includes('--commit')

  // Broken slugs contain uppercase letters or whitespace (clean ones are
  // entirely [a-z0-9-]).
  const allRows = await prisma.teamStats.findMany({
    select: { id: true, slug: true, name: true },
  })

  const broken = allRows.filter(r => !/^[a-z0-9-]+$/.test(r.slug))

  console.log(`Total TeamStats rows: ${allRows.length}`)
  console.log(`Broken slugs to remove: ${broken.length}`)
  console.log('Sample:')
  for (const r of broken.slice(0, 5)) console.log(`  "${r.slug}" (team: ${r.name})`)

  if (!commit) {
    console.log('\n🟡 DRY-RUN — pass --commit to delete.')
    await prisma.$disconnect()
    process.exit(0)
  }

  if (broken.length === 0) {
    console.log('\nNothing to clean.')
    await prisma.$disconnect()
    process.exit(0)
  }

  console.log('\n🔴 Deleting...')
  const result = await prisma.teamStats.deleteMany({
    where: { id: { in: broken.map(r => r.id) } },
  })
  console.log(`Deleted ${result.count} rows.`)

  await prisma.$disconnect()
  process.exit(0)
})()
