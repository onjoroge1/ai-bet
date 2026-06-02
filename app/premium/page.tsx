import type { Metadata } from 'next'
import Link from 'next/link'
import prisma from '@/lib/db'
import { AdvancedBreadcrumb } from '@/components/advanced-breadcrumb'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Trophy,
  Lock,
  Target,
  CheckCircle,
  ArrowRight,
  Clock,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { aggregateStats, filterRowsByTier, type TrackerPickRow } from '@/lib/premium-tracker/stats'

export const dynamic = 'force-dynamic'
export const revalidate = 300

export const metadata: Metadata = {
  title: 'Premium Picks — Today\'s Top AI-Qualified Bets | SnapBet AI',
  description:
    "Today's premium-qualified picks from SnapBet's AI engine. See team matchups and kickoffs free; sign up to unlock the model's pick + consensus odds for each.",
  alternates: { canonical: '/premium' },
  openGraph: {
    title: 'Premium Picks — SnapBet AI',
    description:
      "Today's premium-qualified AI picks. Sign up to unlock the model's pick + odds for every match.",
    url: '/premium',
    type: 'website',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────

function fmtUSD(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '−' : ''
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

function fmtPctSigned(p: number): string {
  const sign = p > 0 ? '+' : p < 0 ? '−' : ''
  return `${sign}${Math.abs(p).toFixed(1)}%`
}

function fmtKickoff(d: Date): string {
  return d.toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function dollarTone(n: number): string {
  if (n > 0) return 'text-emerald-300'
  if (n < 0) return 'text-red-300'
  return 'text-slate-200'
}

// ─── Page ─────────────────────────────────────────────────────────────

export default async function PremiumPage() {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400 * 1000)
  const next72h = new Date(now.getTime() + 72 * 3600 * 1000)

  const [trackerRows, livePicks, recentSettled] = await Promise.all([
    // 30-day rolling tracker history for the headline
    prisma.premiumPickHistory.findMany({
      where: { publishedAt: { gte: thirtyDaysAgo } },
      select: {
        oddsAtPublish: true, stakeDollars: true,
        netDollars: true, netUnits: true,
        result: true, tier: true, sport: true, league: true,
        market: true, publishedAt: true, kickoffDate: true, settledAt: true,
      },
      orderBy: { publishedAt: 'desc' },
      take: 500,
    }),
    // Today's live (pending) premium picks. Strong-tier hidden from this
    // public surface per the 2026-05-15 audit (strong tier is -5.3% ROI;
    // shouldn't be promoted as a product). Audit at /performance still
    // shows all tiers for transparency.
    prisma.premiumPickHistory.findMany({
      where: {
        result: 'pending',
        tier: 'premium',
        kickoffDate: { gte: now, lte: next72h },
      },
      orderBy: [{ kickoffDate: 'asc' }],
      select: {
        id: true, tier: true,
        homeTeam: true, awayTeam: true, league: true,
        pick: true, oddsAtPublish: true,
        kickoffDate: true, confidence: true,
      },
      take: 12,
    }),
    // Recent settled picks for credibility (wins AND losses included)
    // Recent settled — premium-tier only (strong tier excluded per audit).
    prisma.premiumPickHistory.findMany({
      where: {
        result: { in: ['win', 'loss'] },
        tier: 'premium',
      },
      orderBy: { settledAt: 'desc' },
      take: 8,
      select: {
        id: true, tier: true, homeTeam: true, awayTeam: true, league: true,
        pick: true, oddsAtPublish: true, result: true, netDollars: true,
        settledAt: true, kickoffDate: true,
      },
    }),
  ])

  const trackerInput: TrackerPickRow[] = trackerRows.map(r => ({
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
  // Headline is always premium-tier only — strong tier is -5.3% ROI per
  // the 2026-05-15 audit and shouldn't be marketed. Audit at /performance
  // remains transparent about all tiers.
  const headline = aggregateStats(filterRowsByTier(trackerInput, 'premium'))
  const headlineLabel = 'Premium tier · 30d'

  const premiumPicks = livePicks.filter(p => p.tier === 'premium')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <AdvancedBreadcrumb />
      </div>

      <article className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">

        {/* ── Hero ───────────────────────────────────────────────── */}
        <header>
          <p className="text-xs uppercase tracking-widest text-amber-300 font-semibold flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5" />
            Premium · Sign-up required
          </p>
          <h1 className="text-3xl sm:text-5xl font-bold text-white mt-2 leading-tight">
            Today&apos;s premium picks,<br />unlocked.
          </h1>
          <p className="text-slate-300 mt-4 text-base sm:text-lg max-w-2xl leading-relaxed">
            See the team matchups free. Sign up to unlock the AI&apos;s pick and the
            consensus odds for every premium-qualified match — backed by an audited
            flat-stake performance record.
          </p>
        </header>

        {/* ── Tracker headline ───────────────────────────────────── */}
        <Card className="bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 border-amber-500/30">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-amber-300 font-semibold flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5" />
                  Live tracker · {headlineLabel}
                </p>
                <p className={`text-4xl sm:text-5xl font-bold mt-2 ${dollarTone(headline.netDollars)}`}>
                  {fmtUSD(headline.netDollars)}
                </p>
                <p className="text-sm text-slate-300 mt-2">
                  ROI <span className={dollarTone(headline.roiPct)}>{fmtPctSigned(headline.roiPct)}</span>
                  {' · '}
                  Record <span className="text-white font-semibold">{headline.record.wins}–{headline.record.losses}</span>
                  {' · '}
                  Hit rate {headline.hitRatePct.toFixed(1)}%
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  Flat $100 simulation. Every premium-qualified pick, wins and losses included.
                </p>
              </div>
              <Link href="/performance" className="text-sm text-amber-200 hover:text-amber-100 underline underline-offset-2">
                Full audit →
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* ── Sign-up CTA strip ──────────────────────────────────── */}
        <Card className="bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border-emerald-500/40">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-lg font-bold text-white">Unlock every pick + odds</p>
                <p className="text-sm text-slate-300 mt-1">
                  Free account. No credit card. See the full pick on every premium match below.
                </p>
              </div>
              <div className="flex gap-3">
                <Button asChild size="lg" className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold">
                  <Link href="/signup?source=premium_top_cta&callbackUrl=/premium">
                    Get free access
                    <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-800">
                  <Link href="/signin?callbackUrl=/premium">Sign in</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Today's premium picks (TEASER — locked) ────────────── */}
        <section>
          <SectionHeading icon={Target} label={`Today's premium picks (${premiumPicks.length})`} />
          {premiumPicks.length === 0 ? (
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-8 text-center">
                <Clock className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <p className="text-sm text-slate-300">
                  No matches currently meet the premium tier criteria in the next 72 hours.
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  Premium criteria: V3 confidence ≥55–60% in qualifying leagues. Checks every 2 hours.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {premiumPicks.map(p => (
                <LockedPickCard key={p.id} pick={p} />
              ))}
            </div>
          )}
        </section>

        {/* ── Recent settled picks (proof) ───────────────────────── */}
        {recentSettled.length > 0 && (
          <section>
            <SectionHeading icon={CheckCircle} label="Recent results" href="/performance" hrefLabel="Full audit →" />
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-0">
                <div className="divide-y divide-slate-700/60">
                  {recentSettled.map(r => {
                    const net = r.netDollars !== null ? Number(r.netDollars) : 0
                    const settled = r.settledAt ?? r.kickoffDate
                    return (
                      <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="text-[10px] text-slate-500 w-10 flex-shrink-0">{fmtDate(settled)}</span>
                          <div className="min-w-0">
                            <p className="text-sm text-white truncate">{r.homeTeam} vs {r.awayTeam}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              {r.league} · pick: {r.pick} @ {Number(r.oddsAtPublish).toFixed(2)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={r.result === 'win'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]'
                            : 'bg-red-500/20 text-red-300 border-red-500/40 text-[10px]'
                          }>
                            {r.result === 'win' ? '✓ Win' : '✗ Loss'}
                          </Badge>
                          <span className={`text-sm font-mono font-semibold ${dollarTone(net)} w-16 text-right`}>
                            {fmtUSD(net)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* ── Bottom CTA ─────────────────────────────────────────── */}
        <Card className="bg-gradient-to-br from-blue-950/40 via-slate-900 to-slate-900 border-blue-500/40">
          <CardContent className="p-6 sm:p-8 text-center">
            <Trophy className="w-10 h-10 text-amber-300 mx-auto mb-3" />
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Ready to see the picks?
            </h2>
            <p className="text-slate-300 mt-2 max-w-xl mx-auto">
              Free account. Unlock today&apos;s premium picks + the consensus odds we used to track them.
            </p>
            <div className="flex flex-wrap gap-3 justify-center mt-6">
              <Button asChild size="lg" className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold">
                <Link href="/signup?source=premium_bottom_cta&callbackUrl=/premium">
                  Create free account
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-800">
                <Link href="/dashboard/snapbet-picks">
                  Already signed in?
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <Card className="bg-slate-900/60 border-slate-700">
          <CardContent className="p-5">
            <p className="text-xs text-slate-400 leading-relaxed flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
              <span>
                Predictions are AI-generated and for informational use only. Performance numbers are
                flat-stake simulations against historical consensus odds — not a guarantee of future
                results.{' '}
                <Link href="/methodology" className="text-blue-300 hover:text-blue-200 underline">Methodology</Link>
                {' · '}
                <Link href="/performance" className="text-blue-300 hover:text-blue-200 underline">Full audit</Link>
                {' · '}
                <Link href="/responsible-betting" className="text-blue-300 hover:text-blue-200 underline">Bet responsibly</Link>
              </span>
            </p>
          </CardContent>
        </Card>
      </article>
    </div>
  )
}

// ─── Subcomponents ────────────────────────────────────────────────────

function SectionHeading({
  icon: Icon, label, href, hrefLabel,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  href?: string
  hrefLabel?: string
}) {
  return (
    <div className="flex items-end justify-between mb-3 border-b border-slate-700/60 pb-2">
      <h2 className="text-lg font-semibold text-white flex items-center gap-2">
        <Icon className="w-5 h-5 text-amber-300" />
        {label}
      </h2>
      {href && (
        <Link href={href} className="text-xs text-blue-300 hover:text-blue-200 underline underline-offset-2">
          {hrefLabel}
        </Link>
      )}
    </div>
  )
}

interface PickRow {
  tier: string
  homeTeam: string
  awayTeam: string
  league: string | null
  kickoffDate: Date
  pick: string
  oddsAtPublish: unknown
  confidence: unknown
}

function LockedPickCard({ pick }: { pick: PickRow }) {
  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">
            {pick.league || 'Soccer'}
          </p>
          <Badge className={pick.tier === 'premium'
            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] uppercase'
            : 'bg-blue-500/20 text-blue-300 border-blue-500/40 text-[10px] uppercase'
          }>
            {pick.tier}
          </Badge>
        </div>
        <p className="text-sm font-semibold text-white leading-snug">
          {pick.homeTeam} <span className="text-slate-500">vs</span> {pick.awayTeam}
        </p>
        <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
          <Clock className="w-3 h-3" />
          {fmtKickoff(pick.kickoffDate)}
        </p>
        {/* Locked pick + odds */}
        <div className="relative">
          <div className="flex items-center justify-between p-3 rounded-lg border border-slate-700 bg-slate-900/60 select-none">
            <div className="blur-md">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Pick</p>
              <p className="text-sm font-semibold text-white">{pick.pick}</p>
            </div>
            <div className="blur-md text-right">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Odds</p>
              <p className="text-sm font-semibold text-white">{Number(pick.oddsAtPublish).toFixed(2)}</p>
            </div>
          </div>
          {/* Lock overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-slate-900/40 to-slate-900/80 rounded-lg">
            <Link
              href="/signup?source=premium_locked_pick&callbackUrl=/premium"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500/90 hover:bg-emerald-400 text-slate-900 text-xs font-semibold transition-colors"
            >
              <Lock className="w-3 h-3" />
              Sign up to unlock
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
