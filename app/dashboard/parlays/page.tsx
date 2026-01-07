"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, Trophy, TrendingUp, Loader2, Search, Filter, X, Layers, Zap, Target, RefreshCw, Info, ChevronRight } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PremiumGate } from "@/components/premium-gate"
import { ParlayAIAnalysis } from "@/components/premium/parlay-ai-analysis"

interface ParlayLeg {
  edge: number
  outcome: string
  match_id: number
  away_team: string
  home_team: string
  model_prob: number
  decimal_odds: number
}

interface ParlayQuality {
  score: number
  is_tradable: boolean
  risk_level: 'low' | 'medium' | 'high' | 'very_high'
  has_low_edge: boolean
  has_low_probability: boolean
}

interface Parlay {
  parlay_id: string
  api_version: string
  leg_count: number
  legs: ParlayLeg[]
  combined_prob: number
  correlation_penalty: number
  adjusted_prob: number
  implied_odds: number
  edge_pct: number
  confidence_tier: string
  parlay_type: string
  league_group?: string
  earliest_kickoff: string
  latest_kickoff: string
  kickoff_window: string
  status: string
  created_at: string
  synced_at: string
  quality?: ParlayQuality
}

interface ParlaysResponse {
  count: number
  filters?: {
    tradableOnly: boolean
    minEdge: number
    minProb: number
  }
  parlays: Parlay[]
}

interface ParlayFilters {
  search: string
  status: string
  confidence: string
  version: string
  sortBy: string
}

/**
 * ParlaysPage - Display and manage parlays
 */
