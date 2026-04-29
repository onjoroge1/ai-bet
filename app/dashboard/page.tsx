"use client"

import dynamic from "next/dynamic"
import { Suspense, useState, useEffect } from "react"
import { Loader2, X, Crown, ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useDashboardData } from "@/hooks/use-dashboard-data"
import { DashboardErrorBoundary } from "@/components/dashboard/ErrorBoundary"
import { HeaderStats } from "@/components/dashboard/header-stats"

/**
 * DashboardPage — One-stop overview (Phase 1).
 *
 * Distils the four core surfaces (Top Picks, Hot Parlays, CLV Tracker,
 * Today's Matches) into a single 4-up grid. Each panel is a snapshot with
 * a drill-down link to its dedicated page. Free vs premium gating is
 * handled inside each widget — anonymous users see locked previews,
 * subscribers see real data.
 *
 * Removed in this refactor (vs the prior dashboard):
 *  - Quick-action chip row (redundant with the snapshot grid)
 *  - LiveMatchesWidget (rolled into TodaysMatchesWidget)
 *  - AIRecommendations placeholder (replaced by Phase 2 AI Briefing)
 *  - TimelineFeed (low-value, eats vertical space)
 *  - PersonalizedOffers / UpgradeOffers (consolidated into upgrade banner)
 *
 * Phase 2 will inject an AI-generated daily briefing card above the grid.
 */

// ── Critical (load first) ────────────────────────────────────────
const StatsOverview = dynamic(
  () => import("@/components/dashboard/stats-overview").then((mod) => mod.StatsOverview),
  { loading: () => <WidgetSkeleton /> }
)

const PackageCredits = dynamic(
  () => import("@/components/dashboard/package-credits").then((mod) => mod.PackageCredits),
  { loading: () => <WidgetSkeleton /> }
)

// ── Snapshot panels (the new 4-up grid) ──────────────────────────
const HotPicks = dynamic(
  () => import("@/components/dashboard/hot-picks").then((mod) => mod.HotPicks),
  { loading: () => <WidgetSkeleton /> }
)

const ParlaysPreviewWidget = dynamic(
  () => import("@/components/dashboard/parlays-preview-widget").then((mod) => mod.ParlaysPreviewWidget),
  { loading: () => <WidgetSkeleton /> }
)

const CLVPreviewWidget = dynamic(
  () => import("@/components/dashboard/clv-preview-widget").then((mod) => mod.CLVPreviewWidget),
  { loading: () => <WidgetSkeleton /> }
)

const TodaysMatchesWidget = dynamic(
  () => import("@/components/dashboard/todays-matches-widget").then((mod) => mod.TodaysMatchesWidget),
  { loading: () => <WidgetSkeleton /> }
)

// ── AI daily briefing (Phase 2) ──────────────────────────────────
const DailyBriefing = dynamic(
  () => import("@/components/dashboard/daily-briefing").then((mod) => mod.DailyBriefing),
  { loading: () => <WidgetSkeleton />, ssr: false }
)

// ── Activity (collapsed/secondary) ───────────────────────────────
const NotificationsWidget = dynamic(
  () => import("@/components/notifications-widget").then((mod) => mod.NotificationsWidget),
  { loading: () => <WidgetSkeleton /> }
)

function WidgetSkeleton() {
  return (
    <div className="h-48 flex items-center justify-center rounded-xl bg-slate-800/30 border border-slate-800/50">
      <Loader2 className="h-6 w-6 animate-spin text-emerald-500/60" />
    </div>
  )
}

