"use client"

import { use, useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Radio, Lightbulb, Activity, Clock, TrendingDown, TrendingUp } from 'lucide-react'
import type { LiveEdgeMatchDetail } from '@/lib/live-edge/types'
import { effectiveStatus, canRenderBet, secondsUntilExpiry } from '@/lib/live-edge/logic'

const POLL_MS = 25_000

export default function LiveEdgeDetailPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = use(params)
  const [detail, setDetail] = useState<LiveEdgeMatchDetail | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'unavailable'>('loading')
  const [now, setNow] = useState(() => new Date())

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/live-edge/match/${matchId}`, { cache: 'no-store' })
      if (!res.ok) { setStatus('unavailable'); return }
      setDetail(await res.json())
      setStatus('ok')
    } catch {
      setStatus('unavailable')
    }
  }, [matchId])

  useEffect(() => { load(); const id = setInterval(load, POLL_MS); return () => clearInterval(id) }, [load])
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id) }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <Link href="/live-edge" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Back to Live Edge
        </Link>

        {status === 'loading' && (
          <Card className="bg-slate-800/40 border-slate-700"><CardContent className="p-10 text-center text-slate-400 text-sm">Loading…</CardContent></Card>
        )}

        {status === 'unavailable' && (
          <Card className="bg-slate-800/40 border-slate-700">
            <CardContent className="p-10 text-center">
              <Radio className="w-8 h-8 text-slate-500 mx-auto mb-3" />
              <p className="text-white font-semibold">This match isn&apos;t live right now</p>
              <p className="text-slate-400 text-sm mt-1">Live Edge detail is available while a match is in play.</p>
              <Link href="/live-edge" className="text-blue-300 hover:text-blue-200 text-sm mt-3 inline-block">See the live board →</Link>
            </CardContent>
          </Card>
        )}

        {status === 'ok' && detail && <DetailBody detail={detail} now={now} />}
      </div>
    </div>
  )
}

function pct(frac: number): string { return `${(frac * 100).toFixed(1)}%` }
function pctSigned(frac: number): string { const p = frac * 100; return `${p > 0 ? '+' : '−'}${Math.abs(p).toFixed(1)}%` }

function DetailBody({ detail, now }: { detail: LiveEdgeMatchDetail; now: Date }) {
  const eff = effectiveStatus(detail, now)
  const showBet = canRenderBet(detail, now)
  const validated = detail.model_track_record?.edge_validated === true
  const ttl = secondsUntilExpiry(detail, now)

  return (
    <>
      {/* Header */}
      <Card className="bg-slate-800/60 border-slate-700">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-400">
              <Radio className="w-3.5 h-3.5 animate-pulse" /> {detail.minute}&apos; {detail.period}
            </span>
            <Badge className={
              eff === 'BETTABLE' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
              : eff === 'SUSPENDED' ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
              : 'bg-slate-600/30 text-slate-300 border-slate-600/50'
            }>
              {eff === 'BETTABLE' ? `Bettable${ttl != null ? ` · ${ttl}s` : ''}` : eff.charAt(0) + eff.slice(1).toLowerCase()}
            </Badge>
          </div>
          <div className="flex items-center justify-between mt-3">
            <span className="text-lg font-bold text-white">{detail.home.name}</span>
            <span className="text-2xl font-bold text-white tabular-nums px-3">{detail.home.score}–{detail.away.score}</span>
            <span className="text-lg font-bold text-white text-right">{detail.away.name}</span>
          </div>
          <p className="text-sm text-slate-300 mt-3">
            Pick: <span className="text-white font-semibold">{detail.market.replace(/_/g, ' ')}</span>
          </p>

          {/* Value — only when bettable + guard passes */}
          {showBet && detail.best_price && detail.edge != null && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-4 mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Market <span className="text-slate-200">{detail.market_implied != null ? pct(detail.market_implied) : '—'}</span></span>
                <span className="text-slate-400">Snapbet <span className="text-white font-semibold">{pct(detail.model_prob)}</span></span>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/50">
                  <TrendingUp className="w-3 h-3 mr-1" /> Edge {pctSigned(detail.edge)}
                </Badge>
              </div>
              <div className="text-sm text-slate-300">
                Best odds <span className="font-bold text-white">{detail.best_price.odds.toFixed(2)}</span>
                <span className="text-slate-500"> ({detail.best_price.book})</span>
                {detail.min_acceptable_odds != null && (
                  <span className="text-xs text-slate-500"> · value while ≥ {detail.min_acceptable_odds.toFixed(2)}</span>
                )}
              </div>
              {!validated && <p className="text-[11px] text-amber-400/80">Experimental live model — not yet validated against the closing line.</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Why bullets — the trust builder */}
      {detail.why?.length > 0 && (
        <Card className="bg-slate-800/60 border-slate-700">
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-amber-300" /> Why this
            </h2>
            <ul className="space-y-1.5">
              {detail.why.map((w, i) => (
                <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">•</span> {w}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Odds movement */}
      {detail.odds_movement && detail.odds_movement.last_5min?.length > 0 && (
        <Card className="bg-slate-800/60 border-slate-700">
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-2">
              {detail.odds_movement.drifting ? <TrendingDown className="w-4 h-4 text-red-300" /> : <TrendingUp className="w-4 h-4 text-emerald-300" />}
              Odds movement (last 5 min)
            </h2>
            <div className="flex items-center gap-2 text-sm font-mono text-slate-300">
              {detail.odds_movement.last_5min.map((o, i) => (
                <span key={i} className={i === detail.odds_movement!.last_5min.length - 1 ? 'text-white font-bold' : 'text-slate-400'}>
                  {o.toFixed(2)}{i < detail.odds_movement!.last_5min.length - 1 ? ' →' : ''}
                </span>
              ))}
            </div>
            {detail.odds_movement.drifting && <p className="text-[11px] text-amber-400/80 mt-1">⚠ odds drifting — price moving against the bet</p>}
          </CardContent>
        </Card>
      )}

      {/* Alert history */}
      {detail.alert_history?.length > 0 && (
        <Card className="bg-slate-800/60 border-slate-700">
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-blue-300" /> Alert history
            </h2>
            <div className="space-y-1.5">
              {detail.alert_history.map((a, i) => (
                <div key={i} className="flex items-center gap-3 text-xs">
                  <span className="text-slate-500 w-10">{a.minute}&apos;</span>
                  <span className="text-slate-300">{a.status}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pressure */}
      <Card className="bg-slate-800/60 border-slate-700">
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-purple-300" /> Live pressure
          </h2>
          <div className="flex items-center gap-4 text-sm text-slate-300">
            <span>{detail.home.name}: <span className="text-white font-semibold">{detail.pressure.home.toFixed(0)}</span></span>
            <span>{detail.away.name}: <span className="text-white font-semibold">{detail.pressure.away.toFixed(0)}</span></span>
            <span className="text-slate-500">total {detail.pressure.total.toFixed(0)}</span>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
