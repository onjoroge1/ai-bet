"use client"

import { useState, useEffect, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { TrendingUp, Trophy, ArrowUp, ArrowDown, Zap, Brain, Activity, Award, Star } from "lucide-react"
import { useDashboardData } from "@/hooks/use-dashboard-data"
import { DashboardResponse } from "@/types/dashboard"

export function StatsOverview() {
  const { data, isLoading, error } = useDashboardData()
  const [animatedValues, setAnimatedValues] = useState({
    totalTipsPurchased: 0,
    thisMonthActivity: 0,
    totalSpent: 0,
    averageConfidence: 0,
  })

  // Calculate derived metrics from real purchase data
  const calculateMetrics = (data: DashboardResponse | null) => {
    if (!data) return { 
      totalTipsPurchased: 0, 
      thisMonthActivity: 0, 
      totalSpent: 0, 
      averageConfidence: 0 
    }
    
    // Use real purchase metrics from the API
    const totalTipsPurchased = data.dashboard.totalTipsPurchased || 0
    const thisMonthActivity = data.dashboard.thisMonthActivity || 0
    const totalSpent = data.dashboard.totalSpent || 0
    const averageConfidence = data.dashboard.averageConfidence || 0
    
    return { 
      totalTipsPurchased, 
      thisMonthActivity, 
      totalSpent, 
      averageConfidence 
    }
  }

  const metrics = calculateMetrics(data)
  
  // Memoize finalValues to prevent unnecessary re-renders
  const finalValues = useMemo(() => ({
    totalTipsPurchased: metrics.totalTipsPurchased,
    thisMonthActivity: metrics.thisMonthActivity,
    totalSpent: metrics.totalSpent,
    averageConfidence: metrics.averageConfidence,
  }), [metrics.totalTipsPurchased, metrics.thisMonthActivity, metrics.totalSpent, metrics.averageConfidence])

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
        totalTipsPurchased: Math.floor(finalValues.totalTipsPurchased * progress),
        thisMonthActivity: Math.floor(finalValues.thisMonthActivity * progress),
        totalSpent: Math.floor(finalValues.totalSpent * progress),
        averageConfidence: Math.floor(finalValues.averageConfidence * progress),
      })

      if (currentStep >= steps) {
        clearInterval(interval)
        setAnimatedValues({
          totalTipsPurchased: finalValues.totalTipsPurchased,
          thisMonthActivity: finalValues.thisMonthActivity,
          totalSpent: finalValues.totalSpent,
          averageConfidence: finalValues.averageConfidence,
        })
      }
    }, stepDuration)

    return () => clearInterval(interval)
  }, [data, finalValues])

  // Determine trend indicators based on purchase data
  const getTrendData = () => {
    if (!data) return { 
      totalTipsTrend: 'neutral', 
      monthlyTrend: 'neutral', 
      spentTrend: 'neutral', 
      confidenceTrend: 'neutral' 
    }
    
    const totalTips = finalValues.totalTipsPurchased
    const thisMonth = finalValues.thisMonthActivity
    const totalSpent = finalValues.totalSpent
    const avgConfidence = finalValues.averageConfidence
    
    return {
      totalTipsTrend: totalTips > 10 ? 'up' : totalTips > 5 ? 'neutral' : 'down',
      monthlyTrend: thisMonth > 3 ? 'up' : thisMonth > 1 ? 'neutral' : 'down',
      spentTrend: totalSpent > 50 ? 'up' : totalSpent > 20 ? 'neutral' : 'down',
      confidenceTrend: avgConfidence > 75 ? 'up' : avgConfidence > 60 ? 'neutral' : 'down'
    }
  }

  const trends = getTrendData()

  const stats = [
    {
      title: "Total Tips Purchased",
      value: animatedValues.totalTipsPurchased.toString(),
      change: trends.totalTipsTrend === 'up' ? "Active user!" : trends.totalTipsTrend === 'down' ? "Getting started" : "Building up",
      trend: trends.totalTipsTrend,
      icon: Trophy,
      color: "emerald",
      emoji: "🎯",
      description: "Tips you've purchased",
      progress: Math.min(100, (animatedValues.totalTipsPurchased / 20) * 100), // Scale to 20 max
    },
    {
      title: "This Month's Activity",
      value: animatedValues.thisMonthActivity.toString(),
      change: trends.monthlyTrend === 'up' ? "Very active!" : trends.monthlyTrend === 'down' ? "Stay engaged" : "Good progress",
      trend: trends.monthlyTrend,
      icon: TrendingUp,
      color: "blue",
      emoji: "📊",
      description: "Tips purchased this month",
      progress: Math.min(100, (animatedValues.thisMonthActivity / 10) * 100), // Scale to 10 max
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
              {finalValues.totalTipsPurchased > 15 
                ? "Excellent engagement! You're a highly active user with great tip purchasing habits. Keep up this fantastic momentum!"
                : finalValues.totalTipsPurchased > 5
                  ? "Great activity! You're building a solid foundation with your tip purchases. Consider exploring more predictions to maximize your value."
                  : finalValues.thisMonthActivity > 2
                    ? "Good monthly activity! You're staying engaged with recent purchases. Keep exploring our AI predictions for better results."
                    : "Welcome to SnapBet AI! Start purchasing tips to build your experience and discover the power of AI predictions."
              }
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}
