"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Check,
  Crown,
  Zap,
  Loader2,
  AlertCircle,
  ArrowRight,
  Star,
  Clock,
  TrendingUp,
  Calendar,
  Gift,
  BarChart3,
  Activity,
  Layers,
  Shield,
  CheckCircle,
  Sparkles,
} from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
// QuickPurchaseModal removed — all tiers use Stripe Checkout
import { useUserCountry } from "@/contexts/user-country-context"
import {
  PACKAGES,
  type PackageDefinition,
  getTipCountText,
  getValidityText,
} from "@/lib/packages-config"

/** Shape returned by /api/homepage/pricing for tip packages */
interface PackageOffer {
  id: string
  name: string
  packageType: string
  description: string
  tipCount: number
  validityDays: number
  features: string[]
  iconName: string
  colorGradientFrom: string
  colorGradientTo: string
  displayOrder: number
  isActive: boolean
  countryPrices: {
    id: string
    price: number
    originalPrice?: number
    currencyCode: string
    currencySymbol: string
    country: {
      name: string
      code: string
      currencyCode: string
      currencySymbol: string
    }
  }[]
}

/** Merged view: static definition + optional DB pricing */
interface DisplayPackage extends PackageDefinition {
  displayPrice: number
  displayOriginalPrice?: number
  currencySymbol: string
  dbOffer?: PackageOffer
}

/**
 * PricingContent – Unified pricing page.
 *
 * Shows 4 selectable package cards (Weekend, Weekly, Monthly, VIP) that
 * mirror the dashboard's "Premium Packages" section, plus a feature comparison
 * table and FAQ section.
 */
