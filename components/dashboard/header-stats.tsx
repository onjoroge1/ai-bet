"use client"

import { useState, useEffect } from "react"
import { Loader2, Target, Layers, TrendingUp, Activity } from "lucide-react"

interface HeaderStats {
  topPickConfidence: number | null  // % of model's top surface-true pick today
  matchesUpcoming: number             // count of upcoming matches in /market
  bestParlayEdge: number | null       // best parlay edge % today
  clvOpportunities: number | null     // count of high-CLV moves found today
}

/**
 * Header stats strip — 4 inline KPIs sitting below the welcome message.
 * Pulls real numbers from existing public endpoints (snapbet picks + market)
 * and the premium endpoints when available. Falls back gracefully when an
 * endpoint isn't authorised — premium gating handled by hiding/dimming.
 */
export function HeaderStats() {
  const [stats, setStats] = useState<HeaderStats>({
    topPickConfidence: null,
    matchesUpcoming: 0,
    bestParlayEdge: null,
    clvOpportunities: null,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [picksRes, marketRes, parlaysRes, clvRes] = await Promise.all([
          fetch("/api/premium/snapbet-picks?limit=5", { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch("/api/market?status=upcoming&mode=lite&limit=1", { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch("/api/premium/suggested-parlays?limit=3", { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch("/api/clv/opportunities?limit=20", { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null),
        ])
        if (cancelled) return

        // Top pick confidence (only for surfaceable picks with numeric values)
        const picks = picksRes?.picks || []
        const numericConfs = picks
          .map((p: any) => Number(p.confidence) || 0)
          .filter((c: number) => c > 0)
        const topConf = numericConfs.length > 0 ? Math.max(...numericConfs) : null

        // Matches count
        const matches = typeof marketRes?.total_count === "number"
          ? marketRes.total_count
          : (marketRes?.matches?.length ?? 0)

        // Best parlay edge
        const parlays = parlaysRes?.parlays || parlaysRes?.suggestions || []
        const edges: number[] = parlays
          .map((p: any) => p.expected_edge ?? p.edge ?? p.total_edge)
          .filter((e: any) => typeof e === "number")
        const bestEdge = edges.length > 0 ? Math.max(...edges) : null

        // CLV opportunities count (high-edge ≥3%)
        const clvOpps = clvRes?.opportunities || clvRes?.alerts || []
        const highEdge = clvOpps.filter((o: any) => Math.abs(Number(o.clv_pct ?? o.edge_pct ?? 0)) >= 3).length

        setStats({
          topPickConfidence: topConf,
          matchesUpcoming: matches,
          bestParlayEdge: bestEdge,
          clvOpportunities: clvOpps.length > 0 ? highEdge : null,
        })
      } catch {
        // keep defaults
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Stat
        icon={<Target className="w-3.5 h-3.5 text-emerald-400" />}
        label="Top Pick Confidence"
        value={stats.topPickConfidence != null ? `${Math.round(stats.topPickConfidence)}%` : "—"}
        loading={loading}
      />
      <Stat
        icon={<Activity className="w-3.5 h-3.5 text-cyan-400" />}
        label="Matches Today"
        value={stats.matchesUpcoming.toString()}
        loading={loading}
      />
      <Stat
        icon={<Layers className="w-3.5 h-3.5 text-orange-400" />}
        label="Best Parlay Edge"
        value={stats.bestParlayEdge != null ? `+${stats.bestParlayEdge.toFixed(1)}%` : "—"}
        muted={stats.bestParlayEdge == null}
        loading={loading}
      />
      <Stat
        icon={<TrendingUp className="w-3.5 h-3.5 text-amber-400" />}
        label="CLV Moves (≥3%)"
        value={stats.clvOpportunities != null ? stats.clvOpportunities.toString() : "—"}
        muted={stats.clvOpportunities == null}
        loading={loading}
      />
    </div>
  )
}

function Stat({ icon, label, value, muted, loading }: { icon: React.ReactNode; label: string; value: string; muted?: boolean; loading?: boolean }) {
  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg px-3 py-2 flex items-center gap-2">
      <div className="shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider truncate">{label}</div>
        <div className={`text-lg font-bold leading-tight ${muted ? "text-slate-500" : "text-white"}`}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin inline-block" /> : value}
        </div>
      </div>
    </div>
  )
}
