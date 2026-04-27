"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  CreditCard,
  Download,
  Calendar,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Crown,
  XCircle,
  RefreshCw,
  Zap,
  TrendingUp,
  Gift,
  Clock,
  ArrowRight,
} from "lucide-react"
import Link from "next/link"
import {
  PACKAGES,
  type PackageDefinition,
  getTipCountText,
} from "@/lib/packages-config"

interface SubscriptionStatus {
  hasAccess: boolean
  plan: string | null
  expiresAt: string | null
  isExpired: boolean
  status: string | null
}

interface Invoice {
  id: string
  amount_paid: number
  currency: string
  status: string
  created: number
  hosted_invoice_url: string | null
  invoice_pdf: string | null
  description: string | null
}

/**
 * PaymentSettings — shows all 4 packages, highlights the user's current plan,
 * and suggests the Monthly package as the next upgrade.
 */
export function PaymentSettings() {
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  // Activation polling state — used after Stripe success redirect when the
  // webhook race means our DB hasn't caught up yet.
  const [activationPolling, setActivationPolling] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [subRes, invRes] = await Promise.all([
        fetch("/api/subscriptions/manage", { credentials: "include", cache: "no-store" }),
        fetch("/api/billing/invoices", { credentials: "include", cache: "no-store" }),
      ])
      if (subRes.ok) setSubscription(await subRes.json())
      if (invRes.ok) {
        const inv = await invRes.json()
        setInvoices(inv.invoices ?? [])
      }
    } catch {
      setMessage({ type: "error", text: "Failed to load billing information." })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Stripe success redirect → poll for webhook to land before showing real state.
  // Stripe Checkout redirects with `?success=true`. The webhook that flips
  // subscriptionStatus to 'active' typically arrives within 1-3s but can take
  // 10-30s under load. Without polling, the user lands on the page seeing
  // "subscribe" CTAs and old subscription state, then has to refresh manually.
  useEffect(() => {
    if (searchParams.get("success") !== "true") return

    let cancelled = false
    setActivationPolling(true)

    const start = Date.now()
    const TIMEOUT_MS = 30_000
    const INTERVAL_MS = 2_000

    const poll = async () => {
      while (!cancelled && Date.now() - start < TIMEOUT_MS) {
        try {
          const res = await fetch("/api/subscriptions/manage", { credentials: "include", cache: "no-store" })
          if (res.ok) {
            const sub: SubscriptionStatus = await res.json()
            if (sub?.hasAccess && (sub.status === "active" || sub.status === "trialing")) {
              setSubscription(sub)
              setActivationPolling(false)
              setMessage({ type: "success", text: "Subscription activated! Welcome aboard." })
              // Clear the ?success=true so refreshes don't re-trigger polling
              const params = new URLSearchParams(Array.from(searchParams.entries()))
              params.delete("success")
              router.replace(`/dashboard/settings?${params.toString()}`)
              return
            }
          }
        } catch {
          // network blip — keep polling
        }
        await new Promise(r => setTimeout(r, INTERVAL_MS))
      }
      // Timed out — webhook didn't arrive in 30s. Show a softer message and let
      // the normal loadData state stand. Likely a Stripe delay; the user can refresh.
      if (!cancelled) {
        setActivationPolling(false)
        setMessage({
          type: "error",
          text: "Your payment went through but activation is taking longer than usual. Please refresh in a minute, or contact support if it persists.",
        })
      }
    }

    poll()
    return () => { cancelled = true }
  }, [searchParams, router])

  const handlePortal = async () => {
    setIsActionLoading(true)
    setMessage(null)
    try {
      const res = await fetch("/api/subscriptions/manage", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "portal" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to open billing portal")
      window.location.href = data.url
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to open billing portal.",
      })
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleCancel = async () => {
    if (
      !confirm(
        "Are you sure you want to cancel your subscription? You will keep access until the end of the billing period."
      )
    )
      return
    setIsActionLoading(true)
    setMessage(null)
    try {
      const res = await fetch("/api/subscriptions/manage", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to cancel subscription")
      setMessage({ type: "success", text: data.message })
      await loadData()
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to cancel subscription.",
      })
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleReactivate = async () => {
    setIsActionLoading(true)
    setMessage(null)
    try {
      const res = await fetch("/api/subscriptions/manage", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reactivate" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to reactivate")
      setMessage({ type: "success", text: data.message })
      await loadData()
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to reactivate subscription.",
      })
    } finally {
      setIsActionLoading(false)
    }
  }

  /** Check if a given package id matches the user's current plan */
  const isCurrentPlan = (pkgId: string): boolean => {
    if (!subscription?.plan) return false
    const plan = subscription.plan.toLowerCase()
    if (pkgId === "vip") {
      return (
        plan.includes("vip") ||
        plan.includes("premium_intelligence") ||
        plan.includes("premium")
      )
    }
    return plan.includes(pkgId)
  }

  const currentPkg = PACKAGES.find((p) => isCurrentPlan(p.id))

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/20 text-green-400">Active</Badge>
      case "trialing":
        return <Badge className="bg-blue-500/20 text-blue-400">Trialing</Badge>
      case "past_due":
        return <Badge className="bg-amber-500/20 text-amber-400">Past Due</Badge>
      case "canceled":
        return <Badge className="bg-red-500/20 text-red-400">Cancelled</Badge>
      default:
        return <Badge className="bg-slate-500/20 text-slate-400">Inactive</Badge>
    }
  }

  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case "Zap":
        return Zap
      case "Calendar":
        return Calendar
      case "TrendingUp":
        return TrendingUp
      case "Crown":
        return Crown
      default:
        return Gift
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-slate-700 rounded w-48" />
        <div className="h-40 bg-slate-800/50 rounded-lg" />
        <div className="h-40 bg-slate-800/50 rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
          <CreditCard className="w-6 h-6 text-emerald-400" />
          <span>Payment &amp; Billing</span>
        </h2>
        <p className="text-slate-400 mt-2">Manage your subscription and view billing history</p>
      </div>

      {/* Activation polling banner — shown after Stripe success redirect while we
          wait for the webhook to land. Auto-clears once subscription goes active. */}
      {activationPolling && (
        <div className="p-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 flex items-center gap-3">
          <Loader2 className="w-5 h-5 shrink-0 animate-spin text-emerald-400" />
          <div className="flex-1">
            <p className="font-medium text-emerald-300">Activating your subscription…</p>
            <p className="text-sm text-emerald-200/90 mt-0.5">
              Payment received. We&apos;re finalizing your account — this usually takes a few seconds.
            </p>
          </div>
        </div>
      )}

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-lg flex items-center space-x-2 ${
            message.type === "success"
              ? "bg-green-500/10 border border-green-500/20 text-green-400"
              : "bg-red-500/10 border border-red-500/20 text-red-400"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Past-due / disputed banner — shown when access is blocked due to payment issue.
          Premium routes redirect to /dashboard?upgrade=true when blocked, but the user
          may already be on settings; this banner gives them a clear next step. */}
      {subscription?.status === "past_due" && (
        <div className="p-4 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
          <div className="flex-1">
            <p className="font-medium text-amber-300">Payment Failed — Action Required</p>
            <p className="text-sm text-amber-200/90 mt-1">
              Your last subscription payment didn&apos;t go through. We&apos;ve paused premium access while Stripe retries.
              Update your payment method below to restore access immediately.
            </p>
          </div>
          <Button
            onClick={handlePortal}
            disabled={isActionLoading}
            size="sm"
            className="bg-amber-500 hover:bg-amber-400 text-black shrink-0"
          >
            Update Payment
          </Button>
        </div>
      )}
      {subscription?.status === "disputed" && (
        <div className="p-4 rounded-lg border border-red-500/40 bg-red-500/10 text-red-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
          <div className="flex-1">
            <p className="font-medium text-red-300">Payment Dispute Open</p>
            <p className="text-sm text-red-200/90 mt-1">
              A dispute has been opened against a recent payment. Premium access is paused while we resolve this with your bank.
              If you didn&apos;t mean to file this dispute, please contact support.
            </p>
          </div>
        </div>
      )}

      {/* ── Current Plan + Actions ── */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-400" />
            Current Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-slate-700/50 rounded-lg">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-white font-semibold text-lg">
                  {currentPkg?.name ?? "Free Plan"}
                </h3>
                {getStatusBadge(subscription?.status ?? null)}
              </div>
              {subscription?.expiresAt && (
                <p className="text-slate-400 text-sm flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {subscription.status === "canceled" ? "Access until" : "Renews on"}{" "}
                  {new Date(subscription.expiresAt).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              )}
              {!subscription?.hasAccess && !subscription?.plan && (
                <p className="text-slate-400 text-sm">
                  Basic free access — 3 AI predictions per day
                </p>
              )}
            </div>

            <div className="flex gap-2 flex-wrap">
              {subscription?.hasAccess ? (
                <>
                  <Button
                    variant="outline"
                    onClick={handlePortal}
                    disabled={isActionLoading}
                    className="border-slate-600 text-slate-300 hover:bg-slate-600"
                  >
                    {isActionLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <ExternalLink className="w-4 h-4 mr-2" />
                    )}
                    Manage Billing
                  </Button>
                  {subscription.status !== "canceled" ? (
                    <Button
                      variant="outline"
                      onClick={handleCancel}
                      disabled={isActionLoading}
                      className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Cancel Plan
                    </Button>
                  ) : (
                    <Button
                      onClick={handleReactivate}
                      disabled={isActionLoading}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Reactivate
                    </Button>
                  )}
                </>
              ) : (
                <Button
                  asChild
                  className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold shadow-[0_0_15px_rgba(59,130,246,0.3)] border-0"
                >
                  <a href="/pricing">
                    <Crown className="w-4 h-4 mr-2" />
                    Upgrade to Premium
                  </a>
                </Button>
              )}
            </div>
          </div>

          {/* Feature list for active plan */}
          {subscription?.hasAccess && currentPkg && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {currentPkg.features.map((feature) => (
                <div key={feature} className="flex items-center gap-1.5 text-sm text-slate-300">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  {feature}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── All Packages Overview ── */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">Available Packages</CardTitle>
            <Link href="/pricing">
              <Button variant="link" className="text-blue-400 hover:text-blue-300 p-0 h-auto">
                View full pricing
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {PACKAGES.map((pkg) => {
              const Icon = getIconComponent(pkg.iconName)
              const isCurrent = isCurrentPlan(pkg.id)
              const isSuggested = pkg.recommended && !isCurrent

              return (
                <div
                  key={pkg.id}
                  className={`relative p-4 rounded-lg border transition-all ${
                    isCurrent
                      ? "border-emerald-500/50 bg-emerald-900/10"
                      : isSuggested
                        ? "border-blue-500/40 bg-blue-900/10"
                        : "border-slate-600/40 bg-slate-700/20"
                  }`}
                >
                  {/* Badges */}
                  <div className="flex gap-1.5 mb-2 min-h-[20px]">
                    {isCurrent && (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px] px-1.5 py-0">
                        CURRENT
                      </Badge>
                    )}
                    {isSuggested && (
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/40 text-[10px] px-1.5 py-0">
                        SUGGESTED
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 mb-2">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${pkg.colorGradientFrom}, ${pkg.colorGradientTo})`,
                      }}
                    >
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h4 className="text-white font-semibold text-sm leading-tight">
                        {pkg.name}
                      </h4>
                      <p className="text-slate-400 text-xs">{getTipCountText(pkg.tipCount)}</p>
                    </div>
                  </div>

                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-lg font-bold text-white">
                      ${pkg.basePrice.toFixed(2)}
                    </span>
                    {pkg.purchaseType === "subscription" && (
                      <span className="text-slate-400 text-xs">/mo</span>
                    )}
                  </div>

                  {isCurrent ? (
                    <div className="flex items-center gap-1 text-xs text-emerald-400">
                      <CheckCircle className="w-3 h-3" />
                      <span>Active</span>
                    </div>
                  ) : (
                    <Link href={`/pricing?plan=${pkg.id}`}>
                      <Button
                        size="sm"
                        variant="outline"
                        className={`w-full text-xs h-7 ${
                          isSuggested
                            ? "border-blue-500/40 text-blue-400 hover:bg-blue-500/10"
                            : "border-slate-600 text-slate-300 hover:bg-slate-600"
                        }`}
                      >
                        {isSuggested ? "Get Recommended" : "View Plan"}
                      </Button>
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Billing History ── */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Billing History</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length > 0 ? (
            <div className="space-y-3">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-600/20 border border-blue-500/30 rounded-lg flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">
                        {invoice.description || "Premium Subscription"}
                      </p>
                      <p className="text-slate-400 text-sm">
                        {new Date(invoice.created * 1000).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <p className="text-white font-medium">
                        {(invoice.amount_paid / 100).toLocaleString("en-US", {
                          style: "currency",
                          currency: invoice.currency.toUpperCase(),
                        })}
                      </p>
                      <Badge
                        className={
                          invoice.status === "paid"
                            ? "bg-green-500/20 text-green-400 text-xs"
                            : "bg-amber-500/20 text-amber-400 text-xs"
                        }
                      >
                        {invoice.status}
                      </Badge>
                    </div>
                    {invoice.invoice_pdf && (
                      <a
                        href={invoice.invoice_pdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-400 hover:text-white transition-colors"
                        title="Download PDF"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CreditCard className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No billing history yet</p>
              <p className="text-slate-500 text-sm mt-1">
                Your payment history will appear here after your first transaction.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
