"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Brain, Loader2, Flame, TrendingUp, AlertTriangle, Star, CheckCircle, Lock, Crown, RefreshCw,
} from "lucide-react"
import Link from "next/link"

interface BriefingBullet {
  text: string
  tier: "free" | "premium"
  icon: "fire" | "trend" | "warn" | "star" | "check"
}

interface BriefingResponse {
  bullets: BriefingBullet[]
  isPremium: boolean
  generatedAt: string
  cached: boolean
}

const ICON_MAP = {
  fire: { Icon: Flame, color: "text-orange-400" },
  trend: { Icon: TrendingUp, color: "text-emerald-400" },
  warn: { Icon: AlertTriangle, color: "text-amber-400" },
  star: { Icon: Star, color: "text-amber-300" },
  check: { Icon: CheckCircle, color: "text-cyan-400" },
} as const

function fmtRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ago`
}

/**
 * Daily AI Briefing panel — sits above the snapshot grid on /dashboard.
 *
 * Free users see the first 2 bullets. Premium users see all 5. Premium-tier
 * bullets render as locked teasers for free users with an upgrade CTA. The
 * underlying LLM call is server-side cached (1h) and edge-cached (5min) —
 * dashboard refreshes never re-trigger generation.
 */
export function DailyBriefing() {
  const [data, setData] = useState<BriefingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = async (cacheBust = false) => {
    if (cacheBust) setRefreshing(true)
    else setLoading(true)
    try {
      const url = cacheBust ? `/api/dashboard/briefing?_t=${Date.now()}` : "/api/dashboard/briefing"
      const res = await fetch(url, { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as BriefingResponse & { success: boolean }
      if (!json.success) throw new Error("briefing failed")
      setData(json)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-slate-800/60 via-slate-800/40 to-slate-900/60 border-slate-700/50">
        <CardContent className="p-6 flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
          <span className="text-sm text-slate-400">Generating today&apos;s briefing…</span>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.bullets.length === 0) return null

  const visibleBullets = data.isPremium
    ? data.bullets
    : data.bullets.filter(b => b.tier === "free").concat(
        data.bullets.filter(b => b.tier === "premium").map(() => null as any)
      )
  const lockedCount = !data.isPremium ? data.bullets.filter(b => b.tier === "premium").length : 0

  return (
    <Card className="bg-gradient-to-br from-emerald-950/40 via-slate-900/60 to-cyan-950/30 border-emerald-500/20 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <Brain className="w-4 h-4 text-emerald-400" />
            </div>
            Today&apos;s AI Briefing
            {data.cached && (
              <Badge className="bg-slate-700/50 text-slate-400 border-slate-600/50 text-[10px] font-normal">
                cached · {fmtRelative(data.generatedAt)}
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => load(true)}
            disabled={refreshing}
            className="h-7 w-7 p-0 text-slate-400 hover:text-emerald-400"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-2.5 pb-5">
        {data.bullets.map((b, i) => {
          const isLocked = !data.isPremium && b.tier === "premium"
          const { Icon, color } = ICON_MAP[b.icon] ?? ICON_MAP.check

          if (isLocked) {
            return (
              <div
                key={i}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/40 border border-slate-700/40"
              >
                <Lock className="w-4 h-4 shrink-0 text-slate-500" />
                <div className="flex-1">
                  <span className="text-xs text-slate-500">Premium insight</span>
                  <div className="h-3 mt-1 rounded bg-slate-700/40 max-w-md" />
                </div>
              </div>
            )
          }

          return (
            <div
              key={i}
              className="flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-slate-800/30 transition-colors"
            >
              <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${color}`} />
              <p className="text-sm text-slate-200 leading-relaxed flex-1">{b.text}</p>
              {b.tier === "premium" && data.isPremium && (
                <Crown className="w-3 h-3 shrink-0 mt-1 text-amber-400/70" />
              )}
            </div>
          )
        })}

        {/* Upgrade nudge for free users with locked bullets */}
        {lockedCount > 0 && (
          <div className="mt-2 pt-3 border-t border-slate-700/40 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              <Crown className="w-3.5 h-3.5 inline-block mr-1 text-amber-400" />
              {lockedCount} more insight{lockedCount === 1 ? "" : "s"} available with Pro.
            </p>
            <Link href="/pricing">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white h-7 text-xs">
                Unlock all
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
