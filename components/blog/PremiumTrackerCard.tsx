"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { ArrowRight, Trophy, Info, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * PremiumTrackerCard — rendered inside high-traffic blog pages to surface
 * the live model performance simulation. Mounted client-side so we can
 * fetch fresh stats per page view and fire impression + CTA events
 * through /api/premium-tracker/track.
 *
 * Forward-only by design: until the capture has accumulated meaningful
 * data, the card renders an explainer empty state rather than a hyped
 * number. The headline never lies — it shows the real net dollars at
 * flat $100 stakes over the rolling window.
 */

interface TrackerStats {
  record: { wins: number; losses: number; pushes: number; voids: number; pending: number }
  totalStakedDollars: number
  netDollars: number
  netUnits: number
  roiPct: number
  avgOdds: number
  hitRatePct: number
  settledCount: number
  picksCount: number
  windowStart: string | null
  windowEnd: string | null
}

interface Provenance {
  backfillCount: number
  forwardCount: number
  hasBackfill: boolean
  dataStartDate: string | null
  forwardCaptureStartDate: string | null
}

interface ApiResponse {
  success: boolean
  stats: TrackerStats
  premiumOnly: TrackerStats
  provenance?: Provenance
  window: { days: number; start: string | null; end: string | null }
}

interface PremiumTrackerCardProps {
  blogId?: string
  /** Headline data source. 'premium' is the recommended default — the model
   * has its strongest ROI on the premium tier and it's a cleaner story.
   * 'all' aggregates premium + strong. */
  mode?: 'premium' | 'all'
  /** When set, scopes the tracker to picks involving this team. If fewer
   * than 5 settled picks exist for the team, the card falls back to the
   * site-wide tracker (so we never show "0 picks" for a thinly-tracked
   * team — site-wide proof is better than empty proof). */
  teamName?: string
}

function track(type: 'impression' | 'cta_click_picks' | 'cta_click_audit', blogId?: string) {
  if (typeof window === 'undefined') return
  const body = JSON.stringify({ type, blogId })
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' })
      if (navigator.sendBeacon('/api/premium-tracker/track', blob)) return
    }
    void fetch('/api/premium-tracker/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    /* tracker failure must never break UX */
  }
}

