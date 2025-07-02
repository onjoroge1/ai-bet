"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, Lock, Eye, Target, Brain, ChevronRight, Filter, Loader2, TrendingUp } from "lucide-react"
import Link from "next/link"

// Type for the prediction data
type Prediction = {
  id: string
  match: {
    homeTeam: { id: string; name: string }
    awayTeam: { id: string; name: string }
    league: { id: string; name: string }
    dateTime: string
    status: "upcoming" | "live" | "finished" | "postponed" | "cancelled"
  }
  league: string
  dateTime: string
  prediction: string
  odds: string
  confidence: number
  analysis: string
  status: "upcoming" | "live" | "finished" | "postponed" | "cancelled"
  result: "won" | "lost" | "pending" | "void"
  isFree: boolean
  isFeatured: boolean
  showInDailyTips: boolean
  showInWeeklySpecials: boolean
  type: "single" | "accumulator"
  matchesInAccumulator: Array<{
    match: string
    prediction: string
    odds: string
  }>
  totalOdds: string
  stake: string
  potentialReturn: string
  valueRating: "Low" | "Medium" | "High" | "Very High"
  createdAt: string
  updatedAt: string
}

// Function to fetch predictions - now public endpoint for homepage
const fetchPredictions = async (): Promise<Prediction[]> => {
  const response = await fetch('/api/homepage/predictions')
  if (!response.ok) {
    throw new Error('Failed to fetch predictions')
  }
  const data = await response.json()
  
  // Normalize the data
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

export function ResponsivePredictions() {
  const [selectedFilter, setSelectedFilter] = useState("all")

  const { data: predictions = [], isLoading, error } = useQuery({
    queryKey: ['homepage-predictions'],
    queryFn: fetchPredictions,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  })

  // Only apply the user-selected filter (all, free, high value)
  const filteredPredictions = predictions.filter(p => {
    switch (selectedFilter) {
      case "free":
        return p.isFree
      case "high":
        return p.valueRating === "High" || p.valueRating === "Very High"
      default:
        return true
    }
  })

  // Calculate filter counts for the filtered predictions
  const filterCounts = {
    all: predictions.length,
    free: predictions.filter(p => p.isFree).length,
    high: predictions.filter(p => p.valueRating === "High" || p.valueRating === "Very High").length,
  }

  const filters = [
    { id: "all", label: "All", count: filterCounts.all },
    { id: "free", label: "Free", count: filterCounts.free },
    { id: "high", label: "High Value", count: filterCounts.high },
  ]

  if (isLoading) {
    return (
      <section className="px-4 py-8 md:py-16 bg-slate-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-4">Today's AI Predictions</h2>
            <p className="text-slate-300 text-lg">Data-driven insights from our advanced machine learning algorithms</p>
          </div>
          <div className="flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          </div>
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="px-4 py-8 md:py-16 bg-slate-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-4">Today's AI Predictions</h2>
            <p className="text-slate-300 text-lg">Data-driven insights from our advanced machine learning algorithms</p>
          </div>
          <div className="text-center text-red-400">
            Failed to load predictions. Please try again later.
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="px-4 py-8 md:py-16 bg-slate-900/50">
      <div className="max-w-6xl mx-auto">
        {/* Header - Responsive */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-8">
          <div className="mb-4 md:mb-0">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-2 flex items-center">
              <Target className="w-6 h-6 md:w-8 md:h-8 mr-2 text-emerald-400" />
              Today's AI Predictions
            </h2>
            <p className="text-slate-300 text-sm md:text-lg">
              High-probability upcoming matches with AI-powered analysis
            </p>
          </div>

          {/* Desktop View Toggle */}
          <div className="hidden md:flex items-center space-x-2">
            <Button variant="ghost" size="sm" className="text-slate-400">
              <TrendingUp className="w-4 h-4 mr-2" />
              Top 5 Picks
            </Button>
          </div>
        </div>

        {/* Filter Tabs - Mobile optimized, desktop enhanced */}
        <div className="flex space-x-2 mb-6 overflow-x-auto pb-2 md:pb-0 md:justify-start">
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setSelectedFilter(filter.id)}
              className={`flex-shrink-0 px-3 md:px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedFilter === filter.id
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {filter.label}
              <span className="ml-1 text-xs opacity-75">({filter.count})</span>
            </button>
          ))}
        </div>

        {/* Predictions Grid - Responsive */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {filteredPredictions.map((prediction) => (
            <Card
              key={prediction.id}
              className="bg-slate-800/50 border-slate-700 p-4 md:p-6 hover:bg-slate-800/70 transition-colors"
            >
              {/* Header Row */}
              <div className="flex items-start justify-between mb-3 md:mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <Badge variant="secondary" className="bg-slate-700 text-slate-300 text-xs">
                      {prediction.league}
                    </Badge>
                    {prediction.status === "live" && (
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-red-400 text-xs font-medium">LIVE</span>
                      </div>
                    )}
                  </div>
                  <h3 className="text-white font-semibold text-sm md:text-lg">
                    {prediction.match.homeTeam.name} vs {prediction.match.awayTeam.name}
                  </h3>
                  <div className="flex items-center text-slate-400 text-xs md:text-sm mt-1">
                    <Clock className="w-3 h-3 md:w-4 md:h-4 mr-1" />
                    {new Date(prediction.match.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl md:text-2xl font-bold text-emerald-400">{prediction.confidence}%</div>
                  <div className="text-slate-400 text-xs">Confidence</div>
                </div>
              </div>

              {/* Prediction Details */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium text-sm md:text-base">{prediction.prediction}</div>
                    <div className="text-slate-400 text-xs md:text-sm">
                      Odds: {prediction.odds}
                      {prediction.type === 'accumulator' && prediction.totalOdds && (
                        <span className="ml-2">(Total: {prediction.totalOdds})</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge
                      className={`text-xs ${
                        prediction.valueRating === "High" || prediction.valueRating === "Very High"
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                      }`}
                    >
                      {prediction.valueRating} Value
                    </Badge>
                    {prediction.isFree ? (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">Free</Badge>
                    ) : (
                      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                        <Lock className="w-3 h-3 mr-1" />
                        VIP
                      </Badge>
                    )}
                    {prediction.type === 'accumulator' && (
                      <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">
                        Accumulator
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Accumulator Details */}
                {prediction.type === 'accumulator' && prediction.matchesInAccumulator.length > 0 && (
                  <div className="bg-slate-900/50 rounded-lg p-3 space-y-2">
                    <div className="text-slate-300 text-xs font-medium">Matches in Accumulator:</div>
                    {prediction.matchesInAccumulator.map((match, index) => (
                      <div key={index} className="text-slate-400 text-xs">
                        • {match.match} - {match.prediction} ({match.odds})
                      </div>
                    ))}
                    {prediction.stake && (
                      <div className="text-slate-300 text-xs mt-2">
                        Recommended Stake: {prediction.stake}
                      </div>
                    )}
                    {prediction.potentialReturn && (
                      <div className="text-slate-300 text-xs">
                        Potential Return: {prediction.potentialReturn}
                      </div>
                    )}
                  </div>
                )}

                {/* AI Analysis */}
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <div className="flex items-start space-x-2">
                    <Brain className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <div className="text-slate-300 text-xs md:text-sm leading-relaxed">
                      {prediction.isFree ? (
                        prediction.analysis
                      ) : (
                        <div className="flex items-center">
                          <Lock className="w-4 h-4 mr-2 text-slate-500" />
                          {prediction.analysis}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Button - Now leads to dashboard/matches */}
                <Link href="/dashboard/matches">
                  <Button
                    className={`w-full ${
                      prediction.isFree ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-600 hover:bg-amber-700"
                    } text-white`}
                  >
                    {prediction.isFree ? (
                      <>
                        <Eye className="w-4 h-4 mr-2" />
                        View Analysis
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 mr-2" />
                        Unlock VIP Analysis
                      </>
                    )}
                    <ChevronRight className="w-4 h-4 ml-auto md:hidden" />
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>

        {/* Load More - Responsive */}
        <div className="text-center mt-8 md:mt-12">
          <Link href="/dashboard/matches">
            <Button
              size="lg"
              variant="outline"
              className="border-slate-600 text-slate-300 hover:bg-slate-800 px-6 md:px-8"
            >
              View All Predictions
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
