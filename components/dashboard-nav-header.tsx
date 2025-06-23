"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Menu, X, Home, Zap, Gift, Crown, Settings, BarChart3, Target, HeadphonesIcon } from "lucide-react"

export function DashboardNavHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const pathname = usePathname()

  const navigationItems = [
    { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/dashboard/matches", label: "Matches", icon: Target },
    { href: "/dashboard/daily-tips", label: "Daily Tips", icon: Zap },
    { href: "/dashboard/weekend-special", label: "Weekend Special", icon: Gift },
    { href: "/dashboard/vip", label: "VIP Zone", icon: Crown },
    { href: "/dashboard/my-tips", label: "My Tips", icon: Target },
    { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/dashboard/predictions", label: "Predictions", icon: Target },
    { href: "/dashboard/settings", label: "Settings", icon: Settings },
    { href: "/dashboard/support", label: "Support", icon: HeadphonesIcon },
  ]

  const currentPage = navigationItems.find((item) => item.href === pathname)

  return (
    <div className="mb-6">
      {/* Header with Menu Toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            {isMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            <span className="ml-2 hidden sm:inline">Menu</span>
          </Button>

          {currentPage && (
            <div className="flex items-center space-x-2">
              <currentPage.icon className="w-5 h-5 text-emerald-400" />
              <h1 className="text-xl font-bold text-white">{currentPage.label}</h1>
            </div>
          )}
        </div>

        {/* Quick Dashboard Link */}
        {pathname !== "/dashboard" && (
          <Link href="/dashboard">
            <Button
              variant="outline"
              size="sm"
              className="border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-white"
            >
              <Home className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
          </Link>
        )}
      </div>

      {/* Collapsible Navigation Menu */}
      {isMenuOpen && (
        <Card className="bg-slate-800/50 border-slate-700 p-4 mb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {navigationItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMenuOpen(false)}
                className={`flex items-center space-x-2 p-3 rounded-lg transition-all duration-200 ${
                  pathname === item.href
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-700/50 text-slate-300 hover:bg-slate-600 hover:text-white"
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
