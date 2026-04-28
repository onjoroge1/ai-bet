"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  ArrowLeft, ExternalLink, Mail, KeyRound, Ban, ShieldCheck, Send,
  Crown, CheckCircle, XCircle, Loader2, Calendar, MapPin, CreditCard, Bell, History,
} from "lucide-react"
import { toast } from "sonner"

interface UserDetail {
  user: {
    id: string
    email: string
    fullName: string | null
    role: string
    accountStatus: string | null
    emailVerified: boolean
    emailNotifications: boolean
    country: { name: string; code: string; currencyCode?: string; currencySymbol?: string } | null
    subscriptionPlan: string | null
    subscriptionStatus: string | null
    subscriptionExpiresAt: string | null
    stripeCustomerId: string | null
    stripeSubscriptionId: string | null
    signupSource: string | null
    firstPaidAt: string | null
    lastPurchaseAt: string | null
    lifetimeValue: number
    predictionCredits: number
    lastLoginAt: string | null
    createdAt: string
    referralCode: string | null
    totalReferrals: number
  }
  purchases: Array<{
    id: string
    amount: number
    paymentMethod: string
    status: string
    packageType: string
    createdAt: string
  }>
  activePackages: Array<{
    id: string
    name: string
    packageType: string
    tipsRemaining: number
    totalTips: number
    expiresAt: string
    purchasedAt: string
    pricePaid: number
    status: string
  }>
  packageHistory: Array<{ id: string; name: string; status: string; purchasedAt: string; expiresAt: string }>
  notifications: Array<{ id: string; title: string; message: string; type: string; isRead: boolean; createdAt: string }>
}

