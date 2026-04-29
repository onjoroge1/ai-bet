"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Crown, ArrowRight, Loader2, Lock } from "lucide-react"
import Link from "next/link"

interface Pick {
  id: string
  sport: string
  sportEmoji?: string
  homeTeam: string
  awayTeam: string
  league?: string
  pick: string         // "Home" | "Away" | "Draw" or "🔒"
  pickTeam: string
  confidence: number   // 0-100
  tier: string         // "premium" | "strong" | "standard"
  slug?: string
}

/**
 * Top Picks snapshot — replaces the misnamed "Hot Markets" widget that
 * showed match IDs without team names. Uses /api/premium/snapbet-picks
 * directly for proper team names + confidence + tier.
 *
 * Free users: picks redacted (🔒) — same gating the API enforces.
 * Premium users: top 3 picks with confidence + tier badge.
 */
export function TopPicksSnapshot() {
  const [picks, setPicks] = useState<Pick[]>([])
  const [isPremium, setIsPremium] = useState(false)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch("/api/premium/snapbet-picks?limit=10", { cache: "no-store" })
        if (!res.ok) throw new Error("fetch failed")
        const data = await res.json()
        if (cancelled) return
        const all = (data.picks ?? []) as Pick[]
        setPicks(all.slice(0, 3))
        setIsPremium(!!data.isPremium)
        setTotal(typeof data.total === "number" ? data.total : all.length)
      } catch {
        if (!cancelled) {
          setPicks([])
          setTotal(0)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Hero metric: top pick's confidence (or — when no data)
  const topConf = picks.length > 0 && picks[0].confidence > 0 ? picks[0].confidence : null

  return (
    <Card className="bg-slate-800/50 border-slate-700 h-full flex flex-col">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
          <Crown className="w-4 h-4 text-amber-400" />
          Top Picks
          <Badge className={`ml-auto text-[10px] ${isPremium ? "bg-amber-500/20 text-amber-300 border-amber-500/30" : "bg-slate-700/50 text-slate-300 border-slate-600"}`}>
            {isPremium ? "PRO" : "FREE"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 flex-1 flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold text-white mb-3">
              {topConf != null ? `${topConf}%` : "—"}
              <span className="text-xs font-medium text-slate-400 ml-2 align-middle">
                top of {total}
              </span>
            </div>
            <div className="space-y-1.5 flex-1">
              {picks.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-2">No picks surfaced yet today.</p>
              ) : (
                picks.map(p => {
                  const isLocked = !isPremium
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 px-2 py-1 rounded hover:bg-slate-700/30 text-xs"
                    >
                      <span className="truncate text-slate-200 min-w-0 flex-1">
                        {p.sportEmoji ?? "⚽"} {p.homeTeam} <span className="text-slate-500">vs</span> {p.awayTeam}
                      </span>
                      <span className="shrink-0 flex items-center gap-1.5">
                        {isLocked ? (
                          <>
                            <Lock className="w-3 h-3 text-slate-500" />
                            <span className="text-slate-500">—</span>
                          </>
                        ) : (
                          <>
                            <span className="text-emerald-400 font-medium">{p.pickTeam}</span>
                            <span className="font-mono text-slate-300">{p.confidence}%</span>
                          </>
                        )}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
            <Link
              href="/dashboard/snapbet-picks"
              className="mt-3 text-xs text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
            >
              View all picks <ArrowRight className="w-3 h-3" />
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  )
}
