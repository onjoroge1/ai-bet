'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { GraduationCap, RefreshCw, AlertTriangle, CheckCircle2, Database } from 'lucide-react'
import { toast } from 'sonner'

interface ModelMetrics {
  model: string
  total: number
  settled: number
  hit_rate: number | null
  logloss: number | null
  brier: number | null
}

interface ComparisonResponse {
  models: ModelMetrics[]
  window: string
}

const MODEL_LABELS: Record<string, string> = {
  v0_form: 'V0 Form (ELO)',
  v1_consensus: 'V1 Consensus',
  v2_lgbm: 'V2 LightGBM',
  v3_sharp: 'V3 Sharp',
  v3_basketball_nba: 'V3 NBA',
  v3_icehockey_nhl: 'V3 NHL',
  v3_basketball_ncaab: 'V3 NCAAB',
  v3_americanfootball_nfl: 'V3 NFL',
}

function modelLabel(key: string) {
  return MODEL_LABELS[key] ?? key
}

function getHealthStatus(m: ModelMetrics): { status: 'healthy' | 'warning' | 'critical'; reason: string } {
  const settleRatio = m.total > 0 ? m.settled / m.total : 0

  // No settled predictions at all
  if (m.settled === 0) {
    return { status: 'critical', reason: 'No settled predictions — settlement may not be running' }
  }

  // Very low settlement ratio — predictions aren't being resolved
  if (settleRatio < 0.3 && m.total > 20) {
    return { status: 'warning', reason: `Only ${(settleRatio * 100).toFixed(0)}% settled — check settlement pipeline` }
  }

  // Hit rate below random chance
  if (m.hit_rate !== null && m.hit_rate < 0.30 && m.settled >= 30) {
    return { status: 'critical', reason: `Hit rate ${(m.hit_rate * 100).toFixed(1)}% below random — retrain recommended` }
  }

  // Hit rate marginal
  if (m.hit_rate !== null && m.hit_rate < 0.38 && m.settled >= 30) {
    return { status: 'warning', reason: `Hit rate ${(m.hit_rate * 100).toFixed(1)}% is marginal — consider retraining` }
  }

  // Brier score too high
  if (m.brier !== null && m.brier > 0.28 && m.settled >= 30) {
    return { status: 'warning', reason: `Brier ${m.brier.toFixed(3)} is high — calibration may need updating` }
  }

  return { status: 'healthy', reason: 'Performing within expected range' }
}

const STATUS_ICON = {
  healthy: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
  warning: <AlertTriangle className="h-4 w-4 text-yellow-400" />,
  critical: <AlertTriangle className="h-4 w-4 text-red-400" />,
}

const STATUS_BADGE = {
  healthy: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  warning: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  critical: 'bg-red-500/20 text-red-300 border-red-500/40',
}

export function TrainingStatus() {
  const [data, setData] = useState<ComparisonResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/reports/model-comparison?window=all')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load training status')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  if (loading) {
    return (
      <Card className="bg-slate-800/60 border-slate-700">
        <CardContent className="p-6 space-y-4">
          <Skeleton className="h-6 w-48 bg-slate-700" />
          <Skeleton className="h-24 w-full bg-slate-700" />
        </CardContent>
      </Card>
    )
  }

  if (!data || !data.models.length) {
    return (
      <Card className="bg-slate-800/60 border-slate-700">
        <CardContent className="p-6 text-center text-slate-400">
          <GraduationCap className="h-8 w-8 mx-auto mb-2 text-slate-500" />
          <p>No model training data available.</p>
        </CardContent>
      </Card>
    )
  }

  const models = data.models.map(m => ({
    ...m,
    health: getHealthStatus(m),
  }))

  const criticalCount = models.filter(m => m.health.status === 'critical').length
  const warningCount = models.filter(m => m.health.status === 'warning').length
  const totalPredictions = models.reduce((sum, m) => sum + m.total, 0)
  const totalSettled = models.reduce((sum, m) => sum + m.settled, 0)

  return (
    <Card className="bg-slate-800/60 border-slate-700">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-white">Training &amp; Health</h2>
            {criticalCount > 0 && (
              <Badge className="bg-red-500/20 text-red-300 border-red-500/40 text-[10px]">
                {criticalCount} critical
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/40 text-[10px]">
                {warningCount} warning
              </Badge>
            )}
          </div>
          <Button onClick={fetchData} variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="p-3 bg-slate-900/40 rounded-lg text-center">
            <Database className="h-4 w-4 text-blue-400 mx-auto mb-1" />
            <div className="text-lg font-bold text-white">{totalPredictions.toLocaleString()}</div>
            <div className="text-[10px] text-slate-400 uppercase">Total Predictions</div>
          </div>
          <div className="p-3 bg-slate-900/40 rounded-lg text-center">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 mx-auto mb-1" />
            <div className="text-lg font-bold text-white">{totalSettled.toLocaleString()}</div>
            <div className="text-[10px] text-slate-400 uppercase">Settled</div>
          </div>
          <div className="p-3 bg-slate-900/40 rounded-lg text-center">
            <GraduationCap className="h-4 w-4 text-amber-400 mx-auto mb-1" />
            <div className="text-lg font-bold text-white">{models.length}</div>
            <div className="text-[10px] text-slate-400 uppercase">Active Models</div>
          </div>
        </div>

        {/* Per-model health */}
        <div className="space-y-2">
          {models.map((m) => (
            <div
              key={m.model}
              className="flex items-center justify-between px-3 py-2 bg-slate-900/30 rounded-lg border border-slate-700/40"
            >
              <div className="flex items-center gap-2 min-w-0">
                {STATUS_ICON[m.health.status]}
                <span className="text-sm font-medium text-white truncate">{modelLabel(m.model)}</span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs text-slate-500 font-mono">
                  {m.settled}/{m.total}
                </span>
                <Badge className={`${STATUS_BADGE[m.health.status]} text-[10px] max-w-[200px] truncate`}>
                  {m.health.reason}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
