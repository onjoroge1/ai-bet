/**
 * Multisport alpha analysis — NBA + NHL.
 *
 * Read-only diagnostic. Walks finished MultisportMatch rows in the last
 * 90 days (or --days N) with model + finalResult populated, computes five
 * matrices per sport:
 *
 *   A. Confidence-bucket calibration (acc vs stated confidence)
 *   B. Per-outcome accuracy (home vs away picks)
 *   C. Conviction-tier accuracy (premium vs standard)
 *   D. Underdog conviction analysis (model fades favorite)
 *   E. EV per pick pattern — the revenue table
 *
 * NBA + NHL behave OPPOSITE ways. NBA wins on favorites with premium
 * conviction. NHL is systematically under-confident — sweet spot is
 * conf 0.65-0.75 with +0.31 EV. The current NHL ≥ 0.85 gate is actively
 * harmful at -0.09 EV.
 *
 * Run with:
 *   npx tsx scripts/multisport-alpha-analysis.ts                 # last 90d
 *   npx tsx scripts/multisport-alpha-analysis.ts --days 30
 *   npx tsx scripts/multisport-alpha-analysis.ts --sport nba     # single sport
 */

import prisma from '../lib/db'
import { Prisma } from '@prisma/client'

type Sport = 'basketball_nba' | 'icehockey_nhl'

const DAYS_ARG = process.argv.indexOf('--days')
const DAYS = DAYS_ARG !== -1 ? Math.max(1, parseInt(process.argv[DAYS_ARG + 1], 10) || 90) : 90
const SPORT_ARG = process.argv.indexOf('--sport')
const SPORT_FILTER = SPORT_ARG !== -1 ? process.argv[SPORT_ARG + 1] : null

const norm = (s: any) => {
  const x = String(s ?? '').toUpperCase().trim()
  if (x === 'H' || x === 'HOME' || x === 'HOME_WIN') return 'H'
  if (x === 'A' || x === 'AWAY' || x === 'AWAY_WIN') return 'A'
  return null
}

function actualFrom(m: any): string | null {
  const fr = m.finalResult
  if (typeof fr === 'string') return norm(fr)
  if (!fr) return null
  const score = fr.score
  if (score && typeof score.home === 'number' && typeof score.away === 'number') {
    return score.home > score.away ? 'H' : score.away > score.home ? 'A' : null
  }
  return norm(fr.result)
}

function pad(s: string | number, n: number): string { return String(s).padStart(n) }
function lpad(s: string, n: number): string { return s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n) }
function pct(num: number, den: number): string { return den ? `${((num / den) * 100).toFixed(0)}%` : ' -' }

