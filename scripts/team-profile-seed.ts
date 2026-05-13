/**
 * One-shot: seed AI profiles for the top-N teams by match count, so the
 * /team/[slug]/predictions pages render the "About {team}" section
 * immediately instead of waiting for the daily 05:00 UTC cron.
 *
 * Usage:
 *   npx tsx scripts/team-profile-seed.ts --limit=5 --dry-run
 *   npx tsx scripts/team-profile-seed.ts --limit=10 --commit
 *
 * Budget: ~$0.02/profile at gpt-4o pricing (~600 input + ~400 output
 * tokens). Default --limit=10 → ~$0.20.
 */
import prisma from '../lib/db'
import { generateTeamProfile, type TeamProfileInputs } from '../lib/team-stats/profile-prompt'

;(async () => {
  const commit = process.argv.includes('--commit')
  const limitArg = process.argv.find(a => a.startsWith('--limit='))
  const limit = limitArg ? parseInt(limitArg.slice('--limit='.length), 10) || 10 : 10

  console.log(`\nTeam Profile Seed · limit=${limit} · ${commit ? '🔴 COMMIT' : '🟡 DRY-RUN'}\n`)

  const teams = await prisma.teamStats.findMany({
    where: { isActive: true, hasUpcoming: true },
    orderBy: { matchesPlayed: 'desc' },
    take: limit,
  })

  // Skip teams that already have a profile
  const existing = await prisma.teamProfile.findMany({
    where: { slug: { in: teams.map(t => t.slug) } },
    select: { slug: true },
  })
  const have = new Set(existing.map(e => e.slug))
  const todo = teams.filter(t => !have.has(t.slug))

  console.log(`Candidate teams: ${teams.length} · already have profile: ${have.size} · to generate: ${todo.length}`)
  for (const t of todo) {
    console.log(`  ${t.slug.padEnd(30)} · ${t.league?.padEnd(20).slice(0, 20)} · ${t.matchesPlayed}mp`)
  }

  if (!commit) {
    console.log('\n🟡 DRY-RUN — pass --commit to actually generate.')
    await prisma.$disconnect()
    process.exit(0)
  }

  let generated = 0
  let errors = 0
  for (const t of todo) {
    try {
      const h2h = (t.h2hGrid as Array<{ opponent: string; wins: number; draws: number; losses: number }>) || []
      const inputs: TeamProfileInputs = {
        name: t.name,
        league: t.league,
        country: t.country,
        matchesPlayed: t.matchesPlayed,
        wins: t.wins,
        draws: t.draws,
        losses: t.losses,
        goalsFor: t.goalsFor,
        goalsAgainst: t.goalsAgainst,
        bttsCount: t.bttsCount,
        over25Count: t.over25Count,
        formLast10: t.formLast10,
        v1ModelAccuracy: t.v1ModelAccuracy ? Number(t.v1ModelAccuracy) : null,
        v1ModelSampleN: t.v1ModelSampleN,
        v3ModelAccuracy: t.v3ModelAccuracy ? Number(t.v3ModelAccuracy) : null,
        v3ModelSampleN: t.v3ModelSampleN,
        recommendedModel: (t.recommendedModel as 'v1' | 'v3' | null),
        h2hTopOpponents: h2h.slice(0, 5).map(o => ({
          opponent: o.opponent, wins: o.wins, draws: o.draws, losses: o.losses,
        })),
      }

      const result = await generateTeamProfile(inputs)
      const refreshedAt = new Date()
      const refreshDueAt = new Date(refreshedAt.getTime() + 90 * 86400 * 1000)
      await prisma.teamProfile.upsert({
        where: { slug: t.slug },
        create: {
          slug: t.slug,
          externalTeamId: t.externalTeamId,
          profileHtml: result.html,
          prompt: result.prompt,
          modelUsed: 'gpt-4o',
          refreshedAt,
          refreshDueAt,
          version: 1,
        },
        update: {
          profileHtml: result.html,
          prompt: result.prompt,
          refreshedAt,
          refreshDueAt,
          version: { increment: 1 },
        },
      })
      generated++
      console.log(`  ✓ ${t.slug} (${result.cached ? 'cached' : 'fresh'})`)
    } catch (e) {
      errors++
      console.error(`  ✗ ${t.slug}:`, e instanceof Error ? e.message : e)
    }
  }

  console.log(`\nGenerated ${generated} · Errors ${errors}\n`)
  await prisma.$disconnect()
  process.exit(0)
})()
