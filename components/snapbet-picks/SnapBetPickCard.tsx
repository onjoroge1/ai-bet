"use client"

import Link from "next/link"
import { Star, Lock, TrendingUp, Clock } from "lucide-react"

interface SnapBetPick {
  id: string
  sport: string
  sportEmoji: string
  homeTeam: string
  awayTeam: string
  league: string
  kickoff: string
  pick: string
  pickTeam: string
  confidence: number
  tier: "premium" | "strong" | "standard"
  starRating: number
  reasons: string[]
  edge?: number
  spread?: number
  totalLine?: number
  slug?: string
}

interface Props {
  pick: SnapBetPick
  isPremium: boolean
  index: number
}

const tierColors = {
  premium: { border: "border-l-amber-400", bg: "bg-amber-500/5", badge: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  strong: { border: "border-l-emerald-400", bg: "bg-emerald-500/5", badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  standard: { border: "border-l-blue-400", bg: "bg-blue-500/5", badge: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
}

export function SnapBetPickCard({ pick, isPremium, index }: Props) {
  const colors = tierColors[pick.tier]
  const kickoff = new Date(pick.kickoff)
  const now = new Date()
  const hoursUntil = Math.round((kickoff.getTime() - now.getTime()) / 3600000)
  const timeLabel = hoursUntil < 1 ? "Starting soon" : hoursUntil < 24 ? `In ${hoursUntil}h` : `In ${Math.ceil(hoursUntil / 24)}d`

  return (
    <Link href={pick.slug || "#"} className="block group">
      <div className={`relative rounded-xl border-l-4 ${colors.border} ${colors.bg} border border-slate-700/50 hover:border-slate-600/80 transition-all duration-200 p-4 hover:shadow-lg hover:shadow-slate-900/50`}>
        {/* Tier badge */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{pick.sportEmoji}</span>
            <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">{pick.league}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              {Array.from({ length: pick.starRating }).map((_, i) => (
                <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
              ))}
              {Array.from({ length: 5 - pick.starRating }).map((_, i) => (
                <Star key={i} className="w-3 h-3 text-slate-600" />
              ))}
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${colors.badge}`}>
              {pick.tier.charAt(0).toUpperCase() + pick.tier.slice(1)}
            </span>
          </div>
        </div>

        {/* Teams */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate">{pick.homeTeam}</div>
            <div className="text-sm text-slate-400 truncate">{pick.awayTeam}</div>
          </div>

          {/* Confidence ring or lock */}
          {isPremium ? (
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className="relative flex items-center justify-center" style={{ width: 48, height: 48 }}>
                <svg width="48" height="48" className="-rotate-90">
                  <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-700/50" />
                  <circle
                    cx="24" cy="24" r="21" fill="none" strokeWidth="3" strokeLinecap="round"
                    className={pick.tier === 'premium' ? 'stroke-amber-400' : pick.tier === 'strong' ? 'stroke-emerald-400' : 'stroke-blue-400'}
                    strokeDasharray={`${2 * Math.PI * 21}`}
                    strokeDashoffset={`${2 * Math.PI * 21 * (1 - pick.confidence / 100)}`}
                    style={{ transition: 'stroke-dashoffset 0.6s' }}
                  />
                </svg>
                <span className={`absolute text-xs font-bold ${pick.tier === 'premium' ? 'text-amber-400' : pick.tier === 'strong' ? 'text-emerald-400' : 'text-blue-400'}`}>
                  {pick.confidence}%
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-slate-700/50 border border-slate-600/50">
              <Lock className="w-4 h-4 text-slate-500" />
            </div>
          )}
        </div>

        {/* Pick info */}
        {isPremium ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-400">Pick: {pick.pickTeam}</span>
              {pick.edge && pick.edge > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full">
                  +{Math.round(pick.edge * 100)}% edge
                </span>
              )}
            </div>
            {pick.spread != null && (
              <div className="text-xs text-slate-400">
                Spread: {pick.spread > 0 ? '+' : ''}{pick.spread} | O/U: {pick.totalLine || '—'}
              </div>
            )}
            {pick.reasons.length > 0 && (
              <div className="text-[11px] text-slate-500 leading-relaxed">
                {pick.reasons[0]}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 py-1">
            <Lock className="w-3 h-3 text-slate-500" />
            <span className="text-xs text-slate-500">Premium pick — upgrade to see details</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-700/30">
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <Clock className="w-3 h-3" />
            <span>{timeLabel}</span>
          </div>
          <span className="text-[11px] text-slate-600 group-hover:text-slate-400 transition-colors">
            View details →
          </span>
        </div>
      </div>
    </Link>
  )
}
