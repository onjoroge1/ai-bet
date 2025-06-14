"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { TrendingUp, Target, Trophy, Calendar, ArrowUp, ArrowDown, Zap } from "lucide-react"

export function StatsOverview() {
  const [animatedValues, setAnimatedValues] = useState({
    winRate: 0,
    totalBets: 0,
    profit: 0,
    streak: 0,
  })

  const finalValues = {
    winRate: 87,
    totalBets: 156,
    profit: 45000,
    streak: 12,
  }

  useEffect(() => {
    const duration = 2000 // 2 seconds
    const steps = 60
    const stepDuration = duration / steps

    let currentStep = 0
    const interval = setInterval(() => {
      currentStep++
      const progress = currentStep / steps

      setAnimatedValues({
        winRate: Math.floor(finalValues.winRate * progress),
        totalBets: Math.floor(finalValues.totalBets * progress),
        profit: Math.floor(finalValues.profit * progress),
        streak: Math.floor(finalValues.streak * progress),
      })

      if (currentStep >= steps) {
        clearInterval(interval)
        setAnimatedValues(finalValues)
      }
    }, stepDuration)

    return () => clearInterval(interval)
  }, [])

  const stats = [
    {
      title: "Win Rate",
      value: `${animatedValues.winRate}%`,
      change: "+5%",
      trend: "up",
      icon: Target,
      color: "emerald",
      emoji: "🎯",
    },
    {
      title: "Total Bets",
      value: animatedValues.totalBets.toString(),
      change: "+12",
      trend: "up",
      icon: Calendar,
      color: "blue",
      emoji: "📊",
    },
    {
      title: "Profit This Month",
      value: `KES ${animatedValues.profit.toLocaleString()}`,
      change: "+KES 8,500",
      trend: "up",
      icon: TrendingUp,
      color: "emerald",
      emoji: "💰",
    },
    {
      title: "Best Streak",
      value: `${animatedValues.streak} wins`,
      change: "Current: 5",
      trend: "neutral",
      icon: Trophy,
      color: "yellow",
      emoji: "🏆",
    },
  ]

  return (
    <Card className="bg-slate-800/50 border-slate-700 p-6 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-emerald-400/10 to-cyan-400/10 rounded-full blur-xl animate-pulse" />

      <div className="relative">
        <div className="flex items-center space-x-2 mb-6">
          <h2 className="text-xl font-semibold text-white">Performance Overview</h2>
          <Zap className="w-5 h-5 text-yellow-400 animate-pulse" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="bg-slate-900/50 rounded-lg p-4 hover:bg-slate-900/70 transition-all duration-300 hover:scale-105 cursor-pointer group"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:scale-110 ${
                      stat.color === "emerald"
                        ? "bg-emerald-500/20 group-hover:bg-emerald-500/30"
                        : stat.color === "blue"
                          ? "bg-blue-500/20 group-hover:bg-blue-500/30"
                          : stat.color === "yellow"
                            ? "bg-yellow-500/20 group-hover:bg-yellow-500/30"
                            : "bg-slate-500/20 group-hover:bg-slate-500/30"
                    }`}
                  >
                    <stat.icon
                      className={`w-5 h-5 ${
                        stat.color === "emerald"
                          ? "text-emerald-400"
                          : stat.color === "blue"
                            ? "text-blue-400"
                            : stat.color === "yellow"
                              ? "text-yellow-400"
                              : "text-slate-400"
                      }`}
                    />
                  </div>
                  <span className="text-2xl">{stat.emoji}</span>
                </div>
                {stat.trend === "up" && <ArrowUp className="w-4 h-4 text-emerald-400 animate-bounce" />}
                {stat.trend === "down" && <ArrowDown className="w-4 h-4 text-red-400 animate-bounce" />}
              </div>

              <div className="text-2xl font-bold text-white mb-1 group-hover:text-emerald-400 transition-colors">
                {stat.value}
              </div>
              <div className="text-slate-400 text-sm mb-2">{stat.title}</div>
              <div
                className={`text-sm ${
                  stat.trend === "up" ? "text-emerald-400" : stat.trend === "down" ? "text-red-400" : "text-slate-400"
                }`}
              >
                {stat.change}
              </div>

              {/* Animated progress bar for win rate */}
              {stat.title === "Win Rate" && (
                <div className="mt-2">
                  <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full transition-all duration-2000 ease-out"
                      style={{ width: `${animatedValues.winRate}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
