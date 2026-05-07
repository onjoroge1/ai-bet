"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity, AlertTriangle, CheckCircle2, Clock, RefreshCw } from "lucide-react"

// ─── Types ──────────────────────────────────────────────────────────
interface HealthRow {
  name: string
  lastStartedAt: string | null
  lastCompletedAt: string | null
  lastDurationMs: number | null
  lastStatus: string | null
  lastError: string | null
  rowsAffected: number | null
  runCount: number
  errorCount: number
  ageMs: number | null
  health: 'healthy' | 'stale' | 'failed' | 'unknown'
}

interface HealthResponse {
  success: boolean
  now: string
  rows: HealthRow[]
}

// ─── Component ──────────────────────────────────────────────────────
export function CronHealthWidget() {
  const [data, setData] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      const res = await fetch('/api/admin/cron-health', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as HealthResponse
      setData(json)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load cron health')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [])

  // Aggregate header — surfaces the worst current state at a glance
  const worstHealth = data?.rows.reduce<'healthy' | 'stale' | 'failed' | 'unknown'>((acc, r) => {
    const order = { failed: 3, stale: 2, unknown: 1, healthy: 0 } as const
    return order[r.health] > order[acc] ? r.health : acc
  }, 'healthy') ?? 'unknown'

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-white flex items-center gap-2 text-base">
          <Activity className="w-5 h-5 text-emerald-400" />
          Cron Health
          <HealthBadge value={worstHealth} />
        </CardTitle>
        <button
          onClick={load}
          className="text-slate-400 hover:text-slate-200 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </CardHeader>
      <CardContent className="pt-0">
        {error && (
          <div className="text-red-400 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        )}

        {!error && data && data.rows.length === 0 && (
          <div className="text-slate-500 text-sm italic">
            No cron heartbeats recorded yet — they will appear after the next scheduled run.
          </div>
        )}

        {!error && data && data.rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-xs uppercase tracking-wider border-b border-slate-700">
                  <th className="text-left py-2 font-medium">Job</th>
                  <th className="text-left py-2 font-medium">Status</th>
                  <th className="text-right py-2 font-medium">Last Run</th>
                  <th className="text-right py-2 font-medium">Duration</th>
                  <th className="text-right py-2 font-medium">Rows</th>
                  <th className="text-right py-2 font-medium">Runs / Errors</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.name} className="border-b border-slate-800/60 last:border-0">
                    <td className="py-2 text-white font-mono">{r.name}</td>
                    <td className="py-2">
                      <HealthBadge value={r.health} />
                    </td>
                    <td className="py-2 text-right text-slate-300" title={r.lastCompletedAt ?? ''}>
                      {r.lastCompletedAt ? formatRelative(r.ageMs ?? 0) : '—'}
                    </td>
                    <td className="py-2 text-right text-slate-300 font-mono">
                      {r.lastDurationMs != null ? formatDuration(r.lastDurationMs) : '—'}
                    </td>
                    <td className="py-2 text-right text-slate-300 font-mono">
                      {r.rowsAffected ?? '—'}
                    </td>
                    <td className="py-2 text-right text-slate-300 font-mono">
                      {r.runCount} / <span className={r.errorCount > 0 ? 'text-red-400' : ''}>{r.errorCount}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.rows.some((r) => r.lastError) && (
          <div className="mt-3 text-xs text-slate-400">
            Most recent errors:
            <ul className="mt-1 space-y-1">
              {data.rows
                .filter((r) => r.lastError)
                .map((r) => (
                  <li key={r.name} className="font-mono text-red-400 break-all">
                    {r.name}: {r.lastError}
                  </li>
                ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────
function HealthBadge({ value }: { value: HealthRow['health'] }) {
  const cfg = {
    healthy: { label: 'Healthy', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40', icon: CheckCircle2 },
    stale: { label: 'Stale', cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40', icon: Clock },
    failed: { label: 'Failed', cls: 'bg-red-500/20 text-red-400 border-red-500/40', icon: AlertTriangle },
    unknown: { label: 'Unknown', cls: 'bg-slate-500/20 text-slate-400 border-slate-500/40', icon: Clock },
  }[value]
  const Icon = cfg.icon
  return (
    <Badge className={`${cfg.cls} text-[10px] px-2 py-0.5 font-medium gap-1`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </Badge>
  )
}

function formatRelative(ms: number): string {
  if (ms < 0) ms = 0
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 48) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}
