/**
 * Premium-tier deep analysis: V1 vs V3 vs V1+V3 strengths.
 *
 * Read-only diagnostic. Walks FINISHED soccer matches in the last 90 days
 * with v1Model + v3Model + finalResult, and prints six matrices:
 *
 *   A. V3 accuracy by league × outcome (home/draw/away)
 *   B. V1+V3 agreement lift per league
 *   C. Premium-tier accuracy (from QuickPurchase.premiumTier) by league
 *   D. V3-primary candidate leagues
 *   E. Per-cell winner table (which model wins each league × outcome cell)
 *   F. EV per pick pattern using stored consensusOdds — the revenue table
 *
 * Run with:
 *   npx tsx scripts/premium-tier-analysis.ts
 *   npx tsx scripts/premium-tier-analysis.ts --days 30
 *   npx tsx scripts/premium-tier-analysis.ts --min-n 10   # lower sample floor
 */

import prisma from '../lib/db'
import { Prisma } from '@prisma/client'

// ─── Arg parsing ─────────────────────────────────────────────────────────
const DAYS_ARG = process.argv.indexOf('--days')
const DAYS = DAYS_ARG !== -1 ? Math.max(1, parseInt(process.argv[DAYS_ARG + 1], 10) || 90) : 90
const MIN_N_ARG = process.argv.indexOf('--min-n')
const MIN_N = MIN_N_ARG !== -1 ? Math.max(1, parseInt(process.argv[MIN_N_ARG + 1], 10) || 20) : 20

// ─── Normalization ───────────────────────────────────────────────────────
function norm(s: any): string | null {
  const x = String(s ?? '').toLowerCase().trim()
  if (x === 'h' || x === 'home_win' || x === 'home') return 'home'
  if (x === 'a' || x === 'away_win' || x === 'away') return 'away'
  if (x === 'd' || x === 'draw') return 'draw'
  return null
}

function pickFor(m: any, key: 'v1' | 'v3'): string | null {
  const obj = m[`${key}Model`]
  if (!obj) return null
  return norm(obj?.pick)
}

