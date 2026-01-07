"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Lock, Crown, ArrowRight, Zap, TrendingUp, Shield, Eye, Layers, CheckCircle, HelpCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface ParayLeg {
  edge: number
  outcome: string
  match_id: number
  away_team: string
  home_team: string
  model_prob: number
  decimal_odds: number
}

interface ParayPreview {
  parlay_id: string
  is_preview: boolean
  masked?: boolean
  leg_count: number
  legs?: ParayLeg[] // Optional for masked parlays
  combined_prob?: number // Optional for masked parlays
  edge_pct?: number // Optional for masked parlays
  confidence_tier: string
  parlay_type?: string // Optional for masked parlays
  earliest_kickoff?: string // Optional for masked parlays
  latest_kickoff?: string // Optional for masked parlays
  quality: {
    score?: number // Optional for masked parlays
    is_tradable?: boolean // Optional for masked parlays
    risk_level: string
  }
}

/**
 * Client Component - Handles interactive functionality
 */
export default function PublicParlaysClient() {
  const router = useRouter()
  const [parlays, setParlays] = useState<ParayPreview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchParlays()
  }, [])

  const fetchParlays = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/parlays/preview')
      if (!response.ok) {
        throw new Error('Failed to fetch parlays')
      }
      const data = await response.json()
      setParlays(data.parlays || [])
    } catch (err) {
      console.error('Error fetching parlays:', err)
      setError(err instanceof Error ? err.message : 'Failed to load parlays')
    } finally {
      setLoading(false)
    }
  }

  const normalizeLegEdge = (edge: number): number => {
    const numEdge = Number(edge)
    if (isNaN(numEdge)) return 0
    if (Math.abs(numEdge) > 1) {
      return numEdge
    }
    return numEdge * 100
  }

  const getOutcomeLabel = (outcome: string): string => {
    const labels: Record<string, string> = {
      'H': 'Home Win',
      'A': 'Away Win',
      'D': 'Draw',
      'OVER_2_5': 'Over 2.5 Goals',
      'UNDER_2_5': 'Under 2.5 Goals',
      'OVER_3_5': 'Over 3.5 Goals',
      'UNDER_3_5': 'Under 3.5 Goals',
      'BTTS_YES': 'Both Teams To Score',
      'BTTS_NO': 'No Both Teams To Score',
      'CS_H': 'Clean Sheet Home',
      'CS_A': 'Clean Sheet Away',
      'WTN_H': 'Win To Nil Home',
      'WTN_A': 'Win To Nil Away',
    }
    return labels[outcome] || outcome
  }

  const getRiskColor = (riskLevel: string): string => {
    switch (riskLevel) {
      case 'low': return 'border-green-500/30 text-green-400'
      case 'medium': return 'border-yellow-500/30 text-yellow-400'
      case 'high': return 'border-orange-500/30 text-orange-400'
      default: return 'border-red-500/30 text-red-400'
    }
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const previewParlays = parlays.filter(p => p.is_preview)
  const maskedParlays = parlays.filter(p => !p.is_preview && p.masked)

  return (
    <TooltipProvider>
      {/* Paray Generator Section */}
      <section className="mb-12" id="preview">
        <div className="mb-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Available Parlays
          </h2>
          <p className="text-lg text-slate-300 max-w-3xl">
            Explore our AI-generated parlays. Preview the top 2 parlays with full details, or upgrade to view all {parlays.length}+ premium parlays.
          </p>
        </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400 mx-auto mb-4"></div>
            <p className="text-slate-400">Loading premium parlays...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="bg-red-900/20 border-red-500/30 max-w-2xl mx-auto">
          <CardContent className="p-6 text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <Button onClick={fetchParlays} variant="outline" className="border-red-500/30 text-red-400">
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Paray Cards */}
      {!loading && !error && (
        <>
          {parlays.length > 0 ? (
            <div className="space-y-6 mb-8">
              {/* Preview Parlays (First 2 - Full Data) */}
              {previewParlays.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {previewParlays.map((parlay, index) => (
                    <Card key={parlay.parlay_id} className="bg-slate-800/60 border-emerald-500/30 border-2">
                      <CardHeader>
                        <div className="flex items-start justify-between mb-2">
                          <CardTitle className="text-white flex items-center gap-2">
                            <Eye className="h-5 w-5 text-emerald-400" />
                            Free Preview #{index + 1}
                          </CardTitle>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1.5 cursor-help">
                                <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-500/30">
                                  ✓ Tradable
                                </Badge>
                                <HelpCircle className="h-4 w-4 text-slate-400 hover:text-slate-300" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-800 border-slate-700 text-slate-200 max-w-xs">
                              <p className="text-sm">
                                Tradable = meets minimum edge (≥5%), probability (≥5%), and correlation thresholds.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="border-slate-600 text-slate-300">
                            {parlay.leg_count} Legs
                          </Badge>
                          <Badge variant="outline" className={getRiskColor(parlay.quality.risk_level)}>
                            Risk: {parlay.quality.risk_level.replace('_', ' ')}
                          </Badge>
                          <Badge variant="outline" className="border-slate-600 text-slate-300">
                            {parlay.confidence_tier.toUpperCase()}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Key Metrics */}
                        {parlay.edge_pct !== undefined && parlay.combined_prob !== undefined && (
                          <div className="grid grid-cols-2 gap-4 p-4 bg-slate-900/50 rounded-lg">
                            <div>
                              <div className="text-xs text-slate-400 mb-1">Edge</div>
                              <div className="text-2xl font-bold text-emerald-400">
                                +{Number(parlay.edge_pct).toFixed(1)}%
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-400 mb-1">Win Probability</div>
                              <div className="text-2xl font-bold text-white">
                                {(Number(parlay.combined_prob) * 100).toFixed(1)}%
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Legs Preview */}
                        {parlay.legs && parlay.legs.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-sm font-semibold text-slate-300 mb-2">Legs:</div>
                            {parlay.legs.slice(0, 2).map((leg, legIndex) => (
                              <div key={legIndex} className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
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
                                      +{normalizeLegEdge(leg.edge).toFixed(2)}%
                                    </div>
                                    <div className="text-xs text-slate-400">
                                      {(Number(leg.model_prob) * 100).toFixed(1)}% prob
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {parlay.legs.length > 2 && (
                              <div className="text-xs text-slate-500 text-center py-2">
                                +{parlay.legs.length - 2} more leg{parlay.legs.length - 2 > 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Locked CTA */}
                        <Button 
                          disabled 
                          variant="outline" 
                          className="w-full border-slate-600 text-slate-400 cursor-not-allowed"
                        >
                          <Lock className="h-4 w-4 mr-2" />
                          View Full AI Analysis (Premium Required)
                        </Button>

                        {/* Kickoff Times */}
                        {parlay.earliest_kickoff && (
                          <div className="text-xs text-slate-500 text-center pt-2 border-t border-slate-700">
                            Kickoff: {formatDate(parlay.earliest_kickoff)}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Masked Parlays (Remaining - Partial Data) */}
              {maskedParlays.length > 0 && (
                <div className="mt-8">
                  <div className="mb-4">
                    <h3 className="text-2xl font-bold text-white mb-2">
                      More Premium Parlays ({maskedParlays.length}+ available)
                    </h3>
                    <p className="text-slate-400 text-sm">
                      Subscribe to view full details, edge percentages, and AI analysis for all parlays.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {maskedParlays.map((parlay) => (
                      <Card key={parlay.parlay_id} className="bg-slate-800/40 border-slate-700/50 relative overflow-hidden">
                        {/* Lock overlay effect */}
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[1px] z-10 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <Lock className="h-8 w-8 text-yellow-400" />
                        </div>
                        <CardHeader className="relative z-0">
                          <div className="flex items-start justify-between mb-2">
                            <CardTitle className="text-white text-lg flex items-center gap-2">
                              <Lock className="h-4 w-4 text-slate-500" />
                              Premium Paray
                            </CardTitle>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="border-slate-600 text-slate-300">
                              {parlay.leg_count} Legs
                            </Badge>
                            <Badge variant="outline" className={getRiskColor(parlay.quality.risk_level)}>
                              {parlay.quality.risk_level.replace('_', ' ')}
                            </Badge>
                            <Badge variant="outline" className="border-slate-600 text-slate-300">
                              {parlay.confidence_tier.toUpperCase()}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="relative z-0 space-y-4">
                          {/* Masked Metrics */}
                          <div className="grid grid-cols-2 gap-4 p-4 bg-slate-900/50 rounded-lg">
                            <div>
                              <div className="text-xs text-slate-400 mb-1">Edge</div>
                              <div className="text-2xl font-bold text-slate-600 flex items-center gap-1">
                                <Lock className="h-4 w-4" />
                                <span className="text-lg">Locked</span>
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-400 mb-1">Win Probability</div>
                              <div className="text-2xl font-bold text-slate-600 flex items-center gap-1">
                                <Lock className="h-4 w-4" />
                                <span className="text-lg">Locked</span>
                              </div>
                            </div>
                          </div>

                          {/* Locked CTA */}
                          <Link href="/dashboard/parlays">
                            <Button 
                              variant="outline" 
                              className="w-full border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
                            >
                              <Lock className="h-4 w-4 mr-2" />
                              Unlock to View Details
                            </Button>
                          </Link>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* View All CTA */}
              <div className="mt-8 text-center">
                <Link href="/dashboard/parlays">
                  <Button size="lg" className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white">
                    <Layers className="h-5 w-5 mr-2" />
                    View All Parlays in Premium Dashboard
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <Card className="bg-slate-800/60 border-slate-700 max-w-2xl mx-auto mb-12">
              <CardContent className="p-12 text-center">
                <p className="text-slate-400 mb-4">No premium parlays available at the moment.</p>
                <p className="text-slate-500 text-sm">Check back soon for new parlay recommendations.</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
      </section>
    </TooltipProvider>
  )
}

