"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { TrendingUp, Zap, Target, Brain, Bell, Play } from "lucide-react"

export function MobileHero() {
  const [winCount, setWinCount] = useState(1247)
  const [activeUsers, setActiveUsers] = useState(2834)

  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        setWinCount((prev) => prev + 1)
      }
      if (Math.random() > 0.8) {
        setActiveUsers((prev) => prev + Math.floor(Math.random() * 3))
      }
    }, 4000)

    return () => clearInterval(interval)
  }, [])

  return (
    <section className="px-4 py-6 pb-20">
      {/* Main Hero Content */}
      <div className="text-center mb-6">
        <div className="mb-4 flex justify-center">
          <div className="relative">
            <div className="w-16 h-16 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full flex items-center justify-center animate-pulse">
              <Brain className="w-8 h-8 text-slate-900" />
            </div>
            <div className="absolute inset-0 w-16 h-16 border-2 border-emerald-400/50 rounded-full animate-ping" />
          </div>
        </div>

        <Badge className="mb-4 bg-emerald-500/20 text-emerald-400 border-emerald-500/30 animate-pulse">
          <Zap className="w-3 h-3 mr-1" />
          AI-Powered • Live Now
        </Badge>

        <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
          AI Sports
          <span className="text-emerald-400"> Tipster</span>
        </h1>

        <p className="text-slate-300 mb-6 text-sm leading-relaxed">
          Get winning predictions powered by advanced AI algorithms. Join thousands of successful bettors worldwide.
        </p>

        {/* Live Stats - Mobile Optimized */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-4 mb-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xl font-bold text-emerald-400 animate-pulse">{winCount.toLocaleString()}</div>
              <div className="text-xs text-slate-400">Wins Today</div>
            </div>
            <div>
              <div className="text-xl font-bold text-cyan-400 animate-pulse">{activeUsers.toLocaleString()}</div>
              <div className="text-xs text-slate-400">Active Users</div>
            </div>
            <div>
              <div className="text-xl font-bold text-yellow-400">87%</div>
              <div className="text-xs text-slate-400">Win Rate</div>
            </div>
          </div>
        </div>

        {/* CTA Buttons - Mobile Optimized */}
        <div className="space-y-3 mb-6">
          <Button
            size="lg"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 text-base font-semibold"
            asChild
          >
            <a href="/daily-tips">
              <TrendingUp className="w-5 h-5 mr-2" />
              Get Free Predictions
            </a>
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="w-full border-slate-600 text-slate-300 hover:bg-slate-800 py-4 text-base"
            asChild
          >
            <a href="/weekly-specials">
              <Target className="w-5 h-5 mr-2" />
              Join VIP Zone
            </a>
          </Button>
        </div>
      </div>

      {/* Featured Tip Card - Mobile Optimized */}
      <Card className="bg-slate-800/90 backdrop-blur-sm border-slate-700 p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/10 to-cyan-600/10" />

        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Bell className="w-4 h-4 text-emerald-400 animate-pulse" />
              <h3 className="text-emerald-400 font-semibold text-sm">Today's Free Tip</h3>
            </div>
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 animate-pulse text-xs">LIVE</Badge>
          </div>

          <div className="space-y-2 mb-4">
            <div className="text-white font-medium">Arsenal vs Chelsea</div>
            <div className="text-slate-300 text-sm">Over 2.5 Goals • 92% Confidence</div>
            <div className="flex items-center justify-between">
              <div className="text-emerald-400 text-sm flex items-center">
                <Brain className="w-3 h-3 mr-1" />
                AI Analysis Available
              </div>
              <div className="text-slate-400 text-xs">Odds: 1.85</div>
            </div>
          </div>

          <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
            <Play className="w-4 h-4 mr-2" />
            View Full Analysis
          </Button>
        </div>
      </Card>
    </section>
  )
}
