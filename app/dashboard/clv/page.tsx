'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { calculateCLV, formatPercent, formatStake } from '@/lib/clv-calculator'
import {
  Activity, TrendingUp, AlertCircle, RefreshCw, DollarSign, Target,
  Search, Zap, Clock, Shield, BarChart3, ChevronRight, Info, Filter,
  ArrowUpRight, ArrowDownRight, Loader2, Eye, Copy, Timer,
} from 'lucide-react'
import { toast } from 'sonner'
import { PremiumGate } from '@/components/premium-gate'
import { ConfidenceRing, SkeletonCard } from '@/components/match/shared'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CLVOpportunity {
  alert_id: string
  match_id: number
  league: string
  outcome: string
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getOutcomeLabel = (outcome: string) => {
  switch (outcome) {
    case 'H': return 'Home Win'
    case 'D': return 'Draw'
    case 'A': return 'Away Win'
    default: return outcome
  }
}

const getOutcomeBadgeColor = (outcome: string) => {
  switch (outcome) {
    case 'H': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    case 'A': return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    case 'D': return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  }
}

const getExpiryCountdown = (expiresAt: string): string => {
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  if (mins < 60) return `${mins}m left`
  return `${hours}h ${mins % 60}m left`
}

const getEdgeLevel = (confidence: number): { label: string; color: string } => {
  if (confidence >= 85) return { label: 'Excellent', color: 'text-emerald-400' }
  if (confidence >= 70) return { label: 'Strong', color: 'text-emerald-400' }
  if (confidence >= 55) return { label: 'Good', color: 'text-yellow-400' }
  if (confidence >= 40) return { label: 'Moderate', color: 'text-orange-400' }
  return { label: 'Weak', color: 'text-red-400' }
}

const TIME_WINDOWS = [
  { value: 'all', label: 'All', icon: Activity },
  { value: 'T-72to48', label: '72–48h', icon: Clock },
  { value: 'T-48to24', label: '48–24h', icon: Timer },
  { value: 'T-24to2', label: '24–2h', icon: Zap },
] as const

// ─── CLV Opportunity Card ─────────────────────────────────────────────────────

function CLVCard({
  opportunity,
  onClick,
}: {
  opportunity: CLVOpportunity
  onClick: () => void
}) {
  const calc = calculateCLV(opportunity.best_odds, opportunity.market_composite_odds)
  const edgeLevel = getEdgeLevel(calc.confidence)
  const isPositiveEV = calc.evPercent > 0
  const expiry = getExpiryCountdown(opportunity.expires_at)
  const isExpiringSoon = new Date(opportunity.expires_at).getTime() - Date.now() < 3600000 // < 1h

  return (
    <Card
      className={cn(
        "bg-slate-800/60 border-slate-700/50 hover:border-emerald-500/40 transition-all duration-200 cursor-pointer group overflow-hidden",
        calc.confidence >= 70 && "ring-1 ring-emerald-500/20"
      )}
      onClick={onClick}
    >
      {/* Confidence accent bar */}
      <div className={cn(
        "h-1",
        calc.confidence >= 70 ? 'bg-emerald-500' :
        calc.confidence >= 55 ? 'bg-yellow-500' :
        calc.confidence >= 40 ? 'bg-orange-500' : 'bg-red-500'
      )} />

      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <Badge variant="outline" className="border-slate-600 text-slate-300 text-[10px]">
                {opportunity.league}
              </Badge>
              <Badge className={getOutcomeBadgeColor(opportunity.outcome)}>
                {getOutcomeLabel(opportunity.outcome)}
              </Badge>
              {isExpiringSoon && (
                <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px] animate-pulse">
                  ⏰ Expiring
                </Badge>
              )}
            </div>
            <h3 className="text-sm font-semibold text-white truncate">
              {opportunity.home_team && opportunity.away_team
                ? `${opportunity.home_team} vs ${opportunity.away_team}`
                : `Match #${opportunity.match_id}`}
            </h3>
            {opportunity.match_description && !opportunity.home_team && (
              <p className="text-xs text-slate-500 truncate">{opportunity.match_description}</p>
            )}
          </div>
          <ConfidenceRing score={calc.confidence} size={48} />
        </div>

        {/* Bet Instruction */}
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5 mb-3">
          <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider mb-0.5">Bet This</p>
          <p className="text-sm font-bold text-white">
            {getOutcomeLabel(opportunity.outcome)} @ {opportunity.best_odds.toFixed(2)}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-slate-700/30 rounded-lg p-2 text-center">
            <p className="text-[10px] text-slate-500">CLV</p>
            <p className={cn(
              "text-sm font-bold",
              opportunity.clv_pct > 0 ? 'text-emerald-400' : 'text-red-400'
            )}>
              {opportunity.clv_pct > 0 ? '+' : ''}{opportunity.clv_pct.toFixed(1)}%
            </p>
          </div>
          <div className="bg-slate-700/30 rounded-lg p-2 text-center">
            <p className="text-[10px] text-slate-500">EV</p>
            <p className={cn(
              "text-sm font-bold",
              isPositiveEV ? 'text-emerald-400' : 'text-red-400'
            )}>
              {isPositiveEV ? '+' : ''}{calc.evPercent.toFixed(1)}%
            </p>
          </div>
          <div className="bg-slate-700/30 rounded-lg p-2 text-center">
            <p className="text-[10px] text-slate-500">Kelly</p>
            <p className="text-sm font-bold text-blue-400">
              {formatStake(calc.recommendedStake)}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-700/30">
          <div className="flex items-center gap-2">
            <Badge className={cn("text-[10px]", edgeLevel.color)}>
              {edgeLevel.label} Edge
            </Badge>
            <span className="text-[10px] text-slate-500">{opportunity.books_used} books</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Clock className="w-3 h-3" />
            {expiry}
            <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function CLVStatsBar({ opportunities }: { opportunities: CLVOpportunity[] }) {
  const stats = useMemo(() => {
    if (opportunities.length === 0) return null
    let totalEV = 0
    let highConfCount = 0
    let avgConf = 0

    for (const opp of opportunities) {
      const calc = calculateCLV(opp.best_odds, opp.market_composite_odds)
      totalEV += calc.evPercent
      avgConf += calc.confidence
      if (calc.confidence >= 70) highConfCount++
    }

    return {
      total: opportunities.length,
      avgConfidence: Math.round(avgConf / opportunities.length),
      highConfidence: highConfCount,
      totalEV: totalEV,
      avgCLV: opportunities.reduce((s, o) => s + o.clv_pct, 0) / opportunities.length,
    }
  }, [opportunities])

  if (!stats) return null

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {[
        { label: 'Opportunities', value: stats.total, icon: Activity, color: 'text-white' },
        { label: 'Avg Confidence', value: `${stats.avgConfidence}/100`, icon: Target, color: 'text-emerald-400' },
        { label: 'High Confidence', value: stats.highConfidence, icon: TrendingUp, color: 'text-yellow-400' },
        { label: 'Total EV', value: formatPercent(stats.totalEV, 1), icon: DollarSign, color: stats.totalEV > 0 ? 'text-emerald-400' : 'text-red-400' },
        { label: 'Avg CLV', value: `${stats.avgCLV > 0 ? '+' : ''}${stats.avgCLV.toFixed(1)}%`, icon: BarChart3, color: stats.avgCLV > 0 ? 'text-emerald-400' : 'text-red-400' },
      ].map((stat) => (
        <Card key={stat.label} className="bg-slate-800/40 border-slate-700/40">
          <CardContent className="p-3 flex items-center gap-3">
            <stat.icon className={cn("w-5 h-5 shrink-0", stat.color)} />
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">{stat.label}</p>
              <p className={cn("text-lg font-bold", stat.color)}>{stat.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function CLVDetailModal({
  opportunity,
  open,
  onClose,
}: {
  opportunity: CLVOpportunity | null
  open: boolean
  onClose: () => void
}) {
  if (!opportunity) return null

  const calc = calculateCLV(opportunity.best_odds, opportunity.market_composite_odds)
  const edgeLevel = getEdgeLevel(calc.confidence)
  const isPositiveEV = calc.evPercent > 0
  const expiry = getExpiryCountdown(opportunity.expires_at)

  const copyToClipboard = () => {
    const matchName = opportunity.home_team && opportunity.away_team
      ? `${opportunity.home_team} vs ${opportunity.away_team}`
      : `Match #${opportunity.match_id}`
    const text = [
      `🎯 CLV Opportunity`,
      `Match: ${matchName}`,
      `League: ${opportunity.league}`,
      `Bet: ${getOutcomeLabel(opportunity.outcome)} @ ${opportunity.best_odds.toFixed(2)}`,
      `CLV: ${formatPercent(opportunity.clv_pct)}`,
      `EV: ${formatPercent(calc.evPercent)}`,
      `Confidence: ${calc.confidence}/100`,
      `Kelly Stake: ${formatStake(calc.recommendedStake)}`,
    ].join('\n')
    navigator.clipboard.writeText(text)
    toast.success('CLV details copied!')
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-400" />
            CLV Opportunity Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Match info */}
          <div className="flex items-center justify-between p-4 bg-slate-800/60 rounded-xl border border-slate-700/50">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="border-slate-600 text-slate-300 text-xs">{opportunity.league}</Badge>
                <Badge className={getOutcomeBadgeColor(opportunity.outcome)}>
                  {getOutcomeLabel(opportunity.outcome)}
                </Badge>
                <Badge className={cn("text-xs", edgeLevel.color)}>{edgeLevel.label} Edge</Badge>
              </div>
              <h3 className="text-base font-semibold text-white">
                {opportunity.home_team && opportunity.away_team
                  ? `${opportunity.home_team} vs ${opportunity.away_team}`
                  : `Match #${opportunity.match_id}`}
              </h3>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Expires: {expiry} • Window: {opportunity.window}
              </p>
            </div>
            <ConfidenceRing score={calc.confidence} size={60} />
          </div>

          {/* Bet instruction */}
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
            <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider mb-1">Place This Bet</p>
            <p className="text-xl font-bold text-white">{getOutcomeLabel(opportunity.outcome)}</p>
            <p className="text-sm text-slate-300 mt-0.5">
              {opportunity.outcome === 'H' && `${opportunity.home_team || 'Home Team'} to Win`}
              {opportunity.outcome === 'A' && `${opportunity.away_team || 'Away Team'} to Win`}
              {opportunity.outcome === 'D' && 'Match to End in a Draw'}
            </p>
          </div>

          {/* Key metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Best Odds', value: opportunity.best_odds.toFixed(2), color: 'text-white' },
              { label: 'Composite Odds', value: opportunity.market_composite_odds.toFixed(2), color: 'text-slate-300' },
              { label: 'CLV %', value: formatPercent(opportunity.clv_pct), color: opportunity.clv_pct > 0 ? 'text-emerald-400' : 'text-red-400' },
              { label: 'EV %', value: formatPercent(calc.evPercent), color: isPositiveEV ? 'text-emerald-400' : 'text-red-400' },
            ].map((stat) => (
              <div key={stat.label} className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/30">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{stat.label}</p>
                <p className={cn("text-xl font-bold", stat.color)}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Staking */}
          <div className="bg-gradient-to-r from-emerald-900/30 to-blue-900/30 border border-emerald-500/20 rounded-xl p-4">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">Recommended Staking</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-slate-400 mb-1">Half-Kelly</p>
                <p className="text-xl font-bold text-emerald-400">{formatStake(calc.recommendedStake)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Full Kelly</p>
                <p className="text-xl font-bold text-white">{formatStake(calc.kellyFraction)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Confidence</p>
                <p className="text-xl font-bold text-blue-400">{calc.confidence}/100</p>
              </div>
            </div>
          </div>

          {/* Details row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/30">
              <p className="text-[10px] text-slate-500 uppercase mb-1">Stability</p>
              <p className="text-sm font-semibold text-white">{opportunity.stability}</p>
            </div>
            <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/30">
              <p className="text-[10px] text-slate-500 uppercase mb-1">Books Used</p>
              <p className="text-sm font-semibold text-white">{opportunity.books_used}</p>
            </div>
            <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/30">
              <p className="text-[10px] text-slate-500 uppercase mb-1">Composite Method</p>
              <p className="text-sm font-semibold text-white">{opportunity.composite_method}</p>
            </div>
            <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/30">
              <p className="text-[10px] text-slate-500 uppercase mb-1">Book ID</p>
              <p className="text-sm font-semibold text-white">#{opportunity.best_book_id}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button onClick={copyToClipboard} variant="outline" className="flex-1 bg-slate-800 border-slate-600 text-white hover:bg-slate-700">
              <Copy className="w-4 h-4 mr-2" />
              Copy Details
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function CLVSkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CLVDashboard() {
  const [opportunities, setOpportunities] = useState<CLVOpportunity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedWindow, setSelectedWindow] = useState('all')
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval] = useState(30)
  const [hasPremiumAccess, setHasPremiumAccess] = useState<boolean | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [selectedOpp, setSelectedOpp] = useState<CLVOpportunity | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'confidence' | 'ev' | 'clv' | 'expiry'>('confidence')

  const fetchOpportunities = useCallback(async (window: string) => {
    setIsLoading(true)
    try {
      // Try cache first, then fallback to live
      const cacheUrl = `/api/clv/cache?window=${window}&useCache=true`
      let response = await fetch(cacheUrl)

      if (!response.ok) {
        const liveUrl = window === 'all'
          ? '/api/clv/opportunities'
          : `/api/clv/opportunities?window=${window}`
        response = await fetch(liveUrl)
      }

      if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`)

      const data: CLVResponse = await response.json()
      setOpportunities(data.opportunities || [])
      setLastUpdated(data.meta?.generated_at || new Date().toISOString())
    } catch (error) {
      console.error('Error fetching CLV opportunities:', error)
      toast.error('Failed to load CLV opportunities')
      setOpportunities([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(() => {
        fetchOpportunities(selectedWindow)
      }, refreshInterval * 1000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, refreshInterval, selectedWindow, fetchOpportunities])

  useEffect(() => {
    checkAuthAndPremium()
    fetchOpportunities(selectedWindow)
  }, [selectedWindow, fetchOpportunities])

  const checkAuthAndPremium = async () => {
    try {
      const authRes = await fetch('/api/auth/session', { cache: 'no-store', credentials: 'include' })
      const session = await authRes.json()
      setIsAdmin(session?.user?.role?.toLowerCase() === 'admin')

      const premiumRes = await fetch('/api/premium/check')
      if (premiumRes.ok) {
        const data = await premiumRes.json()
        setHasPremiumAccess(data.hasAccess)
      } else {
        setHasPremiumAccess(false)
      }
    } catch {
      setHasPremiumAccess(false)
    }
  }

  // ── Filtering & sorting ────────────────────────────────────────────
  const filteredOpportunities = useMemo(() => {
    let result = [...opportunities].filter(opp =>
      opp.best_odds > 0 && opp.market_composite_odds > 0
    )

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(opp =>
        opp.league.toLowerCase().includes(q) ||
        opp.home_team?.toLowerCase().includes(q) ||
        opp.away_team?.toLowerCase().includes(q) ||
        opp.match_description?.toLowerCase().includes(q) ||
        String(opp.match_id).includes(q)
      )
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'confidence': {
          const confA = calculateCLV(a.best_odds, a.market_composite_odds).confidence
          const confB = calculateCLV(b.best_odds, b.market_composite_odds).confidence
          return confB - confA
        }
        case 'ev': {
          const evA = calculateCLV(a.best_odds, a.market_composite_odds).evPercent
          const evB = calculateCLV(b.best_odds, b.market_composite_odds).evPercent
          return evB - evA
        }
        case 'clv':
          return b.clv_pct - a.clv_pct
        case 'expiry':
          return new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime()
        default:
          return 0
      }
    })

    return result
  }, [opportunities, searchQuery, sortBy])

  // ── Premium gate ───────────────────────────────────────────────────
  if (hasPremiumAccess === false && !isAdmin) {
    return (
      <PremiumGate
        title="Premium CLV Tracker Access"
        description="Access real-time Closing Line Value opportunities with premium subscription."
        featureName="CLV Tracker"
      />
    )
  }

  // ── Loading ────────────────────────────────────────────────────────
  if (isLoading && opportunities.length === 0) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="h-8 bg-slate-700/40 rounded w-64 mb-2 animate-pulse" />
            <div className="h-4 bg-slate-700/30 rounded w-96 animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-slate-800/40 rounded-xl border border-slate-700/40 animate-pulse" />
          ))}
        </div>
        <CLVSkeletonGrid />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Page Header ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="w-7 h-7 text-emerald-400" />
            CLV Tracker
            {autoRefresh && (
              <span className="relative flex h-2.5 w-2.5 ml-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
            )}
          </h1>
          <p className="text-slate-400 mt-1">
            Real-time Closing Line Value opportunities with AI confidence scoring
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setAutoRefresh(!autoRefresh)}
            variant="ghost"
            size="sm"
            className={cn(
              "text-xs",
              autoRefresh ? 'text-emerald-400' : 'text-slate-500'
            )}
          >
            <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", autoRefresh && "animate-spin")} />
            {autoRefresh ? `Live (${refreshInterval}s)` : 'Paused'}
          </Button>
          <Button
            onClick={() => fetchOpportunities(selectedWindow)}
            disabled={isLoading}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Last updated ─────────────────────────────────────────── */}
      {lastUpdated && (
        <p className="text-xs text-slate-500 -mt-4">
          Last updated: {new Date(lastUpdated).toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
          })}
        </p>
      )}

      {/* ── Stats Bar ────────────────────────────────────────────── */}
      <CLVStatsBar opportunities={filteredOpportunities} />

      {/* ── Time Window Tabs ─────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TIME_WINDOWS.map(tw => {
          const isActive = selectedWindow === tw.value
          return (
            <Button
              key={tw.value}
              variant={isActive ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedWindow(tw.value)}
              className={cn(
                "whitespace-nowrap gap-1.5",
                isActive
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              )}
            >
              <tw.icon className="w-3.5 h-3.5" />
              {tw.label}
            </Button>
          )
        })}
      </div>

      {/* ── Search + Sort ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Search by team, league, or match ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>
        <div className="flex gap-2">
          {[
            { id: 'confidence', label: 'Confidence' },
            { id: 'ev', label: 'EV %' },
            { id: 'clv', label: 'CLV %' },
            { id: 'expiry', label: 'Expiring Soon' },
          ].map(opt => (
            <Button
              key={opt.id}
              variant={sortBy === opt.id ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSortBy(opt.id as typeof sortBy)}
              className={cn(
                "text-xs",
                sortBy === opt.id
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-500 hover:text-white'
              )}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* ── Opportunity Grid ─────────────────────────────────────── */}
      {filteredOpportunities.length === 0 ? (
        <Card className="bg-slate-800/40 border-slate-700/40">
          <CardContent className="py-16 text-center">
            <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No CLV Opportunities</h3>
            <p className="text-slate-400 mb-4 max-w-md mx-auto">
              No opportunities found for this time window. Try selecting a different window or refresh.
            </p>
            <Button onClick={() => fetchOpportunities(selectedWindow)} className="bg-emerald-600 hover:bg-emerald-500 text-white">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredOpportunities.map((opp) => (
              <CLVCard
                key={opp.alert_id}
                opportunity={opp}
                onClick={() => {
                  setSelectedOpp(opp)
                  setShowDetailModal(true)
                }}
              />
            ))}
          </div>

          <p className="text-center text-sm text-slate-500 pt-2">
            Showing {filteredOpportunities.length} of {opportunities.length} opportunities
          </p>
        </>
      )}

      {/* ── Info Card ────────────────────────────────────────────── */}
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
          <div className="text-xs text-slate-400 leading-relaxed">
            <p className="font-medium text-slate-300 mb-1">How CLV Works</p>
            <p>
              Closing Line Value (CLV) measures how much the odds moved in your favor after you placed a bet.
              Positive CLV indicates you got better odds than the closing line — the strongest predictor of
              long-term betting profitability. Confidence scores are calculated from expected value using a
              logistic model. Kelly Criterion sizing uses half-Kelly for risk control (max 5% of bankroll).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Detail Modal ─────────────────────────────────────────── */}
      <CLVDetailModal
        opportunity={selectedOpp}
        open={showDetailModal}
        onClose={() => setShowDetailModal(false)}
      />
    </div>
  )
}
