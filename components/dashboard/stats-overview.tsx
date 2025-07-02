"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { TrendingUp, Target, Trophy, Calendar, ArrowUp, ArrowDown, Zap, Brain, Activity, Award, Clock, BarChart3 } from "lucide-react"
import { useDashboardData } from "@/hooks/use-dashboard-data"
import { DashboardResponse } from "@/types/dashboard"

export function StatsOverview() {
  const { data, isLoading, error } = useDashboardData()
  const [animatedValues, setAnimatedValues] = useState({
    predictionAccuracy: 71,
    monthlySuccess: 0,
    totalPredictions: 0,
    currentStreak: 0,
  })

  // Calculate derived metrics
  const calculateMetrics = (data: DashboardResponse | null) => {
    if (!data) return { totalPredictions: 0, currentStreak: 0, accuracy: 0, monthlySuccess: 0 }
    
    // Use model accuracy instead of user accuracy - this represents historical model performance
    const modelAccuracy = 71 // Model's historical accuracy across all predictions
    const monthlySuccess = parseInt(data.dashboard.monthlySuccess.replace('%', '')) || 0
    
    // Estimate total predictions based on accuracy and level
    const totalPredictions = Math.max(5, data.dashboard.level * 10) // Minimum 5, scale with level
    
    // Use win streak from user data
    const currentStreak = data.user.winStreak || 0
    
    return { totalPredictions, currentStreak, accuracy: modelAccuracy, monthlySuccess }
  }

  const metrics = calculateMetrics(data)
  const finalValues: {
    predictionAccuracy: number
    monthlySuccess: number
    totalPredictions: number
    currentStreak: number
  } = {
    predictionAccuracy: metrics.accuracy,
    monthlySuccess: metrics.monthlySuccess,
    totalPredictions: metrics.totalPredictions,
    currentStreak: metrics.currentStreak,
  }

  useEffect(() => {
    if (!data) return

    const duration = 2000 // 2 seconds
    const steps = 60
    const stepDuration = duration / steps

    let currentStep = 0
    const interval = setInterval(() => {
      currentStep++
      const progress = currentStep / steps

      setAnimatedValues({
        predictionAccuracy: 71, // Always show 71% for model accuracy
        monthlySuccess: Math.floor(finalValues.monthlySuccess * progress),
        totalPredictions: Math.floor(finalValues.totalPredictions * progress),
        currentStreak: Math.floor(finalValues.currentStreak * progress),
      })

      if (currentStep >= steps) {
        clearInterval(interval)
        setAnimatedValues({
          predictionAccuracy: 71, // Keep 71% for model accuracy
          monthlySuccess: finalValues.monthlySuccess,
          totalPredictions: finalValues.totalPredictions,
          currentStreak: finalValues.currentStreak,
        })
      }
    }, stepDuration)

    return () => clearInterval(interval)
  }, [data, finalValues])

  // Determine trend indicators based on data
  const getTrendData = () => {
    if (!data) return { accuracyTrend: 'neutral', monthlyTrend: 'neutral', predictionsTrend: 'neutral', streakTrend: 'neutral' }
    
    const modelAccuracy = finalValues.predictionAccuracy // This is now model accuracy (71%)
    const monthlySuccess = finalValues.monthlySuccess
    
    return {
      accuracyTrend: modelAccuracy > 70 ? 'up' : modelAccuracy > 60 ? 'neutral' : 'down',
      monthlyTrend: monthlySuccess > 60 ? 'up' : monthlySuccess > 40 ? 'neutral' : 'down',
      predictionsTrend: finalValues.totalPredictions > 20 ? 'up' : 'neutral',
      streakTrend: finalValues.currentStreak > 3 ? 'up' : finalValues.currentStreak > 0 ? 'neutral' : 'down'
    }
  }

  const trends = getTrendData()

  const stats = [
    {
      title: "Win Streak",
      value: `${animatedValues.currentStreak} wins`,
      change: trends.streakTrend === 'up' ? "On fire!" : trends.streakTrend === 'down' ? "Building up" : "Getting started",
      trend: trends.streakTrend,
      icon: Trophy,
      color: "yellow",
      emoji: "🏆",
      description: "Consecutive successful predictions",
      progress: Math.min(100, (animatedValues.currentStreak / 10) * 100), // Scale to 10 max
    },
    {
      title: "Total Predictions",
      value: animatedValues.totalPredictions.toString(),
      change: trends.predictionsTrend === 'up' ? "Active user" : "Getting started",
      trend: trends.predictionsTrend,
      icon: TrendingUp,
      color: "purple",
      emoji: "📈",
      description: "Predictions you've followed",
      progress: Math.min(100, (animatedValues.totalPredictions / 50) * 100), // Scale to 50 max
    },
  ]

  // Loading state
  if (isLoading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700 p-6 relative overflow-hidden">
        <div className="flex items-center space-x-2 mb-6">
          <h2 className="text-xl font-semibold text-white">Your Performance Overview</h2>
          <Zap className="w-5 h-5 text-yellow-400 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(2)].map((_, index) => (
            <div key={index} className="bg-slate-900/50 rounded-lg p-4 animate-pulse">
              <div className="h-8 bg-slate-700 rounded mb-2"></div>
              <div className="h-6 bg-slate-700 rounded mb-1"></div>
              <div className="h-4 bg-slate-700 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </Card>
    )
  }

  // Error state
  if (error) {
    return (
      <Card className="bg-slate-800/50 border-slate-700 p-6 relative overflow-hidden">
        <div className="flex items-center space-x-2 mb-6">
          <h2 className="text-xl font-semibold text-white">Your Performance Overview</h2>
          <Zap className="w-5 h-5 text-yellow-400" />
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-400 text-sm">Failed to load performance data. Please refresh the page.</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700 p-6 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-emerald-400/10 to-cyan-400/10 rounded-full blur-xl animate-pulse" />
      <div className="absolute bottom-0 left-0 w-16 h-16 bg-gradient-to-br from-purple-400/10 to-pink-400/10 rounded-full blur-xl animate-pulse" style={{ animationDelay: "1s" }} />

      <div className="relative">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-semibold text-white">Your Performance Overview</h2>
            <Zap className="w-5 h-5 text-yellow-400 animate-pulse" />
          </div>
          {data?.dashboard.level && (
            <div className="flex items-center space-x-2">
              <Award className="w-4 h-4 text-yellow-400" />
              <span className="text-sm text-yellow-400 font-medium">Level {data.dashboard.level}</span>
            </div>
          )}
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
                          : stat.color === "purple"
                            ? "bg-purple-500/20 group-hover:bg-purple-500/30"
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
                            : stat.color === "purple"
                              ? "text-purple-400"
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
                {stat.trend === "neutral" && <Activity className="w-4 h-4 text-slate-400" />}
              </div>

              <div className="text-2xl font-bold text-white mb-1 group-hover:text-emerald-400 transition-colors">
                {stat.value}
              </div>
              <div className="text-slate-400 text-sm mb-1">{stat.title}</div>
              <div className="text-slate-500 text-xs mb-2">{stat.description}</div>
              <div
                className={`text-sm font-medium ${
                  stat.trend === "up" ? "text-emerald-400" : stat.trend === "down" ? "text-red-400" : "text-slate-400"
                }`}
              >
                {stat.change}
              </div>

              {/* Progress bar for all stats */}
              <div className="mt-3">
                <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-2000 ease-out ${
                      stat.color === "emerald"
                        ? "bg-gradient-to-r from-emerald-400 to-cyan-400"
                        : stat.color === "blue"
                          ? "bg-gradient-to-r from-blue-400 to-cyan-400"
                          : stat.color === "purple"
                            ? "bg-gradient-to-r from-purple-400 to-pink-400"
                            : stat.color === "yellow"
                              ? "bg-gradient-to-r from-yellow-400 to-orange-400"
                              : "bg-gradient-to-r from-slate-400 to-slate-500"
                    }`}
                    style={{ width: `${stat.progress}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Performance Insights */}
        {data && (
          <div className="mt-6 p-4 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 rounded-lg border border-emerald-500/20">
            <div className="flex items-center space-x-2 mb-2">
              <Brain className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-400">Your Performance Insights</span>
            </div>
            <p className="text-slate-300 text-sm">
              {finalValues.currentStreak > 5 
                ? "Incredible win streak! You're on fire with consecutive successful predictions. Keep up this amazing momentum!"
                : finalValues.currentStreak > 2
                  ? "Great win streak! You're building momentum with consecutive wins. Consider following more AI predictions to extend your streak."
                  : finalValues.totalPredictions > 10
                    ? "You're an active user! Follow more AI predictions to build your win streak and improve your overall performance."
                    : "Getting started! Follow more AI predictions to build your experience and start building win streaks."
              }
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}
