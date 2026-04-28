"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Users, Search, RefreshCw, ChevronLeft, ChevronRight, ExternalLink,
  Crown, CheckCircle, XCircle, AlertCircle, Loader2, TrendingUp,
} from "lucide-react"
import { toast } from "sonner"

interface UserRow {
  id: string
  email: string
  fullName: string | null
  role: string
  subscriptionPlan: string | null
  subscriptionStatus: string | null
  subscriptionExpiresAt: string | null
  emailVerified: boolean
  predictionCredits: number
  stripeCustomerId: string | null
  signupSource: string | null
  firstPaidAt: string | null
  lastPurchaseAt: string | null
  lifetimeValue: number
  accountStatus: string | null
  lastLoginAt: string | null
  createdAt: string
  country: { name: string; code: string } | null
  purchaseCount: number
  activePackageCount: number
}

interface Stats {
  totalUsers: number
  verifiedCount: number
  verifiedRate: number
  paidCount: number
  paidRate: number
  activeSubCount: number
  pastDueCount: number
  adminCount: number
  newThisMonth: number
  newThisWeek: number
  activeLast30d: number
  lifetimeRevenue: number
  arpu: number
  arppu: number
}

interface SignupTrend {
  signupsByDay: Array<{ day: string; count: number }>
  funnel: { signups: number; verified: number; paid: number; subscribed: number }
  signupSources: Array<{ source: string; count: number }>
  topSpenders: Array<{ id: string; email: string; fullName: string | null; lifetimeValue: number }>
}

const FILTERS = [
  { key: "", label: "All" },
  { key: "paid", label: "Paid" },
  { key: "unpaid", label: "Unpaid" },
  { key: "verified", label: "Verified" },
  { key: "unverified", label: "Unverified" },
  { key: "admin", label: "Admin" },
  { key: "churn", label: "Churn risk" },
]

