'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AdvancedBreadcrumb } from '@/components/advanced-breadcrumb'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  CheckCircle2,
  XCircle,
  Minus,
  RefreshCw,
  Search,
  BarChart3,
  Target,
  Brain,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Trophy,
  AlertTriangle,
  Eye,
  GitCompareArrows,
  Database,
} from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModelInfo {
  pick: string | null
  confidence: number | null
  probs: Record<string, number> | null
  correct: boolean | null
  recommendedBet?: string | null
  source?: 'enrichment' | 'sync'
  agreement?: { agreesWith: boolean; confidenceDelta: number } | null
}

interface PredictionInfo {
  confidence: number | null
  type: string | null
  valueRating: string | null
  odds: number | null
  explanation: string | null
}

interface MatchRow {
  id: string
  matchId: string
  homeTeam: string
  awayTeam: string
  league: string
  kickoffDate: string
  score: { home: number | null; away: number | null } | null
  actualOutcome: string | null
  outcomeText: string | null
  v1: ModelInfo | null
  v2: ModelInfo | null
  modelsAgree: boolean | null
  prediction: PredictionInfo | null
  consensusOdds: { home?: number; draw?: number; away?: number } | null
}

interface HeadToHead {
  agreeBoth: number
  agreeCorrect: number
  agreeAccuracy: number | null
  disagreeBoth: number
  disagreeV1Right: number
  disagreeV2Right: number
  disagreeNeitherRight: number
}

interface Stats {
  totalFinished: number
  totalWithScores: number
  totalMissingScores: number
  globalMissingScores: number
  totalWithQpModels: number
  v1: { total: number; correct: number; accuracy: number | null }
  v2: { total: number; correct: number; accuracy: number | null }
  headToHead: HeadToHead
}

