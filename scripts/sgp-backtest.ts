/**
 * Same-Game-Parlay (SGP) backtest on top of premium picks.
 *
 * Tests the hypothesis: take a 2-leg cross-match parlay made of premium
 * picks; for each leg, ALSO add secondary markets from the SAME match
 * (BTTS, totals) to inflate to a 4-leg+ parlay. Does it still profit?
 *
 * Key caveat — correlation: outcomes within the same match are not
 * independent. Multiplying consensus probabilities OVERSTATES the joint
 * win probability and thus implies inflated odds. Two pricing modes:
 *   - 'naive': product of (1 / consensusProb). Overstates payout.
 *   - 'discount': apply a 15% haircut to combined odds (rough SGP-style
 *     correlation adjustment). More conservative.
 *
 * Output: ROI by SGP archetype × pricing mode.
 * Read-only.
 */
import prisma from '../lib/db'

const STAKE = 10
const CORRELATION_DISCOUNT = 0.85   // 'discount' mode multiplies naive odds by this

interface SecondaryPick {
  marketType: string
  selection: string
  line: number | null
  consensusProb: number
}

interface SGPLeg {
  label: string
  consensusProb: number              // implied probability at consensus
  odds: number                       // decimal odds = 1 / consensusProb
  outcome: 'win' | 'loss' | 'void'
}

function deriveOutcome(score: { home: number; away: number }, marketType: string, selection: string, line: number | null): 'win' | 'loss' | 'void' {
  const total = score.home + score.away
  switch (marketType) {
    case 'BTTS':
      if (selection === 'YES') return score.home > 0 && score.away > 0 ? 'win' : 'loss'
      if (selection === 'NO') return score.home === 0 || score.away === 0 ? 'win' : 'loss'
      return 'void'
    case 'TOTALS':
      if (line === null) return 'void'
      if (selection === 'OVER') {
        if (total === line) return 'void'
        return total > line ? 'win' : 'loss'
      }
      if (selection === 'UNDER') {
        if (total === line) return 'void'
        return total < line ? 'win' : 'loss'
      }
      return 'void'
    case '1X2':
      if (selection === 'HOME') return score.home > score.away ? 'win' : 'loss'
      if (selection === 'AWAY') return score.away > score.home ? 'win' : 'loss'
      if (selection === 'DRAW') return score.home === score.away ? 'win' : 'loss'
      return 'void'
    case 'DNB':
      if (score.home === score.away) return 'void'
      if (selection === 'HOME') return score.home > score.away ? 'win' : 'loss'
      if (selection === 'AWAY') return score.away > score.home ? 'win' : 'loss'
      return 'void'
    default:
      return 'void'
  }
}

function settleParlay(legs: SGPLeg[], mode: 'naive' | 'discount'): { result: 'win' | 'loss' | 'void'; net: number; combinedOdds: number } {
  if (legs.some(l => l.outcome === 'void')) {
    // For SGP we treat any void leg as voiding the parlay — push stake back
    return { result: 'void', net: 0, combinedOdds: 0 }
  }
  const productOdds = legs.reduce((p, l) => p * l.odds, 1)
  const combinedOdds = mode === 'discount' ? productOdds * CORRELATION_DISCOUNT : productOdds
  const allWin = legs.every(l => l.outcome === 'win')
  if (allWin) return { result: 'win', net: +(STAKE * (combinedOdds - 1)).toFixed(2), combinedOdds: +combinedOdds.toFixed(3) }
  return { result: 'loss', net: -STAKE, combinedOdds: +combinedOdds.toFixed(3) }
}

