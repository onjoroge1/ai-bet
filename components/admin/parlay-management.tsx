"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  RefreshCw, 
  Layers, 
  TrendingUp, 
  Calendar, 
  Target, 
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Users,
  DollarSign,
  Filter,
  Search
} from "lucide-react"
import { toast } from "sonner"

interface ParlayLeg {
  id: string
  matchId: string
  outcome: string
  outcomeLabel?: string
  homeTeam: string
  awayTeam: string
  modelProb: number
  decimalOdds: number
  edge: number
  legOrder: number
  hasTeamNames?: boolean
}

interface ParlayQuality {
  isTradable: boolean
  hasLowEdge: boolean
  hasLowProbability: boolean
  riskLevel: 'low' | 'medium' | 'high' | 'very_high'
}

interface Parlay {
  id: string
  parlayId: string
  legCount: number
  legs: ParlayLeg[]
  combinedProb: number
  correlationPenalty: number
  adjustedProb: number
  impliedOdds: number
  edgePct: number
  confidenceTier: string
  parlayType: string
  leagueGroup: string | null
  earliestKickoff: string
  latestKickoff: string
  kickoffWindow: string
  status: string
  createdAt: string
  syncedAt: string
  purchaseCount: number
  totalRevenue: number
  quality?: ParlayQuality
  performance: {
    totalPurchases: number
    totalWins: number
    totalLosses: number
    winRate: number | null
    roi: number | null
  } | null
}

interface PotentialParlay {
  matchId: string
  homeTeam: string
  awayTeam: string
  league: string
  kickoffDate: string
  legs: Array<{
    market: string
    side: string
    probability: number
    description: string
  }>
  combinedProb: number
  fairOdds: number
  confidence: 'high' | 'medium' | 'low'
}

