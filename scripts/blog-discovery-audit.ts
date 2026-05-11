/**
 * Diagnose why fresh blogs (last 7d) have a median of 0 views.
 *
 * Hypotheses tested:
 *   H1. Blogs publish with isPublished=false and never get flipped (no traffic possible)
 *   H2. Blogs publish with future publishedAt (not yet visible to public list)
 *   H3. Blogs publish but aren't featured + don't appear on /blog index (only via direct URL)
 *   H4. Blogs have orphan slug (no internal link from anywhere)
 *   H5. Blogs are linked to MarketMatch that's already FINISHED (no traffic on past matches)
 *   H6. New blogs are buried in pagination (>20 newer ones each day)
 *
 * Run with:
 *   npx tsx scripts/blog-discovery-audit.ts
 */

import prisma from '../lib/db'

;(async () => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400 * 1000)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400 * 1000)
  const now = new Date()

  // Pull recent blogs with their related match status
  const recent = await prisma.blogPost.findMany({
    where: { isActive: true, createdAt: { gte: sevenDaysAgo } },
    include: { marketMatch: { select: { status: true, kickoffDate: true, league: true } } },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`\nDISCOVERY AUDIT — last 7 days (${recent.length} blogs)\n`)
  if (recent.length === 0) {
    console.log('No blogs created in the last 7 days.')
    await prisma.$disconnect()
    return
  }

  // Headline stats
  const withViews = recent.filter(b => b.viewCount > 0).length
  const zeroViews = recent.length - withViews
  console.log(`Recent blogs with ≥1 view:  ${withViews}/${recent.length}`)
  console.log(`Recent blogs with 0 views:  ${zeroViews}/${recent.length}\n`)

  // ── H1: Unpublished?
  const unpublished = recent.filter(b => !b.isPublished)
  console.log(`H1 — Created but never published (isPublished=false): ${unpublished.length}`)
  if (unpublished.length > 0) {
    console.log('   Sample 3:')
    for (const b of unpublished.slice(0, 3)) {
      console.log(`     "${b.title.slice(0, 60)}" — created ${b.createdAt.toISOString().slice(0, 10)}`)
    }
  }

  // ── H2: Future publishedAt?
  const future = recent.filter(b => b.publishedAt && new Date(b.publishedAt) > now)
  console.log(`\nH2 — publishedAt is in the future: ${future.length}`)
  if (future.length > 0) {
    for (const b of future.slice(0, 3)) {
      console.log(`     "${b.title.slice(0, 60)}" — publishedAt=${new Date(b.publishedAt!).toISOString().slice(0, 16)}`)
    }
  }

  // ── H5: Linked to FINISHED match?
  const finishedLinked = recent.filter(b => b.marketMatch?.status === 'FINISHED')
  const liveLinked = recent.filter(b => b.marketMatch?.status === 'LIVE')
  const upcomingLinked = recent.filter(b => b.marketMatch?.status === 'UPCOMING')
  const noMatch = recent.filter(b => !b.marketMatch)
  console.log(`\nH5 — Match-link status for recent blogs:`)
  console.log(`   no marketMatch:            ${noMatch.length}`)
  console.log(`   linked to UPCOMING match:  ${upcomingLinked.length}`)
  console.log(`   linked to LIVE match:      ${liveLinked.length}`)
  console.log(`   linked to FINISHED match:  ${finishedLinked.length}   ← these won't pull traffic`)

  // ── H6: How many blogs created per day?
  console.log(`\nH6 — Daily publish volume (last 7d):`)
  const byDay = new Map<string, number>()
  for (const b of recent) {
    const day = b.createdAt.toISOString().slice(0, 10)
    byDay.set(day, (byDay.get(day) || 0) + 1)
  }
  for (const [day, n] of Array.from(byDay.entries()).sort()) {
    console.log(`   ${day}: ${n} blogs`)
  }
  console.log(`   (If we publish 30+/day, today's blogs are buried in pagination by tomorrow.)`)

  // ── Cross-reference: recent zero-view blogs grouped by linked match status ──
  console.log(`\nZero-view recent blogs broken down:`)
  const zeroByStatus = {
    noMatch: 0,
    upcoming: 0,
    live: 0,
    finished: 0,
    unpublished: 0,
    future: 0,
  }
  for (const b of recent) {
    if (b.viewCount > 0) continue
    if (!b.isPublished) zeroByStatus.unpublished++
    else if (b.publishedAt && new Date(b.publishedAt) > now) zeroByStatus.future++
    else if (b.marketMatch?.status === 'FINISHED') zeroByStatus.finished++
    else if (b.marketMatch?.status === 'LIVE') zeroByStatus.live++
    else if (b.marketMatch?.status === 'UPCOMING') zeroByStatus.upcoming++
    else zeroByStatus.noMatch++
  }
  for (const [k, n] of Object.entries(zeroByStatus)) {
    if (n > 0) console.log(`   ${k.padEnd(14)} ${n}`)
  }

  // ── Compare against 7-30d cohort (a baseline that had time to accumulate) ──
  const olderCohort = await prisma.blogPost.findMany({
    where: { isActive: true, createdAt: { gte: thirtyDaysAgo, lt: sevenDaysAgo } },
    select: { viewCount: true, marketMatch: { select: { status: true } } },
  })
  if (olderCohort.length) {
    const olderWithViews = olderCohort.filter(b => b.viewCount > 0).length
    const olderMedian = (() => {
      const sorted = [...olderCohort].sort((a, b) => a.viewCount - b.viewCount)
      return sorted[Math.floor(sorted.length / 2)]?.viewCount ?? 0
    })()
    console.log(`\nBaseline 7-30d cohort: ${olderCohort.length} blogs`)
    console.log(`   with ≥1 view:  ${olderWithViews} (${Math.round((olderWithViews / olderCohort.length) * 100)}%)`)
    console.log(`   median views:  ${olderMedian}`)
  }

  // ── Summary verdict ──
  console.log(`\n══════════════ DIAGNOSIS ══════════════`)
  const finishedPct = recent.length ? (finishedLinked.length / recent.length) * 100 : 0
  const unpubPct = recent.length ? (unpublished.length / recent.length) * 100 : 0
  if (finishedPct > 50) {
    console.log(`✗ ${finishedPct.toFixed(0)}% of recent blogs are linked to FINISHED matches. The blog-generation`)
    console.log(`  cron may be writing blogs after matches end. They have no SEO value because the`)
    console.log(`  query "X vs Y prediction" is dead post-game. FIX: only generate for UPCOMING matches.`)
  }
  if (unpubPct > 20) {
    console.log(`✗ ${unpubPct.toFixed(0)}% of recent blogs are unpublished. Auto-publish may be broken or`)
    console.log(`  manual review is bottlenecking. Investigate /api/admin/template-blogs/scheduled.`)
  }
  if (zeroViews / recent.length > 0.7) {
    const dailyAvg = recent.length / 7
    console.log(`✗ ${Math.round((zeroViews / recent.length) * 100)}% of recent blogs have 0 views, averaging ${dailyAvg.toFixed(0)}/day created.`)
    console.log(`  If most are linked to UPCOMING matches but still get 0 views, the issue is`)
    console.log(`  discovery: blogs aren't being indexed before the match kicks off, or aren't`)
    console.log(`  appearing in the /blog list, or have no internal link from the match-detail page.`)
  }

  await prisma.$disconnect()
})()