function fmtMoney(v: number) {
  return v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(2)}`
}
function fmtPct(v: number) {
  return `${(v * 100).toFixed(1)}%`
}
function fmtDate(d: string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString()
}
function fmtRelative(d: string | null) {
  if (!d) return "—"
  const ms = Date.now() - new Date(d).getTime()
  const days = Math.floor(ms / 86400000)
  if (days === 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [trend, setTrend] = useState<SignupTrend | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "50",
        ...(search ? { search } : {}),
        ...(filter ? { filter } : {}),
      })
      const [listRes, trendRes] = await Promise.all([
        fetch(`/api/admin/users?${params}`, { cache: "no-store" }),
        fetch(`/api/admin/users/stats`, { cache: "no-store" }),
      ])
      const list = await listRes.json()
      if (list.success) {
        setUsers(list.data.users)
        setStats(list.data.stats)
        setPages(list.data.pagination.pages)
      } else {
        toast.error("Failed to load users", { description: list.error })
      }
      const trendJson = await trendRes.json()
      if (trendJson.success) setTrend(trendJson)
    } catch (e) {
      toast.error("Failed to load", { description: e instanceof Error ? e.message : "Unknown" })
    } finally {
      setLoading(false)
    }
  }, [page, search, filter])

  useEffect(() => { load() }, [load])

  // Mini sparkline (last 30 days) — pure SVG, no chart lib
  const sparkline = useMemo(() => {
    if (!trend?.signupsByDay) return null
    const last30 = trend.signupsByDay.slice(-30)
    if (last30.length === 0) return null
    const max = Math.max(...last30.map(d => d.count), 1)
    const w = 280, h = 60, pad = 2
    const points = last30.map((d, i) => {
      const x = pad + (i / Math.max(last30.length - 1, 1)) * (w - 2 * pad)
      const y = h - pad - (d.count / max) * (h - 2 * pad)
      return `${x},${y}`
    }).join(" ")
    const total = last30.reduce((s, d) => s + d.count, 0)
    return { points, total, w, h, days: last30.length }
  }, [trend])

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-400" />
            Users
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Browse, filter, and manage every user on the platform.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={load}
          disabled={loading}
          className="border-slate-600 text-slate-300"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <StatCard label="Total Users" value={stats.totalUsers.toString()} sub={`+${stats.newThisWeek} this week`} />
          <StatCard label="Verified" value={`${stats.verifiedCount}`} sub={fmtPct(stats.verifiedRate)} accent="emerald" />
          <StatCard label="Paid" value={`${stats.paidCount}`} sub={fmtPct(stats.paidRate)} accent="amber" />
          <StatCard label="Active Subs" value={stats.activeSubCount.toString()} sub={stats.pastDueCount > 0 ? `${stats.pastDueCount} past due` : "all current"} accent={stats.pastDueCount > 0 ? "amber" : "emerald"} />
          <StatCard label="Lifetime Rev" value={fmtMoney(stats.lifetimeRevenue)} sub={`ARPPU ${fmtMoney(stats.arppu)}`} accent="emerald" />
          <StatCard label="Active 30d" value={stats.activeLast30d.toString()} sub={`of ${stats.totalUsers}`} />
        </div>
      )}

      {/* ── Sparkline + Funnel + Top Spenders ─────────────────────── */}
      {trend && sparkline && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300 flex items-center justify-between">
                <span>Signups · last 30 days</span>
                <span className="text-xs text-slate-500">total {sparkline.total}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <svg viewBox={`0 0 ${sparkline.w} ${sparkline.h}`} className="w-full h-16">
                <polyline
                  fill="none"
                  stroke="rgb(52 211 153)"
                  strokeWidth="2"
                  points={sparkline.points}
                />
              </svg>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Conversion Funnel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <FunnelStep label="Signups" value={trend.funnel.signups} pct={1} />
              <FunnelStep label="Verified email" value={trend.funnel.verified} pct={trend.funnel.signups > 0 ? trend.funnel.verified / trend.funnel.signups : 0} />
              <FunnelStep label="First payment" value={trend.funnel.paid} pct={trend.funnel.signups > 0 ? trend.funnel.paid / trend.funnel.signups : 0} />
              <FunnelStep label="Active subscriber" value={trend.funnel.subscribed} pct={trend.funnel.signups > 0 ? trend.funnel.subscribed / trend.funnel.signups : 0} />
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-1">
                <TrendingUp className="w-4 h-4 text-amber-400" /> Top Spenders
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {trend.topSpenders.length === 0 ? (
                <p className="text-xs text-slate-500">No paying users yet.</p>
              ) : (
                trend.topSpenders.slice(0, 5).map(u => (
                  <Link key={u.id} href={`/admin/users/${u.id}`} className="flex items-center justify-between text-xs hover:bg-slate-700/30 rounded px-2 py-1">
                    <span className="truncate max-w-[180px] text-slate-300">{u.fullName || u.email}</span>
                    <span className="font-mono text-amber-300">{fmtMoney(u.lifetimeValue)}</span>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Search + Filters ──────────────────────────────────────── */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="pt-4 sm:pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Search by email or name…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                className="pl-10 bg-slate-700/50 border-slate-600 text-white"
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              {FILTERS.map(f => (
                <Button
                  key={f.key || "all"}
                  size="sm"
                  variant={filter === f.key ? "default" : "outline"}
                  onClick={() => { setFilter(f.key); setPage(1) }}
                  className={filter === f.key ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "border-slate-600 text-slate-300 hover:bg-slate-700"}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Users Table ───────────────────────────────────────────── */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              Loading…
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center text-slate-400">No users match your filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700 hover:bg-transparent">
                    <TableHead className="text-slate-300 text-xs">User</TableHead>
                    <TableHead className="text-slate-300 text-xs">Plan</TableHead>
                    <TableHead className="text-slate-300 text-xs">Verified</TableHead>
                    <TableHead className="text-slate-300 text-xs">Country</TableHead>
                    <TableHead className="text-slate-300 text-xs">Signed up</TableHead>
                    <TableHead className="text-slate-300 text-xs">Last login</TableHead>
                    <TableHead className="text-slate-300 text-xs text-right">LTV</TableHead>
                    <TableHead className="text-slate-300 text-xs text-right">Buys</TableHead>
                    <TableHead className="text-slate-300 text-xs">Source</TableHead>
                    <TableHead className="text-slate-300 text-xs"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(u => (
                    <TableRow key={u.id} className="border-slate-700/50 hover:bg-slate-800/40">
                      <TableCell>
                        <Link href={`/admin/users/${u.id}`} className="block hover:text-emerald-400">
                          <div className="text-sm text-white">
                            {u.fullName || "—"}
                            {u.role === "admin" && <Crown className="inline ml-1 w-3 h-3 text-amber-400" />}
                            {u.accountStatus === "suspended" && <Badge className="ml-2 bg-red-500/20 text-red-300 border-red-500/30 text-[10px]">suspended</Badge>}
                          </div>
                          <div className="text-xs text-slate-500 font-mono">{u.email}</div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <PlanBadge plan={u.subscriptionPlan} status={u.subscriptionStatus} role={u.role} firstPaidAt={u.firstPaidAt} />
                      </TableCell>
                      <TableCell>
                        {u.emailVerified ? (
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-slate-600" />
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-400">{u.country?.code ?? "—"}</TableCell>
                      <TableCell className="text-xs text-slate-400">{fmtRelative(u.createdAt)}</TableCell>
                      <TableCell className="text-xs text-slate-400">{fmtRelative(u.lastLoginAt)}</TableCell>
                      <TableCell className="text-right">
                        <span className={`font-mono text-sm ${u.lifetimeValue > 0 ? "text-amber-300" : "text-slate-600"}`}>
                          {u.lifetimeValue > 0 ? fmtMoney(u.lifetimeValue) : "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs text-slate-400">
                        {u.purchaseCount > 0 ? u.purchaseCount : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 max-w-[100px] truncate">
                        {u.signupSource || "(direct)"}
                      </TableCell>
                      <TableCell>
                        <Link href={`/admin/users/${u.id}`} className="text-emerald-400 text-xs hover:underline inline-flex items-center gap-1">
                          View <ExternalLink className="w-3 h-3" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between p-3 border-t border-slate-700/50">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="border-slate-600 text-slate-300"
              >
                <ChevronLeft className="w-3 h-3 mr-1" />
                Prev
              </Button>
              <span className="text-xs text-slate-400">
                Page {page} of {pages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= pages}
                onClick={() => setPage(p => Math.min(pages, p + 1))}
                className="border-slate-600 text-slate-300"
              >
                Next
                <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "emerald" | "amber" | "red" }) {
  const accentClass = accent === "emerald" ? "text-emerald-400" : accent === "amber" ? "text-amber-400" : accent === "red" ? "text-red-400" : "text-white"
  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-slate-400">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${accentClass}`}>{value}</div>
        {sub && <div className="text-[10px] text-slate-500 mt-1">{sub}</div>}
      </CardContent>
    </Card>
  )
}

