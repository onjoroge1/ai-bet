"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  LayoutDashboard, 
  List, 
  Layers, 
  Lightbulb, 
  Cloud, 
  TrendingUp,
  Crown,
  Coins,
  Clock,
  User,
  ChevronDown,
  ArrowUp,
  Eye,
  Plus,
  Lock,
  AlertTriangle,
  FileText,
  TrendingDown,
  Flame,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Filter,
  Search
} from "lucide-react"
import { PremiumGate } from "@/components/premium-gate"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"

interface DashboardStats {
  evBetsToday: number
  avgCLV7d: number
  winRate: number
  activeMatches: number
}

interface BestEdge {
  match_id: number
  home_team: string
  away_team: string
  league: string
  market: string
  outcome: string
  fair_odds: number
  book_odds: number
  clv_pct: number
  confidence: number
  books_used: number
  best_book: string
}

interface CLVOpportunity {
  alert_id: string
  match_id: number
  home_team: string
  away_team: string
  league: string
  outcome: string
  entry_odds: number
  consensus_odds: number
  clv_pct: number
  confidence_score: number
  books_used: number
  expires_at: string
}

interface SuggestedParlay {
  parlay_id: string
  leg_count: number
  edge_pct: number
  ev_prob: number
  implied_odds: number
}

interface TrendingMarket {
  id: string
  match_id: number
  match_name: string
  market: string
  odds: number
  clv_pct: number
  trend: string
}

interface IntelligenceFeedItem {
  id: string
  type: string
  icon: string
  title: string
  description: string
  timestamp: string
}

