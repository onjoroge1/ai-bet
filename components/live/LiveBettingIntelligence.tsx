"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity, TrendingUp, TrendingDown, Loader2, Target, Zap } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────
interface CLVResponse {
  betting_intelligence?: {
    clv?: { home: number; draw: number; away: number }
  }
  home?: { name: string }
  away?: { name: string }
}

interface TopMarket {
  id: string
  marketType: string
  marketSubtype: string
  line: number | null
  decimalOdds: number | null
  consensusProb: number
  modelAgreement: number
  edge: number
  riskLevel: string | null
  displayLabel: string
}

interface TopMarketsResponse {
  markets: TopMarket[]
}

interface OddsPoint {
  t: string
  h: number | null
  d: number | null
  a: number | null
}

interface OddsHistoryResponse {
  points: OddsPoint[]
}

interface Props {
  matchId: string
  homeTeam: string
  awayTeam: string
}

export function LiveBettingIntelligence({ matchId, homeTeam, awayTeam }: Props) {
  const [clv, setClv] = useState<CLVResponse | null>(null)
  const [markets, setMarkets] = useState<TopMarket[]>([])
  const [history, setHistory] = useState<OddsPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [clvRes, marketsRes, historyRes] = await Promise.allSettled([
        fetch(`/api/betting-intelligence/${matchId}?bankroll=1000&model=best`).then(r => r.ok ? r.json() : null),
        fetch(`/api/match/${matchId}/top-markets?limit=3`).then(r => r.ok ? r.json() : null),
        fetch(`/api/match/${matchId}/odds-history?hours=24`).then(r => r.ok ? r.json() : null),
      ])
      if (cancelled) return
      if (clvRes.status === 'fulfilled' && clvRes.value) setClv(clvRes.value as CLVResponse)
      if (marketsRes.status === 'fulfilled' && marketsRes.value) setMarkets((marketsRes.value as TopMarketsResponse).markets || [])
      if (historyRes.status === 'fulfilled' && historyRes.value) setHistory((historyRes.value as OddsHistoryResponse).points || [])
      setLoading(false)
    }
    load()
    // Re-fetch every 60s while mounted
    const interval = setInterval(load, 60000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [matchId])

  const hasAny = !!clv?.betting_intelligence?.clv || markets.length > 0 || history.length >= 2

  if (loading && !hasAny) {
    return (
      <Card className="bg-slate-800/60 border-slate-700">
        <div className="p-6 flex items-center gap-2 text-slate-400 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading live betting intelligence…
        </div>
      </Card>
    )
  }

  if (!hasAny) return null

  return (
    <Card className="bg-gradient-to-br from-slate-900/80 to-slate-800/60 border-emerald-500/20">
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <Activity className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">Live Betting Intelligence</h3>
            <p className="text-slate-400 text-xs">Real-time CLV, market edges, and odds drift</p>
          </div>
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40">LIVE</Badge>
        </div>

        {/* ── CLV ── */}
        {clv?.betting_intelligence?.clv && (
          <CLVBlock
            clv={clv.betting_intelligence.clv}
            homeName={clv.home?.name || homeTeam}
            awayName={clv.away?.name || awayTeam}
          />
        )}

        {/* ── Top markets ── */}
        {markets.length > 0 && <TopMarketsBlock markets={markets} />}

        {/* ── Odds drift ── */}
        {history.length >= 2 && <OddsDriftBlock points={history} homeName={homeTeam} awayName={awayTeam} />}
      </div>
    </Card>
  )
}

