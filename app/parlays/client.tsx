"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Trophy,
  TrendingUp,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  ChevronRight,
  AlertCircle,
  Loader2,
  Layers,
  ShieldCheck,
} from "lucide-react"

// ─── Types matching /api/parlays/preview ───────────────────────────

interface Leg {
  outcome: string
  match_id: string | null
  away_team: string
  home_team: string
  league: string | null
  model_prob: number
  decimal_odds: number
  kickoff: string
  leg_type: 'premium_1x2' | 'sgp_overlay'
}

interface Parlay {
  parlay_id: string
  archetype: string                       // 'cross_match' | 'sgp_single_match'
  leg_count: number
  sgp_leg_count: number
  legs: Leg[]
  combined_odds: number
  combined_prob: number
  earliest_kickoff: string
  latest_kickoff: string
  risk_level: 'low' | 'medium' | 'high'
  result?: 'pending' | 'win' | 'loss' | 'void'
  settled_at?: string
  net_dollars?: number
}

interface ArchetypeStats {
  settled: number
  wins: number
  losses: number
  hit_rate_pct: number
  net_dollars: number
  roi_pct: number
}

interface Stats {
  window_days: number
  settled: number
  wins: number
  losses: number
  hit_rate_pct: number
  net_dollars: number
  total_staked: number
  roi_pct: number
  avg_combined_odds: number
  by_archetype: Record<string, ArchetypeStats>
}

interface ApiResponse {
  pending: Parlay[]
  recent: Parlay[]
  stats: Stats | null
  meta?: { source: string; leg_counts_shown: number[]; note?: string }
}

// ─── Helpers ───────────────────────────────────────────────────────

const fmtUSD = (n: number) => {
  const sign = n > 0 ? '+' : n < 0 ? '−' : ''
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}
const fmtPctSigned = (p: number) => {
  const sign = p > 0 ? '+' : p < 0 ? '−' : ''
  return `${sign}${Math.abs(p).toFixed(1)}%`
}
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const fmtKickoff = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
const dollarTone = (n: number) =>
  n > 0 ? 'text-emerald-300' : n < 0 ? 'text-red-300' : 'text-slate-200'

const archetypeLabel = (a: string) =>
  a === 'cross_match' ? 'Cross-match' :
  a === 'sgp_single_match' ? 'Same-match SGP' :
  a

// ─── Page ──────────────────────────────────────────────────────────

