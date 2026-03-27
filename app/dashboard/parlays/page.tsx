"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Calendar, Trophy, TrendingUp, Loader2, Search, Layers, Zap, Target,
  RefreshCw, Info, ChevronRight, ChevronDown, Filter, Copy, ExternalLink,
  Sparkles, Shield, Users, BarChart3, Clock, Star, AlertCircle, Check,
  ChevronUp, Goal, Percent, Plus,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PremiumGate } from "@/components/premium-gate"
import { cn } from "@/lib/utils"
import { ConfidenceRing, SkeletonCard } from "@/components/match/shared"
import { BettingSlip, BetSlipItem } from "@/components/dashboard/betting-slip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParlayLeg {
  edge: number
  outcome: string
  match_id: number
  away_team: string
  home_team: string
  model_prob: number
  decimal_odds: number
  premium_score?: number | null
  premium_tier?: string | null
}

interface ParlayQuality {
  score: number
  is_tradable: boolean
  risk_level: 'low' | 'medium' | 'high' | 'very_high'
  has_low_edge: boolean
  has_low_probability: boolean
}

interface ParlayPremium {
  score: number
  tier: string
  stars: number
  reasons: string[]
  avg_leg_score: number | null
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
  premium?: ParlayPremium | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getOutcomeLabel = (outcome: string) => {
  switch (outcome) {
    case 'H': return 'Home Win'
    case 'A': return 'Away Win'
    case 'D': return 'Draw'
    case 'OVER': return 'Over (Goals)'
    case 'UNDER': return 'Under (Goals)'
    case 'YES': return 'Both Teams Score'
    case 'NO': return 'Both Teams Not to Score'
    case 'DNB_H': return 'Home Win (DNB)'
    case 'DNB_A': return 'Away Win (DNB)'
    default: return outcome
  }
}

const getOutcomeBadgeColor = (outcome: string) => {
  switch (outcome) {
    case 'H': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    case 'A': return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    case 'D': return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    case 'OVER':
    case 'YES': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    case 'UNDER':
    case 'NO': return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  }
}

/** Render star rating for premium parlays */
const PremiumStars = ({ premium }: { premium?: ParlayPremium | null }) => {
  if (!premium) return null
  const stars = premium.stars || 0
  if (stars === 0) return null

  const color = stars >= 4 ? 'text-yellow-400' : stars >= 3 ? 'text-emerald-400' : 'text-slate-400'

  return (
    <span className={`inline-flex items-center gap-0.5 ${color}`} title={`Premium: ${premium.score}/100 — ${premium.reasons?.join(', ') || ''}`}>
      {Array.from({ length: Math.min(stars, 5) }).map((_, i) => (
        <svg key={i} className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  )
}

const getConfidenceTierColor = (tier: string) => {
  switch (tier) {
    case 'high': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
    case 'medium': return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
    case 'low': return 'bg-red-500/15 text-red-400 border-red-500/30'
    default: return 'bg-slate-500/15 text-slate-400 border-slate-500/30'
  }
}

const getRiskColor = (level: string) => {
  switch (level) {
    case 'low': return 'text-emerald-400'
    case 'medium': return 'text-yellow-400'
    case 'high': return 'text-orange-400'
    case 'very_high': return 'text-red-400'
    default: return 'text-slate-400'
  }
}

const getRelativeTime = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  if (diffMs < 0) return "Started"
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  if (diffMins < 60) return `${diffMins}m`
  if (diffHours < 24) return `${diffHours}h ${diffMins % 60}m`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d`
}

const normalizeLegEdge = (edge: number): number => {
  const num = Number(edge)
  if (isNaN(num)) return 0
  if (Math.abs(num) > 1) return Math.abs(num) > 100 ? num / 10 : num
  return num * 100
}

const getParlayTypeLabel = (type: string): string => {
  switch (type) {
    case 'auto_parlay': return 'Auto Parlay'
    case 'player_scorer': return 'Player Props'
    case 'recommended': return 'Recommended'
    case 'same_league': return 'Same League'
    case 'cross_league': return 'AI Multi-Match'
    case 'single_game': return 'AI Same-Game'
    case 'multi_game': return 'AI Multi-Match'
    default: return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }
}

const getParlayTypeIcon = (type: string) => {
  switch (type) {
    case 'auto_parlay': return Zap
    case 'player_scorer': return Users
    case 'recommended': return Star
    case 'cross_league': return Sparkles
    case 'single_game': return Sparkles
    case 'multi_game': return Sparkles
    default: return Layers
  }
}

// ─── Parlay Category Tabs ─────────────────────────────────────────────────────

const PARLAY_CATEGORIES = [
  { id: 'all', label: 'All Parlays', icon: Layers, description: 'All available parlays' },
  { id: 'ai_picks', label: 'AI Picks', icon: Sparkles, description: 'AI cross-match & same-game parlays (≥70% confidence)' },
  { id: 'recommended', label: 'Recommended', icon: Star, description: 'AI-recommended high-value picks' },
  { id: 'auto_parlay', label: 'Auto Parlays', icon: Zap, description: 'Auto-generated match result combos' },
  { id: 'player_scorer', label: 'Player Props', icon: Users, description: 'Player goal scorer parlays' },
] as const

// ─── Parlay Card Component ────────────────────────────────────────────────────

function ParlayCard({
  parlay,
  onClick,
  onAddToSlip,
}: {
  parlay: Parlay
  onClick: () => void
  /** Optional: adds all parlay legs to the bet slip */
  onAddToSlip?: () => void
}) {
  const confidenceScore = Math.round(Number(parlay.adjusted_prob) * 100)
  const TypeIcon = getParlayTypeIcon(parlay.parlay_type)
  const isHighEdge = Number(parlay.edge_pct) >= 15
  const kickoffCountdown = getRelativeTime(parlay.earliest_kickoff)

  return (
    <Card
      className={cn(
        "bg-slate-800/60 border-slate-700/50 hover:border-emerald-500/40 transition-all duration-200 cursor-pointer group overflow-hidden",
        isHighEdge && "ring-1 ring-emerald-500/20"
      )}
      onClick={onClick}
    >
      {/* Top accent bar */}
      <div className={cn(
        "h-1",
        parlay.confidence_tier === 'high' ? 'bg-emerald-500' :
        parlay.confidence_tier === 'medium' ? 'bg-yellow-500' : 'bg-red-500'
      )} />

      <CardContent className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <TypeIcon className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                {getParlayTypeLabel(parlay.parlay_type)}
              </span>
            </div>
            <Badge className={getConfidenceTierColor(parlay.confidence_tier)}>
              {parlay.confidence_tier.toUpperCase()}
            </Badge>
            <PremiumStars premium={parlay.premium} />
          </div>
          <ConfidenceRing score={confidenceScore} size={44} />
        </div>

        {/* Legs preview */}
        <div className="space-y-2 mb-3">
          {parlay.legs.slice(0, 3).map((leg, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between py-1.5 px-2.5 bg-slate-700/30 rounded-lg"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-[10px] font-bold text-slate-500 w-4 shrink-0">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  {leg.home_team && leg.home_team !== 'TBD' && leg.away_team && leg.away_team !== 'TBD' ? (
                    <p className="text-sm font-medium text-white truncate">
                      {leg.home_team} <span className="text-slate-500">vs</span> {leg.away_team}
                    </p>
                  ) : (
                    <p className="text-sm font-medium text-white truncate">
                      {leg.outcome}
                    </p>
                  )}
                </div>
              </div>
              {/* Premium leg indicator */}
              {leg.premium_score != null && leg.premium_score >= 60 && (
                <svg className={cn("w-3 h-3 shrink-0", leg.premium_score >= 80 ? "text-yellow-400 fill-current" : "text-emerald-400 fill-current")} viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              )}
              {/* Show outcome badge for all recognised outcome types */}
              <Badge className={cn("shrink-0 ml-2 text-[10px]", getOutcomeBadgeColor(leg.outcome))}>
                {getOutcomeLabel(leg.outcome)}
              </Badge>
            </div>
          ))}
          {parlay.legs.length > 3 && (
            <p className="text-xs text-slate-500 pl-7">
              +{parlay.legs.length - 3} more leg{parlay.legs.length - 3 > 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-700/50">
          <div className="text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Edge</p>
            <p className={cn(
              "text-sm font-bold",
              Number(parlay.edge_pct) >= 15 ? 'text-emerald-400' :
              Number(parlay.edge_pct) >= 10 ? 'text-yellow-400' : 'text-slate-300'
            )}>
              +{Number(parlay.edge_pct).toFixed(1)}%
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Odds</p>
            <p className="text-sm font-bold text-white">
              {Number(parlay.implied_odds).toFixed(2)}x
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Kickoff</p>
            <p className="text-sm font-medium text-slate-300 flex items-center justify-center gap-1">
              <Clock className="w-3 h-3" />
              {kickoffCountdown}
            </p>
          </div>
        </div>

        {/* Bottom row: quality badges + Add to Slip */}
        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-700/30">
          {parlay.quality && (
            <>
              {parlay.quality.is_tradable ? (
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                  <Shield className="w-2.5 h-2.5 mr-1" /> Tradable
                </Badge>
              ) : (
                <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-[10px]">
                  Risky
                </Badge>
              )}
            </>
          )}
          <div className="flex-1" />
          {onAddToSlip ? (
            <button
              onClick={(e) => { e.stopPropagation(); onAddToSlip() }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 text-[11px] font-medium transition-colors border border-emerald-600/30"
            >
              <Plus className="w-3 h-3" />
              Add to Slip
            </button>
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function ParlaySkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsBar({ parlays }: { parlays: Parlay[] }) {
  const stats = useMemo(() => {
    if (parlays.length === 0) return null
    const avgEdge = parlays.reduce((s, p) => s + Number(p.edge_pct), 0) / parlays.length
    const highConf = parlays.filter(p => p.confidence_tier === 'high').length
    const tradable = parlays.filter(p => p.quality?.is_tradable).length
    const avgOdds = parlays.reduce((s, p) => s + Number(p.implied_odds), 0) / parlays.length
    return { avgEdge, highConf, tradable, avgOdds, total: parlays.length }
  }, [parlays])

  if (!stats) return null

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {[
        { label: 'Total Parlays', value: stats.total, icon: Layers, color: 'text-white' },
        { label: 'Avg Edge', value: `+${stats.avgEdge.toFixed(1)}%`, icon: TrendingUp, color: 'text-emerald-400' },
        { label: 'High Confidence', value: stats.highConf, icon: Target, color: 'text-yellow-400' },
        { label: 'Tradable', value: stats.tradable, icon: Shield, color: 'text-emerald-400' },
        { label: 'Avg Odds', value: `${stats.avgOdds.toFixed(2)}x`, icon: BarChart3, color: 'text-blue-400' },
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

function ParlayDetailModal({
  parlay,
  open,
  onClose,
}: {
  parlay: Parlay | null
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()

  if (!parlay) return null

  const confidenceScore = Math.round(Number(parlay.adjusted_prob) * 100)

  const copyToClipboard = () => {
    const text = parlay.legs.map((leg, i) =>
      `${i + 1}. ${leg.home_team} vs ${leg.away_team} → ${getOutcomeLabel(leg.outcome)} @ ${Number(leg.decimal_odds).toFixed(2)}`
    ).join('\n')
    const header = `🎯 ${parlay.leg_count}-Leg Parlay | Edge: +${Number(parlay.edge_pct).toFixed(1)}% | Odds: ${Number(parlay.implied_odds).toFixed(2)}x`
    navigator.clipboard.writeText(`${header}\n\n${text}`)
    toast.success('Parlay copied to clipboard!')
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Layers className="h-5 w-5 text-emerald-400" />
            Parlay Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Summary header */}
          <div className="flex items-center justify-between p-4 bg-slate-800/60 rounded-xl border border-slate-700/50">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={getConfidenceTierColor(parlay.confidence_tier)}>
                  {parlay.confidence_tier.toUpperCase()}
                </Badge>
                <Badge variant="outline" className="border-slate-600 text-slate-300 text-xs">
                  {parlay.api_version.toUpperCase()}
                </Badge>
                <Badge variant="outline" className="border-slate-600 text-slate-300 text-xs">
                  {parlay.leg_count} Legs
                </Badge>
                {parlay.league_group && (
                  <Badge variant="outline" className="border-slate-600 text-slate-300 text-xs">
                    {parlay.league_group}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Kickoff: {new Date(parlay.earliest_kickoff).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <ConfidenceRing score={confidenceScore} size={56} />
          </div>

          {/* Key stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Edge', value: `+${Number(parlay.edge_pct).toFixed(1)}%`, color: 'text-emerald-400' },
              { label: 'Combined Odds', value: `${Number(parlay.implied_odds).toFixed(2)}x`, color: 'text-white' },
              { label: 'Win Probability', value: `${(Number(parlay.adjusted_prob) * 100).toFixed(1)}%`, color: 'text-blue-400' },
              { label: 'Correlation', value: `-${(Number(parlay.correlation_penalty) * 100).toFixed(0)}%`, color: 'text-orange-400' },
            ].map((stat) => (
              <div key={stat.label} className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/30">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{stat.label}</p>
                <p className={cn("text-xl font-bold", stat.color)}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Legs */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-400" />
              Parlay Legs — Bet These Selections
            </h3>
            <div className="space-y-3">
              {parlay.legs.map((leg, index) => (
                <div key={index} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/40 hover:border-emerald-500/30 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500 bg-slate-700/50 rounded-full w-6 h-6 flex items-center justify-center">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {leg.home_team} vs {leg.away_team}
                        </p>
                        <p className="text-xs text-slate-500">Match #{leg.match_id}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        "text-sm font-bold",
                        normalizeLegEdge(leg.edge) >= 10 ? 'text-emerald-400' : 'text-slate-300'
                      )}>
                        +{normalizeLegEdge(leg.edge).toFixed(1)}%
                      </p>
                      <p className="text-[10px] text-slate-500">edge</p>
                    </div>
                  </div>

                  {/* Bet instruction */}
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 mb-3">
                    <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider mb-1">Place This Bet</p>
                    <p className="text-base font-bold text-white">{getOutcomeLabel(leg.outcome)}</p>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {leg.outcome === 'H' && `${leg.home_team} to Win`}
                      {leg.outcome === 'A' && `${leg.away_team} to Win`}
                      {leg.outcome === 'D' && 'Match to End in a Draw'}
                    </p>
                  </div>

                  {/* Leg stats */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-slate-700/30 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-slate-500">Odds</p>
                      <p className="text-sm font-bold text-white">{Number(leg.decimal_odds).toFixed(2)}</p>
                    </div>
                    <div className="bg-slate-700/30 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-slate-500">AI Prob</p>
                      <p className="text-sm font-bold text-emerald-400">{(Number(leg.model_prob) * 100).toFixed(1)}%</p>
                    </div>
                    <div className="bg-slate-700/30 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-slate-500">Value</p>
                      <p className="text-sm font-bold text-emerald-400">
                        +{((Number(leg.model_prob) - (1 / Number(leg.decimal_odds))) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Combined parlay summary */}
          <div className="bg-gradient-to-r from-emerald-900/30 to-blue-900/30 border border-emerald-500/20 rounded-xl p-4">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">Combined Parlay Summary</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-slate-400 mb-1">Total Odds</p>
                <p className="text-xl font-bold text-emerald-400">{Number(parlay.implied_odds).toFixed(2)}x</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Win Prob</p>
                <p className="text-xl font-bold text-white">{(Number(parlay.adjusted_prob) * 100).toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Expected Value</p>
                <p className="text-xl font-bold text-emerald-400">+{Number(parlay.edge_pct).toFixed(1)}%</p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <Button onClick={copyToClipboard} variant="outline" className="flex-1 bg-slate-800 border-slate-600 text-white hover:bg-slate-700">
              <Copy className="w-4 h-4 mr-2" />
              Copy Selections
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Market Button ────────────────────────────────────────────────────────────

function MarketButton({
  market,
  isSelected,
  odds,
  onClick,
}: {
  market: MarketItem
  isSelected: boolean
  odds: number
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative p-3 rounded-lg border-2 transition-all text-left w-full",
        isSelected
          ? "bg-emerald-500/20 border-emerald-500/50 ring-2 ring-emerald-500/30"
          : "bg-slate-700/20 border-slate-700/50 hover:border-slate-600 hover:bg-slate-700/40"
      )}
    >
      <p className="text-xs font-medium text-slate-300 mb-1 leading-tight">{market.displayLabel}</p>
      <p className="text-base font-bold text-white mb-1">{odds.toFixed(2)}</p>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-400">
          {(market.consensus.prob * 100).toFixed(0)}% prob
        </span>
        <span className={cn(
          "text-[10px] font-semibold",
          market.edge > 0 ? 'text-emerald-400' : 'text-slate-500'
        )}>
          {market.edge > 0 ? '+' : ''}{market.edge.toFixed(1)}%
        </span>
      </div>
      {market.riskLevel && market.riskLevel !== 'low' && (
        <Badge className={cn("mt-1.5 text-[8px] px-1.5 py-0", getRiskBadgeClass(market.riskLevel))}>
          {market.riskLevel} risk
        </Badge>
      )}
      {isSelected && (
        <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/10 rounded-lg">
          <Check className="w-5 h-5 text-emerald-400" />
        </div>
      )}
    </button>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

// ─── Build Your Own Types ───────────────────────────────────────────────────────

interface MatchPick {
  matchId: string
  homeTeam: string
  awayTeam: string
  league: string
  kickoffDate: string
  home: { prob: number; odds: number; edge: number }
  draw: { prob: number; odds: number; edge: number }
  away: { prob: number; odds: number; edge: number }
  prediction?: { side: 'home' | 'draw' | 'away'; confidence: number }
}

interface MarketItem {
  id: string
  marketType: string
  marketSubtype: string | null
  line: number | null
  consensus: { prob: number; confidence: number; agreement: number }
  odds: { decimal: number | null; impliedProb: number | null }
  edge: number
  riskLevel: string
  displayLabel: string
}

interface SelectedPick {
  id: string
  matchId: string
  match: string
  pick: string
  odds: string
  league: string
  homeTeam: string
  awayTeam: string
  betType: string
  prob: number
  edge: number
}

// ─── Market display helpers ────────────────────────────────────────────────────

const MARKET_GROUPS: Record<string, string> = {
  TOTALS: 'Over / Under',
  BTTS: 'Both Teams to Score',
  DOUBLE_CHANCE: 'Double Chance',
  DNB: 'Draw No Bet',
}

function getRiskBadgeClass(level: string): string {
  switch (level) {
    case 'low': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
    case 'medium': return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
    default: return 'bg-red-500/15 text-red-400 border-red-500/30'
  }
}

export default function ParlaysPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [parlays, setParlays] = useState<Parlay[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasPremiumAccess, setHasPremiumAccess] = useState<boolean | null>(null)
  const [selectedParlay, setSelectedParlay] = useState<Parlay | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'edge' | 'odds' | 'kickoff' | 'confidence'>('edge')
  const [activeTab, setActiveTab] = useState<'prebuilt' | 'builder'>('builder')
  
  // Build Your Own state
  const [matches, setMatches] = useState<MatchPick[]>([])
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [selectedPicks, setSelectedPicks] = useState<SelectedPick[]>([])
  const [minProbFilter, setMinProbFilter] = useState<string>('50')
  const [dateFilter, setDateFilter] = useState<string>('all')
  // Additional markets state
  const [expandedMatches, setExpandedMatches] = useState<Record<string, boolean>>({})
  const [matchMarkets, setMatchMarkets] = useState<Record<string, MarketItem[]>>({})
  const [loadingMarkets, setLoadingMarkets] = useState<Record<string, boolean>>({})

  const isAdmin = (session?.user as { role?: string })?.role?.toLowerCase() === 'admin'

  // ── Data fetching ──────────────────────────────────────────────────
  useEffect(() => {
    if (status === 'authenticated') {
      checkPremiumAndFetch()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const checkPremiumAndFetch = async () => {
    try {
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
    fetchParlays()
  }

  const fetchParlays = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        status: 'active',
        tradable_only: 'false',
        min_edge: '0',
        min_prob: '0.03',
        limit: '150',
      })

      const response = await fetch(`/api/parlays?${params.toString()}`)
      if (!response.ok) throw new Error(`Failed to fetch parlays: ${response.status}`)

      const data = await response.json()
      setParlays(data.parlays || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load parlays')
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
        body: JSON.stringify({ version: 'both', include_all: true }),
      })

      if (!response.ok) throw new Error('Failed to sync parlays')
      const result = await response.json()
      toast.success(`Synced ${result.totals.synced} parlays`)
      await fetchParlays()
    } catch {
      toast.error('Failed to sync parlays')
    } finally {
      setSyncing(false)
    }
  }

  // ── Build Your Own: Fetch matches ────────────────────────────────────
  const fetchMatches = async () => {
    try {
      setLoadingMatches(true)
      const response = await fetch('/api/market?status=upcoming&limit=100&mode=lite')
      if (!response.ok) throw new Error('Failed to fetch matches')
      
      const data = await response.json()
      const rawMatches = data.matches || []
      
      // Transform to MatchPick format
      const transformed: MatchPick[] = rawMatches
        .filter((m: any) => {
          // Filter by date
          if (dateFilter === 'today') {
            const matchDate = new Date(m.kickoff_utc || m.kickoffDate)
            const today = new Date()
            return matchDate.toDateString() === today.toDateString()
          }
          return true
        })
        .map((m: any) => {
          // Extract odds from novig_current or consensus
          const novig = m.odds?.novig_current || m.odds?.consensus
          const probs = m.models?.v1_consensus?.probs || m.models?.v2_lightgbm?.probs || {}
          
          // Convert probabilities to odds if needed
          const homeProb = probs.home || (novig?.home ? novig.home : 0.33)
          const drawProb = probs.draw || (novig?.draw ? novig.draw : 0.33)
          const awayProb = probs.away || (novig?.away ? novig.away : 0.34)
          
          const homeOdds = novig?.home ? (1 / novig.home) : (homeProb > 0 ? 1 / homeProb : 2.0)
          const drawOdds = novig?.draw ? (1 / novig.draw) : (drawProb > 0 ? 1 / drawProb : 3.0)
          const awayOdds = novig?.away ? (1 / novig.away) : (awayProb > 0 ? 1 / awayProb : 2.0)
          
          // Calculate edge (model prob vs implied prob from odds)
          const homeEdge = ((homeProb - (1 / homeOdds)) * 100)
          const drawEdge = ((drawProb - (1 / drawOdds)) * 100)
          const awayEdge = ((awayProb - (1 / awayOdds)) * 100)
          
          // Get prediction
          const prediction = m.models?.v2_lightgbm || m.models?.v1_consensus
          const predSide = prediction?.pick?.toLowerCase() || (homeProb > drawProb && homeProb > awayProb ? 'home' : awayProb > drawProb ? 'away' : 'draw')
          
          return {
            matchId: String(m.match_id || m.id),
            homeTeam: m.home?.name || m.home_team || 'Home',
            awayTeam: m.away?.name || m.away_team || 'Away',
            league: m.league?.name || m.league_name || 'Unknown',
            kickoffDate: m.kickoff_utc || m.kickoffDate || new Date().toISOString(),
            home: { prob: homeProb, odds: Number(homeOdds.toFixed(2)), edge: Number(homeEdge.toFixed(1)) },
            draw: { prob: drawProb, odds: Number(drawOdds.toFixed(2)), edge: Number(drawEdge.toFixed(1)) },
            away: { prob: awayProb, odds: Number(awayOdds.toFixed(2)), edge: Number(awayEdge.toFixed(1)) },
            prediction: {
              side: predSide as 'home' | 'draw' | 'away',
              confidence: Math.round((prediction?.confidence || 0.5) * 100)
            }
          }
        })
        .filter((m: MatchPick) => {
          // Filter by minimum probability
          const minProb = Number(minProbFilter) / 100
          return Math.max(m.home.prob, m.draw.prob, m.away.prob) >= minProb
        })
        .sort((a, b) => {
          // Sort by highest probability
          const aMax = Math.max(a.home.prob, a.draw.prob, a.away.prob)
          const bMax = Math.max(b.home.prob, b.draw.prob, b.away.prob)
          return bMax - aMax
        })
      
      setMatches(transformed)
    } catch (err) {
      console.error('Failed to fetch matches:', err)
      toast.error('Failed to load matches')
    } finally {
      setLoadingMatches(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'builder') {
      fetchMatches()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, minProbFilter, dateFilter])

  const handlePickSelect = (match: MatchPick, side: 'home' | 'draw' | 'away') => {
    const pick = match[side]
    const pickId = `${match.matchId}-${side}`
    
    // Check if already selected
    if (selectedPicks.some(p => p.id === pickId)) {
      setSelectedPicks(prev => prev.filter(p => p.id !== pickId))
      return
    }
    
    // Add pick
    const newPick: SelectedPick = {
      id: pickId,
      matchId: match.matchId,
      match: `${match.homeTeam} vs ${match.awayTeam}`,
      pick: side === 'home' ? 'Home Win' : side === 'away' ? 'Away Win' : 'Draw',
      odds: pick.odds.toFixed(2),
      league: match.league,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      betType: '1X2',
      prob: pick.prob,
      edge: pick.edge
    }
    
    setSelectedPicks(prev => [...prev, newPick])
    toast.success(`Added ${newPick.pick} to bet slip`)
  }

  const handleRemovePick = (id: string) => {
    setSelectedPicks(prev => prev.filter(p => p.id !== id))
  }

  const handleClearPicks = () => {
    setSelectedPicks([])
    toast.info('Bet slip cleared')
  }

  /**
   * Add all legs of a pre-built parlay to the bet slip, then switch to the
   * builder tab so the BettingSlip sidebar is visible.
   */
  const handleAddParlayToSlip = useCallback((parlay: Parlay) => {
    const picks: SelectedPick[] = parlay.legs.map((leg, i) => {
      const isPlayerProp = !leg.home_team || leg.home_team === 'TBD'
      return {
        id: `prebuilt-${parlay.parlay_id}-${i}`,
        matchId: String(leg.match_id),
        match: isPlayerProp ? leg.outcome : `${leg.home_team} vs ${leg.away_team}`,
        pick: isPlayerProp ? leg.outcome : getOutcomeLabel(leg.outcome),
        odds: (leg.decimal_odds && Number(leg.decimal_odds) > 0
          ? Number(leg.decimal_odds)
          : parseFloat((1 / Math.max(leg.model_prob, 0.01)).toFixed(2))
        ).toFixed(2),
        league: parlay.league_group || 'Unknown',
        homeTeam: leg.home_team || '',
        awayTeam: leg.away_team || '',
        betType: isPlayerProp ? 'PLAYER_PROP' : '1X2',
        prob: leg.model_prob,
        edge: leg.edge,
      }
    })

    setSelectedPicks(prev => {
      const existingIds = new Set(prev.map(p => p.id))
      const newPicks = picks.filter(p => !existingIds.has(p.id))
      if (newPicks.length === 0) {
        toast.info('All legs already in your bet slip')
        return prev
      }
      return [...prev, ...newPicks]
    })

    setActiveTab('builder')
    toast.success(`Added ${parlay.leg_count}-leg parlay to your slip`)
  }, [])

  // ── Additional markets ─────────────────────────────────────────────
  const toggleMatchMarkets = async (matchId: string) => {
    const isNowOpen = !expandedMatches[matchId]
    setExpandedMatches(prev => ({ ...prev, [matchId]: isNowOpen }))

    // Fetch only on first open
    if (isNowOpen && !matchMarkets[matchId]) {
      setLoadingMarkets(prev => ({ ...prev, [matchId]: true }))
      try {
        const res = await fetch(`/api/parlays/builder/markets/${matchId}?minProb=0.40&minAgreement=0.50`)
        if (res.ok) {
          const data = await res.json()
          setMatchMarkets(prev => ({ ...prev, [matchId]: data.markets || [] }))
        }
      } catch {
        toast.error('Could not load additional markets')
      } finally {
        setLoadingMarkets(prev => ({ ...prev, [matchId]: false }))
      }
    }
  }

  const handleMarketPickSelect = (match: MatchPick, market: MarketItem) => {
    const pickId = `${match.matchId}-mkt-${market.id}`

    if (selectedPicks.some(p => p.id === pickId)) {
      setSelectedPicks(prev => prev.filter(p => p.id !== pickId))
      return
    }

    const oddsDecimal = market.odds.decimal ?? (market.consensus.prob > 0 ? 1 / market.consensus.prob : 2)
    const newPick: SelectedPick = {
      id: pickId,
      matchId: match.matchId,
      match: `${match.homeTeam} vs ${match.awayTeam}`,
      pick: market.displayLabel,
      odds: oddsDecimal.toFixed(2),
      league: match.league,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      betType: market.marketType,
      prob: market.consensus.prob,
      edge: market.edge,
    }
    setSelectedPicks(prev => [...prev, newPick])
    toast.success(`Added "${market.displayLabel}"`)
  }

  // ── Filtering & sorting ────────────────────────────────────────────
  const filteredParlays = useMemo(() => {
    let result = [...parlays]

    // Category filter
    if (activeCategory === 'ai_picks') {
      // AI Picks = cross-match or same-game parlays generated by best-parlay-generator
      result = result.filter(p =>
        p.parlay_type === 'cross_league' ||
        p.parlay_type === 'single_game' ||
        p.parlay_type === 'multi_game'
      )
    } else if (activeCategory !== 'all') {
      result = result.filter(p => p.parlay_type === activeCategory)
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(p =>
        p.legs.some(l =>
          l.home_team.toLowerCase().includes(q) ||
          l.away_team.toLowerCase().includes(q)
        ) ||
        p.league_group?.toLowerCase().includes(q)
      )
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'edge': return Number(b.edge_pct) - Number(a.edge_pct)
        case 'odds': return Number(a.implied_odds) - Number(b.implied_odds)
        case 'kickoff': return new Date(a.earliest_kickoff).getTime() - new Date(b.earliest_kickoff).getTime()
        case 'confidence': {
          const order = { high: 3, medium: 2, low: 1 }
          return (order[b.confidence_tier as keyof typeof order] || 0) - (order[a.confidence_tier as keyof typeof order] || 0)
        }
        default: return 0
      }
    })

    return result
  }, [parlays, activeCategory, searchQuery, sortBy])

  // Count per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: parlays.length }
    for (const p of parlays) {
      counts[p.parlay_type] = (counts[p.parlay_type] || 0) + 1
    }
    // AI picks = cross_league + single_game + multi_game
    counts['ai_picks'] = parlays.filter(p =>
      p.parlay_type === 'cross_league' ||
      p.parlay_type === 'single_game' ||
      p.parlay_type === 'multi_game'
    ).length
    return counts
  }, [parlays])

  // ── Premium gate ───────────────────────────────────────────────────
  if (hasPremiumAccess === false && !isAdmin) {
    return (
      <PremiumGate
        title="Premium Parlays Access"
        description="Access AI-powered parlay recommendations with premium subscription."
        featureName="Parlays"
      />
    )
  }

  // ── Loading ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="h-8 bg-slate-700/40 rounded w-48 mb-2 animate-pulse" />
            <div className="h-4 bg-slate-700/30 rounded w-72 animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-slate-800/40 rounded-xl border border-slate-700/40 animate-pulse" />
          ))}
        </div>
        <ParlaySkeletonGrid />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Page Header ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Layers className="w-7 h-7 text-emerald-400" />
            AI Parlays
          </h1>
          <p className="text-slate-400 mt-1">
            Multi-match picks curated by our AI models
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && activeTab === 'prebuilt' && (
            <Button
              onClick={syncParlays}
              disabled={syncing}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              {syncing ? 'Syncing...' : 'Sync All'}
            </Button>
          )}
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'prebuilt' | 'builder')}>
        <TabsList className="grid w-full max-w-md grid-cols-2 bg-slate-800/60 border-slate-700">
          <TabsTrigger value="prebuilt" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <Star className="w-4 h-4 mr-2" />
            Pre-built Parlays
          </TabsTrigger>
          <TabsTrigger value="builder" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <Target className="w-4 h-4 mr-2" />
            Build Your Own
          </TabsTrigger>
        </TabsList>

        {/* ── Pre-built Parlays Tab ───────────────────────────────── */}
        <TabsContent value="prebuilt" className="space-y-6 mt-6">
          {/* ── Stats Bar ────────────────────────────────────────────── */}
          <StatsBar parlays={filteredParlays} />

      {/* ── Category Tabs ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {PARLAY_CATEGORIES.map(cat => {
            const count = categoryCounts[cat.id] || 0
            const isActive = activeCategory === cat.id
            return (
              <Button
                key={cat.id}
                variant={isActive ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "whitespace-nowrap gap-1.5",
                  isActive
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                )}
              >
                <cat.icon className="w-3.5 h-3.5" />
                {cat.label}
                <Badge className={cn(
                  "ml-1 text-[10px] px-1.5 py-0",
                  isActive
                    ? 'bg-emerald-700 text-emerald-200'
                    : 'bg-slate-700 text-slate-400'
                )}>
                  {count}
                </Badge>
              </Button>
            )
          })}
        </div>
      </div>

      {/* ── Search + Sort ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Search by team or league..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>
        <div className="flex gap-2">
          {[
            { id: 'edge', label: 'Edge' },
            { id: 'odds', label: 'Best Odds' },
            { id: 'kickoff', label: 'Soonest' },
            { id: 'confidence', label: 'Confidence' },
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

      {/* ── Error ────────────────────────────────────────────────── */}
      {error && (
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-red-400 text-sm">{error}</p>
            <Button size="sm" onClick={fetchParlays} className="ml-auto bg-red-600 hover:bg-red-500 text-white">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Parlay Grid ──────────────────────────────────────────── */}
      {filteredParlays.length === 0 ? (
        <Card className="bg-slate-800/40 border-slate-700/40">
          <CardContent className="py-16 text-center">
            <Layers className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No Parlays Found</h3>
            <p className="text-slate-400 mb-4 max-w-md mx-auto">
              {parlays.length === 0
                ? 'No parlays available yet. Try syncing from the backend to populate the latest picks.'
                : 'No parlays match your current filters. Try broadening your search or switching categories.'}
            </p>
            {parlays.length === 0 && isAdmin && (
              <Button onClick={syncParlays} disabled={syncing} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                <RefreshCw className="w-4 h-4 mr-2" />
                Sync Parlays
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredParlays.map(parlay => (
              <ParlayCard
                key={parlay.parlay_id}
                parlay={parlay}
                onClick={() => {
                  setSelectedParlay(parlay)
                  setShowDetailModal(true)
                }}
                onAddToSlip={() => handleAddParlayToSlip(parlay)}
              />
            ))}
          </div>

          {/* Results count */}
          <p className="text-center text-sm text-slate-500 pt-2">
            Showing {filteredParlays.length} of {parlays.length} parlays
          </p>
        </>
      )}

      {/* ── Info box ─────────────────────────────────────────────── */}
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
          <div className="text-xs text-slate-400 leading-relaxed">
            <p className="font-medium text-slate-300 mb-1">Understanding Edge %</p>
            <p>
              Edge represents the expected value advantage of our AI model compared to the bookmaker&apos;s odds.
              A positive edge means the bet has better value than the market suggests.
              Typical edges range from 5–30%. Higher confidence and tradable status indicate stronger picks.
            </p>
          </div>
        </CardContent>
      </Card>

          {/* ── Detail Modal ─────────────────────────────────────────── */}
          <ParlayDetailModal
            parlay={selectedParlay}
            open={showDetailModal}
            onClose={() => setShowDetailModal(false)}
          />
        </TabsContent>

        {/* ── Build Your Own Tab ───────────────────────────────────── */}
        <TabsContent value="builder" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* ── Main Content ─────────────────────────────────────── */}
            <div className="lg:col-span-2 space-y-4">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Select value={minProbFilter} onValueChange={setMinProbFilter}>
                  <SelectTrigger className="w-full sm:w-48 bg-slate-800/60 border-slate-700 text-white">
                    <SelectValue placeholder="Min Probability" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="40">≥40% Probability</SelectItem>
                    <SelectItem value="50">≥50% Probability</SelectItem>
                    <SelectItem value="60">≥60% Probability</SelectItem>
                    <SelectItem value="70">≥70% Probability</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className="w-full sm:w-48 bg-slate-800/60 border-slate-700 text-white">
                    <SelectValue placeholder="Date Filter" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="all">All Matches</SelectItem>
                    <SelectItem value="today">Today Only</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={fetchMatches}
                  disabled={loadingMatches}
                  size="sm"
                  variant="outline"
                  className="bg-slate-800/60 border-slate-700 text-white hover:bg-slate-700"
                >
                  {loadingMatches ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Refresh
                </Button>
              </div>

              {/* Matches Grid */}
              {loadingMatches ? (
                <div className="grid grid-cols-1 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              ) : matches.length === 0 ? (
                <Card className="bg-slate-800/40 border-slate-700/40">
                  <CardContent className="py-16 text-center">
                    <Target className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-white mb-2">No Matches Available</h3>
                    <p className="text-slate-400 mb-4 max-w-md mx-auto">
                      No matches found matching your filters. Try adjusting the minimum probability or date filter.
                    </p>
                    <Button onClick={fetchMatches} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-slate-400">
                    Showing {matches.length} matches — Tap picks to add to your bet slip
                  </p>
                  {matches.map((match) => {
                    const bestPick = match.prediction?.side || 
                      (match.home.prob > match.draw.prob && match.home.prob > match.away.prob ? 'home' :
                       match.away.prob > match.draw.prob ? 'away' : 'draw')
                    const isExpanded = expandedMatches[match.matchId] ?? false
                    const markets = matchMarkets[match.matchId] ?? []
                    const isLoadingMkts = loadingMarkets[match.matchId] ?? false
                    const hasSameGamePick = selectedPicks.filter(p => p.matchId === match.matchId).length > 1

                    // Group additional markets by type
                    const marketGroups = markets.reduce<Record<string, MarketItem[]>>((acc, m) => {
                      if (m.marketType === '1X2') return acc // Already shown above
                      const key = m.marketType
                      if (!acc[key]) acc[key] = []
                      acc[key].push(m)
                      return acc
                    }, {})

                    return (
                      <Card key={match.matchId} className={cn(
                        "border-slate-700/50 transition-all duration-200",
                        hasSameGamePick ? "bg-slate-800/80 border-yellow-500/30" : "bg-slate-800/60"
                      )}>
                        <CardContent className="p-4">
                          {/* Match Header */}
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold text-white truncate">
                                {match.homeTeam} vs {match.awayTeam}
                              </h3>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="border-slate-600 text-slate-300 text-[10px]">
                                  {match.league}
                                </Badge>
                                <span className="text-xs text-slate-500">
                                  {new Date(match.kickoffDate).toLocaleString('en-US', {
                                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                  })}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {match.prediction && (
                                <Badge className={cn(
                                  "text-[10px]",
                                  match.prediction.confidence >= 70 ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                                  match.prediction.confidence >= 50 ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' :
                                  'bg-slate-500/15 text-slate-400 border-slate-500/30'
                                )}>
                                  AI: {match.prediction.side === 'home' ? 'Home' : match.prediction.side === 'away' ? 'Away' : 'Draw'} ({match.prediction.confidence}%)
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* ── 1X2 Pick Options ── */}
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2">Match Result (1X2)</p>
                          <div className="grid grid-cols-3 gap-2 mb-3">
                            {(['home', 'draw', 'away'] as const).map((side) => {
                              const pick = match[side]
                              const isSelected = selectedPicks.some(p => p.id === `${match.matchId}-${side}`)
                              const isRecommended = bestPick === side
                              const label = side === 'home' ? match.homeTeam : side === 'away' ? match.awayTeam : 'Draw'
                              
                              return (
                                <button
                                  key={side}
                                  onClick={() => handlePickSelect(match, side)}
                                  className={cn(
                                    "relative p-3 rounded-lg border-2 transition-all text-left",
                                    isSelected
                                      ? "bg-emerald-500/20 border-emerald-500/50 ring-2 ring-emerald-500/30"
                                      : isRecommended
                                      ? "bg-slate-700/40 border-slate-600/50 hover:border-emerald-500/40"
                                      : "bg-slate-700/20 border-slate-700/50 hover:border-slate-600"
                                  )}
                                >
                                  {isRecommended && (
                                    <Badge className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[8px] px-1 py-0">
                                      AI Pick
                                    </Badge>
                                  )}
                                  <p className="text-xs font-medium text-slate-300 mb-1 truncate">{label}</p>
                                  <p className="text-lg font-bold text-white mb-1">{pick.odds.toFixed(2)}</p>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-slate-400">
                                      {(pick.prob * 100).toFixed(0)}% prob
                                    </span>
                                    <span className={cn(
                                      "text-[10px] font-semibold",
                                      pick.edge > 0 ? 'text-emerald-400' : 'text-slate-500'
                                    )}>
                                      {pick.edge > 0 ? '+' : ''}{pick.edge.toFixed(1)}%
                                    </span>
                                  </div>
                                  {isSelected && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/10 rounded-lg">
                                      <Check className="w-6 h-6 text-emerald-400" />
                                    </div>
                                  )}
                                </button>
                              )
                            })}
                          </div>

                          {/* ── Expand more markets button ── */}
                          <button
                            onClick={() => toggleMatchMarkets(match.matchId)}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-700/30 border border-slate-700/50 hover:bg-slate-700/50 hover:border-slate-600/70 transition-all text-xs text-slate-400 hover:text-white"
                          >
                            <span className="flex items-center gap-1.5">
                              {isLoadingMkts
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Percent className="w-3.5 h-3.5" />}
                              More Markets — Over/Under · BTTS · Double Chance
                            </span>
                            {isExpanded
                              ? <ChevronUp className="w-3.5 h-3.5 shrink-0" />
                              : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
                          </button>

                          {/* ── Additional markets (expanded) ── */}
                          {isExpanded && (
                            <div className="mt-3 space-y-4 border-t border-slate-700/50 pt-3">
                              {isLoadingMkts && (
                                <div className="flex items-center justify-center py-6">
                                  <Loader2 className="w-5 h-5 text-slate-400 animate-spin mr-2" />
                                  <span className="text-sm text-slate-400">Loading markets…</span>
                                </div>
                              )}

                              {!isLoadingMkts && Object.keys(marketGroups).length === 0 && (
                                <p className="text-xs text-slate-500 text-center py-4">
                                  No additional market data available for this match yet.
                                </p>
                              )}

                              {!isLoadingMkts && Object.entries(marketGroups).map(([type, items]) => {
                                const groupLabel = MARKET_GROUPS[type] || type.replace(/_/g, ' ')

                                return (
                                  <div key={type}>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2">
                                      {groupLabel}
                                    </p>

                                    {/* TOTALS — group by line so Over/Under sit side-by-side */}
                                    {type === 'TOTALS' ? (
                                      <div className="space-y-2">
                                        {(() => {
                                          const byLine: Record<string, MarketItem[]> = {}
                                          for (const m of items) {
                                            const k = String(m.line ?? 'N/A')
                                            if (!byLine[k]) byLine[k] = []
                                            byLine[k].push(m)
                                          }
                                          return Object.entries(byLine).map(([line, pair]) => (
                                            <div key={line} className="grid grid-cols-2 gap-2">
                                              {pair.map(market => {
                                                const pickId = `${match.matchId}-mkt-${market.id}`
                                                const isSelected = selectedPicks.some(p => p.id === pickId)
                                                const odds = market.odds.decimal ?? (market.consensus.prob > 0 ? 1 / market.consensus.prob : 2)
                                                return (
                                                  <MarketButton
                                                    key={market.id}
                                                    market={market}
                                                    isSelected={isSelected}
                                                    odds={odds}
                                                    onClick={() => handleMarketPickSelect(match, market)}
                                                  />
                                                )
                                              })}
                                            </div>
                                          ))
                                        })()}
                                      </div>
                                    ) : (
                                      /* BTTS, Double Chance, DNB etc — 2-col grid */
                                      <div className="grid grid-cols-2 gap-2">
                                        {items.map(market => {
                                          const pickId = `${match.matchId}-mkt-${market.id}`
                                          const isSelected = selectedPicks.some(p => p.id === pickId)
                                          const odds = market.odds.decimal ?? (market.consensus.prob > 0 ? 1 / market.consensus.prob : 2)
                                          return (
                                            <MarketButton
                                              key={market.id}
                                              market={market}
                                              isSelected={isSelected}
                                              odds={odds}
                                              onClick={() => handleMarketPickSelect(match, market)}
                                            />
                                          )
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}

                              {/* Same-game parlay warning */}
                              {hasSameGamePick && (
                                <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-400">
                                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                  <span>You have multiple picks from this match — this creates a <strong>same-game parlay</strong> with higher correlation risk.</span>
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── Bet Slip Sidebar ─────────────────────────────────── */}
            <div className="lg:col-span-1">
              <div className="sticky top-4">
                <BettingSlip
                  items={selectedPicks.map(p => ({
                    id: p.id,
                    match: p.match,
                    pick: p.pick,
                    odds: p.odds,
                    league: p.league,
                    matchId: p.matchId,
                    homeTeam: p.homeTeam,
                    awayTeam: p.awayTeam,
                    betType: p.betType
                  }))}
                  onRemove={handleRemovePick}
                  onClear={handleClearPicks}
                />
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

