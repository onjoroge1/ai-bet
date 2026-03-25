'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Trophy, Brain, TrendingUp, RefreshCw, Crown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface ModelMetrics {
  model: string
  total: number
  settled: number
  hit_rate: number | null
  logloss: number | null
  brier: number | null
}

interface HeadToHeadData {
  best_overall: string | null
  best_by_league: Record<string, string>
  best_by_league_detail: Record<string, { model: string; hit_rate: number; n: number }>
  best_multisport: string | null
}

interface ComparisonResponse {
  models: ModelMetrics[]
  head_to_head: HeadToHeadData
  window: string
}

const MODEL_LABELS: Record<string, { label: string; colour: string }> = {
  v0_form: { label: 'V0 Form (ELO)', colour: 'text-slate-400' },
  v1_consensus: { label: 'V1 Consensus', colour: 'text-blue-400' },
  v2_lgbm: { label: 'V2 LightGBM', colour: 'text-purple-400' },
  v3_sharp: { label: 'V3 Sharp', colour: 'text-emerald-400' },
  v3_basketball_nba: { label: 'V3 NBA', colour: 'text-orange-400' },
  v3_icehockey_nhl: { label: 'V3 NHL', colour: 'text-cyan-400' },
  v3_basketball_ncaab: { label: 'V3 NCAAB', colour: 'text-yellow-400' },
  v3_americanfootball_nfl: { label: 'V3 NFL', colour: 'text-red-400' },
}

function modelLabel(key: string) {
  return MODEL_LABELS[key]?.label ?? key
}
function modelColour(key: string) {
  return MODEL_LABELS[key]?.colour ?? 'text-slate-300'
}

function metricBadge(value: number | null, thresholds: [number, number], invert = false) {
  if (value === null) return <span className="text-slate-500">—</span>
  const good = invert ? value <= thresholds[0] : value >= thresholds[0]
  const ok = invert ? value <= thresholds[1] : value >= thresholds[1]
  const colour = good ? 'text-emerald-400' : ok ? 'text-yellow-400' : 'text-red-400'
  return <span className={`font-mono font-medium ${colour}`}>{(value * 100).toFixed(1)}%</span>
}

export function ModelLeaderboard() {
  const [data, setData] = useState<ComparisonResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [window, setWindow] = useState('30d')

  const fetchData = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/admin/reports/model-comparison?window=${window}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load model comparison')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [window]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <Card className="bg-slate-800/60 border-slate-700">
        <CardContent className="p-6 space-y-4">
          <Skeleton className="h-6 w-64 bg-slate-700" />
          <Skeleton className="h-48 w-full bg-slate-700" />
        </CardContent>
      </Card>
    )
  }

  if (!data || !data.models.length) {
    return (
      <Card className="bg-slate-800/60 border-slate-700">
        <CardContent className="p-6 text-center text-slate-400">
          <Brain className="h-8 w-8 mx-auto mb-2 text-slate-500" />
          <p>No model performance data available yet.</p>
          <p className="text-xs mt-1">Predictions need to be settled (matches completed) before metrics appear.</p>
        </CardContent>
      </Card>
    )
  }

  const bestModel = data.head_to_head.best_overall

  return (
    <Card className="bg-slate-800/60 border-slate-700">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-400" />
            <h2 className="text-lg font-semibold text-white">All-Models Leaderboard</h2>
          </div>
          <div className="flex items-center gap-2">
            <Select value={window} onValueChange={setWindow}>
              <SelectTrigger className="w-[100px] bg-slate-700/50 border-slate-600 text-white text-xs h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 days</SelectItem>
                <SelectItem value="14d">14 days</SelectItem>
                <SelectItem value="30d">30 days</SelectItem>
                <SelectItem value="90d">90 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={fetchData} variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Best model callout */}
        {bestModel && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
            <Crown className="h-4 w-4 text-yellow-400" />
            <span className="text-sm text-yellow-300">
              Best overall: <strong className={modelColour(bestModel)}>{modelLabel(bestModel)}</strong>
            </span>
            {data.head_to_head.best_multisport && (
              <span className="text-xs text-slate-400 ml-auto">
                Best multisport: <strong className={modelColour(data.head_to_head.best_multisport)}>{modelLabel(data.head_to_head.best_multisport)}</strong>
              </span>
            )}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700 hover:bg-transparent">
                <TableHead className="text-slate-300 text-xs">#</TableHead>
                <TableHead className="text-slate-300 text-xs">Model</TableHead>
                <TableHead className="text-slate-300 text-xs text-right">Predictions</TableHead>
                <TableHead className="text-slate-300 text-xs text-right">Settled</TableHead>
                <TableHead className="text-slate-300 text-xs text-right">Hit Rate</TableHead>
                <TableHead className="text-slate-300 text-xs text-right">Brier</TableHead>
                <TableHead className="text-slate-300 text-xs text-right">LogLoss</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.models.map((m, i) => {
                const isBest = m.model === bestModel
                return (
                  <TableRow
                    key={m.model}
                    className={`border-slate-700/50 hover:bg-slate-800/40 ${isBest ? 'bg-yellow-500/5' : ''}`}
                  >
                    <TableCell className="text-slate-500 text-xs font-mono">
                      {isBest ? <Crown className="h-3.5 w-3.5 text-yellow-400" /> : i + 1}
                    </TableCell>
                    <TableCell>
                      <span className={`font-medium text-sm ${modelColour(m.model)}`}>
                        {modelLabel(m.model)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm text-slate-300 font-mono">
                      {m.total.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-sm text-slate-400 font-mono">
                      {m.settled.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {metricBadge(m.hit_rate, [0.50, 0.40])}
                    </TableCell>
                    <TableCell className="text-right">
                      {m.brier !== null ? (
                        <span className={`font-mono text-sm ${m.brier <= 0.20 ? 'text-emerald-400' : m.brier <= 0.25 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {m.brier.toFixed(3)}
                        </span>
                      ) : <span className="text-slate-500">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      {m.logloss !== null ? (
                        <span className={`font-mono text-sm ${m.logloss <= 0.90 ? 'text-emerald-400' : m.logloss <= 1.05 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {m.logloss.toFixed(3)}
                        </span>
                      ) : <span className="text-slate-500">—</span>}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        {/* Best by league */}
        {Object.keys(data.head_to_head.best_by_league_detail).length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-700/50">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-cyan-400" />
              <span className="text-sm font-medium text-white">Best Model per League</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.head_to_head.best_by_league_detail).map(([league, info]) => (
                <Badge
                  key={league}
                  className="bg-slate-700/40 text-slate-300 border-slate-600/40 text-[10px]"
                >
                  {league}: <span className={`ml-1 ${modelColour(info.model)}`}>{modelLabel(info.model)}</span>
                  <span className="ml-1 text-slate-500">({(info.hit_rate * 100).toFixed(0)}%, n={info.n})</span>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
