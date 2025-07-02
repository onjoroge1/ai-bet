"use client"

import { useQuery } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { TrendingUp, Users, Trophy, Globe, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

// Type for the stats data
type HomepageStats = {
  winRate: {
    value: string
    rawValue: number
    description: string
  }
  totalWinnings: {
    value: string
    rawValue: number
    description: string
  }
  countries: {
    value: string
    rawValue: number
    description: string
  }
  totalRevenue: {
    value: string
    rawValue: number
    description: string
  }
}

// Function to fetch homepage stats
const fetchHomepageStats = async (): Promise<HomepageStats> => {
  const response = await fetch('/api/homepage/stats')
  if (!response.ok) {
    throw new Error('Failed to fetch homepage stats')
  }
  return response.json()
}

export function StatsSection() {
  const { data: stats, isLoading, error, refetch } = useQuery({
    queryKey: ['homepage-stats'],
    queryFn: fetchHomepageStats,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  })

  // Default stats for loading/error states
  const defaultStats = [
    {
      icon: TrendingUp,
      value: "87%",
      label: "Win Rate",
      description: "Average success rate across all predictions",
    },
    {
      icon: Trophy,
      value: "Community Success",
      label: "Winnings Generated",
      description: "Our community celebrates wins together",
    },
    {
      icon: Globe,
      value: "25+",
      label: "Countries",
      description: "Global reach with local payment methods",
    },
  ]

  // Dynamic stats from API
  const dynamicStats = stats ? [
    {
      icon: TrendingUp,
      value: stats.winRate.value,
      label: "Win Rate",
      description: stats.winRate.description,
    },
    {
      icon: Trophy,
      value: stats.totalWinnings.value,
      label: "Winnings Generated",
      description: stats.totalWinnings.description,
    },
    {
      icon: Globe,
      value: stats.countries.value,
      label: "Countries",
      description: stats.countries.description,
    },
  ] : defaultStats

  const displayStats = isLoading ? defaultStats : dynamicStats

  return (
    <section className="py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center space-x-4 mb-4">
            <h2 className="text-3xl md:text-4xl font-bold text-white">Trusted by Bettors Worldwide</h2>
            {!isLoading && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                className="text-slate-400 hover:text-white"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            )}
          </div>
          <p className="text-slate-300 text-lg">
            Our AI-powered predictions deliver consistent results across global markets
          </p>
          {isLoading && (
            <div className="flex items-center justify-center mt-4">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-400 mr-2" />
              <span className="text-slate-400 text-sm">Loading live stats...</span>
            </div>
          )}
          {error && (
            <div className="text-red-400 text-sm mt-2">
              Using cached data. Click refresh to try again.
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {displayStats.map((stat, index) => (
            <Card
              key={index}
              className="bg-slate-800/50 border-slate-700 p-6 text-center hover:bg-slate-800/70 transition-colors"
            >
              <div className="w-12 h-12 bg-emerald-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                <stat.icon className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="text-3xl font-bold text-white mb-2">{stat.value}</div>
              <div className="text-emerald-400 font-semibold mb-2">{stat.label}</div>
              <div className="text-slate-400 text-sm">{stat.description}</div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
