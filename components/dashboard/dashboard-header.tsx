"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Settings, TrendingUp, Zap, FlameIcon as Fire, Target, Loader2, Brain, Sparkles } from "lucide-react"
import { useRouter } from 'next/navigation'
import { useAuth } from "@/components/auth-provider"
import { useDashboardData } from "@/hooks/use-dashboard-data"
import { NotificationBell } from "@/components/notifications/NotificationBell"

export function DashboardHeader() {
  const [showCelebration, setShowCelebration] = useState(false)
  const router = useRouter()
  const { logout } = useAuth()
  const { data, isLoading, error } = useDashboardData()

  // Use data from API or fallback to auth user data
  const user = data?.user || null
  const dashboard = data?.dashboard || null
  const streak = user?.winStreak || 0

  useEffect(() => {
    // Simulate streak celebration
    if (streak >= 5) {
      setShowCelebration(true)
      setTimeout(() => setShowCelebration(false), 3000)
    }
  }, [streak])

  const handleSignOut = async () => {
    await logout()
    router.push("/")
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="mb-8">
        <div className="flex items-center justify-center h-32 bg-slate-800/50 rounded-lg">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <span className="ml-2 text-slate-300">Loading dashboard...</span>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="mb-8">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-400 text-sm">Failed to load dashboard data. Please refresh the page.</p>
        </div>
      </div>
    )
  }

  // Get user's first name for welcome message
  const firstName = user?.fullName?.split(' ')[0] || 'User'
  
  // Check if user has made any predictions
  const hasPredictions = dashboard?.predictionAccuracy !== '0%'
  
  // Format monthly success with trend indicator
  const monthlySuccessDisplay = dashboard?.monthlySuccess 
    ? `${dashboard.monthlySuccess} this month`
    : hasPredictions ? '0% this month' : 'Ready to follow AI predictions!'

  return (
    <div className="mb-8">
      {/* Celebration Animation */}
      {showCelebration && (
        <div className="fixed inset-0 pointer-events-none z-50">
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: "2s",
              }}
            >
              🎉
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <h1 className="text-3xl font-bold text-white">Welcome back, {firstName}!</h1>
            {streak >= 5 && (
              <div className="animate-pulse">
                <Fire className="w-6 h-6 text-orange-400" />
              </div>
            )}
          </div>
          <p className="text-slate-300">Here's your AI prediction performance overview</p>
          {streak >= 3 && (
            <div className="flex items-center mt-2 animate-bounce">
              <Target className="w-4 h-4 text-emerald-400 mr-1" />
              <span className="text-emerald-400 text-sm font-medium">🔥 {streak} successful AI predictions! You're on fire!</span>
            </div>
          )}
          {!hasPredictions && (
            <div className="flex items-center mt-2 animate-pulse">
              <Sparkles className="w-4 h-4 text-blue-400 mr-1" />
              <span className="text-blue-400 text-sm font-medium">✨ New to AI predictions? Start following our AI-powered insights!</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-4 mt-4 md:mt-0">
          <Button 
            variant="outline" 
            size="sm" 
            className="border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-white"
            onClick={() => router.push('/dashboard/matches')}
          >
            <Target className="w-4 h-4 mr-2" />
            View All Matches
          </Button>
          <NotificationBell className="text-slate-300 hover:text-white" />
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-slate-300 hover:text-white"
            onClick={() => router.push('/dashboard/settings')}
          >
            <Settings className="w-4 h-4" />
          </Button>
          <Button onClick={handleSignOut}>Sign Out</Button>
        </div>
      </div>

      {/* Enhanced Account Status Card */}
      <Card className="relative bg-slate-800/50 border-slate-700 p-6 overflow-hidden">
        {/* Animated Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-emerald-400 to-cyan-400 rounded-full blur-3xl animate-pulse" />
          <div
            className="absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full blur-3xl animate-pulse"
            style={{ animationDelay: "1s" }}
          />
        </div>

        <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="w-16 h-16 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full flex items-center justify-center animate-pulse">
                <Brain className="w-8 h-8 text-slate-900" />
              </div>
              {/* Level indicator */}
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center text-xs font-bold text-slate-900">
                {dashboard?.level || 1}
              </div>
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg">
                {user?.fullName || 'User'}
              </h3>
              <p className="text-slate-400">
                Member since {user?.memberSince || 'Recently'}
              </p>
              <div className="flex items-center mt-1">
                <TrendingUp className="w-4 h-4 text-emerald-400 mr-1" />
                <span className="text-emerald-400 text-sm">{monthlySuccessDisplay}</span>
                <Zap className="w-4 h-4 text-yellow-400 ml-2 animate-pulse" />
              </div>
            </div>
          </div>

          <div className="mt-4 md:mt-0 text-right">
            <div className="text-2xl font-bold text-white animate-pulse">
              {hasPredictions ? (dashboard?.predictionAccuracy || '0%') : 'Ready!'}
            </div>
            <div className="text-slate-400 text-sm">
              {hasPredictions ? 'AI Predictions Followed' : 'Start Following AI Predictions'}
            </div>
            {dashboard?.vipExpiryDate && (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 mt-2">
                VIP expires: {dashboard.vipExpiryDate}
              </Badge>
            )}

            {/* Progress bar for next level */}
            <div className="mt-2">
              <div className="text-xs text-slate-400 mb-1">
                {hasPredictions 
                  ? `Progress to Level ${(dashboard?.level || 1) + 1}`
                  : 'Purchase your first AI prediction!'
                }
              </div>
              <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full animate-pulse"
                  style={{ width: `${dashboard?.progressToNextLevel || 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
