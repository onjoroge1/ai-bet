"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Flame, Loader2, TrendingUp, ArrowRight } from "lucide-react"
import { useRouter } from "next/navigation"
import { HotMatchesResponse, TrendingMatch } from "@/types/dashboard"

export function HotPicks() {
  const [data, setData] = useState<HotMatchesResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const fetchHotMatches = async () => {
      try {
        setIsLoading(true)
        const response = await fetch('/api/trending/hot', {
          next: { revalidate: 300 }
        })

        if (!response.ok) {
          throw new Error('Failed to fetch hot matches')
        }

        const result = await response.json()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load hot matches')
        console.error('Error fetching hot matches:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchHotMatches()
  }, [])

  const getHotLabel = (hotScore: number) => {
    if (hotScore >= 70) return { label: "🔥 Hot", color: "bg-red-500/20 text-red-400 border-red-500/30" }
    if (hotScore >= 50) return { label: "📈 Warming", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" }
    return { label: "💤 Neutral", color: "bg-slate-500/20 text-slate-400 border-slate-500/30" }
  }

  const getVolumeIndicator = (momentum: number) => {
    if (momentum >= 70) return "high"
    if (momentum >= 40) return "medium"
    return "low"
  }

  if (isLoading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <span className="ml-2 text-slate-300">Loading hot picks...</span>
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
      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-red-400/10 to-orange-400/10 rounded-full blur-xl animate-pulse" />
      <div className="absolute bottom-0 left-0 w-16 h-16 bg-gradient-to-br from-yellow-400/10 to-red-400/10 rounded-full blur-xl animate-pulse" style={{ animationDelay: "1s" }} />

      <div className="relative">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <Flame className="w-6 h-6 text-red-400 animate-pulse" />
            <h2 className="text-xl font-semibold text-white">Hot Markets</h2>
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
              Today
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
            <p className="text-slate-400">No hot matches available at the moment.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Rank</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Match</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Hot Score</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Momentum</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Volume</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Action</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((match: TrendingMatch) => {
                  const hotLabel = getHotLabel(match.hot_score)
                  const volume = getVolumeIndicator(match.momentum_current)
                  
                  return (
                    <tr 
                      key={match.match_id} 
                      className="border-b border-slate-700/50 hover:bg-slate-900/50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/match/${match.match_id}`)}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <span className="text-white font-semibold">#{match.hot_rank}</span>
                          {match.hot_rank <= 3 && (
                            <TrendingUp className="w-4 h-4 text-emerald-400" />
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-white font-medium">
                          Match #{match.match_id}
                        </div>
                        <div className="text-xs text-slate-400">
                          {match.clv_signal_count > 0 && (
                            <span className="text-emerald-400">CLV Signals: {match.clv_signal_count}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <span className="text-white font-semibold">{match.hot_score.toFixed(1)}</span>
                          <Badge className={hotLabel.color}>
                            {hotLabel.label}
                          </Badge>
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
                        <Badge 
                          className={
                            volume === "high" 
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                              : volume === "medium"
                              ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                              : "bg-slate-500/20 text-slate-400 border-slate-500/30"
                          }
                        >
                          {volume}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-xs text-slate-400">
                          {match.prediction_disagreement > 0 && (
                            <span className="text-yellow-400">Disagreement: {match.prediction_disagreement.toFixed(1)}</span>
                          )}
                        </div>
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
export default HotPicks

