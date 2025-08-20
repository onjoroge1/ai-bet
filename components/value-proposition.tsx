"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Brain, 
  Target, 
  TrendingUp, 
  Shield, 
  Zap, 
  Globe, 
  BarChart3, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  ArrowRight,
  Crown,
  Users,
  Award
} from "lucide-react"

export function ValueProposition() {
  const valuePillars = [
    {
      icon: Brain,
      title: "True Probabilities, Not Just Prices",
      description: "We convert multi-book odds into fair, margin-free probabilities and calibrate them per league. Users see P(Home/Draw/Away) that actually sums to 100% and tracks reality.",
      features: ["Margin-free calculations", "League-specific calibration", "Real probability tracking"],
      color: "from-emerald-500 to-teal-600"
    },
    {
      icon: BarChart3,
      title: "Market-Level Consensus",
      description: "We blend quotes from many books at consistent horizons (T-72/T-48/T-24). This reduces single-book noise and exposes market disagreement—useful signal most sites hide.",
      features: ["Multi-book aggregation", "Time-consistent horizons", "Market dispersion analysis"],
      color: "from-blue-500 to-indigo-600"
    },
    {
      icon: Target,
      title: "Actionable Edge & EV",
      description: "We compute expected value (EV) by comparing our calibrated probabilities to the user's actual book price. Users instantly see which side has an edge and by how much.",
      features: ["Real-time EV calculation", "Edge identification", "Value quantification"],
      color: "from-purple-500 to-pink-600"
    },
    {
      icon: Clock,
      title: "Timing Intelligence (CLV-aware)",
      description: "We track Closing Line Value to learn when edges usually hold or fade in each league. Users get timing guidance, not just a static pre-match snapshot.",
      features: ["CLV tracking", "Timing guidance", "League-specific patterns"],
      color: "from-orange-500 to-red-600"
    },
    {
      icon: Zap,
      title: "Clear, Honest Explanations",
      description: "GPT-4 explains the prediction using injuries, news, recent form, H2H—context that odds sites don't digest. Explanations never distort the probabilities.",
      features: ["AI-powered analysis", "Context-rich insights", "Transparent reasoning"],
      color: "from-yellow-500 to-orange-600"
    },
    {
      icon: Shield,
      title: "Transparency & Trust",
      description: "Every prediction includes method, n_books, dispersion, has_pinnacle, horizon, and calibration status. We publish verification reports on frozen 'Truth Sets.'",
      features: ["Full transparency", "Verification reports", "Method disclosure"],
      color: "from-cyan-500 to-blue-600"
    }
  ]

  const comparisonTable = [
    {
      feature: "Shows multiple books",
      regularSite: true,
      snapbet: true,
      highlight: false
    },
    {
      feature: "Margin-free probabilities",
      regularSite: false,
      snapbet: true,
      highlight: true
    },
    {
      feature: "Market consensus & dispersion",
      regularSite: false,
      snapbet: true,
      highlight: true
    },
    {
      feature: "Edge/EV vs your book",
      regularSite: false,
      snapbet: true,
      highlight: true
    },
    {
      feature: "Timing guidance (CLV)",
      regularSite: false,
      snapbet: true,
      highlight: true
    },
    {
      feature: "Explanations (injuries/news/form)",
      regularSite: false,
      snapbet: true,
      highlight: true
    },
    {
      feature: "Verification reports",
      regularSite: false,
      snapbet: true,
      highlight: true
    },
    {
      feature: "Risk tools & stake sizing",
      regularSite: false,
      snapbet: true,
      highlight: true
    }
  ]

  return (
    <section className="py-20 px-4 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(16,185,129,0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(6,182,212,0.1),transparent_50%)]" />
      </div>

      <div className="relative max-w-7xl mx-auto z-10">
        {/* Hero Value Proposition */}
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-6 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
            <Crown className="w-4 h-4 mr-2" />
            SnapBet vs Regular Odds Sites
          </Badge>
          
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
            We Don't Just Show Odds
          </h2>
          
          <p className="text-xl md:text-2xl text-slate-300 mb-8 max-w-4xl mx-auto leading-relaxed">
            We turn the entire betting market and team context into <span className="text-emerald-400 font-semibold">calibrated probabilities, transparent edges, and clear explanations</span>—so users know <span className="text-white font-semibold">what the bet is, why it's priced that way, and when it's worth it</span>.
          </p>

          {/* Key Differentiator */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 md:p-8 max-w-3xl mx-auto mb-8">
            <div className="flex items-center justify-center space-x-4 mb-4">
              <AlertTriangle className="w-8 h-8 text-red-400" />
              <h3 className="text-2xl font-bold text-white">The House Always Wins</h3>
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <p className="text-xl text-emerald-400 font-semibold">SnapBet Wants You to Win Too</p>
            <p className="text-slate-300 mt-2">
              Unlike FanDuel, DraftKings, or Bet365, we don't profit from your losses. Our only goal is to help you place smarter, informed bets.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 text-lg group">
              <Target className="w-5 h-5 mr-2 group-hover:animate-bounce" />
              Get Your Free Daily Picks
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button size="lg" variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800 px-8 py-4 text-lg">
              <BarChart3 className="w-5 h-5 mr-2" />
              See Today's AI Predictions
            </Button>
          </div>
        </div>

        {/* Value Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {valuePillars.map((pillar, index) => (
            <Card key={index} className="bg-slate-800/50 border-slate-700 hover:bg-slate-800/70 transition-all duration-300 hover:scale-105">
              <CardHeader className="pb-4">
                <div className={`w-12 h-12 bg-gradient-to-r ${pillar.color} rounded-lg flex items-center justify-center mb-4`}>
                  <pillar.icon className="w-6 h-6 text-white" />
                </div>
                <CardTitle className="text-white text-lg">{pillar.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-300 mb-4 leading-relaxed">{pillar.description}</p>
                <ul className="space-y-2">
                  {pillar.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center text-sm text-slate-400">
                      <CheckCircle className="w-4 h-4 text-emerald-400 mr-2 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Complementary Positioning */}
        <div className="bg-gradient-to-r from-slate-800/50 to-emerald-900/30 border border-slate-700 rounded-2xl p-8 mb-16">
          <div className="text-center">
            <Globe className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-white mb-4">Already Using FanDuel, DraftKings, or Bet365?</h3>
            <p className="text-xl text-slate-300 mb-6">
              SnapBet plugs right in. Get the insights here, then place your bets wherever you want.
            </p>
            <p className="text-lg text-emerald-400 font-semibold">
              We're your essential companion to sportsbooks, not a competitor.
            </p>
          </div>
        </div>

        {/* Feature Comparison Table */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8">
          <div className="text-center mb-8">
            <h3 className="text-3xl font-bold text-white mb-4">SnapBet vs Regular Odds Sites</h3>
            <p className="text-slate-300">See the difference that AI-powered insights make</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-4 px-4 text-slate-300 font-semibold">Feature</th>
                  <th className="text-center py-4 px-4 text-slate-300 font-semibold">Regular Odds Site</th>
                  <th className="text-center py-4 px-4 text-emerald-400 font-semibold">SnapBet AI</th>
                </tr>
              </thead>
              <tbody>
                {comparisonTable.map((row, index) => (
                  <tr key={index} className={`border-b border-slate-700/50 ${row.highlight ? 'bg-emerald-900/20' : ''}`}>
                    <td className="py-4 px-4 text-white font-medium">{row.feature}</td>
                    <td className="py-4 px-4 text-center">
                      {row.regularSite ? (
                        <CheckCircle className="w-5 h-5 text-green-400 mx-auto" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-red-400 mx-auto" />
                      )}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {row.snapbet ? (
                        <div className="flex items-center justify-center">
                          <CheckCircle className="w-5 h-5 text-emerald-400 mr-2" />
                          {row.highlight && (
                            <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">Premium</Badge>
                          )}
                        </div>
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-red-400 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <h3 className="text-2xl font-bold text-white mb-4">Ready to Get the Edge?</h3>
          <p className="text-slate-300 mb-6 max-w-2xl mx-auto">
            Join thousands of successful bettors who use SnapBet to make smarter decisions. 
            Get your free daily picks and start winning more consistently.
          </p>
          <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 text-lg">
            <TrendingUp className="w-5 h-5 mr-2" />
            Start Winning Today
          </Button>
        </div>
      </div>
    </section>
  )
}
