'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AdvancedBreadcrumb } from '@/components/advanced-breadcrumb'
import {
  BarChart3,
  Eye,
  MousePointerClick,
  Share2,
  Mail,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  Clock,
  XCircle,
  Trophy,
} from 'lucide-react'

interface PerfData {
  window: { days: number; start: string; end: string }
  aggregates: {
    totalBlogs: number
    totalViews: number
    totalShares: number
    totalCtaClicks: number
    ctaCtrPct: number
  }
  newsletter: {
    subscribersLifetime: number
    subscribersInWindow: number
    popup: {
      impression: number
      dismiss: number
      subscribe: number
      impressionToSubscribePct: number
      dismissalRatePct: number
    }
    staticWidget: {
      impression: number
      dismiss: number
      subscribe: number
    }
  }
  topByViews: Array<{
    id: string; title: string; slug: string
    viewCount: number; shareCount: number; ctaClickCount: number
    aiGenerated: boolean
  }>
  topByCtaClicks: Array<{
    id: string; title: string; slug: string
    viewCount: number; ctaClickCount: number
    aiGenerated: boolean
  }>
  brokenFunnel: Array<{
    id: string; title: string; slug: string; viewCount: number
  }>
  recentlyGenerated: Array<{
    id: string; title: string; slug: string
    aiGenerated: boolean; isPublished: boolean
    viewCount: number; createdAt: string; category: string
    marketMatch: { matchId: string; status: string; kickoffDate: string; homeTeam: string; awayTeam: string } | null
  }>
  regression: {
    finishedOrPastKickoffInLast7d: number
    examples: Array<{
      id: string; title: string; slug: string
      matchStatus?: string; kickoffDate?: string; createdAt: string
    }>
  }
  evergreenStatus: {
    queued: number; drafted: number; reviewed: number; published: number; refresh_due: number
  }
  tracker?: {
    windowDays: number
    all: { count: number; wins: number; losses: number; pushes: number; voids: number; pending: number; staked: number; net: number; roiPct: number }
    premium: { count: number; wins: number; losses: number; pushes: number; voids: number; pending: number; staked: number; net: number; roiPct: number }
    origin: { backfillCount: number; liveCount: number }
    lastCapture: { at: string; match: string; tier: string; market: string } | null
    lastSettle: { at: string | null; match: string; result: string; netDollars: number | null } | null
    funnel: { impression: number; cta_click_picks: number; cta_click_audit: number; totalClicks: number; clickRatePct: number }
  }
}

const num = (n: number) => n.toLocaleString()
const pct = (p: number) => `${p.toFixed(2)}%`

