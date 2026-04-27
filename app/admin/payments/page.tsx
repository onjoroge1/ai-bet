"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { AlertTriangle, RefreshCw, CheckCircle2, Loader2, ExternalLink } from "lucide-react"
import { toast } from "sonner"

interface FailedPackageRow {
  id: string
  userId: string
  userEmail: string
  userName: string | null
  userCurrentCredits: number
  amount: string
  paymentMethod: string
  packageType: string
  packageOfferId: string | null
  countryId: string | null
  status: string
  createdAt: string
  updatedAt: string
}

export default function AdminPaymentsPage() {
  const [rows, setRows] = useState<FailedPackageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [includeResolved, setIncludeResolved] = useState(false)
  const [retrying, setRetrying] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const url = `/api/admin/payments/failed-packages${includeResolved ? '?includeResolved=true' : ''}`
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setRows(data.rows || [])
    } catch (e) {
      toast.error("Failed to load", { description: e instanceof Error ? e.message : "Unknown" })
    } finally {
      setLoading(false)
    }
  }, [includeResolved])

  useEffect(() => { load() }, [load])

  const handleRetry = async (row: FailedPackageRow) => {
    if (retrying.has(row.id)) return
    setRetrying(prev => new Set(prev).add(row.id))
    try {
      const res = await fetch('/api/admin/payments/retry-package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packagePurchaseId: row.id, note: notes[row.id] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.detail || `HTTP ${res.status}`)
      toast.success(`Activated ${data.packageName}`, {
        description: `${data.creditsAdded} credits added to ${row.userEmail}`,
      })
      await load()
    } catch (e) {
      toast.error("Retry failed", {
        description: e instanceof Error ? e.message : "Unknown error",
        duration: 6000,
      })
    } finally {
      setRetrying(prev => {
        const next = new Set(prev)
        next.delete(row.id)
        return next
      })
    }
  }

  const failedCount = rows.filter(r => r.status === 'PACKAGE_CREATION_FAILED').length

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
            Failed Package Creation
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Users charged successfully but whose package never created. Retry to give them what they paid for.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIncludeResolved(v => !v)}
            className="border-slate-600 text-slate-300"
          >
            {includeResolved ? 'Hide resolved' : 'Show resolved'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            disabled={loading}
            className="border-slate-600 text-slate-300"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">Failed (needs action)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-400">{failedCount}</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">Showing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{rows.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white text-base">Affected Purchases</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              No failed package purchases. Either nobody&apos;s ever hit the bug, or all have been resolved.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700 hover:bg-transparent">
                    <TableHead className="text-slate-300 text-xs">User</TableHead>
                    <TableHead className="text-slate-300 text-xs">Package</TableHead>
                    <TableHead className="text-slate-300 text-xs text-right">Amount</TableHead>
                    <TableHead className="text-slate-300 text-xs">Failed</TableHead>
                    <TableHead className="text-slate-300 text-xs">Status</TableHead>
                    <TableHead className="text-slate-300 text-xs">Note</TableHead>
                    <TableHead className="text-slate-300 text-xs text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(r => {
                    const isFailed = r.status === 'PACKAGE_CREATION_FAILED'
                    const isRetrying = retrying.has(r.id)
                    return (
                      <TableRow key={r.id} className={`border-slate-700/50 ${isFailed ? 'bg-amber-500/5' : ''}`}>
                        <TableCell>
                          <div className="text-sm text-white">{r.userName || '—'}</div>
                          <div className="text-xs text-slate-500 font-mono">{r.userEmail}</div>
                          <div className="text-[10px] text-slate-600">credits: {r.userCurrentCredits}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-slate-300">{r.packageType}</div>
                          {r.countryId && (
                            <div className="text-[10px] text-slate-500">country: {r.countryId}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-mono text-sm text-slate-300">{r.amount}</div>
                          <div className="text-[10px] text-slate-500">{r.paymentMethod}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleString()}</div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`text-[10px] ${
                              isFailed
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            }`}
                          >
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {isFailed && (
                            <Input
                              placeholder="Optional note"
                              value={notes[r.id] || ''}
                              onChange={e => setNotes(p => ({ ...p, [r.id]: e.target.value }))}
                              className="h-7 text-xs bg-slate-700/40 border-slate-600 text-slate-200 w-40"
                            />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isFailed ? (
                            <Button
                              size="sm"
                              onClick={() => handleRetry(r)}
                              disabled={isRetrying}
                              className="bg-amber-500 hover:bg-amber-400 text-black h-7 text-xs"
                            >
                              {isRetrying ? (
                                <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Retrying…</>
                              ) : (
                                'Retry'
                              )}
                            </Button>
                          ) : (
                            <span className="text-xs text-emerald-400 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Resolved
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-slate-500 text-center">
        Retries call the same package-creation logic the webhook would have, then notify the affected user.
        On success the row flips to <code className="text-emerald-400">completed_via_retry</code> for audit trail.
      </p>
    </div>
  )
}
