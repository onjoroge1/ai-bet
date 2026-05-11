/**
 * Reusable soccer-model insights.
 *
 * Runs against the live DB and prints per-model accuracy across multiple
 * cuts (overall, by outcome, by league, by confidence bucket). Use this to
 * spot whether models are working, where they shine, where they should be
 * de-prioritized in the picks engine.
 *
 * Run with:
 *   npx tsx scripts/soccer-model-insights.ts                # last 90d (default)
 *   npx tsx scripts/soccer-model-insights.ts --days 30      # custom window
 *   npx tsx scripts/soccer-model-insights.ts --days 7
 */

import prisma from '../lib/db'

type ModelKey = 'v1' | 'v2' | 'v3'

const norm = (s: any) => {
  const x = String(s ?? '').toLowerCase()
  if (x === 'h' || x === 'home_win') return 'home'
  if (x === 'a' || x === 'away_win') return 'away'
  if (x === 'd') return 'draw'
  return x
}

const DAYS_ARG = process.argv.indexOf('--days')
const DAYS = DAYS_ARG !== -1 ? Math.max(1, parseInt(process.argv[DAYS_ARG + 1], 10) || 90) : 90

function pickFor(m: any, key: ModelKey): string | null {
  const obj = m[`${key}Model`]
  if (!obj) return null
  return norm(obj?.pick)
}

function confidenceFor(m: any, key: ModelKey): number | null {
  const obj = m[`${key}Model`]
  if (!obj) return null
  const c = Number(obj?.confidence)
  if (!isFinite(c)) return null
  return c > 1 ? c / 100 : c
}

function actualFrom(m: any): string | null {
  const fr = m.finalResult as any
  if (!fr) return null
  return norm(fr?.outcome ?? fr?.result)
}

