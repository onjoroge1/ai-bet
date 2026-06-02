/**
 * Comprehensive audit of model+premium performance across all four sports.
 * Read-only. Powers the AI Council analysis (2026-05-15).
 *
 * Sections:
 *   A. Soccer model accuracy (V1, V3) per league + tier
 *   B. NBA model accuracy across all settled matches
 *   C. NHL model accuracy across all settled matches
 *   D. NCAAB model accuracy across all settled matches
 *   E. Premium pick tracker — what shipped to users, what it returned
 *   F. Premium-tier criteria: actual hit rate vs claimed gates
 *   G. Cross-sport comparison table
 */
import prisma from '../lib/db'

const PCT = (n: number, d: number) => d > 0 ? ((n / d) * 100).toFixed(1) + '%' : '—'

/** Read pick from soccer v1/v3 model OR multisport model.
 *  Mirrors engine logic at lib/premium-picks-engine.ts:397
 *  (`preds = model.predictions || model`) so we look inside `.predictions`
 *  first and fall back to top-level. */
function readPick(m: unknown): 'home' | 'away' | 'draw' | null {
  if (!m || typeof m !== 'object') return null
  const preds = (m as { predictions?: unknown }).predictions
  const src = (preds && typeof preds === 'object' ? preds : m) as { pick?: string }
  const p = src.pick
  if (typeof p !== 'string') return null
  const lo = p.toLowerCase()
  if (lo === 'home' || lo === 'h') return 'home'
  if (lo === 'away' || lo === 'a') return 'away'
  if (lo === 'draw' || lo === 'd') return 'draw'
  return null
}

/** Same lookup pattern as readPick — check `.predictions.confidence` first,
 *  fall back to top-level. */
function readConf(m: unknown): number | null {
  if (!m || typeof m !== 'object') return null
  const preds = (m as { predictions?: unknown }).predictions
  const src = (preds && typeof preds === 'object' ? preds : m) as { confidence?: number }
  const c = src.confidence
  return typeof c === 'number' ? c : null
}

function readOutcome(fr: unknown): 'home' | 'away' | 'draw' | null {
  if (typeof fr === 'string') {
    const up = fr.toUpperCase()
    if (up === 'H' || up === 'HOME') return 'home'
    if (up === 'A' || up === 'AWAY') return 'away'
    if (up === 'D' || up === 'DRAW') return 'draw'
    return null
  }
  if (!fr || typeof fr !== 'object') return null
  const obj = fr as { outcome?: string; score?: { home?: number; away?: number }; result?: string }
  const o = obj.outcome || obj.result
  if (o) {
    const lo = o.toLowerCase()
    if (lo === 'home' || lo === 'h') return 'home'
    if (lo === 'away' || lo === 'a') return 'away'
    if (lo === 'draw' || lo === 'd') return 'draw'
  }
  if (obj.score && typeof obj.score.home === 'number' && typeof obj.score.away === 'number') {
    if (obj.score.home > obj.score.away) return 'home'
    if (obj.score.away > obj.score.home) return 'away'
    return 'draw'
  }
  return null
}

