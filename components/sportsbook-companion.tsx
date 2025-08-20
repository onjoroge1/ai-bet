"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Globe, 
  ArrowRight, 
  CheckCircle, 
  Zap, 
  Target, 
  BarChart3,
  Shield,
  Users
} from "lucide-react"

export function SportsbookCompanion() {
  const sportsbooks = [
    { name: "FanDuel", logo: "🎯", color: "from-blue-500 to-purple-600" },
    { name: "DraftKings", logo: "👑", color: "from-yellow-500 to-orange-600" },
    { name: "Bet365", logo: "🌍", color: "from-green-500 to-emerald-600" },
    { name: "Caesars", logo: "🏛️", color: "from-purple-500 to-pink-600" },
    { name: "BetMGM", logo: "🎰", color: "from-red-500 to-pink-600" },
    { name: "PointsBet", logo: "📊", color: "from-indigo-500 to-blue-600" },
  ]

  const benefits = [
    {
      icon: Target,
      title: "Get the Edge Here",
      description: "Use SnapBet to find value bets and analyze opportunities",
      color: "text-emerald-400"
    },
    {
      icon: ArrowRight,
      title: "Place Bets There",
      description: "Take your insights to your preferred sportsbook",
      color: "text-blue-400"
    },
    {
      icon: CheckCircle,
      title: "Win More Often",
      description: "Better analysis leads to better betting decisions",
      color: "text-purple-400"
    }
  ]

  return (
    <section className="py-16 px-4 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_70%,rgba(16,185,129,0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(6,182,212,0.1),transparent_50%)]" />
      </div>

      <div className="relative max-w-6xl mx-auto z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4 bg-blue-500/20 text-blue-400 border-blue-500/30">
            <Globe className="w-4 h-4 mr-2" />
            Works With All Sportsbooks
          </Badge>
          
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            SnapBet + Your Sportsbook = Winning Combination
          </h2>
          
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            We're your essential companion to sportsbooks, not a competitor. 
            Get the insights here, then place your bets wherever you want.
          </p>
        </div>

        {/* Sportsbook Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-12">
          {sportsbooks.map((sportsbook, index) => (
            <Card key={index} className="bg-slate-800/50 border-slate-700 hover:bg-slate-800/70 transition-all duration-300 hover:scale-105">
              <CardContent className="p-4 text-center">
                <div className={`w-12 h-12 bg-gradient-to-r ${sportsbook.color} rounded-lg flex items-center justify-center mx-auto mb-3 text-2xl`}>
                  {sportsbook.logo}
                </div>
                <div className="text-white font-medium text-sm">{sportsbook.name}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* How It Works */}
        <div className="bg-gradient-to-r from-slate-800/50 to-emerald-900/30 border border-slate-700 rounded-2xl p-8 mb-12">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-white mb-4">How the Partnership Works</h3>
            <p className="text-slate-300">SnapBet provides the intelligence, your sportsbook handles the betting</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {benefits.map((benefit, index) => (
              <div key={index} className="text-center">
                <div className={`w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4`}>
                  <benefit.icon className={`w-8 h-8 ${benefit.color}`} />
                </div>
                <h4 className="text-white font-semibold mb-2">{benefit.title}</h4>
                <p className="text-slate-400 text-sm">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Key Benefits */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Shield className="w-5 h-5 mr-2 text-emerald-400" />
                No Conflict of Interest
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-300 mb-4">
                Unlike sportsbooks that profit from your losses, SnapBet only succeeds when you win. 
                Our AI is designed to find value, not to balance the books.
              </p>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-emerald-400 mr-2 flex-shrink-0" />
                  No hidden margins or inflated odds
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-emerald-400 mr-2 flex-shrink-0" />
                  Transparent probability calculations
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-emerald-400 mr-2 flex-shrink-0" />
                  Honest value assessments
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Zap className="w-5 h-5 mr-2 text-blue-400" />
                Enhanced Betting Experience
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-300 mb-4">
                Use SnapBet's AI insights to make better decisions, then enjoy the seamless 
                betting experience your preferred sportsbook provides.
              </p>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-blue-400 mr-2 flex-shrink-0" />
                  Better odds analysis and comparison
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-blue-400 mr-2 flex-shrink-0" />
                  AI-powered value identification
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-blue-400 mr-2 flex-shrink-0" />
                  Risk assessment and bankroll management
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <h3 className="text-2xl font-bold text-white mb-4">Ready to Get the Best of Both Worlds?</h3>
          <p className="text-slate-300 mb-6 max-w-2xl mx-auto">
            Start with SnapBet's free daily picks, analyze the value, then place your bets 
            at your favorite sportsbook with confidence.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 text-lg">
              <Target className="w-5 h-5 mr-2" />
              Get Free Daily Picks
            </Button>
            <Button size="lg" variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800 px-8 py-4 text-lg">
              <BarChart3 className="w-5 h-5 mr-2" />
              Learn How It Works
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