function fmtUSD(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '−' : ''
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtUnits(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '−' : ''
  return `${sign}${Math.abs(n).toFixed(2)}u`
}

function dollarTone(n: number): string {
  if (n > 0) return 'text-emerald-300'
  if (n < 0) return 'text-red-300'
  return 'text-slate-200'
}

function fmtMonthDay(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function PremiumTrackerCard({ blogId, mode = 'premium', teamName }: PremiumTrackerCardProps) {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [error, setError] = useState(false)
  const [impressionFired, setImpressionFired] = useState(false)
  const [scopedToTeam, setScopedToTeam] = useState<boolean>(Boolean(teamName))

  useEffect(() => {
    let cancelled = false
    async function load() {
      // If a teamName is provided, first try the team-scoped query.
      // Fall back to site-wide if <5 settled picks for the team.
      if (teamName) {
        try {
          const res = await fetch(`/api/premium-tracker/stats?window=30&teamName=${encodeURIComponent(teamName)}`)
          const json = (await res.json()) as ApiResponse
          const headline = mode === 'premium' ? json.premiumOnly : json.stats
          if (json.success && headline.settledCount >= 5) {
            if (!cancelled) {
              setData(json)
              setScopedToTeam(true)
            }
            return
          }
        } catch {
          // fall through to site-wide
        }
      }
      try {
        const res = await fetch('/api/premium-tracker/stats?window=30')
        const json = (await res.json()) as ApiResponse
        if (!cancelled) {
          setData(json)
          setScopedToTeam(false)
        }
      } catch {
        if (!cancelled) setError(true)
      }
    }
    load()
    return () => { cancelled = true }
  }, [teamName, mode])

  // Fire impression once when we have data to actually show
  useEffect(() => {
    if (data && !impressionFired) {
      track('impression', blogId)
      setImpressionFired(true)
    }
  }, [data, impressionFired, blogId])

  const onPicksClick = useCallback(() => track('cta_click_picks', blogId), [blogId])
  const onAuditClick = useCallback(() => track('cta_click_audit', blogId), [blogId])

  // ── Loading ─────────────────────────────────────────────────────
  if (!data && !error) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-900 p-6 my-10">
        <div className="flex items-center gap-3 text-slate-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading tracker…
        </div>
      </div>
    )
  }

  // ── Error / no data ─────────────────────────────────────────────
  if (error || !data || !data.success) {
    return null  // fail silent — card hides; rest of blog renders normally
  }

  const headline = mode === 'premium' ? data.premiumOnly : data.stats
  const hasData = headline.settledCount > 0
  const lowSample = headline.settledCount > 0 && headline.settledCount < 5

  // ── Empty state ─────────────────────────────────────────────────
  if (!hasData) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-900 p-6 sm:p-8 my-10">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <Trophy className="w-5 h-5 text-amber-300" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white">$100 Premium Pick Tracker</h3>
            <p className="text-sm text-slate-300 mt-1.5 leading-relaxed">
              {"We're now recording every premium-qualified pick our AI surfaces with a virtual $100 flat stake. Results will appear here as matches settle — usually within 24 hours of kickoff."}
            </p>
            <div className="flex flex-wrap gap-3 mt-4">
              <Button asChild size="sm" className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold">
                <Link href="/premium" onClick={onPicksClick}>
                  {"See today's picks"}
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="border-amber-500/40 text-amber-200 hover:bg-amber-500/10">
                <Link href="/performance" onClick={onAuditClick}>
                  How we track this
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Headline rendering ──────────────────────────────────────────
  const baseTierLabel = mode === 'premium' ? 'Premium tier' : 'All tracked picks'
  const tierLabel = scopedToTeam && teamName
    ? `${baseTierLabel} · ${teamName}`
    : baseTierLabel

  return (
    <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-900 p-6 sm:p-8 my-10">
      <div className="flex items-start gap-4 mb-4">
        <div className="w-11 h-11 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
          <Trophy className="w-5 h-5 text-amber-300" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-bold text-white">$100 Premium Pick Tracker</h3>
            <span className="text-[10px] uppercase tracking-widest text-amber-300/80 font-semibold">
              {tierLabel} · Last 30d
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Flat-stake simulation. Wins and losses included.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Net</p>
          <p className={`text-2xl sm:text-3xl font-bold mt-0.5 ${dollarTone(headline.netDollars)}`}>
            {fmtUSD(headline.netDollars)}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{fmtUnits(headline.netUnits)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-400">ROI</p>
          <p className={`text-2xl sm:text-3xl font-bold mt-0.5 ${dollarTone(headline.roiPct)}`}>
            {headline.roiPct > 0 ? '+' : headline.roiPct < 0 ? '−' : ''}
            {Math.abs(headline.roiPct).toFixed(1)}%
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Avg odds {headline.avgOdds.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Record</p>
          <p className="text-2xl sm:text-3xl font-bold text-white mt-0.5">
            {headline.record.wins}<span className="text-slate-500">–</span>{headline.record.losses}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Hit rate {headline.hitRatePct.toFixed(0)}%</p>
        </div>
      </div>

      {lowSample && (
        <div className="flex items-center gap-2 text-[11px] text-amber-200/80 mb-4 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          Small sample ({headline.settledCount} settled). Numbers will stabilise as more matches finish.
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Button asChild size="sm" className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold">
          <Link href="/premium" onClick={onPicksClick}>
            {"See today's premium picks"}
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="border-amber-500/40 text-amber-200 hover:bg-amber-500/10">
          <Link href="/performance" onClick={onAuditClick}>
            See full audit
          </Link>
        </Button>
      </div>

      {data.provenance?.hasBackfill && (
        <p className="text-[10px] text-slate-500 mt-4 leading-relaxed">
          Includes {data.provenance.backfillCount} reconstructed{' '}
          {data.provenance.dataStartDate && `from ${fmtMonthDay(data.provenance.dataStartDate)}`}
          {data.provenance.forwardCaptureStartDate && ` · live capture from ${fmtMonthDay(data.provenance.forwardCaptureStartDate)}`}
          . Same qualification rules applied.{' '}
          <Link href="/methodology" className="text-slate-400 hover:text-slate-300 underline underline-offset-2">
            How we track
          </Link>
          .
        </p>
      )}

      <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
        Simulation only. Past performance does not guarantee future results. Betting involves risk —{' '}
        <Link href="/responsible-betting" className="text-slate-400 hover:text-slate-300 underline underline-offset-2">
          bet responsibly
        </Link>
        .
      </p>
    </div>
  )
}
