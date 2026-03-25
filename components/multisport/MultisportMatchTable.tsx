"use client"

import { useState, useEffect } from "react"
import { SportMatchCard } from "./SportMatchCard"
import { SkeletonCard } from "@/components/match/shared"
import { RefreshCw } from "lucide-react"

interface MultisportMatchTableProps {
  sport: string
  status?: "upcoming" | "finished"
  limit?: number
}

export function MultisportMatchTable({ sport, status = "upcoming", limit = 20 }: MultisportMatchTableProps) {
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function fetchMatches() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/multisport/market?sport=${sport}&status=${status}&limit=${limit}`)
        if (!res.ok) throw new Error(`Failed to fetch ${sport} matches`)
        const data = await res.json()
        if (!cancelled) {
          setMatches(data.matches || [])
          setTotalCount(data.total_count || 0)
        }
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
  }, [sport, status, limit])

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
          onClick={() => { setLoading(true); setError(null); }}
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
        <p className="text-slate-400 text-sm">No {status} matches available</p>
      </div>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {matches.map((match: any) => (
          <SportMatchCard
            key={match.event_id}
            match={match}
            sportKey={sport}
          />
        ))}
      </div>
      {totalCount > matches.length && (
        <p className="text-center text-slate-500 text-xs mt-4">
          Showing {matches.length} of {totalCount} matches
        </p>
      )}
    </div>
  )
}