function FunnelStep({ label, value, pct }: { label: string; value: number; pct: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-slate-300">{label}</span>
        <span className="font-mono text-slate-400">{value} <span className="text-slate-600">({fmtPct(pct)})</span></span>
      </div>
      <div className="h-1.5 bg-slate-700/50 rounded overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
          style={{ width: `${Math.max(2, pct * 100).toFixed(1)}%` }}
        />
      </div>
    </div>
  )
}

function PlanBadge({ plan, status, role, firstPaidAt }: { plan: string | null; status: string | null; role: string; firstPaidAt: string | null }) {
  if (role === "admin") return <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-[10px]">Admin</Badge>
  if (status === "active" || status === "trialing") {
    return <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">{plan ?? "active"}</Badge>
  }
  if (status === "past_due" || status === "unpaid") {
    return <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]">{status}</Badge>
  }
  if (status === "disputed") {
    return <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-[10px]">disputed</Badge>
  }
  if (status === "canceled" || status === "cancelled") {
    return <Badge className="bg-slate-500/20 text-slate-300 border-slate-500/30 text-[10px]">cancelled</Badge>
  }
  if (firstPaidAt) {
    return <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-[10px]">past buyer</Badge>
  }
  return <Badge className="bg-slate-500/10 text-slate-500 border-slate-700 text-[10px]">free</Badge>
}
