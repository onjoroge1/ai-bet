"use client"

import { useState, useEffect } from "react"
import { Crown, ChevronRight, Zap } from "lucide-react"
import { SnapBetPickCard } from "./SnapBetPickCard"
import Link from "next/link"

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
  limit?: number
  sport?: string    // Filter to specific sport
  showHeader?: boolean
  compact?: boolean // For sidebar/widget usage
}

export function SnapBetPicksSection({ limit = 6, sport, showHeader = true, compact = false }: Props) {
  const [picks, setPicks] = useState<SnapBetPick[]>([])
  const [isPremium, setIsPremium] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sportFilter, setSportFilter] = useState(sport || '')
  const [availableSports, setAvailableSports] = useState<string[]>([])

  useEffect(() => {
    async function fetchPicks() {
      try {
        const params = new URLSearchParams({ limit: String(limit) })
        if (sportFilter) params.set('sport', sportFilter)

        const res = await fetch(`/api/premium/snapbet-picks?${params}`)
        const data = await res.json()

        if (data.success) {
          setPicks(data.picks || [])
          setIsPremium(data.isPremium || false)
          setAvailableSports(data.sports || [])
        }
      } catch {
        // Silent fail
      } finally {
        setLoading(false)
      }
    }
    fetchPicks()
  }, [limit, sportFilter])

  if (!loading && picks.length === 0) return null

  const sportTabs = [
    { key: '', label: 'All', emoji: '🏆' },
    { key: 'soccer', label: 'Soccer', emoji: '⚽' },
    { key: 'nba', label: 'NBA', emoji: '🏀' },
    { key: 'nhl', label: 'NHL', emoji: '🏒' },
    { key: 'ncaab', label: 'NCAAB', emoji: '🏀' },
  ]

  return (
    <section className="space-y-4">
      {showHeader && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20">
              <Crown className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                SnapBet Picks
                <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full font-semibold">
                  AI-CURATED
                </span>
              </h2>
              <p className="text-slate-400 text-xs">Top picks across all sports, powered by model accuracy data</p>
            </div>
          </div>
          <Link
            href="/dashboard/snapbet-picks"
            className="flex items-center gap-1 text-sm text-amber-400 hover:text-amber-300 transition-colors"
          >
            View All <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Sport filter tabs */}
      {!sport && !compact && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {sportTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setSportFilter(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                sportFilter === tab.key
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:text-slate-200'
              }`}
            >
              <span>{tab.emoji}</span>
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Loading skeleton */}
      {loading ? (
        <div className={`grid ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'} gap-3`}>
          {Array.from({ length: compact ? 3 : 6 }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-slate-800/30 border border-slate-700/30 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className={`grid ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'} gap-3`}>
            {picks.map((pick, i) => (
              <SnapBetPickCard key={pick.id} pick={pick} isPremium={isPremium} index={i} />
            ))}
          </div>

          {/* Upgrade CTA for free users */}
          {!isPremium && picks.length > 0 && (
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-600/5 to-transparent border border-amber-500/20 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Zap className="w-5 h-5 text-amber-400" />
                  <div>
                    <p className="text-sm font-medium text-white">Unlock all SnapBet Picks</p>
                    <p className="text-xs text-slate-400">See pick directions, confidence scores, and model reasoning</p>
                  </div>
                </div>
                <Link
                  href="/subscribe/pro_monthly"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold rounded-lg transition-colors"
                >
                  Upgrade
                </Link>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
