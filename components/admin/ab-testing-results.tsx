'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { FlaskConical, RefreshCw, Award, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface VariantMetrics {
  n: number
  hit_rate: number | null
  brier: number | null
}

interface ABExperiment {
  id: string
  variants: Record<string, VariantMetrics>
  recommendation: string | null
  confidence: number | null
  status: string
  min_samples: number
}

interface ABResponse {
  experiments: ABExperiment[]
  window: string
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  running: { bg: 'bg-blue-500/20', text: 'text-blue-300', label: 'Running' },
  concluded: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', label: 'Concluded' },
  insufficient_data: { bg: 'bg-amber-500/20', text: 'text-amber-300', label: 'Needs Data' },
}

function statusStyle(status: string) {
  return STATUS_STYLES[status] ?? { bg: 'bg-slate-700/40', text: 'text-slate-400', label: status }
}

function experimentLabel(id: string) {
  return id
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function variantLabel(key: string) {
  const labels: Record<string, string> = {
    v1_consensus: 'V1 Consensus',
    v2_lgbm: 'V2 LightGBM',
    v3_sharp: 'V3 Sharp',
    v3_default: 'V3 Default',
  }
  return labels[key] ?? key
}

const WINDOW_OPTIONS = [
  { value: '7d', label: '7 days' },
  { value: '14d', label: '14 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
]

export function ABTestingResults() {
  const [data, setData] = useState<ABResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [window, setWindow] = useState('30d')

  const fetchData = async (w?: string) => {
    try {
      setLoading(true)
      const res = await fetch(`/api/admin/reports/ab-results?window=${w ?? window}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load A/B results')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [window])

  if (loading) {
    return (
      <Card className="bg-slate-800/60 border-slate-700">
        <CardContent className="p-6 space-y-4">
          <Skeleton className="h-6 w-48 bg-slate-700" />
          <Skeleton className="h-32 w-full bg-slate-700" />
        </CardContent>
      </Card>
    )
  }

  if (!data || !data.experiments.length) {
    return (
      <Card className="bg-slate-800/60 border-slate-700">
        <CardContent className="p-6 text-center text-slate-400">
          <FlaskConical className="h-8 w-8 mx-auto mb-2 text-slate-500" />
          <p>No A/B experiments running.</p>
          <p className="text-xs mt-1">Experiments are configured in the backend&apos;s ab_config.py.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-slate-800/60 border-slate-700">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-violet-400" />
            <h2 className="text-lg font-semibold text-white">A/B Testing</h2>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={window}
              onChange={e => { setWindow(e.target.value); fetchData(e.target.value) }}
              className="h-8 px-2 text-xs bg-slate-700/60 border border-slate-600 rounded-md text-slate-300 focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              {WINDOW_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <Button onClick={() => fetchData()} variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="space-y-5">
          {data.experiments.map((exp) => {
            const style = statusStyle(exp.status)
            const variants = Object.entries(exp.variants).sort(
              ([, a], [, b]) => (b.hit_rate ?? 0) - (a.hit_rate ?? 0)
            )
            const totalN = variants.reduce((sum, [, v]) => sum + v.n, 0)

            return (
              <div key={exp.id} className="space-y-3">
                {/* Experiment header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{experimentLabel(exp.id)}</span>
                    <Badge className={`${style.bg} ${style.text} border-transparent text-[10px]`}>
                      {style.label}
                    </Badge>
                  </div>
                  <span className="text-xs text-slate-500">
                    {totalN} predictions · min {exp.min_samples} per variant
                  </span>
                </div>

                {/* Recommendation callout */}
                {exp.recommendation && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                    <Award className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm text-emerald-300">
                      Recommended: <strong>{variantLabel(exp.recommendation)}</strong>
                    </span>
                    {exp.confidence !== null && (
                      <span className="text-xs text-slate-400 ml-auto">
                        {(exp.confidence * 100).toFixed(0)}% confidence
                      </span>
                    )}
                  </div>
                )}

                {exp.status === 'insufficient_data' && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                    <AlertCircle className="h-4 w-4 text-amber-400" />
                    <span className="text-xs text-amber-300">
                      Need at least {exp.min_samples} settled predictions per variant before a winner can be declared.
                    </span>
                  </div>
                )}

                {/* Variant table */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700 hover:bg-transparent">
                        <TableHead className="text-slate-300 text-xs">Variant</TableHead>
                        <TableHead className="text-slate-300 text-xs text-right">Predictions</TableHead>
                        <TableHead className="text-slate-300 text-xs text-right">Hit Rate</TableHead>
                        <TableHead className="text-slate-300 text-xs text-right">Brier</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {variants.map(([variant, metrics], i) => {
                        const isWinner = variant === exp.recommendation
                        return (
                          <TableRow
                            key={variant}
                            className={`border-slate-700/50 hover:bg-slate-800/40 ${isWinner ? 'bg-emerald-500/5' : ''}`}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {isWinner && <Award className="h-3.5 w-3.5 text-emerald-400" />}
                                <span className={`text-sm font-medium ${isWinner ? 'text-emerald-300' : 'text-slate-300'}`}>
                                  {variantLabel(variant)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-sm text-slate-300 font-mono">
                              {metrics.n.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">
                              {metrics.hit_rate !== null ? (
                                <span className={`font-mono text-sm font-medium ${
                                  metrics.hit_rate >= 0.50 ? 'text-emerald-400' :
                                  metrics.hit_rate >= 0.40 ? 'text-yellow-400' : 'text-red-400'
                                }`}>
                                  {(metrics.hit_rate * 100).toFixed(1)}%
                                </span>
                              ) : <span className="text-slate-500">—</span>}
                            </TableCell>
                            <TableCell className="text-right">
                              {metrics.brier !== null ? (
                                <span className={`font-mono text-sm ${
                                  metrics.brier <= 0.20 ? 'text-emerald-400' :
                                  metrics.brier <= 0.25 ? 'text-yellow-400' : 'text-red-400'
                                }`}>
                                  {metrics.brier.toFixed(3)}
                                </span>
                              ) : <span className="text-slate-500">—</span>}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
