/**
 * Read-only audit of the user-behavior data we already have. Surfaces
 * insights for the friction-analysis plan (2026-05-15) before we ship
 * Tier 1 instrumentation.
 *
 * Pulls from:
 *   - User table (counters, dates, plan)
 *   - NewsletterEvent / TrackerEvent (event funnels)
 *   - BlogPost (view/share/CTA counters)
 *   - EmailLog (verification cadence proxy)
 */
import prisma from '../lib/db'

const now = new Date()
const d30 = new Date(now.getTime() - 30 * 86400 * 1000)
const d90 = new Date(now.getTime() - 90 * 86400 * 1000)
const d7 = new Date(now.getTime() - 7 * 86400 * 1000)

function pct(n: number, d: number): string {
  if (d <= 0) return '—'
  return `${((n / d) * 100).toFixed(1)}%`
}

;(async () => {
  console.log('\n══════════════════════════════════════════════════════════')
  console.log(' User Behavior Audit — what the existing data tells us')
  console.log('══════════════════════════════════════════════════════════\n')

  // ── 1. Overall user counts + funnel ───────────────────────────────
  console.log('PART 1 · OVERALL USER COUNTS\n')

  const totalUsers = await prisma.user.count()
  const verified = await prisma.user.count({ where: { emailVerified: true } })
  const everPaid = await prisma.user.count({ where: { firstPaidAt: { not: null } } })
  const activeSub = await prisma.user.count({
    where: {
      subscriptionPlan: { not: 'free' },
      subscriptionExpiresAt: { gt: now },
    },
  })
  const churned = await prisma.user.count({
    where: {
      firstPaidAt: { not: null },
      OR: [
        { subscriptionPlan: 'free' },
        { subscriptionExpiresAt: { lte: now } },
      ],
    },
  })
  const admins = await prisma.user.count({ where: { role: 'admin' } })

  console.log(`  Total users:                ${totalUsers}`)
  console.log(`  Email verified:             ${verified}  (${pct(verified, totalUsers)})`)
  console.log(`  Ever paid (firstPaidAt set): ${everPaid}  (${pct(everPaid, totalUsers)})`)
  console.log(`  Active paid subscription:   ${activeSub}  (${pct(activeSub, totalUsers)})`)
  console.log(`  Churned (paid then dropped): ${churned}`)
  console.log(`  Admins:                     ${admins}`)

  // ── 2. Signups over time ──────────────────────────────────────────
  console.log('\nPART 2 · SIGNUP CADENCE\n')

  const signups30 = await prisma.user.count({ where: { createdAt: { gte: d30 } } })
  const signups7 = await prisma.user.count({ where: { createdAt: { gte: d7 } } })
  const signups90 = await prisma.user.count({ where: { createdAt: { gte: d90 } } })

  console.log(`  Last 7d:   ${signups7}  · avg ${(signups7 / 7).toFixed(1)}/day`)
  console.log(`  Last 30d:  ${signups30} · avg ${(signups30 / 30).toFixed(1)}/day`)
  console.log(`  Last 90d:  ${signups90} · avg ${(signups90 / 90).toFixed(1)}/day`)

  // Daily distribution of last 30 days
  const recentSignups = await prisma.user.findMany({
    where: { createdAt: { gte: d30 } },
    select: { createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  const byDay = new Map<string, number>()
  for (const u of recentSignups) {
    const day = u.createdAt.toISOString().slice(0, 10)
    byDay.set(day, (byDay.get(day) || 0) + 1)
  }
  const sortedDays = [...byDay.entries()].sort()
  if (sortedDays.length > 0) {
    const peak = sortedDays.reduce((max, [, n]) => Math.max(max, n), 0)
    const median = [...byDay.values()].sort((a, b) => a - b)[Math.floor(byDay.size / 2)] || 0
    console.log(`  Peak day:  ${peak} signups`)
    console.log(`  Median:    ${median} signups/day`)
    console.log(`  Zero-signup days in window: ${30 - byDay.size}`)
  }

  // ── 3. Source attribution ─────────────────────────────────────────
  console.log('\nPART 3 · SIGNUP SOURCE ATTRIBUTION\n')

  const bySource = await prisma.user.groupBy({
    by: ['signupSource'],
    _count: { _all: true },
    where: { createdAt: { gte: d90 } },
    orderBy: { _count: { id: 'desc' } },
    take: 15,
  })
  console.log(`  Signups (90d) by source:`)
  for (const s of bySource) {
    const label = s.signupSource ?? '(null — no source param)'
    console.log(`    ${label.padEnd(30).slice(0, 30)}  ${s._count._all}`)
  }
  const nullSource = bySource.find(s => s.signupSource === null)?._count._all ?? 0
  console.log(`  \n  Direct/untracked (null source): ${nullSource} / ${signups90} (${pct(nullSource, signups90)})`)

  // ── 4. Source → paid conversion ───────────────────────────────────
  console.log('\nPART 4 · SOURCE → PAID CONVERSION (90d cohort)\n')

  const paidBySource = await prisma.user.groupBy({
    by: ['signupSource'],
    where: {
      createdAt: { gte: d90 },
      firstPaidAt: { not: null },
    },
    _count: { _all: true },
  })
  const paidBySrcMap = new Map(paidBySource.map(s => [s.signupSource ?? '__null__', s._count._all]))
  console.log(`  Source                           signups  paid   conv  ARPU`)
  for (const s of bySource) {
    const key = s.signupSource ?? '__null__'
    const paid = paidBySrcMap.get(key) ?? 0
    const label = s.signupSource ?? '(null)'
    // Compute ARPU for this source
    const arpu = await prisma.user.aggregate({
      where: { signupSource: s.signupSource, createdAt: { gte: d90 } },
      _avg: { lifetimeValue: true },
    })
    const arpuVal = arpu._avg.lifetimeValue ? Number(arpu._avg.lifetimeValue).toFixed(2) : '0.00'
    console.log(`    ${label.padEnd(32).slice(0, 32)} ${s._count._all.toString().padStart(7)}  ${paid.toString().padStart(4)}  ${pct(paid, s._count._all).padStart(5)}  $${arpuVal}`)
  }

  // ── 5. Verification rate over time ───────────────────────────────
  console.log('\nPART 5 · EMAIL VERIFICATION RATES\n')

  const cohorts = [
    { label: 'Last 7d',  start: d7 },
    { label: 'Last 30d', start: d30 },
    { label: 'Last 90d', start: d90 },
  ]
  for (const c of cohorts) {
    const total = await prisma.user.count({ where: { createdAt: { gte: c.start } } })
    const v = await prisma.user.count({
      where: { createdAt: { gte: c.start }, emailVerified: true },
    })
    console.log(`  ${c.label.padEnd(10)}: ${v} / ${total} verified  (${pct(v, total)})`)
  }

  // ── 6. Days from signup to first payment ──────────────────────────
  console.log('\nPART 6 · TIME-TO-FIRST-PURCHASE DISTRIBUTION\n')

  const paid = await prisma.user.findMany({
    where: { firstPaidAt: { not: null } },
    select: { createdAt: true, firstPaidAt: true, signupSource: true },
  })
  if (paid.length === 0) {
    console.log('  No paid users yet.')
  } else {
    const daysToFirstPaid = paid.map(u => (u.firstPaidAt!.getTime() - u.createdAt.getTime()) / 86400000)
    daysToFirstPaid.sort((a, b) => a - b)
    const buckets = { sameDay: 0, oneDay: 0, oneWeek: 0, oneMonth: 0, threeMonth: 0, longer: 0 }
    for (const d of daysToFirstPaid) {
      if (d < 1) buckets.sameDay++
      else if (d < 2) buckets.oneDay++
      else if (d < 8) buckets.oneWeek++
      else if (d < 31) buckets.oneMonth++
      else if (d < 91) buckets.threeMonth++
      else buckets.longer++
    }
    const median = daysToFirstPaid[Math.floor(daysToFirstPaid.length / 2)]
    const mean = daysToFirstPaid.reduce((a, b) => a + b, 0) / daysToFirstPaid.length
    console.log(`  Paid users total:    ${paid.length}`)
    console.log(`  Median days:         ${median.toFixed(1)}`)
    console.log(`  Mean days:           ${mean.toFixed(1)}`)
    console.log(`  Same day (<1d):       ${buckets.sameDay}  (${pct(buckets.sameDay, paid.length)})`)
    console.log(`  Day 1-2:              ${buckets.oneDay}  (${pct(buckets.oneDay, paid.length)})`)
    console.log(`  Week 1 (2-7d):        ${buckets.oneWeek}  (${pct(buckets.oneWeek, paid.length)})`)
    console.log(`  Month 1 (8-30d):      ${buckets.oneMonth}  (${pct(buckets.oneMonth, paid.length)})`)
    console.log(`  Quarter (31-90d):     ${buckets.threeMonth}  (${pct(buckets.threeMonth, paid.length)})`)
    console.log(`  Long tail (>90d):     ${buckets.longer}  (${pct(buckets.longer, paid.length)})`)
  }

  // ── 7. Login return cadence ───────────────────────────────────────
  console.log('\nPART 7 · USER RETURN CADENCE (lastLoginAt)\n')

  const neverLoggedIn = await prisma.user.count({ where: { lastLoginAt: null } })
  const loginToday = await prisma.user.count({ where: { lastLoginAt: { gte: d7 } } })
  const login30 = await prisma.user.count({ where: { lastLoginAt: { gte: d30 } } })
  console.log(`  Never logged in (after signup):  ${neverLoggedIn}  (${pct(neverLoggedIn, totalUsers)})`)
  console.log(`  Logged in last 7d:               ${loginToday}  (${pct(loginToday, totalUsers)})`)
  console.log(`  Logged in last 30d:              ${login30}  (${pct(login30, totalUsers)})`)

  // Day-1 retention: signed up in last 30d AND logged in at least once after
  const day1Cohort = await prisma.user.count({
    where: {
      createdAt: { gte: d30, lt: d7 },  // signed up 7-30d ago
      lastLoginAt: { not: null },
    },
  })
  const day1Total = await prisma.user.count({
    where: { createdAt: { gte: d30, lt: d7 } },
  })
  console.log(`  Day 7+ retention (signed up 7-30d ago + has logged in again): ${day1Cohort}/${day1Total} (${pct(day1Cohort, day1Total)})`)

  // ── 8. Country distribution ──────────────────────────────────────
  console.log('\nPART 8 · COUNTRY DISTRIBUTION\n')

  const byCountry = await prisma.$queryRaw<Array<{ country_code: string | null; cnt: bigint }>>`
    SELECT c."code" AS country_code, COUNT(u.id)::bigint AS cnt
    FROM "User" u
    LEFT JOIN "Country" c ON c.id = u."countryId"
    GROUP BY c."code"
    ORDER BY cnt DESC
    LIMIT 12
  `
  console.log(`  Top countries by signup count:`)
  for (const r of byCountry) {
    console.log(`    ${(r.country_code ?? '(null)').padEnd(6)}  ${Number(r.cnt)}`)
  }

  // ── 9. Newsletter funnel (last 30d) ───────────────────────────────
  console.log('\nPART 9 · NEWSLETTER FUNNEL (last 30d)\n')

  const nlEvents = await prisma.newsletterEvent.groupBy({
    by: ['type', 'source'],
    where: { createdAt: { gte: d30 } },
    _count: { _all: true },
  })
  const popup = { impression: 0, dismiss: 0, subscribe: 0 }
  const staticW = { impression: 0, dismiss: 0, subscribe: 0 }
  for (const e of nlEvents) {
    const bucket = e.source === 'popup' ? popup : e.source === 'static_widget' ? staticW : null
    if (!bucket) continue
    if (e.type === 'impression') bucket.impression = e._count._all
    else if (e.type === 'dismiss') bucket.dismiss = e._count._all
    else if (e.type === 'subscribe') bucket.subscribe = e._count._all
  }
  console.log(`  Popup:   ${popup.impression} impressions · ${popup.dismiss} dismisses (${pct(popup.dismiss, popup.impression)}) · ${popup.subscribe} subscribes (${pct(popup.subscribe, popup.impression)})`)
  console.log(`  Static:  ${staticW.impression} impressions · ${staticW.subscribe} subscribes (static doesn't fire impression events historically)`)

  // ── 10. Tracker card funnel (last 30d) ───────────────────────────
  console.log('\nPART 10 · PREMIUM TRACKER CARD FUNNEL (last 30d)\n')

  const trkEvents = await prisma.trackerEvent.groupBy({
    by: ['type'],
    where: { createdAt: { gte: d30 } },
    _count: { _all: true },
  })
  const trk = { impression: 0, cta_click_picks: 0, cta_click_audit: 0, soccer_hub: 0 }
  for (const e of trkEvents) {
    if (e.type === 'impression') trk.impression = e._count._all
    else if (e.type === 'cta_click_picks') trk.cta_click_picks = e._count._all
    else if (e.type === 'cta_click_audit') trk.cta_click_audit = e._count._all
    else if (e.type === 'soccer_hub_impression') trk.soccer_hub = e._count._all
  }
  const trkClicks = trk.cta_click_picks + trk.cta_click_audit
  console.log(`  Tracker card impressions: ${trk.impression}`)
  console.log(`  CTA clicks to /matches:    ${trk.cta_click_picks}`)
  console.log(`  CTA clicks to /performance: ${trk.cta_click_audit}`)
  console.log(`  Total CTR:                ${pct(trkClicks, trk.impression)}`)
  console.log(`  Soccer hub impressions:    ${trk.soccer_hub}`)

  // ── 11. Blog engagement Pareto ────────────────────────────────────
  console.log('\nPART 11 · BLOG ENGAGEMENT PARETO (lifetime)\n')

  const blogs = await prisma.blogPost.findMany({
    where: { isActive: true, isPublished: true },
    select: { viewCount: true, shareCount: true, ctaClickCount: true },
  })
  const totalViews = blogs.reduce((s, b) => s + b.viewCount, 0)
  const totalShares = blogs.reduce((s, b) => s + b.shareCount, 0)
  const totalCtas = blogs.reduce((s, b) => s + b.ctaClickCount, 0)
  console.log(`  Active blogs:        ${blogs.length}`)
  console.log(`  Total views:         ${totalViews.toLocaleString()}`)
  console.log(`  Total shares:        ${totalShares}  (share/view: ${pct(totalShares, totalViews)})`)
  console.log(`  Total CTA clicks:    ${totalCtas}  (CTA/view: ${pct(totalCtas, totalViews)})`)
  const sortedViews = blogs.map(b => b.viewCount).sort((a, b) => b - a)
  const top10 = sortedViews.slice(0, 10).reduce((s, v) => s + v, 0)
  const top100 = sortedViews.slice(0, 100).reduce((s, v) => s + v, 0)
  console.log(`  Top 10 blogs:        ${top10.toLocaleString()} views (${pct(top10, totalViews)})`)
  console.log(`  Top 100 blogs:       ${top100.toLocaleString()} views (${pct(top100, totalViews)})`)
  const zero = sortedViews.filter(v => v === 0).length
  console.log(`  Zero-view blogs:     ${zero}  (${pct(zero, blogs.length)})`)

  // ── 12. Email log breakdown (last 30d) ────────────────────────────
  console.log('\nPART 12 · EMAILS SENT (last 30d)\n')

  const emailsByStatus = await prisma.emailLog.groupBy({
    by: ['status'],
    where: { sentAt: { gte: d30 } },
    _count: { _all: true },
  })
  for (const e of emailsByStatus) {
    console.log(`  ${e.status.padEnd(10)}  ${e._count._all}`)
  }

  console.log('\n══════════════════════════════════════════════════════════\n')
  await prisma.$disconnect()
})()
