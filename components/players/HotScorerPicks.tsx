"use client"

import { useState, useEffect } from "react"
import { PlayerScorerCard, type PlayerPrediction } from "./PlayerScorerCard"
import { Flame, ChevronRight, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

interface Props {
  limit?: number
  sport?: string
  className?: string
}

export function HotScorerPicks({ limit = 5, sport, className }: Props) {
  const [picks, setPicks] = useState<PlayerPrediction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchPicks() {
      try {
        const params = new URLSearchParams({ limit: String(limit) })
        if (sport) params.set('sport', sport)
        const res = await fetch(`/api/player-predictions/top-picks?${params}`)
        if (!res.ok) return
        const data = await res.json()
        setPicks(data.predictions || data.picks || [])
      } catch {
        // Silent fail — widget is supplementary
      } finally {
        setLoading(false)
      }
    }
    fetchPicks()
  }, [limit, sport])

  if (!loading && picks.length === 0) return null

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-400" />
          Hot Scorer Picks
          <Badge className="text-[9px] px-1.5 py-0 bg-purple-500/10 text-purple-400 border-purple-500/20">
            ML
          </Badge>
        </h3>
        <Link
          href="/dashboard/matches"
          className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          View All <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700">
          {picks.map((p, i) => (
            <div key={`${p.player_name}-${i}`} className="min-w-[200px] max-w-[240px] shrink-0">
              <PlayerScorerCard player={p} rank={i + 1} compact />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