export default function PremiumDashboardPage() {
  const router = useRouter()
  const [hasPremiumAccess, setHasPremiumAccess] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [bestEdge, setBestEdge] = useState<BestEdge | null>(null)
  const [clvOpportunities, setClvOpportunities] = useState<CLVOpportunity[]>([])
  const [suggestedParlays, setSuggestedParlays] = useState<{ conservative: SuggestedParlay | null; aggressive: SuggestedParlay | null } | null>(null)
  const [trendingMarkets, setTrendingMarkets] = useState<TrendingMarket[]>([])
  const [intelligenceFeed, setIntelligenceFeed] = useState<IntelligenceFeedItem[]>([])
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    checkPremiumAccess()
  }, [])

  useEffect(() => {
    if (hasPremiumAccess) {
      fetchDashboardData()
      // Auto-refresh every 30 seconds
      const interval = setInterval(() => {
        fetchDashboardData()
      }, 30000)
      return () => clearInterval(interval)
    }
  }, [hasPremiumAccess])

  const checkPremiumAccess = async () => {
    try {
      const response = await fetch('/api/premium/check')
      if (response.ok) {
        const data = await response.json()
        setHasPremiumAccess(data.hasAccess)
      } else {
        setHasPremiumAccess(false)
      }
    } catch (error) {
      console.error('Error checking premium access:', error)
      setHasPremiumAccess(false)
    } finally {
      setLoading(false)
    }
  }

  const fetchDashboardData = async () => {
    try {
      setRefreshing(true)
      const [statsRes, bestEdgeRes, clvRes, parlaysRes, trendingRes, feedRes] = await Promise.all([
        fetch('/api/premium/dashboard-stats'),
        fetch('/api/premium/best-edge'),
        fetch('/api/clv/opportunities?limit=10'),
        fetch('/api/premium/suggested-parlays'),
        fetch('/api/premium/trending-markets'),
        fetch('/api/premium/intelligence-feed'),
      ])

      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData)
      }

      if (bestEdgeRes.ok) {
        const bestEdgeData = await bestEdgeRes.json()
        setBestEdge(bestEdgeData)
      }

      if (clvRes.ok) {
        const clvData = await clvRes.json()
        setClvOpportunities(clvData.opportunities || [])
      }

      if (parlaysRes.ok) {
        const parlaysData = await parlaysRes.json()
        setSuggestedParlays(parlaysData)
      }

      if (trendingRes.ok) {
        const trendingData = await trendingRes.json()
        setTrendingMarkets(trendingData.markets || [])
      }

      if (feedRes.ok) {
        const feedData = await feedRes.json()
        setIntelligenceFeed(feedData.feed || [])
      }

      setLastRefresh(new Date())
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    fetchDashboardData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#121212]">
        <div className="text-slate-400">Loading...</div>
      </div>
    )
  }

  if (!hasPremiumAccess) {
    return (
      <PremiumGate 
        title="Premium Dashboard Access"
        description="Unlock the full premium dashboard with real-time CLV tracking, AI insights, and advanced analytics."
        featureName="Premium Dashboard"
      />
    )
  }

  return (
    <div className="flex h-screen bg-[#121212] text-white overflow-hidden">
      {/* Left Sidebar */}
      <div className="w-64 bg-[#1E1E1E] border-r border-slate-800 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <span className="text-white font-semibold text-lg">SnapBet</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          <NavItem href="/dashboard/premium" icon={LayoutDashboard} label="Dashboard" active />
          <NavItem href="/dashboard/matches" icon={List} label="Matches" />
          <NavItem href="/dashboard/parlays" icon={Layers} label="Parlays" />
          <NavItem href="/dashboard/premium" icon={Lightbulb} label="Intelligence" />
          <NavItem href="/dashboard/premium" icon={Cloud} label="Models & Methodology" />
          <NavItem href="/dashboard/analytics" icon={TrendingUp} label="Performance" />
        </nav>

        {/* Subscription Info */}
        <div className="p-4 border-t border-slate-800 space-y-3">
          <div className="text-xs text-slate-400 space-y-1">
            <div>Subscription: <span className="text-emerald-400">PREMIUM</span></div>
            <div>Plan: <span className="text-white">$79 / month</span></div>
            <div>Credits: <span className="text-white">12</span></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header Bar */}
        <header className="bg-[#1E1E1E] border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50">
              <Crown className="h-3 w-3 mr-1" />
              PREMIUM
            </Badge>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Coins className="h-4 w-4" />
              <span>Credits: 12</span>
            </div>
            <div className="text-slate-500 text-sm">
              Last Refresh: {lastRefresh.toLocaleTimeString()} UTC
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-slate-400 hover:text-white"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
              <User className="h-4 w-4 mr-2" />
              Profile
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* KPI Strip */}
          <div className="grid grid-cols-4 gap-4">
            <KPICard 
              title="+EV Today" 
              value={`${stats?.evBetsToday || 0} Bets`} 
              trend="up" 
              color="emerald"
            />
            <KPICard 
              title="Avg CLV (7d)" 
              value={`+${(stats?.avgCLV7d || 0).toFixed(1)}%`} 
              trend="up" 
              color="emerald"
            />
            <KPICard 
              title="Win Rate" 
              value={`${stats?.winRate || 0}%`} 
              color="white"
            />
            <KPICard 
              title="Active" 
              value={`${stats?.activeMatches || 0} Matches`} 
              color="white"
            />
          </div>

          {/* Best Edge Right Now */}
          {bestEdge && (
            <Card className="bg-gradient-to-r from-emerald-900/30 to-blue-900/30 border-emerald-500/50">
              <CardContent className="p-6">
                <div className="text-xs text-slate-400 mb-4">BEST EDGE RIGHT NOW</div>
                <div className="grid grid-cols-3 gap-6 items-center">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                        <span className="text-xs font-bold">A</span>
                      </div>
                      <div>
                        <div className="font-semibold text-white">{bestEdge.home_team} vs {bestEdge.away_team}</div>
                        <div className="text-sm text-slate-400">{bestEdge.league}</div>
                      </div>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="text-slate-400">Market: <span className="text-white">{bestEdge.market}</span></div>
                      <div className="text-slate-400">Fair Odds: <span className="text-white">{bestEdge.fair_odds.toFixed(2)}</span></div>
                      <div className="text-slate-400">Book Odds: <span className="text-white">{bestEdge.book_odds.toFixed(2)}</span></div>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-5xl font-bold text-emerald-400 mb-2">
                      CLV +{bestEdge.clv_pct.toFixed(1)}%
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-slate-400 mb-2">Confidence</div>
                    <div className="relative w-24 h-24 mx-auto">
                      <svg className="transform -rotate-90 w-24 h-24">
                        <circle
                          cx="48"
                          cy="48"
                          r="40"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="none"
                          className="text-slate-700"
                        />
                        <circle
                          cx="48"
                          cy="48"
                          r="40"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="none"
                          strokeDasharray={`${2 * Math.PI * 40}`}
                          strokeDashoffset={`${2 * Math.PI * 40 * (1 - bestEdge.confidence / 100)}`}
                          className="text-emerald-400"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-lg font-bold text-emerald-400">{bestEdge.confidence}/100</div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4 justify-center">
                      <Button variant="outline" size="sm" onClick={() => router.push(`/match/${bestEdge.match_id}`)}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Match
                      </Button>
                      <Button size="sm" className="bg-white text-black hover:bg-slate-200">
                        <Plus className="h-4 w-4 mr-2" />
                        Add to Slip
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Middle Content Grid */}
          <div className="grid grid-cols-3 gap-6">
            {/* CLV & Market Edge Table */}
            <div className="col-span-2 space-y-4">
              <Card className="bg-[#1E1E1E] border-slate-800">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white">CLV & Market Edge Table</CardTitle>
                    <div className="flex gap-2">
                      <Select defaultValue="all">
                        <SelectTrigger className="w-24 h-8 bg-slate-800 border-slate-700 text-xs">
                          <SelectValue placeholder="League" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select defaultValue="all">
                        <SelectTrigger className="w-24 h-8 bg-slate-800 border-slate-700 text-xs">
                          <SelectValue placeholder="Market" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select defaultValue="all">
                        <SelectTrigger className="w-24 h-8 bg-slate-800 border-slate-700 text-xs">
                          <SelectValue placeholder="Time" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select defaultValue="all">
                        <SelectTrigger className="w-24 h-8 bg-slate-800 border-slate-700 text-xs">
                          <SelectValue placeholder="Confidence" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700 text-slate-400">
                          <th className="text-left p-2">Match</th>
                          <th className="text-left p-2">Market</th>
                          <th className="text-right p-2">Open</th>
                          <th className="text-right p-2">Current</th>
                          <th className="text-right p-2">Fair</th>
                          <th className="text-right p-2">CLV</th>
                          <th className="text-right p-2">EV</th>
                          <th className="text-center p-2">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clvOpportunities.slice(0, 5).map((opp, idx) => {
                          const entryOdds = opp.entry_odds || 0
                          const consensusOdds = opp.consensus_odds || 0
                          const clvPct = opp.clv_pct || 0
                          const evPct = clvPct * 0.6 // Simplified EV calculation
                          
                          return (
                            <tr key={opp.alert_id || idx} className="border-b border-slate-800 hover:bg-slate-800/50">
                              <td className="p-2">
                                <div className="font-medium text-white">
                                  {opp.home_team?.substring(0, 3).toUpperCase()} v {opp.away_team?.substring(0, 3).toUpperCase()}
                                </div>
                              </td>
                              <td className="p-2 text-slate-300">{opp.outcome}</td>
                              <td className="p-2 text-right text-slate-300">{entryOdds.toFixed(2)}</td>
                              <td className="p-2 text-right text-slate-300">{consensusOdds.toFixed(2)}</td>
                              <td className="p-2 text-right text-white">{consensusOdds.toFixed(2)}</td>
                              <td className="p-2 text-right">
                                <span className="text-emerald-400 font-semibold">+{clvPct.toFixed(1)}%</span>
                              </td>
                              <td className="p-2 text-right">
                                <span className="text-emerald-400 font-semibold">+{evPct.toFixed(1)}%</span>
                              </td>
                              <td className="p-2 text-center">
                                <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300" onClick={() => router.push(`/match/${opp.match_id}`)}>
                                  View
                                </Button>
                              </td>
                            </tr>
                          )
                        })}
                        {/* Locked rows */}
                        {Array.from({ length: 3 }).map((_, idx) => (
                          <tr key={`locked-${idx}`} className="border-b border-slate-800 opacity-40">
                            <td colSpan={8} className="p-2 text-center relative">
                              <div className="flex items-center justify-center gap-2">
                                <Lock className="h-4 w-4 text-slate-500" />
                                <span className="text-slate-500 text-xs">Premium Content</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Suggested Parlays */}
                  <div className="mt-6 pt-6 border-t border-slate-800">
                    <div className="text-sm font-semibold text-white mb-3">SUGGESTED PARLAYS</div>
                    <div className="grid grid-cols-2 gap-4">
                      {suggestedParlays?.conservative && (
                        <Card className="bg-slate-800/50 border-slate-700">
                          <CardContent className="p-4">
                            <div className="text-xs text-slate-400 mb-1">Conservative</div>
                            <div className="text-lg font-bold text-emerald-400">
                              EV/Prob +{suggestedParlays.conservative.ev_prob.toFixed(1)}%
                            </div>
                          </CardContent>
                        </Card>
                      )}
                      {suggestedParlays?.aggressive && (
                        <Card className="bg-slate-800/50 border-slate-700">
                          <CardContent className="p-4">
                            <div className="text-xs text-slate-400 mb-1">Aggressive</div>
                            <div className="text-lg font-bold text-emerald-400">
                              EV/Prob +{suggestedParlays.aggressive.ev_prob.toFixed(1)}%
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Sidebar */}
            <div className="space-y-4">
              {/* Parlay Builder */}
              <Card className="bg-[#1E1E1E] border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white text-sm">PARLAY BUILDER</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span className="text-slate-300">Liverpool Away +5.2% CLV</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span className="text-slate-300">Napoli Home +5.1% CLV</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span className="text-slate-300">BTTS Yes +2.4% CLV</span>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-slate-800 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Combined Odds</span>
                      <span className="text-white font-semibold">6.80</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Combined EV</span>
                      <span className="text-emerald-400 font-semibold">+18.4%</span>
                    </div>
                  </div>
                  <Button className="w-full bg-white text-black hover:bg-slate-200 mt-4">
                    Analyze Parlay
                  </Button>
                </CardContent>
              </Card>

              {/* Trending Markets */}
              <Card className="bg-[#1E1E1E] border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white text-sm">TRENDING & HOT MARKETS</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {trendingMarkets.slice(0, 3).map((market) => (
                    <div key={market.id} className="flex items-center justify-between p-2 hover:bg-slate-800/50 rounded">
                      <div className="flex items-center gap-2">
                        {market.trend === 'up' && <ArrowUp className="h-4 w-4 text-emerald-400" />}
                        {market.trend === 'fire' && <Flame className="h-4 w-4 text-orange-400" />}
                        <span className="text-sm text-white">{market.match_name}</span>
                      </div>
                      <span className="text-sm text-slate-300">{market.odds.toFixed(2)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Bottom Content Grid */}
          <div className="grid grid-cols-2 gap-6">
            {/* Intelligence Feed */}
            <Card className="bg-[#1E1E1E] border-slate-800">
              <CardHeader>
                <CardTitle className="text-white text-sm">BETTING INTELLIGENCE FEED</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {intelligenceFeed.map((item) => (
                    <div key={item.id} className="flex items-start gap-3 p-2 hover:bg-slate-800/50 rounded">
                      {item.icon === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5" />}
                      {item.icon === 'document' && <FileText className="h-4 w-4 text-blue-400 mt-0.5" />}
                      {item.icon === 'trending' && <TrendingUp className="h-4 w-4 text-emerald-400 mt-0.5" />}
                      <div className="flex-1">
                        <div className="text-sm text-white">{item.title}</div>
                        <div className="text-xs text-slate-400 mt-1">{item.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* My Performance */}
            <Card className="bg-[#1E1E1E] border-slate-800">
              <CardHeader>
                <CardTitle className="text-white text-sm">MY PERFORMANCE</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-sm text-slate-300">
                    Bets Tracked: <span className="text-white font-semibold">38</span> | 
                    Avg CLV: <span className="text-emerald-400 font-semibold">+3.9%</span> | 
                    ROI: <span className="text-emerald-400 font-semibold">+11.2%</span>
                  </div>
                  <Tabs defaultValue="purchased" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 bg-slate-800">
                      <TabsTrigger value="purchased" className="data-[state=active]:bg-slate-700">Purchased</TabsTrigger>
                      <TabsTrigger value="active" className="data-[state=active]:bg-slate-700">Active</TabsTrigger>
                      <TabsTrigger value="history" className="data-[state=active]:bg-slate-700">History</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

function NavItem({ href, icon: Icon, label, active = false }: { href: string; icon: any; label: string; active?: boolean }) {
  return (
    <a
      href={href}
      className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : 'text-slate-400 hover:text-white hover:bg-slate-800'
      }`}
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
    </a>
  )
}

function KPICard({ title, value, trend, color = "white" }: { title: string; value: string; trend?: "up" | "down"; color?: "emerald" | "white" }) {
  const valueColor = color === "emerald" ? "text-emerald-400" : "text-white"
  
  return (
    <Card className="bg-[#1E1E1E] border-slate-800">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400 mb-1">{title}</div>
            <div className={`text-2xl font-bold ${valueColor}`}>{value}</div>
          </div>
          {trend === "up" && (
            <ArrowUp className="h-5 w-5 text-emerald-400" />
          )}
          {trend === "down" && (
            <TrendingDown className="h-5 w-5 text-red-400" />
          )}
        </div>
      </CardContent>
    </Card>
  )
}
