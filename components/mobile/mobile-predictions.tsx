"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, Lock, Eye, Target, Brain, ChevronRight } from "lucide-react"

export function MobilePredictions() {
  const [selectedFilter, setSelectedFilter] = useState("all")

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
    },
  ]

  const filters = [
    { id: "all", label: "All", count: 12 },
    { id: "free", label: "Free", count: 8 },
    { id: "live", label: "Live", count: 3 },
    { id: "high", label: "High Value", count: 5 },
  ]

  return (
    <div className="px-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white flex items-center">
          <Target className="w-5 h-5 mr-2 text-emerald-400" />
          Today's Tips
        </h2>
        <Button variant="ghost" size="sm" className="text-slate-400">
          <Eye className="w-4 h-4" />
        </Button>
      </div>

      {/* Filter Tabs - Mobile Optimized */}
      <div className="flex space-x-2 mb-6 overflow-x-auto pb-2">
        {filters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => setSelectedFilter(filter.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
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

      {/* Predictions List - Mobile Optimized */}
      <div className="space-y-3">
        {predictions.map((prediction) => (
          <Card key={prediction.id} className="bg-slate-800/50 border-slate-700 p-4">
            {/* Header Row */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <h3 className="text-white font-medium text-sm">{prediction.match}</h3>
                  {prediction.status === "live" && <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
                </div>
                <div className="flex items-center space-x-2 text-xs text-slate-400">
                  <span>{prediction.league}</span>
                  <span>•</span>
                  <Clock className="w-3 h-3" />
                  <span>{prediction.time}</span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-lg font-bold text-emerald-400">{prediction.confidence}%</div>
                <div className="text-xs text-slate-400">Confidence</div>
              </div>
            </div>

            {/* Prediction Details */}
            <div className="bg-slate-900/50 rounded-lg p-3 mb-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-white font-medium text-sm">{prediction.prediction}</div>
                <div className="text-slate-300 text-sm">@ {prediction.odds}</div>
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

            {/* AI Analysis Preview */}
            <div className="bg-slate-800/50 rounded-lg p-3 mb-3">
              <div className="flex items-start space-x-2">
                <Brain className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <div className="text-slate-300 text-xs leading-relaxed">
                  {prediction.isFree
                    ? "Both teams have scored 3+ goals in their last 5 matches. Arsenal's attacking form is exceptional."
                    : "Premium AI analysis available for VIP members only."}
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
              <ChevronRight className="w-4 h-4 ml-auto" />
            </Button>
          </Card>
        ))}
      </div>

      {/* Load More */}
      <div className="mt-6 text-center">
        <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800">
          Load More Predictions
        </Button>
      </div>
    </div>
  )
}
