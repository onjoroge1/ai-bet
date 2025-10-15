"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { TrendingUp, Zap, Globe, Trophy, Target, Brain, Bell } from "lucide-react"

export function HeroSection() {
  const [predictionsCount, setPredictionsCount] = useState(450)
  const [clvCount, setClvCount] = useState(1000)
  const [showNotification, setShowNotification] = useState(false)

  // Simulate live updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        setPredictionsCount((prev) => prev + 1)
        setShowNotification(true)
        setTimeout(() => setShowNotification(false), 3000)
      }
      if (Math.random() > 0.8) {
        setClvCount((prev) => prev + Math.floor(Math.random() * 2))
      }
    }, 4000)

    return () => clearInterval(interval)
  }, [])

  const floatingPredictions = [
    { match: "Arsenal vs Chelsea", prediction: "Over 2.5", confidence: 92, position: "top-20 left-10" },
    { match: "Man City vs Liverpool", prediction: "BTTS", confidence: 87, position: "top-32 right-16" },
    { match: "Barcelona vs Madrid", prediction: "Barca Win", confidence: 78, position: "bottom-40 left-20" },
    { match: "Bayern vs Dortmund", prediction: "U3.5 Goals", confidence: 84, position: "bottom-20 right-12" },
  ]

  return (
    <section className="relative px-4 py-20 text-center overflow-hidden min-h-[90vh] flex items-center">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(6,182,212,0.1),transparent_50%)]" />
      </div>

      {/* Floating Particles */}
      <div className="absolute inset-0">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-emerald-400/30 rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      {/* Floating Prediction Cards */}
      {floatingPredictions.map((pred, index) => (
        <Card
          key={index}
          className={`absolute hidden lg:block ${pred.position} bg-slate-800/80 backdrop-blur-sm border-slate-700 p-3 w-48 animate-bounce`}
          style={{
            animationDelay: `${index * 0.5}s`,
            animationDuration: "3s",
          }}
        >
          <div className="text-xs text-slate-300 mb-1">{pred.match}</div>
          <div className="text-sm font-semibold text-white">{pred.prediction}</div>
          <div className="flex items-center justify-between mt-2">
            <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">{pred.confidence}%</Badge>
            <Target className="w-3 h-3 text-emerald-400" />
          </div>
        </Card>
      ))}

      {/* Live Win Notification */}
      {showNotification && (
        <div className="fixed top-24 right-4 z-50 animate-slide-in-right">
          <Card className="bg-emerald-600 border-emerald-500 p-4 text-white shadow-lg">
            <div className="flex items-center space-x-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              <div>
                <div className="font-semibold text-sm">New Win!</div>
                <div className="text-xs opacity-90">James K. won KES 15,000</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="relative max-w-6xl mx-auto z-10">
        {/* AI Brain Visualization */}
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="w-20 h-20 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full flex items-center justify-center animate-pulse">
              <Brain className="w-10 h-10 text-slate-900" />
            </div>
            <div className="absolute inset-0 w-20 h-20 border-2 border-emerald-400/50 rounded-full animate-ping" />
            <div
              className="absolute inset-0 w-20 h-20 border border-cyan-400/30 rounded-full animate-spin"
              style={{ animationDuration: "3s" }}
            />
          </div>
        </div>

        <Badge
          variant="secondary"
          className="mb-6 bg-emerald-500/20 text-emerald-400 border-emerald-500/30 animate-pulse"
        >
          <Zap className="w-4 h-4 mr-2" />
          AI-Powered Predictions • Live Now
        </Badge>

        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
          AI Sports
          <span className="text-emerald-400"> Tipster</span>
        </h1>

        <p className="text-xl text-slate-300 mb-8 max-w-3xl mx-auto">
          Get winning predictions powered by advanced AI algorithms. Join thousands of successful bettors worldwide with
          our data-driven insights.
        </p>

        {/* Live Stats Bar */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-4 mb-8 max-w-2xl mx-auto">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-emerald-400 animate-pulse">{predictionsCount.toLocaleString()}</div>
              <div className="text-xs text-slate-400">AI Predictions This Week</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-cyan-400 animate-pulse">{clvCount.toLocaleString()}</div>
              <div className="text-xs text-slate-400">CLV Opportunities</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-400">87%</div>
              <div className="text-xs text-slate-400">AI Accuracy</div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 text-lg group" asChild>
            <a href="/daily-tips">
              <TrendingUp className="w-5 h-5 mr-2 group-hover:animate-bounce" />
              Get Free Predictions
            </a>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-slate-600 text-slate-300 hover:bg-slate-800 px-8 py-4 text-lg group"
            asChild
          >
            <a href="/weekly-specials">
              <Globe className="w-5 h-5 mr-2 group-hover:animate-spin" />
              Join VIP Zone
            </a>
          </Button>
        </div>

        {/* Enhanced Free Tip Preview */}
        <div className="relative max-w-md mx-auto">
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-600 to-cyan-600 rounded-xl blur opacity-75 animate-pulse" />
          <Card className="relative bg-slate-800/90 backdrop-blur-sm border-slate-700 p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-emerald-400 font-semibold flex items-center">
                <Bell className="w-4 h-4 mr-2 animate-pulse" />
                Today's Free Tip
              </h3>
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 animate-pulse">LIVE</Badge>
            </div>
            <div className="text-white font-medium">Arsenal vs Chelsea</div>
            <div className="text-slate-300 text-sm">Over 2.5 Goals • 85% Confidence</div>
            <div className="text-emerald-400 text-sm mt-2 flex items-center">
              <Brain className="w-3 h-3 mr-1" />
              AI Analysis: High-scoring teams, weak defenses
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-slate-400">Updated 2 min ago</span>
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" style={{ animationDelay: "0.2s" }} />
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" style={{ animationDelay: "0.4s" }} />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  )
}
