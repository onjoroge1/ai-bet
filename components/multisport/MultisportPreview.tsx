"use client"

import { useState, useEffect } from "react"
import { SportMatchCard } from "./SportMatchCard"
import { SkeletonCard } from "@/components/match/shared"
import { Trophy, ChevronRight } from "lucide-react"
import Link from "next/link"

interface SportData {
  sport: string
  sport_name: string
  matches: any[]
  total_count: number
}

const SPORTS = [
  { key: "basketball_nba", name: "NBA", accent: "border-l-orange-500" },
  { key: "icehockey_nhl", name: "NHL", accent: "border-l-cyan-500" },
  { key: "basketball_ncaab", name: "NCAAB", accent: "border-l-purple-500" },
]

export function MultisportPreview() {
  const [sportData, setSportData] = useState<Record<string, SportData>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAll() {
      try {
        const results = await Promise.allSettled(
          SPORTS.map(s =>
            fetch(`/api/multisport/market?sport=${s.key}&status=upcoming&limit=4`)
              .then(r => r.json())
              .then(data => ({ key: s.key, data }))
          )
        )

        const newData: Record<string, SportData> = {}
        for (const result of results) {
          if (result.status === "fulfilled" && result.value.data?.matches?.length > 0) {
            newData[result.value.key] = result.value.data
          }
        }
        setSportData(newData)
      } catch {
        // Silently fail - multisport is supplementary
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  const activeSports = SPORTS.filter(s => sportData[s.key]?.matches?.length > 0)

  if (!loading && activeSports.length === 0) return null

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Trophy className="w-5 h-5 text-emerald-400" />
          More Sports
        </h2>
        <Link
          href="/sports"
          className="flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          View All <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {activeSports.map(sport => (
            <div key={sport.key}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-slate-300">{sport.name}</h3>
                <span className="text-xs text-slate-500">
                  {sportData[sport.key].total_count} upcoming
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                {sportData[sport.key].matches.slice(0, 4).map((match: any) => (
                  <SportMatchCard
                    key={match.event_id}
                    match={match}
                    sportKey={sport.key}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