async function main() {
  console.log(`\nSOCCER MODEL INSIGHTS — last ${DAYS} days\n`)

  const matches = await prisma.marketMatch.findMany({
    where: {
      status: 'FINISHED',
      isActive: true,
      finalResult: { not: undefined as any },
      kickoffDate: { gte: new Date(Date.now() - DAYS * 86400 * 1000) },
    },
    select: {
      matchId: true, league: true, homeTeam: true, awayTeam: true,
      kickoffDate: true, finalResult: true,
      v1Model: true, v2Model: true, v3Model: true,
    },
  })

  console.log(`Finished soccer matches in window: ${matches.length}\n`)
  if (matches.length === 0) {
    await prisma.$disconnect()
    return
  }

  // ── 1. Overall accuracy + coverage ───────────────────────────
  console.log('1. OVERALL MODEL ACCURACY')
  console.log('-'.repeat(72))
  for (const k of ['v1', 'v2', 'v3'] as ModelKey[]) {
    let n = 0, c = 0
    for (const m of matches) {
      const pick = pickFor(m, k); const actual = actualFrom(m)
      if (!pick || !actual) continue
      n++; if (pick === actual) c++
    }
    const acc = n ? (c / n) * 100 : 0
    const cov = ((n / matches.length) * 100).toFixed(0)
    console.log(`  ${k.toUpperCase()}: ${c}/${n} = ${acc.toFixed(1)}%  (coverage ${cov}%)`)
  }

  // ── 2. Accuracy by actual outcome ────────────────────────────
  console.log('\n2. ACCURACY BY ACTUAL OUTCOME')
  console.log('-'.repeat(72))
  for (const k of ['v1', 'v2', 'v3'] as ModelKey[]) {
    const s = { home: { n: 0, c: 0 }, draw: { n: 0, c: 0 }, away: { n: 0, c: 0 } }
    for (const m of matches) {
      const pick = pickFor(m, k); const actual = actualFrom(m)
      if (!pick || !actual || !(actual in s)) continue
      const x = s[actual as keyof typeof s]
      x.n++; if (pick === actual) x.c++
    }
    const counts = Object.values(s).reduce((a, b) => a + b.n, 0)
    if (counts === 0) { console.log(`  ${k.toUpperCase()}: no data`); continue }
    console.log(`  ${k.toUpperCase()}:  home ${s.home.c}/${s.home.n} (${((s.home.c / Math.max(1, s.home.n)) * 100).toFixed(0)}%)   draw ${s.draw.c}/${s.draw.n} (${((s.draw.c / Math.max(1, s.draw.n)) * 100).toFixed(0)}%)   away ${s.away.c}/${s.away.n} (${((s.away.c / Math.max(1, s.away.n)) * 100).toFixed(0)}%)`)
  }

  // ── 3. Pick distribution vs actual ───────────────────────────
  console.log('\n3. PICK DISTRIBUTION vs ACTUAL')
  console.log('-'.repeat(72))
  for (const k of ['v1', 'v2', 'v3'] as ModelKey[]) {
    const d = { home: 0, draw: 0, away: 0 }
    for (const m of matches) {
      const p = pickFor(m, k); if (!p) continue
      if (p === 'home' || p === 'draw' || p === 'away') d[p]++
    }
    const t = d.home + d.draw + d.away
    if (t === 0) continue
    console.log(`  ${k.toUpperCase()}: home=${((d.home / t) * 100).toFixed(0)}%  draw=${((d.draw / t) * 100).toFixed(0)}%  away=${((d.away / t) * 100).toFixed(0)}%`)
  }
  const ad = { home: 0, draw: 0, away: 0 }
  for (const m of matches) {
    const a = actualFrom(m); if (a === 'home' || a === 'draw' || a === 'away') ad[a]++
  }
  const at = ad.home + ad.draw + ad.away
  console.log(`  ACTUAL: home=${((ad.home / at) * 100).toFixed(0)}%  draw=${((ad.draw / at) * 100).toFixed(0)}%  away=${((ad.away / at) * 100).toFixed(0)}%`)

  // ── 4. Confidence calibration ───────────────────────────────
  console.log('\n4. ACCURACY BY CONFIDENCE BUCKET')
  console.log('-'.repeat(72))
  for (const k of ['v1', 'v2', 'v3'] as ModelKey[]) {
    const b = { '<40': { n: 0, c: 0 }, '40-50': { n: 0, c: 0 }, '50-60': { n: 0, c: 0 }, '60-70': { n: 0, c: 0 }, '70-80': { n: 0, c: 0 }, '80+': { n: 0, c: 0 } }
    for (const m of matches) {
      const cf = confidenceFor(m, k); const pick = pickFor(m, k); const actual = actualFrom(m)
      if (cf == null || !pick || !actual) continue
      const pct = cf * 100
      let key: keyof typeof b
      if (pct < 40) key = '<40'
      else if (pct < 50) key = '40-50'
      else if (pct < 60) key = '50-60'
      else if (pct < 70) key = '60-70'
      else if (pct < 80) key = '70-80'
      else key = '80+'
      b[key].n++; if (pick === actual) b[key].c++
    }
    const hasAny = Object.values(b).some(x => x.n > 0)
    if (!hasAny) continue
    const row = Object.entries(b).map(([lbl, x]) =>
      `${lbl}: ${x.n ? ((x.c / x.n) * 100).toFixed(0) : ' -'}% (n=${x.n})`
    ).join('  ')
    console.log(`  ${k.toUpperCase()}: ${row}`)
  }

  // ── 5. Per-league accuracy (V1 + V3 side-by-side) ────────────
  console.log('\n5. ACCURACY BY LEAGUE (min 5 V1 picks)')
  console.log('-'.repeat(72))
  const byLg: Record<string, { n: number; v1n: number; v1c: number; v2n: number; v2c: number; v3n: number; v3c: number }> = {}
  for (const m of matches) {
    const lg = m.league || 'Unknown'
    byLg[lg] ||= { n: 0, v1n: 0, v1c: 0, v2n: 0, v2c: 0, v3n: 0, v3c: 0 }
    byLg[lg].n++
    const actual = actualFrom(m); if (!actual) continue
    for (const k of ['v1', 'v2', 'v3'] as ModelKey[]) {
      const p = pickFor(m, k); if (!p) continue
      const s = byLg[lg]
      if (k === 'v1') { s.v1n++; if (p === actual) s.v1c++ }
      if (k === 'v2') { s.v2n++; if (p === actual) s.v2c++ }
      if (k === 'v3') { s.v3n++; if (p === actual) s.v3c++ }
    }
  }
  const ranked = Object.entries(byLg)
    .filter(([_, s]) => s.v1n >= 5)
    .map(([lg, s]) => ({
      lg, n: s.v1n,
      v1: s.v1n ? (s.v1c / s.v1n) * 100 : 0,
      v3: s.v3n ? (s.v3c / s.v3n) * 100 : 0,
      v3n: s.v3n,
    }))
    .sort((a, b) => b.v1 - a.v1)

  console.log('  LEAGUE                                  N    V1%    V3%   V3 cov')
  for (const r of ranked) {
    const cov = r.n ? Math.round((r.v3n / r.n) * 100) : 0
    console.log(`  ${r.lg.padEnd(38)} ${String(r.n).padStart(3)}   ${r.v1.toFixed(0).padStart(3)}%   ${r.v3.toFixed(0).padStart(3)}%   ${String(cov).padStart(3)}%`)
  }

  // ── 6. V1+V3 agreement bonus ─────────────────────────────────
  console.log('\n6. V1+V3 AGREEMENT — does consensus add accuracy?')
  console.log('-'.repeat(72))
  let agree_n = 0, agree_c = 0, disagree_n = 0, disagree_c = 0
  for (const m of matches) {
    const v1 = pickFor(m, 'v1'); const v3 = pickFor(m, 'v3'); const actual = actualFrom(m)
    if (!v1 || !v3 || !actual) continue
    if (v1 === v3) {
      agree_n++; if (v1 === actual) agree_c++
    } else {
      disagree_n++
      // When they disagree, V1 is usually the surfaced pick — count V1 hit
      if (v1 === actual) disagree_c++
    }
  }
  const ar = agree_n ? (agree_c / agree_n) * 100 : 0
  const dr = disagree_n ? (disagree_c / disagree_n) * 100 : 0
  console.log(`  V1+V3 agree:    ${agree_c}/${agree_n} (${ar.toFixed(1)}%)`)
  console.log(`  V1+V3 disagree (V1 surfaced): ${disagree_c}/${disagree_n} (${dr.toFixed(1)}%)`)
  console.log(`  Bonus from agreement: ${(ar - dr).toFixed(1)} pts`)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Insights error:', e)
  process.exit(1)
})
