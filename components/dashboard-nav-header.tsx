"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Menu, X, Home, Zap, Crown, Settings, BarChart3, Target, HeadphonesIcon, History, Bell, Activity, Layers, Sparkles } from "lucide-react"
import { NotificationBell } from "@/components/notifications/NotificationBell"
import { Badge } from "@/components/ui/badge"

export function DashboardNavHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const pathname = usePathname()

  // Streamlined navigation — 7 core items (down from 15)
  const navigationItems = [
    // Premium flagship
    { href: "/dashboard/snapbet-picks", label: "SnapBet Picks", icon: Crown, category: "core", badge: "Premium" },

    // Core features
    { href: "/dashboard/matches", label: "Matches", icon: Target, category: "core" },
    { href: "/dashboard/parlays", label: "Parlays", icon: Layers, category: "core", badge: "AI" },
    { href: "/dashboard/my-bets", label: "My Bets", icon: History, category: "core" },
    { href: "/dashboard/clv", label: "CLV Tracker", icon: Activity, category: "core", badge: "Live" },
    { href: "/dashboard", label: "Home", icon: Home, category: "core" },

    // Account (shown in profile section)
    { href: "/dashboard/settings", label: "Settings", icon: Settings, category: "account" },
    { href: "/dashboard/support", label: "Support", icon: HeadphonesIcon, category: "account" },
  ]

  const currentPage = navigationItems.find((item) => item.href === pathname)

  // Group items by category
  const groupedItems = navigationItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {} as Record<string, typeof navigationItems>)

  return (
    <div className="mb-6">
      {/* Header - Simplified and Cleaner */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white transition-all duration-200"
          >
            {isMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            <span className="ml-2 hidden sm:inline">Navigation</span>
          </Button>

          {/* Current Page - Only show if not on main dashboard */}
          {currentPage && pathname !== "/dashboard" && (
            <div className="flex items-center space-x-2">
              <currentPage.icon className="w-5 h-5 text-emerald-400" />
              <h1 className="text-xl font-bold text-white">{currentPage.label}</h1>
            </div>
          )}
        </div>

        {/* Right side - Cleaner and more focused */}
        <div className="flex items-center space-x-3">
          {/* Notification Bell */}
          <NotificationBell className="text-slate-300 hover:text-white" />
          
          {/* Quick Dashboard Link - Only show when not on dashboard */}
          {pathname !== "/dashboard" && (
            <Link href="/dashboard">
              <Button
                variant="outline"
                size="sm"
                className="border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all duration-200"
              >
                <Home className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Collapsible Navigation Menu - Better organized and cleaner */}
      {isMenuOpen && (
        <Card className="bg-slate-800/50 border-slate-700 p-6 mb-4">
          <div className="space-y-6">
            {/* Premium Features */}
            {groupedItems.premium && (
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-400" />
                  Premium Features
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {groupedItems.premium.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href
                    return (
                      <Link key={item.href} href={item.href}>
                        <Button
                          variant={isActive ? "default" : "ghost"}
                          className={`w-full justify-start ${
                            isActive
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                              : "text-slate-300 hover:bg-slate-700 hover:text-white"
                          }`}
                        >
                          <Icon className="w-4 h-4 mr-2" />
                          {item.label}
                          {item.badge && (
                            <Badge className="ml-auto bg-emerald-500/20 text-emerald-400 border-emerald-500/50 text-xs">
                              {item.badge}
                            </Badge>
                          )}
                        </Button>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Core Dashboard */}
            {groupedItems.core && (
              <div>
                <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">Dashboard</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {groupedItems.core.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMenuOpen(false)}
                      className={`flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 ${
                        pathname === item.href
                          ? "bg-emerald-600 text-white shadow-lg"
                          : "bg-slate-700/50 text-slate-300 hover:bg-slate-600 hover:text-white"
                      }`}
                    >
                      <item.icon className="w-4 h-4" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Predictions & Tips */}
            {groupedItems.predictions && (
              <div>
                <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">Predictions & Tips</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {groupedItems.predictions.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMenuOpen(false)}
                      className={`flex items-center justify-between p-3 rounded-lg transition-all duration-200 ${
                        pathname === item.href
                          ? "bg-emerald-600 text-white shadow-lg"
                          : "bg-slate-700/50 text-slate-300 hover:bg-slate-600 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <item.icon className="w-4 h-4" />
                        <span className="text-sm font-medium">{item.label}</span>
                      </div>
                      {item.badge && (
                        <Badge className="bg-red-500 text-white text-xs animate-pulse">
                          {item.badge}
                        </Badge>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* User Content */}
            {groupedItems.user && (
              <div>
                <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">My Content</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {groupedItems.user.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMenuOpen(false)}
                      className={`flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 ${
                        pathname === item.href
                          ? "bg-emerald-600 text-white shadow-lg"
                          : "bg-slate-700/50 text-slate-300 hover:bg-slate-600 hover:text-white"
                      }`}
                    >
                      <item.icon className="w-4 h-4" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Account & Support */}
            {groupedItems.account && (
              <div>
                <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">Account & Support</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {groupedItems.account.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMenuOpen(false)}
                      className={`flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 ${
                        pathname === item.href
                          ? "bg-emerald-600 text-white shadow-lg"
                          : "bg-slate-700/50 text-slate-300 hover:bg-slate-600 hover:text-white"
                      }`}
                    >
                      <item.icon className="w-4 h-4" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
