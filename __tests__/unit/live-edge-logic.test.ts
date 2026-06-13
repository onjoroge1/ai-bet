/**
 * Unit tests for lib/live-edge/logic — the status machine, TTL/expiry, and
 * the price guard. Mirrors the QA checklist in the Live Edge manual (§10).
 */
import {
  isExpired, effectiveStatus, hasLiveOdds, priceGuardOk, canRenderBet,
  secondsAgo, secondsUntilExpiry, sortBoard, edgeMatches, evMatches, minOddsMatches,
} from '@/lib/live-edge/logic'
import { liveEdgeDetailUnlocked } from '@/lib/live-edge/access'
import type { LiveEdgeCard } from '@/lib/live-edge/types'

const NOW = new Date('2026-06-13T20:14:33Z')

function card(overrides: Partial<LiveEdgeCard> = {}): LiveEdgeCard {
  return {
    match_id: 1489371, minute: 77, period: '2H',
    home: { name: 'Brazil', score: 1 }, away: { name: 'Morocco', score: 1 },
    status: 'BETTABLE', market: 'over_0.5_more_goals', pick: 'over_0.5_more_goals',
    model_prob: 0.508, market_implied: 0.426, edge: 0.082, ev: 0.1938,
    best_price: { odds: 2.35, book: 'bet365' }, min_acceptable_odds: 1.97,
    confidence: 'medium_high', pressure: { home: 44.4, away: 3.1, total: 47.5 },
    expires_at: '2026-06-13T20:15:18Z',
    model_track_record: { model: 'live_edge_over05', edge_validated: false },
    ...overrides,
  }
}

describe('TTL / expiry', () => {
  it('not expired before expires_at', () => {
    expect(isExpired(card(), NOW)).toBe(false)
  })
  it('expired after expires_at', () => {
    expect(isExpired(card({ expires_at: '2026-06-13T20:14:00Z' }), NOW)).toBe(true)
  })
  it('a BETTABLE past its TTL renders as EXPIRED client-side', () => {
    expect(effectiveStatus(card({ expires_at: '2026-06-13T20:14:00Z' }), NOW)).toBe('EXPIRED')
  })
  it('a live BETTABLE stays BETTABLE', () => {
    expect(effectiveStatus(card(), NOW)).toBe('BETTABLE')
  })
  it('non-BETTABLE statuses pass through unchanged', () => {
    expect(effectiveStatus(card({ status: 'WATCHLIST', expires_at: null }), NOW)).toBe('WATCHLIST')
    expect(effectiveStatus(card({ status: 'SUSPENDED' }), NOW)).toBe('SUSPENDED')
  })
  it('secondsUntilExpiry counts down then floors at 0', () => {
    expect(secondsUntilExpiry(card(), NOW)).toBe(45)
    expect(secondsUntilExpiry(card({ expires_at: '2026-06-13T20:14:00Z' }), NOW)).toBe(0)
    expect(secondsUntilExpiry(card({ expires_at: null }), NOW)).toBeNull()
  })
  it('secondsAgo reports recency', () => {
    expect(secondsAgo('2026-06-13T20:14:03Z', NOW)).toBe(30)
  })
})

describe('odds nullability', () => {
  it('WATCHLIST card with null odds → no live odds, never bettable', () => {
    const c = card({
      status: 'WATCHLIST', market_implied: null, edge: null, ev: null,
      best_price: null, min_acceptable_odds: null, expires_at: null,
    })
    expect(hasLiveOdds(c)).toBe(false)
    expect(canRenderBet(c, NOW)).toBe(false)
    // model_prob + pressure still present
    expect(c.model_prob).toBeGreaterThan(0)
    expect(c.pressure.total).toBeGreaterThan(0)
  })
})

describe('price guard (the most important rule)', () => {
  it('passes when best price ≥ floor', () => {
    expect(priceGuardOk(card())).toBe(true)
  })
  it('fails when live price dropped below floor', () => {
    expect(priceGuardOk(card(), 1.80)).toBe(false) // floor 1.97
  })
  it('fails when floor is null (no odds)', () => {
    expect(priceGuardOk(card({ min_acceptable_odds: null, best_price: null }))).toBe(false)
  })
  it('canRenderBet requires BETTABLE + odds + guard', () => {
    expect(canRenderBet(card(), NOW)).toBe(true)
    expect(canRenderBet(card(), NOW, 1.80)).toBe(false)            // price moved
    expect(canRenderBet(card({ status: 'SUSPENDED' }), NOW)).toBe(false)
    expect(canRenderBet(card({ expires_at: '2026-06-13T20:14:00Z' }), NOW)).toBe(false) // TTL passed
  })
})

describe('board ordering', () => {
  it('BETTABLE (by edge) → WATCHLIST (by pressure) → SUSPENDED → EXPIRED', () => {
    const cards = [
      card({ match_id: 1, status: 'WATCHLIST', edge: null, expires_at: null, pressure: { home: 0, away: 0, total: 20 } }),
      card({ match_id: 2, status: 'BETTABLE', edge: 0.05 }),
      card({ match_id: 3, status: 'SUSPENDED', expires_at: null }),
      card({ match_id: 4, status: 'BETTABLE', edge: 0.12 }),
      card({ match_id: 5, status: 'BETTABLE', edge: 0.09, expires_at: '2026-06-13T20:14:00Z' }), // expired → sinks
    ]
    const order = sortBoard(cards, NOW).map(c => c.match_id)
    expect(order.slice(0, 2)).toEqual([4, 2]) // highest-edge bettables first
    expect(order[order.length - 1]).toBe(5)   // client-expired sinks to bottom
  })
})

describe('freemium gate (liveEdgeDetailUnlocked)', () => {
  it('free / missing → locked', () => {
    expect(liveEdgeDetailUnlocked(null)).toBe(false)
    expect(liveEdgeDetailUnlocked(undefined)).toBe(false)
    expect(liveEdgeDetailUnlocked({})).toBe(false)
    expect(liveEdgeDetailUnlocked({ tier: 'free' })).toBe(false)
  })
  it('any paid tier → unlocked', () => {
    expect(liveEdgeDetailUnlocked({ tier: 'starter' })).toBe(true)
    expect(liveEdgeDetailUnlocked({ tier: 'pro' })).toBe(true)
    expect(liveEdgeDetailUnlocked({ tier: 'vip' })).toBe(true)
    expect(liveEdgeDetailUnlocked({ tier: 'admin' })).toBe(true)
  })
})

describe('math sanity', () => {
  it('edge ≈ model_prob − market_implied', () => {
    expect(edgeMatches(card())).toBe(true)
  })
  it('ev ≈ model_prob × odds − 1', () => {
    // 0.508 × 2.35 − 1 = 0.1938
    expect(evMatches(card())).toBe(true)
  })
  it('min_acceptable_odds ≈ 1 / model_prob', () => {
    // 1 / 0.508 = 1.9685 ≈ 1.97
    expect(minOddsMatches(card())).toBe(true)
  })
  it('validators are null-safe when odds absent', () => {
    const c = card({ edge: null, ev: null, best_price: null, market_implied: null, min_acceptable_odds: null })
    expect(edgeMatches(c)).toBeNull()
    expect(evMatches(c)).toBeNull()
    expect(minOddsMatches(c)).toBeNull()
  })
})