export default function ParlaysPage() {
  const router = useRouter()
  const [parlays, setParlays] = useState<Parlay[]>([])
  const [filteredParlays, setFilteredParlays] = useState<Parlay[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [isAdmin, setIsAdmin] = useState<boolean>(false)
  const [selectedParlay, setSelectedParlay] = useState<Parlay | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [loadingLegs, setLoadingLegs] = useState(false)
  const [hasPremiumAccess, setHasPremiumAccess] = useState<boolean | null>(null)
  const [viewMode, setViewMode] = useState<"table" | "grid">("table") // New view mode state
  const [filters, setFilters] = useState<ParlayFilters>({
    search: "",
    status: "active",
    confidence: "all",
    version: "all",
    sortBy: "edge"
  })

  // Check server-side session on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/session', {
          cache: 'no-store',
          credentials: 'include',
        })
        const session = await res.json()
        const serverIsAuthenticated = !!session?.user
        const userIsAdmin = session?.user?.role?.toLowerCase() === 'admin'
        setIsAuthenticated(serverIsAuthenticated)
        setIsAdmin(userIsAdmin)
        
        if (!serverIsAuthenticated) {
          router.push('/matches')
          return
        }
        
        // Check premium access
        checkPremiumAccess()
        fetchParlays()
      } catch (error) {
        console.error('[ParlaysPage] Auth check error:', error)
        setIsAuthenticated(false)
        router.push('/matches')
      }
    }
    checkAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

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
    }
  }

  const fetchParlays = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (filters.status !== "all") params.append('status', filters.status)
      if (filters.confidence !== "all") params.append('confidence_tier', filters.confidence)
      if (filters.version !== "all") params.append('version', filters.version)
      // Quality filtering (defaults to tradable only)
      params.append('tradable_only', 'true') // Default to tradable only
      params.append('min_edge', '5') // Minimum 5% edge
      params.append('min_prob', '0.05') // Minimum 5% probability
      params.append('limit', '100')

      const response = await fetch(`/api/parlays?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch parlays: ${response.status}`)
      }

      const data: ParlaysResponse = await response.json()
      setParlays(data.parlays || [])
    } catch (err) {
      console.error('Error fetching parlays:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch parlays')
      toast.error('Failed to load parlays')
    } finally {
      setLoading(false)
    }
  }

  const syncParlays = async () => {
    try {
      setSyncing(true)
      const response = await fetch('/api/parlays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: 'both' }),
      })

      if (!response.ok) {
        throw new Error('Failed to sync parlays')
      }

      const result = await response.json()
      toast.success(`Synced ${result.totals.synced} parlays`)
      await fetchParlays()
    } catch (err) {
      console.error('Error syncing parlays:', err)
      toast.error('Failed to sync parlays')
    } finally {
      setSyncing(false)
    }
  }

  const applyFilters = useCallback((parlays: Parlay[], filters: ParlayFilters) => {
    let filtered = [...parlays]

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      filtered = filtered.filter(parlay => {
        const legMatches = parlay.legs.some(leg => 
          leg.home_team.toLowerCase().includes(searchLower) ||
          leg.away_team.toLowerCase().includes(searchLower)
        )
        const leagueMatch = parlay.league_group?.toLowerCase().includes(searchLower)
        return legMatches || leagueMatch
      })
    }

    // Status filter (already applied in API call, but keep for client-side filtering)
    if (filters.status !== "all") {
      filtered = filtered.filter(p => p.status === filters.status)
    }

    // Confidence filter (already applied in API call)
    if (filters.confidence !== "all") {
      filtered = filtered.filter(p => p.confidence_tier === filters.confidence)
    }

    // Version filter (already applied in API call)
    if (filters.version !== "all") {
      filtered = filtered.filter(p => p.api_version === filters.version)
    }

    // Sort
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case "edge":
          return Number(b.edge_pct) - Number(a.edge_pct)
        case "odds":
          return Number(a.implied_odds) - Number(b.implied_odds)
        case "kickoff":
          return new Date(a.earliest_kickoff).getTime() - new Date(b.earliest_kickoff).getTime()
        case "legs":
          return b.leg_count - a.leg_count
        default:
          return 0
      }
    })

    return filtered
  }, [])

  useEffect(() => {
    if (parlays.length > 0) {
      const filtered = applyFilters(parlays, filters)
      setFilteredParlays(filtered)
    }
  }, [parlays, filters, applyFilters])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDateCompact = (dateString: string) => {
    const date = new Date(dateString)
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    }
  }

  const getOutcomeLabel = (outcome: string) => {
    switch (outcome) {
      case 'H': return 'Home Win'
      case 'A': return 'Away Win'
      case 'D': return 'Draw'
      default: return outcome
    }
  }

  const getConfidenceColor = (tier: string) => {
    switch (tier) {
      case 'high': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'
      case 'low': return 'bg-red-500/20 text-red-400 border-red-500/40'
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/40'
    }
  }

  /**
   * Normalize edge value - handles edge values that might be in percentage format
   * Backend may send edge as percentage (8.3333 = 8.33%) or decimal (0.08333 = 8.33%)
   * Typical edges: 5-30%, so values > 100 after multiplication indicate wrong format
   */
  const normalizeLegEdge = (edge: number): number => {
    const numEdge = Number(edge)
    if (isNaN(numEdge)) return 0
    
    // Standard assumption: edges come as decimals (0-1 range), multiply by 100
    // But if edge > 1, it's likely already a percentage (backend sends as percentage)
    // Typical decimal edges: 0.05-0.30 (5-30%)
    // If edge is > 1, it's already in percentage format, don't multiply
    
    if (Math.abs(numEdge) > 1) {
      // Already a percentage format (e.g., 8.3333 = 8.33%)
      // However, if it's suspiciously high (>100), there might be an error
      if (Math.abs(numEdge) > 100) {
        // Likely error: divide by 10 to correct (e.g., 833.33 -> 83.33)
        return numEdge / 10
      }
      return numEdge
    }
    
    // Decimal format (0-1 range) - convert to percentage
    return numEdge * 100
  }

  const getEdgeColor = (edge: number) => {
    const normalized = normalizeLegEdge(edge)
    if (normalized >= 20) return 'text-emerald-400'
    if (normalized >= 10) return 'text-yellow-400'
    return 'text-slate-400'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-emerald-400 mx-auto mb-4" />
          <div className="text-white text-lg font-semibold">Loading parlays...</div>
        </div>
      </div>
    )
  }

  // Show premium gate if user doesn't have access
  if (hasPremiumAccess === false && !isAdmin) {
    return (
      <PremiumGate 
        title="Premium Parlays Access"
        description="Access our AI-powered parlay recommendations with monthly premium subscription."
        featureName="Parlays"
      />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
              <Layers className="h-8 w-8 text-emerald-400" />
              Parlays
            </h1>
            <p className="text-slate-400">AI-curated multi-match betting opportunities</p>
          </div>
          {isAdmin && (
            <Button
              onClick={syncParlays}
              disabled={syncing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {syncing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync Parlays
                </>
              )}
            </Button>
          )}
        </div>

        {/* Edge Percentage Info Box */}
        <Card className="bg-blue-500/10 border-blue-500/30 mb-6">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-white mb-1">Understanding Edge Percentage</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  <strong>Edge %</strong> represents the expected value advantage of our AI model's prediction compared to the bookmaker's odds. 
                  A positive edge means our model believes the bet has better value than what the market suggests. 
                  <strong> Typical edges range from 5-30%</strong> - values above 50% are extremely rare and may indicate data quality issues.
                </p>
                <p className="text-xs text-slate-400 mt-2">
                  <strong>Formula:</strong> Edge = (Model Probability ÷ Implied Probability) - 1
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card className="bg-slate-800/60 border-slate-700 mb-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search by team or league..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="pl-10 bg-slate-700/50 border-slate-600 text-white"
                  />
                </div>
              </div>
              <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
                <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="settled">Settled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.confidence} onValueChange={(value) => setFilters({ ...filters, confidence: value })}>
                <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                  <SelectValue placeholder="Confidence" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Confidence</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.version} onValueChange={(value) => setFilters({ ...filters, version: value })}>
                <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                  <SelectValue placeholder="Version" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Versions</SelectItem>
                  <SelectItem value="v1">V1</SelectItem>
                  <SelectItem value="v2">V2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="mt-4 flex items-center gap-4">
              <Select value={filters.sortBy} onValueChange={(value) => setFilters({ ...filters, sortBy: value })}>
                <SelectTrigger className="w-48 bg-slate-700/50 border-slate-600 text-white">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="edge">Highest Edge</SelectItem>
                  <SelectItem value="odds">Best Odds</SelectItem>
                  <SelectItem value="kickoff">Earliest Kickoff</SelectItem>
                  <SelectItem value="legs">Most Legs</SelectItem>
                </SelectContent>
              </Select>
              {filters.search && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilters({ ...filters, search: "" })}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Error Message */}
        {error && (
          <Card className="bg-red-500/10 border-red-500/50 mb-6">
            <CardContent className="p-4">
              <p className="text-red-400">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* View Mode Toggle */}
        <div className="flex justify-end mb-4">
          <div className="flex gap-2 bg-slate-800/60 p-1 rounded-lg border border-slate-700">
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
              className={viewMode === "table" ? "bg-emerald-600 hover:bg-emerald-700" : "text-slate-400 hover:text-white"}
            >
              Table
            </Button>
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className={viewMode === "grid" ? "bg-emerald-600 hover:bg-emerald-700" : "text-slate-400 hover:text-white"}
            >
              Grid
            </Button>
          </div>
        </div>

        {/* Parlays Display */}
        {filteredParlays.length === 0 ? (
          <Card className="bg-slate-800/60 border-slate-700">
            <CardContent className="p-12 text-center">
              <Layers className="h-12 w-12 text-slate-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Parlays Found</h3>
              <p className="text-slate-400 mb-4">
                {parlays.length === 0 
                  ? "No parlays available. Try syncing from the backend."
                  : "No parlays match your current filters."}
              </p>
              {parlays.length === 0 && isAdmin && (
                <Button onClick={syncParlays} disabled={syncing} className="bg-emerald-600 hover:bg-emerald-700">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync Parlays
                </Button>
              )}
            </CardContent>
          </Card>
        ) : viewMode === "table" ? (
          /* Compact Table View */
          <Card className="bg-slate-800/60 border-slate-700">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700 hover:bg-slate-700/30">
                    <TableHead className="text-slate-300 font-semibold">Legs</TableHead>
                    <TableHead className="text-slate-300 font-semibold">Quality</TableHead>
                    <TableHead className="text-slate-300 font-semibold">Edge %</TableHead>
                    <TableHead className="text-slate-300 font-semibold">Odds</TableHead>
                    <TableHead className="text-slate-300 font-semibold">Win Prob</TableHead>
                    <TableHead className="text-slate-300 font-semibold">Matches</TableHead>
                    <TableHead className="text-slate-300 font-semibold">Kickoff</TableHead>
                    <TableHead className="text-slate-300 font-semibold">Confidence</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredParlays.map((parlay) => (
                    <TableRow
                      key={parlay.parlay_id}
                      className="border-slate-700 hover:bg-slate-700/40 cursor-pointer transition-colors group"
                      onClick={async () => {
                        setSelectedParlay(parlay)
                        setShowDetailModal(true)
                        
                        if (!parlay.legs || parlay.legs.length === 0) {
                          setLoadingLegs(true)
                          try {
                            const response = await fetch(`/api/parlays/${parlay.parlay_id}`)
                            if (response.ok) {
                              const parlayWithLegs = await response.json()
                              setSelectedParlay(parlayWithLegs)
                            }
                          } catch (err) {
                            console.error('Error fetching parlay legs:', err)
                          } finally {
                            setLoadingLegs(false)
                          }
                        }
                      }}
                    >
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <Layers className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                          <span className="font-semibold text-white">{parlay.leg_count}</span>
                          <Badge variant="outline" className="border-slate-600 text-slate-300 text-xs px-1.5 py-0">
                            {parlay.api_version.toUpperCase()}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex flex-col gap-1.5">
                          {parlay.quality && (
                            <>
                              {parlay.quality.is_tradable ? (
                                <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-500/30 text-xs">
                                  ✓ Tradable
                                </Badge>
                              ) : (
                                <Badge className="bg-red-600/20 text-red-400 border-red-500/30 text-xs">
                                  ⚠ Not Recommended
                                </Badge>
                              )}
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${
                                  parlay.quality.risk_level === 'low' ? 'border-green-500/30 text-green-400' :
                                  parlay.quality.risk_level === 'medium' ? 'border-yellow-500/30 text-yellow-400' :
                                  parlay.quality.risk_level === 'high' ? 'border-orange-500/30 text-orange-400' :
                                  'border-red-500/30 text-red-400'
                                }`}
                              >
                                Risk: {parlay.quality.risk_level.replace('_', ' ')}
                              </Badge>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className={`font-bold text-lg ${getEdgeColor(Number(parlay.edge_pct))}`}>
                          +{Number(parlay.edge_pct).toFixed(1)}%
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="text-white font-medium">{Number(parlay.implied_odds).toFixed(2)}</div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="text-white font-medium">{(Number(parlay.adjusted_prob) * 100).toFixed(1)}%</div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex flex-col gap-1.5">
                          {parlay.legs.slice(0, 2).map((leg, idx) => (
                            <div key={idx} className="text-sm text-slate-300">
                              <span className="font-medium">{leg.home_team}</span>
                              <span className="text-slate-500 mx-1">vs</span>
                              <span className="font-medium">{leg.away_team}</span>
                              <span className="text-xs text-slate-500 ml-2">
                                ({getOutcomeLabel(leg.outcome).charAt(0)})
                              </span>
                            </div>
                          ))}
                          {parlay.legs.length > 2 && (
                            <div className="text-xs text-slate-400 italic">
                              +{parlay.legs.length - 2} more match{parlay.legs.length - 2 > 1 ? 'es' : ''}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex flex-col text-sm">
                          <div className="flex items-center gap-1 text-slate-300">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            <span className="font-medium">{formatDateCompact(parlay.earliest_kickoff).date}</span>
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5 ml-4">
                            {formatDateCompact(parlay.earliest_kickoff).time}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge className={getConfidenceColor(parlay.confidence_tier)}>
                          {parlay.confidence_tier.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3">
                        <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          /* Original Grid View */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredParlays.map((parlay) => (
              <Card 
                key={parlay.parlay_id} 
                className="bg-slate-800/60 border-slate-700 hover:border-emerald-500/50 transition-colors cursor-pointer"
                onClick={async () => {
                  setSelectedParlay(parlay)
                  setShowDetailModal(true)
                  
                  if (!parlay.legs || parlay.legs.length === 0) {
                    setLoadingLegs(true)
                    try {
                      const response = await fetch(`/api/parlays/${parlay.parlay_id}`)
                      if (response.ok) {
                        const parlayWithLegs = await response.json()
                        setSelectedParlay(parlayWithLegs)
                      }
                    } catch (err) {
                      console.error('Error fetching parlay legs:', err)
                    } finally {
                      setLoadingLegs(false)
                    }
                  }
                }}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-white flex items-center gap-2">
                        <Layers className="h-5 w-5 text-emerald-400" />
                        {parlay.leg_count}-Leg Parlay
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className={getConfidenceColor(parlay.confidence_tier)}>
                          {parlay.confidence_tier.toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className="border-slate-600 text-slate-300">
                          {parlay.api_version.toUpperCase()}
                        </Badge>
                        {parlay.league_group && (
                          <Badge variant="outline" className="border-slate-600 text-slate-300">
                            {parlay.league_group}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${getEdgeColor(Number(parlay.edge_pct))}`}>
                        +{Number(parlay.edge_pct).toFixed(1)}%
                      </div>
                      <div className="text-xs text-slate-400">Edge</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Key Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-4 p-4 bg-slate-700/30 rounded-lg">
                    <div>
                      <div className="text-xs text-slate-400 mb-1">Implied Odds</div>
                      <div className="text-lg font-semibold text-white">{Number(parlay.implied_odds).toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 mb-1">Adjusted Prob</div>
                      <div className="text-lg font-semibold text-white">{(Number(parlay.adjusted_prob) * 100).toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 mb-1">Correlation</div>
                      <div className="text-lg font-semibold text-white">-{(Number(parlay.correlation_penalty) * 100).toFixed(0)}%</div>
                    </div>
                  </div>

                  {/* Legs */}
                  <div className="space-y-3 mb-4">
                    <div className="text-sm font-semibold text-slate-300 mb-2">Legs:</div>
                    {parlay.legs.map((leg, index) => (
                      <div key={index} className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-white">
                              {leg.home_team} vs {leg.away_team}
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                              {getOutcomeLabel(leg.outcome)} • {Number(leg.decimal_odds).toFixed(2)} odds
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-emerald-400">
                              +{normalizeLegEdge(Number(leg.edge)).toFixed(2)}%
                            </div>
                            <div className="text-xs text-slate-400">
                              {(Number(leg.model_prob) * 100).toFixed(1)}% prob
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Kickoff Times */}
                  <div className="flex items-center justify-between text-xs text-slate-400 pt-4 border-t border-slate-700">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>Earliest: {formatDate(parlay.earliest_kickoff)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>Latest: {formatDate(parlay.latest_kickoff)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Stats Footer */}
        {filteredParlays.length > 0 && (
          <Card className="bg-slate-800/60 border-slate-700 mt-6">
            <CardContent className="p-4">
              <div className="text-sm text-slate-400 text-center">
                Showing {filteredParlays.length} of {parlays.length} parlays
              </div>
            </CardContent>
          </Card>
        )}

        {/* Parlay Detail Modal */}
        <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <Layers className="h-6 w-6 text-emerald-400" />
                Parlay Details
              </DialogTitle>
            </DialogHeader>
            {selectedParlay && (
              <div className="space-y-6 mt-4">
                {/* Header Info */}
                <div className="flex items-start justify-between p-4 bg-slate-800/60 rounded-lg">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={getConfidenceColor(selectedParlay.confidence_tier)}>
                        {selectedParlay.confidence_tier.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="border-slate-600 text-slate-300">
                        {selectedParlay.api_version.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="border-slate-600 text-slate-300">
                        {selectedParlay.leg_count} Legs
                      </Badge>
                      {selectedParlay.league_group && (
                        <Badge variant="outline" className="border-slate-600 text-slate-300">
                          {selectedParlay.league_group}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-slate-400">
                      Created: {formatDate(selectedParlay.created_at)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-3xl font-bold ${getEdgeColor(Number(selectedParlay.edge_pct))}`}>
                      +{Number(selectedParlay.edge_pct).toFixed(1)}%
                    </div>
                    <div className="text-xs text-slate-400">Edge</div>
                  </div>
                </div>

                {/* Key Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="bg-slate-800/60 border-slate-700">
                    <CardContent className="p-4">
                      <div className="text-xs text-slate-400 mb-1">Implied Odds</div>
                      <div className="text-xl font-semibold text-white">{Number(selectedParlay.implied_odds).toFixed(2)}</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-slate-800/60 border-slate-700">
                    <CardContent className="p-4">
                      <div className="text-xs text-slate-400 mb-1">Combined Prob</div>
                      <div className="text-xl font-semibold text-white">{(Number(selectedParlay.combined_prob) * 100).toFixed(1)}%</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-slate-800/60 border-slate-700">
                    <CardContent className="p-4">
                      <div className="text-xs text-slate-400 mb-1">Adjusted Prob</div>
                      <div className="text-xl font-semibold text-white">{(Number(selectedParlay.adjusted_prob) * 100).toFixed(1)}%</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-slate-800/60 border-slate-700">
                    <CardContent className="p-4">
                      <div className="text-xs text-slate-400 mb-1">Correlation Penalty</div>
                      <div className="text-xl font-semibold text-white">-{(Number(selectedParlay.correlation_penalty) * 100).toFixed(0)}%</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Legs Detail - Betting Information */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Target className="h-5 w-5 text-emerald-400" />
                    Parlay Legs - Betting Details
                  </h3>
                  {loadingLegs ? (
                    <Card className="bg-slate-800/60 border-slate-700">
                      <CardContent className="p-6 text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-emerald-400 mx-auto mb-4" />
                        <p className="text-slate-400">Loading leg details...</p>
                      </CardContent>
                    </Card>
                  ) : selectedParlay.legs && selectedParlay.legs.length > 0 ? (
                    <div className="space-y-4">
                      {selectedParlay.legs.map((leg, index) => (
                        <Card key={index} className="bg-slate-800/60 border-slate-700 hover:border-emerald-500/50 transition-colors">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline" className="border-emerald-500/50 text-emerald-400">
                                    Leg {index + 1} of {selectedParlay.leg_count}
                                  </Badge>
                                  <span className="text-base font-semibold text-white">
                                    {leg.home_team} vs {leg.away_team}
                                  </span>
                                </div>
                                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 mt-3">
                                  <div className="text-xs text-emerald-400 mb-1 font-semibold">BET TO PLACE:</div>
                                  <div className="text-lg font-bold text-white">
                                    {getOutcomeLabel(leg.outcome)}
                                  </div>
                                  <div className="text-sm text-slate-300 mt-1">
                                    {leg.outcome === 'H' && `${leg.home_team} to Win`}
                                    {leg.outcome === 'A' && `${leg.away_team} to Win`}
                                    {leg.outcome === 'D' && 'Match to End in a Draw'}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right ml-4">
                                <div className="text-2xl font-bold text-emerald-400">
                                  +{normalizeLegEdge(Number(leg.edge)).toFixed(2)}%
                                </div>
                                <div className="text-xs text-slate-400">Edge</div>
                              </div>
                            </div>
                            
                            {/* Betting Details Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-700">
                              <div className="bg-slate-700/30 rounded-lg p-3">
                                <div className="text-xs text-slate-400 mb-1">Decimal Odds</div>
                                <div className="text-lg font-bold text-white">{Number(leg.decimal_odds).toFixed(2)}</div>
                                <div className="text-xs text-slate-500 mt-1">
                                  {((1 / Number(leg.decimal_odds)) * 100).toFixed(1)}% implied
                                </div>
                              </div>
                              <div className="bg-slate-700/30 rounded-lg p-3">
                                <div className="text-xs text-slate-400 mb-1">Model Probability</div>
                                <div className="text-lg font-bold text-emerald-400">{(Number(leg.model_prob) * 100).toFixed(1)}%</div>
                                <div className="text-xs text-slate-500 mt-1">AI confidence</div>
                              </div>
                              <div className="bg-slate-700/30 rounded-lg p-3">
                                <div className="text-xs text-slate-400 mb-1">Value Edge</div>
                                <div className="text-lg font-bold text-emerald-400">
                                  +{((Number(leg.model_prob) - (1 / Number(leg.decimal_odds))) * 100).toFixed(1)}%
                                </div>
                                <div className="text-xs text-slate-500 mt-1">vs market</div>
                              </div>
                              <div className="bg-slate-700/30 rounded-lg p-3">
                                <div className="text-xs text-slate-400 mb-1">Match ID</div>
                                <div className="text-sm font-semibold text-white">{leg.match_id}</div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="mt-2 text-xs text-blue-400 hover:text-blue-300"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    router.push(`/match/${leg.match_id}`)
                                  }}
                                >
                                  View Match →
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      
                      {/* Combined Parlay Info */}
                      <Card className="bg-gradient-to-r from-emerald-900/40 to-blue-900/40 border-emerald-500/50">
                        <CardContent className="p-4">
                          <h4 className="text-sm font-semibold text-white mb-3">Combined Parlay Information</h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div>
                              <div className="text-xs text-slate-400 mb-1">Total Parlay Odds</div>
                              <div className="text-xl font-bold text-emerald-400">{Number(selectedParlay.implied_odds).toFixed(2)}</div>
                              <div className="text-xs text-slate-500 mt-1">
                                {((1 / Number(selectedParlay.implied_odds)) * 100).toFixed(2)}% win probability
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-400 mb-1">Adjusted Probability</div>
                              <div className="text-xl font-bold text-white">{(Number(selectedParlay.adjusted_prob) * 100).toFixed(1)}%</div>
                              <div className="text-xs text-slate-500 mt-1">After correlation</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-400 mb-1">Expected Value</div>
                              <div className="text-xl font-bold text-emerald-400">+{Number(selectedParlay.edge_pct).toFixed(1)}%</div>
                              <div className="text-xs text-slate-500 mt-1">Overall edge</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ) : (
                    <Card className="bg-slate-800/60 border-slate-700">
                      <CardContent className="p-6 text-center">
                        <Target className="h-12 w-12 text-slate-500 mx-auto mb-4" />
                        <h4 className="text-lg font-semibold text-white mb-2">Legs Not Available</h4>
                        <p className="text-slate-400 mb-4">
                          The legs for this parlay haven't been synced yet. Please sync parlays to load leg details.
                        </p>
                        {isAdmin && (
                          <Button onClick={syncParlays} disabled={syncing} className="bg-emerald-600 hover:bg-emerald-700">
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Sync Parlays Now
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Timing Info */}
                <Card className="bg-slate-800/60 border-slate-700">
                  <CardContent className="p-4">
                    <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-blue-400" />
                      Kickoff Times
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-slate-400 mb-1">Earliest Kickoff</div>
                        <div className="text-sm font-medium text-white">{formatDate(selectedParlay.earliest_kickoff)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400 mb-1">Latest Kickoff</div>
                        <div className="text-sm font-medium text-white">{formatDate(selectedParlay.latest_kickoff)}</div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-700">
                      <div className="text-xs text-slate-400 mb-1">Kickoff Window</div>
                      <div className="text-sm font-medium text-white capitalize">{selectedParlay.kickoff_window}</div>
                    </div>
                  </CardContent>
                </Card>

                {/* Additional Info */}
                <Card className="bg-slate-800/60 border-slate-700">
                  <CardContent className="p-4">
                    <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                      <Info className="h-4 w-4 text-blue-400" />
                      Additional Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-slate-400 mb-1">Parlay Type</div>
                        <div className="text-white font-medium capitalize">{selectedParlay.parlay_type.replace('_', ' ')}</div>
                      </div>
                      <div>
                        <div className="text-slate-400 mb-1">Status</div>
                        <Badge className={selectedParlay.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}>
                          {selectedParlay.status.toUpperCase()}
                        </Badge>
                      </div>
                      <div>
                        <div className="text-slate-400 mb-1">Last Synced</div>
                        <div className="text-white font-medium">{formatDate(selectedParlay.synced_at)}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* AI Trading Analysis */}
                <div className="mt-6">
                  <ParlayAIAnalysis parlayId={selectedParlay.parlay_id} />
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

