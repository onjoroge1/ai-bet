"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, Lock, Eye, Target, Brain, ChevronRight, Filter } from "lucide-react"

export function ResponsivePredictions() {
  const [selectedFilter, setSelectedFilter] = useState("all")
  const [viewMode, setViewMode] = useState<"grid" | "list">("list")

  const predictions = [
    {
      id: 1,
      match: "Arsenal vs Chelsea",
      league: "Premier League",
      time: "15:30",
      prediction: "Over 2.5 Goals",
      confidence: 92,
      odds: "1.85",
      value: "High",
      isFree: true,
      status: "upcoming",
      analysis: "Both teams have scored 3+ goals in their last 5 matches. Arsenal's attacking form is exceptional.",
    },
    {
      id: 2,
      match: "Man City vs Liverpool",
      league: "Premier League",
      time: "17:45",
      prediction: "BTTS",
      confidence: 87,
      odds: "1.65",
      value: "Medium",
      isFree: true,
      status: "live",
      analysis: "High-scoring fixture expected with both teams in excellent attacking form.",
    },
    {
      id: 3,
      match: "Barcelona vs Madrid",
      league: "La Liga",
      time: "20:00",
      prediction: "Barcelona Win",
      confidence: 78,
      odds: "2.10",
      value: "High",
      isFree: false,
      status: "upcoming",
      analysis: "Premium analysis available for VIP members only.",
    },
  ]

  const filters = [
    { id: "all", label: "All", count: 12 },
    { id: "free", label: "Free", count: 8 },
    { id: "live", label: "Live", count: 3 },
    { id: "high", label: "High Value", count: 5 },
  ]

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

        {/* Predictions Grid - Responsive */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {predictions.map((prediction) => (
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
                  <h3 className="text-white font-semibold text-sm md:text-lg">{prediction.match}</h3>
                  <div className="flex items-center text-slate-400 text-xs md:text-sm mt-1">
                    <Clock className="w-3 h-3 md:w-4 md:h-4 mr-1" />
                    {prediction.time}
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
                        prediction.value === "High"
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                      }`}
                    >
                      {prediction.value} Value
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
                  <ChevronRight className="w-4 h-4 ml-auto md:hidden" />
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {/* Load More - Responsive */}
        <div className="text-center mt-8 md:mt-12">
          <Button
            size="lg"
            variant="outline"
            className="border-slate-600 text-slate-300 hover:bg-slate-800 px-6 md:px-8"
          >
            View All Predictions
          </Button>
        </div>
      </div>
    </section>
  )
}