;(async () => {
  console.log('\n══════════════════════════════════════════════════════════')
  console.log(' SGP Backtest — premium pick + secondary same-match markets')
  console.log('══════════════════════════════════════════════════════════\n')

  const premium = await prisma.premiumPickHistory.findMany({
    where: { tier: 'premium', result: { in: ['win', 'loss'] } },
    select: {
      id: true, marketMatchId: true, externalMatchId: true,
      market: true, pick: true, oddsAtPublish: true,
      homeTeam: true, awayTeam: true,
      kickoffDate: true, result: true,
    },
    orderBy: { kickoffDate: 'asc' },
  })

  const externalIds = premium.map(p => p.externalMatchId)
  const adm = await prisma.additionalMarketData.findMany({
    where: { matchId: { in: externalIds } },
    select: {
      matchId: true, marketType: true, marketSubtype: true,
      line: true, consensusProb: true,
    },
  })
  const admByMatch = new Map<string, typeof adm>()
  for (const r of adm) {
    const arr = admByMatch.get(r.matchId) || []
    arr.push(r)
    admByMatch.set(r.matchId, arr)
  }

  const matches = await prisma.marketMatch.findMany({
    where: { id: { in: premium.map(p => p.marketMatchId) }, status: 'FINISHED' },
    select: { id: true, finalResult: true },
  })
  const scoreByInternalId = new Map(
    matches.map(m => {
      const fr = m.finalResult as { score?: { home?: number; away?: number } } | null
      return [m.id, fr?.score && typeof fr.score.home === 'number' ? { home: fr.score.home, away: fr.score.away! } : null]
    })
  )

  // ─── Build per-pick "augmented" parlays in each SGP archetype ───────
  // Each archetype = [premium 1X2 pick] + [N specific secondary legs]

  type Archetype = {
    name: string
    description: string
    secondaryPicks: (admForMatch: typeof adm) => SecondaryPick[]
  }

  function pickFromAdm(rows: typeof adm, marketType: string, selection: string, line: number | null): SecondaryPick | null {
    const match = rows.find(r => r.marketType === marketType && r.marketSubtype === selection && (line === null || (r.line !== null && Number(r.line) === line)))
    if (!match) return null
    const prob = Number(match.consensusProb)
    if (!prob || prob <= 0 || prob >= 1) return null
    return { marketType, selection, line, consensusProb: prob }
  }

  const archetypes: Archetype[] = [
    {
      name: '2-leg (base premium only)',
      description: 'Premium 1X2 only — single leg baseline',
      secondaryPicks: () => [],
    },
    {
      name: '+ Over 1.5',
      description: 'Premium 1X2 + same-match Over 1.5',
      secondaryPicks: (rows) => [pickFromAdm(rows, 'TOTALS', 'OVER', 1.5)].filter(Boolean) as SecondaryPick[],
    },
    {
      name: '+ Over 2.5',
      description: 'Premium 1X2 + same-match Over 2.5',
      secondaryPicks: (rows) => [pickFromAdm(rows, 'TOTALS', 'OVER', 2.5)].filter(Boolean) as SecondaryPick[],
    },
    {
      name: '+ BTTS YES',
      description: 'Premium 1X2 + same-match BTTS YES',
      secondaryPicks: (rows) => [pickFromAdm(rows, 'BTTS', 'YES', null)].filter(Boolean) as SecondaryPick[],
    },
    {
      name: '+ Over 1.5 + BTTS YES',
      description: 'Premium 1X2 + Over 1.5 + BTTS YES (3 legs same match)',
      secondaryPicks: (rows) => [
        pickFromAdm(rows, 'TOTALS', 'OVER', 1.5),
        pickFromAdm(rows, 'BTTS', 'YES', null),
      ].filter(Boolean) as SecondaryPick[],
    },
    {
      name: '+ Over 2.5 + BTTS YES',
      description: 'Premium 1X2 + Over 2.5 + BTTS YES (3 legs same match)',
      secondaryPicks: (rows) => [
        pickFromAdm(rows, 'TOTALS', 'OVER', 2.5),
        pickFromAdm(rows, 'BTTS', 'YES', null),
      ].filter(Boolean) as SecondaryPick[],
    },
    {
      name: '+ Over 1.5 + Over 2.5 + BTTS YES',
      description: '4 legs all same match',
      secondaryPicks: (rows) => [
        pickFromAdm(rows, 'TOTALS', 'OVER', 1.5),
        pickFromAdm(rows, 'TOTALS', 'OVER', 2.5),
        pickFromAdm(rows, 'BTTS', 'YES', null),
      ].filter(Boolean) as SecondaryPick[],
    },
  ]

  // Map our premium pick selection ("Brighton to win") to a 1X2 selection key
  // The premium pick stores marketMatchId not the 'HOME/AWAY' selection directly.
  // Trick: get the 1X2 leg's true outcome from finalResult — but we need to
  // know which side the pick favored. PremiumPickHistory.pick is the LABEL
  // (e.g. "Brighton to win"); compare to homeTeam to derive H/A.
  function pickSide(homeTeam: string, awayTeam: string, label: string): 'HOME' | 'AWAY' | 'DRAW' | null {
    if (label.includes(homeTeam)) return 'HOME'
    if (label.includes(awayTeam)) return 'AWAY'
    if (label.toLowerCase().includes('draw')) return 'DRAW'
    return null
  }

  type ArchetypeResult = {
    samples: number
    wins: number
    losses: number
    voids: number
    netNaive: number
    netDiscount: number
    avgCombinedOddsNaive: number
    avgCombinedOddsDiscount: number
  }
  const results = new Map<string, ArchetypeResult>()
  for (const a of archetypes) {
    results.set(a.name, { samples: 0, wins: 0, losses: 0, voids: 0, netNaive: 0, netDiscount: 0, avgCombinedOddsNaive: 0, avgCombinedOddsDiscount: 0 })
  }

  for (const pick of premium) {
    const score = scoreByInternalId.get(pick.marketMatchId)
    if (!score) continue
    const rows = admByMatch.get(pick.externalMatchId) || []
    if (rows.length === 0) continue

    const side = pickSide(pick.homeTeam, pick.awayTeam, pick.pick)
    if (!side) continue

    // 1X2 leg: pull consensusProb from ADM (matches what was visible at publish)
    const oneTwo = rows.find(r => r.marketType === '1X2' && r.marketSubtype === side)
    if (!oneTwo) continue
    const oneTwoProb = Number(oneTwo.consensusProb)
    if (!oneTwoProb || oneTwoProb <= 0 || oneTwoProb >= 1) continue
    const oneTwoOdds = 1 / oneTwoProb
    const oneTwoOutcome = pick.result === 'win' ? 'win' : 'loss'  // already settled

    for (const a of archetypes) {
      const secondary = a.secondaryPicks(rows)
      const legs: SGPLeg[] = [
        { label: `1X2 ${side}`, consensusProb: oneTwoProb, odds: oneTwoOdds, outcome: oneTwoOutcome },
        ...secondary.map(s => ({
          label: `${s.marketType} ${s.selection}${s.line !== null ? `_${s.line}` : ''}`,
          consensusProb: s.consensusProb,
          odds: 1 / s.consensusProb,
          outcome: deriveOutcome(score, s.marketType, s.selection, s.line),
        })),
      ]
      // skip if expected secondary legs are missing
      const expected = 1 + a.secondaryPicks(rows).length
      if (a.name !== '2-leg (base premium only)' && legs.length !== expected) continue

      const r = results.get(a.name)!
      r.samples++
      const naive = settleParlay(legs, 'naive')
      const discount = settleParlay(legs, 'discount')
      if (naive.result === 'win') r.wins++
      else if (naive.result === 'loss') r.losses++
      else r.voids++
      r.netNaive += naive.net
      r.netDiscount += discount.net
      r.avgCombinedOddsNaive += naive.combinedOdds
      r.avgCombinedOddsDiscount += discount.combinedOdds
    }
  }

  console.log('── RESULTS BY ARCHETYPE ──\n')
  console.log('  archetype                              · n  · W-L-V    · hit%   · avg odds (naive / disc) · net (naive)  · net (disc)  · ROI naive   · ROI disc')
  for (const a of archetypes) {
    const r = results.get(a.name)!
    const settled = r.wins + r.losses
    const hit = settled > 0 ? (r.wins / settled * 100) : 0
    const stakedSamples = settled
    const stakedDollars = stakedSamples * STAKE
    const roiNaive = stakedDollars > 0 ? (r.netNaive / stakedDollars * 100) : 0
    const roiDisc = stakedDollars > 0 ? (r.netDiscount / stakedDollars * 100) : 0
    const avgN = r.samples > 0 ? r.avgCombinedOddsNaive / r.samples : 0
    const avgD = r.samples > 0 ? r.avgCombinedOddsDiscount / r.samples : 0
    console.log(
      `  ${a.name.padEnd(38)} · ${r.samples.toString().padStart(2)} · ${r.wins}-${r.losses}-${r.voids.toString().padStart(2)} · ${hit.toFixed(1).padStart(5)}% · ${avgN.toFixed(2).padStart(5)} / ${avgD.toFixed(2).padStart(5)} · ${r.netNaive >= 0 ? '+' : ''}${r.netNaive.toFixed(2).padStart(8)} · ${r.netDiscount >= 0 ? '+' : ''}${r.netDiscount.toFixed(2).padStart(8)} · ${roiNaive >= 0 ? '+' : ''}${roiNaive.toFixed(1).padStart(6)}% · ${roiDisc >= 0 ? '+' : ''}${roiDisc.toFixed(1)}%`
    )
  }

  console.log('\n── NOTES ──')
  console.log('  · n is unique match-level SGPs (one per premium pick that had ADM data + matching score)')
  console.log('  · Naive mode multiplies consensus implied odds (OVERSTATES combined odds — ignores correlation)')
  console.log('  · Discount mode applies 15% haircut to combined odds (rough SGP-style correlation adjustment)')
  console.log('  · Reality is somewhere between, depending on actual same-match correlation')
  console.log('\n══════════════════════════════════════════════════════════\n')

  await prisma.$disconnect()
})()
