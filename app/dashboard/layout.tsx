"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { logger } from "@/lib/logger"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getSession } from "@/lib/session-request-manager"
import { NotificationBell } from "@/components/notifications/NotificationBell"
import { LogoutButton } from "@/components/auth/logout-button"
import {
  Loader2,
  LayoutDashboard,
  Trophy,
  Layers,
  Users,
  Bookmark,
  History,
  Calculator,
  Settings,
  Bell,
  Search,
  Menu,
  X,
  ChevronRight,
  Zap,
  Activity,
  Crown,
  Gift,
  Sparkles,
  HeadphonesIcon,
  BarChart3,
} from "lucide-react"

/** Sidebar navigation link definition */
interface SidebarLink {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
  badgeVariant?: "default" | "hot" | "live" | "count"
  premiumOnly?: boolean
}

/** Main sidebar links — streamlined to 7 core items */
const sidebarLinks: SidebarLink[] = [
  { name: "SnapBet Picks", href: "/dashboard/snapbet-picks", icon: Crown, badge: "Premium", badgeVariant: "hot", premiumOnly: true },
  { name: "Matches", href: "/dashboard/matches", icon: Trophy },
  { name: "Parlays", href: "/dashboard/parlays", icon: Layers, badge: "AI", badgeVariant: "hot" },
  { name: "My Bets", href: "/dashboard/my-bets", icon: History },
  { name: "CLV Tracker", href: "/dashboard/clv", icon: Activity, badge: "Live", badgeVariant: "live", premiumOnly: true },
  { name: "Home", href: "/dashboard", icon: LayoutDashboard },
]

/** Profile dropdown links (moved from sidebar) */
const profileLinks: SidebarLink[] = [
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
  { name: "Rewards", href: "/dashboard/rewards", icon: Gift },
  { name: "Referrals", href: "/dashboard/referrals", icon: Sparkles },
  { name: "Support", href: "/dashboard/support", icon: HeadphonesIcon },
  { name: "Notifications", href: "/dashboard/notifications", icon: Bell },
]

/** Bottom sidebar links — just profile access */
const bottomLinks: SidebarLink[] = []

