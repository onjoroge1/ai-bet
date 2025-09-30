"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, CheckCircle, XCircle, Minus, Eye, Star, Sparkles } from "lucide-react"

// Prediction type (matches normalized structure)
type Prediction = {
  id: string
  match: {
    homeTeam: { id: string; name: string }
    awayTeam: { id: string; name: string }
    league: { id: string; name: string }
    dateTime: string
    status: string
  }
  league: string
  dateTime: string
  prediction: string
  odds: string
  confidence: number
  analysis: string
  status: string
  result: string
  isFree: boolean
  isFeatured: boolean
  showInDailyTips: boolean
  showInWeeklySpecials: boolean
  type: string
  matchesInAccumulator: Array<{
    match: string
    prediction: string
    odds: string
  }>
  totalOdds: string
  stake: string
  potentialReturn: string
  valueRating: string
  createdAt: string
  updatedAt: string
}

const fetchPredictions = async (): Promise<Prediction[]> => {
  const response = await fetch('/api/predictions')
  if (!response.ok) {
    throw new Error('Failed to fetch predictions')
  }
  const data = await response.json()
  return data.map((p: any) => ({
    id: p.id,
    match: typeof p.match === 'string'
      ? {
          homeTeam: { id: '', name: p.match.split(' vs ')[0] || '' },
          awayTeam: { id: '', name: p.match.split(' vs ')[1] || '' },
          league: { id: '', name: p.league || '' },
          dateTime: p.dateTime,
          status: p.status
        }
      : {
          homeTeam: p.match?.homeTeam || { id: '', name: '' },
          awayTeam: p.match?.awayTeam || { id: '', name: '' },
          league: p.match?.league || { id: '', name: '' },
          dateTime: p.match?.matchDate || p.match?.dateTime || p.dateTime || '',
          status: p.match?.status || p.status || ''
        },
    league: p.league || p.match?.league?.name || '',
    dateTime: p.dateTime || p.match?.matchDate || '',
    prediction: p.predictionType || p.prediction || '',
    odds: p.odds?.toString() || '',
    confidence: p.confidenceScore ?? p.confidence ?? 0,
    analysis: p.explanation || p.analysis || '',
    status: p.status || '',
    result: p.result || 'pending',
    isFree: p.isFree,
    isFeatured: p.isFeatured,
    showInDailyTips: p.showInDailyTips || false,
    showInWeeklySpecials: p.showInWeeklySpecials || false,
    type: p.type || 'single',
    matchesInAccumulator: Array.isArray(p.matchesInAccumulator)
      ? p.matchesInAccumulator.map((m: any) => ({
          match: typeof m === 'string' ? m : m.match,
          prediction: typeof m === 'string' ? '' : m.prediction,
          odds: typeof m === 'string' ? '' : m.odds
        }))
      : [],
    totalOdds: p.totalOdds?.toString() || '',
    stake: p.stake?.toString() || '',
    potentialReturn: p.potentialReturn?.toString() || '',
    valueRating: p.valueRating || 'Medium',
    createdAt: p.createdAt,
    updatedAt: p.updatedAt
  }))
}

export function RecentPredictions() {
  const [hoveredPrediction, setHoveredPrediction] = useState<string | null>(null)
  const { data: predictions = [], isLoading, error } = useQuery({
    queryKey: ['predictions'],
    queryFn: fetchPredictions,
  })

  // Sort by date ascending (soonest first), show next 4 upcoming matches
  const sorted = [...predictions].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
  const upcoming = sorted.slice(0, 4)

  const getStatusIcon = (result: string) => {
    switch (result) {
      case "won":
        return <CheckCircle className="w-4 h-4 text-emerald-400" />
      case "lost":
        return <XCircle className="w-4 h-4 text-red-400" />
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-400 animate-spin" />
      default:
        return <Minus className="w-4 h-4 text-slate-400" />
    }
  }

  const getStatusColor = (result: string) => {
    switch (result) {
      case "won":
        return "text-emerald-400"
      case "lost":
        return "text-red-400"
      case "pending":
        return "text-yellow-400"
      default:
        return "text-slate-400"
    }
  }

  if (isLoading) {
    return <Card className="bg-slate-800/50 border-slate-700 p-6">Loading upcoming predictions...</Card>
  }
  if (error) {
    return <Card className="bg-slate-800/50 border-slate-700 p-6 text-red-400">Failed to load predictions.</Card>
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700 p-6 relative overflow-hidden">
      {/* Floating sparkles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(5)].map((_, i) => (
          <Sparkles
            key={i}
            className="absolute w-4 h-4 text-emerald-400/30 animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      <div className="relative">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-semibold text-white">Upcoming Predictions</h2>
            <Star className="w-5 h-5 text-yellow-400 animate-pulse" />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-300 hover:text-white hover:scale-105 transition-transform"
          >
            View All
          </Button>
        </div>

        <div className="space-y-4">
          {upcoming.length === 0 && (
            <div className="text-center text-slate-400 py-8">No upcoming predictions.</div>
          )}
          {upcoming.map((prediction) => (
            <div
              key={prediction.id}
              className="bg-slate-900/50 rounded-lg p-4 hover:bg-slate-900/70 transition-all duration-300 hover:scale-[1.02] cursor-pointer relative overflow-hidden"
              onMouseEnter={() => setHoveredPrediction(prediction.id)}
              onMouseLeave={() => setHoveredPrediction(null)}
            >
              {/* Hover effect background */}
              {hoveredPrediction === prediction.id && (
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 rounded-lg" />
              )}

              <div className="relative flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl animate-bounce" style={{ animationDuration: "2s" }}>
                    ⚽
                  </span>
                  <div>
                    <h3 className="text-white font-medium">
                      {prediction.match.homeTeam.name} vs {prediction.match.awayTeam.name}
                    </h3>
                    <p className="text-slate-400 text-sm">
                      {new Date(prediction.dateTime).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(prediction.result)}
                  <Badge
                    className={`transition-all duration-300 hover:scale-110 ${
                      prediction.result === "won"
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        : prediction.result === "lost"
                          ? "bg-red-500/20 text-red-400 border-red-500/30"
                          : prediction.result === "pending"
                            ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                            : "bg-slate-500/20 text-slate-400 border-slate-500/30"
                    }`}
                  >
                    {prediction.confidence}%
                  </Badge>
                  {prediction.result === "won" && hoveredPrediction === prediction.id && (
                    <span className="text-lg animate-bounce">🎉</span>
                  )}
                </div>
              </div>

              <div className="relative flex items-center justify-between">
                <div>
                  <div className="text-white font-medium">{prediction.prediction}</div>
                  <div className="text-slate-400 text-sm">Odds: {prediction.odds}</div>
                </div>
                <div className="text-right flex items-center space-x-2">
                  {/* You can add profit/cost logic here if available */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-400 hover:text-white p-1 hover:scale-110 transition-transform"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Animated border for winning predictions */}
              {prediction.result === "won" && (
                <div className="absolute inset-0 rounded-lg border-2 border-emerald-400/50 animate-pulse" />
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
