"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Play, Clock, CheckCircle, XCircle, TrendingUp } from "lucide-react"

interface LiveMatch {
  id: string
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  status: string
  minutePlayed: number
  league: string
  prediction?: {
    type: string
    confidence: number
    status: string
    odds: number
  }
}

export function LiveMatchesWidget() {
  const [matches, setMatches] = useState<LiveMatch[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate fetching live matches
    const fetchMatches = async () => {
      const mockMatches: LiveMatch[] = [
        {
          id: "1",
          homeTeam: "Arsenal",
          awayTeam: "Chelsea",
          homeScore: 2,
          awayScore: 1,
          status: "live",
          minutePlayed: 67,
          league: "Premier League",
          prediction: {
            type: "Over 2.5 Goals",
            confidence: 87,
            status: "won",
            odds: 1.85,
          },
        },
        {
          id: "2",
          homeTeam: "Manchester City",
          awayTeam: "Liverpool",
          homeScore: 0,
          awayScore: 0,
          status: "live",
          minutePlayed: 23,
          league: "Premier League",
          prediction: {
            type: "BTTS Yes",
            confidence: 92,
            status: "pending",
            odds: 1.72,
          },
        },
        {
          id: "3",
          homeTeam: "Gor Mahia",
          awayTeam: "AFC Leopards",
          homeScore: 1,
          awayScore: 0,
          status: "finished",
          minutePlayed: 90,
          league: "KPL",
          prediction: {
            type: "Home Win",
            confidence: 78,
            status: "won",
            odds: 2.1,
          },
        },
        {
          id: "4",
          homeTeam: "Real Madrid",
          awayTeam: "Barcelona",
          homeScore: 0,
          awayScore: 0,
          status: "upcoming",
          minutePlayed: 0,
          league: "La Liga",
        },
      ]

      setMatches(mockMatches)
      setLoading(false)
    }

    fetchMatches()

    // Simulate live updates
    const interval = setInterval(() => {
      setMatches((prev) =>
        prev.map((match) => {
          if (match.status === "live" && Math.random() > 0.8) {
            return {
              ...match,
              minutePlayed: Math.min(match.minutePlayed + 1, 90),
            }
          }
          return match
        }),
      )
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const getStatusBadge = (status: string, minutePlayed: number) => {
    switch (status) {
      case "live":
        return (
          <Badge className="bg-red-500 text-white animate-pulse">
            <Play className="w-3 h-3 mr-1" />
            {minutePlayed}'
          </Badge>
        )
      case "finished":
        return <Badge className="bg-slate-500 text-white">FT</Badge>
      case "upcoming":
        return (
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
            <Clock className="w-3 h-3 mr-1" />
            Upcoming
          </Badge>
        )
      default:
        return null
    }
  }

  const getPredictionStatus = (status: string) => {
    switch (status) {
      case "won":
        return <CheckCircle className="w-4 h-4 text-emerald-400" />
      case "lost":
        return <XCircle className="w-4 h-4 text-red-400" />
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-400" />
      default:
        return null
    }
  }

  if (loading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-700 rounded w-1/2"></div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-700 rounded"></div>
          ))}
        </div>
      </Card>
    )
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Play className="w-5 h-5 text-emerald-400" />
          <h3 className="text-lg font-semibold text-white">Live Matches</h3>
        </div>
        <Button variant="ghost" size="sm" className="text-slate-400">
          View All
        </Button>
      </div>

      <div className="space-y-4 max-h-80 overflow-y-auto">
        {matches.map((match) => (
          <div key={match.id} className="p-4 bg-slate-700/30 rounded-lg border border-slate-600">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-slate-400">{match.league}</div>
              {getStatusBadge(match.status, match.minutePlayed)}
            </div>

            <div className="flex items-center justify-between mb-3">
              <div className="flex-1">
                <div className="text-white text-sm font-medium">{match.homeTeam}</div>
                <div className="text-white text-sm font-medium">{match.awayTeam}</div>
              </div>

              {match.status !== "upcoming" && (
                <div className="text-center">
                  <div className="text-white text-lg font-bold">
                    {match.homeScore} - {match.awayScore}
                  </div>
                </div>
              )}
            </div>

            {match.prediction && (
              <div className="flex items-center justify-between p-2 bg-slate-600/30 rounded">
                <div className="flex items-center space-x-2">
                  {getPredictionStatus(match.prediction.status)}
                  <div>
                    <div className="text-xs text-white">{match.prediction.type}</div>
                    <div className="text-xs text-slate-400">
                      {match.prediction.confidence}% confidence • {match.prediction.odds}x
                    </div>
                  </div>
                </div>

                {match.prediction.status === "won" && (
                  <Badge className="bg-emerald-500 text-white">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    Won
                  </Badge>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}
