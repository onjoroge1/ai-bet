/**
 * Quick lookup: search TeamStats + raw MarketMatch by team-name fragment.
 * Helps debug why a user-typed slug 404s — was the team filtered out by
 * the qualification gate, or does the name not exist in our data at all?
 *
 * Usage: npx tsx scripts/find-team-by-name.ts heerenveen
 */
import prisma from '../lib/db'

;(async () => {
  const needle = (process.argv[2] || '').trim()
  if (!needle) {
    console.error('Usage: npx tsx scripts/find-team-by-name.ts <name-fragment>')
    process.exit(1)
  }

  console.log(`\nSearching for "${needle}"...\n`)

  const ts = await prisma.teamStats.findMany({
    where: {
      OR: [
        { slug: { contains: needle.toLowerCase() } },
        { name: { contains: needle, mode: 'insensitive' } },
      ],
    },
    select: { slug: true, name: true, league: true, matchesPlayed: true, hasUpcoming: true, isActive: true },
  })
  console.log(`TeamStats hits (${ts.length}):`)
  for (const t of ts) console.log(`  ${t.slug}  ·  ${t.name}  ·  ${t.league}  ·  ${t.matchesPlayed}mp  upcoming=${t.hasUpcoming} active=${t.isActive}`)

  const mm = await prisma.marketMatch.findMany({
    where: {
      OR: [
        { homeTeam: { contains: needle, mode: 'insensitive' } },
        { awayTeam: { contains: needle, mode: 'insensitive' } },
      ],
    },
    select: { homeTeam: true, awayTeam: true, league: true, status: true, kickoffDate: true },
    take: 5,
    orderBy: { kickoffDate: 'desc' },
  })
  console.log(`\nMarketMatch hits (${mm.length}, top 5 by kickoff):`)
  for (const m of mm) console.log(`  ${m.kickoffDate.toISOString().slice(0,10)}  ${m.status.padEnd(9)}  ${m.homeTeam} vs ${m.awayTeam}  (${m.league})`)

  await prisma.$disconnect()
})()
