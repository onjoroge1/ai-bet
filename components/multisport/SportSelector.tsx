"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { ACTIVE_MULTISPORT_KEYS, MULTISPORT } from "@/lib/multisport/sports"

interface SportInfo {
  sport_key: string
  name: string
  season: { status: string; season_window: string }
  fixtures: { upcoming: number; upcoming_with_odds: number; finished: number; total: number }
  model: { available: boolean; training_samples: number; confidence_note: string | null }
  live_data_available: boolean
}

interface TabConfig { icon: string; accent: string; accentBg: string; accentBorder: string; label: string }

const SOCCER_TAB: TabConfig = { icon: "⚽", accent: "text-emerald-400", accentBg: "bg-emerald-500/10", accentBorder: "border-emerald-500/30", label: "Soccer" }

const SPORT_CONFIG: Record<string, TabConfig> = {
  soccer: SOCCER_TAB,
  ...Object.fromEntries(
    Object.values(MULTISPORT).map(s => [
      s.key,
      { icon: s.emoji, accent: s.accent.text, accentBg: s.accent.bg, accentBorder: s.accent.border, label: s.name },
    ])
  ),
}

/** NBA + NFL first (the pivot), soccer kept as a trailing tab until its pipeline is replaced. */
export const DISPLAY_SPORTS: string[] = [...ACTIVE_MULTISPORT_KEYS, "soccer"]

interface Props {
  selectedSport: string
  onSelect: (sport: string) => void
  /** When true, all sports are always clickable even if off-season (useful for admin pages) */
  allowAll?: boolean
}

export function SportSelector({ selectedSport, onSelect, allowAll = false }: Props) {
  const [sports, setSports] = useState<SportInfo[]>([])

  useEffect(() => {
    fetch("/api/multisport/sports")
      .then(res => res.json())
      .then(data => {
        if (data.sports) setSports(data.sports.filter((s: SportInfo) => DISPLAY_SPORTS.includes(s.sport_key)))
      })
      .catch(() => {})
  }, [])

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {DISPLAY_SPORTS.map(key => {
        const config = SPORT_CONFIG[key]
        const info = sports.find(s => s.sport_key === key)
        const isSelected = selectedSport === key
        const upcoming = info?.fixtures?.upcoming ?? 0
        // Off-season only disables a tab when the DB also has nothing to show.
        const isOffSeason = !allowAll && key !== "soccer" && info?.season?.status === "off_season" && upcoming === 0
        const marketOnly = !!info && upcoming > 0 && info.model?.available === false

        return (
          <button
            key={key}
            onClick={() => !isOffSeason && onSelect(key)}
            disabled={isOffSeason}
            title={marketOnly ? "Market odds only — model pick arrives once the model is trained" : undefined}
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
            <span className="font-medium text-sm">{config.label}</span>
            {isOffSeason ? (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-600 text-slate-500">
                Off-season
              </Badge>
            ) : upcoming > 0 ? (
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${config.accentBorder} ${config.accent}`}>
                {upcoming}
              </Badge>
            ) : null}
            {marketOnly && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-600 text-slate-400">
                Market only
              </Badge>
            )}
          </button>
        )
      })}
    </div>
  )
}
