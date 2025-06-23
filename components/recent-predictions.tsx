"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, CheckCircle, XCircle, Minus, Eye, Star, Sparkles } from "lucide-react"

export function RecentPredictions() {
  const [hoveredPrediction, setHoveredPrediction] = useState<number | null>(null)

  const predictions = [
    {
      id: 1,
      match: "Arsenal vs Chelsea",
      prediction: "Over 2.5 Goals",
      confidence: 92,
      odds: "1.85",
      status: "won",
      profit: "+KES 3,500",
      time: "2 hours ago",
      emoji: "⚽",
      celebration: "🎉",
    },
    {
      id: 2,
      match: "Man City vs Liverpool",
      prediction: "BTTS",
      confidence: 87,
      odds: "1.65",
      status: "pending",
      profit: "KES 2,000",
      time: "Starting in 1h",
      emoji: "⚡",
      celebration: "🔥",
    },
    {
      id: 3,
      match: "Barcelona vs Madrid",
      prediction: "Barcelona Win",
      confidence: 78,
      odds: "2.10",
      status: "lost",
      profit: "-KES 1,500",
      time: "Yesterday",
      emoji: "🏟️",
      celebration: "💪",
    },
    {
      id: 4,
      match: "Bayern vs Dortmund",
      prediction: "U3.5 Goals",
      confidence: 84,
      odds: "1.95",
      status: "won",
      profit: "+KES 4,200",
      time: "2 days ago",
      emoji: "🎯",
      celebration: "✨",
    },
  ]

  const getStatusIcon = (status: string) => {
    switch (status) {
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

  const getStatusColor = (status: string) => {
    switch (status) {
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
            <h2 className="text-xl font-semibold text-white">Recent Predictions</h2>
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
          {predictions.map((prediction) => (
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
                    {prediction.emoji}
                  </span>
                  <div>
                    <h3 className="text-white font-medium">{prediction.match}</h3>
                    <p className="text-slate-400 text-sm">{prediction.time}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(prediction.status)}
                  <Badge
                    className={`transition-all duration-300 hover:scale-110 ${
                      prediction.status === "won"
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        : prediction.status === "lost"
                          ? "bg-red-500/20 text-red-400 border-red-500/30"
                          : prediction.status === "pending"
                            ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                            : "bg-slate-500/20 text-slate-400 border-slate-500/30"
                    }`}
                  >
                    {prediction.confidence}%
                  </Badge>
                  {prediction.status === "won" && hoveredPrediction === prediction.id && (
                    <span className="text-lg animate-bounce">{prediction.celebration}</span>
                  )}
                </div>
              </div>

              <div className="relative flex items-center justify-between">
                <div>
                  <div className="text-white font-medium">{prediction.prediction}</div>
                  <div className="text-slate-400 text-sm">Odds: {prediction.odds}</div>
                </div>
                <div className="text-right flex items-center space-x-2">
                  <div className={`font-semibold ${getStatusColor(prediction.status)}`}>{prediction.profit}</div>
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
              {prediction.status === "won" && (
                <div className="absolute inset-0 rounded-lg border-2 border-emerald-400/50 animate-pulse" />
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
