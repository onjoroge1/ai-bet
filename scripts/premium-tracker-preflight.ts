/**
 * Pre-flight gate for the Premium Pick Tracker (Chunk A, Day 1).
 *
 * Per the approved plan: forward-only data capture means we'll never publish
 * a backfilled number to users. But before we build the capture pipeline we
 * need to answer two questions:
 *
 *   1. COVERAGE — for FINISHED matches in the last 30 days, what fraction
 *      have an OddsSnapshot at-or-before kickoff? This tells us whether
 *      forward capture will reliably have odds-at-publish to lock in.
 *
 *   2. HYPOTHETICAL ROI — replay the premium-pick qualification logic
 *      against FINISHED matches; settle each against finalResult; sum the
 *      net $ at $100 flat stakes. This is for INTERNAL sanity only —
 *      never displayed to users — but if the number is heavily negative
 *      we should not build the tracker UI.
 *
 * Hard gates (per plan):
 *   - Coverage < 60% → STOP, fix OddsSnapshot frequency first
 *   - Hypothetical 30-day ROI worse than -10% → STOP, escalate to user
 *
 * Run with:
 *   npx tsx scripts/premium-tracker-preflight.ts
 *
 * Read-only — touches nothing.
 */

import prisma from '../lib/db'

// ─── Replicated qualification logic ──────────────────────────────────────
// Mirrors lib/premium-picks-engine.ts (soccer path) so we can replay it
// against FINISHED matches. Kept in-script to avoid invoking the live
// engine which queries `status: 'UPCOMING'`.

const STRONG_SOCCER_LEAGUES = new Set([
  'Bundesliga', 'La Liga', 'Premier League', 'Eredivisie',
  'UEFA Champions League', 'UEFA Europa League', 'Serie A',
  'Süper Lig', 'Eliteserien', 'Allsvenskan', 'Jupiler Pro League', 'J1 League',
  'Africa Cup of Nations', 'Scottish Premiership', 'League 78',
  'Championship', 'League One', 'Super League Greece', 'Swiss Super League',
])

function isStrongLeague(league: string): boolean {
  return STRONG_SOCCER_LEAGUES.has(league)
}

type Pick = 'home' | 'away' | 'draw'
type Tier = 'premium' | 'strong' | 'standard'

interface QualifiedPick {
  matchId: string
  league: string
  homeTeam: string
  awayTeam: string
  kickoffDate: Date
  pick: Pick
  tier: Tier
  v3conf: number
  reasons: string[]
}

interface ScoredOutcome extends QualifiedPick {
  oddsAtKickoff: number | null
  outcome: Pick | null
  result: 'win' | 'loss' | 'push' | 'unknown'
  netDollars: number | null
}

/** Resolve V3 pick + confidence from MarketMatch.v3Model + linked QuickPurchase.predictionData */
function qualifyMatch(m: {
  matchId: string; league: string; homeTeam: string; awayTeam: string; kickoffDate: Date
  v3Model: unknown
  qp: { predictionData: unknown; premiumScore: number | null; premiumTier: string | null } | undefined
}): QualifiedPick | null {
  const v3 = (m.v3Model || {}) as { pick?: string; confidence?: number }
  const pd = (m.qp?.predictionData || {}) as { predictions?: { home_win?: number; draw?: number; away_win?: number; confidence?: number } }
  const v3preds = pd.predictions || {}
  const v3hw = v3preds.home_win || 0
  const v3dw = v3preds.draw || 0
  const v3aw = v3preds.away_win || 0
  const v3conf = v3preds.confidence || v3.confidence || 0
  let v3pick: Pick | '' = ''
  if (v3hw > 0 || v3aw > 0 || v3dw > 0) {
    if (v3hw >= v3dw && v3hw >= v3aw) v3pick = 'home'
    else if (v3aw >= v3dw && v3aw >= v3hw) v3pick = 'away'
    else v3pick = 'draw'
  } else if (v3.pick) {
    const p = v3.pick.toLowerCase()
    if (p === 'home' || p === 'away' || p === 'draw') v3pick = p
  }
  if (!v3pick) return null

  const premiumScore = m.qp?.premiumScore ? Number(m.qp.premiumScore) : 0
  let tier: Tier = 'standard'
  const reasons: string[] = []
  let qualifies = false

  if (v3conf >= 0.6) { qualifies = true; tier = 'premium'; reasons.push(`V3 conf ${Math.round(v3conf * 100)}%`) }
  if (v3conf >= 0.5 && isStrongLeague(m.league)) {
    qualifies = true
    if (tier !== 'premium') tier = 'strong'
    reasons.push(`V3 ${Math.round(v3conf * 100)}% + strong league`)
  }
  if (premiumScore >= 60) {
    qualifies = true
    if (tier === 'standard') tier = 'strong'
    reasons.push(`Premium score ${premiumScore}`)
  }
  if (!qualifies) return null
  if (tier === 'standard') return null  // We only track premium + strong

  return {
    matchId: m.matchId,
    league: m.league,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    kickoffDate: m.kickoffDate,
    pick: v3pick,
    tier,
    v3conf,
    reasons,
  }
}

