"use client"

import dynamic from "next/dynamic"
import { Suspense, useState, useEffect } from "react"
import { Loader2, Trophy, Layers, Users, Zap, Crown, X, ArrowRight, BarChart3, Activity, CheckCircle } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useDashboardData } from "@/hooks/use-dashboard-data"

/**
 * DashboardPage - Streamlined Overview
 *
 * Optimized for fast loading and clear purpose:
 * - Welcome message with quick stats
 * - Quick action navigation cards
 * - Essential widgets only (Stats, Credits, Notifications, Live Matches)
 * - Progressive loading (critical first, secondary after)
 * 
 * Moved to standalone pages:
 * - Referrals → /dashboard/referrals
 * - Quiz Credits → /dashboard/rewards
 * - Claimed Tips → /dashboard/my-bets
 * - Upgrade Offers → Simplified or in /dashboard/premium
 */

// ── Critical Components (Load First) ────────────────────────────────
const StatsOverview = dynamic(
  () => import("@/components/dashboard/stats-overview").then((mod) => mod.StatsOverview),
  { loading: () => <WidgetSkeleton /> }
)

const PackageCredits = dynamic(
  () => import("@/components/dashboard/package-credits").then((mod) => mod.PackageCredits),
  { loading: () => <WidgetSkeleton /> }
)

// ── Secondary Components (Load After Critical) ────────────────────────
const NotificationsWidget = dynamic(
  () => import("@/components/notifications-widget").then((mod) => mod.NotificationsWidget),
  { loading: () => <WidgetSkeleton /> }
)

const LiveMatchesWidget = dynamic(
  () => import("@/components/live-matches-widget").then((mod) => mod.LiveMatchesWidget),
  { loading: () => <WidgetSkeleton /> }
)

// ── AI Recommendations ────────────────────────────────────────────────
const AIRecommendations = dynamic(
  () => import("@/components/dashboard/ai-recommendations").then((mod) => mod.AIRecommendations),
  {
    loading: () => <WidgetSkeleton />,
    ssr: false,
  }
)

// ── Tertiary Components (Load Last or On-Demand) ──────────────────────
const TimelineFeed = dynamic(
  () => import("@/components/dashboard/timeline-feed").then((mod) => mod.TimelineFeed),
  { 
    loading: () => <WidgetSkeleton />,
    ssr: false // Client-side only for better initial load
  }
)

const UpgradeOffers = dynamic(
  () => import("@/components/upgrade-offers").then((mod) => mod.UpgradeOffers),
  { 
    loading: () => <WidgetSkeleton />,
    ssr: false // Client-side only
  }
)

const PersonalizedOffers = dynamic(
  () => import("@/components/personalized-offers").then((mod) => mod.PersonalizedOffers),
  { 
    loading: () => <WidgetSkeleton />,
    ssr: false // Client-side only
  }
)

/** Shared loading skeleton for widget placeholders */
function WidgetSkeleton() {
  return (
    <div className="h-48 flex items-center justify-center rounded-xl bg-slate-800/30 border border-slate-800/50">
      <Loader2 className="h-6 w-6 animate-spin text-emerald-500/60" />
    </div>
  )
}

/** Quick action card links */
const quickActions = [
  {
    href: "/dashboard/matches",
    icon: Trophy,
    title: "Browse Matches",
    subtitle: "AI predictions",
    gradient: "from-emerald-500/10 to-emerald-500/5",
    border: "border-emerald-500/20 hover:border-emerald-500/40",
    iconColor: "text-emerald-400",
  },
  {
    href: "/dashboard/parlays",
    icon: Layers,
    title: "AI Parlays",
    subtitle: "Curated picks",
    gradient: "from-orange-500/10 to-orange-500/5",
    border: "border-orange-500/20 hover:border-orange-500/40",
    iconColor: "text-orange-400",
  },
  {
    href: "/dashboard/my-tips",
    icon: Users,
    title: "My Tips",
    subtitle: "Purchased picks",
    gradient: "from-blue-500/10 to-blue-500/5",
    border: "border-blue-500/20 hover:border-blue-500/40",
    iconColor: "text-blue-400",
  },
  {
    href: "/dashboard/daily-tips",
    icon: Zap,
    title: "Daily Tips",
    subtitle: "Today's best",
    gradient: "from-purple-500/10 to-purple-500/5",
    border: "border-purple-500/20 hover:border-purple-500/40",
    iconColor: "text-purple-400",
  },
]

export default function DashboardPage() {
  const { data, isLoading } = useDashboardData()
  const searchParams = useSearchParams()
  const showUpgrade = searchParams.get("upgrade") === "true"
  const [upgradeVisible, setUpgradeVisible] = useState(false)

  useEffect(() => {
    if (showUpgrade) setUpgradeVisible(true)
  }, [showUpgrade])

  const firstName = data?.user?.fullName?.split(" ")[0] || "User"
  const winStreak = data?.user?.winStreak || 0
  const accuracy = data?.dashboard?.predictionAccuracy || "0%"

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Upgrade Banner (shown when redirected from premium route) ── */}
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
                The page you tried to access requires a VIP subscription. Upgrade now to unlock
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

      {/* ── Page Header ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Welcome back, {firstName}!
          </h1>
          <p className="text-slate-400 mt-1">
            {winStreak > 0 && (
              <span className="text-emerald-400 font-semibold">{winStreak}-win streak</span>
            )}
            {winStreak > 0 && " • "}
            {accuracy} accuracy • Here&apos;s your overview
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
            AI Active
          </Badge>
        </div>
      </div>

      {/* ── Quick Actions Grid ───────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {quickActions.map((action) => (
          <Link key={action.href} href={action.href}>
            <Card
              className={`bg-gradient-to-br ${action.gradient} ${action.border} border p-4 transition-all duration-200 cursor-pointer hover:shadow-lg group`}
            >
              <div className="flex items-center gap-3">
                <action.icon className={`w-7 h-7 ${action.iconColor}`} />
                <div>
                  <p className="font-semibold text-white text-sm group-hover:text-emerald-300 transition-colors">
                    {action.title}
                  </p>
                  <p className="text-xs text-slate-400">{action.subtitle}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* ── Critical Content: Stats + Credits ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Suspense fallback={<WidgetSkeleton />}>
            <StatsOverview />
          </Suspense>
        </div>
        <div>
          <Suspense fallback={<WidgetSkeleton />}>
            <PackageCredits />
          </Suspense>
        </div>
      </div>

      {/* ── Secondary Content: Notifications + Live Matches ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Suspense fallback={<WidgetSkeleton />}>
          <NotificationsWidget />
        </Suspense>
        <Suspense fallback={<WidgetSkeleton />}>
          <LiveMatchesWidget />
        </Suspense>
      </div>

      {/* ── AI Intelligence Feed ──────────────────────────────────────────── */}
      <Suspense fallback={<WidgetSkeleton />}>
        <AIRecommendations />
      </Suspense>

      {/* ── Tertiary Content: Timeline Feed (Loads Last) ───────────────────────────── */}
      <Suspense fallback={<WidgetSkeleton />}>
        <TimelineFeed />
      </Suspense>

      {/* ── Premium Packages (Loads Last, Client-Side Only) ──────────────────── */}
      <Suspense fallback={<WidgetSkeleton />}>
        <PersonalizedOffers />
      </Suspense>

      {/* ── Upgrade Offers (Loads Last, Client-Side Only) ──────────────────── */}
      <Suspense fallback={<WidgetSkeleton />}>
        <UpgradeOffers />
      </Suspense>
    </div>
  )
}
