'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sparkles,
  TrendingUp,
  Layers,
  Activity,
  ChevronRight,
  Clock,
  ArrowRight,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/** Shape returned by /api/dashboard/recommendations */
interface Recommendations {
  topMatches: Array<{
    id: string
    matchId: string
    homeTeam: string
    awayTeam: string
    league: string
    startTime: string | null
    confidence: number | null
    prediction: string | null
    slug: string | null
  }>
  topParlay: {
    id: string
    parlayType: string
    combinedProb: number | null
    edgePct: number | null
    legCount: number
    legs: Array<{
      matchDescription: string | null
      marketType: string
      outcome: string
      consensusProb: number | null
    }>
  } | null
  topCLV: {
    homeTeam: string | null
    awayTeam: string | null
    league: string
    selection: string
    entryOdds: number
    closeOdds: number
    matchDate: string
  } | null
  generatedAt: string
}

function getConfidenceColor(conf: number | null): string {
  if (!conf) return 'text-slate-400'
  if (conf >= 75) return 'text-emerald-400'
  if (conf >= 65) return 'text-yellow-400'
  return 'text-orange-400'
}

function getRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'TBD'
  const diff = new Date(dateStr).getTime() - Date.now()
  const hours = Math.round(diff / 3600000)
  if (hours < 0) return 'Live'
  if (hours < 1) return 'In < 1h'
  if (hours < 24) return `In ${hours}h`
  return `In ${Math.round(hours / 24)}d`
}

/**
 * AIRecommendations — "Today's Intelligence Feed" widget for the overview page.
 * Shows top AI picks, the best pre-built parlay, and the top CLV opportunity.
 */
export function AIRecommendations() {
  const [data, setData] = useState<Recommendations | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard/recommendations')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader className="pb-3">
          <div className="h-5 bg-slate-700/50 rounded w-48 animate-pulse" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-slate-700/30 rounded-lg animate-pulse" />
          ))}
        </CardContent>
      </Card>
    )
  }

  const hasData =
    (data?.topMatches?.length ?? 0) > 0 || data?.topParlay || data?.topCLV

  if (!hasData) {
    return (
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardContent className="py-10 text-center">
          <Sparkles className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No recommendations available yet.</p>
          <p className="text-xs text-slate-500 mt-1">
            AI picks refresh every 30 minutes.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Today&apos;s Intelligence Feed</h2>
            <p className="text-xs text-slate-500">AI-curated picks refreshed every 30 min</p>
          </div>
        </div>
        {data?.generatedAt && (
          <span className="text-xs text-slate-500 hidden sm:block">
            Updated {new Date(data.generatedAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* ── Top Matches ─────────────────────────────────── */}
      {(data?.topMatches?.length ?? 0) > 0 && (
        <Card className="bg-slate-800/50 border-slate-700/50 overflow-hidden">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              High-Confidence Matches
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {data!.topMatches.map((m) => (
              <Link
                key={m.id}
                href={m.slug ? `/match/${m.slug}` : '/dashboard/matches'}
                className="flex items-center justify-between p-3 bg-slate-700/30 hover:bg-slate-700/50 rounded-lg transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {m.homeTeam} <span className="text-slate-500 text-xs mx-1">vs</span> {m.awayTeam}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-slate-500 truncate">{m.league}</span>
                    {m.startTime && (
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {getRelativeTime(m.startTime)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-3 shrink-0">
                  {m.confidence && (
                    <div className="text-right">
                      <p className={cn('text-sm font-bold', getConfidenceColor(m.confidence))}>
                        {m.confidence}%
                      </p>
                      <p className="text-[10px] text-slate-500">confidence</p>
                    </div>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 transition-colors" />
                </div>
              </Link>
            ))}
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="w-full text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 mt-1"
            >
              <Link href="/dashboard/matches">
                View all matches
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Top AI Parlay ────────────────────────────────── */}
      {data?.topParlay && (
        <Card className="bg-gradient-to-br from-slate-800/60 via-slate-800/40 to-orange-900/20 border-orange-500/20 overflow-hidden">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Layers className="w-4 h-4 text-orange-400" />
              AI Parlay Pick
              <Badge className="text-[10px] bg-orange-500/20 text-orange-300 border-orange-500/30 ml-1">
                {data.topParlay.legCount}-leg
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-1.5 mb-3">
              {data.topParlay.legs.slice(0, 3).map((leg, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">{i + 1}.</span>
                  <span className="text-slate-300 truncate flex-1">
                    {leg.matchDescription ?? 'Match'}
                  </span>
                  <span className="text-orange-300 font-medium shrink-0">{leg.outcome}</span>
                </div>
              ))}
              {data.topParlay.legCount > 3 && (
                <p className="text-[10px] text-slate-500 pl-4">
                  +{data.topParlay.legCount - 3} more leg{data.topParlay.legCount - 3 > 1 ? 's' : ''}
                </p>
              )}
            </div>
            <div className="flex items-center justify-between">
              {data.topParlay.combinedProb && (
                <div>
                  <span className="text-lg font-bold text-orange-400">
                    {Math.round(data.topParlay.combinedProb * 100)}%
                  </span>
                  <span className="text-xs text-slate-500 ml-1">combined prob</span>
                </div>
              )}
              <Button
                asChild
                size="sm"
                className="bg-orange-600/80 hover:bg-orange-500 text-white text-xs"
              >
                <Link href="/dashboard/parlays">
                  View Parlay
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Top CLV Opportunity ───────────────────────────── */}
      {data?.topCLV && (
        <Card className="bg-gradient-to-br from-slate-800/60 via-slate-800/40 to-blue-900/20 border-blue-500/20 overflow-hidden">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              Top CLV Opportunity
              <Badge className="text-[10px] bg-blue-500/20 text-blue-300 border-blue-500/30 ml-1">
                <Zap className="w-2.5 h-2.5 mr-0.5" />
                Live
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-medium text-white">
                  {data.topCLV.homeTeam && data.topCLV.awayTeam
                    ? `${data.topCLV.homeTeam} vs ${data.topCLV.awayTeam}`
                    : 'Match Opportunity'}
                </p>
                <p className="text-xs text-slate-500">{data.topCLV.league}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-blue-400">
                  {data.topCLV.entryOdds.toFixed(2)}
                </p>
                <p className="text-[10px] text-slate-500">best odds</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Pick: <span className="text-white font-medium">{data.topCLV.selection}</span>
              </span>
              <Button
                asChild
                size="sm"
                className="bg-blue-600/80 hover:bg-blue-500 text-white text-xs"
              >
                <Link href="/dashboard/clv">
                  View CLV
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

