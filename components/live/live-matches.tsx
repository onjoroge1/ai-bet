"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Radio, Clock, Target, TrendingUp, Users, Eye } from "lucide-react"

export function LiveMatches() {
  const [matches, setMatches] = useState([
    {
      id: 1,
      homeTeam: "Arsenal",
      awayTeam: "Chelsea",
      score: "2-1",
      minute: "67'",
      league: "Premier League",
      prediction: "Arsenal to score next",
      confidence: 78,
      odds: "2.10",
      viewers: 2340,
      status: "live",
    },
    {
      id: 2,
      homeTeam: "Barcelona",
      awayTeam: "Real Madrid",
      score: "1-0",
      minute: "45+2'",
      league: "La Liga",
      prediction: "Over 1.5 goals",
      confidence: 85,
      odds: "1.65",
      viewers: 3456,
      status: "live",
    },
    {
      id: 3,
      homeTeam: "Manchester City",
      awayTeam: "Liverpool",
      score: "0-0",
      minute: "23'",
      league: "Premier League",
      prediction: "Both teams to score",
      confidence: 92,
      odds: "1.75",
      viewers: 4521,
      status: "live",
    },
    {
      id: 4,
      homeTeam: "Bayern Munich",
      awayTeam: "Dortmund",
      score: "3-2",
      minute: "89'",
      league: "Bundesliga",
      prediction: "No more goals",
      confidence: 73,
      odds: "2.20",
      viewers: 1876,
      status: "live",
    },
  ])

  // Simulate live updates
  useEffect(() => {
    const interval = setInterval(() => {
      setMatches((prevMatches) =>
        prevMatches.map((match) => ({
          ...match,
          minute: `${Number.parseInt(match.minute) + 1}'`,
          viewers: match.viewers + Math.floor(Math.random() * 10 - 5),
        })),
      )
    }, 30000) // Update every 30 seconds

    return () => clearInterval(interval)
  }, [])

  return (
    <Card className="bg-slate-800/50 border-slate-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
          <Radio className="w-5 h-5 text-red-400 animate-pulse" />
          <span>Live Matches</span>
        </h2>
        <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white">
          <TrendingUp className="w-4 h-4 mr-2" />
          Sort by Confidence
        </Button>
      </div>

      <div className="space-y-4">
        {matches.map((match) => (
          <Card
            key={match.id}
            className="bg-slate-900/50 border-red-500/30 p-4 hover:bg-slate-900/70 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <h3 className="text-white font-semibold">
                    {match.homeTeam} vs {match.awayTeam}
                  </h3>
                  <Badge variant="secondary" className="bg-slate-700 text-slate-300 text-xs">
                    {match.league}
                  </Badge>
                  <Badge className="bg-red-500/20 text-red-400 border-red-500/30 animate-pulse">
                    <Radio className="w-3 h-3 mr-1" />
                    LIVE
                  </Badge>
                </div>

                <div className="flex items-center space-x-4 mb-3">
                  <div className="text-2xl font-bold text-white">{match.score}</div>
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-400">{match.minute}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-400 text-sm">{match.viewers.toLocaleString()}</span>
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-emerald-400 font-medium">{match.prediction}</div>
                      <div className="text-slate-400 text-sm">Odds: {match.odds}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-white">{match.confidence}%</div>
                      <div className="text-slate-400 text-xs">Confidence</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="ml-4 flex flex-col space-y-2">
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Target className="w-4 h-4 mr-2" />
                  Place Bet
                </Button>
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                  <Eye className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Live Updates */}
            <div className="border-t border-slate-700 pt-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Last update: 30 seconds ago</span>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                  <span className="text-red-400">Live tracking</span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </Card>
  )
}
