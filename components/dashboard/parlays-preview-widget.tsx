"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Layers, TrendingUp, ArrowRight, Loader2, Lock } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface ParlayLeg {
  edge: number
  outcome: string
  match_id: number
  away_team: string
  home_team: string
  model_prob: number
  decimal_odds: number
}

interface Parlay {
  parlay_id: string
  api_version: string
  leg_count: number
  legs: ParlayLeg[]
  edge_pct: number
  confidence_tier: string
  implied_odds: number
  status: string
}

export function ParlaysPreviewWidget() {
  const router = useRouter()
  const [parlays, setParlays] = useState<Parlay[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchParlays()
  }, [])

  const fetchParlays = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/parlays?status=active&limit=2&sort=edge_desc')
      
      if (response.ok) {
        const data = await response.json()
        setParlays(data.parlays || [])
      }
    } catch (error) {
      console.error('Error fetching parlays:', error)
    } finally {
      setLoading(false)
    }
  }

  const getOutcomeLabel = (outcome: string) => {
    switch (outcome) {
      case 'H': return 'Home'
      case 'A': return 'Away'
      case 'D': return 'Draw'
      default: return outcome
    }
  }

  const getConfidenceColor = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'high': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
      case 'low': return 'bg-orange-500/20 text-orange-400 border-orange-500/50'
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/50'
    }
  }

  const getEdgeColor = (edge: number) => {
    if (edge >= 0.2) return 'text-emerald-400'
    if (edge >= 0.1) return 'text-green-400'
    if (edge >= 0) return 'text-blue-400'
    return 'text-red-400'
  }

  if (loading) {
    return (
      <Card className="bg-slate-800/60 border-slate-700">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (parlays.length === 0) {
    return (
      <Card className="bg-slate-800/60 border-slate-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <Layers className="h-5 w-5 text-emerald-400" />
              Top Parlays
            </CardTitle>
            <Link href="/dashboard/parlays">
              <Button variant="ghost" size="sm" className="text-emerald-400 hover:text-emerald-300">
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-slate-400 text-sm text-center py-4">No active parlays available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-slate-800/60 border-slate-700">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
            <Layers className="h-5 w-5 text-emerald-400" />
            Top Parlays
          </CardTitle>
          <Link href="/dashboard/parlays">
            <Button variant="ghost" size="sm" className="text-emerald-400 hover:text-emerald-300">
              View All <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {parlays.map((parlay) => (
          <div
            key={parlay.parlay_id}
            className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/50 hover:border-emerald-500/50 transition-colors cursor-pointer"
            onClick={() => router.push(`/dashboard/parlays?parlay=${parlay.parlay_id}`)}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={getConfidenceColor(parlay.confidence_tier)}>
                    {parlay.confidence_tier.toUpperCase()}
                  </Badge>
                  <Badge variant="outline" className="border-slate-500 text-slate-300 text-xs">
                    {parlay.leg_count} Legs
                  </Badge>
                  <Badge variant="outline" className="border-slate-500 text-slate-300 text-xs">
                    {parlay.api_version.toUpperCase()}
                  </Badge>
                </div>
                {parlay.legs && parlay.legs.length > 0 && (
                  <div className="text-xs text-slate-400 space-y-1 mt-2">
                    {parlay.legs.slice(0, 2).map((leg, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-slate-500">•</span>
                        <span className="text-slate-300">
                          {leg.home_team} vs {leg.away_team}
                        </span>
                        <Badge variant="outline" className="border-slate-600 text-slate-400 text-xs px-1.5 py-0">
                          {getOutcomeLabel(leg.outcome)}
                        </Badge>
                      </div>
                    ))}
                    {parlay.legs.length > 2 && (
                      <div className="text-slate-500 text-xs ml-4">
                        +{parlay.legs.length - 2} more leg{parlay.legs.length - 2 > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="text-right ml-4">
                <div className={`text-xl font-bold ${getEdgeColor(Number(parlay.edge_pct))}`}>
                  {Number(parlay.edge_pct) >= 0 ? '+' : ''}{Number(parlay.edge_pct).toFixed(1)}%
                </div>
                <div className="text-xs text-slate-400">Edge</div>
                <div className="text-sm text-slate-300 mt-1">
                  {Number(parlay.implied_odds).toFixed(2)} odds
                </div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

