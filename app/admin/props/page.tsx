'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowDown, ArrowUp, ChevronLeft, Loader2, RefreshCw } from 'lucide-react'
import { fmtPct, fmtPrice, fmtSigned, statLabel, sportLabel, fmtTime, RESEARCH_NOTE } from './format'

interface Row {
  estimate_id: number
  sport_key: string
  commence_time: string
  home_team: string | null
  away_team: string | null
  subject: string
  team: string | null
  stat: string
  prediction_ts: string
  mean: number | null
  actual: number | null
  threshold: number
  side: 'yes' | 'no'
  source: string
  book: string
  price: number
  price_format: string
  fee: number
  breakeven_prob: number
  displayed_prob: number | null
  our_prob: number | null
  our_lo: number | null
  our_hi: number | null
  ev: number | null
  result: string | null
  pnl: number | null
  hit_rate: number | null
  hit_n: number | null
  hit_threshold: number | null
  quotes: number
}

const COLUMNS: { key: string; label: string; sortable?: boolean; title?: string }[] = [
  { key: 'commence_time', label: 'Game', sortable: true },
  { key: 'subject', label: 'Player / team', sortable: true },
  { key: 'stat', label: 'Prop' },
  { key: 'threshold', label: 'Line', sortable: true },
  { key: 'quote', label: 'Best quote', title: 'Best executable price across books / Kalshi for this line and side' },
  { key: 'breakeven', label: 'Break-even', title: 'Win rate needed after fees at that price' },
  { key: 'displayed', label: 'Market shows', title: 'Displayed probability (no-vig average or Kalshi last) - not a tradable price' },
  { key: 'our_prob', label: 'Our estimate', sortable: true, title: 'Model probability, with the range across refits' },
  { key: 'edge', label: 'Edge', sortable: true, title: 'Our probability minus break-even' },
  { key: 'ev', label: 'EV / $1', sortable: true, title: 'Expected profit per $1 staked after fees' },
  { key: 'hit_rate', label: 'Hit rate', sortable: true, title: 'How often this player/team beat the main line in earlier games' },
  { key: 'hit_n', label: 'Games', sortable: true },
  { key: 'prediction_ts', label: 'Predicted', sortable: true },
  { key: 'result', label: 'Result' },
]

