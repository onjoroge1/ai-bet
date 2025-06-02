"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TrendingUp, Target, Users, Brain, BarChart3, PieChart } from "lucide-react"

export function AdvancedDashboard() {
  const [timeRange, setTimeRange] = useState("7d")

  const advancedMetrics = {
    roi: { value: "156%", change: "+23%", trend: "up" },
    sharpeRatio: { value: "2.34", change: "+0.12", trend: "up" },
    maxDrawdown: { value: "8.5%", change: "-2.1%", trend: "down" },
    winRate: { value: "87.3%", change: "+1.2%", trend: "up" },
    avgOdds: { value: "1.85", change: "+0.05", trend: "up" },
    profitFactor: { value: "3.2", change: "+0.3", trend: "up" },
  }

  const modelPerformance = [
    { model: "Deep Learning", accuracy: 89.2, predictions: 1247 },
    { model: "Random Forest", accuracy: 85.7, predictions: 1156 },
    { model: "XGBoost", accuracy: 87.1, predictions: 1203 },
    { model: "Ensemble", accuracy: 91.4, predictions: 1289 },
  ]

  return (
    <div className="space-y-6">
      {/* Advanced Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Object.entries(advancedMetrics).map(([key, metric]) => (
          <Card key={key} className="bg-slate-800/50 border-slate-700 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-slate-400 uppercase tracking-wide">
                {key.replace(/([A-Z])/g, " $1").trim()}
              </div>
              <div className={`text-xs ${metric.trend === "up" ? "text-emerald-400" : "text-red-400"}`}>
                {metric.change}
              </div>
            </div>
            <div className="text-lg font-bold text-white">{metric.value}</div>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 bg-slate-800/50">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="models">AI Models</TabsTrigger>
          <TabsTrigger value="markets">Markets</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Profit Chart */}
            <Card className="bg-slate-800/50 border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2 text-emerald-400" />
                  Profit Curve
                </h3>
                <Button variant="ghost" size="sm" className="text-slate-400">
                  <BarChart3 className="w-4 h-4" />
                </Button>
              </div>
              <div className="h-64 bg-slate-900/50 rounded-lg flex items-center justify-center">
                <div className="text-slate-400">Interactive Chart Placeholder</div>
              </div>
            </Card>

            {/* Win Rate by League */}
            <Card className="bg-slate-800/50 border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold flex items-center">
                  <Target className="w-5 h-5 mr-2 text-emerald-400" />
                  Win Rate by League
                </h3>
                <Button variant="ghost" size="sm" className="text-slate-400">
                  <PieChart className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-3">
                {[
                  { league: "Premier League", rate: 92, games: 156 },
                  { league: "La Liga", rate: 89, games: 134 },
                  { league: "Bundesliga", rate: 85, games: 98 },
                  { league: "Serie A", rate: 87, games: 112 },
                ].map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="text-white text-sm">{item.league}</div>
                      <Badge className="bg-slate-700 text-slate-300 text-xs">{item.games} games</Badge>
                    </div>
                    <div className="text-emerald-400 font-semibold">{item.rate}%</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="models" className="space-y-4">
          <Card className="bg-slate-800/50 border-slate-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white font-semibold flex items-center">
                <Brain className="w-5 h-5 mr-2 text-emerald-400" />
                AI Model Performance
              </h3>
              <Button variant="ghost" size="sm" className="text-slate-400">
                Retrain Models
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {modelPerformance.map((model, index) => (
                <div key={index} className="bg-slate-900/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-white font-medium">{model.model}</div>
                    <Badge
                      className={`${
                        model.accuracy > 90
                          ? "bg-emerald-500/20 text-emerald-400"
                          : model.accuracy > 85
                            ? "bg-yellow-500/20 text-yellow-400"
                            : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {model.accuracy}%
                    </Badge>
                  </div>
                  <div className="text-slate-400 text-sm">{model.predictions.toLocaleString()} predictions</div>
                  <div className="mt-2 w-full bg-slate-700 rounded-full h-2">
                    <div className="bg-emerald-400 h-2 rounded-full" style={{ width: `${model.accuracy}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="markets" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Market Distribution */}
            <Card className="bg-slate-800/50 border-slate-700 p-6">
              <h3 className="text-white font-semibold mb-4">Market Distribution</h3>
              <div className="space-y-3">
                {[
                  { market: "Over/Under", percentage: 35, profit: "+23%" },
                  { market: "Match Result", percentage: 28, profit: "+18%" },
                  { market: "BTTS", percentage: 20, profit: "+31%" },
                  { market: "Handicap", percentage: 17, profit: "+15%" },
                ].map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="text-white text-sm">{item.market}</div>
                    <div className="flex items-center space-x-2">
                      <div className="text-slate-400 text-sm">{item.percentage}%</div>
                      <div className="text-emerald-400 text-sm">{item.profit}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Risk Analysis */}
            <Card className="bg-slate-800/50 border-slate-700 p-6">
              <h3 className="text-white font-semibold mb-4">Risk Analysis</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Value at Risk (95%)</span>
                  <span className="text-red-400">-12.5%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Expected Shortfall</span>
                  <span className="text-red-400">-18.2%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Beta (vs Market)</span>
                  <span className="text-emerald-400">0.85</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Correlation</span>
                  <span className="text-yellow-400">0.23</span>
                </div>
              </div>
            </Card>

            {/* Live Opportunities */}
            <Card className="bg-slate-800/50 border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Live Opportunities</h3>
                <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
              </div>
              <div className="space-y-3">
                {[
                  { match: "Arsenal vs Chelsea", value: "High", odds: "2.10" },
                  { match: "City vs Liverpool", value: "Medium", odds: "1.85" },
                  { match: "Barca vs Madrid", value: "Very High", odds: "3.20" },
                ].map((item, index) => (
                  <div key={index} className="bg-slate-900/50 rounded p-3">
                    <div className="text-white text-sm font-medium">{item.match}</div>
                    <div className="flex items-center justify-between mt-1">
                      <Badge
                        className={`text-xs ${
                          item.value === "Very High"
                            ? "bg-purple-500/20 text-purple-400"
                            : item.value === "High"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-yellow-500/20 text-yellow-400"
                        }`}
                      >
                        {item.value}
                      </Badge>
                      <span className="text-slate-300 text-sm">{item.odds}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* User Growth */}
            <Card className="bg-slate-800/50 border-slate-700 p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center">
                <Users className="w-5 h-5 mr-2 text-emerald-400" />
                User Growth
              </h3>
              <div className="h-48 bg-slate-900/50 rounded-lg flex items-center justify-center">
                <div className="text-slate-400">Growth Chart Placeholder</div>
              </div>
            </Card>

            {/* User Segments */}
            <Card className="bg-slate-800/50 border-slate-700 p-6">
              <h3 className="text-white font-semibold mb-4">User Segments</h3>
              <div className="space-y-4">
                {[
                  { segment: "High Value Users", count: 2340, revenue: "65%" },
                  { segment: "Regular Users", count: 12567, revenue: "28%" },
                  { segment: "New Users", count: 8934, revenue: "7%" },
                ].map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div>
                      <div className="text-white text-sm">{item.segment}</div>
                      <div className="text-slate-400 text-xs">{item.count.toLocaleString()} users</div>
                    </div>
                    <div className="text-emerald-400 font-semibold">{item.revenue}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
