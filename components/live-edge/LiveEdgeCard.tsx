"use client"

/**
 * One Live Edge board card. Rendered ENTIRELY from the card's effective
 * status (§4) — we don't invent thresholds. Honesty rules (§7): an
 * unvalidated model is labelled "experimental" and never claims to beat the
 * market; value numbers appear only when odds exist AND the price guard
 * passes; "no bet" / WATCHLIST is a first-class state.
 */
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Radio, TrendingUp, Clock, ChevronRight, Activity, Ban, AlertTriangle, Lock } from 'lucide-react'
import type { LiveEdgeCard as Card_ } from '@/lib/live-edge/types'
import { effectiveStatus, canRenderBet, secondsUntilExpiry } from '@/lib/live-edge/logic'

function pctSigned(frac: number): string {
  const p = frac * 100
  return `${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p).toFixed(1)}%`
}
function pct(frac: number): string { return `${(frac * 100).toFixed(1)}%` }

function prettyMarket(m: string): string {
  return m.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const CONF_LABEL: Record<string, string> = {
  low: 'Low', medium: 'Medium', medium_high: 'Medium-High', high: 'High',
}

export function LiveEdgeCard({ card, now, locked = false }: { card: Card_; now: Date; locked?: boolean }) {
  const status = effectiveStatus(card, now)
  const bettable = canRenderBet(card, now)
  // Free users see that value was detected (the hook) but not the numbers.
  const showBet = bettable && !locked
  const showLockedTeaser = bettable && locked
  const validated = card.model_track_record?.edge_validated === true
  const ttl = secondsUntilExpiry(card, now)

  // Per-status framing
  const frame =
    status === 'BETTABLE' ? 'border-emerald-500/40 bg-emerald-950/10'
    : status === 'SUSPENDED' ? 'border-amber-500/30 bg-amber-950/10'
    : status === 'EXPIRED' ? 'border-slate-700/50 bg-slate-900/30 opacity-60'
    : 'border-slate-700 bg-slate-800/40' // WATCHLIST

  return (
    <Card className={`relative overflow-hidden border ${frame} transition-colors`}>
      <div className="p-4 space-y-3">
        {/* ── Header: live state ─────────────────────────────────── */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-400">
              <Radio className="w-3 h-3 animate-pulse" /> {card.minute}&apos; {card.period}
            </span>
          </div>
          <StatusPill status={status} ttl={ttl} />
        </div>

        {/* ── Teams + score ──────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-white truncate">{card.home.name}</span>
          <span className="text-lg font-bold text-white tabular-nums px-3">
            {card.home.score}–{card.away.score}
          </span>
          <span className="text-sm font-semibold text-white truncate text-right">{card.away.name}</span>
        </div>

        {/* ── Pick + market ──────────────────────────────────────── */}
        <div className="text-xs text-slate-300">
          <span className="text-slate-500">Market:</span> {prettyMarket(card.market)}
        </div>

        {/* ── Pressure (always present) ──────────────────────────── */}
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <Activity className="w-3.5 h-3.5 text-purple-300" />
          <span>Pressure {card.pressure.total.toFixed(0)}</span>
          <span className="text-slate-600">·</span>
          <span>{card.home.name} {card.pressure.home.toFixed(0)}</span>
          <span className="text-slate-600">/</span>
          <span>{card.away.name} {card.pressure.away.toFixed(0)}</span>
        </div>

        {/* ── Value block — ONLY when bettable + odds + guard pass ── */}
        {showBet && card.best_price && card.edge != null && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Market <span className="text-slate-200">{card.market_implied != null ? pct(card.market_implied) : '—'}</span></span>
              <span className="text-slate-400">Snapbet <span className="text-white font-semibold">{pct(card.model_prob)}</span></span>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/50 text-[10px]">
                <TrendingUp className="w-3 h-3 mr-0.5" /> Edge {pctSigned(card.edge)}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300">
                Best <span className="font-bold text-white">{card.best_price.odds.toFixed(2)}</span>
                <span className="text-slate-500"> ({card.best_price.book})</span>
              </span>
              {card.min_acceptable_odds != null && (
                <span className="text-[10px] text-slate-500">value while ≥ {card.min_acceptable_odds.toFixed(2)}</span>
              )}
            </div>
            <p className="text-[10px] text-slate-500">
              Confidence: {CONF_LABEL[card.confidence] ?? card.confidence}
              {!validated && <span className="text-amber-400/80"> · experimental model</span>}
            </p>
          </div>
        )}

        {/* ── Locked teaser — free users on a BETTABLE card ──────── */}
        {showLockedTeaser && (
          <Link
            href="/premium?source=live_edge_locked"
            className="block rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3 hover:border-emerald-400/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-300">
                <TrendingUp className="w-4 h-4" /> Live value detected
              </span>
              <Badge className="bg-slate-700/60 text-slate-300 border-slate-600 text-[10px]">
                <Lock className="w-3 h-3 mr-1" /> Premium
              </Badge>
            </div>
            {/* Numbers blurred/withheld — show the shape, not the value. */}
            <div className="flex items-center justify-between mt-2 text-xs select-none">
              <span className="text-slate-500">Edge <span className="blur-[5px] text-emerald-300">+0.0%</span></span>
              <span className="text-slate-500">Best <span className="blur-[5px] text-white">0.00</span></span>
            </div>
            <p className="text-[11px] text-emerald-300/90 mt-2">Unlock the price, edge &amp; reasoning →</p>
          </Link>
        )}

        {/* ── Non-bettable states ────────────────────────────────── */}
        {status === 'SUSPENDED' && (
          <div className="flex items-center gap-2 text-xs text-amber-300">
            <Ban className="w-3.5 h-3.5" /> Market suspended — price unavailable
          </div>
        )}
        {status === 'EXPIRED' && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Clock className="w-3.5 h-3.5" /> Edge gone — price moved
          </div>
        )}
        {status === 'WATCHLIST' && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <AlertTriangle className="w-3.5 h-3.5 text-slate-500" /> Watching — no value at current prices
          </div>
        )}

        {/* ── Footer ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-1">
          <Link
            href={`/live-edge/${card.match_id}`}
            className="text-xs text-blue-300 hover:text-blue-200 inline-flex items-center gap-0.5"
          >
            Why this <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </Card>
  )
}

function StatusPill({ status, ttl }: { status: string; ttl: number | null }) {
  if (status === 'BETTABLE') {
    return (
      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/50 text-[10px]">
        Bettable{ttl != null ? ` · ${ttl}s` : ''}
      </Badge>
    )
  }
  if (status === 'SUSPENDED') return <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/50 text-[10px]">Suspended</Badge>
  if (status === 'EXPIRED') return <Badge className="bg-slate-600/30 text-slate-400 border-slate-600/50 text-[10px]">Expired</Badge>
  return <Badge className="bg-slate-600/30 text-slate-300 border-slate-600/50 text-[10px]">Watching</Badge>
}
