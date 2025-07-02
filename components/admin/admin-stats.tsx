"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import {
  Users,
  DollarSign,
  TrendingUp,
  Target,
  AlertTriangle,
  Crown,
  Globe,
  Activity,
  ArrowUp,
  ArrowDown,
  Loader2,
  RefreshCw,
  UserCheck,
} from "lucide-react"

interface PlatformStats {
  totalUsers: StatData
  revenue: StatData
  vipMembers: StatData
  winRate: StatData
  activeCountries: StatData
  systemUptime: StatData
  activeUsers: StatData
  dailyPredictions: StatData
  quizParticipations: StatData
  quickPurchases: StatData
}

interface StatData {
  value: string
  change: string
  trend: "up" | "down" | "neutral"
  subtitle: string
  rawValue: number
}

const statConfigs = [
  {
    key: "totalUsers" as keyof PlatformStats,
    title: "Total Users",
    icon: Users,
    color: "blue",
  },
  {
    key: "revenue" as keyof PlatformStats,
    title: "Revenue",
    icon: DollarSign,
    color: "emerald",
  },
  {
    key: "vipMembers" as keyof PlatformStats,
    title: "VIP Members",
    icon: Crown,
    color: "yellow",
  },
  {
    key: "winRate" as keyof PlatformStats,
    title: "Win Rate",
    icon: Target,
    color: "emerald",
  },
  {
    key: "activeCountries" as keyof PlatformStats,
    title: "Active Countries",
    icon: Globe,
    color: "cyan",
  },
  {
    key: "systemUptime" as keyof PlatformStats,
    title: "System Uptime",
    icon: Activity,
    color: "emerald",
  },
  {
    key: "activeUsers" as keyof PlatformStats,
    title: "Active Users",
    icon: UserCheck,
    color: "blue",
  },
  {
    key: "dailyPredictions" as keyof PlatformStats,
    title: "Daily Predictions",
    icon: TrendingUp,
    color: "purple",
  },
  {
    key: "quizParticipations" as keyof PlatformStats,
    title: "Quiz Completions",
    icon: Target,
    color: "blue",
  },
  {
    key: "quickPurchases" as keyof PlatformStats,
    title: "Quick Purchases",
    icon: DollarSign,
    color: "green",
  },
]

export function AdminStats() {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchStats = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)

      const response = await fetch("/api/admin/platform-stats")
      if (!response.ok) {
        throw new Error("Failed to fetch platform statistics")
      }

      const data = await response.json()
      setStats(data.stats)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load statistics")
      console.error("Error fetching platform stats:", err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  const handleRefresh = () => {
    fetchStats(true)
  }

  const getColorClasses = (color: string) => {
    const colorMap = {
      blue: { bg: "bg-blue-500/20", text: "text-blue-400" },
      emerald: { bg: "bg-emerald-500/20", text: "text-emerald-400" },
      yellow: { bg: "bg-yellow-500/20", text: "text-yellow-400" },
      cyan: { bg: "bg-cyan-500/20", text: "text-cyan-400" },
      purple: { bg: "bg-purple-500/20", text: "text-purple-400" },
      red: { bg: "bg-red-500/20", text: "text-red-400" },
      green: { bg: "bg-green-500/20", text: "text-green-400" },
    }
    return colorMap[color as keyof typeof colorMap] || colorMap.blue
  }

  const getTrendColor = (trend: string) => {
    return trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-slate-400"
  }

  if (loading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Platform Overview</h2>
          <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, index) => (
            <div key={index} className="bg-slate-900/50 rounded-lg p-4 animate-pulse">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-slate-700 rounded-lg"></div>
                <div className="w-16 h-4 bg-slate-700 rounded"></div>
              </div>
              <div className="h-8 bg-slate-700 rounded mb-2"></div>
              <div className="h-4 bg-slate-700 rounded mb-1"></div>
              <div className="h-3 bg-slate-700 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Platform Overview</h2>
          <button
            onClick={handleRefresh}
            className="flex items-center space-x-2 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 rounded text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry</span>
          </button>
        </div>
        <div className="text-center py-8">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400 mb-2">Failed to load platform statistics</p>
          <p className="text-slate-400 text-sm">{error}</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Platform Overview</h2>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center space-x-2 px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm disabled:opacity-50"
        >
          {refreshing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statConfigs.map((config) => {
          const stat = stats?.[config.key]
          if (!stat) return null

          const colorClasses = getColorClasses(config.color)
          const IconComponent = config.icon

          return (
            <div key={config.key} className="bg-slate-900/50 rounded-lg p-4 hover:bg-slate-900/70 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses.bg}`}>
                  <IconComponent className={`w-5 h-5 ${colorClasses.text}`} />
                </div>
                <div className="flex items-center space-x-1">
                  {stat.trend === "up" && <ArrowUp className="w-4 h-4 text-emerald-400" />}
                  {stat.trend === "down" && <ArrowDown className="w-4 h-4 text-red-400" />}
                  <span className={`text-sm font-medium ${getTrendColor(stat.trend)}`}>
                    {stat.change}
                  </span>
                </div>
              </div>

              <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
              <div className="text-slate-400 text-sm mb-2">{config.title}</div>
              <div className="text-slate-500 text-xs">{stat.subtitle}</div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