;(async () => {
  console.log('\n══════════════════════════════════════════════════════════════════')
  console.log(' FULL-SPORT PERFORMANCE AUDIT — soccer · NBA · NHL · NCAAB')
  console.log('══════════════════════════════════════════════════════════════════\n')

  const now = new Date()
  const d90 = new Date(now.getTime() - 90 * 86400 * 1000)

  // ────────────────────────────────────────────────────────────────────
  // PART A · SOCCER — V1 / V3 accuracy across all finished matches 90d
  // ────────────────────────────────────────────────────────────────────
  console.log('PART A · SOCCER MODEL ACCURACY (last 90d, all leagues)\n')

  const soccerFinished = await prisma.marketMatch.findMany({
    where: {
      status: 'FINISHED',
      isActive: true,
      kickoffDate: { gte: d90 },
      finalResult: { not: { equals: null as unknown as object } },
    },
    select: { league: true, v1Model: true, v3Model: true, finalResult: true },
    take: 5000,
  })
  console.log(`  Finished soccer matches with finalResult: ${soccerFinished.length}`)

  let v1Hit = 0, v1N = 0, v3Hit = 0, v3N = 0
  // Per-confidence-band buckets
  const v3Buckets: Record<string, { hit: number; n: number }> = {
    '≥50%': { hit: 0, n: 0 },
    '≥55%': { hit: 0, n: 0 },
    '≥60%': { hit: 0, n: 0 },
    '≥65%': { hit: 0, n: 0 },
    '≥70%': { hit: 0, n: 0 },
  }
  // Per-league counts
  const byLeague: Record<string, { v1Hit: number; v1N: number; v3Hit: number; v3N: number }> = {}

  for (const m of soccerFinished) {
    const outcome = readOutcome(m.finalResult)
    if (!outcome) continue
    const v1Pick = readPick(m.v1Model)
    const v3Pick = readPick(m.v3Model)
    const v3Conf = readConf(m.v3Model) ?? 0
    const lg = m.league || '(unknown)'
    if (!byLeague[lg]) byLeague[lg] = { v1Hit: 0, v1N: 0, v3Hit: 0, v3N: 0 }
    if (v1Pick) { v1N++; byLeague[lg].v1N++; if (v1Pick === outcome) { v1Hit++; byLeague[lg].v1Hit++ } }
    if (v3Pick) {
      v3N++; byLeague[lg].v3N++; if (v3Pick === outcome) { v3Hit++; byLeague[lg].v3Hit++ }
      for (const [label, threshold] of [['≥50%', 0.50], ['≥55%', 0.55], ['≥60%', 0.60], ['≥65%', 0.65], ['≥70%', 0.70]] as const) {
        if (v3Conf >= threshold) {
          v3Buckets[label].n++
          if (v3Pick === outcome) v3Buckets[label].hit++
        }
      }
    }
  }

  console.log(`  V1 model overall:  ${v1Hit}/${v1N}  (${PCT(v1Hit, v1N)})`)
  console.log(`  V3 model overall:  ${v3Hit}/${v3N}  (${PCT(v3Hit, v3N)})`)
  console.log(`\n  V3 by confidence band:`)
  for (const [label, b] of Object.entries(v3Buckets)) {
    console.log(`    ${label}:  ${b.hit}/${b.n}  (${PCT(b.hit, b.n)})`)
  }

  // Top leagues by n (V3)
  const lgRows = Object.entries(byLeague)
    .filter(([, v]) => v.v3N >= 20)
    .sort((a, b) => b[1].v3N - a[1].v3N)
    .slice(0, 15)
  console.log(`\n  Top leagues (V3 n ≥ 20):`)
  for (const [lg, v] of lgRows) {
    const v1pc = PCT(v.v1Hit, v.v1N).padStart(7)
    const v3pc = PCT(v.v3Hit, v.v3N).padStart(7)
    console.log(`    ${lg.padEnd(30).slice(0, 30)}  V1 ${v1pc} (n=${v.v1N.toString().padStart(3)})  V3 ${v3pc} (n=${v.v3N.toString().padStart(3)})`)
  }

  // ────────────────────────────────────────────────────────────────────
  // PART B-D · NBA / NHL / NCAAB
  // ────────────────────────────────────────────────────────────────────
  const sports = [
    { key: 'basketball_nba', label: 'NBA',   gates: [0.60, 0.70, 0.75, 0.80] },
    { key: 'icehockey_nhl',  label: 'NHL',   gates: [0.55, 0.65, 0.75, 0.85] },
    { key: 'basketball_ncaab', label: 'NCAAB', gates: [0.60, 0.70, 0.75, 0.80] },
  ]

  for (const sport of sports) {
    console.log(`\n\nPART · ${sport.label} MODEL ACCURACY (all settled)\n`)
    const finished = await prisma.multisportMatch.findMany({
      where: { sport: sport.key, status: 'finished', finalResult: { not: { equals: null as unknown as object } } },
      select: { model: true, finalResult: true },
      take: 5000,
    })
    let hit = 0, n = 0
    const buckets: Record<string, { hit: number; n: number }> = {}
    for (const g of sport.gates) buckets[`≥${(g * 100).toFixed(0)}%`] = { hit: 0, n: 0 }
    for (const m of finished) {
      const outcome = readOutcome(m.finalResult)
      if (!outcome) continue
      const pick = readPick(m.model)
      const conf = readConf(m.model) ?? 0
      if (!pick) continue
      n++
      if (pick === outcome) hit++
      for (const g of sport.gates) {
        if (conf >= g) {
          const key = `≥${(g * 100).toFixed(0)}%`
          buckets[key].n++
          if (pick === outcome) buckets[key].hit++
        }
      }
    }
    console.log(`  ${sport.label} overall:  ${hit}/${n}  (${PCT(hit, n)})`)
    console.log(`  By confidence band:`)
    for (const [label, b] of Object.entries(buckets)) {
      console.log(`    ${label}:  ${b.hit}/${b.n}  (${PCT(b.hit, b.n)})`)
    }
  }

  // ────────────────────────────────────────────────────────────────────
  // PART E · PREMIUM PICK TRACKER — what shipped, what it returned
  // ────────────────────────────────────────────────────────────────────
  console.log('\n\nPART E · PREMIUM PICK TRACKER (PremiumPickHistory)\n')

  const allTracker = await prisma.premiumPickHistory.findMany({
    select: {
      sport: true, tier: true, league: true, result: true,
      oddsAtPublish: true, netDollars: true, surfacedBy: true,
    },
  })
  type B = { n: number; w: number; l: number; net: number; stake: number; oddsSum: number }
  const groupKey = (sport: string, tier: string) => `${sport}/${tier}`
  const byGrp: Record<string, B> = {}
  for (const r of allTracker) {
    if (r.result !== 'win' && r.result !== 'loss') continue
    const key = groupKey(r.sport, r.tier)
    if (!byGrp[key]) byGrp[key] = { n: 0, w: 0, l: 0, net: 0, stake: 0, oddsSum: 0 }
    byGrp[key].n++
    if (r.result === 'win') byGrp[key].w++
    else byGrp[key].l++
    byGrp[key].net += r.netDollars !== null ? Number(r.netDollars) : 0
    byGrp[key].stake += 100  // hard-coded stake convention
    byGrp[key].oddsSum += Number(r.oddsAtPublish)
  }
  console.log(`  group                         n    W- L    hit%    avg odds   net $        ROI`)
  for (const [k, b] of Object.entries(byGrp).sort()) {
    const avgOdds = (b.oddsSum / b.n).toFixed(2)
    const roi = (b.net / b.stake * 100).toFixed(1)
    console.log(`  ${k.padEnd(28)} ${b.n.toString().padStart(4)}  ${b.w.toString().padStart(2)}-${b.l.toString().padStart(2)}   ${PCT(b.w, b.n).padStart(5)}    ${avgOdds.padStart(5)}    ${b.net >= 0 ? '+' : ''}${b.net.toFixed(0).padStart(7)}   ${b.net >= 0 ? '+' : ''}${roi}%`)
  }

  // Surfaced-by mix
  const bySurfaced = await prisma.premiumPickHistory.groupBy({
    by: ['surfacedBy'],
    _count: { _all: true },
  })
  console.log(`\n  Surfacing source: ${bySurfaced.map(s => `${s.surfacedBy}=${s._count._all}`).join(', ')}`)

  // ────────────────────────────────────────────────────────────────────
  // PART F · PREMIUM CRITERIA — claimed vs measured
  // ────────────────────────────────────────────────────────────────────
  console.log('\n\nPART F · CLAIMED PREMIUM CRITERIA vs MEASURED ACCURACY\n')
  console.log(`  Claimed (per lib/premium-picks-engine.ts):`)
  console.log(`    Soccer V3 ≥60%       → ~71% hit (per claim)`)
  console.log(`    NBA  conf ≥80%       → ~79%`)
  console.log(`    NHL  conf ≥85%       → conservative`)
  console.log(`    NCAAB conf ≥75%      → ~73%`)
  console.log(`\n  Measured (from current DB):`)
  console.log(`    Soccer V3 ≥60%:  ${v3Buckets['≥60%'].hit}/${v3Buckets['≥60%'].n}  (${PCT(v3Buckets['≥60%'].hit, v3Buckets['≥60%'].n)})`)
  console.log(`    Soccer V3 ≥65%:  ${v3Buckets['≥65%'].hit}/${v3Buckets['≥65%'].n}  (${PCT(v3Buckets['≥65%'].hit, v3Buckets['≥65%'].n)})`)
  console.log(`    Soccer V3 ≥70%:  ${v3Buckets['≥70%'].hit}/${v3Buckets['≥70%'].n}  (${PCT(v3Buckets['≥70%'].hit, v3Buckets['≥70%'].n)})`)

  // ────────────────────────────────────────────────────────────────────
  // PART G · CROSS-SPORT VOLUME + ROI SUMMARY
  // ────────────────────────────────────────────────────────────────────
  console.log('\n\nPART G · CROSS-SPORT SUMMARY\n')

  const upcoming = await Promise.all([
    prisma.marketMatch.count({ where: { status: 'UPCOMING', isActive: true, kickoffDate: { gte: now, lte: new Date(now.getTime() + 7 * 86400 * 1000) } } }),
    prisma.multisportMatch.count({ where: { sport: 'basketball_nba', status: 'upcoming', commenceTime: { gte: now, lte: new Date(now.getTime() + 7 * 86400 * 1000) } } }),
    prisma.multisportMatch.count({ where: { sport: 'icehockey_nhl', status: 'upcoming', commenceTime: { gte: now, lte: new Date(now.getTime() + 7 * 86400 * 1000) } } }),
    prisma.multisportMatch.count({ where: { sport: 'basketball_ncaab', status: 'upcoming', commenceTime: { gte: now, lte: new Date(now.getTime() + 7 * 86400 * 1000) } } }),
  ])
  console.log(`  Upcoming fixtures (next 7d):`)
  console.log(`    Soccer:  ${upcoming[0]}`)
  console.log(`    NBA:     ${upcoming[1]}`)
  console.log(`    NHL:     ${upcoming[2]}`)
  console.log(`    NCAAB:   ${upcoming[3]}`)

  // Premium pick rate (soccer) — what fraction of 90d settled hit V3 ≥60%?
  const totalSoccer90d = soccerFinished.length
  const v3HighConf = v3Buckets['≥60%'].n
  console.log(`\n  Soccer 90d: ${totalSoccer90d} settled · ${v3HighConf} (${PCT(v3HighConf, totalSoccer90d)}) hit premium gate (V3 ≥60%)`)
  console.log(`  Premium-pick yield: ~${(v3HighConf / 90).toFixed(2)} per day across all soccer`)

  // Tracker coverage: what % of premium-eligible soccer ≥60% was actually captured by PremiumPickHistory?
  const premiumCaptured = allTracker.filter(t => t.sport === 'soccer' && t.tier === 'premium').length
  console.log(`  Premium captured in tracker: ${premiumCaptured}`)
  console.log(`  Capture-rate gap: ${v3HighConf} eligible vs ${premiumCaptured} captured`)

  console.log('\n══════════════════════════════════════════════════════════════════\n')
  await prisma.$disconnect()
})()
