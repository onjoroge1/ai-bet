/**
 * Admin prop analysis pages render the API payloads: the sortable list (with the evaluation summary)
 * and the detail view (chart, quotes, hit rates, factors, combos).
 */
import React, { Suspense } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import PropsPage from '@/app/admin/props/page'
import PropDetailPage from '@/app/admin/props/[id]/page'

jest.mock('next/link', () => ({ __esModule: true, default: ({ children, href }: any) => <a href={href}>{children}</a> }))

class RO { observe() {} unobserve() {} disconnect() {} }
;(global as any).ResizeObserver = RO

const row = {
  estimate_id: 7, sport_key: 'basketball_nba', event_id: 'ev1', commence_time: '2026-11-20T03:10:00Z',
  home_team: 'Los Angeles Lakers', away_team: 'Sacramento Kings', subject: 'Luka Doncic', team: 'Los Angeles Lakers',
  stat: 'player_points', prediction_ts: '2026-11-20T02:30:00Z', mean: 31.2, actual: 33, threshold: 29.5, side: 'yes',
  source: 'kalshi', book: 'kalshi', price: 0.52, price_format: 'dollars', fee: 0.0175, breakeven_prob: 0.5375,
  displayed_prob: 0.51, our_prob: 0.58, our_lo: 0.55, our_hi: 0.6, ev: 0.079, result: 'win', pnl: 0.86,
  hit_rate: 0.6, hit_n: 12, hit_threshold: 29.5, quotes: 3,
}
const report = { created_at: '2026-11-26T12:00:00Z', report: {
  period: ['2026-11-13', '2026-11-25'], games: 120, settled_main_lines: 2000, split_date: '2026-11-19',
  families: [{ sport: 'basketball_nba', stat: 'player_points', settled_main_lines: 600, logloss_model: 0.69,
               logloss_market: 0.68, logloss_blend: 0.68, mae_model: 4.6, mae_market_line: 4.5, small_sample: false }],
  strategies: { model_ev_5: { description: 'model EV >= 5% at the best executable quote', survives: false,
    earlier_half: { bets: 100, roi: -0.02 }, later_half: { bets: 90, roi: -0.05, roi_ci90: [-0.15, 0.04] } } },
} }
const detail = {
  estimate: { id: 7, sport_key: 'basketball_nba', event_id: 'ev1', commence_time: row.commence_time,
    home_team: row.home_team, away_team: row.away_team, subject_type: 'player', subject: 'Luka Doncic',
    stat: 'player_points', mode: 'backtest', model_version: 'prop-baseline-v1', prediction_ts: row.prediction_ts,
    mean: 31.2, dist: 'negbin', dist_params: { r: 6.2, n_train: 21000, mean_range: [30.8, 31.6] },
    curve: [{ t: 24.5, p: 0.75, lo: 0.73, hi: 0.77 }, { t: 29.5, p: 0.58, lo: 0.55, hi: 0.6 }, { t: 34.5, p: 0.38, lo: 0.36, hi: 0.4 }],
    hit_rate: { threshold: 29.5, overall: { condition: 'all games', n: 12, hits: 7, rate: 0.583, lo: 0.32, hi: 0.81, small_sample: true, applies_today: true },
      last_10: { condition: 'last 10 games', n: 10, hits: 6, rate: 0.6, lo: 0.31, hi: 0.83, small_sample: true, applies_today: true },
      by_condition: [{ condition: 'home', n: 6, hits: 4, rate: 0.667, lo: 0.3, hi: 0.9, small_sample: true, applies_today: true }] },
    factors: { items: [{ feature: 's_long', label: 'recent average (long window)', value: 30.1, effect: 6.2 }],
      teammates_out: ['Austin Reaves'], unit: 'points' },
    combos: [{ with: 'player_rebounds', line: 29.5, with_line: 8.5, rho: 0.3, p_this: 0.58, p_with: 0.5, p_joint: 0.33,
      p_if_independent: 0.29, price: null, note: 'no combo price collected' }],
    history: [], actual: 33 },
  lines: [{ source: 'kalshi', book: 'kalshi', market_id: 'KXNBAPTS-X-30', threshold: 29.5, side: 'yes', quote_ts: row.prediction_ts,
    price: 0.52, price_format: 'dollars', fee: 0.0175, breakeven_prob: 0.5375, displayed_prob: 0.51, our_prob: 0.58,
    our_lo: 0.55, our_hi: 0.6, ev: 0.079, result: 'win', pnl: 0.86 },
    { source: 'sportsbook', book: 'draftkings', market_id: 'x', threshold: 29.5, side: 'no', quote_ts: row.prediction_ts,
      price: 1.87, price_format: 'decimal', fee: 0, breakeven_prob: 0.5348, displayed_prob: 0.49, our_prob: 0.42,
      our_lo: 0.4, our_hi: 0.45, ev: -0.21, result: 'loss', pnl: -1 }],
  related: [{ id: 8, stat: 'player_rebounds', mean: 8.4 }],
  rules: [{ ticker: 'KXNBAPTS-X-30', rules_primary: 'If Luka Doncic records 30+ points ...', result: 'yes' }],
  family: report.report.families[0],
}

beforeEach(() => {
  ;(global as any).fetch = jest.fn((url: string) => Promise.resolve({
    ok: true,
    json: () => Promise.resolve(url.includes('/report') ? { report } : url.match(/props\/\d+/) ? detail
      : { rows: [row], facets: [{ sport_key: 'basketball_nba', stat: 'player_points', estimates: 1 }] }),
  }))
})

test('list shows each priced line with break-even, EV and sample size, and sorts by column', async () => {
  render(<PropsPage />)
  expect(await screen.findByText('Luka Doncic')).toBeInTheDocument()
  expect(screen.getByText('Over 29.5')).toBeInTheDocument()
  expect(screen.getByText('52¢')).toBeInTheDocument()
  expect(screen.getByText('+7.9%')).toBeInTheDocument()
  expect(screen.getByText('small')).toBeInTheDocument()
  expect(screen.getByText(/Walk-forward evaluation/)).toBeInTheDocument()
  fireEvent.click(screen.getByText('Hit rate'))
  await waitFor(() => expect((global as any).fetch).toHaveBeenCalledWith(expect.stringContaining('sort=hit_rate'), expect.anything()))
})

test('detail shows quotes, needed price, hit rates, factors, rules and combos', async () => {
  await act(async () => {
    render(<Suspense fallback={null}><PropDetailPage params={Promise.resolve({ id: '7' })} /></Suspense>)
  })
  expect(await screen.findByText(/Luka Doncic — Points/)).toBeInTheDocument()
  expect(screen.getByText('Threshold vs probability of going over')).toBeInTheDocument()
  expect(screen.getByText(/Austin Reaves/)).toBeInTheDocument()
  expect(screen.getByText(/If Luka Doncic records 30\+ points/)).toBeInTheDocument()
  expect(screen.getByText('2.38 or better')).toBeInTheDocument()            // 1 / 0.42 for the Under
  expect(screen.getByText('33.0%')).toBeInTheDocument()                     // joint estimate
  expect(screen.getByText('last 10 games')).toBeInTheDocument()
})