export default function DashboardPage() {
  const { data } = useDashboardData()
  const searchParams = useSearchParams()
  const showUpgrade = searchParams.get("upgrade") === "true"
  const showAlreadySubscribed = searchParams.get("already_subscribed") === "true"
  const [upgradeVisible, setUpgradeVisible] = useState(false)
  const [subscribedVisible, setSubscribedVisible] = useState(false)

  useEffect(() => {
    if (showUpgrade) setUpgradeVisible(true)
    if (showAlreadySubscribed) setSubscribedVisible(true)
  }, [showUpgrade, showAlreadySubscribed])

  const firstName = data?.user?.fullName?.split(" ")[0] || "User"
  const winStreak = data?.user?.winStreak || 0
  const accuracy = data?.dashboard?.predictionAccuracy || "0%"

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Premium-required banner (when redirected from premium route) ── */}
      {upgradeVisible && (
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-900/40 via-slate-800/80 to-slate-900/60 p-5 shadow-[0_0_30px_rgba(245,158,11,0.15)]">
          <button
            onClick={() => setUpgradeVisible(false)}
            className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center border border-amber-500/30 shrink-0">
              <Crown className="w-6 h-6 text-amber-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-white">Premium Required</h3>
              <p className="text-slate-300 text-sm mt-1">
                The page you tried to access requires a VIP subscription. Upgrade to unlock
                AI Parlays, Analytics, CLV Tracker, and the VIP Intelligence Feed.
              </p>
            </div>
            <Link href="/pricing?plan=premium_intelligence">
              <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold shadow-[0_0_15px_rgba(245,158,11,0.3)] border-0 whitespace-nowrap">
                <Crown className="w-4 h-4 mr-2" />
                View Plans
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* ── Already-subscribed nudge (admin or duplicate-tier checkout attempt) ── */}
      {subscribedVisible && (
        <div className="relative rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 flex items-start gap-3">
          <button
            onClick={() => setSubscribedVisible(false)}
            className="absolute top-2 right-2 text-emerald-300 hover:text-white"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
          <Crown className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
          <div>
            <p className="font-medium text-emerald-300">You already have full access</p>
            <p className="text-sm text-emerald-200/90 mt-0.5">No subscription needed — explore the dashboard.</p>
          </div>
        </div>
      )}

      {/* ── Header: welcome + accuracy + AI active badge + 4 quick KPIs ── */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Welcome back, {firstName}!</h1>
            <p className="text-slate-400 mt-1 text-sm">
              {winStreak > 0 && (
                <span className="text-emerald-400 font-semibold">{winStreak}-win streak</span>
              )}
              {winStreak > 0 && " • "}
              {accuracy} accuracy • Here&apos;s what&apos;s hot today
            </p>
          </div>
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 self-start sm:self-auto">
            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
            AI Active
          </Badge>
        </div>

        {/* Real header KPIs — replaces the random-walk numbers from the old dashboard */}
        <HeaderStats />
      </div>

      {/* ── AI Daily Briefing (Phase 2) ─ LLM-generated, cached 1h ── */}
      <DashboardErrorBoundary section="Daily Briefing" compact>
        <Suspense fallback={<WidgetSkeleton />}>
          <DailyBriefing />
        </Suspense>
      </DashboardErrorBoundary>

      {/* ── 4-up snapshot grid: Top Picks · Hot Parlays · CLV · Matches ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <DashboardErrorBoundary section="Top Picks" compact>
          <Suspense fallback={<WidgetSkeleton />}>
            <HotPicks />
          </Suspense>
        </DashboardErrorBoundary>
        <DashboardErrorBoundary section="Hot Parlays" compact>
          <Suspense fallback={<WidgetSkeleton />}>
            <ParlaysPreviewWidget />
          </Suspense>
        </DashboardErrorBoundary>
        <DashboardErrorBoundary section="CLV Tracker" compact>
          <Suspense fallback={<WidgetSkeleton />}>
            <CLVPreviewWidget />
          </Suspense>
        </DashboardErrorBoundary>
        <DashboardErrorBoundary section="Today's Matches" compact>
          <Suspense fallback={<WidgetSkeleton />}>
            <TodaysMatchesWidget />
          </Suspense>
        </DashboardErrorBoundary>
      </div>

      {/* ── Performance + Credits (your numbers) ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <DashboardErrorBoundary section="Stats Overview" compact>
            <Suspense fallback={<WidgetSkeleton />}>
              <StatsOverview />
            </Suspense>
          </DashboardErrorBoundary>
        </div>
        <div>
          <DashboardErrorBoundary section="Package Credits" compact>
            <Suspense fallback={<WidgetSkeleton />}>
              <PackageCredits />
            </Suspense>
          </DashboardErrorBoundary>
        </div>
      </div>

      {/* ── Recent Activity: Notifications (collapsed by default in widget) ── */}
      <DashboardErrorBoundary section="Notifications">
        <Suspense fallback={<WidgetSkeleton />}>
          <NotificationsWidget />
        </Suspense>
      </DashboardErrorBoundary>
    </div>
  )
}
