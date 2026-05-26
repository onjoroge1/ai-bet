import type { Metadata } from 'next'
import Link from 'next/link'
import prisma from '@/lib/db'
import {
  aggregateStats,
  filterRowsByTier,
  type TrackerPickRow,
} from '@/lib/premium-tracker/stats'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AdvancedBreadcrumb } from '@/components/advanced-breadcrumb'
import {
  TrendingUp,
  Trophy,
  DollarSign,
  Target,
  Clock,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 300 // 5 min ISR-style cache

export const metadata: Metadata = {
  title: 'Premium Pick Tracker — Performance | SnapBet AI',
  description:
    "Transparent flat-stake simulation of SnapBet's premium-qualified picks. Every win and loss, recorded at the odds available when the pick was published.",
  alternates: { canonical: '/performance' },
  openGraph: {
    title: 'Premium Pick Tracker — SnapBet AI',
    description:
      'Transparent flat-stake performance of every premium-qualified pick. Wins and losses included.',
    url: '/performance',
    type: 'website',
  },
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function fmtUSD(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '−' : ''
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtUnits(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '−' : ''
  return `${sign}${Math.abs(n).toFixed(2)}u`
}

function fmtPct(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '−' : ''
  return `${sign}${Math.abs(n).toFixed(2)}%`
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function dollarTone(n: number): string {
  if (n > 0) return 'text-emerald-300'
  if (n < 0) return 'text-red-300'
  return 'text-slate-200'
}

// ─── Page ────────────────────────────────────────────────────────────────

interface PageProps {
  searchParams?: Promise<{ window?: string; tier?: string }>
}

export default async function PerformancePage({ searchParams }: PageProps) {
  const params = (await searchParams) || {}
  const windowParam = params.window || '30'
  const tierParam = params.tier || 'all'

  const validWindows = new Set(['7', '30', '90', 'all'])
  const safeWindow = validWindows.has(windowParam) ? windowParam : '30'
  const windowDays = safeWindow === 'all' ? 0 : parseInt(safeWindow, 10)

  const now = new Date()
  const cutoff = windowDays > 0 ? new Date(now.getTime() - windowDays * 86400 * 1000) : null

  // ── Single query for the rows + the earliest publishedAt (for the
  // "Tracking since" footer) ─────────────────────────────────────────────
  const [rawRows, firstRow, totalCount, parlayRows] = await Promise.all([
    prisma.premiumPickHistory.findMany({
      where: cutoff ? { publishedAt: { gte: cutoff } } : {},
      select: {
        id: true,
        oddsAtPublish: true,
        stakeDollars: true,
        netDollars: true,
        netUnits: true,
        result: true,
        tier: true,
        sport: true,
        league: true,
        market: true,
        pick: true,
        homeTeam: true,
        awayTeam: true,
        publishedAt: true,
        kickoffDate: true,
        settledAt: true,
        surfacedBy: true,
      },
      orderBy: { publishedAt: 'desc' },
      take: 500,
    }),
    prisma.premiumPickHistory.findFirst({
      orderBy: { publishedAt: 'asc' },
      select: { publishedAt: true },
    }),
    prisma.premiumPickHistory.count(),
    prisma.premiumParlay.findMany({
      where: cutoff ? { publishedAt: { gte: cutoff } } : {},
      select: {
        id: true, legCount: true, combinedOdds: true, stakeDollars: true,
        result: true, netDollars: true, surfacedBy: true,
        publishedAt: true, latestKickoff: true,
      },
      orderBy: { publishedAt: 'desc' },
      take: 1000,
    }),
  ])

  // Roll up parlay numbers by leg count for the new section
  interface ParlayBucket {
    legCount: number; total: number; wins: number; losses: number;
    voids: number; pending: number; staked: number; net: number;
  }
  const parlayByLeg = new Map<number, ParlayBucket>()
  for (const p of parlayRows) {
    let b = parlayByLeg.get(p.legCount)
    if (!b) {
      b = { legCount: p.legCount, total: 0, wins: 0, losses: 0, voids: 0, pending: 0, staked: 0, net: 0 }
      parlayByLeg.set(p.legCount, b)
    }
    b.total++
    const stake = Number(p.stakeDollars)
    const net = p.netDollars !== null ? Number(p.netDollars) : 0
    if (p.result === 'win') { b.wins++; b.staked += stake; b.net += net }
    else if (p.result === 'loss') { b.losses++; b.staked += stake; b.net += net }
    else if (p.result === 'void' || p.result === 'push') b.voids++
    else b.pending++
  }
  const parlayBuckets = [...parlayByLeg.values()].sort((a, b) => a.legCount - b.legCount)

  const rows: TrackerPickRow[] = rawRows.map(r => ({
    oddsAtPublish: Number(r.oddsAtPublish),
    stakeDollars: Number(r.stakeDollars),
    netDollars: r.netDollars !== null ? Number(r.netDollars) : null,
    netUnits: r.netUnits !== null ? Number(r.netUnits) : null,
    result: r.result as TrackerPickRow['result'],
    tier: r.tier,
    sport: r.sport,
    league: r.league,
    publishedAt: r.publishedAt,
    kickoffDate: r.kickoffDate,
    settledAt: r.settledAt,
    market: r.market,
  }))

  const filtered = filterRowsByTier(rows, tierParam)
  const stats = aggregateStats(filtered)
  const premiumOnly = aggregateStats(filterRowsByTier(rows, 'premium'))

  // Provenance — surface the backfill window vs forward-capture window so the
  // disclosure paragraph and per-row badges can be honest about origins.
  const backfillRows = rawRows.filter(r => r.surfacedBy === 'backfill')
  const forwardRows = rawRows.filter(r => r.surfacedBy !== 'backfill')
  const backfillStart = backfillRows.length > 0
    ? backfillRows.reduce((min, r) => (r.publishedAt < min ? r.publishedAt : min), backfillRows[0].publishedAt)
    : null
  const backfillEnd = backfillRows.length > 0
    ? backfillRows.reduce((max, r) => (r.publishedAt > max ? r.publishedAt : max), backfillRows[0].publishedAt)
    : null
  const forwardStart = forwardRows.length > 0
    ? forwardRows.reduce((min, r) => (r.publishedAt < min ? r.publishedAt : min), forwardRows[0].publishedAt)
    : null

  const trackingSince = firstRow?.publishedAt
  const trackingSinceText = trackingSince ? fmtDate(trackingSince) : null
  const meaningfulWindowDate = trackingSince
    ? fmtDate(new Date(trackingSince.getTime() + 30 * 86400 * 1000))
    : null
  // The headline only feels "meaningful" once at least N picks have settled.
  // Until then we render an explainer banner.
  const insufficientData = stats.settledCount < 10

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <AdvancedBreadcrumb />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* ── Hero ─────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white flex items-center gap-3">
              <Trophy className="w-8 h-8 text-amber-300" />
              Premium Pick Tracker
            </h1>
            <p className="text-slate-300 mt-2 max-w-2xl">
              Transparent flat-stake simulation of every premium-qualified pick.
              Wins and losses included.{' '}
              <Link href="/methodology" className="text-blue-300 hover:text-blue-200 underline underline-offset-2">
                See methodology →
              </Link>
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['7', '30', '90', 'all'] as const).map(w => (
              <Link
                key={w}
                href={`/performance?window=${w}${tierParam !== 'all' ? `&tier=${tierParam}` : ''}`}
                className={
                  'px-3 py-1.5 rounded-lg text-sm border transition-colors ' +
                  (safeWindow === w
                    ? 'bg-blue-500/20 border-blue-500/50 text-blue-200'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700')
                }
              >
                {w === 'all' ? 'All time' : `Last ${w}d`}
              </Link>
            ))}
          </div>
        </div>

        {/* ── Empty / sparse-data banner ──────────────────────────── */}
        {totalCount === 0 ? (
          <Card className="bg-blue-950/30 border-blue-500/30">
            <CardContent className="p-6 flex items-start gap-3">
              <Clock className="w-5 h-5 text-blue-300 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white">Forward capture just started</p>
                <p className="text-sm text-blue-200 mt-1">
                  We&apos;ve begun recording every premium-qualified pick our model surfaces.
                  Results will appear here as matches settle. Check back tomorrow.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : insufficientData ? (
          <Card className="bg-amber-950/30 border-amber-500/40">
            <CardContent className="p-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-300 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white">Small-sample window</p>
                <p className="text-sm text-amber-100/90 mt-1">
                  Only {stats.settledCount} settled pick{stats.settledCount === 1 ? '' : 's'}{' '}
                  in this window. Numbers below are real but may swing materially with each settlement.
                  {trackingSinceText && meaningfulWindowDate && (
                    <> Tracking started <strong>{trackingSinceText}</strong>; a stable 30-day window completes by <strong>{meaningfulWindowDate}</strong>.</>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* ── Headline tiles ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Tile
            icon={DollarSign}
            label="Net (simulated)"
            value={fmtUSD(stats.netDollars)}
            sub={fmtUnits(stats.netUnits)}
            tone={dollarTone(stats.netDollars)}
          />
          <Tile
            icon={TrendingUp}
            label="ROI"
            value={fmtPct(stats.roiPct)}
            sub={`Avg odds ${stats.avgOdds.toFixed(2)}`}
            tone={dollarTone(stats.roiPct)}
          />
          <Tile
            icon={Target}
            label="Hit rate"
            value={`${stats.hitRatePct.toFixed(1)}%`}
            sub={`${stats.record.wins}W · ${stats.record.losses}L`}
          />
          <Tile
            icon={Trophy}
            label="Total staked"
            value={`$${stats.totalStakedDollars.toLocaleString()}`}
            sub={`${stats.settledCount} settled`}
          />
          <Tile
            icon={Clock}
            label="Pending"
            value={String(stats.record.pending)}
            sub="Awaiting kickoff/settlement"
          />
        </div>

        {/* ── Premium-only highlight (when tier=all and there's data) ── */}
        {tierParam === 'all' && premiumOnly.settledCount > 0 && (
          <Card className="bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-900 border-amber-500/30">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-amber-300 uppercase tracking-widest font-semibold">
                    Premium tier only
                  </p>
                  <p className="text-2xl font-bold text-white mt-1">
                    <span className={dollarTone(premiumOnly.netDollars)}>{fmtUSD(premiumOnly.netDollars)}</span>
                    <span className="text-base text-slate-400 ml-2">({fmtUnits(premiumOnly.netUnits)})</span>
                  </p>
                  <p className="text-sm text-slate-300 mt-1">
                    {premiumOnly.record.wins}W–{premiumOnly.record.losses}L · ROI{' '}
                    <span className={dollarTone(premiumOnly.roiPct)}>{fmtPct(premiumOnly.roiPct)}</span>
                    {' · '}Hit rate {premiumOnly.hitRatePct.toFixed(1)}%
                  </p>
                </div>
                <Link
                  href={`/performance?window=${safeWindow}&tier=premium`}
                  className="text-sm text-amber-200 hover:text-amber-100 underline underline-offset-2 whitespace-nowrap"
                >
                  Filter to premium →
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Tier filter chips ──────────────────────────────────── */}
        <div className="flex gap-2 flex-wrap">
          {(['all', 'premium', 'strong'] as const).map(t => (
            <Link
              key={t}
              href={`/performance?window=${safeWindow}&tier=${t}`}
              className={
                'px-3 py-1.5 rounded-lg text-xs uppercase tracking-wide border transition-colors ' +
                (tierParam === t
                  ? 'bg-blue-500/20 border-blue-500/50 text-blue-200'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700')
              }
            >
              {t}
            </Link>
          ))}
        </div>

        {/* ── Parlay performance by leg count ─────────────────────── */}
        {parlayBuckets.length > 0 && (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-0">
              <div className="px-6 py-4 border-b border-slate-700">
                <h2 className="text-lg font-semibold text-white">Premium parlay performance</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Multi-leg combinations of premium-qualified picks. Empirically: 2-leg outperforms; 4+ legs lose money.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-900/50 text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="text-left px-4 py-3">Legs</th>
                      <th className="text-right px-4 py-3">Total</th>
                      <th className="text-right px-4 py-3">W–L</th>
                      <th className="text-right px-4 py-3">Hit rate</th>
                      <th className="text-right px-4 py-3">Net</th>
                      <th className="text-right px-4 py-3">ROI</th>
                      <th className="text-center px-4 py-3">Pending</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parlayBuckets.map(b => {
                      const settledN = b.wins + b.losses
                      const hit = settledN > 0 ? (b.wins / settledN * 100) : 0
                      const roi = b.staked > 0 ? (b.net / b.staked * 100) : 0
                      const isWinning = b.net >= 0 && settledN > 0
                      return (
                        <tr key={b.legCount} className="border-t border-slate-700/50">
                          <td className="px-4 py-3 text-white font-semibold">{b.legCount}-leg</td>
                          <td className="px-4 py-3 text-right text-slate-300 font-mono">{b.total}</td>
                          <td className="px-4 py-3 text-right text-slate-200 font-mono">
                            <span className="text-emerald-300">{b.wins}</span>
                            <span className="text-slate-500">–</span>
                            <span className="text-red-300">{b.losses}</span>
                          </td>
                          <td className="px-4 py-3 text-right text-slate-300 font-mono">
                            {settledN > 0 ? `${hit.toFixed(1)}%` : '—'}
                          </td>
                          <td className={`px-4 py-3 text-right font-mono ${isWinning ? 'text-emerald-300' : settledN > 0 ? 'text-red-300' : 'text-slate-500'}`}>
                            {settledN > 0 ? `${b.net >= 0 ? '+' : '−'}$${Math.abs(b.net).toFixed(2)}` : '—'}
                          </td>
                          <td className={`px-4 py-3 text-right font-mono ${isWinning ? 'text-emerald-300' : settledN > 0 ? 'text-red-300' : 'text-slate-500'}`}>
                            {b.staked > 0 ? `${roi >= 0 ? '+' : '−'}${Math.abs(roi).toFixed(2)}%` : '—'}
                          </td>
                          <td className="px-4 py-3 text-center text-slate-400 text-xs">{b.pending || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-3 border-t border-slate-700 bg-slate-900/30 text-[11px] text-slate-500 leading-relaxed">
                Backfill methodology: every valid combination of historical premium picks within a 7-day kickoff window.
                Public surface defaults to 2 + 3 leg only (4+ shown here for transparency but withheld from
                <Link href="/parlays" className="text-blue-300 hover:text-blue-200 underline mx-1">/parlays</Link>
                since the data shows them as net-losing).
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Audit table ─────────────────────────────────────────── */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-0">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Pick audit</h2>
              <span className="text-xs text-slate-400">
                {rows.length === 500 ? 'Showing latest 500' : `${rows.length} pick${rows.length === 1 ? '' : 's'}`}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/50 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="text-left px-4 py-3">Kickoff</th>
                    <th className="text-left px-4 py-3">Match</th>
                    <th className="text-left px-4 py-3">League</th>
                    <th className="text-left px-4 py-3">Pick</th>
                    <th className="text-right px-4 py-3">Odds</th>
                    <th className="text-center px-4 py-3">Tier</th>
                    <th className="text-center px-4 py-3">Result</th>
                    <th className="text-right px-4 py-3">Net</th>
                    <th className="text-center px-4 py-3">Origin</th>
                  </tr>
                </thead>
                <tbody>
                  {rawRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                        No picks captured in this window yet.
                      </td>
                    </tr>
                  ) : (
                    rawRows.map(r => {
                      const net = r.netDollars !== null ? Number(r.netDollars) : null
                      return (
                        <tr key={r.id} className="border-t border-slate-700/50 hover:bg-slate-900/30">
                          <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{fmtDate(r.kickoffDate)}</td>
                          <td className="px-4 py-3 text-white">{r.homeTeam} vs {r.awayTeam}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{r.league || '—'}</td>
                          <td className="px-4 py-3 text-slate-200">{r.pick}</td>
                          <td className="px-4 py-3 text-right text-slate-300 font-mono">{Number(r.oddsAtPublish).toFixed(2)}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge className={
                              r.tier === 'premium'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs'
                                : 'bg-blue-500/20 text-blue-300 border-blue-500/40 text-xs'
                            }>
                              {r.tier}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge className={resultBadgeClass(r.result)}>
                              {r.result}
                            </Badge>
                          </td>
                          <td className={`px-4 py-3 text-right font-mono ${net !== null ? dollarTone(net) : 'text-slate-500'}`}>
                            {net !== null ? fmtUSD(net) : '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {r.surfacedBy === 'backfill' ? (
                              <span
                                title="Reconstructed from model state + consensus odds at kickoff"
                                className="text-[10px] uppercase tracking-wide text-slate-500 border border-slate-700 rounded px-1.5 py-0.5"
                              >
                                backfill
                              </span>
                            ) : (
                              <span
                                title="Captured at publish time by the live cron"
                                className="text-[10px] uppercase tracking-wide text-emerald-400/70 border border-emerald-600/40 rounded px-1.5 py-0.5"
                              >
                                live
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ── Disclaimer ──────────────────────────────────────────── */}
        <Card className="bg-slate-900/60 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-slate-400 leading-relaxed space-y-2">
                <p>
                  <strong className="text-slate-300">Methodology.</strong>{' '}
                  Every pick uses a virtual <strong>$100 flat stake</strong> at the
                  consensus odds available when the pick was surfaced. We never modify settled rows.
                  Pushes and voids do not affect ROI. Parlays are excluded from this tracker.
                </p>
                {backfillRows.length > 0 && (
                  <p>
                    <strong className="text-slate-300">Data origin.</strong>{' '}
                    This tracker includes <strong>{backfillRows.length}</strong> reconstructed
                    pick{backfillRows.length === 1 ? '' : 's'}
                    {backfillStart && backfillEnd && (
                      <> from <strong>{fmtDate(backfillStart)}</strong> to <strong>{fmtDate(backfillEnd)}</strong></>
                    )}
                    {forwardRows.length > 0 && forwardStart && (
                      <> + <strong>{forwardRows.length}</strong> captured live since <strong>{fmtDate(forwardStart)}</strong></>
                    )}
                    . Reconstruction applies the same qualification rules and odds-resolution logic the live
                    capture cron uses. Each row is labelled <span className="uppercase tracking-wide text-slate-500 border border-slate-700 rounded px-1">backfill</span> or <span className="uppercase tracking-wide text-emerald-400/70 border border-emerald-600/40 rounded px-1">live</span> in the table above.
                    The same exclusion rule (no usable consensus odds → skip) was applied uniformly to both sets.
                    {' '}
                    <Link href="/methodology" className="text-blue-300 hover:text-blue-200 underline underline-offset-2">
                      Full methodology →
                    </Link>
                  </p>
                )}
                <p>
                  This is a simulation of model performance, not a guarantee of future results. Betting involves risk.{' '}
                  <Link href="/responsible-betting" className="text-blue-300 hover:text-blue-200 underline underline-offset-2">
                    Bet responsibly →
                  </Link>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── Subcomponents ───────────────────────────────────────────────────

function Tile({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  sub?: string
  tone?: string
}) {
  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${tone || 'text-white'}`}>{value}</p>
            {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
          </div>
          <Icon className="w-5 h-5 text-slate-500" />
        </div>
      </CardContent>
    </Card>
  )
}

function resultBadgeClass(result: string): string {
  switch (result) {
    case 'win':
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs'
    case 'loss':
      return 'bg-red-500/20 text-red-300 border-red-500/40 text-xs'
    case 'push':
    case 'void':
      return 'bg-slate-500/20 text-slate-300 border-slate-500/40 text-xs'
    case 'pending':
    default:
      return 'bg-blue-500/20 text-blue-300 border-blue-500/40 text-xs'
  }
}
