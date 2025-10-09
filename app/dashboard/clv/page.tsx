'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CLVConfidenceMeter } from '@/components/dashboard/clv-confidence-meter'
import { calculateCLV, formatPercent, formatStake } from '@/lib/clv-calculator'
import { Activity, TrendingUp, AlertCircle, RefreshCw, DollarSign, Target } from 'lucide-react'
import { toast } from 'sonner'

interface CLVOpportunity {
  alert_id: string
  match_id: number
  league: string
  outcome: string // 'H', 'D', 'A'
  best_odds: number
  best_book_id: number
  market_composite_odds: number
  clv_pct: number
  stability: number
  books_used: number
  window: string
  composite_method: string
  closing_method: string
  expires_at: string
  created_at: string
  // New fields from backend
  home_team?: string
  away_team?: string
  match_description?: string
}

interface CLVResponse {
  opportunities: CLVOpportunity[]
  meta: {
    count: number
    window: string
    generated_at: string
  }
}

const TIME_WINDOWS = [
  { value: 'all', label: 'All Opportunities', description: 'Show all available CLV opportunities' },
  { value: 'T-72to48', label: '72-48h', description: '72 to 48 hours before match' },
  { value: 'T-48to24', label: '48-24h', description: '48 to 24 hours before match' },
  { value: 'T-24to2', label: '24-2h', description: '24 to 2 hours before match' },
]

