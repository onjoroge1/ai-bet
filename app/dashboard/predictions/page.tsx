"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TrendingUp, Clock, Target, Star, Download, Share2, Eye, Lock } from "lucide-react"

export default function PredictionsPage() {
  const [filter, setFilter] = useState("all")

  const predictions = [
    {
      id: 1,
      match: "Manchester United vs Arsenal",
      league: "Premier League",
      prediction: "Over 2.5 Goals",
      confidence: 92,
      odds: 1.85,
      status: "won",
      profit: 850,
      time: "15:30",
      date: "Today",
      analysis: "Both teams have scored in their last 5 meetings. United's attack vs Arsenal's leaky defense.",
      isPremium: false,
    },
    {
      id: 2,
      match: "Barcelona vs Real Madrid",
      league: "La Liga",
      prediction: "BTTS & Over 2.5",
      confidence: 88,
      odds: 2.1,
      status: "pending",
      profit: 0,
      time: "20:00",
      date: "Today",
      analysis: "El Clasico always delivers goals. Both teams in excellent attacking form.",
      isPremium: true,
    },
    {
      id: 3,
      match: "Liverpool vs Chelsea",
      league: "Premier League",
      prediction: "Liverpool Win",
      confidence: 85,
      odds: 1.75,
      status: "lost",
      profit: -1000,
      time: "17:30",
      date: "Yesterday",
      analysis: "Liverpool's home form has been exceptional this season.",
      isPremium: false,
    },
    {
      id: 4,
      match: "Bayern Munich vs Dortmund",
      league: "Bundesliga",
      prediction: "Over 3.5 Goals",
      confidence: 90,
      odds: 2.25,
      status: "won",
      profit: 1250,
      time: "18:30",
      date: "Yesterday",
      analysis: "Der Klassiker promises goals with both teams' attacking prowess.",
      isPremium: true,
    },
  ]

  const filteredPredictions = predictions.filter((pred) => {
    if (filter === "all") return true
    if (filter === "won") return pred.status === "won"
    if (filter === "pending") return pred.status === "pending"
    if (filter === "premium") return pred.isPremium
    return true
  })

  const stats = {
    totalPredictions: 156,
    winRate: 78,
    totalProfit: 45600,
    avgOdds: 1.92,
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">My Predictions</h1>
              <p className="text-slate-300">Track your betting performance and analyze your predictions</p>
            </div>
            <div className="flex items-center space-x-3 mt-4 md:mt-0">
              <Button variant="outline" className="border-emerald-500 text-emerald-400 hover:bg-emerald-500/10">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" className="border-emerald-500 text-emerald-400 hover:bg-emerald-500/10">
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card className="bg-slate-800/50 border-slate-700 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Total Predictions</p>
                  <p className="text-2xl font-bold text-white">{stats.totalPredictions}</p>
                </div>
                <Target className="w-8 h-8 text-emerald-400" />
              </div>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Win Rate</p>
                  <p className="text-2xl font-bold text-emerald-400">{stats.winRate}%</p>
                </div>
                <TrendingUp className="w-8 h-8 text-emerald-400" />
              </div>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Total Profit</p>
                  <p className="text-2xl font-bold text-emerald-400">KES {stats.totalProfit.toLocaleString()}</p>
                </div>
                <Star className="w-8 h-8 text-yellow-400" />
              </div>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Avg Odds</p>
                  <p className="text-2xl font-bold text-white">{stats.avgOdds}</p>
                </div>
                <Clock className="w-8 h-8 text-blue-400" />
              </div>
            </Card>
          </div>
        </div>

        {/* Filters */}
        <Tabs value={filter} onValueChange={setFilter} className="mb-6">
          <TabsList className="bg-slate-800 border-slate-700">
            <TabsTrigger value="all" className="data-[state=active]:bg-emerald-600">
              All Predictions
            </TabsTrigger>
            <TabsTrigger value="won" className="data-[state=active]:bg-emerald-600">
              Won
            </TabsTrigger>
            <TabsTrigger value="pending" className="data-[state=active]:bg-emerald-600">
              Pending
            </TabsTrigger>
            <TabsTrigger value="premium" className="data-[state=active]:bg-emerald-600">
              Premium
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Predictions List */}
        <div className="space-y-4">
          {filteredPredictions.map((prediction) => (
            <Card
              key={prediction.id}
              className="bg-slate-800/50 border-slate-700 p-6 hover:bg-slate-800/70 transition-all duration-300"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">{prediction.match}</h3>
                    {prediction.isPremium && (
                      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                        <Star className="w-3 h-3 mr-1" />
                        Premium
                      </Badge>
                    )}
                    <Badge
                      className={`${
                        prediction.status === "won"
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          : prediction.status === "pending"
                            ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                            : "bg-red-500/20 text-red-400 border-red-500/30"
                      }`}
                    >
                      {prediction.status.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-slate-400 text-sm mb-1">
                    {prediction.league} • {prediction.date} at {prediction.time}
                  </p>
                  <p className="text-emerald-400 font-medium mb-2">{prediction.prediction}</p>
                  <p className="text-slate-300 text-sm">{prediction.analysis}</p>
                </div>

                <div className="flex flex-col md:flex-row items-start md:items-center space-y-3 md:space-y-0 md:space-x-6 mt-4 md:mt-0">
                  <div className="text-center">
                    <p className="text-slate-400 text-xs">Confidence</p>
                    <p className="text-lg font-bold text-emerald-400">{prediction.confidence}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-slate-400 text-xs">Odds</p>
                    <p className="text-lg font-bold text-white">{prediction.odds}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-slate-400 text-xs">Profit/Loss</p>
                    <p
                      className={`text-lg font-bold ${prediction.profit > 0 ? "text-emerald-400" : prediction.profit < 0 ? "text-red-400" : "text-slate-400"}`}
                    >
                      {prediction.profit > 0 ? "+" : ""}KES {prediction.profit.toLocaleString()}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-emerald-500 text-emerald-400 hover:bg-emerald-500/10"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Details
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Upgrade Prompt for Premium Features */}
        <Card className="bg-gradient-to-r from-emerald-600/20 to-cyan-600/20 border-emerald-500/30 p-6 mt-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-4 mb-4 md:mb-0">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center">
                <Lock className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Unlock Premium Predictions</h3>
                <p className="text-slate-300">
                  Get access to our highest confidence predictions with detailed analysis
                </p>
              </div>
            </div>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">Upgrade to Premium</Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
