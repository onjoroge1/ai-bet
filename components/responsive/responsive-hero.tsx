"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { TrendingUp, Zap, Globe, Trophy, Target, Brain, CheckCircle, ArrowRight, Crown, BarChart3, Shield } from "lucide-react"

export function ResponsiveHero() {
  const [showNotification, setShowNotification] = useState(false)

  // Simulate live updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        setShowNotification(true)
        setTimeout(() => setShowNotification(false), 3000)
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
      {/* Soccer Player Background Image */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900">
        {/* Soccer player background image - Responsive positioning */}
        <div 
          className="absolute inset-0 bg-cover bg-no-repeat opacity-25 bg-center"
          style={{
            backgroundImage: "url('/uploads/image/footballer-bg.jpeg')",
            backgroundSize: 'cover'
          }}
        />
        {/* Overlay gradients */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(6,182,212,0.1),transparent_50%)]" />
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* AI Data Visualization Overlay - Similar to marquee example */}
      <div className="absolute inset-0 hidden md:block">
        {/* Floating data points and connections */}
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-emerald-400/40 rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 2}s`,
            }}
          />
        ))}
        
        {/* Data visualization lines */}
        {[...Array(8)].map((_, i) => (
          <div
            key={`line-${i}`}
            className="absolute h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${20 + Math.random() * 40}%`,
              transform: `rotate(${Math.random() * 360}deg)`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${3 + Math.random() * 2}s`,
            }}
          />
        ))}
        
        {/* Floating data numbers */}
        {[...Array(6)].map((_, i) => (
          <div
            key={`data-${i}`}
            className="absolute text-xs text-emerald-400/60 font-mono animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${4 + Math.random() * 2}s`,
            }}
          >
            {Math.random() > 0.5 ? `${(Math.random() * 100).toFixed(1)}%` : `${Math.floor(Math.random() * 1000)}`}
          </div>
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

      <div className="relative max-w-6xl mx-auto z-20 w-full">
        {/* AI Brain Visualization with enhanced styling */}
        <div className="mb-6 md:mb-8 flex justify-center">
          <div className="relative">
            <div className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full flex items-center justify-center animate-pulse shadow-2xl shadow-emerald-400/50">
              <Brain className="w-10 h-10 md:w-12 md:h-12 text-slate-900" />
            </div>
            <div className="absolute inset-0 w-20 h-20 md:w-24 md:h-24 border-2 border-emerald-400/50 rounded-full animate-ping" />
            <div
              className="absolute inset-0 w-20 h-20 md:w-24 md:h-24 border border-cyan-400/30 rounded-full animate-spin"
              style={{ animationDuration: "3s" }}
            />
            {/* Additional glow effect */}
            <div className="absolute inset-0 w-20 h-20 md:w-24 md:h-24 bg-emerald-400/20 rounded-full blur-xl animate-pulse" />
          </div>
        </div>

        <Badge
          variant="secondary"
          className="mb-4 md:mb-6 bg-emerald-500/20 text-emerald-400 border-emerald-500/30 animate-pulse"
        >
          <Crown className="w-3 h-3 md:w-4 md:h-4 mr-2" />
          AI-Powered Predictions • Live Now
        </Badge>

        <h1 className="text-4xl md:text-6xl lg:text-8xl font-bold text-white mb-4 md:mb-6 drop-shadow-2xl" style={{ fontSize: 'clamp(2.25rem, 5vw, 5rem)', lineHeight: '1' }}>
          Smarter Bets. <span className="text-emerald-400 bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">Sharper Insights.</span>
        </h1>

        <p className="text-lg md:text-2xl text-slate-200 mb-6 md:mb-8 max-w-5xl mx-auto leading-relaxed drop-shadow-lg">
          SnapBet is your AI-powered betting edge — we don't take bets, we make bettors smarter. 
          Get <span className="text-emerald-400 font-semibold bg-emerald-400/10 px-2 py-1 rounded">calibrated probabilities, transparent edges, and clear explanations</span> that regular odds sites can't provide.
        </p>

        {/* Key Value Propositions - Redesigned with Icons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 md:mb-12 max-w-5xl mx-auto">
          <div className="bg-slate-900/80 backdrop-blur-md border border-slate-600/50 rounded-xl p-5 text-center hover:bg-slate-800/90 transition-all duration-300 hover:scale-105 shadow-2xl">
            <div className="w-14 h-14 bg-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-500/25">
              <Brain className="w-7 h-7 text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2 drop-shadow-lg">AI-Driven Predictions</h3>
            <p className="text-sm text-slate-300">Advanced algorithms find value the sportsbooks hide</p>
          </div>
          
          <div className="bg-slate-900/80 backdrop-blur-md border border-slate-600/50 rounded-xl p-5 text-center hover:bg-slate-800/90 transition-all duration-300 hover:scale-105 shadow-2xl">
            <div className="w-14 h-14 bg-blue-500/30 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-500/25">
              <Shield className="w-7 h-7 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2 drop-shadow-lg">Confidence Before You Bet</h3>
            <p className="text-sm text-slate-300">We don't profit from your losses - only your success</p>
          </div>
          
          <div className="bg-slate-900/80 backdrop-blur-md border border-slate-600/50 rounded-xl p-5 text-center hover:bg-slate-800/90 transition-all duration-300 hover:scale-105 shadow-2xl">
            <div className="w-14 h-14 bg-purple-500/30 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-purple-500/25">
              <CheckCircle className="w-7 h-7 text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2 drop-shadow-lg">No Bets, No Risk</h3>
            <p className="text-sm text-slate-300">We don't take bets - we make your bets better</p>
          </div>
        </div>

        {/* CTA Buttons - Responsive */}
        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center mb-4 md:mb-6">
          <Button
            size="lg"
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-6 md:px-8 py-3 md:py-4 text-base md:text-lg group"
            asChild
          >
            <a href="/daily-tips">
              <Target className="w-4 h-4 md:w-5 md:h-5 mr-2 group-hover:animate-bounce" />
              Get Free Predictions
              <ArrowRight className="w-4 h-4 md:w-5 md:h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </a>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full sm:w-auto border-slate-600 text-slate-300 hover:bg-slate-800 px-6 md:px-8 py-3 md:py-4 text-base md:text-lg group"
            asChild
          >
            <a href="/weekly-specials">
              <BarChart3 className="w-4 h-4 md:w-5 md:h-5 mr-2 group-hover:animate-spin" />
              Join VIP Zone
            </a>
          </Button>
        </div>

        {/* Removed Free Tip section for better performance - can be added to dedicated pages */}
      </div>
    </section>
  )
}