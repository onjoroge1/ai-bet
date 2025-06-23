"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Radio, Clock, Target, Users, Eye, Zap } from "lucide-react"

export function MobileLive() {
  const [matches, setMatches] = useState([
    {
      id: 1,
      homeTeam: "Arsenal",
      awayTeam: "Chelsea",
      score: "2-1",
      minute: "67'",
      prediction: "Arsenal to score next",
      confidence: 78,
      odds: "2.10",
      viewers: 2340,
    },
    {
      id: 2,
      homeTeam: "Barcelona",
      awayTeam: "Real Madrid",
      score: "1-0",
      minute: "45+2'",
      prediction: "Over 1.5 goals",
      confidence: 85,
      odds: "1.65",
      viewers: 3456,
    },
    {
      id: 3,
      homeTeam: "Man City",
      awayTeam: "Liverpool",
      score: "0-0",
      minute: "23'",
      prediction: "Both teams to score",
      confidence: 92,
      odds: "1.75",
      viewers: 4521,
    },
  ])

  const [liveStats] = useState({
    activeMatches: 8,
    totalViewers: 12400,
    livePredictions: 23,
    accuracy: 91,
  })

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
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="px-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white flex items-center">
          <Radio className="w-5 h-5 mr-2 text-red-400 animate-pulse" />
          Live Matches
        </h2>
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 animate-pulse">
          {liveStats.activeMatches} Live
        </Badge>
      </div>

      {/* Live Stats */}
      <Card className="bg-slate-800/50 border-slate-700 p-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-lg font-bold text-red-400 animate-pulse">
              {liveStats.totalViewers.toLocaleString()}
            </div>
            <div className="text-xs text-slate-400">Watching Live</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-emerald-400">{liveStats.accuracy}%</div>
            <div className="text-xs text-slate-400">Live Accuracy</div>
          </div>
        </div>
      </Card>

      {/* Live Matches */}
      <div className="space-y-4">
        {matches.map((match) => (
          <Card key={match.id} className="bg-slate-800/50 border-red-500/30 p-4">
            {/* Match Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-red-400 text-xs font-medium">LIVE</span>
              </div>
              <div className="flex items-center space-x-2 text-xs text-slate-400">
                <Users className="w-3 h-3" />
                <span>{match.viewers.toLocaleString()}</span>
              </div>
            </div>

            {/* Teams and Score */}
            <div className="text-center mb-4">
              <div className="text-white font-semibold mb-1">
                {match.homeTeam} vs {match.awayTeam}
              </div>
              <div className="text-2xl font-bold text-white mb-1">{match.score}</div>
              <div className="flex items-center justify-center space-x-2 text-slate-400 text-sm">
                <Clock className="w-3 h-3" />
                <span>{match.minute}</span>
              </div>
            </div>

            {/* Live Prediction */}
            <div className="bg-slate-900/50 rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-emerald-400 font-medium text-sm">{match.prediction}</div>
                <div className="text-slate-300 text-sm">@ {match.odds}</div>
              </div>
              <div className="flex items-center justify-between">
                <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">{match.confidence}% Confidence</Badge>
                <div className="text-xs text-slate-400">Live prediction</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <Target className="w-3 h-3 mr-1" />
                Place Bet
              </Button>
              <Button variant="outline" size="sm" className="border-slate-600 text-slate-300">
                <Eye className="w-3 h-3 mr-1" />
                Watch
              </Button>
            </div>

            {/* Live Update Indicator */}
            <div className="mt-3 pt-3 border-t border-slate-700">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Last update: 30s ago</span>
                <div className="flex items-center space-x-1">
                  <div className="w-1 h-1 bg-red-400 rounded-full animate-pulse" />
                  <span>Live tracking</span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Live Chat Preview */}
      <Card className="bg-slate-800/50 border-slate-700 p-4 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold text-sm">Live Chat</h3>
          <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">247 online</Badge>
        </div>

        <div className="space-y-2 mb-3">
          <div className="bg-slate-900/50 rounded p-2">
            <div className="text-xs text-slate-400 mb-1">James K. 🇰🇪</div>
            <div className="text-white text-xs">Arsenal looking strong! 🔥</div>
          </div>
          <div className="bg-slate-900/50 rounded p-2">
            <div className="text-xs text-slate-400 mb-1">Priya S. 🇮🇳</div>
            <div className="text-white text-xs">AI predictions on point today!</div>
          </div>
        </div>

        <Button variant="outline" size="sm" className="w-full border-slate-600 text-slate-300">
          <Zap className="w-3 h-3 mr-1" />
          Join Live Chat
        </Button>
      </Card>
    </div>
  )
}
