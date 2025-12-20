"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Activity, ArrowRight, Loader2, TrendingUp } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { calculateCLV, formatPercent } from "@/lib/clv-calculator"

interface CLVOpportunity {
  alert_id: string
  match_id: number
  league: string
  outcome: string
  best_odds: number
  market_composite_odds: number
  clv_pct: number
  home_team?: string
  away_team?: string
}

export function CLVPreviewWidget() {
  const router = useRouter()
  const [opportunities, setOpportunities] = useState<CLVOpportunity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOpportunities()
  }, [])

  const fetchOpportunities = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/clv/opportunities?limit=2')
      
      if (response.ok) {
        const data = await response.json()
        // Sort by CLV % descending and take top 2
        const sorted = (data.opportunities || [])
          .filter((opp: CLVOpportunity) => opp.best_odds > 0 && opp.market_composite_odds > 0)
          .sort((a: CLVOpportunity, b: CLVOpportunity) => b.clv_pct - a.clv_pct)
          .slice(0, 2)
        setOpportunities(sorted)
      }
    } catch (error) {
      console.error('Error fetching CLV opportunities:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatOutcome = (outcome: string) => {
    switch(outcome) {
      case 'H': return 'Home Win'
      case 'D': return 'Draw'
      case 'A': return 'Away Win'
      default: return outcome
    }
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

  if (opportunities.length === 0) {
    return (
      <Card className="bg-slate-800/60 border-slate-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-400" />
              CLV Opportunities
            </CardTitle>
            <Link href="/dashboard/clv">
              <Button variant="ghost" size="sm" className="text-emerald-400 hover:text-emerald-300">
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-slate-400 text-sm text-center py-4">No CLV opportunities available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-slate-800/60 border-slate-700">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-400" />
            CLV Opportunities
          </CardTitle>
          <Link href="/dashboard/clv">
            <Button variant="ghost" size="sm" className="text-emerald-400 hover:text-emerald-300">
              View All <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {opportunities.map((opp) => {
          const calc = calculateCLV(opp.best_odds, opp.market_composite_odds)
          
          return (
            <div
              key={opp.alert_id}
              className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/50 hover:border-emerald-500/50 transition-colors cursor-pointer"
              onClick={() => router.push(`/dashboard/clv?match=${opp.match_id}`)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {opp.home_team && opp.away_team ? (
                      <span className="text-sm font-semibold text-white">
                        {opp.home_team} vs {opp.away_team}
                      </span>
                    ) : (
                      <span className="text-sm font-semibold text-white">
                        Match #{opp.match_id}
                      </span>
                    )}
                    <Badge variant="outline" className="border-slate-500 text-slate-300 text-xs">
                      {opp.league}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className={
                      opp.outcome === 'H' ? 'bg-blue-500' : 
                      opp.outcome === 'D' ? 'bg-gray-500' : 
                      'bg-green-500'
                    }>
                      {formatOutcome(opp.outcome)}
                    </Badge>
                    <span className="text-xs text-slate-400">
                      {opp.best_odds.toFixed(2)} → {opp.market_composite_odds.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <div className={`text-xl font-bold ${opp.clv_pct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatPercent(opp.clv_pct)}
                  </div>
                  <div className="text-xs text-slate-400">CLV</div>
                  <div className="flex items-center gap-1 mt-1">
                    <TrendingUp className="h-3 w-3 text-emerald-400" />
                    <span className="text-xs text-slate-300">
                      {calc.confidence.toFixed(0)}% conf
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

