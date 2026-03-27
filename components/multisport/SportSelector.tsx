"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"

interface SportInfo {
  sport_key: string
  name: string
  season: { status: string; season_window: string }
  fixtures: { upcoming: number; upcoming_with_odds: number; finished: number; total: number }
  model: { available: boolean; training_samples: number; confidence_note: string | null }
  live_data_available: boolean
}

const SPORT_CONFIG: Record<string, { icon: string; accent: string; accentBg: string; accentBorder: string; label: string }> = {
  soccer: { icon: "⚽", accent: "text-emerald-400", accentBg: "bg-emerald-500/10", accentBorder: "border-emerald-500/30", label: "Soccer" },
  basketball_nba: { icon: "🏀", accent: "text-orange-400", accentBg: "bg-orange-500/10", accentBorder: "border-orange-500/30", label: "NBA" },
  icehockey_nhl: { icon: "🏒", accent: "text-cyan-400", accentBg: "bg-cyan-500/10", accentBorder: "border-cyan-500/30", label: "NHL" },
  basketball_ncaab: { icon: "🏀", accent: "text-purple-400", accentBg: "bg-purple-500/10", accentBorder: "border-purple-500/30", label: "NCAAB" },
}

const DISPLAY_SPORTS = ["soccer", "basketball_nba", "icehockey_nhl", "basketball_ncaab"]

interface Props {
  selectedSport: string
  onSelect: (sport: string) => void
  /** When true, all sports are always clickable even if off-season (useful for admin pages) */
  allowAll?: boolean
}

export function SportSelector({ selectedSport, onSelect, allowAll = false }: Props) {
  const [sports, setSports] = useState<SportInfo[]>([])
  const [dbCounts, setDbCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    // Fetch backend season info
    fetch("/api/multisport/sports")
      .then(res => res.json())
      .then(data => {
        if (data.sports) {
          setSports(data.sports.filter((s: SportInfo) => DISPLAY_SPORTS.includes(s.sport_key)))
        }
      })
      .catch(() => {})

    // Also check local DB for actual match counts (backend may say off-season but DB has matches)
    const sportKeys = ["basketball_nba", "icehockey_nhl", "basketball_ncaab"]
    Promise.allSettled(
      sportKeys.map(key =>
        fetch(`/api/multisport/market?sport=${key}&status=upcoming&limit=1`)
          .then(r => r.json())
          .then(d => ({ key, count: d.total_count || d.matches?.length || 0 }))
      )
    ).then(results => {
      const counts: Record<string, number> = {}
      for (const r of results) {
        if (r.status === "fulfilled") counts[r.value.key] = r.value.count
      }
      setDbCounts(counts)
    })
  }, [])

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {DISPLAY_SPORTS.map(key => {
        const config = SPORT_CONFIG[key]
        const info = sports.find(s => s.sport_key === key)
        const isSelected = selectedSport === key
        const apiUpcoming = info?.fixtures?.upcoming_with_odds ?? info?.fixtures?.upcoming ?? 0
        const localUpcoming = dbCounts[key] ?? 0
        const upcoming = Math.max(apiUpcoming, localUpcoming)
        // Never disable a sport if it has matches in either API or local DB
        const isOffSeason = !allowAll && key !== "soccer" && info?.season?.status === "off_season" && upcoming === 0 && localUpcoming === 0

        return (
          <button
            key={key}
            onClick={() => !isOffSeason && onSelect(key)}
            disabled={isOffSeason}
            className={`
              flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all whitespace-nowrap
              ${isSelected
                ? `${config.accentBg} ${config.accentBorder} ${config.accent} border`
                : isOffSeason
                  ? "bg-slate-800/30 border-slate-700/20 text-slate-500 cursor-not-allowed opacity-50"
                  : "bg-slate-800/60 border-slate-700/40 text-slate-300 hover:border-slate-600 hover:text-white"
              }
            `}
          >
            <span className="text-lg">{config.icon}</span>
            <span className="font-medium text-sm">
              {config.label}
            </span>
            {isOffSeason ? (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-600 text-slate-500">
                Off-season
              </Badge>
            ) : upcoming > 0 ? (
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${config.accentBorder} ${config.accent}`}>
                {upcoming}
              </Badge>
            ) : null}
            {key === "basketball_ncaab" && !isOffSeason && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-yellow-500/30 text-yellow-400">
                Beta
              </Badge>
            )}
          </button>
        )
      })}
    </div>
  )
}