export function ParlayManagement() {
  const [parlays, setParlays] = useState<Parlay[]>([])
  const [potentialParlays, setPotentialParlays] = useState<PotentialParlay[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [activeTab, setActiveTab] = useState<'existing' | 'potential'>('existing')
  const [filters, setFilters] = useState({
    status: 'active',
    type: 'all',
    confidence: 'all',
    search: ''
  })

  const loadParlays = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        status: filters.status,
        ...(filters.type !== 'all' && { type: filters.type }),
        ...(filters.confidence !== 'all' && { confidence: filters.confidence }),
        limit: '100'
      })

      const res = await fetch(`/api/admin/parlays/list?${params}`)
      if (!res.ok) throw new Error('Failed to load parlays')
      
      const data = await res.json()
      setParlays(data.parlays || [])
    } catch (error) {
      toast.error('Failed to load parlays')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const generatePotentialParlays = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/admin/parlays/generate', {
        method: 'POST'
      })
      if (!res.ok) throw new Error('Failed to generate parlays')
      
      const data = await res.json()
      setPotentialParlays(data.parlays || [])
      toast.success(`Generated ${data.count} potential parlays`)
    } catch (error) {
      toast.error('Failed to generate parlays')
      console.error(error)
    } finally {
      setGenerating(false)
    }
  }

  const syncParlays = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/admin/parlays/sync-generated', {
        method: 'POST'
      })
      if (!res.ok) throw new Error('Failed to sync parlays')
      
      const data = await res.json()
      toast.success(data.message || 'Parlays synced successfully')
      await loadParlays()
    } catch (error) {
      toast.error('Failed to sync parlays')
      console.error(error)
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'existing') {
      loadParlays()
    }
  }, [activeTab, filters])

  const filteredParlays = parlays.filter(parlay => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      return (
        parlay.parlayId.toLowerCase().includes(searchLower) ||
        parlay.leagueGroup?.toLowerCase().includes(searchLower) ||
        parlay.legs.some(leg => 
          leg.homeTeam.toLowerCase().includes(searchLower) ||
          leg.awayTeam.toLowerCase().includes(searchLower)
        )
      )
    }
    return true
  })

  const filteredPotential = potentialParlays.filter(parlay => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      return (
        parlay.matchId.toLowerCase().includes(searchLower) ||
        parlay.league.toLowerCase().includes(searchLower) ||
        parlay.homeTeam.toLowerCase().includes(searchLower) ||
        parlay.awayTeam.toLowerCase().includes(searchLower)
      )
    }
    return true
  })

  return (
    <div className="space-y-6">
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center space-x-2">
                <Layers className="w-6 h-6 text-emerald-400" />
                <span>Parlay Management</span>
              </CardTitle>
              <p className="text-slate-400 mt-1">Manage and sync parlays from prediction data</p>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                onClick={generatePotentialParlays}
                disabled={generating}
                variant="outline"
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Target className="w-4 h-4 mr-2" />
                    Generate Potential
                  </>
                )}
              </Button>
              <Button
                onClick={syncParlays}
                disabled={syncing}
                variant="default"
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {syncing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync to Database
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'existing' | 'potential')}>
            <TabsList className="grid w-full grid-cols-2 bg-slate-700/50">
              <TabsTrigger value="existing">Existing Parlays ({parlays.length})</TabsTrigger>
              <TabsTrigger value="potential">Potential Parlays ({potentialParlays.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="existing" className="space-y-4 mt-4">
              <div className="flex items-center space-x-2">
                <div className="flex-1">
                  <Input
                    placeholder="Search parlays..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="bg-slate-700/50 border-slate-600 text-white"
                  />
                </div>
                <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
                  <SelectTrigger className="w-40 bg-slate-700/50 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="settled">Settled</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filters.type} onValueChange={(v) => setFilters({ ...filters, type: v })}>
                  <SelectTrigger className="w-40 bg-slate-700/50 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="single_game">Single Game</SelectItem>
                    <SelectItem value="same_league">Same League</SelectItem>
                    <SelectItem value="cross_league">Cross League</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filters.confidence} onValueChange={(v) => setFilters({ ...filters, confidence: v })}>
                  <SelectTrigger className="w-40 bg-slate-700/50 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Confidence</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                </div>
              ) : filteredParlays.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4" />
                  <p>No parlays found</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {filteredParlays.map((parlay) => (
                    <Card key={parlay.id} className="bg-slate-700/30 border-slate-600">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <Badge variant={parlay.confidenceTier === 'high' ? 'default' : 'secondary'}>
                                {parlay.confidenceTier}
                              </Badge>
                              <Badge variant="outline">{parlay.parlayType}</Badge>
                              <Badge variant="outline">{parlay.status}</Badge>
                              {parlay.leagueGroup && (
                                <Badge variant="outline">{parlay.leagueGroup}</Badge>
                              )}
                            </div>
                            <div className="space-y-3">
                              {parlay.legs.map((leg, idx) => {
                                const hasValidTeams = leg.homeTeam && leg.homeTeam !== 'TBD' && leg.awayTeam && leg.awayTeam !== 'TBD'
                                const outcomeText = leg.outcomeLabel || 
                                  (leg.outcome === 'H' ? `${leg.homeTeam} to Win` :
                                   leg.outcome === 'A' ? `${leg.awayTeam} to Win` :
                                   leg.outcome === 'D' ? 'Draw' : leg.outcome)
                                
                                return (
                                  <div key={leg.id} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-slate-400 text-xs font-semibold">Leg {idx + 1}</span>
                                      <Badge variant="outline" className="text-xs">
                                        {(leg.modelProb * 100).toFixed(1)}% prob
                                      </Badge>
                                    </div>
                                    {hasValidTeams ? (
                                      <>
                                        <div className="text-white font-medium mb-1">
                                          {leg.homeTeam} vs {leg.awayTeam}
                                        </div>
                                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded px-2 py-1 mt-2">
                                          <div className="text-xs text-emerald-400 font-semibold mb-0.5">BET TO PLACE:</div>
                                          <div className="text-sm font-bold text-white">{outcomeText}</div>
                                        </div>
                                      </>
                                    ) : (
                                      <div className="text-yellow-400 italic text-sm">
                                        Match ID: {leg.matchId} (Teams not available)
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                            {parlay.quality && (
                              <div className="mt-3 p-2 rounded border" style={{
                                backgroundColor: parlay.quality.isTradable ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                borderColor: parlay.quality.isTradable ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'
                              }}>
                                <div className="flex items-center space-x-2 mb-1">
                                  {parlay.quality.isTradable ? (
                                    <Badge variant="default" className="bg-emerald-600">✓ Tradable</Badge>
                                  ) : (
                                    <Badge variant="destructive">⚠ Not Recommended</Badge>
                                  )}
                                  <Badge variant="outline" className="text-xs">
                                    Risk: {parlay.quality.riskLevel.replace('_', ' ')}
                                  </Badge>
                                </div>
                                {parlay.quality.hasLowEdge && (
                                  <div className="text-xs text-yellow-400">⚠ Low edge ({parlay.edgePct.toFixed(2)}%)</div>
                                )}
                                {parlay.quality.hasLowProbability && (
                                  <div className="text-xs text-yellow-400">⚠ Low probability ({(parlay.combinedProb * 100).toFixed(1)}%)</div>
                                )}
                              </div>
                            )}
                            <div className="flex items-center space-x-4 mt-3 text-sm text-slate-400">
                              <span>Edge: <span className={parlay.edgePct >= 5 ? "text-emerald-400" : "text-yellow-400"}>{parlay.edgePct.toFixed(2)}%</span></span>
                              <span>Odds: <span className="text-white">{parlay.impliedOdds.toFixed(2)}</span></span>
                              <span>Prob: <span className="text-white">{(parlay.combinedProb * 100).toFixed(1)}%</span></span>
                              <span className="flex items-center">
                                <Users className="w-4 h-4 mr-1" />
                                {parlay.purchaseCount}
                              </span>
                              <span className="flex items-center">
                                <DollarSign className="w-4 h-4 mr-1" />
                                ${parlay.totalRevenue.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="potential" className="space-y-4 mt-4">
              {potentialParlays.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Target className="w-12 h-12 mx-auto mb-4" />
                  <p>No potential parlays generated yet</p>
                  <p className="text-sm mt-2">Click "Generate Potential" to analyze prediction data</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {filteredPotential.map((parlay, idx) => (
                    <Card key={idx} className="bg-slate-700/30 border-slate-600">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <Badge variant={parlay.confidence === 'high' ? 'default' : 'secondary'}>
                                {parlay.confidence}
                              </Badge>
                              <span className="text-white font-semibold">
                                {parlay.homeTeam} vs {parlay.awayTeam}
                              </span>
                              <span className="text-slate-400 text-sm">{parlay.league}</span>
                            </div>
                            <div className="space-y-1 mb-3">
                              {parlay.legs.map((leg, legIdx) => (
                                <div key={legIdx} className="text-sm text-slate-300">
                                  • {leg.description} ({(leg.probability * 100).toFixed(1)}%)
                                </div>
                              ))}
                            </div>
                            <div className="flex items-center space-x-4 text-sm text-slate-400">
                              <span>Combined Prob: <span className="text-white">{(parlay.combinedProb * 100).toFixed(1)}%</span></span>
                              <span>Fair Odds: <span className="text-white">{parlay.fairOdds.toFixed(2)}</span></span>
                              <span className="flex items-center">
                                <Calendar className="w-4 h-4 mr-1" />
                                {new Date(parlay.kickoffDate).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

