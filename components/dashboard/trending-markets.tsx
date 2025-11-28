"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Loader2, ArrowRight, Activity } from "lucide-react"
import { useRouter } from "next/navigation"
import { TrendingMatchesResponse, TrendingMatch } from "@/types/dashboard"

export function TrendingMarkets() {
  const [data, setData] = useState<TrendingMatchesResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const fetchTrendingMatches = async () => {
      try {
        setIsLoading(true)
        const response = await fetch('/api/trending/trending', {
          next: { revalidate: 300 }
        })

        if (!response.ok) {
          throw new Error('Failed to fetch trending matches')
        }

        const result = await response.json()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load trending matches')
        console.error('Error fetching trending matches:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTrendingMatches()
  }, [])

  const getTrendDirection = (trendingScore: number, momentumVelocity: number) => {
    if (momentumVelocity > 5 || trendingScore > 50) {
      return { direction: "rising", label: "Hot", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: TrendingUp }
    }
    if (momentumVelocity < -5 || trendingScore < 20) {
      return { direction: "falling", label: "Cold", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: TrendingDown }
    }
    return { direction: "stable", label: "Stable", color: "bg-slate-500/20 text-slate-400 border-slate-500/30", icon: Activity }
  }

  const getVolatilityLabel = (disagreement: number) => {
    if (disagreement > 20) return { label: "Risky", color: "bg-red-500/20 text-red-400 border-red-500/30" }
    if (disagreement > 10) return { label: "Moderate", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" }
    return { label: "Low Risk", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" }
  }

  if (isLoading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <span className="ml-2 text-slate-300">Loading trending markets...</span>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      </Card>
    )
  }

  const matches = data?.matches || []

  return (
    <Card className="bg-slate-800/50 border-slate-700 p-6 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-400/10 to-cyan-400/10 rounded-full blur-xl animate-pulse" />
      <div className="absolute bottom-0 left-0 w-16 h-16 bg-gradient-to-br from-purple-400/10 to-blue-400/10 rounded-full blur-xl animate-pulse" style={{ animationDelay: "1s" }} />

      <div className="relative">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-semibold text-white">Trending Markets</h2>
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
              {data?.meta?.timeframe || '7 days'}
            </Badge>
          </div>
          {data?.meta && (
            <div className="text-xs text-slate-400">
              {data.meta.count} matches
            </div>
          )}
        </div>

        {matches.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-400">No trending matches available at the moment.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Rank</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Match</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Trend</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Score</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Momentum</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Risk</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Action</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((match: TrendingMatch) => {
                  const trend = getTrendDirection(match.trending_score, match.momentum_velocity)
                  const volatility = getVolatilityLabel(match.prediction_disagreement)
                  const TrendIcon = trend.icon
                  
                  return (
                    <tr 
                      key={match.match_id} 
                      className="border-b border-slate-700/50 hover:bg-slate-900/50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/match/${match.match_id}`)}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <span className="text-white font-semibold">#{match.trending_rank}</span>
                          {match.trending_rank <= 3 && (
                            <TrendIcon className="w-4 h-4 text-emerald-400" />
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-white font-medium">
                          Match #{match.match_id}
                        </div>
                        <div className="text-xs text-slate-400">
                          {match.clv_signal_count > 0 && (
                            <span className="text-emerald-400">CLV: {match.clv_signal_count}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <TrendIcon className={`w-4 h-4 ${trend.direction === 'rising' ? 'text-emerald-400' : trend.direction === 'falling' ? 'text-blue-400' : 'text-slate-400'}`} />
                          <Badge className={trend.color}>
                            {trend.label}
                          </Badge>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-white font-semibold">{match.trending_score.toFixed(1)}</div>
                        <div className="text-xs text-slate-400">
                          Hot: {match.hot_score.toFixed(1)}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-white">{match.momentum_current.toFixed(1)}</div>
                        {match.momentum_velocity !== 0 && (
                          <div className={`text-xs ${match.momentum_velocity > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {match.momentum_velocity > 0 ? '↑' : '↓'} {Math.abs(match.momentum_velocity).toFixed(1)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={volatility.color}>
                          {volatility.label}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-white"
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/match/${match.match_id}`)
                          }}
                        >
                          View
                          <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {data?.meta?.note && (
          <div className="mt-4 text-xs text-slate-500">
            {data.meta.note}
          </div>
        )}
      </div>
    </Card>
  )
}

// Default export for dynamic imports
export default TrendingMarkets

