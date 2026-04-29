"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Layers, ArrowRight, Loader2, Lock } from "lucide-react"
import Link from "next/link"

interface ParlayLeg {
  home_team?: string
  away_team?: string
  outcome?: string
}
interface Parlay {
  parlay_id?: string
  leg_count?: number
  legs?: ParlayLeg[]
  expected_edge?: number
  total_edge?: number
  edge?: number
  decimal_odds?: number
  total_odds?: number
  odds?: number
  confidence_tier?: string
}

/** Slim parlays snapshot — single hero edge + 3 parlay rows. */
export function ParlaysSnapshot() {
  const [parlays, setParlays] = useState<Parlay[]>([])
  const [isPremium, setIsPremium] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch("/api/premium/suggested-parlays?limit=10", { cache: "no-store" })
        if (!res.ok) throw new Error("fetch failed")
        const data = await res.json()
        if (cancelled) return
        const all = (data.parlays || data.suggestions || []) as Parlay[]
        setParlays(all.slice(0, 3))
        setIsPremium(!!data.isPremium)
      } catch {
        if (!cancelled) setParlays([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  function edgeOf(p: Parlay) {
    return p.expected_edge ?? p.total_edge ?? p.edge ?? 0
  }
  function oddsOf(p: Parlay) {
    return p.decimal_odds ?? p.total_odds ?? p.odds ?? 0
  }
  function legsOf(p: Parlay) {
    return p.leg_count ?? p.legs?.length ?? 0
  }

  const bestEdge = parlays[0] ? edgeOf(parlays[0]) : null

  return (
    <Card className="bg-slate-800/50 border-slate-700 h-full flex flex-col">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-orange-400" />
          Hot Parlays
          <Badge className={`ml-auto text-[10px] ${isPremium ? "bg-amber-500/20 text-amber-300 border-amber-500/30" : "bg-slate-700/50 text-slate-300 border-slate-600"}`}>
            {isPremium ? "PRO" : "FREE"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 flex-1 flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-orange-400" />
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold text-emerald-400 mb-3">
              {bestEdge != null ? `+${(bestEdge * (Math.abs(bestEdge) > 1 ? 1 : 100)).toFixed(1)}%` : "—"}
              <span className="text-xs font-medium text-slate-400 ml-2 align-middle">
                best edge
              </span>
            </div>
            <div className="space-y-1.5 flex-1">
              {parlays.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-2">No parlays available right now.</p>
              ) : (
                parlays.map((p, i) => {
                  const isLocked = !isPremium && i > 0
                  const edge = edgeOf(p)
                  const odds = oddsOf(p)
                  const edgeDisplay = edge ? `+${(edge * (Math.abs(edge) > 1 ? 1 : 100)).toFixed(1)}%` : "—"
                  return (
                    <div
                      key={p.parlay_id ?? i}
                      className="flex items-center justify-between gap-2 px-2 py-1 rounded hover:bg-slate-700/30 text-xs"
                    >
                      <span className="text-slate-200 min-w-0 flex-1">
                        <span className="text-slate-400">{legsOf(p)}-leg</span>
                        {odds > 0 && (
                          <span className="text-slate-500 ml-1.5">· {odds.toFixed(2)}x</span>
                        )}
                      </span>
                      <span className="shrink-0 flex items-center gap-1.5">
                        {isLocked ? (
                          <>
                            <Lock className="w-3 h-3 text-slate-500" />
                            <span className="text-slate-500">—</span>
                          </>
                        ) : (
                          <span className="text-emerald-400 font-mono">{edgeDisplay}</span>
                        )}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
            <Link
              href="/dashboard/parlays"
              className="mt-3 text-xs text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
            >
              View all parlays <ArrowRight className="w-3 h-3" />
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  )
}
