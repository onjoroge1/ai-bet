"use client"

/**
 * Honest sidebar stats — replaces the old hardcoded demo widgets
 * (TipsStats "89% win rate", WeeklyStats "92%", LiveStats "91% live
 * accuracy"), which showed invented numbers. This renders REAL last-30-day
 * figures from the public premium tracker, the same source as
 * /performance and the homepage tracker card. When the sample is thin it
 * says so instead of inventing a number.
 */
import { useEffect, useState } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Target, TrendingUp, BarChart3, Coins, ExternalLink } from "lucide-react"

interface TrackerStatsShape {
  record?: { wins?: number; losses?: number; pushes?: number; pending?: number }
  netDollars?: number
  roiPct?: number
  avgOdds?: number
  settledCount?: number
}

interface ApiShape {
  success?: boolean
  stats?: TrackerStatsShape
  premiumOnly?: TrackerStatsShape
}

function fmtUSD(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : ""
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

function fmtPct(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : ""
  return `${sign}${Math.abs(n).toFixed(1)}%`
}

export function TrackerSidebarStats({ title = "Tracker — last 30 days" }: { title?: string }) {
  const [stats, setStats] = useState<TrackerStatsShape | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/api/premium-tracker/stats?window=30")
      .then(r => r.json())
      .then((json: ApiShape) => {
        if (cancelled) return
        if (json.success && (json.premiumOnly || json.stats)) {
          setStats(json.premiumOnly ?? json.stats ?? null)
        } else {
          setFailed(true)
        }
      })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [])

  const settled = stats?.settledCount
    ?? ((stats?.record?.wins ?? 0) + (stats?.record?.losses ?? 0) + (stats?.record?.pushes ?? 0))
  const hasSample = !failed && stats !== null && settled >= 3

  const rows = hasSample && stats ? [
    {
      title: "Record (settled)",
      value: `${stats.record?.wins ?? 0}–${stats.record?.losses ?? 0}`,
      icon: Target, color: "emerald" as const,
    },
    {
      title: "Net (flat $100)",
      value: fmtUSD(stats.netDollars ?? 0),
      icon: Coins, color: "blue" as const,
    },
    {
      title: "ROI",
      value: fmtPct(stats.roiPct ?? 0),
      icon: TrendingUp, color: "purple" as const,
    },
    {
      title: "Avg odds",
      value: (stats.avgOdds ?? 0).toFixed(2),
      icon: BarChart3, color: "yellow" as const,
    },
  ] : []

  const iconBg: Record<string, string> = {
    emerald: "bg-emerald-500/20", blue: "bg-blue-500/20",
    purple: "bg-purple-500/20", yellow: "bg-yellow-500/20",
  }
  const iconFg: Record<string, string> = {
    emerald: "text-emerald-400", blue: "text-blue-400",
    purple: "text-purple-400", yellow: "text-yellow-400",
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700 p-6">
      <h3 className="text-white font-semibold mb-4">{title}</h3>

      {hasSample ? (
        <div className="space-y-4">
          {rows.map((stat, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg[stat.color]}`}>
                  <stat.icon className={`w-4 h-4 ${iconFg[stat.color]}`} />
                </div>
                <span className="text-slate-300 text-sm">{stat.title}</span>
              </div>
              <span className="text-white font-semibold">{stat.value}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-slate-400 text-sm leading-relaxed">
          Not enough settled picks in the last 30 days to show meaningful numbers —
          we don&apos;t invent them. Every pick is logged, wins and losses included.
        </p>
      )}

      <div className="mt-6 p-3 bg-slate-900/50 border border-slate-700 rounded-lg">
        <Link
          href="/performance"
          className="flex items-center gap-2 text-sm text-blue-300 hover:text-blue-200"
        >
          <ExternalLink className="w-4 h-4" />
          Full audited results — every win and loss
        </Link>
        <p className="text-slate-500 text-xs mt-1">
          Flat-stake simulation. Past performance does not guarantee future results.
        </p>
      </div>
    </Card>
  )
}
