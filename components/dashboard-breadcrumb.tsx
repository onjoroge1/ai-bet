"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { ChevronRight, Home, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export function DashboardBreadcrumb() {
  const pathname = usePathname()

  const getPageTitle = (path: string) => {
    switch (path) {
      case "/dashboard":
        return "Dashboard"
      case "/dashboard/matches":
        return "Matches"
      case "/dashboard/daily-tips":
        return "Daily Tips"
      case "/dashboard/vip":
        return "VIP Intelligence"
      case "/dashboard/settings":
        return "Settings"
      case "/dashboard/support":
        return "Support"
      case "/dashboard/analytics":
        return "Analytics"
      case "/dashboard/my-tips":
        return "My Tips"
      case "/dashboard/my-bets":
        return "My Bets"
      case "/dashboard/saved-bets":
        return "Saved Bets"
      case "/dashboard/parlays":
        return "Parlays"
      case "/dashboard/clv":
        return "CLV Tracker"
      case "/dashboard/rewards":
        return "Rewards"
      case "/dashboard/referrals":
        return "Referrals"
      case "/dashboard/tools":
        return "Bet Tools"
      default:
        return "Dashboard"
    }
  }

  const isSubPage = pathname !== "/dashboard"

  if (!isSubPage) return null

  return (
    <div className="mb-6">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center space-x-2 text-sm mb-4">
        <Link href="/dashboard" className="flex items-center text-slate-400 hover:text-emerald-400 transition-colors">
          <Home className="w-4 h-4 mr-1" />
          Dashboard
        </Link>
        <ChevronRight className="w-4 h-4 text-slate-500" />
        <span className="text-emerald-400 font-medium">{getPageTitle(pathname)}</span>
      </nav>

      {/* Back Button */}
      <Link href="/dashboard">
        <Button
          variant="outline"
          size="sm"
          className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
      </Link>
    </div>
  )
}
