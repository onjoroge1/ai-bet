/**
 * Centralised package definitions used by:
 *  - Dashboard "Premium Packages" (personalized-offers.tsx)
 *  - /pricing page (pricing-content.tsx)
 *  - Settings → Payment & Billing (PaymentSettings.tsx)
 *
 * Country-specific prices from the DB override the base USD prices at render
 * time when available.
 */

export interface PackageDefinition {
  /** Matches the packageType stored in PackageCountryPrice / API */
  id: string
  name: string
  description: string
  /** Base USD price — overridden by country-specific DB price when available */
  basePrice: number
  /** Optional strike-through USD price */
  baseOriginalPrice?: number
  tipCount: number
  /** -1 = unlimited */
  validityDays: number
  features: string[]
  /** Lucide icon name */
  iconName: string
  colorGradientFrom: string
  colorGradientTo: string
  /** Whether this is the recommended / "best value" package */
  recommended: boolean
  /**
   * "package" → one-time purchase via QuickPurchaseModal
   * "subscription" → recurring via /subscribe/[planId]
   */
  purchaseType: "package" | "subscription"
  /** Only used when purchaseType === "subscription" */
  subscriptionPlanId?: string
  /** Maps to PackageCountryPrice.packageType in the database */
  dbPackageType?: string
}

export const PACKAGES: PackageDefinition[] = [
  {
    id: "starter",
    name: "Starter",
    description: "Get started with AI picks — low commitment, instant access",
    basePrice: 4.99,
    tipCount: 3,
    validityDays: 7,
    features: [
      "3 SnapBet Picks per day",
      "Soccer predictions",
      "Basic odds & confidence",
      "Match analysis previews",
    ],
    iconName: "Zap",
    colorGradientFrom: "#8B5CF6",
    colorGradientTo: "#7C3AED",
    recommended: false,
    purchaseType: "package",
    dbPackageType: "prediction",
  },
  {
    id: "pro",
    name: "Pro",
    description: "Unlimited picks across all sports — most popular choice",
    basePrice: 19.99,
    tipCount: -1,
    validityDays: 30,
    features: [
      "Unlimited SnapBet Picks",
      "All Sports (Soccer, NBA, NHL, NCAAB)",
      "AI Parlays & combinations",
      "Player scorer predictions",
      "Premium star ratings",
      "Full match analysis",
    ],
    iconName: "Crown",
    colorGradientFrom: "#10B981",
    colorGradientTo: "#059669",
    recommended: true,
    purchaseType: "subscription",
    subscriptionPlanId: "pro_monthly",
    dbPackageType: "weekly_pass",
  },
  {
    id: "vip",
    name: "VIP",
    description: "Everything in Pro plus power tools for serious bettors",
    basePrice: 39.99,
    tipCount: -1,
    validityDays: 30,
    features: [
      "Everything in Pro",
      "CLV Tracker & alerts",
      "AI Parlay Builder",
      "Advanced analytics & ROI tracking",
      "Priority support",
      "Early access to new features",
    ],
    iconName: "Crown",
    colorGradientFrom: "#F59E0B",
    colorGradientTo: "#D97706",
    recommended: false,
    purchaseType: "subscription",
    subscriptionPlanId: "vip_monthly",
    dbPackageType: "monthly_sub",
  },
]

/** Legacy package IDs that should map to new tiers */
export const LEGACY_PACKAGE_MAP: Record<string, string> = {
  weekend_pass: "starter",
  weekly_pass: "pro",
  monthly_sub: "pro",
}

/** Helper: get a package definition by id */
export function getPackageById(id: string): PackageDefinition | undefined {
  return PACKAGES.find((p) => p.id === id)
}

/** Helper: get the recommended package */
export function getRecommendedPackage(): PackageDefinition {
  return PACKAGES.find((p) => p.recommended) ?? PACKAGES[2]
}

/** Helper: format tip count as human-readable text */
export function getTipCountText(tipCount: number): string {
  return tipCount === -1 ? "Unlimited" : `${tipCount} Tips`
}

/** Helper: format validity days as human-readable text */
export function getValidityText(validityDays: number): string {
  if (validityDays === 1) return "24 Hours"
  if (validityDays === 3) return "3 Days"
  if (validityDays === 7) return "1 Week"
  if (validityDays === 30) return "1 Month"
  return `${validityDays} Days`
}