interface ApiResponse {
  success: boolean
  data: MatchRow[]
  pagination: { page: number; limit: number; totalCount: number; totalPages: number }
  stats: Stats
  leagues: string[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickLabel(pick: string | null): string {
  if (!pick) return '—'
  if (pick === 'home') return 'Home'
  if (pick === 'away') return 'Away'
  if (pick === 'draw') return 'Draw'
  return pick
}

function outcomeLabel(outcome: string | null): string {
  if (!outcome) return '—'
  if (outcome === 'home') return 'H'
  if (outcome === 'away') return 'A'
  if (outcome === 'draw') return 'D'
  return outcome
}

function CorrectBadge({ correct }: { correct: boolean | null }) {
  if (correct === true) return <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]"><CheckCircle2 className="h-3 w-3 mr-0.5" />Hit</Badge>
  if (correct === false) return <Badge className="bg-red-500/20 text-red-300 border-red-500/40 text-[10px]"><XCircle className="h-3 w-3 mr-0.5" />Miss</Badge>
  return <Badge className="bg-slate-700/40 text-slate-400 border-slate-600/40 text-[10px]"><Minus className="h-3 w-3 mr-0.5" />N/A</Badge>
}

function AccuracyRing({ value, label }: { value: number | null; label: string }) {
  const pct = value ?? 0
  const colour = pct >= 60 ? 'text-emerald-400' : pct >= 45 ? 'text-yellow-400' : 'text-red-400'
  const bg = pct >= 60 ? 'bg-emerald-500/10' : pct >= 45 ? 'bg-yellow-500/10' : 'bg-red-500/10'
  return (
    <div className={`flex flex-col items-center gap-1 p-4 rounded-xl ${bg}`}>
      <span className={`text-3xl font-bold ${colour}`}>{value !== null ? `${value}%` : '—'}</span>
      <span className="text-xs text-slate-400 uppercase tracking-wide font-medium">{label}</span>
    </div>
  )
}

function pct(n: number, d: number): string {
  if (d === 0) return '—'
  return `${Math.round((n / d) * 100)}%`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminReportsPage() {
  const [data, setData] = useState<MatchRow[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [leagues, setLeagues] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const [search, setSearch] = useState('')
  const [leagueFilter, setLeagueFilter] = useState('all')
  const [resultFilter, setResultFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [selectedMatch, setSelectedMatch] = useState<MatchRow | null>(null)
  const [backfilling, setBackfilling] = useState(false)
  const [backfillResult, setBackfillResult] = useState<Record<string, unknown> | null>(null)

  const runBackfill = async () => {
    try {
      setBackfilling(true)
      setBackfillResult(null)
      const res = await fetch('/api/admin/reports/backfill-scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 200 }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setBackfillResult(json)
      const totalFixed = (json.phase1?.fixed ?? 0) + (json.phase2?.fixed ?? 0) + (json.phase3?.fixed ?? 0)
      if (totalFixed > 0) {
        toast.success(`Backfill complete: ${totalFixed} scores recovered, ${json.remainingMissing} still missing`)
      } else {
        toast.info(`No new scores found. ${json.remainingMissing} matches remain without scores.`)
      }
      fetchData(page)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Backfill failed')
    } finally {
      setBackfilling(false)
    }
  }

  const fetchData = async (pageNum = 1) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ page: String(pageNum), limit: '50' })
      if (search) params.set('search', search)
      if (leagueFilter !== 'all') params.set('league', leagueFilter)
      if (resultFilter !== 'all') params.set('result', resultFilter)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)

      const res = await fetch(`/api/admin/reports/completed-matches?${params.toString()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: ApiResponse = await res.json()

      setData(json.data)
      setStats(json.stats)
      setLeagues(json.leagues)
      setPage(json.pagination.page)
      setTotalPages(json.pagination.totalPages)
      setTotalCount(json.pagination.totalCount)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData(1) }, [leagueFilter, resultFilter, dateFrom, dateTo]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = () => fetchData(1)

  const pageInsights = useMemo(() => {
    let v1Hits = 0, v1Misses = 0, v2Hits = 0, v2Misses = 0, agree = 0, disagree = 0
    for (const r of data) {
      if (r.v1?.correct === true) v1Hits++
      if (r.v1?.correct === false) v1Misses++
      if (r.v2?.correct === true) v2Hits++
      if (r.v2?.correct === false) v2Misses++
      if (r.modelsAgree === true) agree++
      if (r.modelsAgree === false) disagree++
    }
    return { v1Hits, v1Misses, v2Hits, v2Misses, agree, disagree }
  }, [data])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 text-slate-100">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        <AdvancedBreadcrumb items={[
          { label: 'Admin', href: '/admin' },
          { label: 'Reports', href: '/admin/reports' },
        ]} />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
              <BarChart3 className="h-7 w-7 text-emerald-400" />
              Model Performance Reports
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Completed matches with AI prediction accuracy &amp; V1 vs V2 comparison
            </p>
          </div>
          <Button onClick={() => fetchData(page)} variant="outline" size="sm" className="border-slate-600 text-slate-300">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* ── Stats Row (scoped to active filters) ──────────────────────── */}
        {stats && (
          <>
          {(search || leagueFilter !== 'all' || dateFrom || dateTo) && (
            <div className="flex items-center gap-2 text-xs text-cyan-400">
              <Target className="h-3.5 w-3.5" />
              <span>Stats filtered by:</span>
              {leagueFilter !== 'all' && <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-[10px]">{leagueFilter}</Badge>}
              {dateFrom && <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-[10px]">From {dateFrom}</Badge>}
              {dateTo && <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-[10px]">To {dateTo}</Badge>}
              {search && <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-[10px]">&quot;{search}&quot;</Badge>}
            </div>
          )}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="bg-slate-800/60 border-slate-700">
              <CardContent className="p-4 flex flex-col items-center">
                <Trophy className="h-5 w-5 text-yellow-400 mb-1" />
                <span className="text-2xl font-bold text-white">{stats.totalFinished}</span>
                <span className="text-xs text-slate-400">Total Completed</span>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/60 border-slate-700">
              <CardContent className="p-4 flex flex-col items-center">
                <Target className="h-5 w-5 text-blue-400 mb-1" />
                <span className="text-2xl font-bold text-white">{stats.totalWithScores}</span>
                <span className="text-xs text-slate-400">With Scores</span>
                {stats.globalMissingScores > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[10px] text-red-400 hover:text-red-300 mt-0.5 h-auto p-0"
                    disabled={backfilling}
                    onClick={runBackfill}
                  >
                    {backfilling ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
                    {stats.globalMissingScores} missing globally — backfill
                  </Button>
                )}
                {stats.totalMissingScores > 0 && stats.totalMissingScores !== stats.globalMissingScores && (
                  <span className="text-[10px] text-slate-500">{stats.totalMissingScores} missing in current filter</span>
                )}
              </CardContent>
            </Card>
            <Card className="bg-slate-800/60 border-slate-700">
              <CardContent className="p-4 flex flex-col items-center">
                <Database className="h-5 w-5 text-purple-400 mb-1" />
                <span className="text-2xl font-bold text-white">{stats.totalWithQpModels}</span>
                <span className="text-xs text-slate-400">With QP Models</span>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/60 border-slate-700">
              <CardContent className="p-4">
                <AccuracyRing value={stats.v1.accuracy} label={`V1 (${stats.v1.correct}/${stats.v1.total})`} />
              </CardContent>
            </Card>
            <Card className="bg-slate-800/60 border-slate-700">
              <CardContent className="p-4">
                <AccuracyRing value={stats.v2.accuracy} label={`V2 (${stats.v2.correct}/${stats.v2.total})`} />
              </CardContent>
            </Card>
          </div>
          </>
        )}

        {/* ── Backfill Result ──────────────────────────────────────────────── */}
        {backfillResult && (
          <Card className="bg-slate-800/60 border-slate-700 border-l-4 border-l-emerald-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">Backfill Results</h3>
                <Button variant="ghost" size="sm" className="h-6 text-xs text-slate-400" onClick={() => setBackfillResult(null)}>Dismiss</Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-2 bg-slate-900/40 rounded">
                  <div className="text-slate-400">Phase 1 (DB scores)</div>
                  <div className="text-white font-bold">{(backfillResult.phase1 as Record<string, number>)?.fixed ?? 0} fixed</div>
                </div>
                <div className="p-2 bg-slate-900/40 rounded">
                  <div className="text-slate-400">Phase 2 (API-Football)</div>
                  <div className="text-white font-bold">{(backfillResult.phase2 as Record<string, number>)?.fixed ?? 0} fixed</div>
                  <div className="text-slate-500">{(backfillResult.phase2 as Record<string, number>)?.noMatch ?? 0} no match, {(backfillResult.phase2 as Record<string, number>)?.apiCalls ?? 0} API calls</div>
                </div>
                <div className="p-2 bg-slate-900/40 rounded">
                  <div className="text-slate-400">Phase 3 (Backend API)</div>
                  <div className="text-white font-bold">{(backfillResult.phase3 as Record<string, number>)?.fixed ?? 0} fixed</div>
                  <div className="text-slate-500">{(backfillResult.phase3 as Record<string, number>)?.noData ?? 0} no data</div>
                </div>
                <div className="p-2 bg-slate-900/40 rounded">
                  <div className="text-slate-400">Remaining Missing</div>
                  <div className={`font-bold ${(backfillResult.remainingMissing as number) === 0 ? 'text-emerald-400' : 'text-orange-400'}`}>
                    {backfillResult.remainingMissing as number}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── V1 vs V2 Head-to-Head ───────────────────────────────────────── */}
        {stats && stats.headToHead.agreeBoth + stats.headToHead.disagreeBoth > 0 && (
          <Card className="bg-slate-800/60 border-slate-700">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <GitCompareArrows className="h-5 w-5 text-cyan-400" />
                <h2 className="text-lg font-semibold text-white">V1 vs V2 Head-to-Head</h2>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Agree */}
                <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-center">
                  <div className="text-2xl font-bold text-emerald-400">{stats.headToHead.agreeBoth}</div>
                  <div className="text-xs text-slate-400 mt-1">Models Agree</div>
                  <div className="text-xs text-emerald-300 mt-0.5">
                    {stats.headToHead.agreeCorrect} correct ({stats.headToHead.agreeAccuracy ?? '—'}%)
                  </div>
                </div>

                {/* Disagree */}
                <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20 text-center">
                  <div className="text-2xl font-bold text-orange-400">{stats.headToHead.disagreeBoth}</div>
                  <div className="text-xs text-slate-400 mt-1">Models Disagree</div>
                </div>

                {/* Disagree breakdown */}
                <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20 text-center">
                  <div className="text-2xl font-bold text-blue-400">{stats.headToHead.disagreeV1Right}</div>
                  <div className="text-xs text-slate-400 mt-1">V1 Right (V2 Wrong)</div>
                  <div className="text-xs text-blue-300 mt-0.5">
                    {pct(stats.headToHead.disagreeV1Right, stats.headToHead.disagreeBoth)} of disagreements
                  </div>
                </div>

                <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20 text-center">
                  <div className="text-2xl font-bold text-purple-400">{stats.headToHead.disagreeV2Right}</div>
                  <div className="text-xs text-slate-400 mt-1">V2 Right (V1 Wrong)</div>
                  <div className="text-xs text-purple-300 mt-0.5">
                    {pct(stats.headToHead.disagreeV2Right, stats.headToHead.disagreeBoth)} of disagreements
                  </div>
                </div>
              </div>

              {stats.headToHead.disagreeNeitherRight > 0 && (
                <p className="text-xs text-slate-500 mt-3">
                  Neither model correct in {stats.headToHead.disagreeNeitherRight} disagreement{stats.headToHead.disagreeNeitherRight !== 1 ? 's' : ''} ({pct(stats.headToHead.disagreeNeitherRight, stats.headToHead.disagreeBoth)})
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Filters ──────────────────────────────────────────────────────── */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs text-slate-400 mb-1 block">Search teams</label>
                <div className="flex gap-2">
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="e.g. Barcelona"
                    className="bg-slate-700/50 border-slate-600 text-white"
                  />
                  <Button onClick={handleSearch} size="sm" variant="outline" className="border-slate-600">
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="w-[180px]">
                <label className="text-xs text-slate-400 mb-1 block">League</label>
                <Select value={leagueFilter} onValueChange={setLeagueFilter}>
                  <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Leagues</SelectItem>
                    {leagues.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[160px]">
                <label className="text-xs text-slate-400 mb-1 block">Result</label>
                <Select value={resultFilter} onValueChange={setResultFilter}>
                  <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Results</SelectItem>
                    <SelectItem value="correct">Correct Only</SelectItem>
                    <SelectItem value="incorrect">Incorrect Only</SelectItem>
                    <SelectItem value="no_prediction">No Prediction</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[150px]">
                <label className="text-xs text-slate-400 mb-1 block">From</label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-slate-700/50 border-slate-600 text-white" />
              </div>
              <div className="w-[150px]">
                <label className="text-xs text-slate-400 mb-1 block">To</label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-slate-700/50 border-slate-600 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Page-level quick insights ────────────────────────────────────── */}
        {data.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-slate-400">This page:</span>
            <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">V1 Hits: {pageInsights.v1Hits}</Badge>
            <Badge className="bg-red-500/15 text-red-300 border-red-500/30">V1 Misses: {pageInsights.v1Misses}</Badge>
            <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">V2 Hits: {pageInsights.v2Hits}</Badge>
            <Badge className="bg-red-500/15 text-red-300 border-red-500/30">V2 Misses: {pageInsights.v2Misses}</Badge>
            <Badge className="bg-cyan-500/15 text-cyan-300 border-cyan-500/30">Agree: {pageInsights.agree}</Badge>
            <Badge className="bg-orange-500/15 text-orange-300 border-orange-500/30">Disagree: {pageInsights.disagree}</Badge>
            <span className="text-slate-500 ml-auto">{totalCount} matches total</span>
          </div>
        )}

        {/* ── Data Table ───────────────────────────────────────────────────── */}
        <Card className="bg-slate-800/50 border-slate-700 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center p-16">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-slate-400">
              <AlertTriangle className="h-10 w-10 mb-3 text-slate-500" />
              <p>No completed matches found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700 hover:bg-transparent">
                    <TableHead className="text-slate-300 text-xs">Date</TableHead>
                    <TableHead className="text-slate-300 text-xs">Match</TableHead>
                    <TableHead className="text-slate-300 text-xs">League</TableHead>
                    <TableHead className="text-slate-300 text-xs text-center">Score</TableHead>
                    <TableHead className="text-slate-300 text-xs text-center">Result</TableHead>
                    <TableHead className="text-slate-300 text-xs text-center">V1 Pick</TableHead>
                    <TableHead className="text-slate-300 text-xs text-center">V1 Conf</TableHead>
                    <TableHead className="text-slate-300 text-xs text-center">V1</TableHead>
                    <TableHead className="text-slate-300 text-xs text-center">V2 Pick</TableHead>
                    <TableHead className="text-slate-300 text-xs text-center">V2 Conf</TableHead>
                    <TableHead className="text-slate-300 text-xs text-center">V2</TableHead>
                    <TableHead className="text-slate-300 text-xs text-center">Agree?</TableHead>
                    <TableHead className="text-slate-300 text-xs text-center">Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((row) => {
                    const dateStr = new Date(row.kickoffDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                    return (
                      <TableRow key={row.id} className="border-slate-700/50 hover:bg-slate-800/40 text-sm">
                        <TableCell className="text-slate-400 text-xs whitespace-nowrap">{dateStr}</TableCell>
                        <TableCell className="font-medium text-white whitespace-nowrap">
                          {row.homeTeam} <span className="text-slate-500">vs</span> {row.awayTeam}
                        </TableCell>
                        <TableCell className="text-slate-400 text-xs max-w-[120px] truncate">{row.league}</TableCell>
                        <TableCell className="text-center font-mono font-bold text-white">
                          {row.score ? `${row.score.home ?? '?'} - ${row.score.away ?? '?'}` : '—'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={
                            row.actualOutcome === 'home' ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 text-[10px]' :
                            row.actualOutcome === 'away' ? 'bg-orange-500/20 text-orange-300 border-orange-500/40 text-[10px]' :
                            row.actualOutcome === 'draw' ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 text-[10px]' :
                            'bg-slate-700/40 text-slate-400 border-slate-600/40 text-[10px]'
                          }>
                            {outcomeLabel(row.actualOutcome)}
                          </Badge>
                        </TableCell>
                        {/* V1 */}
                        <TableCell className="text-center text-xs text-slate-300">{pickLabel(row.v1?.pick ?? null)}</TableCell>
                        <TableCell className="text-center text-xs">
                          {row.v1?.confidence != null ? (
                            <span className={row.v1.confidence >= 70 ? 'text-emerald-400' : row.v1.confidence >= 55 ? 'text-yellow-400' : 'text-slate-400'}>
                              {row.v1.confidence}%
                            </span>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-center"><CorrectBadge correct={row.v1?.correct ?? null} /></TableCell>
                        {/* V2 */}
                        <TableCell className="text-center text-xs text-slate-300">{pickLabel(row.v2?.pick ?? null)}</TableCell>
                        <TableCell className="text-center text-xs">
                          {row.v2?.confidence != null ? (
                            <span className={row.v2.confidence >= 70 ? 'text-emerald-400' : row.v2.confidence >= 55 ? 'text-yellow-400' : 'text-slate-400'}>
                              {row.v2.confidence}%
                            </span>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-center"><CorrectBadge correct={row.v2?.correct ?? null} /></TableCell>
                        {/* Agreement */}
                        <TableCell className="text-center">
                          {row.modelsAgree === true && <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-[10px]">Yes</Badge>}
                          {row.modelsAgree === false && <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/40 text-[10px]">No</Badge>}
                          {row.modelsAgree === null && <span className="text-slate-500 text-xs">—</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-white" onClick={() => setSelectedMatch(row)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
              <span className="text-xs text-slate-400">
                Page {page} of {totalPages} ({totalCount} matches)
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => fetchData(page - 1)} className="border-slate-600 text-slate-300 h-8">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => fetchData(page + 1)} className="border-slate-600 text-slate-300 h-8">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* ── Detail Modal ─────────────────────────────────────────────────── */}
        <Dialog open={!!selectedMatch} onOpenChange={(open) => { if (!open) setSelectedMatch(null) }}>
          <DialogContent className="bg-slate-800 border-slate-700 text-slate-100 max-w-2xl max-h-[85vh] overflow-y-auto">
            {selectedMatch && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-white text-lg">
                    {selectedMatch.homeTeam} vs {selectedMatch.awayTeam}
                  </DialogTitle>
                  <p className="text-slate-400 text-sm">
                    {selectedMatch.league} &bull; {new Date(selectedMatch.kickoffDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                </DialogHeader>

                <div className="space-y-5 mt-2">
                  {/* Score */}
                  <div className="text-center py-4 bg-slate-900/60 rounded-xl">
                    <div className="text-4xl font-bold text-white tracking-wider">
                      {selectedMatch.score ? `${selectedMatch.score.home ?? '?'} - ${selectedMatch.score.away ?? '?'}` : 'Score unavailable'}
                    </div>
                    {selectedMatch.outcomeText && (
                      <p className="text-sm text-slate-400 mt-1">{selectedMatch.outcomeText}</p>
                    )}
                    {selectedMatch.modelsAgree !== null && (
                      <p className={`text-xs mt-2 ${selectedMatch.modelsAgree ? 'text-cyan-400' : 'text-orange-400'}`}>
                        {selectedMatch.modelsAgree ? 'V1 and V2 agreed on this match' : 'V1 and V2 disagreed on this match'}
                      </p>
                    )}
                  </div>

                  {/* Model comparison */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <ModelCard
                      title="V1 Consensus"
                      model={selectedMatch.v1}
                      colour="blue"
                    />
                    <ModelCard
                      title="V2 Unified (LightGBM)"
                      model={selectedMatch.v2}
                      colour="purple"
                    />
                  </div>

                  {/* V2 agreement detail */}
                  {selectedMatch.v2?.agreement && (
                    <div className="px-4 py-2 bg-slate-900/40 rounded-lg border border-slate-700/50 text-xs text-slate-400">
                      V2 agreement data: {selectedMatch.v2.agreement.agreesWith ? 'Agrees with V1' : 'Disagrees with V1'}
                      {' '}(confidence delta: {(selectedMatch.v2.agreement.confidenceDelta * 100).toFixed(1)}%)
                    </div>
                  )}

                  {/* QuickPurchase prediction meta */}
                  {selectedMatch.prediction && (
                    <div className="p-4 bg-slate-900/40 rounded-lg border border-slate-700/50">
                      <div className="flex items-center gap-2 mb-3">
                        <TrendingUp className="h-4 w-4 text-emerald-400" />
                        <span className="text-sm font-semibold text-white">QuickPurchase Prediction</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <div><span className="text-slate-400 text-xs block">Confidence</span><span className="text-white">{selectedMatch.prediction.confidence ?? '—'}%</span></div>
                        <div><span className="text-slate-400 text-xs block">Type</span><span className="text-white">{selectedMatch.prediction.type ?? '—'}</span></div>
                        <div><span className="text-slate-400 text-xs block">Value Rating</span><span className="text-white">{selectedMatch.prediction.valueRating ?? '—'}</span></div>
                        <div><span className="text-slate-400 text-xs block">Odds</span><span className="text-white">{selectedMatch.prediction.odds ? selectedMatch.prediction.odds.toFixed(2) : '—'}</span></div>
                      </div>
                      {selectedMatch.prediction.explanation && (
                        <p className="text-xs text-slate-400 mt-3 leading-relaxed border-t border-slate-700/50 pt-2">
                          {selectedMatch.prediction.explanation}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Consensus odds */}
                  {selectedMatch.consensusOdds && (
                    <div className="p-4 bg-slate-900/40 rounded-lg border border-slate-700/50">
                      <span className="text-xs text-slate-500 uppercase tracking-wider">Market Consensus (No-Vig)</span>
                      <div className="grid grid-cols-3 gap-3 mt-2 text-center">
                        <div>
                          <div className="text-xs text-slate-400">Home</div>
                          <div className="text-sm font-medium text-white">{selectedMatch.consensusOdds.home ? `${(selectedMatch.consensusOdds.home * 100).toFixed(1)}%` : '—'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">Draw</div>
                          <div className="text-sm font-medium text-white">{selectedMatch.consensusOdds.draw ? `${(selectedMatch.consensusOdds.draw * 100).toFixed(1)}%` : '—'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">Away</div>
                          <div className="text-sm font-medium text-white">{selectedMatch.consensusOdds.away ? `${(selectedMatch.consensusOdds.away * 100).toFixed(1)}%` : '—'}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ModelCard({ title, model, colour }: { title: string; model: ModelInfo | null; colour: 'blue' | 'purple' }) {
  const iconColour = colour === 'blue' ? 'text-blue-400' : 'text-purple-400'
  return (
    <div className="p-4 bg-slate-900/40 rounded-lg border border-slate-700/50">
      <div className="flex items-center gap-2 mb-3">
        <Brain className={`h-4 w-4 ${iconColour}`} />
        <span className="text-sm font-semibold text-white">{title}</span>
        <CorrectBadge correct={model?.correct ?? null} />
      </div>
      {model ? (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-400">Pick</span><span className="text-white font-medium">{pickLabel(model.pick)}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Confidence</span><span className="text-white">{model.confidence ?? '—'}%</span></div>
          {model.recommendedBet && (
            <div className="flex justify-between"><span className="text-slate-400">Recommended Bet</span><span className="text-white text-xs">{model.recommendedBet}</span></div>
          )}
          {model.source && (
            <div className="flex justify-between"><span className="text-slate-400">Source</span>
              <Badge className={model.source === 'enrichment' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]' : 'bg-slate-700/40 text-slate-400 border-slate-600/40 text-[10px]'}>
                {model.source === 'enrichment' ? 'QP Enrichment' : 'Sync Cron'}
              </Badge>
            </div>
          )}
          {model.probs && (
            <div className="pt-2 border-t border-slate-700/50">
              <span className="text-xs text-slate-500 uppercase tracking-wider">Probabilities</span>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {Object.entries(model.probs).map(([k, v]) => (
                  <div key={k} className="text-center">
                    <div className="text-xs text-slate-400 capitalize">{k}</div>
                    <div className="text-sm font-medium text-white">{typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : '—'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : <p className="text-slate-500 text-sm">No prediction available</p>}
    </div>
  )
}