function fmtMoney(v: number) { return `$${v.toFixed(2)}` }
function fmtDate(d: string | null) { return d ? new Date(d).toLocaleString() : "—" }
function fmtDay(d: string | null) { return d ? new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—" }

export default function AdminUserDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [data, setData] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [notifyOpen, setNotifyOpen] = useState(false)
  const [notifyTitle, setNotifyTitle] = useState("")
  const [notifyMessage, setNotifyMessage] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${id}`, { cache: "no-store" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      setData(json)
    } catch (e) {
      toast.error("Failed to load user", { description: e instanceof Error ? e.message : "Unknown" })
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const runAction = async (action: string, body?: Record<string, any>, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return
    setActionLoading(action)
    try {
      const res = await fetch(`/api/admin/users/${id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      toast.success("Done", { description: json.verifyUrl || json.resetUrl || "Action completed" })
      await load()
    } catch (e) {
      toast.error("Action failed", { description: e instanceof Error ? e.message : "Unknown" })
    } finally {
      setActionLoading(null)
    }
  }

  if (loading || !data) {
    return (
      <div className="container mx-auto p-6 text-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
        Loading user…
      </div>
    )
  }

  const u = data.user
  const isAdmin = u.role === "admin"
  const isSuspended = u.accountStatus === "suspended"
  const stripeCustomerUrl = u.stripeCustomerId
    ? `https://dashboard.stripe.com/customers/${u.stripeCustomerId}`
    : null

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-5">
      <Button variant="ghost" size="sm" onClick={() => router.push("/admin/users")} className="text-slate-400 hover:text-white">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to users
      </Button>

      {/* ── Header ─────────────────────────────────────────────── */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                {u.fullName || u.email}
                {isAdmin && <Crown className="w-5 h-5 text-amber-400" />}
                {isSuspended && <Badge className="bg-red-500/20 text-red-300 border-red-500/30">Suspended</Badge>}
              </h1>
              <p className="text-slate-400 text-sm mt-1 font-mono">{u.email}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Joined {fmtDay(u.createdAt)}
                </span>
                {u.country && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {u.country.name} ({u.country.code})
                  </span>
                )}
                {u.lastLoginAt && (
                  <span>Last seen {fmtDate(u.lastLoginAt)}</span>
                )}
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex gap-2 flex-wrap">
              {!u.emailVerified && (
                <Button size="sm" variant="outline" disabled={!!actionLoading} onClick={() => runAction("resend-verification")} className="border-slate-600 text-slate-300">
                  {actionLoading === "resend-verification" ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Mail className="w-3 h-3 mr-1" />}
                  Resend verification
                </Button>
              )}
              <Button size="sm" variant="outline" disabled={!!actionLoading} onClick={() => runAction("reset-password", undefined, `Send password-reset email to ${u.email}?`)} className="border-slate-600 text-slate-300">
                {actionLoading === "reset-password" ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <KeyRound className="w-3 h-3 mr-1" />}
                Reset password
              </Button>
              <Button size="sm" variant="outline" onClick={() => setNotifyOpen(o => !o)} className="border-slate-600 text-slate-300">
                <Send className="w-3 h-3 mr-1" />
                Send notification
              </Button>
              {!isAdmin && (
                isSuspended ? (
                  <Button size="sm" variant="outline" disabled={!!actionLoading} onClick={() => runAction("unsuspend")} className="border-emerald-500/50 text-emerald-300">
                    <ShieldCheck className="w-3 h-3 mr-1" />
                    Unsuspend
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" disabled={!!actionLoading} onClick={() => runAction("suspend", undefined, `Suspend ${u.email}? They'll lose access.`)} className="border-red-500/50 text-red-400">
                    <Ban className="w-3 h-3 mr-1" />
                    Suspend
                  </Button>
                )
              )}
              {stripeCustomerUrl && (
                <a href={stripeCustomerUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="border-slate-600 text-slate-300">
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Stripe
                  </Button>
                </a>
              )}
            </div>
          </div>

          {/* Inline notify form */}
          {notifyOpen && (
            <div className="mt-4 p-3 rounded-lg border border-slate-600 bg-slate-700/30 space-y-2">
              <input
                placeholder="Notification title"
                value={notifyTitle}
                onChange={e => setNotifyTitle(e.target.value)}
                className="w-full text-sm bg-slate-800 border border-slate-600 rounded px-3 py-2 text-slate-200"
              />
              <textarea
                placeholder="Message body"
                value={notifyMessage}
                onChange={e => setNotifyMessage(e.target.value)}
                rows={3}
                className="w-full text-sm bg-slate-800 border border-slate-600 rounded px-3 py-2 text-slate-200"
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setNotifyOpen(false)} className="text-slate-400">Cancel</Button>
                <Button
                  size="sm"
                  disabled={!notifyTitle || !notifyMessage || actionLoading === "notify"}
                  onClick={async () => {
                    await runAction("notify", { title: notifyTitle, message: notifyMessage })
                    setNotifyTitle(""); setNotifyMessage(""); setNotifyOpen(false)
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {actionLoading === "notify" ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                  Send
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Top stats grid ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <DetailStat label="Lifetime spent" value={fmtMoney(u.lifetimeValue)} accent="amber" />
        <DetailStat label="Purchases" value={data.purchases.length.toString()} />
        <DetailStat label="Active packages" value={data.activePackages.length.toString()} />
        <DetailStat label="Credits" value={u.predictionCredits.toString()} />
        <DetailStat label="Referrals" value={u.totalReferrals.toString()} />
        <DetailStat label="Verified" value={u.emailVerified ? "Yes" : "No"} accent={u.emailVerified ? "emerald" : "amber"} />
      </div>

      {/* ── Subscription + meta panel ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-1">
              <CreditCard className="w-4 h-4 text-emerald-400" /> Subscription
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Field label="Plan" value={u.subscriptionPlan ?? "free"} />
            <Field label="Status" value={u.subscriptionStatus ?? "—"} />
            <Field label="Expires" value={fmtDay(u.subscriptionExpiresAt)} />
            <Field label="Stripe customer" value={u.stripeCustomerId ?? "—"} mono />
            <Field label="Stripe subscription" value={u.stripeSubscriptionId ?? "—"} mono />
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-1">
              <History className="w-4 h-4 text-blue-400" /> Tracking
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Field label="Signup source" value={u.signupSource ?? "(direct)"} />
            <Field label="First paid" value={fmtDay(u.firstPaidAt)} />
            <Field label="Last purchase" value={fmtDay(u.lastPurchaseAt)} />
            <Field label="Account status" value={u.accountStatus ?? "active"} />
            <Field label="Referral code" value={u.referralCode ?? "—"} mono />
          </CardContent>
        </Card>
      </div>

      {/* ── Active packages ────────────────────────────────────── */}
      {data.activePackages.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-sm text-white">Active packages</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700 hover:bg-transparent">
                  <TableHead className="text-slate-300 text-xs">Package</TableHead>
                  <TableHead className="text-slate-300 text-xs text-right">Tips</TableHead>
                  <TableHead className="text-slate-300 text-xs">Expires</TableHead>
                  <TableHead className="text-slate-300 text-xs">Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.activePackages.map(p => (
                  <TableRow key={p.id} className="border-slate-700/50">
                    <TableCell className="text-sm text-white">{p.name}</TableCell>
                    <TableCell className="text-right text-sm text-slate-300 font-mono">
                      {p.totalTips < 0 ? "Unlimited" : `${p.tipsRemaining}/${p.totalTips}`}
                    </TableCell>
                    <TableCell className="text-xs text-slate-400">{fmtDate(p.expiresAt)}</TableCell>
                    <TableCell className="text-xs text-slate-400">{fmtMoney(p.pricePaid)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── Payment history ────────────────────────────────────── */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-sm text-white">Payment history ({data.purchases.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.purchases.length === 0 ? (
            <p className="p-6 text-center text-xs text-slate-500">No purchases yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700 hover:bg-transparent">
                  <TableHead className="text-slate-300 text-xs">Date</TableHead>
                  <TableHead className="text-slate-300 text-xs">Package</TableHead>
                  <TableHead className="text-slate-300 text-xs text-right">Amount</TableHead>
                  <TableHead className="text-slate-300 text-xs">Method</TableHead>
                  <TableHead className="text-slate-300 text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.purchases.map(p => (
                  <TableRow key={p.id} className="border-slate-700/50">
                    <TableCell className="text-xs text-slate-400">{fmtDate(p.createdAt)}</TableCell>
                    <TableCell className="text-sm text-white">{p.packageType}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-amber-300">{fmtMoney(p.amount)}</TableCell>
                    <TableCell className="text-xs text-slate-400">{p.paymentMethod}</TableCell>
                    <TableCell>
                      <Badge className={
                        p.status === "completed" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]"
                        : p.status === "refunded" ? "bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]"
                        : p.status === "PACKAGE_CREATION_FAILED" ? "bg-red-500/20 text-red-300 border-red-500/30 text-[10px]"
                        : "bg-slate-500/20 text-slate-300 border-slate-500/30 text-[10px]"
                      }>
                        {p.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Recent notifications ───────────────────────────────── */}
      {data.notifications.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-sm text-white flex items-center gap-1">
              <Bell className="w-4 h-4 text-purple-400" /> Recent notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.notifications.map(n => (
              <div key={n.id} className={`p-2 rounded border text-xs ${n.isRead ? "border-slate-700/40 bg-slate-700/20" : "border-emerald-500/30 bg-emerald-500/5"}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-200 text-sm">{n.title}</span>
                  <span className="text-slate-500">{fmtDate(n.createdAt)}</span>
                </div>
                <p className="text-slate-400">{n.message}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function DetailStat({ label, value, accent }: { label: string; value: string; accent?: "emerald" | "amber" | "red" }) {
  const cls = accent === "emerald" ? "text-emerald-400" : accent === "amber" ? "text-amber-400" : accent === "red" ? "text-red-400" : "text-white"
  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="pb-1">
        <CardTitle className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-xl font-bold ${cls}`}>{value}</div>
      </CardContent>
    </Card>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-400 text-xs">{label}</span>
      <span className={`text-slate-200 text-xs ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  )
}
