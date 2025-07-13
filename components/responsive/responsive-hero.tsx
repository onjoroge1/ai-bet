"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { TrendingUp, Zap, Globe, Trophy, Target, Brain, Bell, Play, Loader2 } from "lucide-react"

// Type for free tip data
type FreeTip = {
  id: string
  match: {
    homeTeam: string
    awayTeam: string
    league: string
    matchDate: string
    status: string
    time: string
  }
  prediction: string
  confidence: number
  odds: string
  valueRating: string
  analysis: string
  isLive: boolean
  updatedAt: string
}

// Helper function to format prediction text
const formatPrediction = (prediction: string, homeTeam: string, awayTeam: string): string => {
  switch (prediction) {
    case 'home_win':
      return `${homeTeam} Win`
    case 'away_win':
      return `${awayTeam} Win`
    case 'draw':
      return 'Draw'
    case 'over_1_5':
      return 'Over 1.5 Goals'
    case 'over_2_5':
      return 'Over 2.5 Goals'
    case 'over_3_5':
      return 'Over 3.5 Goals'
    case 'under_1_5':
      return 'Under 1.5 Goals'
    case 'under_2_5':
      return 'Under 2.5 Goals'
    case 'under_3_5':
      return 'Under 3.5 Goals'
    case 'btts':
      return 'Both Teams to Score'
    case 'btts_no':
      return 'Both Teams NOT to Score'
    default:
      return prediction.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }
}