function confidenceFor(m: any, key: 'v1' | 'v3'): number | null {
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

function oddsForOutcome(consensusOdds: any, outcome: string | null): number | null {
  // `consensusOdds` is stored as no-vig probabilities (0-1) under home/draw/away
  // keys. Return raw prob; caller converts to decimal odds (1/prob).
  if (!consensusOdds || !outcome) return null
  const v = Number(consensusOdds[outcome])
  return isFinite(v) && v > 0 && v < 1 ? v : null
}

// ─── Helpers ─────────────────────────────────────────────────────────────
function pad(s: string | number, n: number): string {
  return String(s).padStart(n)
}
function lpad(s: string, n: number): string {
  if (s.length > n) return s.slice(0, n - 1) + '…'
  return s.padEnd(n)
}
function pct(num: number, den: number): string {
  if (!den) return '   -'
  return `${((num / den) * 100).toFixed(0).padStart(3)}%`
}

// ─── Main ────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\nPREMIUM-TIER DEEP ANALYSIS — last ${DAYS} days, min sample ${MIN_N}\n`)

  const since = new Date(Date.now() - DAYS * 86400 * 1000)

  // ── Pull FINISHED soccer matches with v3Model populated ──────────────
  const matches = await prisma.marketMatch.findMany({
    where: {
      status: 'FINISHED',
      isActive: true,
      finalResult: { not: Prisma.JsonNull },
      v3Model: { not: Prisma.JsonNull },
      kickoffDate: { gte: since },
    },
    select: {
      matchId: true, league: true, homeTeam: true, awayTeam: true,
      kickoffDate: true, finalResult: true, consensusOdds: true,
      v1Model: true, v3Model: true,
    },
  })

  console.log(`Loaded ${matches.length} finished soccer matches with v3Model.\n`)
  if (matches.length === 0) {
    await prisma.$disconnect()
    return
  }

  // ── Also pull QuickPurchase tier data ────────────────────────────────
  const qps = await prisma.quickPurchase.findMany({
    where: {
      matchId: { in: matches.map(m => m.matchId).filter(Boolean) as string[] },
      premiumTier: { not: null },
    },
    select: { matchId: true, premiumTier: true, premiumScore: true, predictionType: true },
  })
  const qpByMatch = new Map(qps.map(q => [q.matchId, q]))

  // ═══════════════════════════════════════════════════════════════════════
  // Matrix A — V3 by league × outcome (precision: correct when picked)
  // ═══════════════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════════════════════')
  console.log('MATRIX A — V3 precision by league × outcome (correct when picked)')
  console.log('═══════════════════════════════════════════════════════════════════════')
  console.log('  LEAGUE                            N   V3-overall   V3-home    V3-draw    V3-away')
  console.log('  ' + '-'.repeat(86))

  type ACell = { n: number; correct: number }
  type AStat = { overall: ACell; home: ACell; draw: ACell; away: ACell }
  const A: Record<string, AStat> = {}

  for (const m of matches) {
    const lg = m.league || 'Unknown'
    A[lg] ||= { overall: { n: 0, correct: 0 }, home: { n: 0, correct: 0 }, draw: { n: 0, correct: 0 }, away: { n: 0, correct: 0 } }
    const pick = pickFor(m, 'v3')
    const actual = actualFrom(m)
    if (!pick || !actual) continue
    A[lg].overall.n++
    if (pick === actual) A[lg].overall.correct++
    if (pick === 'home') { A[lg].home.n++; if (pick === actual) A[lg].home.correct++ }
    if (pick === 'draw') { A[lg].draw.n++; if (pick === actual) A[lg].draw.correct++ }
    if (pick === 'away') { A[lg].away.n++; if (pick === actual) A[lg].away.correct++ }
  }
  for (const lg of Object.keys(A).sort((a, b) => B(A[b]).n - B(A[a]).n)) {
    const s = A[lg]
    if (s.overall.n < 5) continue
    console.log(
      `  ${lpad(lg, 32)} ${pad(s.overall.n, 4)}    ${pct(s.overall.correct, s.overall.n)} (n=${pad(s.overall.n, 2)})  ` +
      `${pct(s.home.correct, s.home.n)} (n=${pad(s.home.n, 2)})  ` +
      `${pct(s.draw.correct, s.draw.n)} (n=${pad(s.draw.n, 2)})  ` +
      `${pct(s.away.correct, s.away.n)} (n=${pad(s.away.n, 2)})`
    )
  }
  function B(s: AStat) { return s.overall }

  // ═══════════════════════════════════════════════════════════════════════
  // Matrix B — V1+V3 agreement lift per league
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════════════')
  console.log('MATRIX B — V1+V3 agreement lift per league')
  console.log('═══════════════════════════════════════════════════════════════════════')
  console.log('  LEAGUE                            agree-n  agree-acc    disagree-n  disagree-acc   Δ (lift)')
  console.log('  ' + '-'.repeat(86))

  type BCell = { agree_n: number; agree_c: number; disagree_n: number; disagree_c: number }
  const Bm: Record<string, BCell> = {}

  for (const m of matches) {
    const lg = m.league || 'Unknown'
    Bm[lg] ||= { agree_n: 0, agree_c: 0, disagree_n: 0, disagree_c: 0 }
    const v1 = pickFor(m, 'v1'); const v3 = pickFor(m, 'v3'); const actual = actualFrom(m)
    if (!v1 || !v3 || !actual) continue
    if (v1 === v3) {
      Bm[lg].agree_n++
      if (v1 === actual) Bm[lg].agree_c++
    } else {
      Bm[lg].disagree_n++
      // when disagree, V1 is the historically surfaced pick (current engine bias)
      if (v1 === actual) Bm[lg].disagree_c++
    }
  }
  const Brows = Object.entries(Bm).filter(([_, s]) => s.agree_n + s.disagree_n >= 5)
  Brows.sort((a, b) => {
    const liftA = (a[1].agree_n ? a[1].agree_c / a[1].agree_n : 0) - (a[1].disagree_n ? a[1].disagree_c / a[1].disagree_n : 0)
    const liftB = (b[1].agree_n ? b[1].agree_c / b[1].agree_n : 0) - (b[1].disagree_n ? b[1].disagree_c / b[1].disagree_n : 0)
    return liftB - liftA
  })
  for (const [lg, s] of Brows) {
    const aacc = s.agree_n ? (s.agree_c / s.agree_n) * 100 : 0
    const dacc = s.disagree_n ? (s.disagree_c / s.disagree_n) * 100 : 0
    const lift = aacc - dacc
    const liftStr = lift >= 0 ? `+${lift.toFixed(1)}` : lift.toFixed(1)
    console.log(
      `  ${lpad(lg, 32)} ${pad(s.agree_n, 6)}    ${pad(aacc.toFixed(0), 4)}%       ` +
      `${pad(s.disagree_n, 6)}    ${pad(dacc.toFixed(0), 4)}%        ${pad(liftStr, 6)} pp`
    )
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Matrix C — Premium-tier accuracy by league (via QuickPurchase)
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════════════')
  console.log('MATRIX C — Premium-tier accuracy by league (from QuickPurchase.premiumTier)')
  console.log('═══════════════════════════════════════════════════════════════════════')
  console.log('  LEAGUE                       premium-n/acc   strong-n/acc   standard-n/acc   speculative-n/acc')
  console.log('  ' + '-'.repeat(98))

  type CCell = Record<string, { n: number; correct: number }>
  const C: Record<string, CCell> = {}
  const TIERS = ['premium', 'strong', 'standard', 'speculative']

  for (const m of matches) {
    const qp = qpByMatch.get(m.matchId)
    if (!qp || !qp.premiumTier) continue
    const lg = m.league || 'Unknown'
    C[lg] ||= Object.fromEntries(TIERS.map(t => [t, { n: 0, correct: 0 }]))
    const tier = qp.premiumTier
    if (!(tier in C[lg])) continue
    // For accuracy, prefer V3 pick then V1 pick (best available model)
    const pick = pickFor(m, 'v3') ?? pickFor(m, 'v1')
    const actual = actualFrom(m)
    if (!pick || !actual) continue
    C[lg][tier].n++
    if (pick === actual) C[lg][tier].correct++
  }
  const Crows = Object.entries(C).filter(([_, c]) =>
    TIERS.reduce((sum, t) => sum + (c[t]?.n || 0), 0) >= 5
  )
  Crows.sort((a, b) => (b[1].premium?.n || 0) - (a[1].premium?.n || 0))
  for (const [lg, c] of Crows) {
    const cells = TIERS.map(t => {
      const x = c[t]
      if (!x || x.n === 0) return '   -        '
      return `${pad(x.n, 3)}/${pct(x.correct, x.n)}    `
    }).join('')
    console.log(`  ${lpad(lg, 28)} ${cells}`)
  }

  // Per-tier overall sanity check
  console.log('\n  OVERALL by tier:')
  const tierTotal = Object.fromEntries(TIERS.map(t => [t, { n: 0, correct: 0 }]))
  for (const c of Object.values(C)) for (const t of TIERS) {
    tierTotal[t].n += c[t]?.n || 0
    tierTotal[t].correct += c[t]?.correct || 0
  }
  for (const t of TIERS) {
    const x = tierTotal[t]
    if (!x.n) continue
    console.log(`    ${t.padEnd(12)}  ${x.correct}/${x.n} = ${((x.correct / x.n) * 100).toFixed(1)}%`)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Matrix D — V3-primary candidate leagues
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════════════')
  console.log(`MATRIX D — V3-primary candidate leagues (V3 ≥ 55%, V3 > V1 by ≥ 3pp, n ≥ ${MIN_N})`)
  console.log('═══════════════════════════════════════════════════════════════════════')
  console.log('  LEAGUE                            n     V1%    V3%    Δ V3-V1   agreement lift')
  console.log('  ' + '-'.repeat(86))

  // Compute V1 vs V3 per league
  type DRow = { lg: string; n: number; v1: number; v3: number; delta: number; agreeLift: number }
  const D: DRow[] = []
  for (const lg of Object.keys(A)) {
    const a = A[lg]
    if (a.overall.n < MIN_N) continue
    // V1 accuracy: walk matches in this league
    let v1n = 0, v1c = 0
    for (const m of matches) {
      if (m.league !== lg) continue
      const pick = pickFor(m, 'v1'); const actual = actualFrom(m)
      if (!pick || !actual) continue
      v1n++; if (pick === actual) v1c++
    }
    if (v1n === 0) continue
    const v1Acc = (v1c / v1n) * 100
    const v3Acc = (a.overall.correct / a.overall.n) * 100
    const bm = Bm[lg]
    const agreeAcc = bm?.agree_n ? (bm.agree_c / bm.agree_n) * 100 : 0
    const disagreeAcc = bm?.disagree_n ? (bm.disagree_c / bm.disagree_n) * 100 : 0
    D.push({ lg, n: a.overall.n, v1: v1Acc, v3: v3Acc, delta: v3Acc - v1Acc, agreeLift: agreeAcc - disagreeAcc })
  }
  D.sort((a, b) => b.delta - a.delta)
  for (const r of D) {
    const flag = r.v3 >= 55 && r.delta >= 3 ? '  ⭐ V3-PRIMARY' : ''
    const deltaStr = r.delta >= 0 ? `+${r.delta.toFixed(1)}` : r.delta.toFixed(1)
    const liftStr = r.agreeLift >= 0 ? `+${r.agreeLift.toFixed(1)}` : r.agreeLift.toFixed(1)
    console.log(
      `  ${lpad(r.lg, 32)} ${pad(r.n, 4)}   ${pad(r.v1.toFixed(0), 4)}%  ${pad(r.v3.toFixed(0), 4)}%  ${pad(deltaStr, 7)} pp   ${pad(liftStr, 7)} pp${flag}`
    )
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Matrix E — Per-cell winner table
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════════════')
  console.log('MATRIX E — Per-cell winner (V1 vs V3) by league × outcome (n ≥ 30 in league)')
  console.log('═══════════════════════════════════════════════════════════════════════')
  console.log('  LEAGUE                      N    V1-home   V3-home   V1-away   V3-away   V3-draw   Winner')
  console.log('  ' + '-'.repeat(96))

  type ECell = { v1home: { n: number; c: number }, v3home: { n: number; c: number }, v1away: { n: number; c: number }, v3away: { n: number; c: number }, v3draw: { n: number; c: number } }
  const E: Record<string, ECell> = {}

  for (const m of matches) {
    const lg = m.league || 'Unknown'
    E[lg] ||= { v1home: { n: 0, c: 0 }, v3home: { n: 0, c: 0 }, v1away: { n: 0, c: 0 }, v3away: { n: 0, c: 0 }, v3draw: { n: 0, c: 0 } }
    const v1 = pickFor(m, 'v1'); const v3 = pickFor(m, 'v3'); const actual = actualFrom(m)
    if (v1 === 'home') { E[lg].v1home.n++; if (actual === 'home') E[lg].v1home.c++ }
    if (v3 === 'home') { E[lg].v3home.n++; if (actual === 'home') E[lg].v3home.c++ }
    if (v1 === 'away') { E[lg].v1away.n++; if (actual === 'away') E[lg].v1away.c++ }
    if (v3 === 'away') { E[lg].v3away.n++; if (actual === 'away') E[lg].v3away.c++ }
    if (v3 === 'draw') { E[lg].v3draw.n++; if (actual === 'draw') E[lg].v3draw.c++ }
  }
  const Erows = Object.entries(E).filter(([lg, _]) => (A[lg]?.overall.n || 0) >= 30)
  Erows.sort((a, b) => (A[b[0]]?.overall.n || 0) - (A[a[0]]?.overall.n || 0))
  for (const [lg, e] of Erows) {
    const v1homeAcc = e.v1home.n ? e.v1home.c / e.v1home.n : 0
    const v3homeAcc = e.v3home.n ? e.v3home.c / e.v3home.n : 0
    const v1awayAcc = e.v1away.n ? e.v1away.c / e.v1away.n : 0
    const v3awayAcc = e.v3away.n ? e.v3away.c / e.v3away.n : 0
    const v3drawAcc = e.v3draw.n ? e.v3draw.c / e.v3draw.n : 0

    // Winner determination: who wins more cells?
    let v1wins = 0, v3wins = 0
    if (e.v1home.n >= 5 && e.v3home.n >= 5) (v1homeAcc > v3homeAcc ? v1wins++ : v3wins++)
    if (e.v1away.n >= 5 && e.v3away.n >= 5) (v1awayAcc > v3awayAcc ? v1wins++ : v3wins++)
    const winner = v1wins > v3wins ? 'V1' : v3wins > v1wins ? 'V3' : 'tie/mixed'

    console.log(
      `  ${lpad(lg, 26)} ${pad(A[lg]?.overall.n || 0, 3)}  ` +
      `${pad(`${(v1homeAcc * 100).toFixed(0)}% (${e.v1home.n})`, 9)} ${pad(`${(v3homeAcc * 100).toFixed(0)}% (${e.v3home.n})`, 9)} ` +
      `${pad(`${(v1awayAcc * 100).toFixed(0)}% (${e.v1away.n})`, 9)} ${pad(`${(v3awayAcc * 100).toFixed(0)}% (${e.v3away.n})`, 9)} ` +
      `${pad(`${(v3drawAcc * 100).toFixed(0)}% (${e.v3draw.n})`, 9)} ${winner}`
    )
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Matrix F — EV per pick pattern (the revenue table)
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════════════')
  console.log('MATRIX F — Expected Value per pick pattern (using stored consensusOdds)')
  console.log('═══════════════════════════════════════════════════════════════════════')
  console.log('  PICK PATTERN                                  n     acc%   avg-odds   EV/unit')
  console.log('  ' + '-'.repeat(86))

  type FCell = { n: number; correct: number; oddsSum: number; oddsCount: number }
  const F: Record<string, FCell> = {}

  function track(label: string, won: boolean, odds: number | null) {
    F[label] ||= { n: 0, correct: 0, oddsSum: 0, oddsCount: 0 }
    F[label].n++
    if (won) F[label].correct++
    if (odds != null) { F[label].oddsSum += odds; F[label].oddsCount++ }
  }

  for (const m of matches) {
    const v1 = pickFor(m, 'v1'); const v3 = pickFor(m, 'v3'); const actual = actualFrom(m)
    if (!actual) continue
    const v1conf = confidenceFor(m, 'v1') ?? 0
    const v3conf = confidenceFor(m, 'v3') ?? 0
    const winOdds = oddsForOutcome(m.consensusOdds, actual)

    if (v1 && v3 && v1 === v3) {
      const won = v1 === actual
      const oddsForPick = oddsForOutcome(m.consensusOdds, v1)
      const oddsUsed = won ? oddsForPick : oddsForPick // we use pick odds always
      track('V1+V3 agree (any outcome)', won, oddsForPick)
      if (v1 === 'home') track('V1+V3 agree home', won, oddsForPick)
      if (v1 === 'away') track('V1+V3 agree away', won, oddsForPick)
      if (v1 === 'draw') track('V1+V3 agree draw', won, oddsForPick)
    }
    if (v1 && v3 && v1 !== v3) {
      const oddsV1 = oddsForOutcome(m.consensusOdds, v1)
      const oddsV3 = oddsForOutcome(m.consensusOdds, v3)
      track('V1+V3 disagree → V1 surfaced', v1 === actual, oddsV1)
      track('V1+V3 disagree → V3 surfaced', v3 === actual, oddsV3)
    }
    if (v3 === 'draw' && v3conf >= 0.40) {
      track('V3 high-conf draw (≥0.40)', v3 === actual, oddsForOutcome(m.consensusOdds, 'draw'))
    }
    if (v3 === 'away' && v3conf >= 0.50) {
      track('V3 high-conf away (≥0.50)', v3 === actual, oddsForOutcome(m.consensusOdds, 'away'))
    }
    if (v3 && v3conf >= 0.60) {
      track('V3 conf ≥ 0.60 (any outcome)', v3 === actual, oddsForOutcome(m.consensusOdds, v3))
    }
    if (v1 === 'home' && v1conf >= 0.70) {
      track('V1 home conf ≥ 0.70', v1 === actual, oddsForOutcome(m.consensusOdds, 'home'))
    }
  }
  const Frows = Object.entries(F)
    .filter(([_, c]) => c.n >= 5)
    .map(([label, c]) => {
      const acc = c.correct / c.n
      const avgOdds = c.oddsCount ? c.oddsSum / c.oddsCount : null
      // Convert prob to decimal odds (NoVig): odds = 1 / prob if odds is implied prob; if it's already decimal odds, use directly
      // The consensusOdds in the DB are probabilities (0-1), not decimal odds. Convert to decimal odds (no juice).
      const decimalOdds = avgOdds && avgOdds > 0 && avgOdds < 1 ? 1 / avgOdds : avgOdds
      const ev = decimalOdds ? (acc * (decimalOdds - 1)) - ((1 - acc) * 1) : null
      return { label, n: c.n, acc: acc * 100, avgOdds: decimalOdds, ev }
    })
  Frows.sort((a, b) => (b.ev ?? -999) - (a.ev ?? -999))
  for (const r of Frows) {
    const evStr = r.ev != null ? (r.ev >= 0 ? `+${r.ev.toFixed(2)}` : r.ev.toFixed(2)) : '   -'
    const oddsStr = r.avgOdds != null ? r.avgOdds.toFixed(2) : '  -'
    console.log(
      `  ${lpad(r.label, 44)}  ${pad(r.n, 4)}   ${pad(r.acc.toFixed(0), 3)}%    ${pad(oddsStr, 5)}      ${pad(evStr, 6)}`
    )
  }

  await prisma.$disconnect()
}

main().catch(e => { console.error('Analysis failed:', e); process.exit(1) })
