/**
 * Internal demo / visual harness for the edge component library. Not linked
 * in nav, not in the sitemap — a render check + integration reference for
 * wiring into PredictionCard. Renders the four nullability cases from §7
 * against the worked-example shapes from §8.
 *
 * Safe to delete once the components are wired into production surfaces.
 */
import { Card, CardContent } from '@/components/ui/card'
import {
  ValueBadge, EdgeMeter, PriceGuard, StakeSuggester, NoValueState, TrackRecordNote, WhyThisBet,
  CLVLedgerSummary, CLVLedgerRows,
} from '@/components/edge'
import { extractEdge } from '@/lib/edge/helpers'
import type { MarketBlock, ValueBlock, ModelTrackRecord } from '@/lib/edge/types'

export const dynamic = 'force-static'

const market: MarketBlock = {
  implied: { home: 0.4946, draw: 0.2793, away: 0.2261 },
  overround: 1.053,
  n_books: 75,
  best_price: {
    home: { odds: 2.02, book: 'betfair_ex_au' },
    draw: { odds: 3.6, book: 'onexbet' },
    away: { odds: 4.5, book: 'unibet_nl' },
  },
}
const valueWithBet: ValueBlock = {
  edge: { home: -0.1128, draw: 0.002, away: 0.1108 },
  ev_at_best: { home: -0.2288, draw: 0.0127, away: 0.516 },
  value_bet: {
    outcome: 'away', bet: 'away_win', ev: 0.516, price: 4.5, book: 'unibet_nl',
    min_acceptable_odds: 2.968, kelly_full: 0.1474, kelly_quarter: 0.0369,
  },
  rating: 'strong_value',
  min_acceptable_odds: { home: 2.619, draw: 3.555, away: 2.968 },
}
const validated: ModelTrackRecord = {
  model: 'wc_elo', segment: 'thin_market', edge_validated: true,
  validation: 'temporal holdout +15.3pp vs baseline (n=765)', median_clv_90d: 0.021, n_settled: 64,
}
const unvalidated: ModelTrackRecord = {
  model: 'v3_sharp_lgbm', segment: 'efficient_market', edge_validated: false,
  validation: 'failed holdout 45.3% vs 50.9% baseline', median_clv_90d: null, n_settled: null,
}
const modelProbs = { home: 0.381, draw: 0.282, away: 0.337 }

export default function EdgeDemoPage() {
  const caseD = extractEdge({ market, value: valueWithBet, model_track_record: validated })
  const caseB = extractEdge({ market, value: null, model_track_record: validated })
  const caseClub = extractEdge({ market, value: { ...valueWithBet, value_bet: null }, model_track_record: unvalidated })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        <header>
          <h1 className="text-2xl font-bold text-white">Edge component harness</h1>
          <p className="text-slate-400 text-sm mt-1">USA vs Paraguay (match 1489370) · staging shapes</p>
        </header>

        {/* Case D — strong value, validated */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">USA vs Paraguay</h2>
              <ValueBadge value={caseD.value} />
            </div>
            <EdgeMeter market={caseD.market!} modelProbs={modelProbs} value={caseD.value} />
            {caseD.actionable && caseD.value?.value_bet && (
              <>
                <WhyThisBet
                  market={caseD.market}
                  value={caseD.value}
                  modelProbs={modelProbs}
                  homeLabel="USA"
                  awayLabel="Paraguay"
                />
                <PriceGuard valueBet={caseD.value.value_bet} livePrice={4.5} />
                <StakeSuggester valueBet={caseD.value.value_bet} bankroll={1000} />
              </>
            )}
            <TrackRecordNote track={caseD.trackRecord} />
          </CardContent>
        </Card>

        {/* Price guard — edge gone */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6 space-y-2">
            <h2 className="text-sm font-semibold text-white">Price Guard — live price dropped below floor</h2>
            <PriceGuard valueBet={valueWithBet.value_bet!} livePrice={2.5} />
          </CardContent>
        </Card>

        {/* Case B — market only, no value bet */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">No-value (validated model, market right)</h2>
            <NoValueState />
            <EdgeMeter market={caseB.market!} modelProbs={{ home: 0.49, draw: 0.28, away: 0.23 }} value={null} />
            <TrackRecordNote track={caseB.trackRecord} />
          </CardContent>
        </Card>

        {/* Club / unvalidated disclosure */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">Club match (V3, unvalidated)</h2>
            <NoValueState unvalidated />
            <EdgeMeter market={caseClub.market!} modelProbs={modelProbs} value={null} />
            <TrackRecordNote track={caseClub.trackRecord} />
          </CardContent>
        </Card>

        {/* CLV ledger */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">CLV ledger</h2>
            <CLVLedgerSummary agg={{ beatCloseRate: 0.68, avgClv: 0.021, nSettled: 64 }} />
            <CLVLedgerRows rows={[
              { id: '1', label: 'USA vs Paraguay · away', betTimeOdds: 4.5, closingOdds: 4.1, realizedClv: 0.098 },
              { id: '2', label: 'Germany vs Algeria · home', betTimeOdds: 1.95, closingOdds: 2.05, realizedClv: -0.049 },
              { id: '3', label: 'Spain vs Japan · home', betTimeOdds: 1.8, closingOdds: null, realizedClv: null },
            ]} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