// ─── Sub-blocks ────────────────────────────────────────────────────────
function CLVBlock({ clv, homeName, awayName }: { clv: { home: number; draw: number; away: number }; homeName: string; awayName: string }) {
  const cells = [
    { label: homeName, value: clv.home },
    { label: 'Draw', value: clv.draw },
    { label: awayName, value: clv.away },
  ]
  return (
    <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-700/60">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="h-4 w-4 text-blue-400" />
        <span className="text-slate-300 text-sm font-medium">Closing Line Value</span>
        <span className="text-slate-500 text-xs ml-auto">vs entry odds</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {cells.map((c) => {
          const pct = (c.value || 0) * 100
          const positive = pct >= 0
          return (
            <div key={c.label} className="text-center bg-slate-800/40 rounded p-2">
              <div className="text-slate-400 text-xs mb-1 truncate" title={c.label}>{c.label}</div>
              <div className={`text-sm font-bold ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
                {positive ? '+' : ''}{pct.toFixed(1)}%
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TopMarketsBlock({ markets }: { markets: TopMarket[] }) {
  return (
    <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-700/60">
      <div className="flex items-center gap-2 mb-3">
        <Target className="h-4 w-4 text-amber-400" />
        <span className="text-slate-300 text-sm font-medium">Highest-Edge Markets</span>
        <span className="text-slate-500 text-xs ml-auto">model vs market</span>
      </div>
      <div className="space-y-2">
        {markets.map((m) => {
          const edgeColor = m.edge >= 5 ? 'text-emerald-400' : m.edge >= 2 ? 'text-blue-400' : 'text-yellow-400'
          return (
            <div key={m.id} className="flex items-center justify-between bg-slate-800/40 rounded px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="text-white text-sm font-medium truncate">{m.displayLabel}</div>
                <div className="text-slate-400 text-xs">
                  {(m.consensusProb * 100).toFixed(0)}% confidence
                  {m.decimalOdds ? <> · {m.decimalOdds.toFixed(2)}x</> : null}
                </div>
              </div>
              <div className="text-right ml-3 shrink-0">
                <div className={`text-base font-bold ${edgeColor}`}>+{m.edge.toFixed(1)}%</div>
                <div className="text-slate-500 text-xs uppercase tracking-wide">edge</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function OddsDriftBlock({ points, homeName, awayName }: { points: OddsPoint[]; homeName: string; awayName: string }) {
  const series: Array<{ key: 'h' | 'd' | 'a'; label: string; color: string }> = [
    { key: 'h', label: homeName, color: '#10b981' },
    { key: 'd', label: 'Draw', color: '#94a3b8' },
    { key: 'a', label: awayName, color: '#f59e0b' },
  ]
  const first = points[0]
  const last = points[points.length - 1]

  return (
    <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-700/60">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="h-4 w-4 text-purple-400" />
        <span className="text-slate-300 text-sm font-medium">Odds Drift (last 24h)</span>
        <span className="text-slate-500 text-xs ml-auto">{points.length} snapshots</span>
      </div>
      <div className="space-y-3">
        {series.map((s) => {
          const start = first?.[s.key] ?? null
          const end = last?.[s.key] ?? null
          const delta = start && end ? ((end - start) / start) * 100 : null
          const trendIcon = delta == null ? null : delta > 0.5 ? <TrendingUp className="h-3 w-3 text-red-400" /> : delta < -0.5 ? <TrendingDown className="h-3 w-3 text-emerald-400" /> : null
          return (
            <div key={s.key} className="flex items-center gap-3">
              <div className="w-16 text-xs text-slate-400 truncate" title={s.label}>{s.label}</div>
              <div className="flex-1">
                <Sparkline points={points.map((p) => p[s.key])} color={s.color} />
              </div>
              <div className="w-20 text-right text-xs">
                <div className="text-slate-300 font-mono">
                  {start ? start.toFixed(2) : '—'} → {end ? end.toFixed(2) : '—'}
                </div>
                {delta != null && (
                  <div className={`flex items-center justify-end gap-1 ${delta > 0 ? 'text-red-400' : delta < 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {trendIcon}
                    <span>{delta > 0 ? '+' : ''}{delta.toFixed(1)}%</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-slate-500 text-xs mt-3">
        Odds shortening (down %) = market thinks outcome more likely. Lengthening = drifting away.
      </p>
    </div>
  )
}

// ─── Inline SVG sparkline (no charting deps) ───────────────────────────
function Sparkline({ points, color }: { points: Array<number | null>; color: string }) {
  const valid = points.filter((p): p is number => p != null && isFinite(p))
  if (valid.length < 2) {
    return <div className="h-6 text-xs text-slate-600 italic">insufficient data</div>
  }
  const min = Math.min(...valid)
  const max = Math.max(...valid)
  const range = max - min || 1
  const width = 100
  const height = 24
  const step = points.length > 1 ? width / (points.length - 1) : 0
  let lastX = 0
  const segments: string[] = []
  let current = ''
  points.forEach((p, i) => {
    const x = i * step
    if (p == null) {
      if (current) segments.push(current)
      current = ''
      return
    }
    const y = height - ((p - min) / range) * height
    current += current === '' ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : ` L ${x.toFixed(2)} ${y.toFixed(2)}`
    lastX = x
  })
  if (current) segments.push(current)
  void lastX
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {segments.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  )
}
