"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, TrendingUp, Radio } from "lucide-react"

interface Team {
  id: number
  name: string
  logo?: string
}

interface League {
  id: number
  name: string
  country: string
  logo?: string
}

interface Match {
  id: number
  status: "upcoming" | "live" | "finished"
  homeTeam: Team
  awayTeam: Team
  matchDate: string
  league: League
  odds: {
    home: number
    draw: number
    away: number
  }
  bookmakers: string[]
  prediction?: {
    team: string
    confidence: number
    isPremium?: boolean
  }
  liveScore?: {
    home: number
    away: number
  }
  elapsed?: number
}

interface MatchesResponse {
  matches: Match[]
  total_count: number
}

export function HomepageMatches() {
  const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([])
  const [liveMatches, setLiveMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchMatches()
    // Refresh every 30 seconds
    const interval = setInterval(fetchMatches, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchMatches = async () => {
    try {
      setLoading(true)
      setError(null)

      // Use Next.js API route instead of direct backend call
      // This ensures proper environment variable handling and avoids CORS issues
      const upcomingResponse = await fetch(
        "/api/market?status=upcoming&limit=50"
      )

      if (!upcomingResponse.ok) {
        throw new Error("Failed to fetch upcoming matches")
      }

      const upcomingData: MatchesResponse = await upcomingResponse.json()
      setUpcomingMatches(upcomingData.matches || [])

      // Fetch live matches
      const liveResponse = await fetch(
        "/api/market?status=live&limit=50"
      )

      if (!liveResponse.ok) {
        throw new Error("Failed to fetch live matches")
      }

      const liveData: MatchesResponse = await liveResponse.json()
      setLiveMatches(liveData.matches || [])
    } catch (err) {
      console.error("Error fetching matches:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch matches")
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const matchDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const tomorrowDate = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate())

    if (matchDate.getTime() === todayDate.getTime()) {
      return "today"
    } else if (matchDate.getTime() === tomorrowDate.getTime()) {
      return "tomorrow"
    } else {
      return "upcoming"
    }
  }


  const groupMatches = (matches: Match[]) => {
    const grouped = {
      today: [] as Match[],
      tomorrow: [] as Match[],
      upcoming: [] as Match[],
    }

    matches.forEach((match) => {
      const group = formatDate(match.matchDate)
      grouped[group as keyof typeof grouped].push(match)
    })

    return grouped
  }

  const upcomingGrouped = groupMatches(upcomingMatches)
  const liveGrouped = groupMatches(liveMatches)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <section className="py-12 sm:py-20 bg-slate-900/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6">
            Live Matches & Predictions
          </h2>
          <p className="text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto px-2 sm:px-0">
            Real-time match tracking with AI-powered predictions
          </p>
        </div>

        {/* Live Matches Section */}
        {(liveGrouped.today.length > 0 ||
          liveGrouped.tomorrow.length > 0 ||
          liveGrouped.upcoming.length > 0) && (
          <div className="mb-12">
            <Card className="bg-slate-800/60 border-slate-600/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  Live Matches
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Today's Live Matches */}
                {liveGrouped.today.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-xl font-semibold text-white mb-4">Today</h3>
                    <MatchTable matches={liveGrouped.today} isLive={true} />
                  </div>
                )}

                {/* Tomorrow's Live Matches */}
                {liveGrouped.tomorrow.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-xl font-semibold text-white mb-4">Tomorrow</h3>
                    <MatchTable matches={liveGrouped.tomorrow} isLive={true} />
                  </div>
                )}

                {/* Other Live Matches */}
                {liveGrouped.upcoming.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-xl font-semibold text-white mb-4">Other Upcoming</h3>
                    <MatchTable matches={liveGrouped.upcoming} isLive={true} />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Upcoming Matches Section */}
        {(upcomingGrouped.today.length > 0 ||
          upcomingGrouped.tomorrow.length > 0 ||
          upcomingGrouped.upcoming.length > 0) && (
          <div>
            <Card className="bg-slate-800/60 border-slate-600/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-400" />
                  Upcoming Matches
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Today's Upcoming Matches */}
                {upcomingGrouped.today.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-xl font-semibold text-white mb-4">Today</h3>
                    <MatchTable matches={upcomingGrouped.today} isLive={false} />
                  </div>
                )}

                {/* Tomorrow's Upcoming Matches */}
                {upcomingGrouped.tomorrow.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-xl font-semibold text-white mb-4">Tomorrow</h3>
                    <MatchTable matches={upcomingGrouped.tomorrow} isLive={false} />
                  </div>
                )}

                {/* Other Upcoming Matches */}
                {upcomingGrouped.upcoming.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-xl font-semibold text-white mb-4">Other Upcoming</h3>
                    <MatchTable matches={upcomingGrouped.upcoming} isLive={false} />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {upcomingMatches.length === 0 && liveMatches.length === 0 && (
          <div className="text-center py-20">
            <Radio className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-400">No matches available</p>
          </div>
        )}
      </div>
    </section>
  )
}

function MatchTable({ matches, isLive }: { matches: Match[]; isLive: boolean }) {
  const formatElapsedTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}:${secs.toString().padStart(2, "0")}`
  }

  const formatMatchTime = (dateString: string): string => {
    const date = new Date(dateString)
    const day = date.getDate().toString().padStart(2, "0")
    const hours = date.getHours().toString().padStart(2, "0")
    return `${day}/${hours}`
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-slate-600">
            <th className="text-left py-3 px-4 text-slate-400 font-medium">Match</th>
            <th className="text-left py-3 px-4 text-slate-400 font-medium">League</th>
            <th className="text-left py-3 px-4 text-slate-400 font-medium">Time</th>
            <th className="text-left py-3 px-4 text-slate-400 font-medium">Odds</th>
            <th className="text-left py-3 px-4 text-slate-400 font-medium">Prediction</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((match) => (
            <tr key={match.id} className="border-b border-slate-700 hover:bg-slate-700/30 transition-colors">
              <td className="py-4 px-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <img
                      src={match.homeTeam.logo || "/placeholder-team.png"}
                      alt={match.homeTeam.name}
                      className="w-6 h-6"
                      onError={(e) => {
                        e.currentTarget.src = "/placeholder-team.png"
                      }}
                    />
                    <span className="text-white text-sm font-medium">{match.homeTeam.name}</span>
                    {isLive && <Badge className="bg-red-500 text-white text-xs">LIVE</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <img
                      src={match.awayTeam.logo || "/placeholder-team.png"}
                      alt={match.awayTeam.name}
                      className="w-6 h-6"
                      onError={(e) => {
                        e.currentTarget.src = "/placeholder-team.png"
                      }}
                    />
                    <span className="text-white text-sm font-medium">{match.awayTeam.name}</span>
                  </div>
                  {isLive && match.liveScore && (
                    <div className="text-emerald-400 text-sm font-semibold">
                      {match.liveScore.home} : {match.liveScore.away}
                    </div>
                  )}
                </div>
              </td>
              <td className="py-4 px-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{match.league.country}</span>
                  <span className="text-slate-300 text-sm">{match.league.name}</span>
                </div>
              </td>
              <td className="py-4 px-4">
                <span className="text-slate-300 text-sm">
                  {isLive && match.elapsed
                    ? formatElapsedTime(match.elapsed)
                    : formatMatchTime(match.matchDate)}
                </span>
              </td>
              <td className="py-4 px-4">
                <div className="flex flex-col gap-1">
                  <div className="flex gap-3 text-sm">
                    <span className="text-slate-400">Home:</span>
                    <span className="text-white">{match.odds.home}</span>
                  </div>
                  <div className="flex gap-3 text-sm">
                    <span className="text-slate-400">Draw:</span>
                    <span className="text-white">{match.odds.draw}</span>
                  </div>
                  <div className="flex gap-3 text-sm">
                    <span className="text-slate-400">Away:</span>
                    <span className="text-white">{match.odds.away}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{match.bookmakers.join(" ")}</div>
                </div>
              </td>
              <td className="py-4 px-4">
                <div className="flex flex-col gap-2">
                  <div className="text-white text-sm font-medium">
                    {match.prediction?.team || "N/A"}
                  </div>
                  {match.prediction && (
                    <div className="flex items-center gap-2">
                      {match.prediction.isPremium ? (
                        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">
                          Unlock Premium
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                          {match.prediction.confidence}%
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}