export default function PropsPage() {
  const [mode, setMode] = useState<'live' | 'backtest'>('live')
  const [rows, setRows] = useState<Row[]>([])
  const [facets, setFacets] = useState<{ sport_key: string; stat: string; estimates: number }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sport, setSport] = useState('all')
  const [stat, setStat] = useState('all')
  const [source, setSource] = useState('all')
  const [side, setSide] = useState('all')
  const [search, setSearch] = useState('')
  const [minSample, setMinSample] = useState('0')
  const [positiveOnly, setPositiveOnly] = useState(false)
  const [sort, setSort] = useState('ev')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const [report, setReport] = useState<any>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const q = new URLSearchParams({ mode, sort, dir, limit: '500' })
    if (sport !== 'all') q.set('sport', sport)
    if (stat !== 'all') q.set('stat', stat)
    if (source !== 'all') q.set('source', source)
    if (side !== 'all') q.set('side', side)
    if (search) q.set('search', search)
    if (Number(minSample) > 0) q.set('minSample', minSample)
    if (positiveOnly) q.set('positiveOnly', '1')
    try {
      const res = await fetch(`/api/admin/props?${q}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setRows(data.rows ?? [])
      setFacets(data.facets ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [mode, sort, dir, sport, stat, source, side, search, minSample, positiveOnly])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    fetch('/api/admin/props/report', { cache: 'no-store' }).then(r => r.json()).then(d => setReport(d.report)).catch(() => {})
  }, [])

  const sports = useMemo(() => Array.from(new Set(facets.map(f => f.sport_key))), [facets])
  const stats = useMemo(() => facets.filter(f => sport === 'all' || f.sport_key === sport), [facets, sport])

  const toggleSort = (key: string) => {
    if (sort === key) setDir(dir === 'desc' ? 'asc' : 'desc')
    else { setSort(key); setDir('desc') }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-[1600px] px-4 py-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/admin" className="text-sm text-slate-400 hover:text-slate-200 inline-flex items-center gap-1">
              <ChevronLeft className="h-4 w-4" /> Admin
            </Link>
            <h1 className="text-2xl font-semibold">Prop analysis</h1>
            <p className="text-sm text-slate-400 max-w-3xl">{RESEARCH_NOTE}</p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Refresh</span>
          </Button>
        </div>

        {report && <EvaluationSummary report={report} />}

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-4 flex flex-wrap gap-3 items-center">
            <Select value={mode} onValueChange={v => setMode(v as 'live' | 'backtest')}>
              <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="live">Upcoming games (live)</SelectItem>
                <SelectItem value="backtest">Past games (walk-forward)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sport} onValueChange={v => { setSport(v); setStat('all') }}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Sport" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sports</SelectItem>
                {sports.map(s => <SelectItem key={s} value={s}>{sportLabel(s)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={stat} onValueChange={setStat}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Prop" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All props</SelectItem>
                {stats.map(f => <SelectItem key={f.sport_key + f.stat} value={f.stat}>
                  {statLabel(f.stat)} ({f.estimates})</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Books + Kalshi</SelectItem>
                <SelectItem value="sportsbook">Sportsbooks</SelectItem>
                <SelectItem value="kalshi">Kalshi</SelectItem>
              </SelectContent>
            </Select>
            <Select value={side} onValueChange={setSide}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Both sides</SelectItem>
                <SelectItem value="yes">Over / Yes</SelectItem>
                <SelectItem value="no">Under / No</SelectItem>
              </SelectContent>
            </Select>
            <Select value={minSample} onValueChange={setMinSample}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Any history</SelectItem>
                <SelectItem value="15">15+ past games</SelectItem>
                <SelectItem value="30">30+ past games</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Player or team" value={search} onChange={e => setSearch(e.target.value)} className="w-[180px]" />
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <Switch checked={positiveOnly} onCheckedChange={setPositiveOnly} /> Positive EV only
            </label>
            <span className="text-xs text-slate-500 ml-auto">{rows.length} lines</span>
          </CardContent>
        </Card>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800">
                  {COLUMNS.map(c => (
                    <TableHead key={c.key} title={c.title}
                      className={`whitespace-nowrap text-slate-300 ${c.sortable ? 'cursor-pointer select-none hover:text-white' : ''}`}
                      onClick={c.sortable ? () => toggleSort(c.key) : undefined}>
                      <span className="inline-flex items-center gap-1">{c.label}
                        {sort === c.key && (dir === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => {
                  const edge = r.our_prob != null ? r.our_prob - r.breakeven_prob : null
                  return (
                    <TableRow key={`${r.estimate_id}-${r.threshold}-${r.side}`} className="border-slate-800 hover:bg-slate-800/60">
                      <TableCell className="whitespace-nowrap text-xs text-slate-400">
                        <div>{r.away_team} @ {r.home_team}</div>
                        <div>{fmtTime(r.commence_time)}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Link href={`/admin/props/${r.estimate_id}`} className="text-sky-300 hover:underline">{r.subject}</Link>
                        <div className="text-xs text-slate-500">{sportLabel(r.sport_key)}{r.team && r.subject !== r.team ? ` · ${r.team}` : ''}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{statLabel(r.stat)}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.side === 'yes' ? 'Over' : 'Under'} {r.threshold}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {fmtPrice(r.price, r.price_format)} <span className="text-xs text-slate-500">{r.book}</span>
                        {r.quotes > 1 && <span className="text-xs text-slate-600"> · {r.quotes} quotes</span>}
                      </TableCell>
                      <TableCell>{fmtPct(r.breakeven_prob)}{r.fee > 0 && <span className="text-xs text-slate-500"> incl. fee</span>}</TableCell>
                      <TableCell className="text-slate-400">{fmtPct(r.displayed_prob)}</TableCell>
                      <TableCell className="whitespace-nowrap">{fmtPct(r.our_prob)}
                        <span className="text-xs text-slate-500"> ({fmtPct(r.our_lo, 0)}–{fmtPct(r.our_hi, 0)})</span></TableCell>
                      <TableCell className={edge != null && edge > 0 ? 'text-emerald-400' : 'text-slate-400'}>{fmtSigned(edge)}</TableCell>
                      <TableCell className={r.ev != null && r.ev > 0 ? 'text-emerald-400 font-medium' : 'text-slate-400'}>{fmtSigned(r.ev)}</TableCell>
                      <TableCell>{fmtPct(r.hit_rate)}{r.hit_threshold != null && r.hit_threshold !== r.threshold &&
                        <span className="text-xs text-slate-500"> @{r.hit_threshold}</span>}</TableCell>
                      <TableCell>{r.hit_n ?? '–'}{r.hit_n != null && r.hit_n < 15 &&
                        <Badge variant="outline" className="ml-1 border-amber-600 text-amber-400 text-[10px]">small</Badge>}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-slate-400">{fmtTime(r.prediction_ts)}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {r.result ? <span className={r.result === 'win' ? 'text-emerald-400' : r.result === 'loss' ? 'text-red-400' : 'text-slate-400'}>
                          {r.result}{r.actual != null ? ` (${r.actual})` : ''}</span> : <span className="text-slate-600">open</span>}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {!loading && rows.length === 0 && (
                  <TableRow><TableCell colSpan={COLUMNS.length} className="text-center text-slate-500 py-10">
                    {mode === 'live' ? 'No upcoming props with quotes yet. Player props are pulled 30-90 minutes before tip; Kalshi props open a few hours before.' : 'No backtest estimates yet.'}
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function EvaluationSummary({ report }: { report: { created_at: string; report: any } }) {
  const r = report.report
  const strategies = Object.entries(r.strategies ?? {}) as [string, any][]
  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Walk-forward evaluation
          <span className="ml-2 text-xs font-normal text-slate-400">
            {r.period?.[0]} to {r.period?.[1]} · {r.games} games · {r.settled_main_lines} settled main lines ·
            later half from {r.split_date} · report {fmtTime(report.created_at)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow className="border-slate-800">
              <TableHead>Prop family</TableHead><TableHead>Settled</TableHead>
              <TableHead title="Log loss at the main line, lower is better">Model</TableHead>
              <TableHead>Market</TableHead><TableHead>Blend</TableHead>
              <TableHead title="Mean absolute error of our mean vs the market's main line">MAE model / line</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(r.families ?? []).map((f: any) => (
                <TableRow key={f.sport + f.stat} className="border-slate-800">
                  <TableCell className="whitespace-nowrap">{sportLabel(f.sport)} {statLabel(f.stat)}
                    {f.small_sample && <Badge variant="outline" className="ml-1 border-amber-600 text-amber-400 text-[10px]">small</Badge>}</TableCell>
                  <TableCell>{f.settled_main_lines}</TableCell>
                  <TableCell className={f.logloss_model != null && f.logloss_model < f.logloss_market ? 'text-emerald-400' : ''}>{f.logloss_model ?? '–'}</TableCell>
                  <TableCell>{f.logloss_market ?? '–'}</TableCell>
                  <TableCell>{f.logloss_blend ?? '–'}</TableCell>
                  <TableCell className="whitespace-nowrap">{f.mae_model ?? '–'} / {f.mae_market_line ?? '–'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow className="border-slate-800">
              <TableHead>Strategy (one bet per prop)</TableHead><TableHead>Earlier half</TableHead>
              <TableHead>Later half (90% range)</TableHead><TableHead>Holds?</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {strategies.map(([name, s]) => (
                <TableRow key={name} className="border-slate-800">
                  <TableCell className="text-xs">{s.description}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{s.earlier_half?.bets ?? 0} bets · {fmtSigned(s.earlier_half?.roi)}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{s.later_half?.bets ?? 0} bets · {fmtSigned(s.later_half?.roi)}
                    {s.later_half?.roi_ci90 && <span className="text-slate-500"> ({fmtSigned(s.later_half.roi_ci90[0])} to {fmtSigned(s.later_half.roi_ci90[1])})</span>}</TableCell>
                  <TableCell>{s.survives ? <Badge className="bg-emerald-700">yes</Badge> : <span className="text-slate-500 text-xs">no</span>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-xs text-slate-500 mt-2">A strategy holds only if it made money in the earlier half and the later half&apos;s 90% range is above zero ({'>'}= 60 bets).</p>
        </div>
      </CardContent>
    </Card>
  )
}
