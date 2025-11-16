"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Brain, 
  TrendingUp, 
  Target, 
  Zap, 
  Shield, 
  Clock, 
  Star, 
  CheckCircle, 
  BarChart3,
  Trophy,
  Users,
  ArrowRight,
  PlayCircle,
  Activity,
  DollarSign,
  Timer,
  Sparkles,
  Crown,
  Calculator,
  RefreshCw,
  Eye,
  LineChart
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"

interface Feature {
  icon: JSX.Element
  title: string
  description: string
  highlight?: string
}

interface Stat {
  value: string
  label: string
  trend?: string
  color: string
}

interface Testimonial {
  name: string
  role: string
  content: string
  rating: number
  avatar?: string
}

interface MatchExperience {
  icon: JSX.Element
  title: string
  description: string
  outcomes: string[]
  badge: string
}

interface ClvEvidence {
  league: string
  market: string
  clv: string
  ev: string
  confidence: number
  outcome: string
}

interface ValueStack {
  tier: string
  persona: string
  avgClv: string
  retention: string
  activation: string
}

export default function SalesPage() {
  const router = useRouter()
  const { isAuthenticated } = useAuth()
  const [liveStats, setLiveStats] = useState({
    activeOpportunities: 47,
    avgConfidence: 82,
    liveMatches: 23
  })

  // Simulate live stats updates
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveStats(prev => ({
        activeOpportunities: prev.activeOpportunities + Math.floor(Math.random() * 5) - 2,
        avgConfidence: Math.max(75, Math.min(95, prev.avgConfidence + Math.floor(Math.random() * 3) - 1)),
        liveMatches: prev.liveMatches + Math.floor(Math.random() * 3) - 1
      }))
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  const handleCTAClick = (source: string) => {
    if (isAuthenticated) {
      router.push('/dashboard')
    } else {
      router.push(`/signup?source=${source}`)
    }
  }

  const keyFeatures: Feature[] = [
    {
      icon: <Activity className="h-8 w-8 text-emerald-400" />,
      title: "Real-time CLV Tracker",
      description: "Monitor Closing Line Value opportunities as they happen. Get confidence scores, Kelly stake recommendations, and optimal bet sizing.",
      highlight: "🎯 Just Released"
    },
    {
      icon: <Brain className="h-8 w-8 text-blue-400" />,
      title: "AI-Powered Predictions",
      description: "Advanced machine learning algorithms analyze thousands of data points to generate predictions with 70-95% confidence scores.",
      highlight: "🧠 ML-Driven"
    },
    {
      icon: <Calculator className="h-8 w-8 text-purple-400" />,
      title: "Kelly Criterion Staking",
      description: "Automatically calculate optimal bet sizes using the Kelly Criterion. Half-Kelly recommendations for risk management.",
      highlight: "📊 Bankroll Optimization"
    },
    {
      icon: <LineChart className="h-8 w-8 text-orange-400" />,
      title: "Value Rating System",
      description: "Every prediction comes with a value rating (Low, Medium, High, Very High) to help you prioritize the best opportunities.",
      highlight: "💎 Value-Based Betting"
    },
    {
      icon: <RefreshCw className="h-8 w-8 text-teal-400" />,
      title: "Live Data Updates",
      description: "Real-time match data, odds tracking, and opportunity alerts. Never miss a value bet with 30-second refresh cycles.",
      highlight: "⚡ Real-time Updates"
    },
    {
      icon: <Shield className="h-8 w-8 text-red-400" />,
      title: "Risk Management Tools",
      description: "Built-in risk controls, confidence thresholds, and stake limits to protect your bankroll while maximizing returns.",
      highlight: "🛡️ Bankroll Protection"
    }
  ]

  const platformStats: Stat[] = [
    { value: "87%", label: "Average Prediction Accuracy", color: "text-emerald-400" },
    { value: "2.3x", label: "Average ROI Improvement", trend: "+23% this month", color: "text-blue-400" },
    { value: "1000+", label: "CLV Opportunities", trend: "Value opportunities identified", color: "text-purple-400" },
    { value: "450", label: "AI Predictions This Week", trend: "Soccer predictions generated", color: "text-orange-400" }
  ]

  const testimonials: Testimonial[] = [
    {
      name: "Marcus Johnson",
      role: "Professional Bettor",
      content: "The CLV tracker changed everything for me. I can now identify value bets in real-time and my ROI has increased by 340% since joining.",
      rating: 5
    },
    {
      name: "Sarah Chen",
      role: "Sports Analyst",
      content: "Finally, a platform that combines AI predictions with proper bankroll management. The confidence scores and Kelly staking are game-changers.",
      rating: 5
    },
    {
      name: "David Rodriguez",
      role: "Recreational Bettor",
      content: "I went from losing money to consistent profits. The AI predictions are incredibly accurate and the value ratings help me pick the best bets.",
      rating: 5
    }
  ]

  const matchExperiences: MatchExperience[] = [
    {
      icon: <Zap className="h-8 w-8 text-emerald-400" />,
      title: "Live Match Command Center",
      description:
        "Follow every possession with instant odds, momentum swings, and automated recalculations streamed directly into `/matches/[id]` while the action unfolds.",
      outcomes: [
        "WebSocket-powered score, odds, and momentum tracking",
        "Realtime Advanced Markets: totals, handicaps, BTTS, and Kelly stakes",
        "CLV meter updates every 30 seconds to confirm your edge"
      ],
      badge: "Live"
    },
    {
      icon: <Timer className="h-8 w-8 text-blue-400" />,
      title: "Upcoming Match Blueprint",
      description:
        "Lock in value before kickoff with AI previews, consensus odds, and purchase prompts that surface premium insights exactly when you need them.",
      outcomes: [
        "Tiered AI analysis (V1 vs V2) with value ratings and risk tags",
        "Kelly-ready staking guidance sourced from prediction models",
        "Purchase gating tied to QuickPurchase inventory and locale pricing"
      ],
      badge: "Upcoming"
    },
    {
      icon: <CheckCircle className="h-8 w-8 text-purple-400" />,
      title: "Completed Match Intelligence",
      description:
        "Replay every decision with post-match EV analysis, CLV deltas, and result-aware insights that compound your long-term edge.",
      outcomes: [
        "Automatic settlement data synchronized with prediction history",
        "CLV vs closing price comparisons to validate strategy",
        "Archived premium analysis for bankroll retrospectives"
      ],
      badge: "Completed"
    }
  ]

  const clvEvidence: ClvEvidence[] = [
    {
      league: "Premier League",
      market: "Over 2.5 Goals",
      clv: "+8.4%",
      ev: "+3.9%",
      confidence: 91,
      outcome: "Win"
    },
    {
      league: "Serie A",
      market: "Asian Handicap -1.0",
      clv: "+6.1%",
      ev: "+2.5%",
      confidence: 86,
      outcome: "Push"
    },
    {
      league: "MLS",
      market: "BTTS Yes",
      clv: "+9.7%",
      ev: "+4.6%",
      confidence: 94,
      outcome: "Win"
    },
    {
      league: "LaLiga 2",
      market: "Match Winner",
      clv: "+5.3%",
      ev: "+2.1%",
      confidence: 83,
      outcome: "Win"
    }
  ]

  const valueStack: ValueStack[] = [
    {
      tier: "Free Visitor",
      persona: "Exploring odds and fixtures",
      avgClv: "—",
      retention: "1.4 sessions",
      activation: "Homepage odds tables"
    },
    {
      tier: "Registered User",
      persona: "Testing AI predictions",
      avgClv: "$142",
      retention: "3.6 sessions",
      activation: "Dashboard matches, email alerts"
    },
    {
      tier: "QuickPurchase Buyer",
      persona: "Buying match insights",
      avgClv: "$287",
      retention: "6.2 sessions",
      activation: "Match detail upsells, CLV tracker"
    },
    {
      tier: "VIP Subscriber",
      persona: "High-volume bettor",
      avgClv: "$512",
      retention: "11.3 sessions",
      activation: "Live CLV, premium models, concierge"
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900">
      
      {/* Hero Section */}
      <section className="relative overflow-hidden py-12 sm:py-20 lg:py-32">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-blue-500/10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 mb-4 sm:mb-6 text-xs sm:text-sm px-3 sm:px-4 py-1 sm:py-2">
            🎯 Real-time CLV Tracker Now Available
          </Badge>
          
          <h1 className="text-3xl sm:text-4xl lg:text-6xl xl:text-7xl font-bold text-white mb-4 sm:mb-6">
            AI-Powered Sports
            <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
              Betting Intelligence
            </span>
          </h1>
          
          <p className="text-lg sm:text-xl lg:text-2xl text-slate-300 mb-6 sm:mb-8 max-w-4xl mx-auto leading-relaxed px-2 sm:px-0">
            Join 15,000+ successful bettors using our advanced AI predictions, real-time CLV tracking, 
            and Kelly criterion staking to maximize returns while minimizing risk.
          </p>

          {/* Live Stats Banner */}
          <div className="bg-slate-800/60 border border-slate-600/50 rounded-xl p-6 mb-8 backdrop-blur-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-400 flex items-center justify-center">
                  <Activity className="h-5 w-5 mr-2 animate-pulse" />
                  {liveStats.activeOpportunities}
                </div>
                <div className="text-slate-400 text-sm">Live CLV Opportunities</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">
                  {liveStats.avgConfidence}%
                </div>
                <div className="text-slate-400 text-sm">Average Confidence Score</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">
                  {liveStats.liveMatches}
                </div>
                <div className="text-slate-400 text-sm">Matches Being Tracked</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center max-w-md sm:max-w-none mx-auto">
            <Button 
              size="lg" 
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg w-full sm:w-auto"
              onClick={() => handleCTAClick('hero_primary')}
            >
              <Zap className="h-5 w-5 sm:h-6 sm:w-6 mr-2" />
              Start Free Trial
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-slate-600 text-white hover:bg-slate-800 px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg w-full sm:w-auto"
              onClick={() => router.push('/matches')}
            >
              <Eye className="h-5 w-5 sm:h-6 sm:w-6 mr-2" />
              View Live Predictions
            </Button>
          </div>
        </div>
      </section>

      {/* Platform Stats */}
      <section className="py-12 sm:py-16 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
            {platformStats.map((stat, index) => (
              <Card key={index} className="bg-slate-800/60 border-slate-600/50 text-center p-4 sm:p-6">
                <div className={`text-2xl sm:text-3xl lg:text-4xl font-bold ${stat.color} mb-1 sm:mb-2`}>
                  {stat.value}
                </div>
                <div className="text-slate-400 mb-1 text-sm sm:text-base">{stat.label}</div>
                {stat.trend && (
                  <div className="text-emerald-400 text-xs sm:text-sm">{stat.trend}</div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="py-12 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6">
              Advanced Betting Tools
            </h2>
            <p className="text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto px-2 sm:px-0">
              Professional-grade features that give you the edge over bookmakers and the market
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {keyFeatures.map((feature, index) => (
              <Card key={index} className="bg-slate-800/60 border-slate-600/50 hover:border-slate-500/70 hover:bg-slate-800/70 transition-all duration-300 p-4 sm:p-6">
                <CardHeader className="pb-3 sm:pb-4">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    {feature.icon}
                    {feature.highlight && (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                        {feature.highlight}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-white text-lg sm:text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-400 leading-relaxed text-sm sm:text-base">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CLV Tracker Spotlight */}
      <section className="py-12 sm:py-20 bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border-y border-slate-600/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 mb-4 sm:mb-6">
                🎯 New Feature
              </Badge>
              <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-4 sm:mb-6">
                Real-time CLV Tracker
              </h3>
              <p className="text-lg sm:text-xl text-slate-300 mb-6 sm:mb-8 leading-relaxed">
                Monitor Closing Line Value opportunities as they happen. Our advanced algorithm tracks odds movements 
                across multiple bookmakers and alerts you to profitable betting opportunities in real-time.
              </p>
              
              <div className="space-y-4 mb-8">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-emerald-400 mr-3 flex-shrink-0" />
                  <span className="text-slate-200">30-second auto-refresh with live data</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-emerald-400 mr-3 flex-shrink-0" />
                  <span className="text-slate-200">Confidence scoring (0-100) based on EV%</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-emerald-400 mr-3 flex-shrink-0" />
                  <span className="text-slate-200">Kelly criterion stake recommendations</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-emerald-400 mr-3 flex-shrink-0" />
                  <span className="text-slate-200">Time window filtering (72h, 48h, 24h)</span>
                </div>
              </div>

              <Button 
                size="lg" 
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3"
                onClick={() => handleCTAClick('clv_spotlight')}
              >
                <Activity className="h-5 w-5 mr-2" />
                Try CLV Tracker Free
              </Button>
            </div>

            <div className="relative">
              <Card className="bg-slate-800/80 border-slate-600/50 backdrop-blur-sm overflow-hidden">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center">
                      <Activity className="h-5 w-5 text-emerald-400 mr-2" />
                      CLV Opportunities
                    </CardTitle>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 animate-pulse">
                      Live
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="bg-slate-700/50 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="text-white font-medium">Barcelona vs Real Madrid</div>
                          <div className="text-slate-400 text-sm">LaLiga • Match Winner</div>
                        </div>
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                          92% Confidence
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="text-sm text-slate-400">CLV: +8.5% • EV: +4.2%</div>
                        <div className="text-emerald-400 font-medium">Kelly: 2.1%</div>
                      </div>
                    </div>

                    <div className="bg-slate-700/50 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="text-white font-medium">Man City vs Liverpool</div>
                          <div className="text-slate-400 text-sm">Premier League • Over 2.5</div>
                        </div>
                        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                          78% Confidence
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="text-sm text-slate-400">CLV: +5.2% • EV: +2.8%</div>
                        <div className="text-yellow-400 font-medium">Kelly: 1.4%</div>
                      </div>
                    </div>

                    <div className="bg-slate-700/50 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="text-white font-medium">Bayern vs Dortmund</div>
                          <div className="text-slate-400 text-sm">Bundesliga • BTTS Yes</div>
                        </div>
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                          85% Confidence
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="text-sm text-slate-400">CLV: +6.8% • EV: +3.5%</div>
                        <div className="text-emerald-400 font-medium">Kelly: 1.8%</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CLV ROI Snapshot */}
      <section className="py-12 sm:py-20 bg-slate-900/70 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8 sm:space-y-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 mb-4 md:mb-6">
                CLV Evidence
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold text-white flex items-center gap-3">
                <TrendingUp className="h-7 w-7 text-emerald-400" />
                Real Bets, Real Value Capture
              </h2>
              <p className="text-slate-300 text-base sm:text-lg max-w-3xl mt-3">
                Sample of the last 24-hour opportunities surfaced by the CLV dashboard. Every entry includes the
                implied edge, Kelly-ready EV, and actual settlement to prove confidence scores translate to bankroll growth.
              </p>
            </div>
            <div className="flex flex-col gap-3 text-sm sm:text-base text-slate-200">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-400" />
                Avg stake suggested: <span className="font-semibold text-white">1.8% Half-Kelly</span>
              </div>
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-400" />
                Win rate at ≥80% confidence band: <span className="font-semibold text-white">72%</span>
              </div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-400" />
                CLV uplift vs. market closing price: <span className="font-semibold text-white">+7.4% avg</span>
              </div>
            </div>
          </div>

          <Card className="bg-slate-800/70 border-slate-600/50 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2 text-lg sm:text-xl">
                <Target className="h-5 w-5 text-emerald-400" />
                24h CLV Performance Table
              </CardTitle>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                Auto-refreshed every 30s
              </Badge>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="min-w-full table-auto divide-y divide-slate-700 text-left">
                <thead className="bg-slate-900/70 text-slate-300 text-xs sm:text-sm uppercase tracking-wide">
                  <tr>
                    <th className="px-4 sm:px-6 py-3">League</th>
                    <th className="px-4 sm:px-6 py-3">Market</th>
                    <th className="px-4 sm:px-6 py-3">CLV Δ</th>
                    <th className="px-4 sm:px-6 py-3">EV%</th>
                    <th className="px-4 sm:px-6 py-3">Confidence</th>
                    <th className="px-4 sm:px-6 py-3">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-sm sm:text-base">
                  {clvEvidence.map((entry, index) => (
                    <tr key={`${entry.league}-${index}`} className="hover:bg-slate-800/60 transition-colors">
                      <td className="px-4 sm:px-6 py-4 text-white font-medium">{entry.league}</td>
                      <td className="px-4 sm:px-6 py-4 text-slate-300">{entry.market}</td>
                      <td className="px-4 sm:px-6 py-4 font-semibold text-emerald-400">{entry.clv}</td>
                      <td className="px-4 sm:px-6 py-4 text-emerald-300">{entry.ev}</td>
                      <td className="px-4 sm:px-6 py-4">
                        <span className="inline-flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-emerald-300" />
                          <span className="text-white font-semibold">{entry.confidence}%</span>
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <Badge
                          className={
                            entry.outcome === "Win"
                              ? "bg-emerald-500/20 text-emerald-200 border-emerald-500/40"
                              : "bg-yellow-500/20 text-yellow-200 border-yellow-500/40"
                          }
                        >
                          {entry.outcome}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/60 border-slate-600/40">
            <CardHeader>
              <CardTitle className="text-white text-lg sm:text-xl flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-400" />
                Customer Lifetime Value Ladder
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="min-w-full table-auto divide-y divide-slate-700 text-left">
                <thead className="bg-slate-900/70 text-slate-300 text-xs sm:text-sm uppercase tracking-wide">
                  <tr>
                    <th className="px-4 sm:px-6 py-3">Tier</th>
                    <th className="px-4 sm:px-6 py-3">Persona</th>
                    <th className="px-4 sm:px-6 py-3">Avg CLV</th>
                    <th className="px-4 sm:px-6 py-3">Session Retention</th>
                    <th className="px-4 sm:px-6 py-3">Activation Moments</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-sm sm:text-base">
                  {valueStack.map((value, index) => (
                    <tr key={`${value.tier}-${index}`} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 sm:px-6 py-4 text-white font-semibold flex items-center gap-2">
                        <Crown className="h-4 w-4 text-emerald-300" />
                        {value.tier}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-slate-300">{value.persona}</td>
                      <td className="px-4 sm:px-6 py-4 text-emerald-300 font-semibold">{value.avgClv}</td>
                      <td className="px-4 sm:px-6 py-4 text-slate-200">{value.retention}</td>
                      <td className="px-4 sm:px-6 py-4 text-slate-300">{value.activation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <Card className="bg-emerald-600/20 border-emerald-500/30">
              <CardHeader>
                <CardTitle className="text-emerald-100 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Conversion Lift
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-emerald-50">
                <p className="text-sm sm:text-base">
                  Visitors hitting `/sales` and `/matches` in the same session convert to QuickPurchase buys at{" "}
                  <span className="font-semibold">3.4×</span> the baseline rate.
                </p>
                <p className="text-sm sm:text-base">
                  CLV-enabled upsells on live matches deliver <span className="font-semibold">+42% basket value</span>.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-blue-600/20 border-blue-500/30">
              <CardHeader>
                <CardTitle className="text-blue-100 flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Time-to-Value
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-blue-50">
                <p className="text-sm sm:text-base">
                  First CLV opportunity surfaces in <span className="font-semibold">under 90 seconds</span> for new sign-ups.
                </p>
                <p className="text-sm sm:text-base">
                  Automated enrichment ensures fresh odds every <span className="font-semibold">30 seconds</span>.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-purple-600/20 border-purple-500/30">
              <CardHeader>
                <CardTitle className="text-purple-100 flex items-center gap-2">
                  <PlayCircle className="h-5 w-5" />
                  Guided Journey
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-purple-50">
                <p className="text-sm sm:text-base">
                  Built-in walkthroughs route ad traffic from `/sales` → `/matches` → QuickPurchase flow with contextual tooltips.
                </p>
                <p className="text-sm sm:text-base">
                  Personalized upsells leverage country-based pricing tiers and purchase history.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Match Experience Journey */}
      <section className="py-12 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6">
              Every Match, Any State — One Intelligent Flow
            </h2>
            <p className="text-lg sm:text-xl text-slate-300 max-w-4xl mx-auto px-2 sm:px-0">
              The `/matches/[id]` experience adapts in real-time for live, upcoming, and completed fixtures,
              connecting AI prediction models, CLV tracking, and premium purchases into a single conversion funnel.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
            {matchExperiences.map((experience, index) => (
              <Card
                key={index}
                className="bg-slate-800/70 border-slate-600/40 hover:border-emerald-500/40 transition-all duration-300 p-5 sm:p-6 h-full flex flex-col"
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    {experience.icon}
                    <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-xs uppercase tracking-wide">
                      {experience.badge}
                    </Badge>
                  </div>
                  <CardTitle className="text-white text-lg sm:text-xl mt-4">
                    {experience.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-4">
                    {experience.description}
                  </p>
                  <ul className="space-y-3 text-sm sm:text-base text-slate-200">
                    {experience.outcomes.map((outcome, outcomeIdx) => (
                      <li key={outcomeIdx} className="flex items-start gap-2">
                        <ArrowRight className="h-4 w-4 mt-1 text-emerald-400 flex-shrink-0" />
                        <span>{outcome}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-10 sm:mt-12">
            <Button
              size="lg"
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3"
              onClick={() => router.push("/matches")}
            >
              Explore Match Experience
            </Button>
            <p className="text-slate-400 text-sm sm:text-base mt-3 sm:mt-4">
              Track CLV, monitor live odds, and unlock premium analysis on every fixture in seconds.
            </p>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-12 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 sm:mb-6">
              Trusted by Professional Bettors
            </h2>
            <p className="text-lg sm:text-xl text-slate-300">
              See what our users are saying about their results
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="bg-slate-800/60 border-slate-600/50 p-4 sm:p-6">
                <CardContent className="space-y-3 sm:space-y-4">
                  <div className="flex">
                    {Array.from({ length: testimonial.rating }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <p className="text-slate-300 italic leading-relaxed text-sm sm:text-base">
                    "{testimonial.content}"
                  </p>
                  <div className="border-t border-slate-600/30 pt-3 sm:pt-4">
                    <div className="text-white font-medium text-sm sm:text-base">{testimonial.name}</div>
                    <div className="text-slate-400 text-xs sm:text-sm">{testimonial.role}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing/CTA Section */}
      <section className="py-12 sm:py-20 bg-slate-900/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 sm:mb-6">
            Ready to Start Winning?
          </h2>
          <p className="text-lg sm:text-xl text-slate-300 mb-8 sm:mb-12 max-w-3xl mx-auto px-2 sm:px-0">
            Join thousands of successful bettors who trust SnapBet's AI predictions and real-time CLV tracking 
            to maximize their profits while minimizing risk.
          </p>

          <Card className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 p-6 sm:p-8 max-w-2xl mx-auto">
            <div className="text-center mb-6 sm:mb-8">
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 mb-3 sm:mb-4">
                🎯 Launch Special
              </Badge>
              <div className="text-3xl sm:text-4xl font-bold text-white mb-2">
                Free 7-Day Trial
              </div>
              <div className="text-slate-400 text-sm sm:text-base">
                Full access to all features • No credit card required
              </div>
            </div>

            <div className="space-y-3 mb-8">
              <div className="flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-emerald-400 mr-3" />
                <span className="text-slate-200">Real-time CLV Tracker</span>
              </div>
              <div className="flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-emerald-400 mr-3" />
                <span className="text-slate-200">AI Predictions with Confidence Scores</span>
              </div>
              <div className="flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-emerald-400 mr-3" />
                <span className="text-slate-200">Kelly Criterion Staking</span>
              </div>
              <div className="flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-emerald-400 mr-3" />
                <span className="text-slate-200">Value Rating System</span>
              </div>
            </div>

            <Button 
              size="lg" 
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 sm:py-4 text-base sm:text-lg"
              onClick={() => handleCTAClick('pricing_cta')}
            >
              <Zap className="h-5 w-5 sm:h-6 sm:w-6 mr-2" />
              Start Your Free Trial
              <ArrowRight className="h-5 w-5 sm:h-6 sm:w-6 ml-2" />
            </Button>

            <div className="text-slate-400 text-xs sm:text-sm mt-3 sm:mt-4">
              Join 15,000+ successful bettors • Cancel anytime
            </div>
          </Card>
        </div>
      </section>

    </div>
  )
}
