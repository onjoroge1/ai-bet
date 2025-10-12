"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Activity, 
  TrendingUp, 
  Target, 
  Timer, 
  BarChart3,
  Crown,
  Zap,
  ArrowRight
} from "lucide-react"

interface LivePrediction {
  id: string
  homeTeam: string
  awayTeam: string
  league: string
  prediction: string
  confidence: number
  odds: number
  clv: number
  ev: number
  kelly: number
  timeToKick: string
  status: 'live' | 'upcoming' | 'hot'
}

export function LivePredictionsShowcase() {
  const [predictions, setPredictions] = useState<LivePrediction[]>([
    {
      id: "1",
      homeTeam: "Barcelona",
      awayTeam: "Real Madrid",
      league: "LaLiga",
      prediction: "Over 2.5 Goals",
      confidence: 94,
      odds: 1.85,
      clv: 8.5,
      ev: 4.2,
      kelly: 2.1,
      timeToKick: "2h 15m",
      status: 'hot'
    },
    {
      id: "2",
      homeTeam: "Manchester City",
      awayTeam: "Liverpool",
      league: "Premier League",
      prediction: "BTTS Yes",
      confidence: 87,
      odds: 1.72,
      clv: 6.2,
      ev: 3.1,
      kelly: 1.8,
      timeToKick: "4h 32m",
      status: 'live'
    },
    {
      id: "3",
      homeTeam: "Bayern Munich",
      awayTeam: "Borussia Dortmund",
      league: "Bundesliga",
      prediction: "Bayern Munich Win",
      confidence: 82,
      odds: 1.95,
      clv: 5.8,
      ev: 2.9,
      kelly: 1.5,
      timeToKick: "6h 45m",
      status: 'upcoming'
    },
    {
      id: "4",
      homeTeam: "PSG",
      awayTeam: "Marseille",
      league: "Ligue 1",
      prediction: "Over 1.5 Goals",
      confidence: 91,
      odds: 1.42,
      clv: 7.3,
      ev: 3.8,
      kelly: 2.3,
      timeToKick: "1h 28m",
      status: 'hot'
    }
  ])

  const [currentIndex, setCurrentIndex] = useState(0)

  // Simulate live updates
  useEffect(() => {
    const interval = setInterval(() => {
      setPredictions(prev => prev.map(p => ({
        ...p,
        confidence: Math.max(75, Math.min(95, p.confidence + Math.floor(Math.random() * 3) - 1)),
        clv: Math.max(1, Math.min(15, p.clv + (Math.random() - 0.5) * 0.5)),
        ev: Math.max(0.5, Math.min(8, p.ev + (Math.random() - 0.5) * 0.3))
      })))
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  // Rotate featured prediction
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % predictions.length)
    }, 4000)

    return () => clearInterval(interval)
  }, [predictions.length])

  const getStatusBadge = (status: string, confidence: number) => {
    switch (status) {
      case 'hot':
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 animate-pulse">
            🔥 Hot Tip
          </Badge>
        )
      case 'live':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
            <Activity className="h-3 w-3 mr-1 animate-pulse" />
            Live
          </Badge>
        )
      default:
        return confidence >= 90 ? (
          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
            <Crown className="h-3 w-3 mr-1" />
            Premium
          </Badge>
        ) : (
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
            Upcoming
          </Badge>
        )
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return "text-purple-400"
    if (confidence >= 85) return "text-emerald-400"
    if (confidence >= 80) return "text-blue-400"
    return "text-yellow-400"
  }

  const featuredPrediction = predictions[currentIndex]

  return (
    <div className="space-y-8">
      {/* Featured Prediction */}
      <Card className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/30 overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Activity className="h-6 w-6 text-emerald-400 animate-pulse" />
              <CardTitle className="text-white text-xl">Featured Prediction</CardTitle>
            </div>
            {getStatusBadge(featuredPrediction.status, featuredPrediction.confidence)}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Match Info */}
            <div>
              <div className="text-2xl font-bold text-white mb-2">
                {featuredPrediction.homeTeam} vs {featuredPrediction.awayTeam}
              </div>
              <div className="flex items-center space-x-4 mb-4">
                <Badge variant="outline" className="border-slate-600 text-slate-400">
                  {featuredPrediction.league}
                </Badge>
                <div className="flex items-center text-orange-400">
                  <Timer className="h-4 w-4 mr-1" />
                  {featuredPrediction.timeToKick}
                </div>
              </div>
              
              <div className="bg-slate-800/60 rounded-lg p-4">
                <div className="text-emerald-400 font-medium mb-2">AI Prediction</div>
                <div className="text-white text-xl font-semibold mb-1">
                  {featuredPrediction.prediction}
                </div>
                <div className="text-slate-400 text-sm">
                  Odds: {featuredPrediction.odds} • CLV: +{featuredPrediction.clv.toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800/60 rounded-lg p-4 text-center">
                <div className={`text-3xl font-bold ${getConfidenceColor(featuredPrediction.confidence)} mb-1`}>
                  {featuredPrediction.confidence}%
                </div>
                <div className="text-slate-400 text-sm">Confidence Score</div>
              </div>
              
              <div className="bg-slate-800/60 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-emerald-400 mb-1">
                  +{featuredPrediction.ev.toFixed(1)}%
                </div>
                <div className="text-slate-400 text-sm">Expected Value</div>
              </div>
              
              <div className="bg-slate-800/60 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-blue-400 mb-1">
                  {featuredPrediction.kelly.toFixed(1)}%
                </div>
                <div className="text-slate-400 text-sm">Kelly Stake</div>
              </div>
              
              <div className="bg-slate-800/60 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-orange-400 mb-1">
                  +{featuredPrediction.clv.toFixed(1)}%
                </div>
                <div className="text-slate-400 text-sm">Closing Line Value</div>
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <div className="border-t border-slate-600/30 pt-6">
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3">
              <Target className="h-5 w-5 mr-2" />
              Access Full Analysis & More Predictions
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Prediction Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {predictions.slice(0, 4).map((prediction, index) => (
          <Card 
            key={prediction.id} 
            className={`bg-slate-800/60 border-slate-600/50 hover:border-slate-500/70 transition-all duration-300 ${
              index === currentIndex ? 'ring-2 ring-emerald-500/30' : ''
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="text-white font-medium text-lg">
                  {prediction.homeTeam} vs {prediction.awayTeam}
                </div>
                {getStatusBadge(prediction.status, prediction.confidence)}
              </div>
              <div className="text-slate-400 text-sm">{prediction.league}</div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="bg-slate-700/40 rounded-lg p-3">
                <div className="text-emerald-400 text-sm font-medium mb-1">Prediction</div>
                <div className="text-white font-semibold">{prediction.prediction}</div>
              </div>
              
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className={`text-lg font-bold ${getConfidenceColor(prediction.confidence)}`}>
                    {prediction.confidence}%
                  </div>
                  <div className="text-slate-400 text-xs">Confidence</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-emerald-400">
                    +{prediction.ev.toFixed(1)}%
                  </div>
                  <div className="text-slate-400 text-xs">EV</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-blue-400">
                    {prediction.kelly.toFixed(1)}%
                  </div>
                  <div className="text-slate-400 text-xs">Kelly</div>
                </div>
              </div>
              
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">CLV: +{prediction.clv.toFixed(1)}%</span>
                <span className="text-orange-400 flex items-center">
                  <Timer className="h-3 w-3 mr-1" />
                  {prediction.timeToKick}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bottom Stats */}
      <Card className="bg-slate-800/60 border-slate-600/50 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
          <div>
            <div className="text-2xl font-bold text-emerald-400 mb-1">47</div>
            <div className="text-slate-400 text-sm">Active Predictions</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-400 mb-1">89%</div>
            <div className="text-slate-400 text-sm">Avg Confidence</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-400 mb-1">23</div>
            <div className="text-slate-400 text-sm">Live Matches</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-400 mb-1">+12.3%</div>
            <div className="text-slate-400 text-sm">Avg ROI This Week</div>
          </div>
        </div>
      </Card>
    </div>
  )
}
