"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Zap, Trophy, Target, Users, Star, Sparkles, Crown, Gift, Timer, CheckCircle } from "lucide-react"
import { useUserCountry } from "@/contexts/user-country-context"

export function PayAsYouGo() {
  const { countryData, convertPrice } = useUserCountry()
  const [timeLeft, setTimeLeft] = useState({ hours: 23, minutes: 45, seconds: 30 })

  // Countdown timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 }
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: prev.minutes - 1, seconds: 59 }
        } else if (prev.hours > 0) {
          return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 }
        }
        return prev
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const payAsYouGoOptions = [
    {
      id: "single-tip",
      title: "Single Premium Tip",
      subtitle: "Perfect for testing our accuracy",
      basePrice: 150, // Base price in KES
      baseOriginalPrice: 200,
      discount: "25% OFF",
      icon: Target,
      gradient: "from-emerald-500 to-teal-600",
      features: ["1 Premium AI Prediction", "90%+ Confidence Score", "Detailed Analysis", "Instant Telegram Alert"],
      badge: "Most Popular",
      badgeColor: "bg-emerald-500",
      socialProof: "47 bought today",
      winRate: "92%",
      isPopular: true,
      urgency: false,
    },
    {
      id: "daily-bundle",
      title: "Daily Winner Bundle",
      subtitle: "3 high-confidence predictions",
      basePrice: 400,
      baseOriginalPrice: 600,
      discount: "33% OFF",
      icon: Trophy,
      gradient: "from-amber-500 to-orange-600",
      features: ["3 Premium Predictions", "85%+ Confidence Each", "Multi-league Coverage", "Priority Support"],
      badge: "Best Value",
      badgeColor: "bg-amber-500",
      socialProof: "23 bought today",
      winRate: "88%",
      isPopular: false,
      urgency: true,
    },
    {
      id: "weekend-special",
      title: "Weekend Accumulator",
      subtitle: "5-fold weekend special",
      basePrice: 800,
      baseOriginalPrice: 1200,
      discount: "33% OFF",
      icon: Crown,
      gradient: "from-purple-500 to-pink-600",
      features: ["5 Weekend Predictions", "Accumulator Strategy", "Higher Odds Package", "Expert Analysis"],
      badge: "Limited Time",
      badgeColor: "bg-purple-500",
      socialProof: "12 bought today",
      winRate: "85%",
      isPopular: false,
      urgency: true,
    },
  ]

  return (
    <section className="py-20 px-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-900/50 to-emerald-900/30" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-full mb-6">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium">Pay As You Go Options</span>
          </div>

          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            No Commitment,{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              Pure Wins
            </span>
          </h2>

          <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
            Get instant access to our AI-powered predictions without any subscription. Pay only for what you need, when
            you need it.
          </p>

          {/* Flash Sale Timer */}
          <div className="inline-flex items-center gap-4 bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 rounded-lg px-6 py-3">
            <Timer className="w-5 h-5 text-red-400" />
            <span className="text-red-400 font-medium">Flash Sale Ends In:</span>
            <div className="flex gap-2">
              <div className="bg-red-500 text-white px-2 py-1 rounded text-sm font-bold">
                {timeLeft.hours.toString().padStart(2, "0")}
              </div>
              <span className="text-red-400">:</span>
              <div className="bg-red-500 text-white px-2 py-1 rounded text-sm font-bold">
                {timeLeft.minutes.toString().padStart(2, "0")}
              </div>
              <span className="text-red-400">:</span>
              <div className="bg-red-500 text-white px-2 py-1 rounded text-sm font-bold">
                {timeLeft.seconds.toString().padStart(2, "0")}
              </div>
            </div>
          </div>
        </div>

        {/* Pay As You Go Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {payAsYouGoOptions.map((option, index) => (
            <Card
              key={option.id}
              className={`relative group bg-slate-800/50 border-slate-700 backdrop-blur-sm overflow-hidden transform transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-emerald-500/20 ${
                option.isPopular ? "ring-2 ring-emerald-500/50" : ""
              }`}
              style={{
                animationDelay: `${index * 200}ms`,
              }}
            >
              {/* Gradient Background */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${option.gradient} opacity-5 group-hover:opacity-10 transition-opacity duration-500`}
              />

              {/* Badge - Fixed positioning */}
              {option.badge && (
                <div
                  className={`absolute top-4 right-4 ${option.badgeColor} text-white px-3 py-1 rounded-full text-xs font-bold z-20`}
                >
                  {option.badge}
                </div>
              )}

              {/* Urgency Indicator - Fixed positioning */}
              {option.urgency && (
                <div className="absolute top-4 left-4 bg-red-500 text-white px-2 py-1 rounded text-xs font-bold animate-pulse z-20">
                  Only 5 left!
                </div>
              )}

              <CardContent className="p-6 relative z-10">
                {/* Icon - Fixed spacing */}
                <div
                  className={`w-16 h-16 bg-gradient-to-br ${option.gradient} rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}
                >
                  <option.icon className="w-8 h-8 text-white" />
                </div>

                {/* Title & Subtitle */}
                <h3 className="text-xl font-bold text-white mb-2">{option.title}</h3>
                <p className="text-slate-400 text-sm mb-6">{option.subtitle}</p>

                {/* Pricing - Fixed layout */}
                <div className="flex items-baseline gap-3 mb-6">
                  <span className="text-3xl font-bold text-white">{convertPrice(option.basePrice)}</span>
                  <div className="flex flex-col items-start">
                    <span className="text-slate-500 line-through text-sm">
                      {convertPrice(option.baseOriginalPrice)}
                    </span>
                    <Badge className="bg-emerald-500/20 text-emerald-400 text-xs mt-1">{option.discount}</Badge>
                  </div>
                </div>

                {/* Win Rate */}
                <div className="flex items-center gap-2 mb-6">
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span className="text-yellow-400 font-bold">{option.winRate}</span>
                    <span className="text-slate-400 text-sm">win rate</span>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-6">
                  {option.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-slate-300 text-sm">
                      <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* Social Proof */}
                <div className="flex items-center gap-2 mb-6 text-slate-400 text-xs">
                  <Users className="w-4 h-4" />
                  <span>{option.socialProof}</span>
                </div>

                {/* CTA Button */}
                <Button
                  className={`w-full bg-gradient-to-r ${option.gradient} hover:shadow-lg hover:shadow-emerald-500/25 text-white font-bold py-3 transform transition-all duration-300 hover:scale-105`}
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Buy Now - Instant Access
                </Button>
              </CardContent>

              {/* Hover Glow Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-emerald-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </Card>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-slate-800/50 border border-slate-700 rounded-lg px-6 py-4 backdrop-blur-sm">
            <Gift className="w-5 h-5 text-emerald-400" />
            <span className="text-slate-300">
              All purchases include: <span className="text-emerald-400 font-medium">Instant delivery</span> •{" "}
              <span className="text-emerald-400 font-medium">Money-back guarantee</span> •{" "}
              <span className="text-emerald-400 font-medium">24/7 support</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
