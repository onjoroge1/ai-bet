"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Gift, Crown, Clock, Target, Star, CheckCircle, Trophy, Zap, Users } from "lucide-react"
import { DashboardBreadcrumb } from "@/components/dashboard-breadcrumb"

export default function WeekendSpecialPage() {
  const [timeLeft, setTimeLeft] = useState({
    hours: 23,
    minutes: 45,
    seconds: 30,
  })

  const weekendSpecials = [
    {
      id: 1,
      title: "Premier League Accumulator",
      matches: ["Man City vs Liverpool", "Arsenal vs Tottenham", "Chelsea vs Man United"],
      totalOdds: "12.5",
      confidence: 82,
      price: 350,
      originalPrice: 500,
      analysis: "Carefully selected matches with high probability outcomes",
      features: ["3 Premium Picks", "Detailed Analysis", "Live Updates", "Money Back if 0/3"],
      soldCount: 127,
      maxSales: 200,
    },
    {
      id: 2,
      title: "European Giants Special",
      matches: ["Barcelona vs Real Madrid", "Bayern vs Dortmund", "PSG vs Marseille"],
      totalOdds: "8.75",
      confidence: 88,
      price: 450,
      originalPrice: 650,
      analysis: "Top European leagues with insider analysis",
      features: ["3 VIP Picks", "Expert Commentary", "Video Analysis", "Guaranteed Profit"],
      soldCount: 89,
      maxSales: 150,
    },
    {
      id: 3,
      title: "African Football Special",
      matches: ["Al Ahly vs Zamalek", "Kaizer Chiefs vs Orlando Pirates", "Gor Mahia vs AFC Leopards"],
      totalOdds: "15.2",
      confidence: 75,
      price: 250,
      originalPrice: 400,
      analysis: "Local expertise in African football markets",
      features: ["3 Local Picks", "Cultural Insights", "Team News", "Best Value Odds"],
      soldCount: 156,
      maxSales: 250,
    },
  ]

  const testimonials = [
    {
      name: "James Mwangi",
      location: "Nairobi",
      amount: "KES 15,000",
      text: "Won big with last weekend's special! The analysis was spot on.",
      rating: 5,
    },
    {
      name: "Grace Wanjiku",
      location: "Mombasa",
      amount: "KES 8,500",
      text: "Best investment I've made. The predictions are incredibly accurate.",
      rating: 5,
    },
    {
      name: "Peter Ochieng",
      location: "Kisumu",
      amount: "KES 12,200",
      text: "Finally found reliable tips. Weekend specials never disappoint!",
      rating: 5,
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-purple-900 p-4">
      <div className="max-w-6xl mx-auto">
        <DashboardBreadcrumb />
        {/* OR */}
        {/* <DashboardNavHeader /> */}
        {/* Header with Countdown */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <Gift className="w-8 h-8 text-purple-400" />
            <h1 className="text-3xl font-bold text-white">Weekend Specials</h1>
            <Badge className="bg-red-500 text-white animate-pulse">LIMITED TIME</Badge>
          </div>

          {/* Countdown Timer */}
          <Card className="bg-gradient-to-r from-purple-600 to-pink-600 border-none mb-6">
            <CardContent className="p-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-4">⏰ Weekend Special Ends In:</h2>
                <div className="flex justify-center space-x-8">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-white">{timeLeft.hours}</div>
                    <div className="text-purple-200">Hours</div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-white">{timeLeft.minutes}</div>
                    <div className="text-purple-200">Minutes</div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-white">{timeLeft.seconds}</div>
                    <div className="text-purple-200">Seconds</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <p className="text-slate-300 text-lg text-center">
            🔥 Exclusive weekend packages with guaranteed profits and money-back guarantee!
          </p>
        </div>

        {/* Weekend Specials */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
          {weekendSpecials.map((special) => (
            <Card
              key={special.id}
              className="bg-slate-800/50 border-slate-700 hover:border-purple-500 transition-all duration-300 relative overflow-hidden"
            >
              {/* Popularity indicator */}
              <div className="absolute top-4 right-4">
                <Badge className="bg-purple-500 text-white">
                  {Math.round((special.soldCount / special.maxSales) * 100)}% Sold
                </Badge>
              </div>

              <CardHeader className="pb-3">
                <CardTitle className="text-white text-lg pr-16">{special.title}</CardTitle>
                <div className="flex items-center space-x-4">
                  <div className="text-2xl font-bold text-purple-400">KES {special.price}</div>
                  <div className="text-slate-400 line-through">KES {special.originalPrice}</div>
                  <Badge className="bg-green-500 text-white">
                    Save {Math.round(((special.originalPrice - special.price) / special.originalPrice) * 100)}%
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Progress bar for sales */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">
                      Sold: {special.soldCount}/{special.maxSales}
                    </span>
                    <span className="text-purple-400">{special.maxSales - special.soldCount} left</span>
                  </div>
                  <Progress value={(special.soldCount / special.maxSales) * 100} className="h-2 bg-slate-700" />
                </div>

                {/* Key Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-slate-700/50 rounded-lg">
                    <div className="text-emerald-400 font-bold text-lg">{special.totalOdds}</div>
                    <div className="text-slate-400 text-sm">Total Odds</div>
                  </div>
                  <div className="text-center p-3 bg-slate-700/50 rounded-lg">
                    <div className="text-yellow-400 font-bold text-lg">{special.confidence}%</div>
                    <div className="text-slate-400 text-sm">Confidence</div>
                  </div>
                </div>

                {/* Matches */}
                <div className="space-y-2">
                  <h4 className="text-white font-medium">Included Matches:</h4>
                  {special.matches.map((match, idx) => (
                    <div key={idx} className="flex items-center space-x-2 text-slate-300 text-sm">
                      <Target className="w-3 h-3 text-purple-400" />
                      <span>{match}</span>
                    </div>
                  ))}
                </div>

                {/* Features */}
                <div className="space-y-2">
                  <h4 className="text-white font-medium">What's Included:</h4>
                  {special.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center space-x-2 text-slate-300 text-sm">
                      <CheckCircle className="w-3 h-3 text-emerald-400" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white">
                  <Crown className="w-4 h-4 mr-2" />
                  Purchase Special - KES {special.price}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Success Stories */}
        <Card className="bg-slate-800/50 border-slate-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center space-x-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              <span>Weekend Winners</span>
            </CardTitle>
            <p className="text-slate-400">See what our customers won last weekend</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {testimonials.map((testimonial, index) => (
                <div key={index} className="bg-slate-700/50 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full flex items-center justify-center text-white font-bold">
                      {testimonial.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-white font-medium">{testimonial.name}</div>
                      <div className="text-slate-400 text-sm">{testimonial.location}</div>
                    </div>
                  </div>
                  <div className="text-emerald-400 font-bold text-lg mb-2">Won {testimonial.amount}</div>
                  <p className="text-slate-300 text-sm mb-3">"{testimonial.text}"</p>
                  <div className="flex space-x-1">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Why Choose Weekend Specials */}
        <Card className="bg-gradient-to-r from-emerald-600/20 to-cyan-600/20 border-emerald-500/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center space-x-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              <span>Why Weekend Specials?</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Trophy className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-white font-semibold mb-2">Higher Odds</h3>
                <p className="text-slate-300 text-sm">
                  Carefully selected accumulator bets with maximum profit potential
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-white font-semibold mb-2">Expert Analysis</h3>
                <p className="text-slate-300 text-sm">Deep research and insider knowledge from our expert team</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-white font-semibold mb-2">Money Back</h3>
                <p className="text-slate-300 text-sm">If none of our picks win, get your money back guaranteed</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-cyan-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-white font-semibold mb-2">Limited Time</h3>
                <p className="text-slate-300 text-sm">Exclusive weekend pricing available only until Sunday night</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
