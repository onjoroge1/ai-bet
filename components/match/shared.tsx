"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MatchData {
  home_team?: string
  away_team?: string
  league?: string
  date?: string
  venue?: string
}

export interface Match {
  id: string
  name: string
  price: number
  originalPrice?: number
  type: string
  matchId?: string
  matchData?: MatchData
  predictionType?: string
  confidenceScore?: number
  odds?: number
  valueRating?: string
  analysisSummary?: string
  isActive: boolean
  createdAt: string
  country?: {
    currencyCode: string
    currencySymbol: string
  }
  features?: string[]
  iconName?: string
  colorGradientFrom?: string
  colorGradientTo?: string
  isUrgent?: boolean
  timeLeft?: string
  isPopular?: boolean
  discountPercentage?: number
  tipCount?: number
  predictionData?: unknown
}

export interface MatchFilters {
  search: string
  status: string
  confidence: string
  valueRating: string
  sortBy: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Relative countdown: "In 2h 30m", "Tomorrow 3:00 PM", "Wed, Mar 4" */
export function getRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()

  if (diffMs < 0) return "Started"

  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 60) return `In ${diffMins}m`
  if (diffHours < 24) {
    const mins = diffMins % 60
    return mins > 0 ? `In ${diffHours}h ${mins}m` : `In ${diffHours}h`
  }
  if (diffDays === 1) {
    return `Tomorrow ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
  }
  return date.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

/** Get urgency level for styling: "hot" (<2h), "warm" (<24h), "cool" (>24h) */
export function getUrgency(dateString?: string): "hot" | "warm" | "cool" {
  if (!dateString) return "cool"
  const diffMs = new Date(dateString).getTime() - Date.now()
  if (diffMs < 2 * 60 * 60 * 1000) return "hot"
  if (diffMs < 24 * 60 * 60 * 1000) return "warm"
  return "cool"
}

/** Confidence level color */
export function getConfidenceColor(score: number): { ring: string; text: string; bg: string; glow: string } {
  if (score >= 80) return { ring: "stroke-emerald-400", text: "text-emerald-400", bg: "bg-emerald-500/10", glow: "shadow-emerald-500/20" }
  if (score >= 60) return { ring: "stroke-yellow-400", text: "text-yellow-400", bg: "bg-yellow-500/10", glow: "shadow-yellow-500/20" }
  if (score >= 40) return { ring: "stroke-orange-400", text: "text-orange-400", bg: "bg-orange-500/10", glow: "shadow-orange-500/20" }
  return { ring: "stroke-red-400", text: "text-red-400", bg: "bg-red-500/10", glow: "shadow-red-500/20" }
}

/** Format prediction type for display */
export function formatPrediction(type: string): string {
  // Handle "Lean: away_win (small stake)" style
  if (type.startsWith("Lean:")) {
    const core = type.replace("Lean:", "").replace(/\(.*\)/, "").trim()
    return `Lean ${core.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`
  }
  if (type === "No Bet") return "No Bet"
  return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

/** Get match status based on date */
export function getMatchStatus(match: Match): string {
  const matchDate = match.matchData?.date ? new Date(match.matchData.date) : null
  if (!matchDate) return "unknown"
  const now = new Date()
  const timeDiff = matchDate.getTime() - now.getTime()
  const hoursDiff = timeDiff / (1000 * 60 * 60)
  if (hoursDiff <= 0) return "started"
  if (hoursDiff <= 2) return "upcoming"
  return "scheduled"
}

// ─── Shared Components ────────────────────────────────────────────────────────

/** Circular confidence ring */
export function ConfidenceRing({ score, value, size = 52 }: { score?: number; value?: number; size?: number }) {
  const s = score ?? value ?? 0
  const colors = getConfidenceColor(s)
  const strokeWidth = 4
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (s / 100) * circumference

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="currentColor" strokeWidth={strokeWidth}
          className="text-slate-700/50" />
        <circle cx={size / 2} cy={size / 2} r={radius}
          fill="none" strokeWidth={strokeWidth} strokeLinecap="round"
          className={colors.ring}
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <span className={`absolute text-xs font-bold ${colors.text}`}>
        {s}%
      </span>
    </div>
  )
}

/** Skeleton card for loading state */
export function SkeletonCard() {
  return (
    <Card className="bg-slate-800/60 border-slate-700/50 overflow-hidden animate-pulse">
      <CardHeader className="pb-3">
        <div className="flex justify-between">
          <div className="space-y-2 flex-1">
            <div className="h-5 bg-slate-700/60 rounded w-3/4" />
            <div className="h-3 bg-slate-700/40 rounded w-1/2" />
            <div className="h-3 bg-slate-700/40 rounded w-1/3" />
          </div>
          <div className="w-14 h-14 bg-slate-700/40 rounded-full ml-4" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-3 bg-slate-700/40 rounded w-2/3" />
        <div className="h-16 bg-slate-700/30 rounded-lg" />
        <div className="h-20 bg-emerald-900/10 rounded-lg" />
        <div className="flex justify-between items-center pt-3 border-t border-slate-700/40">
          <div className="h-5 bg-slate-700/50 rounded w-16" />
          <div className="h-8 bg-slate-700/50 rounded w-24" />
        </div>
      </CardContent>
    </Card>
  )
}