export default function PublicParlaysClient() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/parlays/preview')
      .then(r => r.json())
      .then((d: ApiResponse) => { if (!cancelled) setData(d) })
      .catch(e => { if (!cancelled) setError(String(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-300 animate-spin" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
        <Card className="bg-red-950/40 border-red-500/40 max-w-md">
          <CardContent className="p-6 text-red-300">
            <AlertCircle className="w-6 h-6 mb-2" />
            <p className="text-sm">Couldn&apos;t load parlays. Try refreshing.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { pending, recent, stats } = data

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <article className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">

        {/* ── Hero ───────────────────────────────────────────────── */}
        <header>
          <p className="text-xs uppercase tracking-widest text-amber-300 font-semibold flex items-center gap-2">
            <Trophy className="w-3.5 h-3.5" />
            Premium-only parlays
          </p>
          <h1 className="text-3xl sm:text-5xl font-bold text-white mt-2 leading-tight">
            AI parlays you can audit.
          </h1>
          <p className="text-slate-300 mt-3 text-base sm:text-lg max-w-2xl leading-relaxed">
            Every leg comes from a premium-qualified AI pick (V3 confidence ≥60%).
            Cross-match for diversification, same-match SGP for upside. Every
            historical result is on{' '}
            <Link href="/performance" className="text-blue-300 hover:text-blue-200 underline">
              /performance
            </Link>
            .
          </p>
        </header>

        {/* ── Tracker headline ───────────────────────────────────── */}
        {stats && stats.settled > 0 && (
          <Card className="bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 border-amber-500/30">
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-amber-300 font-semibold flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Last {stats.window_days}d · {stats.settled} settled
                  </p>
                  <p className={`text-4xl sm:text-5xl font-bold mt-2 ${dollarTone(stats.net_dollars)}`}>
                    {fmtUSD(stats.net_dollars)}
                  </p>
                  <p className="text-sm text-slate-300 mt-2">
                    Record <span className="text-white font-semibold">{stats.wins}–{stats.losses}</span>
                    {' · '}
                    Hit rate <span className="text-white font-semibold">{stats.hit_rate_pct.toFixed(1)}%</span>
                    {' · '}
                    ROI <span className={dollarTone(stats.roi_pct)}>{fmtPctSigned(stats.roi_pct)}</span>
                    {' · '}
                    Avg combined odds <span className="text-white font-semibold">{stats.avg_combined_odds.toFixed(2)}</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-2">
                    Flat $10 stake per parlay. All historical settles shown — wins and losses included.
                  </p>
                </div>
                <Link href="/performance" className="text-sm text-amber-200 hover:text-amber-100 underline underline-offset-2">
                  Full audit →
                </Link>
              </div>
              {Object.keys(stats.by_archetype).length > 1 && (
                <div className="mt-4 pt-4 border-t border-slate-700/60 grid sm:grid-cols-2 gap-3">
                  {Object.entries(stats.by_archetype).map(([a, s]) => (
                    <div key={a} className="text-xs">
                      <p className="text-slate-400 uppercase tracking-wide">{archetypeLabel(a)}</p>
                      <p className="text-slate-200 mt-0.5">
                        {s.wins}-{s.losses} · hit {s.hit_rate_pct.toFixed(0)}% · ROI{' '}
                        <span className={dollarTone(s.roi_pct)}>{fmtPctSigned(s.roi_pct)}</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Pending parlays ─────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-3 border-b border-slate-700/60 pb-2">
            <Clock className="w-5 h-5 text-blue-300" />
            Today&apos;s parlays ({pending.length})
          </h2>
          {pending.length === 0 ? (
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6 sm:p-8 text-center space-y-3">
                <Calendar className="w-10 h-10 text-slate-500 mx-auto" />
                <p className="text-sm text-slate-300">
                  No live parlays right now. Premium-qualified picks are rare —
                  the model only surfaces them on matches it has high conviction on.
                </p>
                <p className="text-xs text-slate-500">
                  {data.meta?.note ?? 'Check back in a few hours.'}
                </p>
                <div className="flex flex-wrap gap-3 justify-center pt-2">
                  <Button asChild variant="outline" className="border-slate-700 text-slate-200 hover:bg-slate-700">
                    <Link href="/premium">See today&apos;s premium picks →</Link>
                  </Button>
                  <Button asChild variant="outline" className="border-slate-700 text-slate-200 hover:bg-slate-700">
                    <Link href="/performance">Full audit →</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {pending.map(p => <ParlayCard key={p.parlay_id} p={p} />)}
            </div>
          )}
        </section>

        {/* ── Recent settled results ─────────────────────────────── */}
        {recent.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-3 border-b border-slate-700/60 pb-2">
              <ShieldCheck className="w-5 h-5 text-emerald-300" />
              Recent results
            </h2>
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-0">
                <div className="divide-y divide-slate-700/60">
                  {recent.map(p => <RecentRow key={p.parlay_id} p={p} />)}
                </div>
              </CardContent>
            </Card>
            <p className="text-xs text-slate-500 mt-3">
              Showing the most recent {recent.length} settled parlays — wins and losses interleaved.
              {' '}<Link href="/performance" className="text-blue-300 hover:text-blue-200 underline">Full audit table →</Link>
            </p>
          </section>
        )}

        {/* ── Disclaimer ─────────────────────────────────────────── */}
        <Card className="bg-slate-900/60 border-slate-700">
          <CardContent className="p-5 text-xs text-slate-400 leading-relaxed flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
            <span>
              AI-generated picks for informational use only. Combined odds use consensus
              market prices at the time each leg was surfaced. Past performance does not
              guarantee future results. Sample sizes are small — interpret accordingly.{' '}
              <Link href="/methodology" className="text-blue-300 hover:text-blue-200 underline">Methodology</Link>
              {' · '}
              <Link href="/responsible-betting" className="text-blue-300 hover:text-blue-200 underline">Bet responsibly</Link>
            </span>
          </CardContent>
        </Card>
      </article>
    </div>
  )
}

// ─── Subcomponents ─────────────────────────────────────────────────

function ParlayCard({ p }: { p: Parlay }) {
  const isCross = p.archetype === 'cross_match'
  return (
    <Card className="bg-slate-800 border-slate-700 hover:border-blue-500/40 transition-colors">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <Badge className={
            isCross
              ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 text-[10px] uppercase'
              : 'bg-purple-500/20 text-purple-300 border-purple-500/40 text-[10px] uppercase'
          }>
            <Layers className="w-3 h-3 mr-1" />
            {archetypeLabel(p.archetype)}
          </Badge>
          <Badge className="bg-slate-700/50 text-slate-300 border-slate-600 text-[10px] uppercase">
            {p.leg_count} legs
          </Badge>
        </div>
        <div className="space-y-2 mb-4">
          {p.legs.map((leg, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="text-slate-500 mt-0.5">{i + 1}.</span>
              <div className="flex-1 min-w-0">
                <p className="text-white truncate">
                  {leg.home_team} <span className="text-slate-500">vs</span> {leg.away_team}
                </p>
                <p className="text-xs text-slate-400">
                  {leg.leg_type === 'sgp_overlay' ? leg.outcome : 'Pick'} · {leg.decimal_odds.toFixed(2)}
                  {leg.league && <> · {leg.league}</>}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-end justify-between pt-3 border-t border-slate-700/60">
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Combined odds</p>
            <p className="text-2xl font-bold text-amber-300">{p.combined_odds.toFixed(2)}x</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">$10 returns</p>
            <p className="text-lg font-semibold text-white">
              ${(10 * (p.combined_odds - 1)).toFixed(0)} profit
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {fmtKickoff(p.earliest_kickoff)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function RecentRow({ p }: { p: Parlay }) {
  const isWin = p.result === 'win'
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="text-[10px] text-slate-500 w-12 flex-shrink-0">
          {p.settled_at ? fmtDate(p.settled_at) : '—'}
        </span>
        <div className="min-w-0">
          <p className="text-sm text-white truncate">
            {p.legs.slice(0, 2).map(l => `${l.home_team} vs ${l.away_team}`).join(' · ')}
            {p.legs.length > 2 && ` +${p.legs.length - 2}`}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {archetypeLabel(p.archetype)} · {p.leg_count} legs · odds {p.combined_odds.toFixed(2)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Badge className={isWin
          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]'
          : 'bg-red-500/20 text-red-300 border-red-500/40 text-[10px]'
        }>
          {isWin ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
          {isWin ? 'Win' : 'Loss'}
        </Badge>
        <span className={`text-sm font-mono font-semibold ${dollarTone(p.net_dollars ?? 0)} w-16 text-right`}>
          {fmtUSD(p.net_dollars ?? 0)}
        </span>
        <ChevronRight className="w-4 h-4 text-slate-500 hidden sm:block" />
      </div>
    </div>
  )
}
