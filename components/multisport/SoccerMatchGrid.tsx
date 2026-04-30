"use client"

import { useState, useEffect } from "react"
import { SportMatchCard } from "./SportMatchCard"
import { SkeletonCard } from "@/components/match/shared"
import { RefreshCw } from "lucide-react"

interface SoccerMatchGridProps {
  status: "live" | "upcoming"
  limit?: number
}

/**
 * Fetches soccer matches from /api/market and renders them
 * using the same SportMatchCard layout as NBA/NHL/NCAAB.
 */
export function SoccerMatchGrid({ status, limit = 20 }: SoccerMatchGridProps) {
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchMatches() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/market?status=${status}&limit=${limit}&mode=lite`)
        if (!res.ok) throw new Error("Failed to fetch matches")
        const data = await res.json()
        if (cancelled) return

        // Transform soccer match data to SportMatchCard format
        const transformed = (data.matches || [])
          .filter((m: any) => {
            const home = m.home?.name
            const away = m.away?.name
            return home && away && home !== "TBD" && away !== "TBD"
          })
          .map((m: any) => {
            const consensus = m.odds?.novig_current || m.odds?.consensus
            const v1 = m.models?.v1_consensus || m.predictions?.v1
            const v2 = m.models?.v2_lightgbm || m.predictions?.v2
            const model = v2 || v1

            // Map soccer pick format (home/away/draw) to H/A/D
            let pick = model?.pick
            if (pick === "home") pick = "H"
            else if (pick === "away") pick = "A"
            else if (pick === "draw") pick = "D"

            // Build slug for match link
            const homeName = (m.home?.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-")
            const awayName = (m.away?.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-")
            const matchId = m.match_id || m.id
            const slug = `${homeName}-vs-${awayName}-${matchId}`

            return {
              event_id: String(matchId),
              // Use the requested status, not the API field (live API can return "finished" for in-progress matches)
              status: status === "live" ? "LIVE" : (m.status?.toUpperCase() || "UPCOMING"),
              commence_time: m.kickoff_at || m.matchDate || "",
              league: {
                name: m.league?.name || "Football",
                sport_key: "soccer",
              },
              home: { name: m.home?.name, team_id: null, logo: m.home?.logo_url ?? null },
              away: { name: m.away?.name, team_id: null, logo: m.away?.logo_url ?? null },
              odds: {
                consensus: consensus
                  ? {
                      home_prob: consensus.home,
                      away_prob: consensus.away,
                      draw_prob: consensus.draw,
                    }
                  : null,
              },
              spread: null,
              model: model
                ? {
                    predictions: {
                      home_win: model.probs?.home || (pick === "H" ? model.confidence : 0),
                      away_win: model.probs?.away || (pick === "A" ? model.confidence : 0),
                      pick,
                      confidence: model.confidence || 0,
                    },
                    source: v2 ? "v2_lightgbm" : "v1_consensus",
                    no_draw: false,
                  }
                : null,
              final_result: m.final_result || null,
              score: m.score || null,
              // Extra fields for link
              _slug: slug,
            }
          })

        setMatches(transformed)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load matches")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchMatches()
    return () => { cancelled = true }
  }, [status, limit])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400 text-sm">{error}</p>
        <button
          onClick={() => setLoading(true)}
          className="mt-3 text-emerald-400 hover:text-emerald-300 text-sm flex items-center gap-1 mx-auto"
        >
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      </div>
    )
  }

  if (matches.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400 text-sm">
          No {status} matches available
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {matches.map((match: any) => (
        <SportMatchCard
          key={match.event_id}
          match={match}
          sportKey="soccer"
          href={`/match/${match._slug}`}
        />
      ))}
    </div>
  )
}