async function analyzeSport(sport: Sport) {
  const since = new Date(Date.now() - DAYS * 86400 * 1000)
  const rows = await prisma.multisportMatch.findMany({
    where: {
      sport,
      status: 'finished',
      commenceTime: { gte: since },
      model: { not: Prisma.JsonNull },
      finalResult: { not: Prisma.JsonNull },
    },
    select: { eventId: true, homeTeam: true, awayTeam: true, model: true, odds: true, finalResult: true, commenceTime: true },
  })

  const usable: any[] = []
  for (const m of rows) {
    const model = m.model as any
    const preds = model?.predictions
    if (!preds?.pick) continue
    const pick = norm(preds.pick)
    const actual = actualFrom(m)
    if (!pick || !actual) continue
    usable.push({ ...m, pick, actual, confidence: Number(preds.confidence) || 0, tier: preds.conviction_tier || 'standard' })
  }

  console.log(`\n══════════════════════════════════════════════════════════════════════`)
  console.log(`${sport.toUpperCase()}  (last ${DAYS}d: ${usable.length} finished+predicted+settled)`)
  console.log(`══════════════════════════════════════════════════════════════════════`)
  if (usable.length === 0) return

  // ── Matrix A — Confidence-bucket calibration ──
  const buckets = [
    { label: '<55%',   lo: 0,    hi: 0.55, exp: '<55%' },
    { label: '55-65%', lo: 0.55, hi: 0.65, exp: '55-65%' },
    { label: '65-75%', lo: 0.65, hi: 0.75, exp: '65-75%' },
    { label: '75-85%', lo: 0.75, hi: 0.85, exp: '75-85%' },
    { label: '85-95%', lo: 0.85, hi: 0.95, exp: '85-95%' },
    { label: '95+%',   lo: 0.95, hi: 1.01, exp: '95%+' },
  ]
  console.log('\nA. Confidence-bucket calibration:')
  console.log('   bucket    n      acc%   exp%       gap (acc - midpoint)')
  for (const b of buckets) {
    const inBucket = usable.filter(m => m.confidence >= b.lo && m.confidence < b.hi)
    const correct = inBucket.filter(m => m.pick === m.actual).length
    const acc = inBucket.length ? (correct / inBucket.length) * 100 : 0
    const mid = ((b.lo + Math.min(1, b.hi)) / 2) * 100
    const gap = acc - mid
    const gapStr = gap >= 0 ? `+${gap.toFixed(1)}` : gap.toFixed(1)
    const flag = inBucket.length >= 20 && gap >= 5 ? '  ⭐ under-confident' : (inBucket.length >= 20 && gap <= -5 ? '  ⚠️ over-confident' : '')
    console.log(`   ${b.label.padEnd(8)}  ${pad(inBucket.length, 4)}   ${pad(acc.toFixed(0), 3)}%   ${b.exp.padEnd(7)}   ${gapStr.padStart(5)} pp${flag}`)
  }

  // ── Matrix B — Per-outcome accuracy ──
  const homePicks = usable.filter(m => m.pick === 'H')
  const awayPicks = usable.filter(m => m.pick === 'A')
  const homeCorrect = homePicks.filter(m => m.actual === 'H').length
  const awayCorrect = awayPicks.filter(m => m.actual === 'A').length
  const actualHomeWinRate = usable.filter(m => m.actual === 'H').length / usable.length * 100
  console.log('\nB. Per-outcome accuracy:')
  console.log(`   Home picks: ${homeCorrect}/${homePicks.length}  acc=${pct(homeCorrect, homePicks.length)}  share=${((homePicks.length / usable.length) * 100).toFixed(0)}% of picks`)
  console.log(`   Away picks: ${awayCorrect}/${awayPicks.length}  acc=${pct(awayCorrect, awayPicks.length)}  share=${((awayPicks.length / usable.length) * 100).toFixed(0)}% of picks`)
  console.log(`   Actual home-win rate: ${actualHomeWinRate.toFixed(1)}%`)

  // ── Matrix C — Conviction-tier accuracy ──
  const tiers = new Map<string, { n: number; c: number }>()
  for (const m of usable) {
    const t = m.tier
    tiers.set(t, { n: (tiers.get(t)?.n || 0) + 1, c: (tiers.get(t)?.c || 0) + (m.pick === m.actual ? 1 : 0) })
  }
  console.log('\nC. Conviction-tier accuracy:')
  for (const [t, s] of Array.from(tiers.entries()).sort((a, b) => b[1].n - a[1].n)) {
    console.log(`   ${t.padEnd(12)}  ${pad(s.n, 4)}   acc=${pct(s.c, s.n)}`)
  }

  // ── Matrix D — Underdog conviction analysis ──
  console.log('\nD. Underdog conviction (model picks team with implied prob < 50%):')
  console.log('   tier         n     acc%   avg implied prob   avg decimal odds   EV/unit')
  for (const t of ['premium', 'standard']) {
    const dogs = usable.filter(m => {
      if (m.tier !== t) return false
      const preds = m.model.predictions
      const pickedProb = m.pick === 'H' ? (preds.home_win || 0) : (preds.away_win || 0)
      return pickedProb < 0.50
    })
    if (dogs.length === 0) continue
    let correct = 0, probSum = 0, oddsSum = 0, oddsCount = 0
    for (const m of dogs) {
      const preds = m.model.predictions
      const pickedProb = m.pick === 'H' ? preds.home_win : preds.away_win
      probSum += pickedProb
      if (m.pick === m.actual) correct++
      const consensus = m.odds?.consensus
      const pickProbFromOdds = m.pick === 'H' ? consensus?.home_prob : consensus?.away_prob
      if (pickProbFromOdds && pickProbFromOdds > 0 && pickProbFromOdds < 1) {
        oddsSum += 1 / pickProbFromOdds
        oddsCount++
      }
    }
    const acc = correct / dogs.length
    const avgProb = (probSum / dogs.length) * 100
    const avgOdds = oddsCount ? oddsSum / oddsCount : null
    const ev = avgOdds ? (acc * (avgOdds - 1)) - ((1 - acc) * 1) : null
    const evStr = ev != null ? (ev >= 0 ? `+${ev.toFixed(2)}` : ev.toFixed(2)) : '-'
    console.log(`   ${t.padEnd(12)} ${pad(dogs.length, 4)}   ${(acc * 100).toFixed(0).padStart(3)}%      ${avgProb.toFixed(0)}%               ${avgOdds ? avgOdds.toFixed(2) : '-'}              ${evStr}`)
  }

  // ── Matrix E — EV per pick pattern ──
  console.log('\nE. EV per pick pattern (decimal odds from no-vig consensus probs):')
  console.log('   pattern                                       n     acc%   avg-odds   EV/unit')

  function trackPattern(label: string, filter: (m: any) => boolean) {
    const subset = usable.filter(filter)
    if (subset.length < 5) return
    let correct = 0, oddsSum = 0, oddsCount = 0
    for (const m of subset) {
      if (m.pick === m.actual) correct++
      const consensus = m.odds?.consensus
      const pickProb = m.pick === 'H' ? consensus?.home_prob : consensus?.away_prob
      if (pickProb && pickProb > 0 && pickProb < 1) {
        oddsSum += 1 / pickProb
        oddsCount++
      }
    }
    const acc = correct / subset.length
    const avgOdds = oddsCount ? oddsSum / oddsCount : null
    const ev = avgOdds ? (acc * (avgOdds - 1)) - ((1 - acc) * 1) : null
    const evStr = ev != null ? (ev >= 0 ? `+${ev.toFixed(2)}` : ev.toFixed(2)) : '-'
    const flag = ev != null && ev >= 0.10 && subset.length >= 20 ? '  ⭐ +EV pattern' : ''
    console.log(`   ${lpad(label, 44)}   ${pad(subset.length, 4)}   ${(acc * 100).toFixed(0).padStart(3)}%    ${avgOdds ? avgOdds.toFixed(2) : '-'}      ${evStr}${flag}`)
  }

  trackPattern('All picks (baseline)', () => true)
  trackPattern('Conf ≥ 0.80 (NBA current gate)', m => m.confidence >= 0.80)
  trackPattern('Conf ≥ 0.85 (NHL current gate)', m => m.confidence >= 0.85)
  trackPattern('Premium conviction (current premium tier)', m => m.tier === 'premium')
  trackPattern('Premium AND home pick', m => m.tier === 'premium' && m.pick === 'H')
  trackPattern('Premium AND away pick', m => m.tier === 'premium' && m.pick === 'A')
  trackPattern('Standard (non-premium) tier', m => m.tier !== 'premium')
  trackPattern('Premium favorite (picks team with prob ≥ 0.65)', m => {
    if (m.tier !== 'premium') return false
    const p = m.model.predictions
    const picked = m.pick === 'H' ? p.home_win : p.away_win
    return picked >= 0.65
  })
  trackPattern('Premium underdog (picks team with prob < 0.50)', m => {
    if (m.tier !== 'premium') return false
    const p = m.model.predictions
    const picked = m.pick === 'H' ? p.home_win : p.away_win
    return picked < 0.50
  })
  trackPattern('Conf 65-75% bucket', m => m.confidence >= 0.65 && m.confidence < 0.75)
  trackPattern('Conf 75-85% bucket', m => m.confidence >= 0.75 && m.confidence < 0.85)
  trackPattern('Conf 85-95% bucket', m => m.confidence >= 0.85 && m.confidence < 0.95)
  trackPattern('Conf 95%+ (extreme)', m => m.confidence >= 0.95)
  trackPattern('Underdog pick — ANY (prob < 0.50)', m => {
    const p = m.model.predictions
    const picked = m.pick === 'H' ? p.home_win : p.away_win
    return picked < 0.50
  })
}

;(async () => {
  console.log(`\nMULTISPORT ALPHA ANALYSIS — last ${DAYS} days`)
  const sports: Sport[] = SPORT_FILTER
    ? [SPORT_FILTER === 'nba' ? 'basketball_nba' : 'icehockey_nhl']
    : ['basketball_nba', 'icehockey_nhl']
  for (const sport of sports) {
    await analyzeSport(sport)
  }
  await prisma.$disconnect()
})().catch((e) => {
  console.error('Analysis failed:', e)
  process.exit(1)
})
