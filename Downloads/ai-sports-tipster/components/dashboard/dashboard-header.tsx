"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Crown, Bell, Settings, User, TrendingUp, Zap, FlameIcon as Fire, Target } from "lucide-react"
import { useRouter } from 'next/navigation'
import { useAuth } from "@/components/auth-provider"

export function DashboardHeader() {
  const [streak, setStreak] = useState(5)
  const [showCelebration, setShowCelebration] = useState(false)
  const router = useRouter()
  const { logout } = useAuth()

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
            <h1 className="text-3xl font-bold text-white">Welcome back, James!</h1>
            {streak >= 5 && (
              <div className="animate-pulse">
                <Fire className="w-6 h-6 text-orange-400" />
              </div>
            )}
          </div>
          <p className="text-slate-300">Here's your betting performance overview</p>
          {streak >= 3 && (
            <div className="flex items-center mt-2 animate-bounce">
              <Target className="w-4 h-4 text-emerald-400 mr-1" />
              <span className="text-emerald-400 text-sm font-medium">🔥 {streak} win streak! You're on fire!</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-4 mt-4 md:mt-0">
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 animate-pulse">
            <Crown className="w-4 h-4 mr-2" />
            VIP Member
          </Badge>
          <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white relative">
            <Bell className="w-4 h-4" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full" />
          </Button>
          <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white">
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
                <User className="w-8 h-8 text-slate-900" />
              </div>
              {/* Level indicator */}
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center text-xs font-bold text-slate-900">
                7
              </div>
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg">James Kiprotich</h3>
              <p className="text-slate-400">Member since January 2024</p>
              <div className="flex items-center mt-1">
                <TrendingUp className="w-4 h-4 text-emerald-400 mr-1" />
                <span className="text-emerald-400 text-sm">+KES 45,000 this month</span>
                <Zap className="w-4 h-4 text-yellow-400 ml-2 animate-pulse" />
              </div>
            </div>
          </div>

          <div className="mt-4 md:mt-0 text-right">
            <div className="text-2xl font-bold text-white animate-pulse">KES 127,500</div>
            <div className="text-slate-400 text-sm">Total Winnings</div>
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 mt-2">
              VIP expires: Mar 15, 2024
            </Badge>

            {/* Progress bar for next level */}
            <div className="mt-2">
              <div className="text-xs text-slate-400 mb-1">Progress to Level 8</div>
              <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full animate-pulse"
                  style={{ width: "75%" }}
                />
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
