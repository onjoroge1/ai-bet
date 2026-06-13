/**
 * Surface writable, data-grounded World Cup blog ideas from current fixtures.
 * Read-only. Run: `npx tsx scripts/wc-blog-ideas.ts [--json]`
 *
 * Each idea is ranked by data strength and carries the concrete numbers that
 * ground it plus an internet-search query for current-form enrichment. Feeds
 * the existing human-review blog flow — nothing auto-publishes.
 */
import prisma from '../lib/db'
import { wcFixtures } from '../lib/world-cup/data'
import { wcBlogIdeas } from '../lib/world-cup/blog-ideas'

;(async () => {
  const asJson = process.argv.includes('--json')
  const now = new Date()
  const fixtures = await wcFixtures({ take: 300 })
  const ideas = wcBlogIdeas(fixtures, now)

  if (asJson) {
    console.log(JSON.stringify(ideas, null, 2))
    await prisma.$disconnect()
    return
  }

  console.log('\n══════════════════════════════════════════════════════════════')
  console.log(`  World Cup blog ideas — ${ideas.length} angles from ${fixtures.length} fixtures`)
  console.log('══════════════════════════════════════════════════════════════\n')
  for (const idea of ideas) {
    console.log(`[${String(idea.priority).padStart(3)}] (${idea.category})  ${idea.title}`)
    console.log(`      ${idea.angle}`)
    console.log(`      Data:`)
    for (const h of idea.dataHooks) console.log(`        • ${h}`)
    console.log(`      🔎 Search: ${idea.searchQuery}`)
    console.log(`      🔗 ${idea.marketMatchIds.length} fixture(s) linkable`)
    console.log()
  }
  console.log('Tip: feed an idea + its data hooks into the blog generator, then')
  console.log('enrich with the search query before publishing (human review).\n')
  await prisma.$disconnect()
})()