export function PricingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { userCountry } = useUserCountry()

  const [dbPackages, setDbPackages] = useState<PackageOffer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPremium, setIsPremium] = useState<boolean | null>(null)
  const [currentPlan, setCurrentPlan] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // Modal state removed — all tiers use Stripe Checkout redirect

  // Highlight a plan when linked with ?plan=…
  const highlightedPlan = searchParams.get("plan")

  // ── Fetch packages from /api/homepage/pricing ──
  const fetchPackages = useCallback(
    async (countryCode: string) => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(`/api/homepage/pricing?country=${countryCode}`)
        if (!response.ok) throw new Error("Failed to fetch packages")
        const data = await response.json()

        const packageOffers = (data.plans as PackageOffer[]).filter(
          (p) =>
            p.countryPrices &&
            Array.isArray(p.countryPrices) &&
            p.countryPrices.length > 0
        )
        setDbPackages(packageOffers)
      } catch (err) {
        console.error("Error fetching packages:", err)
        setError(err instanceof Error ? err.message : "Failed to load pricing")
      } finally {
        setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    if (!userCountry) return
    fetchPackages(userCountry.toLowerCase())
  }, [userCountry, fetchPackages])

  // Check premium status + current plan
  useEffect(() => {
    fetch("/api/premium/check")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setIsPremium(d?.hasAccess ?? false))
      .catch(() => setIsPremium(false))

    fetch("/api/subscriptions/manage", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.plan) setCurrentPlan(d.plan)
      })
      .catch(() => {})
  }, [])

  // ── Merge static PACKAGES with DB country pricing ──
  // packages-config.ts is the source of truth for USD prices.
  // DB country-specific prices are only used for non-USD currencies.
  const displayPackages: DisplayPackage[] = PACKAGES.map((pkg) => {
    // Match by dbPackageType (maps to DB packageType), then fallback to pkg.id
    const lookupType = pkg.dbPackageType || pkg.id
    const dbOffer = dbPackages.find(
      (o) => o.packageType === lookupType || o.packageType === pkg.id || o.id.endsWith(`_${pkg.id}`)
    )
    const countryPrice = dbOffer?.countryPrices?.[0]
    // Always use DB price when available (ensures correct currency for all countries)
    const useDbPrice = !!countryPrice

    return {
      ...pkg,
      displayPrice: useDbPrice ? countryPrice.price : pkg.basePrice,
      displayOriginalPrice: useDbPrice
        ? countryPrice.originalPrice
        : pkg.baseOriginalPrice,
      currencySymbol: useDbPrice ? countryPrice.currencySymbol : "$",
      dbOffer,
    }
  })

  // ── Handlers ──
  const handlePurchase = (pkg: DisplayPackage) => {
    // All tiers use Stripe Checkout (recurring monthly)
    const planId = pkg.subscriptionPlanId || `${pkg.id}_monthly`
    router.push(`/subscribe/${planId}`)
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

  const isCurrentPlan = (pkgId: string): boolean => {
    if (!currentPlan) return false
    const plan = currentPlan.toLowerCase()
    if (pkgId === "vip") {
      return (
        plan.includes("vip") ||
        plan.includes("premium_intelligence") ||
        plan.includes("premium")
      )
    }
    return plan.includes(pkgId)
  }

  // Feature comparison: Free vs Pro vs VIP
  const comparisonFeatures = [
    { name: "AI Match Predictions", free: "Teaser only", pro: "Unlimited", vip: "Unlimited" },
    { name: "All Sports (Soccer, NBA, NHL, NCAAB)", free: false, pro: true, vip: true },
    { name: "Full Match Analysis", free: false, pro: true, vip: true },
    { name: "SnapBet Picks (AI-curated)", free: "View only", pro: true, vip: true },
    { name: "AI Parlays", free: false, pro: true, vip: true },
    { name: "Player Scorer Predictions", free: false, pro: true, vip: true },
    { name: "Premium Star Ratings", free: false, pro: true, vip: true },
    { name: "Edge Finder (Arb + EV + Line Shop)", free: false, pro: false, vip: true },
    { name: "AI Parlay Builder", free: false, pro: false, vip: true },
    { name: "Bookmaker Odds (50+ books)", free: false, pro: false, vip: true },
    { name: "Advanced Analytics & ROI", free: false, pro: false, vip: true },
    { name: "Priority Support", free: false, pro: false, vip: true },
    { name: "Billing", free: "Free", pro: "Monthly", vip: "Monthly" },
  ]

  // ── Loading / Error states ──
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-emerald-400 mx-auto mb-4" />
          <p className="text-slate-400">Loading pricing plans...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Card className="bg-red-900/20 border-red-500/30 max-w-2xl">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <p className="text-red-400 mb-4">{error}</p>
            <Button
              onClick={() => userCountry && fetchPackages(userCountry.toLowerCase())}
              variant="outline"
              className="border-red-500/30 text-red-400"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* ── Header ── */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm mb-4">
            <Sparkles className="w-4 h-4" />
            AI-Powered Betting Intelligence
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Simple Pricing, Powerful AI</h1>
          <p className="text-xl text-slate-300 mb-2">
            Two plans. Full access. Cancel anytime.
          </p>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Get AI-powered predictions across Soccer, NBA, NHL &amp; NCAAB.
            Pro gives you unlimited picks. VIP adds Edge Finder, AI Builder &amp; advanced analytics.
          </p>
        </div>

        {/* ── 2 Package Cards (centered) ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto mb-12">
          {displayPackages.map((pkg) => {
            const Icon = getIconComponent(pkg.iconName)
            const isCurrent = isCurrentPlan(pkg.id)
            const isHighlighted = highlightedPlan === pkg.id || highlightedPlan === pkg.subscriptionPlanId
            const discount =
              pkg.displayOriginalPrice && pkg.displayOriginalPrice > pkg.displayPrice
                ? Math.round(
                    ((pkg.displayOriginalPrice - pkg.displayPrice) /
                      pkg.displayOriginalPrice) *
                      100
                  )
                : 0

            return (
              <Card
                key={pkg.id}
                className={`relative overflow-hidden flex flex-col transition-all duration-300 hover:scale-[1.02] ${
                  isCurrent
                    ? "border-emerald-500/50 bg-gradient-to-b from-emerald-900/20 to-slate-800/60 ring-2 ring-emerald-500/30"
                    : pkg.recommended
                      ? "border-blue-500/50 bg-gradient-to-b from-blue-900/20 to-slate-800/60 ring-2 ring-blue-500/30"
                      : isHighlighted
                        ? "border-amber-500/50 ring-2 ring-amber-500/30 bg-slate-800/50"
                        : "border-slate-700 bg-slate-800/50"
                }`}
              >
                {/* Top Badges */}
                <div className="flex items-center gap-2 p-5 pb-0 min-h-[32px]">
                  {isCurrent && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px]">
                      CURRENT PLAN
                    </Badge>
                  )}
                  {pkg.recommended && !isCurrent && (
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/40 text-[10px]">
                      RECOMMENDED
                    </Badge>
                  )}
                  {discount > 0 && (
                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px]">
                      -{discount}%
                    </Badge>
                  )}
                </div>

                <CardContent className="flex-1 flex flex-col p-5 pt-3">
                  {/* Icon + Name */}
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${pkg.colorGradientFrom}, ${pkg.colorGradientTo})`,
                      }}
                    >
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-lg leading-tight">{pkg.name}</h3>
                      <p className="text-slate-400 text-sm">{getTipCountText(pkg.tipCount)}</p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-white">
                        {pkg.currencySymbol}
                        {pkg.displayPrice.toFixed(2)}
                      </span>
                      {pkg.purchaseType === "subscription" && (
                        <span className="text-slate-400 text-sm">/mo</span>
                      )}
                    </div>
                    {pkg.displayOriginalPrice && pkg.displayOriginalPrice > pkg.displayPrice && (
                      <span className="text-slate-500 line-through text-sm">
                        {pkg.currencySymbol}
                        {pkg.displayOriginalPrice.toFixed(2)}
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-slate-400 text-sm mb-4 min-h-[2.5rem]">{pkg.description}</p>

                  {/* Features */}
                  <div className="space-y-2 mb-5 flex-1">
                    {pkg.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-slate-300 text-sm">
                        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>

                  {/* Validity */}
                  <div className="flex items-center gap-2 text-blue-400 text-sm mb-5 pt-4 border-t border-slate-600/40">
                    <Clock className="w-4 h-4" />
                    <span className="font-medium">{getValidityText(pkg.validityDays)}</span>
                  </div>

                  {/* CTA */}
                  {isCurrent ? (
                    <Button
                      disabled
                      className="w-full bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 cursor-default"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Current Plan
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handlePurchase(pkg)}
                      className="w-full text-white font-semibold py-5 h-auto"
                      style={{
                        background: `linear-gradient(135deg, ${pkg.colorGradientFrom}, ${pkg.colorGradientTo})`,
                      }}
                    >
                      {pkg.purchaseType === "subscription" ? (
                        <>
                          <Crown className="w-5 h-5 mr-2" />
                          Subscribe Now
                        </>
                      ) : (
                        <>
                          <Zap className="w-5 h-5 mr-2" />
                          Get Package
                        </>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* ── Free tier note ── */}
        {!isPremium && (
          <div className="mb-12 p-5 bg-slate-800/40 rounded-xl border border-slate-700/50 text-center max-w-2xl mx-auto">
            <p className="text-slate-400 text-sm">
              <span className="text-white font-medium">Free users</span> can browse matches, view basic predictions, and see win probabilities.
              Subscribe to unlock full analysis, team insights, betting recommendations &amp; more.
            </p>
          </div>
        )}

        {/* ── Feature Comparison Table ── */}
        <Card className="bg-slate-800/50 border-slate-700 mb-12">
          <CardHeader>
            <CardTitle className="text-white text-2xl">Feature Comparison</CardTitle>
            <p className="text-slate-400">See what&apos;s included in each plan</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-4 px-4 text-slate-300 font-semibold">Feature</th>
                    <th className="text-center py-4 px-4 text-slate-400 font-semibold">Free</th>
                    <th className="text-center py-4 px-4 font-semibold">
                      <span className="text-emerald-400">Pro</span>
                    </th>
                    <th className="text-center py-4 px-4 font-semibold">
                      <span className="text-amber-400">VIP</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonFeatures.map((feature, idx) => (
                    <tr key={idx} className="border-b border-slate-700/50">
                      <td className="py-4 px-4 text-white font-medium">{feature.name}</td>
                      {(["free", "pro", "vip"] as const).map((col) => {
                        const val = feature[col]
                        return (
                          <td key={col} className="py-4 px-4 text-center">
                            {typeof val === "string" ? (
                              <span
                                className={`text-sm font-medium ${
                                  col === "vip"
                                    ? "text-amber-400"
                                    : col === "pro"
                                      ? "text-emerald-400"
                                      : "text-slate-400"
                                }`}
                              >
                                {val}
                              </span>
                            ) : val ? (
                              <Check
                                className={`h-5 w-5 mx-auto ${
                                  col === "vip"
                                    ? "text-amber-400"
                                    : col === "monthly"
                                      ? "text-blue-400"
                                      : "text-emerald-400"
                                }`}
                              />
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ── How It Works ── */}
        <Card className="bg-slate-800/50 border-slate-700 mb-12">
          <CardHeader>
            <CardTitle className="text-white text-2xl">How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mx-auto mb-3 border border-emerald-500/30">
                  <span className="text-emerald-400 font-bold text-lg">1</span>
                </div>
                <h3 className="text-white font-semibold mb-2">Choose Your Package</h3>
                <p className="text-slate-400 text-sm">
                  Pick from Weekend, Weekly, Monthly, or go all-in with VIP for full platform
                  access.
                </p>
              </div>
              <div className="text-center p-4">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mx-auto mb-3 border border-emerald-500/30">
                  <span className="text-emerald-400 font-bold text-lg">2</span>
                </div>
                <h3 className="text-white font-semibold mb-2">Get AI Predictions</h3>
                <p className="text-slate-400 text-sm">
                  Access AI-powered match predictions with confidence scores, value ratings, and
                  detailed analysis.
                </p>
              </div>
              <div className="text-center p-4">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mx-auto mb-3 border border-emerald-500/30">
                  <span className="text-emerald-400 font-bold text-lg">3</span>
                </div>
                <h3 className="text-white font-semibold mb-2">Track &amp; Win</h3>
                <p className="text-slate-400 text-sm">
                  Use analytics, CLV tracking, and the VIP feed to refine your strategy and
                  maximise returns.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── FAQ Section ── */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-2xl">Frequently Asked Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-white font-semibold mb-2">
                What&apos;s the difference between the packages?
              </h3>
              <p className="text-slate-400">
                Weekend, Weekly, and Monthly packages are one-time purchases that give you a set
                number of premium tips within a validity period. The VIP Package is a monthly
                subscription that unlocks the full platform — VIP Intelligence Feed, Advanced
                Analytics, CLV Tracker, AI Parlay Builder, and unlimited AI picks.
              </p>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-2">Which plan do you recommend?</h3>
              <p className="text-slate-400">
                We recommend the <strong className="text-blue-400">Monthly Package</strong> for
                most users. It gives you unlimited tips for an entire month at a great price. If you
                want full platform access with analytics and the VIP feed, go for the VIP Package.
              </p>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-2">Can I cancel VIP anytime?</h3>
              <p className="text-slate-400">
                Yes, you can cancel your VIP subscription at any time. Your access will continue
                until the end of your current billing period.
              </p>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-2">
                What payment methods are accepted?
              </h3>
              <p className="text-slate-400">
                We accept all major credit cards, debit cards, and regional payment methods through
                Stripe.
              </p>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-2">Do you offer refunds?</h3>
              <p className="text-slate-400">
                We offer a 30-day money-back guarantee for VIP subscriptions. Tip packages are
                non-refundable once tips have been claimed.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ── Bottom CTA ── */}
        {!isPremium && (
          <div className="text-center mt-12 mb-8">
            <p className="text-slate-400 mb-4">
              Ready to take your betting to the next level?
            </p>
            <Button
              onClick={() =>
                handlePurchase(displayPackages.find((p) => p.id === "monthly_sub")!)
              }
              size="lg"
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold shadow-[0_0_20px_rgba(59,130,246,0.3)] border-0 px-10 py-4 text-lg"
            >
              <Crown className="w-5 h-5 mr-2" />
              Get Monthly Package — $49.99
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        )}
      </div>

    </div>
  )
}