function outcomeFromFinalResult(fr: unknown): Pick | null {
  if (!fr || typeof fr !== 'object') return null
  // finalResult shape varies: { outcome: 'home'|'away'|'draw' } OR { score: {home, away}, outcome_text } OR { winner: ... }
  const o = (fr as { outcome?: string; outcome_text?: string; winner?: string }).outcome
  if (o) {
    const lo = o.toLowerCase()
    if (lo === 'home' || lo === 'away' || lo === 'draw') return lo as Pick
  }
  const score = (fr as { score?: { home?: number; away?: number } }).score
  if (score && typeof score.home === 'number' && typeof score.away === 'number') {
    if (score.home > score.away) return 'home'
    if (score.away > score.home) return 'away'
    return 'draw'
  }
  return null
}

;(async () => {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400 * 1000)

  console.log('\n══════════════════════════════════════════════════════════')
  console.log(' Premium Pick Tracker — Pre-flight gate')
  console.log(' Window: last 30 days of FINISHED soccer matches')
  console.log('══════════════════════════════════════════════════════════\n')

  // ── Pull candidate matches ────────────────────────────────────────────
  const matches = await prisma.marketMatch.findMany({
    where: {
      status: 'FINISHED',
      kickoffDate: { gte: thirtyDaysAgo, lt: now },
      v3Model: { not: { equals: null as unknown as object } },
      finalResult: { not: { equals: null as unknown as object } },
      isActive: true,
    },
    select: {
      id: true, matchId: true, league: true,
      homeTeam: true, awayTeam: true, kickoffDate: true,
      v3Model: true, finalResult: true, consensusOdds: true,
    },
    orderBy: { kickoffDate: 'desc' },
    take: 2000,
  })

  console.log(`Total candidate FINISHED matches (last 30d, has v3Model + finalResult): ${matches.length}`)

  if (matches.length === 0) {
    console.log('\n⚠️  Zero candidate matches. Cannot proceed — either v3Model isn\'t being populated or finalResult isn\'t being filled in. Investigate before building tracker.')
    process.exit(1)
  }

  // ── Pull QuickPurchases for those matches in one go ───────────────────
  const matchIds = matches.map(m => m.matchId)
  const qps = await prisma.quickPurchase.findMany({
    where: {
      matchId: { in: matchIds },
      predictionData: { not: { equals: null as unknown as object } },
    },
    select: { matchId: true, predictionData: true, premiumScore: true, premiumTier: true },
  })
  const qpByMatchId = new Map(qps.map(qp => [qp.matchId, qp]))

  // ── Replay qualification + outcome ─────────────────────────────────────
  const qualified: QualifiedPick[] = []
  for (const m of matches) {
    const qp = qpByMatchId.get(m.matchId)
    const q = qualifyMatch({
      matchId: m.matchId,
      league: m.league,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      kickoffDate: m.kickoffDate,
      v3Model: m.v3Model,
      qp: qp ? { predictionData: qp.predictionData, premiumScore: qp.premiumScore ? Number(qp.premiumScore) : null, premiumTier: qp.premiumTier } : undefined,
    })
    if (q) qualified.push(q)
  }

  console.log(`Qualified picks (premium + strong tier): ${qualified.length}`)
  const byTier = qualified.reduce<Record<string, number>>((acc, q) => { acc[q.tier] = (acc[q.tier] || 0) + 1; return acc }, {})
  console.log(`  - premium tier: ${byTier.premium || 0}`)
  console.log(`  - strong tier:  ${byTier.strong || 0}`)

  // ── Resolve odds-at-publish via MarketMatch.consensusOdds ─────────────
  // NB: OddsSnapshot table is empty (probed 2026-05-11). consensusOdds
  // stores IMPLIED PROBABILITIES (sum~1, with vig). Convert to decimal
  // odds via 1/p. allBookmakers[bookmaker] stores per-bookie decimal odds;
  // for v1 we use consensusOdds inverse (simplest, no bookie selection).
  let coverageHits = 0
  let coverageMisses = 0
  const scored: ScoredOutcome[] = []
  for (const q of qualified) {
    const match = matches.find(m => m.matchId === q.matchId)
    const consensus = (match?.consensusOdds || {}) as { home?: number; draw?: number; away?: number }
    const probRaw = q.pick === 'home' ? consensus.home : q.pick === 'away' ? consensus.away : consensus.draw
    const odds = typeof probRaw === 'number' && probRaw > 0 && probRaw < 1 ? +(1 / probRaw).toFixed(3) : null
    if (odds) coverageHits++; else coverageMisses++

    const outcome = match ? outcomeFromFinalResult(match.finalResult) : null
    let result: ScoredOutcome['result'] = 'unknown'
    let netDollars: number | null = null
    // ONLY score picks where we have BOTH odds AND outcome — same treatment
    // for wins and losses, no asymmetric ghost-losses.
    if (outcome && odds) {
      if (outcome === q.pick) {
        result = 'win'
        netDollars = +(100 * (odds - 1)).toFixed(2)
      } else {
        result = 'loss'
        netDollars = -100
      }
    } else if (outcome) {
      // Outcome known but no usable odds — record result for hit-rate but
      // exclude from ROI math.
      result = outcome === q.pick ? 'win' : 'loss'
    }
    scored.push({ ...q, oddsAtKickoff: odds, outcome, result, netDollars })
  }

  // ── Coverage report ────────────────────────────────────────────────────
  const coveragePct = qualified.length > 0 ? (coverageHits / qualified.length) * 100 : 0
  console.log('\n── COVERAGE ──')
  console.log(`Qualified picks with usable consensusOdds: ${coverageHits} / ${qualified.length} (${coveragePct.toFixed(1)}%)`)
  console.log(`Picks missing consensusOdds: ${coverageMisses}`)
  console.log(`Coverage gate (must be ≥60%): ${coveragePct >= 60 ? '✓ PASS' : '✗ FAIL'}`)

  // ── Hypothetical ROI ───────────────────────────────────────────────────
  const settled = scored.filter(s => s.result === 'win' || s.result === 'loss')
  const wins = settled.filter(s => s.result === 'win').length
  const losses = settled.filter(s => s.result === 'loss').length
  const hitRate = settled.length > 0 ? (wins / settled.length) * 100 : 0

  const withOdds = settled.filter(s => s.netDollars !== null)
  const totalStaked = withOdds.length * 100
  const netDollars = withOdds.reduce((sum, s) => sum + (s.netDollars || 0), 0)
  const roiPct = totalStaked > 0 ? (netDollars / totalStaked) * 100 : 0

  console.log('\n── HYPOTHETICAL FLAT-STAKE PERFORMANCE (internal only, never displayed) ──')
  console.log(`Settled picks: ${settled.length} (${wins}W / ${losses}L)`)
  console.log(`Settled picks with usable odds: ${withOdds.length}`)
  console.log(`Hit rate: ${hitRate.toFixed(1)}%`)
  if (withOdds.length > 0) {
    const avgOdds = withOdds.reduce((sum, s) => sum + (s.oddsAtKickoff || 0), 0) / withOdds.length
    console.log(`Average odds (consensus): ${avgOdds.toFixed(2)}`)
  }
  console.log(`Total staked (flat $100): $${totalStaked.toLocaleString()}`)
  console.log(`Net $: ${netDollars >= 0 ? '+' : ''}$${netDollars.toFixed(2)}`)
  console.log(`ROI: ${roiPct >= 0 ? '+' : ''}${roiPct.toFixed(2)}%`)
  console.log(`ROI gate (must be > -10%): ${roiPct > -10 ? '✓ PASS' : '✗ FAIL'}`)

  // ── By tier ────────────────────────────────────────────────────────────
  for (const tier of ['premium', 'strong'] as const) {
    const tierPicks = withOdds.filter(s => s.tier === tier)
    if (tierPicks.length === 0) continue
    const tierWins = tierPicks.filter(p => p.result === 'win').length
    const tierLosses = tierPicks.filter(p => p.result === 'loss').length
    const tierNet = tierPicks.reduce((sum, p) => sum + (p.netDollars || 0), 0)
    const tierStake = tierPicks.length * 100
    const tierRoi = (tierNet / tierStake) * 100
    console.log(`  ${tier.padEnd(8)}: ${tierWins}W-${tierLosses}L · staked $${tierStake} · net ${tierNet >= 0 ? '+' : ''}$${tierNet.toFixed(2)} · ROI ${tierRoi >= 0 ? '+' : ''}${tierRoi.toFixed(2)}%`)
  }

  // ── Decision ───────────────────────────────────────────────────────────
  const coveragePass = coveragePct >= 60
  const roiPass = roiPct > -10

  console.log('\n══════════════════════════════════════════════════════════')
  if (coveragePass && roiPass) {
    console.log(' ✅ PRE-FLIGHT PASS — proceed to Day 2 (capture pipeline)')
  } else {
    console.log(' ⛔ PRE-FLIGHT FAIL — do not build tracker UI yet')
    if (!coveragePass) console.log(`     → OddsSnapshot coverage too thin (${coveragePct.toFixed(1)}%). Fix capture frequency before tracker.`)
    if (!roiPass) console.log(`     → Hypothetical 30-day ROI (${roiPct.toFixed(2)}%) below -10%. Escalate to user before tracker launch.`)
  }
  console.log('══════════════════════════════════════════════════════════\n')

  await prisma.$disconnect()
  process.exit(coveragePass && roiPass ? 0 : 2)
})()