/**
 * DashboardLayout - Sidebar Navigation with Hybrid Authentication
 *
 * Architecture:
 * - Preserves existing optimized hybrid auth (useSession + server fallback)
 * - Adds persistent sidebar navigation (hidden on mobile, toggleable)
 * - Sticky top header with search, notifications, and profile
 * - "Upgrade to Pro" card for non-premium users
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [hasPremiumAccess, setHasPremiumAccess] = useState<boolean | null>(null)

  // ── Authentication (preserved from existing layout) ──────────────
  useEffect(() => {
    const checkAuth = async () => {
      let attempts = 0
      const maxWaitAttempts = 20
      const waitInterval = 100

      while (status === "loading" && attempts < maxWaitAttempts) {
        await new Promise((resolve) => setTimeout(resolve, waitInterval))
        attempts++
      }

      if (status === "authenticated" && session?.user) {
        logger.debug("DashboardLayout - Authenticated via useSession()", {
          tags: ["auth", "dashboard"],
          data: { email: session.user.email },
        })
        return
      }

      if (status === "unauthenticated") {
        await new Promise((resolve) => setTimeout(resolve, 200))
        try {
          logger.debug("DashboardLayout - Verifying server-side session", {
            tags: ["auth", "dashboard"],
          })
          const serverSession = await getSession()
          if (!serverSession?.user) {
            logger.info("DashboardLayout - Not authenticated, redirecting", {
              tags: ["auth", "dashboard", "redirect"],
            })
            router.replace("/signin")
            return
          }
          logger.warn("DashboardLayout - Server has session, waiting for sync", {
            tags: ["auth", "dashboard", "sync"],
          })
          await new Promise((resolve) => setTimeout(resolve, 500))
          return
        } catch (error) {
          logger.error("DashboardLayout - Auth check error", {
            tags: ["auth", "dashboard", "error"],
            error: error instanceof Error ? error : undefined,
          })
          router.replace("/signin")
          return
        }
      }

      if (status === "loading") {
        logger.warn("DashboardLayout - Still loading after max wait", {
          tags: ["auth", "dashboard"],
        })
        try {
          const serverSession = await getSession()
          if (!serverSession?.user) {
            router.replace("/signin")
            return
          }
        } catch (error) {
          logger.error("DashboardLayout - Auth check error", {
            tags: ["auth", "dashboard", "error"],
            error: error instanceof Error ? error : undefined,
          })
          router.replace("/signin")
        }
      }
    }

    checkAuth()
  }, [router, status, session])

  // ── Premium access check (non-blocking) ────────────────────────
  useEffect(() => {
    if (status !== "authenticated") return

    const checkPremium = async () => {
      try {
        const response = await fetch("/api/premium/check")
        if (response.ok) {
          const data = await response.json()
          setHasPremiumAccess(data.hasAccess === true)
        } else {
          setHasPremiumAccess(false)
        }
      } catch {
        setHasPremiumAccess(false)
      }
    }

    checkPremium()
  }, [status])

  // Close mobile sidebar on navigation
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  // ── Loading state ──────────────────────────────────────────────
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <Loader2 className="h-12 w-12 animate-spin text-emerald-500" />
        <p className="ml-4 text-slate-300 text-lg">Loading dashboard...</p>
      </div>
    )
  }

  // ── Redirect guard ─────────────────────────────────────────────
  if (status === "unauthenticated" || !session?.user) {
    return null
  }

  // ── Derived values ─────────────────────────────────────────────
  const displayName = session.user.name || session.user.email?.split("@")[0] || "User"
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
  const isAdmin = (session.user as { role?: string }).role?.toLowerCase() === "admin"

  return (
    <div className="min-h-screen bg-slate-900">
      {/* ── Mobile sidebar overlay ────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ───────────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-64 bg-slate-950 border-r border-slate-800 transform transition-transform duration-200 ease-in-out lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-4 border-b border-slate-800">
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">SnapBet</span>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0">
                AI
              </Badge>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-slate-400 hover:text-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            <div className="px-2 py-2">
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                Main
              </p>
            </div>
            {sidebarLinks.map((link) => {
              const isActive =
                pathname === link.href ||
                (link.href !== "/dashboard" && pathname.startsWith(link.href))

              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={cn(
                    "flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-emerald-500/10 text-emerald-400 shadow-sm"
                      : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <link.icon className={cn("w-[18px] h-[18px]", isActive ? "text-emerald-400" : "")} />
                    <span>{link.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {link.premiumOnly && !hasPremiumAccess && !isAdmin && (
                      <Crown className="w-3 h-3 text-amber-400" />
                    )}
                    {link.badge && (
                      <Badge
                        className={cn(
                          "text-[10px] px-1.5 py-0 font-medium",
                          link.badgeVariant === "hot"
                            ? "bg-orange-500/20 text-orange-400 border-orange-500/30"
                            : link.badgeVariant === "live"
                              ? "bg-red-500/20 text-red-400 border-red-500/30"
                              : "bg-slate-700 text-slate-300 border-slate-600"
                        )}
                      >
                        {link.badgeVariant === "live" && (
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1 animate-pulse inline-block" />
                        )}
                        {link.badge}
                      </Badge>
                    )}
                  </div>
                </Link>
              )
            })}

            {/* Divider */}
            <div className="my-3 border-t border-slate-800" />

            <div className="px-2 py-2">
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                Account
              </p>
            </div>
            {bottomLinks.map((link) => {
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-emerald-500/10 text-emerald-400 shadow-sm"
                      : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                  )}
                >
                  <link.icon className={cn("w-[18px] h-[18px]", isActive ? "text-emerald-400" : "")} />
                  <span>{link.name}</span>
                </Link>
              )
            })}
          </nav>

          {/* Pro Upgrade Card (only for non-premium users) */}
          {hasPremiumAccess === false && !isAdmin && (
            <div className="p-4 border-t border-slate-800">
              <div className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <h4 className="font-semibold text-white text-sm">Upgrade to Pro</h4>
                </div>
                <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                  Unlock AI parlays, CLV tracker, advanced analytics & more
                </p>
                <Button
                  size="sm"
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/20"
                  onClick={() => router.push("/pricing")}
                >
                  <Crown className="w-3.5 h-3.5 mr-1.5" />
                  View Plans
                </Button>
              </div>
            </div>
          )}

          {/* Profile & Account links */}
          <div className="px-3 py-2 border-t border-slate-800">
            <p className="text-[10px] uppercase tracking-wider text-slate-600 px-3 mb-1">Account</p>
            {profileLinks.map((link) => {
              const Icon = link.icon
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs transition-all",
                    isActive
                      ? "bg-slate-800 text-white"
                      : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {link.name}
                </Link>
              )
            })}
          </div>

          {/* User Info at bottom */}
          <div className="p-4 border-t border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-semibold text-sm">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{displayName}</p>
                <p className="text-xs text-slate-500 truncate">{session.user.email}</p>
              </div>
              <LogoutButton />
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main content area ─────────────────────────────────── */}
      <div className="lg:pl-64">
        {/* ── Top header ────────────────────────────────────── */}
        <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-4">
              {/* Mobile menu button */}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden text-slate-400 hover:text-white"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </Button>

              {/* Search bar */}
              <div className="hidden sm:flex items-center gap-2 bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 w-72">
                <Search className="w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search matches, players..."
                  className="bg-transparent text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none w-full"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Notifications */}
              <NotificationBell className="text-slate-400 hover:text-white" />

              {/* Quick Actions */}
              <Button
                variant="outline"
                size="sm"
                className="gap-2 bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white hidden sm:flex"
                onClick={() => router.push("/dashboard/matches")}
              >
                <Trophy className="w-4 h-4" />
                <span>Matches</span>
              </Button>

              {/* Profile divider + avatar (mobile only shows avatar) */}
              <div className="flex items-center gap-2 pl-3 border-l border-slate-700">
                <Link href="/dashboard/settings" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-medium text-xs">
                    {initials}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 hidden sm:block" />
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* ── Page content ──────────────────────────────────── */}
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
