"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity, ArrowRight, Loader2 } from "lucide-react"
import Link from "next/link"

interface MatchSummary {
  id: string | number
  league?: { name?: string } | string | null
  home?: { name?: string } | string
  away?: { name?: string } | string
  kickoff_at?: string
}

/**
 * Today's Matches snapshot — free tier widget. Pulls upcoming matches from
 * /api/market (no auth required) and shows kickoff count + 3 fixtures with a
 * link into the full matches list. Designed to fill one cell of the dashboard
 * 4-up grid alongside Top Picks / Parlays / CLV.
 */
export function TodaysMatchesWidget() {
  const [matches, setMatches] = useState<MatchSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await fetch("/api/market?status=upcoming&mode=lite&limit=10", { cache: "no-store" })
        if (!res.ok) throw new Error("fetch failed")
        const data = await res.json()
        if (cancelled) return
        const all = (data.matches || []) as MatchSummary[]
        setMatches(all.slice(0, 3))
        setTotal(typeof data.total_count === "number" ? data.total_count : all.length)
      } catch {
        if (!cancelled) {
          setMatches([])
          setTotal(0)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  function teamName(t: MatchSummary["home"]) {
    return typeof t === "string" ? t : t?.name ?? "—"
  }
  function leagueName(l: MatchSummary["league"]) {
    return typeof l === "string" ? l : l?.name ?? ""
  }
  function fmtKickoff(iso?: string) {
    if (!iso) return ""
    const d = new Date(iso)
    const ms = d.getTime() - Date.now()
    if (ms < 0) return "live"
    const mins = Math.floor(ms / 60000)
    if (mins < 60) return `in ${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `in ${hrs}h`
    const days = Math.floor(hrs / 24)
    return `in ${days}d`
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700 h-full flex flex-col">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          Today&apos;s Matches
          <Badge className="ml-auto bg-slate-700/50 text-slate-300 border-slate-600 text-[10px]">
            FREE
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 flex-1 flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold text-white mb-3">
              {total}
              <span className="text-xs font-medium text-slate-400 ml-2 align-middle">upcoming</span>
            </div>
            <div className="space-y-1.5 flex-1">
              {matches.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-2">No upcoming matches in the next window.</p>
              ) : (
                matches.map(m => (
                  <div key={m.id} className="text-xs flex items-center justify-between gap-2 px-2 py-1 rounded hover:bg-slate-700/30">
                    <span className="truncate text-slate-200 min-w-0 flex-1">
                      {teamName(m.home)} <span className="text-slate-500">vs</span> {teamName(m.away)}
                    </span>
                    <span className="shrink-0 text-slate-500 font-mono">{fmtKickoff(m.kickoff_at)}</span>
                  </div>
                ))
              )}
            </div>
            <Link
              href="/dashboard/matches"
              className="mt-3 text-xs text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
            >
              Browse matches <ArrowRight className="w-3 h-3" />
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  )
}
