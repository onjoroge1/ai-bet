/**
 * §1 Payload-contract QA (Frontend Edge-Pivot QA Plan) — validates the REAL
 * backend payloads stored in QuickPurchase.predictionData against the
 * edge-payload v1 contract. These rows were written verbatim from live
 * /predict responses, so they ARE API snapshots.
 *
 * Read-only. Exits non-zero on any hard-contract violation.
 */
import prisma from '../lib/db'
import { edgeFromPredictionData } from '../lib/edge/extract'

interface Violation { matchId: string; name: string; rule: string; detail: string }

;(async () => {
  const qps = await prisma.quickPurchase.findMany({
    where: { predictionData: { not: null as never }, isPredictionActive: true },
    select: { matchId: true, name: true, predictionData: true },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  })

  const violations: Violation[] = []
  let withEdge = 0, withMarket = 0, withValueBet = 0, noValue = 0
  let wcValidated = 0, clubUnvalidated = 0, legacyOk = 0

  for (const qp of qps) {
    const pd = qp.predictionData as Record<string, unknown>
    const view = edgeFromPredictionData(pd)
    const flag = (rule: string, detail: string) =>
      violations.push({ matchId: qp.matchId ?? '?', name: qp.name, rule, detail })

    // §7 back-compat: legacy fields still present
    const preds = (pd.predictions ?? (pd as { prediction?: { predictions?: unknown } }).prediction?.predictions) as
      Record<string, unknown> | undefined
    if (preds && typeof preds.home_win === 'number' && 'confidence' in preds) legacyOk++

    if (!view.market && !view.value && !view.trackRecord) continue // pre-pivot row
    withEdge++

    // Check 1: market.implied sums to 1.0 ±0.001 (de-vig applied)
    if (view.market) {
      withMarket++
      const { home, draw, away } = view.market.implied
      const sum = (home ?? 0) + (draw ?? 0) + (away ?? 0)
      if (Math.abs(sum - 1.0) > 0.001) flag('implied-sums-1', `sum=${sum.toFixed(4)}`)
      if (view.market.overround !== null && (view.market.overround < 1.0 || view.market.overround > 1.25)) {
        flag('overround-range', `overround=${view.market.overround}`)
      }
    }

    if (view.value) {
      const vb = view.value.value_bet
      const rating = view.value.rating
      if (!['no_value', 'marginal', 'value', 'strong_value'].includes(rating ?? '')) {
        flag('rating-enum', `rating=${rating}`)
      }
      if (vb) {
        withValueBet++
        // Check 2: bet enum + matches argmax-EV outcome
        if (!['home_win', 'draw', 'away_win'].includes(vb.bet)) flag('bet-enum', `bet=${vb.bet}`)
        const ev = view.value.ev_at_best
        if (ev) {
          const entries = Object.entries(ev).filter(([, v]) => typeof v === 'number') as [string, number][]
          const argmax = entries.sort((a, b) => b[1] - a[1])[0]?.[0]
          if (argmax && vb.outcome !== argmax) flag('valuebet-argmax', `outcome=${vb.outcome} argmaxEV=${argmax}`)
        }
        // Check 3: non-null value_bet must have EV > 0
        if (!(vb.ev > 0)) flag('valuebet-ev-positive', `ev=${vb.ev}`)
        // Check 4: kelly_quarter == kelly_full/4, both 0-capped
        if (vb.kelly_full < 0 || vb.kelly_quarter < 0) flag('kelly-capped', `full=${vb.kelly_full} q=${vb.kelly_quarter}`)
        if (Math.abs(vb.kelly_quarter - vb.kelly_full / 4) > 0.001) {
          flag('kelly-quarter', `full=${vb.kelly_full} quarter=${vb.kelly_quarter}`)
        }
      } else {
        noValue++
      }
    }

    // Check 6: model_track_record honesty
    if (view.trackRecord) {
      const m = view.trackRecord.model
      if (m === 'wc_elo') {
        if (view.trackRecord.edge_validated === true) wcValidated++
        else flag('wc-elo-should-validate', `edge_validated=${view.trackRecord.edge_validated}`)
      }
      if ((m === 'v3_sharp' || m === 'v3_sharp_lgbm' || m === 'v1') && view.trackRecord.edge_validated === true) {
        flag('v3-must-not-validate', `model=${m} claims edge_validated=true — RELEASE BLOCKER`)
      } else if (m && m.startsWith('v')) {
        clubUnvalidated++
      }
    }

    // §6 CLV stage 1: bet_time_odds set iff value_bet exists
    if (view.clv && view.value) {
      const vb = view.value.value_bet
      if (vb && view.clv.bet_time_odds === null) flag('clv-bet-time-odds', 'value_bet exists but clv.bet_time_odds null')
      if (!vb && view.clv.bet_time_odds !== null) flag('clv-spurious', `no value_bet but bet_time_odds=${view.clv.bet_time_odds}`)
    }
  }

  console.log('══════════════════════════════════════════════')
  console.log(' §1 Edge Payload Contract — real stored payloads')
  console.log('══════════════════════════════════════════════')
  console.log(`Rows scanned:               ${qps.length}`)
  console.log(`  carrying edge blocks:     ${withEdge}`)
  console.log(`  with market block:        ${withMarket}`)
  console.log(`  with value_bet (non-null):${withValueBet}`)
  console.log(`  value_bet null (no-value):${noValue}`)
  console.log(`  wc_elo validated=true:    ${wcValidated}`)
  console.log(`  club model unvalidated:   ${clubUnvalidated}`)
  console.log(`  legacy fields intact:     ${legacyOk}`)
  console.log()
  if (violations.length === 0) {
    console.log('✅ ALL CONTRACT CHECKS PASS')
  } else {
    console.log(`❌ ${violations.length} VIOLATION(S):`)
    for (const v of violations) console.log(`  [${v.rule}] ${v.matchId} ${v.name}: ${v.detail}`)
  }
  await prisma.$disconnect()
  process.exit(violations.length === 0 ? 0 : 1)
})()
