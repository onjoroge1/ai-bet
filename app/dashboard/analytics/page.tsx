"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { TrendingUp, Target, BarChart3, PieChart, Activity, Award, Zap, Clock } from "lucide-react"

export default function AnalyticsPage() {
  const [timeframe, setTimeframe] = useState("month")

  const performanceData = {
    winRate: 78,
    totalBets: 156,
    totalProfit: 45600,
    avgOdds: 1.92,
    bestStreak: 12,
    currentStreak: 5,
    profitGrowth: 23.5,
    accuracy: 82,
  }

  const monthlyStats = [
    { month: "Jan", profit: 8500, bets: 32, winRate: 75 },
    { month: "Feb", profit: 12300, bets: 28, winRate: 82 },
    { month: "Mar", profit: 15800, bets: 35, winRate: 77 },
    { month: "Apr", profit: 9200, bets: 31, winRate: 71 },
    { month: "May", profit: 18600, bets: 30, winRate: 85 },
  ]

  const categoryPerformance = [
    { category: "Over/Under Goals", bets: 45, winRate: 84, profit: 15600 },
    { category: "Match Winner", bets: 38, winRate: 76, profit: 12800 },
    { category: "Both Teams Score", bets: 32, winRate: 81, profit: 9800 },
    { category: "Handicap", bets: 25, winRate: 72, profit: 6400 },
    { category: "Correct Score", bets: 16, winRate: 69, profit: 1000 },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Performance Analytics</h1>
              <p className="text-slate-300">Deep insights into your betting performance and trends</p>
            </div>
            <div className="flex items-center space-x-3 mt-4 md:mt-0">
              <Tabs value={timeframe} onValueChange={setTimeframe}>
                <TabsList className="bg-slate-800 border-slate-700">
                  <TabsTrigger value="week" className="data-[state=active]:bg-emerald-600">
                    7 Days
                  </TabsTrigger>
                  <TabsTrigger value="month" className="data-[state=active]:bg-emerald-600">
                    30 Days
                  </TabsTrigger>
                  <TabsTrigger value="year" className="data-[state=active]:bg-emerald-600">
                    1 Year
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-slate-800/50 border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <Target className="w-8 h-8 text-emerald-400" />
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                <TrendingUp className="w-3 h-3 mr-1" />
                +5.2%
              </Badge>
            </div>
            <h3 className="text-2xl font-bold text-white">{performanceData.winRate}%</h3>
            <p className="text-slate-400 text-sm">Win Rate</p>
            <Progress value={performanceData.winRate} className="mt-2" />
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <BarChart3 className="w-8 h-8 text-blue-400" />
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                <TrendingUp className="w-3 h-3 mr-1" />
                +12
              </Badge>
            </div>
            <h3 className="text-2xl font-bold text-white">{performanceData.totalBets}</h3>
            <p className="text-slate-400 text-sm">Total Bets</p>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <Award className="w-8 h-8 text-yellow-400" />
              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                <TrendingUp className="w-3 h-3 mr-1" />
                +23.5%
              </Badge>
            </div>
            <h3 className="text-2xl font-bold text-emerald-400">KES {performanceData.totalProfit.toLocaleString()}</h3>
            <p className="text-slate-400 text-sm">Total Profit</p>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <Zap className="w-8 h-8 text-purple-400" />
              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Current</Badge>
            </div>
            <h3 className="text-2xl font-bold text-white">{performanceData.currentStreak}</h3>
            <p className="text-slate-400 text-sm">Win Streak</p>
            <p className="text-xs text-purple-400 mt-1">Best: {performanceData.bestStreak} wins</p>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Monthly Performance */}
          <Card className="bg-slate-800/50 border-slate-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Monthly Performance</h3>
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="space-y-4">
              {monthlyStats.map((month) => (
                <div key={month.month} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center text-xs font-medium text-emerald-400">
                      {month.month}
                    </div>
                    <div>
                      <p className="text-white font-medium">KES {month.profit.toLocaleString()}</p>
                      <p className="text-slate-400 text-xs">
                        {month.bets} bets • {month.winRate}% win rate
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Progress value={month.winRate} className="w-20 h-2" />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Category Performance */}
          <Card className="bg-slate-800/50 border-slate-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Performance by Category</h3>
              <PieChart className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="space-y-4">
              {categoryPerformance.map((category) => (
                <div key={category.category} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-white text-sm font-medium">{category.category}</span>
                    <span className="text-emerald-400 text-sm">{category.winRate}%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{category.bets} bets</span>
                    <span>KES {category.profit.toLocaleString()}</span>
                  </div>
                  <Progress value={category.winRate} className="h-2" />
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Insights and Recommendations */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-br from-emerald-600/20 to-cyan-600/20 border-emerald-500/30 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Best Performance</h3>
            </div>
            <p className="text-slate-300 mb-3">Over/Under Goals bets show your highest win rate at 84%</p>
            <Button variant="outline" size="sm" className="border-emerald-500 text-emerald-400 hover:bg-emerald-500/10">
              View Strategy
            </Button>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-600/20 to-orange-600/20 border-yellow-500/30 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Improvement Area</h3>
            </div>
            <p className="text-slate-300 mb-3">Correct Score bets need attention - only 69% win rate</p>
            <Button variant="outline" size="sm" className="border-yellow-500 text-yellow-400 hover:bg-yellow-500/10">
              Get Tips
            </Button>
          </Card>

          <Card className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 border-purple-500/30 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                <Award className="w-5 h-5 text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Achievement</h3>
            </div>
            <p className="text-slate-300 mb-3">You&apos;re in the top 15% of our users this month!</p>
            <Button variant="outline" size="sm" className="border-purple-500 text-purple-400 hover:bg-purple-500/10">
              View Ranking
            </Button>
          </Card>
        </div>
      </div>
    </div>
  )
}