export default function CLVDashboard() {
  const [opportunities, setOpportunities] = useState<CLVOpportunity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedWindow, setSelectedWindow] = useState('all')
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(30) // seconds
  const [useLowBandwidth, setUseLowBandwidth] = useState(false)

  const fetchOpportunities = async (window: string, useCache = false) => {
    setIsLoading(true)
    try {
      const url = useCache
        ? `/api/clv/cache?window=${window}&useCache=true`
        : window === 'all' 
          ? '/api/clv/opportunities'
          : `/api/clv/opportunities?window=${window}`
      
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch opportunities: ${response.status}`)
      }

      const data: CLVResponse = await response.json()
      setOpportunities(data.opportunities || [])
      setLastUpdated(data.meta?.generated_at || new Date().toISOString())
      
      toast.success(`Loaded ${data.opportunities?.length || 0} CLV opportunities${useCache ? ' (cached)' : ''}`)
    } catch (error) {
      console.error('Error fetching CLV opportunities:', error)
      toast.error('Failed to load CLV opportunities')
      setOpportunities([])
    } finally {
      setIsLoading(false)
    }
  }

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(() => {
        fetchOpportunities(selectedWindow, useLowBandwidth)
      }, refreshInterval * 1000)

      return () => clearInterval(interval)
    }
  }, [autoRefresh, refreshInterval, selectedWindow, useLowBandwidth])

  useEffect(() => {
    fetchOpportunities(selectedWindow, useLowBandwidth)
  }, [selectedWindow, useLowBandwidth])

  const handleRefresh = () => {
    fetchOpportunities(selectedWindow, useLowBandwidth)
  }

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh)
    toast.info(autoRefresh ? 'Auto-refresh disabled' : `Auto-refresh enabled (${refreshInterval}s)`)
  }

  const toggleLowBandwidth = () => {
    const newMode = !useLowBandwidth
    setUseLowBandwidth(newMode)
    toast.info(newMode ? 'Low-bandwidth mode enabled (using cache)' : 'Low-bandwidth mode disabled (real-time)')
  }

  // Calculate aggregate stats
  const avgConfidence = opportunities.length > 0
    ? opportunities.reduce((sum, opp) => {
        const entryOdds = opp.best_odds || 0
        const closeOdds = opp.market_composite_odds || 0
        if (entryOdds === 0 || closeOdds === 0) return sum
        const calc = calculateCLV(entryOdds, closeOdds)
        return sum + calc.confidence
      }, 0) / opportunities.length
    : 0

  const highConfidenceCount = opportunities.filter(opp => {
    const entryOdds = opp.best_odds || 0
    const closeOdds = opp.market_composite_odds || 0
    if (entryOdds === 0 || closeOdds === 0) return false
    const calc = calculateCLV(entryOdds, closeOdds)
    return calc.confidence >= 70
  }).length

  const totalEV = opportunities.reduce((sum, opp) => {
    const entryOdds = opp.best_odds || 0
    const closeOdds = opp.market_composite_odds || 0
    if (entryOdds === 0 || closeOdds === 0) return sum
    const calc = calculateCLV(entryOdds, closeOdds)
    return sum + calc.evPercent
  }, 0)

  // Helper function to format outcome
  const formatOutcome = (outcome: string) => {
    switch(outcome) {
      case 'H': return 'Home Win'
      case 'D': return 'Draw'
      case 'A': return 'Away Win'
      default: return outcome
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="h-8 w-8 text-primary" />
            Real-time CLV Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Closing Line Value opportunities with confidence scoring
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={toggleLowBandwidth} 
            variant={useLowBandwidth ? 'default' : 'outline'}
            size="sm"
          >
            {useLowBandwidth ? '📡 Cached' : '⚡ Real-time'}
          </Button>
          <Button 
            onClick={toggleAutoRefresh} 
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? `Auto (${refreshInterval}s)` : 'Manual'}
          </Button>
          <Button onClick={handleRefresh} disabled={isLoading} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{opportunities.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Target className="h-4 w-4" />
              Avg Confidence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{avgConfidence.toFixed(0)}/100</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              High Confidence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{highConfidenceCount}</div>
            <p className="text-xs text-muted-foreground mt-1">≥70% confidence</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
              Total EV
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${totalEV > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatPercent(totalEV, 1)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Time Window Tabs */}
      <Tabs value={selectedWindow} onValueChange={setSelectedWindow}>
        <TabsList className="grid w-full grid-cols-4">
          {TIME_WINDOWS.map((window) => (
            <TabsTrigger key={window.value} value={window.value}>
              {window.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Opportunities Table */}
      <Card>
        <CardHeader>
          <CardTitle>CLV Opportunities</CardTitle>
          <CardDescription>
            {lastUpdated && `Last updated: ${new Date(lastUpdated).toLocaleString()}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : opportunities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mb-4" />
              <p>No CLV opportunities found for this time window</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-semibold">Match</th>
                    <th className="text-left p-3 font-semibold">League</th>
                    <th className="text-left p-3 font-semibold">Outcome</th>
                    <th className="text-center p-3 font-semibold">Best Odds</th>
                    <th className="text-center p-3 font-semibold">Composite Odds</th>
                    <th className="text-left p-3 font-semibold">CLV %</th>
                    <th className="text-left p-3 font-semibold">Confidence</th>
                    <th className="text-center p-3 font-semibold">Kelly Stake</th>
                    <th className="text-left p-3 font-semibold">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {opportunities.map((opp, index) => {
                    // Use correct field names from backend
                    const entryOdds = opp.best_odds || 0
                    const closeOdds = opp.market_composite_odds || 0
                    
                    // Skip if invalid odds
                    if (entryOdds === 0 || closeOdds === 0) {
                      return null
                    }
                    
                    const calc = calculateCLV(entryOdds, closeOdds)
                    
                    return (
                      <tr key={opp.alert_id || index} className="border-b hover:bg-muted/50 transition-colors">
                        <td className="p-3">
                          <div>
                            {opp.home_team && opp.away_team ? (
                              <>
                                <div className="font-medium">{opp.home_team} vs {opp.away_team}</div>
                                <div className="text-xs text-muted-foreground">Match #{opp.match_id}</div>
                              </>
                            ) : (
                              <>
                                <div className="font-medium text-primary">Match #{opp.match_id}</div>
                                <div className="text-xs text-muted-foreground">
                                  {opp.match_description || 'Details pending'}
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline">{opp.league}</Badge>
                        </td>
                        <td className="p-3">
                          <Badge className={
                            opp.outcome === 'H' ? 'bg-blue-500' : 
                            opp.outcome === 'D' ? 'bg-gray-500' : 
                            'bg-green-500'
                          }>
                            {formatOutcome(opp.outcome)}
                          </Badge>
                        </td>
                        <td className="p-3 text-center font-mono font-semibold">{entryOdds.toFixed(2)}</td>
                        <td className="p-3 text-center font-mono">{closeOdds.toFixed(2)}</td>
                        <td className="p-3">
                          <span className={opp.clv_pct > 0 ? 'text-green-600 font-bold' : 'text-red-600'}>
                            {formatPercent(opp.clv_pct)}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="min-w-[200px]">
                            <CLVConfidenceMeter 
                              confidence={calc.confidence} 
                              evPercent={calc.evPercent}
                              size="sm"
                            />
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <div className="font-mono font-semibold">{formatStake(calc.recommendedStake)}</div>
                          <div className="text-xs text-muted-foreground">
                            (Full: {formatStake(calc.kellyFraction)})
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="space-y-1">
                            <Badge variant="secondary">{opp.books_used} books</Badge>
                            <div className="text-xs text-muted-foreground">
                              Book #{opp.best_book_id}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {opp.window}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Exp: {new Date(opp.expires_at).toLocaleTimeString()}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Understanding the Metrics</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <div><strong>Match ID:</strong> External match identifier for tracking</div>
          <div><strong>Outcome:</strong> H = Home Win, D = Draw, A = Away Win</div>
          <div><strong>Best Odds:</strong> Your entry odds (best available odds when opportunity was found)</div>
          <div><strong>Composite Odds:</strong> Market consensus odds (closing line value)</div>
          <div><strong>CLV%:</strong> Closing Line Value - how much odds moved in your favor (from backend)</div>
          <div><strong>EV%:</strong> Expected Value - your expected long-run return on this bet (calculated)</div>
          <div><strong>Confidence:</strong> 0-100 score based on EV% (higher = stronger edge)</div>
          <div><strong>Kelly Stake:</strong> Recommended bet size (half-Kelly for risk control, max 5%)</div>
          <div><strong>Books Used:</strong> Number of bookmakers used in composite odds calculation</div>
          <div className="pt-2 text-muted-foreground">
            <AlertCircle className="h-4 w-4 inline mr-1" />
            Confidence assumes closing odds represent true probability. Always apply your own analysis.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

