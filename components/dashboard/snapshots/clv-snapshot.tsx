"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, ArrowRight, Loader2, Lock } from "lucide-react"
import Link from "next/link"

interface CLVOpp {
  alert_id?: string
  match_id?: number
  league?: string
  outcome?: string
  clv_pct?: number
  edge_pct?: number
  home_team?: string
  away_team?: string
}

/** CLV snapshot — top edge + 3 opportunities. Premium-gated by API. */
export function CLVSnapshot() {
  const [opps, setOpps] = useState<CLVOpp[]>([])
  const [isLocked, setIsLocked] = useState(false)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch("/api/clv/opportunities?limit=10", { cache: "no-store" })
        if (res.status === 401 || res.status === 403) {
          if (!cancelled) {
            setIsLocked(true)
            setLoading(false)
          }
          return
        }
        if (!res.ok) throw new Error("fetch failed")
        const data = await res.json()
        if (cancelled) return
        const all = (data.opportunities || data.alerts || []) as CLVOpp[]
        setOpps(all.slice(0, 3))
        setTotal(all.length)
      } catch {
        if (!cancelled) setOpps([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  function edgePct(o: CLVOpp): number {
    return Math.abs(Number(o.clv_pct ?? o.edge_pct ?? 0))
  }
  const bestEdge = opps.length > 0 ? edgePct(opps[0]) : null

  return (
    <Card className="bg-slate-800/50 border-slate-700 h-full flex flex-col">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-amber-400" />
          CLV Opportunities
          <Badge className="ml-auto text-[10px] bg-amber-500/20 text-amber-300 border-amber-500/30">
            PRO
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 flex-1 flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          </div>
        ) : isLocked ? (
          <>
            <div className="text-2xl font-bold text-slate-500 mb-3">
              <Lock className="w-5 h-5 inline-block mr-1.5 align-text-bottom" />
              <span className="text-base font-medium align-middle">Premium</span>
            </div>
            <p className="text-xs text-slate-400 flex-1 leading-relaxed">
              Track when sharper market moves create value. Subscribe to unlock real-time CLV opportunities across all leagues.
            </p>
            <Link
              href="/pricing"
              className="mt-3 text-xs text-amber-400 hover:text-amber-300 inline-flex items-center gap-1"
            >
              Unlock CLV Tracker <ArrowRight className="w-3 h-3" />
            </Link>
          </>
        ) : (
          <>
            <div className="text-2xl font-bold text-emerald-400 mb-3">
              {bestEdge != null ? `+${bestEdge.toFixed(1)}%` : "—"}
              <span className="text-xs font-medium text-slate-400 ml-2 align-middle">
                top edge of {total}
              </span>
            </div>
            <div className="space-y-1.5 flex-1">
              {opps.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-2">No CLV moves found right now.</p>
              ) : (
                opps.map((o, i) => (
                  <div
                    key={o.alert_id ?? `${o.match_id}-${i}`}
                    className="flex items-center justify-between gap-2 px-2 py-1 rounded hover:bg-slate-700/30 text-xs"
                  >
                    <span className="truncate text-slate-200 min-w-0 flex-1">
                      {o.home_team ?? "Home"} <span className="text-slate-500">vs</span> {o.away_team ?? "Away"}
                    </span>
                    <span className="shrink-0 text-emerald-400 font-mono">+{edgePct(o).toFixed(1)}%</span>
                  </div>
                ))
              )}
            </div>
            <Link
              href="/dashboard/clv"
              className="mt-3 text-xs text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
            >
              Open tracker <ArrowRight className="w-3 h-3" />
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  )
}
