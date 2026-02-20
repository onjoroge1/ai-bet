"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Crown,
  Zap,
  Gift,
  Star,
  Clock,
  TrendingUp,
  Target,
  Shield,
  Calendar,
  Activity,
  Layers,
  BarChart3,
  CheckCircle,
  ArrowRight,
} from "lucide-react"
import { QuickPurchaseModal } from "@/components/quick-purchase-modal"
import { useUserCountry } from "@/contexts/user-country-context"
import { useRouter } from "next/navigation"
import Link from "next/link"
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
  /** Country-specific price (overrides basePrice when available) */
  displayPrice: number
  displayOriginalPrice?: number
  currencySymbol: string
  /** Raw DB offer data (for purchase modal) */
  dbOffer?: PackageOffer
}

export function PersonalizedOffers() {
  const [dbPackages, setDbPackages] = useState<PackageOffer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedOffer, setSelectedOffer] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isPremium, setIsPremium] = useState<boolean | null>(null)
  const [currentPlan, setCurrentPlan] = useState<string | null>(null)
  const { userCountry } = useUserCountry()
  const router = useRouter()

  useEffect(() => {
    if (!userCountry) return
    fetchPremiumPackages(userCountry.toLowerCase())
  }, [userCountry])

  // Check premium status
  useEffect(() => {
    fetch("/api/premium/check")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setIsPremium(d?.hasAccess ?? false)
      })
      .catch(() => setIsPremium(false))

    // Also fetch current plan
    fetch("/api/subscriptions/manage", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.plan) setCurrentPlan(d.plan)
      })
      .catch(() => {})
  }, [])

  const fetchPremiumPackages = async (countryCode: string) => {
    try {
      const response = await fetch(`/api/homepage/pricing?country=${countryCode}`)
      if (!response.ok) throw new Error("Failed to fetch premium packages")
      const data = await response.json()

      // Filter for package offers (have countryPrices array structure)
      const packageOffers = data.plans.filter(
        (plan: PackageOffer) =>
          plan.countryPrices &&
          Array.isArray(plan.countryPrices) &&
          plan.countryPrices.length > 0 &&
          plan.packageType !== "prediction" &&
          plan.name !== "Single Tip"
      )

      setDbPackages(packageOffers)
    } catch (error) {
      console.error("Error fetching premium packages:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // ── Merge static PACKAGES with DB country pricing ──
  // packages-config.ts is the source of truth for USD prices.
  // DB country-specific prices are only used for non-USD currencies.
  const displayPackages: DisplayPackage[] = PACKAGES.map((pkg) => {
    // Try to find matching DB offer by packageType
    const dbOffer = dbPackages.find(
      (o) => o.packageType === pkg.id || o.id.endsWith(`_${pkg.id}`)
    )

    const countryPrice = dbOffer?.countryPrices?.[0]
    const useDbPrice = countryPrice && countryPrice.currencyCode !== "USD"

    return {
      ...pkg,
      displayPrice: useDbPrice ? countryPrice.price : pkg.basePrice,
      displayOriginalPrice: useDbPrice
        ? countryPrice.originalPrice
        : pkg.baseOriginalPrice,
      currencySymbol: countryPrice?.currencySymbol ?? "$",
      dbOffer,
    }
  })

  // ── Handlers ──

  const handlePurchase = (pkg: DisplayPackage) => {
    if (pkg.purchaseType === "subscription") {
      // VIP → Stripe subscription checkout
      router.push(`/subscribe/${pkg.subscriptionPlanId ?? "premium_intelligence"}`)
      return
    }

    // Tip package → QuickPurchaseModal
    const item = {
      id: pkg.dbOffer?.id ?? pkg.id,
      name: pkg.name,
      price: pkg.displayPrice,
      originalPrice: pkg.displayOriginalPrice,
      description: pkg.description,
      features: pkg.features,
      type: "package" as const,
      iconName: pkg.iconName,
      colorGradientFrom: pkg.colorGradientFrom,
      colorGradientTo: pkg.colorGradientTo,
      tipCount: pkg.tipCount,
      validityDays: pkg.validityDays,
      packageType: pkg.id,
    }
    setSelectedOffer(item)
    setIsModalOpen(true)
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

  /** Is this package the user's current active plan? */
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

  if (isLoading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
        </div>
      </Card>
    )
  }

  return (
    <>
      <Card className="bg-slate-800/50 border-slate-700 p-6">
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
            <Gift className="w-5 h-5 text-purple-400" />
            <span>Premium Packages</span>
          </h2>
          {currentPlan && (
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40">
              Current: {displayPackages.find((p) => isCurrentPlan(p.id))?.name ?? currentPlan}
            </Badge>
          )}
        </div>

        {/* ── 4 Package Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {displayPackages.map((pkg) => {
            const Icon = getIconComponent(pkg.iconName)
            const isCurrent = isCurrentPlan(pkg.id)
            const discount =
              pkg.displayOriginalPrice && pkg.displayOriginalPrice > pkg.displayPrice
                ? Math.round(
                    ((pkg.displayOriginalPrice - pkg.displayPrice) /
                      pkg.displayOriginalPrice) *
                      100
                  )
                : 0

            return (
              <div
                key={pkg.id}
                className={`relative rounded-xl p-5 border flex flex-col transition-all duration-300 hover:scale-[1.02] ${
                  isCurrent
                    ? "border-emerald-500/50 bg-gradient-to-b from-emerald-900/20 to-slate-800/60 ring-2 ring-emerald-500/30"
                    : pkg.recommended
                      ? "border-blue-500/50 bg-gradient-to-b from-blue-900/20 to-slate-800/60 ring-2 ring-blue-500/30"
                      : "border-slate-600/50 bg-slate-700/30"
                }`}
                style={{
                  background: isCurrent
                    ? undefined
                    : pkg.recommended
                      ? undefined
                      : `linear-gradient(135deg, ${pkg.colorGradientFrom}12, ${pkg.colorGradientTo}12)`,
                }}
              >
                {/* Badges */}
                <div className="flex items-center gap-2 mb-3 min-h-[24px]">
                  {isCurrent && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px] px-2 py-0.5">
                      CURRENT PLAN
                    </Badge>
                  )}
                  {pkg.recommended && !isCurrent && (
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/40 text-[10px] px-2 py-0.5">
                      RECOMMENDED
                    </Badge>
                  )}
                  {discount > 0 && (
                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px] px-2 py-0.5">
                      -{discount}%
                    </Badge>
                  )}
                </div>

                {/* Icon + Name */}
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${pkg.colorGradientFrom}, ${pkg.colorGradientTo})`,
                    }}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-sm leading-tight">{pkg.name}</h3>
                    <p className="text-slate-400 text-xs">{getTipCountText(pkg.tipCount)}</p>
                  </div>
                </div>

                {/* Price */}
                <div className="mb-3">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-white">
                      {pkg.currencySymbol}
                      {pkg.displayPrice.toFixed(2)}
                    </span>
                    {pkg.purchaseType === "subscription" && (
                      <span className="text-slate-400 text-xs">/mo</span>
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
                <p className="text-slate-400 text-xs mb-3 min-h-[2rem]">{pkg.description}</p>

                {/* Features */}
                <div className="space-y-1.5 mb-4 flex-1">
                  {pkg.features.slice(0, 4).map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-slate-300 text-xs">
                      <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Validity */}
                <div className="flex items-center gap-1.5 text-xs text-blue-400 mb-4 pt-3 border-t border-slate-600/30">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{getValidityText(pkg.validityDays)}</span>
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
                    className="w-full text-white font-semibold"
                    style={{
                      background: `linear-gradient(135deg, ${pkg.colorGradientFrom}, ${pkg.colorGradientTo})`,
                    }}
                  >
                    {pkg.purchaseType === "subscription" ? (
                      <>
                        <Crown className="w-4 h-4 mr-2" />
                        Subscribe
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Get Package
                      </>
                    )}
                  </Button>
                )}
              </div>
            )
          })}
        </div>

        {/* ── Suggested next plan — always Monthly ── */}
        {!isPremium && !isCurrentPlan("monthly_sub") && (
          <div className="mt-6 p-4 bg-blue-900/20 rounded-lg border border-blue-500/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center border border-blue-500/30">
                  <Crown className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h4 className="text-blue-300 font-medium text-sm">
                    Suggested: Monthly Package
                  </h4>
                  <p className="text-slate-400 text-xs">
                    Unlimited tips for $49.99 — our most popular choice
                  </p>
                </div>
              </div>
              <Button
                onClick={() =>
                  handlePurchase(displayPackages.find((p) => p.id === "monthly_sub")!)
                }
                size="sm"
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-xs"
              >
                Get Monthly
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Package explanation */}
        <div className="mt-6 p-4 bg-purple-900/20 rounded-lg border border-purple-500/30">
          <div className="flex items-center space-x-2 mb-2">
            <Target className="w-5 h-5 text-purple-400" />
            <h4 className="text-purple-400 font-medium text-sm">Why Choose Our Packages?</h4>
          </div>
          <p className="text-purple-300 text-xs">
            Our premium packages are designed to give you the best value for your betting strategy.
            Choose the package that fits your needs — from weekend tips to unlimited monthly access.
            All packages include AI-powered analysis, confidence scores, and expert insights.
          </p>
        </div>
      </Card>

      {/* Quick Purchase Modal for tip packages */}
      {selectedOffer && (
        <QuickPurchaseModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          item={selectedOffer}
        />
      )}
    </>
  )
}