export function ResponsiveHero() {
  const [winCount, setWinCount] = useState(1247)
  const [activeUsers, setActiveUsers] = useState(2834)
  const [showNotification, setShowNotification] = useState(false)
  const [freeTip, setFreeTip] = useState<FreeTip | null>(null)
  const [isLoadingTip, setIsLoadingTip] = useState(true)
  const [tipError, setTipError] = useState<string | null>(null)

  // Fetch today's free tip
  useEffect(() => {
    const fetchFreeTip = async () => {
      try {
        setIsLoadingTip(true)
        setTipError(null)
        
        const response = await fetch('/api/homepage/free-tip')
        const data = await response.json()
        
        if (data.success && data.data) {
          setFreeTip(data.data)
        } else {
          setTipError(data.message || 'No free tip available')
        }
      } catch (error) {
        console.error('Error fetching free tip:', error)
        setTipError('Unable to load free tip')
      } finally {
        setIsLoadingTip(false)
      }
    }

    fetchFreeTip()
  }, [])

  // Simulate live updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        setWinCount((prev) => prev + 1)
        setShowNotification(true)
        setTimeout(() => setShowNotification(false), 3000)
      }
      if (Math.random() > 0.8) {
        setActiveUsers((prev) => prev + Math.floor(Math.random() * 3))
      }
    }, 4000)

    return () => clearInterval(interval)
  }, [])

  // Notification messages for analytics company
  const notificationMessages = [
    "New Prediction Win! 87% accuracy achieved",
    "User Sarah M. saved 3 hours of research",
    "Prediction streak: 5 correct in a row!",
    "New user joined from Kenya",
    "AI model accuracy improved to 89%",
    "Premium member upgraded to VIP",
    "Daily tip accuracy: 92% today",
    "New league added: Premier League",
    "User feedback: 'Saved me hours of analysis'",
    "Prediction confidence: 94% on latest tip"
  ]

  const [currentNotification, setCurrentNotification] = useState(notificationMessages[0])

  // Update notification message when showing
  useEffect(() => {
    if (showNotification) {
      const randomMessage = notificationMessages[Math.floor(Math.random() * notificationMessages.length)]
      setCurrentNotification(randomMessage)
    }
  }, [showNotification])

  const floatingPredictions = [
    { match: "Arsenal vs Chelsea", prediction: "Over 2.5", confidence: 92, position: "top-20 left-10" },
    { match: "Man City vs Liverpool", prediction: "BTTS", confidence: 87, position: "top-32 right-16" },
    { match: "Barcelona vs Madrid", prediction: "Barca Win", confidence: 78, position: "bottom-40 left-20" },
    { match: "Bayern vs Dortmund", prediction: "U3.5 Goals", confidence: 84, position: "bottom-20 right-12" },
  ]

  return (
    <section className="relative px-4 py-12 md:py-20 text-center overflow-hidden min-h-[70vh] md:min-h-[90vh] flex items-center">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(6,182,212,0.1),transparent_50%)]" />
      </div>

      {/* Floating Particles - Hidden on mobile */}
      <div className="absolute inset-0 hidden md:block">
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

      {/* Floating Prediction Cards - Desktop only */}
      {floatingPredictions.map((pred, index) => (
        <Card
          key={index}
          className={`absolute hidden xl:block ${pred.position} bg-slate-800/80 backdrop-blur-sm border-slate-700 p-3 w-48 animate-bounce`}
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

      {/* Live Win Notification - Responsive */}
      {showNotification && (
        <div className="fixed top-20 md:top-24 right-4 z-50 animate-slide-in-right">
          <Card className="bg-emerald-600 border-emerald-500 p-3 md:p-4 text-white shadow-lg">
            <div className="flex items-center space-x-2">
              <Trophy className="w-4 h-4 md:w-5 md:h-5 text-yellow-400" />
              <div>
                <div className="font-semibold text-xs md:text-sm">Live Update!</div>
                <div className="text-xs opacity-90">{currentNotification}</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="relative max-w-6xl mx-auto z-10 w-full">
        {/* AI Brain Visualization */}
        <div className="mb-6 md:mb-8 flex justify-center">
          <div className="relative">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full flex items-center justify-center animate-pulse">
              <Brain className="w-8 h-8 md:w-10 md:h-10 text-slate-900" />
            </div>
            <div className="absolute inset-0 w-16 h-16 md:w-20 md:h-20 border-2 border-emerald-400/50 rounded-full animate-ping" />
            <div
              className="absolute inset-0 w-16 h-16 md:w-20 md:h-20 border border-cyan-400/30 rounded-full animate-spin"
              style={{ animationDuration: "3s" }}
            />
          </div>
        </div>

        <Badge
          variant="secondary"
          className="mb-4 md:mb-6 bg-emerald-500/20 text-emerald-400 border-emerald-500/30 animate-pulse"
        >
          <Zap className="w-3 h-3 md:w-4 md:h-4 mr-2" />
          AI-Powered Predictions • Live Now
        </Badge>

        <h1 className="text-3xl md:text-5xl lg:text-7xl font-bold text-white mb-4 md:mb-6">
          AI Sports
          <span className="text-emerald-400"> Tipster</span>
        </h1>

        <p className="text-base md:text-xl text-slate-300 mb-6 md:mb-8 max-w-3xl mx-auto leading-relaxed">
          Get winning predictions powered by advanced AI algorithms. Join thousands of successful bettors worldwide with
          our data-driven insights.
        </p>

        {/* Live Stats Bar - Responsive */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-4 mb-6 md:mb-8 max-w-2xl mx-auto">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xl md:text-2xl font-bold text-emerald-400 animate-pulse">
                {winCount.toLocaleString()}
              </div>
              <div className="text-xs text-slate-400">Wins Today</div>
            </div>
            <div>
              <div className="text-xl md:text-2xl font-bold text-cyan-400 animate-pulse">
                {activeUsers.toLocaleString()}
              </div>
              <div className="text-xs text-slate-400">Active Users</div>
            </div>
            <div>
              <div className="text-xl md:text-2xl font-bold text-yellow-400">AI Powered</div>
              <div className="text-xs text-slate-400">Advanced Analytics</div>
            </div>
          </div>
        </div>

        {/* CTA Buttons - Responsive */}
        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center mb-8 md:mb-12">
          <Button
            size="lg"
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-6 md:px-8 py-3 md:py-4 text-base md:text-lg group"
            asChild
          >
            <a href="/daily-tips">
              <TrendingUp className="w-4 h-4 md:w-5 md:h-5 mr-2 group-hover:animate-bounce" />
              Get Free Predictions
            </a>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full sm:w-auto border-slate-600 text-slate-300 hover:bg-slate-800 px-6 md:px-8 py-3 md:py-4 text-base md:text-lg group"
            asChild
          >
            <a href="/weekly-specials">
              <Globe className="w-4 h-4 md:w-5 md:h-5 mr-2 group-hover:animate-spin" />
              Join VIP Zone
            </a>
          </Button>
        </div>

        {/* Enhanced Free Tip Preview - Responsive */}
        <div className="relative max-w-md mx-auto">
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-600 to-cyan-600 rounded-xl blur opacity-75 animate-pulse" />
          <Card className="relative bg-slate-800/90 backdrop-blur-sm border-slate-700 p-4 md:p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-emerald-400 font-semibold text-sm md:text-base flex items-center">
                <Bell className="w-3 h-3 md:w-4 md:h-4 mr-2 animate-pulse" />
                Today's Free Tip
              </h3>
              {freeTip?.isLive && (
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30 animate-pulse text-xs">LIVE</Badge>
              )}
            </div>
            
            {isLoadingTip ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-400 mr-2" />
                <span className="text-slate-300 text-sm">Loading today's tip...</span>
              </div>
            ) : tipError ? (
              <div className="text-slate-300 text-sm py-2">
                {tipError}
              </div>
            ) : freeTip ? (
              <>
                <div className="text-white font-medium text-sm md:text-base">
                  {freeTip.match.homeTeam} vs {freeTip.match.awayTeam}
                </div>
                <div className="text-slate-300 text-sm">
                  {formatPrediction(freeTip.prediction, freeTip.match.homeTeam, freeTip.match.awayTeam)} • {freeTip.confidence}% Confidence
                </div>
                <div className="text-emerald-400 text-sm mt-2 flex items-center">
                  <Brain className="w-3 h-3 mr-1" />
                  AI Analysis: {freeTip.analysis}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    {freeTip.match.time} • {freeTip.match.league}
                  </span>
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" style={{ animationDelay: "0.2s" }} />
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" style={{ animationDelay: "0.4s" }} />
                  </div>
                </div>
              </>
            ) : (
              <div className="text-slate-300 text-sm py-2">
                Check back later for today's free tip
              </div>
            )}
          </Card>
        </div>
      </div>
    </section>
  )
}
