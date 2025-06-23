"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Heart, X, Star, Brain } from "lucide-react"

export function MobileSwipeCards() {
  const [currentIndex, setCurrentIndex] = useState(0)

  const predictions = [
    {
      id: 1,
      match: "Arsenal vs Chelsea",
      prediction: "Over 2.5 Goals",
      confidence: 92,
      odds: "1.85",
      analysis: "Both teams have scored 3+ goals in their last 5 matches. Arsenal's attacking form is exceptional.",
      league: "Premier League",
      time: "15:30",
    },
    {
      id: 2,
      match: "Barcelona vs Madrid",
      prediction: "BTTS",
      confidence: 87,
      odds: "1.65",
      analysis: "El Clasico always delivers goals. Both teams have strong attacking records.",
      league: "La Liga",
      time: "20:00",
    },
    {
      id: 3,
      match: "Bayern vs Dortmund",
      prediction: "Bayern Win",
      confidence: 84,
      odds: "1.95",
      analysis: "Bayern's home record is outstanding. Dortmund struggling away from home.",
      league: "Bundesliga",
      time: "18:30",
    },
  ]

  const handleSwipe = (direction: "left" | "right") => {
    if (direction === "right") {
      // Add to favorites/watchlist
      console.log("Added to favorites")
    }

    if (currentIndex < predictions.length - 1) {
      setCurrentIndex(currentIndex + 1)
    } else {
      setCurrentIndex(0) // Loop back to start
    }
  }

  const currentPrediction = predictions[currentIndex]

  return (
    <div className="px-4 py-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-white mb-2">Swipe for Predictions</h2>
        <p className="text-slate-400 text-sm">Swipe right to save, left to skip</p>
      </div>

      {/* Swipe Card */}
      <div className="relative h-96 mb-6">
        <Card className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 p-6 overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-cyan-400 rounded-full blur-3xl" />
          </div>

          <div className="relative h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <Badge className="bg-slate-700 text-slate-300">{currentPrediction.league}</Badge>
              <div className="text-slate-400 text-sm">{currentPrediction.time}</div>
            </div>

            {/* Match */}
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-white mb-2">{currentPrediction.match}</h3>
              <div className="text-emerald-400 font-semibold text-lg">{currentPrediction.prediction}</div>
              <div className="text-slate-300 text-sm">@ {currentPrediction.odds}</div>
            </div>

            {/* Confidence */}
            <div className="text-center mb-6">
              <div className="text-3xl font-bold text-emerald-400 mb-1">{currentPrediction.confidence}%</div>
              <div className="text-slate-400 text-sm">AI Confidence</div>
              <div className="flex justify-center mt-2">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${
                      i < Math.floor(currentPrediction.confidence / 20)
                        ? "text-yellow-400 fill-current"
                        : "text-slate-600"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Analysis */}
            <div className="bg-slate-900/50 rounded-lg p-4 mb-6 flex-1">
              <div className="flex items-start space-x-2">
                <Brain className="w-4 h-4 text-emerald-400 mt-1 flex-shrink-0" />
                <div className="text-slate-300 text-sm leading-relaxed">{currentPrediction.analysis}</div>
              </div>
            </div>

            {/* Progress Indicator */}
            <div className="flex justify-center space-x-2">
              {predictions.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full ${index === currentIndex ? "bg-emerald-400" : "bg-slate-600"}`}
                />
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Swipe Actions */}
      <div className="flex justify-center space-x-8">
        <Button
          size="lg"
          variant="outline"
          className="w-16 h-16 rounded-full border-red-500/50 hover:bg-red-500/20"
          onClick={() => handleSwipe("left")}
        >
          <X className="w-6 h-6 text-red-400" />
        </Button>

        <Button
          size="lg"
          className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-700"
          onClick={() => handleSwipe("right")}
        >
          <Heart className="w-6 h-6 text-white" />
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="mt-8 grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-lg font-bold text-white">{predictions.length}</div>
          <div className="text-xs text-slate-400">Today's Tips</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-emerald-400">87%</div>
          <div className="text-xs text-slate-400">Avg Confidence</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-yellow-400">5</div>
          <div className="text-xs text-slate-400">High Value</div>
        </div>
      </div>
    </div>
  )
}
