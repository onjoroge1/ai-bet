'use client'

import { use, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { fmtPct, fmtPrice, fmtSigned, fmtTime, RESEARCH_NOTE, sportLabel, statLabel } from '../format'

export default function PropDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/admin/props/${id}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setData)
      .catch(e => setError(e.message))
  }, [id])

  if (error) return <Shell><p className="text-red-400">{error}</p></Shell>
  if (!data) return <Shell><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></Shell>
  return <Shell><Detail data={data} /></Shell>
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-[1400px] px-4 py-6 space-y-4">
        <Link href="/admin/props" className="text-sm text-slate-400 hover:text-slate-200 inline-flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> All props
        </Link>
        {children}
      </div>
    </div>
  )
}

function Detail({ data }: { data: any }) {
  const e = data.estimate
  const lines: any[] = data.lines
  const curve: any[] = e.curve ?? []
  const hr = e.hit_rate
  const factors = e.factors?.items ?? []
  const fam = data.family

  // chart: our P(stat > t) with its refit range, and every quote's break-even (after fees) for the Over/Yes side
  const chart = useMemo(() => curve.map(c => ({ t: c.t, p: c.p, range: [c.lo, c.hi] })), [curve])
  const books = useMemo(() => lines.filter(l => l.side === 'yes' && l.source === 'sportsbook')
    .map(l => ({ t: l.threshold, be: l.breakeven_prob, book: l.book, price: l.price })), [lines])
  const kalshi = useMemo(() => lines.filter(l => l.side === 'yes' && l.source === 'kalshi')
    .map(l => ({ t: l.threshold, be: l.breakeven_prob, book: 'kalshi', price: l.price })), [lines])
  const shown = useMemo(() => {
    const m = new Map<number, number[]>()
    lines.filter(l => l.side === 'yes' && l.displayed_prob != null).forEach(l => {
      m.set(l.threshold, [...(m.get(l.threshold) ?? []), l.displayed_prob])
    })
    return Array.from(m.entries()).map(([t, v]) => ({ t, shown: v.reduce((a, b) => a + b, 0) / v.length }))
  }, [lines])
  const ts = lines.map(l => l.threshold)
  const xMin = Math.min(...ts, ...(curve.length ? [curve[0].t] : []))
  const xMax = Math.max(...ts, ...(curve.length ? [curve[curve.length - 1].t] : []))
  const pad = Math.max(2, (xMax - xMin) * 0.25)
  const chartData = chart.filter(c => c.t >= Math.min(...ts) - pad && c.t <= Math.max(...ts) + pad)
  const isWin = e.stat === 'team_win'

  return (
    <>
      <div>
        <div className="text-sm text-slate-400">{sportLabel(e.sport_key)} · {e.away_team} @ {e.home_team} · {fmtTime(e.commence_time)}</div>
        <h1 className="text-2xl font-semibold">{e.subject} — {statLabel(e.stat)}</h1>
        <div className="text-sm text-slate-400 mt-1 flex flex-wrap gap-x-4">
          <span>Expected: <b className="text-slate-100">{e.mean?.toFixed(isWin ? 1 : 2)}</b>{isWin ? ' pt margin' : ''}
            {e.dist_params?.mean_range && <span> (refit range {e.dist_params.mean_range[0]}–{e.dist_params.mean_range[1]})</span>}</span>
          <span>Distribution: {e.dist}{e.dist_params?.r ? `, dispersion r=${e.dist_params.r}` : ''}{e.dist_params?.sd ? `, sd ${e.dist_params.sd}` : ''}</span>
          <span>Trained on {e.dist_params?.n_train?.toLocaleString()} {e.subject_type === 'player' ? 'player-games' : 'team-games'}</span>
          {e.dist_params?.p_play != null && <span title="Kalshi settles No when a player is inactive; books void the bet">
            Chance he plays: <b className="text-slate-100">{fmtPct(e.dist_params.p_play, 0)}</b>
            {e.dist_params.injury_status ? ` (listed ${e.dist_params.injury_status})` : ''} — applied to Kalshi prices only</span>}
          <span>Latest prediction: <b className="text-slate-100">{fmtTime(e.prediction_ts)}</b> ({e.mode}, {e.model_version})</span>
          {e.actual != null && <span>Actual: <b className="text-slate-100">{e.actual}</b></span>}
        </div>
        <p className="text-xs text-slate-500 mt-2 max-w-4xl">{RESEARCH_NOTE}</p>
      </div>

      {!isWin && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-0"><CardTitle className="text-base">Threshold vs probability of going over</CardTitle></CardHeader>
          <CardContent className="h-[380px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                <CartesianGrid stroke="#1e293b" />
                <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} stroke="#94a3b8"
                  label={{ value: `${statLabel(e.stat)} line`, position: 'insideBottom', offset: -5, fill: '#94a3b8' }} />
                <YAxis domain={[0, 1]} tickFormatter={v => `${Math.round(v * 100)}%`} stroke="#94a3b8" />
                <Tooltip formatter={(v: any, n: any) => Array.isArray(v) ? `${fmtPct(v[0])}–${fmtPct(v[1])}` : fmtPct(v)}
                  labelFormatter={l => `line ${l}`} contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
                <Legend />
                <Area dataKey="range" name="Our refit range" stroke="none" fill="#38bdf8" fillOpacity={0.18} isAnimationActive={false} />
                <Line dataKey="p" name="Our estimate" stroke="#38bdf8" dot={false} strokeWidth={2} isAnimationActive={false} />
                <Scatter data={books} dataKey="be" name="Book break-even (Over, after margin)" fill="#f59e0b" />
                <Scatter data={kalshi} dataKey="be" name="Kalshi Yes ask + fee" fill="#a78bfa" shape="diamond" />
                <Scatter data={shown} dataKey="shown" name="Market shows (no-vig / last)" fill="#94a3b8" shape="cross" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
          <p className="px-6 pb-4 text-xs text-slate-500">An Over is worth taking only where our line sits ABOVE the price point
            (we think it hits more often than the break-even). The shaded band only reflects refitting the model; it does
            not cover everything the model doesn&apos;t know.</p>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2"><CardTitle className="text-base">What moves the estimate</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow className="border-slate-800"><TableHead>Factor</TableHead><TableHead>Value</TableHead>
                <TableHead title="Push on the estimate vs an average player-game, in stat units">Effect</TableHead></TableRow></TableHeader>
              <TableBody>
                {factors.map((f: any) => (
                  <TableRow key={f.feature} className="border-slate-800">
                    <TableCell>{f.label}</TableCell><TableCell>{f.value ?? '–'}</TableCell>
                    <TableCell className={f.effect > 0 ? 'text-emerald-400' : 'text-red-400'}>{f.effect > 0 ? '+' : ''}{f.effect} {e.factors?.unit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {e.factors?.teammates_out?.length > 0 && <p className="text-sm text-slate-300 mt-2">Rotation teammates listed out
              before the prediction: {e.factors.teammates_out.join(', ')}</p>}
            {fam && <p className="text-xs text-slate-500 mt-3">This family in the walk-forward test: {fam.settled_main_lines} settled main lines,
              log loss model {fam.logloss_model ?? '–'} vs market {fam.logloss_market ?? '–'} (lower is better)
              {fam.small_sample ? ' — small sample' : ''}.</p>}
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2"><CardTitle className="text-base">
            Historical hit rate {hr ? `over ${hr.threshold}` : ''}</CardTitle></CardHeader>
          <CardContent>
            {!hr ? <p className="text-slate-500 text-sm">No history.</p> : (
              <Table>
                <TableHeader><TableRow className="border-slate-800"><TableHead>Condition</TableHead><TableHead>Games</TableHead>
                  <TableHead>Hit rate</TableHead><TableHead>95% range</TableHead><TableHead>Today</TableHead></TableRow></TableHeader>
                <TableBody>
                  {[hr.overall, hr.last_10, ...(hr.by_condition ?? [])].filter(Boolean).map((c: any) => (
                    <TableRow key={c.condition} className="border-slate-800">
                      <TableCell>{c.condition}</TableCell>
                      <TableCell>{c.n}{c.small_sample && <Badge variant="outline" className="ml-1 border-amber-600 text-amber-400 text-[10px]">small</Badge>}</TableCell>
                      <TableCell>{fmtPct(c.rate)}</TableCell>
                      <TableCell className="text-slate-400">{c.lo != null ? `${fmtPct(c.lo, 0)}–${fmtPct(c.hi, 0)}` : '–'}</TableCell>
                      <TableCell>{c.applies_today ? '✓' : ''}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <p className="text-xs text-slate-500 mt-2">One row per past game, so several lines from one game never count twice.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-2"><CardTitle className="text-base">Every quote at the prediction time</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow className="border-slate-800">
              <TableHead>Line</TableHead><TableHead>Side</TableHead><TableHead>Book</TableHead><TableHead>Price</TableHead>
              <TableHead>Fee</TableHead><TableHead>Break-even</TableHead><TableHead>Market shows</TableHead>
              <TableHead>Our estimate</TableHead><TableHead>EV / $1</TableHead><TableHead>Price we'd need</TableHead>
              <TableHead>Quoted</TableHead><TableHead>Result</TableHead></TableRow></TableHeader>
            <TableBody>
              {lines.map((l, i) => (
                <TableRow key={i} className="border-slate-800">
                  <TableCell>{l.threshold}</TableCell>
                  <TableCell>{l.side === 'yes' ? 'Over / Yes' : 'Under / No'}</TableCell>
                  <TableCell>{l.book}</TableCell>
                  <TableCell>{fmtPrice(l.price, l.price_format)}</TableCell>
                  <TableCell>{l.fee > 0 ? `${(l.fee * 100).toFixed(2)}¢` : '–'}</TableCell>
                  <TableCell>{fmtPct(l.breakeven_prob)}</TableCell>
                  <TableCell className="text-slate-400">{fmtPct(l.displayed_prob)}</TableCell>
                  <TableCell>{fmtPct(l.our_prob)} <span className="text-xs text-slate-500">({fmtPct(l.our_lo, 0)}–{fmtPct(l.our_hi, 0)})</span></TableCell>
                  <TableCell className={l.ev > 0 ? 'text-emerald-400' : 'text-slate-400'}>{fmtSigned(l.ev)}</TableCell>
                  <TableCell className="text-slate-400">{neededPrice(l)}</TableCell>
                  <TableCell className="text-xs text-slate-500 whitespace-nowrap">{fmtTime(l.quote_ts)}</TableCell>
                  <TableCell className="text-xs">{l.result ?? 'open'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {data.rules?.length > 0 && (
            <div className="mt-3 space-y-1">
              <div className="text-xs text-slate-400">Kalshi rules (as published with each market):</div>
              {data.rules.map((r: any) => <p key={r.ticker} className="text-xs text-slate-500"><code>{r.ticker}</code>: {r.rules_primary ?? '—'}
                {r.result != null && ` (settled: ${r.result === '' ? 'fair price / void' : r.result})`}</p>)}
            </div>
          )}
        </CardContent>
      </Card>

      {(e.combos ?? []).length > 0 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2"><CardTitle className="text-base">Combos with this player&apos;s other lines</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow className="border-slate-800"><TableHead>Both over</TableHead><TableHead>This line</TableHead>
                <TableHead>Other line</TableHead><TableHead title="How the model's misses for the two stats move together">Correlation</TableHead>
                <TableHead>Joint estimate</TableHead><TableHead>If independent</TableHead><TableHead>Price</TableHead></TableRow></TableHeader>
              <TableBody>
                {e.combos.map((c: any) => (
                  <TableRow key={c.with} className="border-slate-800">
                    <TableCell>{statLabel(e.stat)} {c.line}+ and {statLabel(c.with)} {c.with_line}+</TableCell>
                    <TableCell>{fmtPct(c.p_this)}</TableCell><TableCell>{fmtPct(c.p_with)}</TableCell>
                    <TableCell>{c.rho}</TableCell><TableCell className="font-medium">{fmtPct(c.p_joint)}</TableCell>
                    <TableCell className="text-slate-400">{fmtPct(c.p_if_independent)}</TableCell>
                    <TableCell className="text-xs text-slate-500">{c.note}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {data.related?.length > 0 && (
        <p className="text-sm text-slate-400">Other props for {e.subject} in this game:{' '}
          {data.related.map((r: any, i: number) => <span key={r.id}>{i > 0 && ' · '}
            <Link href={`/admin/props/${r.id}`} className="text-sky-300 hover:underline">{statLabel(r.stat)}</Link></span>)}</p>
      )}

      {(e.history ?? []).length > 1 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2"><CardTitle className="text-base">Estimate and market over time</CardTitle></CardHeader>
          <CardContent className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={e.history.map((h: any) => ({ ...h, label: fmtTime(h.ts) }))}>
                <CartesianGrid stroke="#1e293b" />
                <XAxis dataKey="label" stroke="#94a3b8" />
                <YAxis yAxisId="m" stroke="#38bdf8" />
                <YAxis yAxisId="p" orientation="right" domain={[0, 1]} stroke="#f59e0b" tickFormatter={v => `${Math.round(v * 100)}%`} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
                <Legend />
                <Line yAxisId="m" dataKey="mean" name="Our expected value" stroke="#38bdf8" isAnimationActive={false} />
                <Line yAxisId="p" dataKey="market_main" name="Market at main line" stroke="#f59e0b" isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </>
  )
}

function neededPrice(l: any) {
  const p = l.our_prob
  if (p == null || p <= 0 || p >= 1) return '–'
  if (l.price_format === 'decimal') return `${(1 / p).toFixed(2)} or better`
  // Kalshi: highest ask whose ask + fee (100-contract order) is still <= p
  let a = Math.floor(p * 100) / 100
  const fee = (x: number) => Math.ceil(0.07 * 100 * x * (1 - x) * 100 - 1e-9) / 100 / 100
  while (a > 0 && a + fee(a) > p) a = Math.round((a - 0.01) * 100) / 100
  return a > 0 ? `${Math.round(a * 100)}¢ or less` : '–'
}
