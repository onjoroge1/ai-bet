"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, Lock, Eye, Target, Brain, ChevronRight, Filter, Loader2 } from "lucide-react"

// Type for prediction data
type Prediction = {
  id: string
  match: {
    homeTeam: { name: string }
    awayTeam: { name: string }
    league: { name: string }
    matchDate: string
    status: string
  }
  prediction: string
  confidence: number
  odds: string
  valueRating: string
  analysis: string
  isFree: boolean
  isFeatured: boolean
  status: string
}

export function ResponsivePredictions() {
  const [selectedFilter, setSelectedFilter] = useState("all")
  const [viewMode, setViewMode] = useState<"grid" | "list">("list")
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch predictions from API
  useEffect(() => {
    const fetchPredictions = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        const response = await fetch('/api/homepage/predictions')
        if (!response.ok) {
          throw new Error('Failed to fetch predictions')
        }
        
        const data = await response.json()
        setPredictions(data)
      } catch (error) {
        console.error('Error fetching predictions:', error)
        setError('Unable to load predictions')
      } finally {
        setIsLoading(false)
      }
    }

    fetchPredictions()
  }, [])

  // Filter predictions based on selection
  const filteredPredictions = predictions.filter(prediction => {
    switch (selectedFilter) {
      case "free":
        return prediction.isFree
      case "live":
        return prediction.match.status === "live"
      case "high":
        return prediction.valueRating === "High" || prediction.valueRating === "Very High"
      default:
        return true
    }
  })

  // Calculate filter counts
  const filterCounts = {
    all: predictions.length,
    free: predictions.filter(p => p.isFree).length,
    live: predictions.filter(p => p.match.status === "live").length,
    high: predictions.filter(p => p.valueRating === "High" || p.valueRating === "Very High").length,
  }

  const filters = [
    { id: "all", label: "All", count: filterCounts.all },
    { id: "free", label: "Free", count: filterCounts.free },
    { id: "live", label: "Live", count: filterCounts.live },
    { id: "high", label: "High Value", count: filterCounts.high },
  ]

  // Format match time
  const formatMatchTime = (matchDate: string) => {
    return new Date(matchDate).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
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
              Data-driven insights from our advanced machine learning algorithms
            </p>
          </div>

          {/* Desktop View Toggle */}
          <div className="hidden md:flex items-center space-x-2">
            <Button variant="ghost" size="sm" className="text-slate-400">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
            <Button variant="ghost" size="sm" className="text-slate-400">
              <Eye className="w-4 h-4" />
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

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mr-3" />
            <span className="text-slate-300 text-lg">Loading predictions...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12">
            <div className="text-red-400 text-lg mb-2">Unable to load predictions</div>
            <div className="text-slate-400 text-sm">{error}</div>
            <Button 
              onClick={() => window.location.reload()} 
              className="mt-4 bg-emerald-600 hover:bg-emerald-700"
            >
              Try Again
            </Button>
          </div>
        )}

        {/* No Predictions State */}
        {!isLoading && !error && filteredPredictions.length === 0 && (
          <div className="text-center py-12">
            <div className="text-slate-400 text-lg mb-2">No predictions available</div>
            <div className="text-slate-500 text-sm">
              {selectedFilter === "all" 
                ? "Check back later for new predictions" 
                : `No ${selectedFilter} predictions available`
              }
            </div>
          </div>
        )}

        {/* Predictions Grid - Responsive */}
        {!isLoading && !error && filteredPredictions.length > 0 && (
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
                        {prediction.match.league.name}
                      </Badge>
                      {prediction.match.status === "live" && (
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
                      {formatMatchTime(prediction.match.matchDate)}
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
                      <div className="text-slate-400 text-xs md:text-sm">Odds: {prediction.odds}</div>
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
                    </div>
                  </div>

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

                  {/* Action Button */}
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
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