export default function BlogPerformancePage() {
  const [data, setData] = useState<PerfData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState('14')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/admin/blogs/performance?days=${days}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        if (d.success) setData(d as PerfData)
        else setError(d.error || 'Failed to load')
      })
      .catch(e => { if (!cancelled) setError(String(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [days])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <AdvancedBreadcrumb />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-7 h-7 text-blue-400" />
              Blog Performance Dashboard
            </h1>
            <p className="text-slate-300 mt-1">
              Funnel: views → CTA clicks → newsletter signups.
              Includes regression guard for the eligibility filter.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white w-40">
                <SelectValue placeholder="Window" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="60">Last 60 days</SelectItem>
              </SelectContent>
            </Select>
            <Link href="/admin/blogs">
              <Button variant="outline" className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700">
                ← Back
              </Button>
            </Link>
          </div>
        </div>

        {error && (
          <Card className="bg-red-950/40 border-red-500/40">
            <CardContent className="p-4 text-red-300">{error}</CardContent>
          </Card>
        )}

        {loading && !data ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 bg-slate-800 rounded animate-pulse" />
            ))}
          </div>
        ) : data ? (
          <>
            {/* ─── Regression guard ─────────────────────────────────────── */}
            <Card className={
              data.regression.finishedOrPastKickoffInLast7d === 0
                ? 'bg-emerald-950/30 border-emerald-500/30'
                : 'bg-red-950/40 border-red-500/40'
            }>
              <CardContent className="p-4 flex items-start gap-3">
                {data.regression.finishedOrPastKickoffInLast7d === 0 ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">
                    Regression guard: finished/past-kickoff blogs generated in last 7 days
                  </p>
                  <p className={`text-sm mt-1 ${data.regression.finishedOrPastKickoffInLast7d === 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                    {data.regression.finishedOrPastKickoffInLast7d === 0
                      ? 'Zero — eligibility filter working correctly.'
                      : `${data.regression.finishedOrPastKickoffInLast7d} blog(s) created for ineligible matches. Check lib/blog/eligibility.ts.`}
                  </p>
                  {data.regression.examples.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-red-200">
                      {data.regression.examples.map(e => (
                        <li key={e.id}>
                          [{e.matchStatus}] {e.title} — kickoff {e.kickoffDate && new Date(e.kickoffDate).toISOString().slice(0, 10)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ─── Aggregate funnel ─────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Stat icon={Eye} label="Total Views" value={num(data.aggregates.totalViews)} sub={`${num(data.aggregates.totalBlogs)} active blogs`} />
              <Stat icon={MousePointerClick} label="CTA Clicks" value={num(data.aggregates.totalCtaClicks)} sub={`${pct(data.aggregates.ctaCtrPct)} CTR`} />
              <Stat icon={Share2} label="Shares" value={num(data.aggregates.totalShares)} />
              <Stat icon={Mail} label="Newsletter Subs" value={num(data.newsletter.subscribersLifetime)} sub={`+${num(data.newsletter.subscribersInWindow)} in window`} />
              <Stat icon={Sparkles} label="Evergreens Live" value={num(data.evergreenStatus.published)} sub={`${num(data.evergreenStatus.queued)} queued`} />
            </div>

            {/* ─── Popup funnel ────────────────────────────────────────── */}
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-400" /> Newsletter popup funnel ({data.window.days}d)
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide">Impressions</p>
                    <p className="text-2xl font-bold text-white mt-1">{num(data.newsletter.popup.impression)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide">Dismissals</p>
                    <p className="text-2xl font-bold text-amber-300 mt-1">{num(data.newsletter.popup.dismiss)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide">Subscribes (popup)</p>
                    <p className="text-2xl font-bold text-emerald-300 mt-1">{num(data.newsletter.popup.subscribe)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide">Impr → Sub rate</p>
                    <p className="text-2xl font-bold text-blue-300 mt-1">{pct(data.newsletter.popup.impressionToSubscribePct)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide">Dismissal rate</p>
                    <p className="text-2xl font-bold text-slate-300 mt-1">{pct(data.newsletter.popup.dismissalRatePct)}</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide">Static-widget subs</p>
                    <p className="text-xl font-semibold text-emerald-200 mt-1">{num(data.newsletter.staticWidget.subscribe)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide">Total subs in window</p>
                    <p className="text-xl font-semibold text-white mt-1">{num(data.newsletter.subscribersInWindow)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ─── Premium Pick Tracker ────────────────────────────────── */}
            {data.tracker && (
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-amber-300" /> Premium Pick Tracker ({data.tracker.windowDays}d)
                    </h2>
                    <Link href="/performance">
                      <Button variant="outline" size="sm" className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600">
                        Open public page →
                      </Button>
                    </Link>
                  </div>

                  {/* Tier rows */}
                  <div className="grid md:grid-cols-2 gap-3">
                    <TrackerTierRow
                      label="Premium tier (headline)"
                      colorClass="border-amber-500/30 bg-amber-950/20"
                      wins={data.tracker.premium.wins}
                      losses={data.tracker.premium.losses}
                      pending={data.tracker.premium.pending}
                      net={data.tracker.premium.net}
                      roiPct={data.tracker.premium.roiPct}
                      staked={data.tracker.premium.staked}
                    />
                    <TrackerTierRow
                      label="All tiers (premium + strong)"
                      colorClass="border-slate-700 bg-slate-900/40"
                      wins={data.tracker.all.wins}
                      losses={data.tracker.all.losses}
                      pending={data.tracker.all.pending}
                      net={data.tracker.all.net}
                      roiPct={data.tracker.all.roiPct}
                      staked={data.tracker.all.staked}
                    />
                  </div>

                  {/* Data origin + cron freshness */}
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4">
                      <p className="text-xs text-slate-400 uppercase tracking-wide">Data origin (in window)</p>
                      <p className="text-sm text-slate-200 mt-2">
                        <span className="text-emerald-300 font-mono">{num(data.tracker.origin.liveCount)}</span> live ·{' '}
                        <span className="text-slate-300 font-mono">{num(data.tracker.origin.backfillCount)}</span> backfill
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4 space-y-1">
                      <p className="text-xs text-slate-400 uppercase tracking-wide">Cron freshness</p>
                      <p className="text-xs text-slate-300">
                        Last capture: {data.tracker.lastCapture
                          ? `${new Date(data.tracker.lastCapture.at).toLocaleString()} — ${data.tracker.lastCapture.match} (${data.tracker.lastCapture.tier})`
                          : 'never (forward cron pending first tick)'}
                      </p>
                      <p className="text-xs text-slate-300">
                        Last settle: {data.tracker.lastSettle && data.tracker.lastSettle.at
                          ? `${new Date(data.tracker.lastSettle.at).toLocaleString()} — ${data.tracker.lastSettle.match} ${data.tracker.lastSettle.result.toUpperCase()}${data.tracker.lastSettle.netDollars !== null ? ` (${data.tracker.lastSettle.netDollars > 0 ? '+' : ''}$${data.tracker.lastSettle.netDollars.toFixed(0)})` : ''}`
                          : 'no settled picks yet'}
                      </p>
                    </div>
                  </div>

                  {/* Tracker funnel */}
                  <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4">
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-3">Tracker card funnel ({data.tracker.windowDays}d)</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase">Impressions</p>
                        <p className="text-xl font-bold text-white mt-1">{num(data.tracker.funnel.impression)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase">→ Picks click</p>
                        <p className="text-xl font-bold text-emerald-300 mt-1">{num(data.tracker.funnel.cta_click_picks)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase">→ Audit click</p>
                        <p className="text-xl font-bold text-blue-300 mt-1">{num(data.tracker.funnel.cta_click_audit)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase">Click rate</p>
                        <p className="text-xl font-bold text-amber-300 mt-1">{pct(data.tracker.funnel.clickRatePct)}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ─── Evergreen queue summary ─────────────────────────────── */}
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-emerald-400" /> Evergreen topic queue
                  </h2>
                  <Link href="/admin/blogs/evergreen">
                    <Button variant="outline" size="sm" className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600">
                      Open pipeline →
                    </Button>
                  </Link>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
                  <QueueChip label="Queued" count={data.evergreenStatus.queued} color="text-slate-300" />
                  <QueueChip label="Drafted" count={data.evergreenStatus.drafted} color="text-amber-300" />
                  <QueueChip label="Reviewed" count={data.evergreenStatus.reviewed} color="text-blue-300" />
                  <QueueChip label="Published" count={data.evergreenStatus.published} color="text-emerald-300" />
                  <QueueChip label="Refresh due" count={data.evergreenStatus.refresh_due} color="text-purple-300" />
                </div>
              </CardContent>
            </Card>

            {/* ─── Top blogs by views ──────────────────────────────────── */}
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-blue-400" /> Top blogs by views
                </h2>
                <div className="space-y-2">
                  {data.topByViews.map((b, i) => (
                    <BlogRow
                      key={b.id}
                      rank={i + 1}
                      title={b.title}
                      slug={b.slug}
                      ai={b.aiGenerated}
                      primary={`${num(b.viewCount)} views`}
                      secondary={`${num(b.ctaClickCount)} CTA · ${num(b.shareCount)} shares`}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* ─── Top blogs by CTA clicks ─────────────────────────────── */}
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <MousePointerClick className="w-5 h-5 text-emerald-400" /> Top blogs by CTA clicks
                </h2>
                <div className="space-y-2">
                  {data.topByCtaClicks.length === 0 ? (
                    <p className="text-sm text-slate-400">No CTA clicks recorded yet. Deploy may still be propagating.</p>
                  ) : data.topByCtaClicks.map((b, i) => (
                    <BlogRow
                      key={b.id}
                      rank={i + 1}
                      title={b.title}
                      slug={b.slug}
                      ai={b.aiGenerated}
                      primary={`${num(b.ctaClickCount)} clicks`}
                      secondary={`${num(b.viewCount)} views`}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* ─── Broken funnel detector ──────────────────────────────── */}
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-amber-400" /> Broken funnel (views &gt; 50, 0 CTA clicks, match-linked)
                </h2>
                <p className="text-xs text-slate-400 mb-4">
                  These blogs have meaningful traffic but no one is clicking through. Likely candidates for headline/CTA review.
                </p>
                <div className="space-y-2">
                  {data.brokenFunnel.length === 0 ? (
                    <p className="text-sm text-slate-400">No broken-funnel blogs detected. Either traffic is low, or CTAs are working.</p>
                  ) : data.brokenFunnel.map((b, i) => (
                    <BlogRow
                      key={b.id}
                      rank={i + 1}
                      title={b.title}
                      slug={b.slug}
                      primary={`${num(b.viewCount)} views`}
                      secondary="0 CTA clicks"
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* ─── Recently generated (last 7d) ────────────────────────── */}
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-slate-300" /> Recently generated (last 7 days)
                </h2>
                <div className="space-y-2">
                  {data.recentlyGenerated.length === 0 ? (
                    <p className="text-sm text-slate-400">No new blogs in the last 7 days.</p>
                  ) : data.recentlyGenerated.map(b => {
                    const past = b.marketMatch && new Date(b.marketMatch.kickoffDate) < new Date(b.createdAt)
                    const finished = b.marketMatch?.status === 'FINISHED'
                    const bad = past || finished
                    return (
                      <div key={b.id} className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${bad ? 'border-red-500/40 bg-red-950/20' : 'border-slate-700 bg-slate-900/40'}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex flex-col gap-1">
                            {b.aiGenerated && <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">AI</Badge>}
                            {!b.isPublished && <Badge className="bg-slate-600/30 text-slate-300 border-slate-500/30 text-xs">Draft</Badge>}
                          </div>
                          <div className="min-w-0">
                            <Link href={`/admin/blogs/${b.id}/edit`} className="text-sm text-white hover:text-blue-300 truncate block">
                              {b.title}
                            </Link>
                            <p className="text-xs text-slate-400">
                              {b.category} · {new Date(b.createdAt).toISOString().slice(0, 10)}
                              {b.marketMatch && ` · ${b.marketMatch.homeTeam} vs ${b.marketMatch.awayTeam} [${b.marketMatch.status}]`}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm text-slate-300 whitespace-nowrap">{num(b.viewCount)} views</p>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  )
}

// ─── Subcomponents ─────────────────────────────────────────────────────

function Stat({
  icon: Icon, label, value, sub,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  sub?: string
}) {
  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold text-white mt-1">{value}</p>
            {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
          </div>
          <Icon className="w-5 h-5 text-slate-500" />
        </div>
      </CardContent>
    </Card>
  )
}

function QueueChip({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{count}</p>
    </div>
  )
}

function TrackerTierRow({
  label, colorClass, wins, losses, pending, net, roiPct, staked,
}: {
  label: string; colorClass: string
  wins: number; losses: number; pending: number
  net: number; roiPct: number; staked: number
}) {
  const tone = net > 0 ? 'text-emerald-300' : net < 0 ? 'text-red-300' : 'text-slate-200'
  const sign = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '')
  return (
    <div className={`rounded-lg border p-4 ${colorClass}`}>
      <p className="text-xs text-slate-300 font-semibold mb-2">{label}</p>
      <div className="flex items-baseline gap-4 flex-wrap">
        <div>
          <p className="text-[10px] text-slate-400 uppercase">Net</p>
          <p className={`text-2xl font-bold ${tone}`}>{sign(net)}${Math.abs(net).toFixed(0)}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 uppercase">ROI</p>
          <p className={`text-2xl font-bold ${tone}`}>{sign(roiPct)}{Math.abs(roiPct).toFixed(1)}%</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 uppercase">Record</p>
          <p className="text-2xl font-bold text-white">{wins}<span className="text-slate-500">–</span>{losses}</p>
        </div>
      </div>
      <p className="text-xs text-slate-500 mt-2">
        Staked ${staked.toLocaleString()} · {pending} pending
      </p>
    </div>
  )
}

function BlogRow({
  rank, title, slug, primary, secondary, ai,
}: {
  rank: number; title: string; slug: string
  primary: string; secondary?: string; ai?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-700 bg-slate-900/40">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-xs text-slate-500 w-6 flex-shrink-0">#{rank}</span>
        {ai && <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">AI</Badge>}
        <Link href={`/blog/${slug}`} target="_blank" className="text-sm text-white hover:text-blue-300 truncate">
          {title}
        </Link>
      </div>
      <div className="text-right">
        <p className="text-sm text-slate-200 whitespace-nowrap">{primary}</p>
        {secondary && <p className="text-xs text-slate-400 whitespace-nowrap">{secondary}</p>}
      </div>
    </div>
  )
}
