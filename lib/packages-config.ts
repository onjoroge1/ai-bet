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
}

export const PACKAGES: PackageDefinition[] = [
  {
    id: "weekend_pass",
    name: "Weekend Package",
    description: "Weekend special with 5 tips (Friday–Sunday)",
    basePrice: 49.99,
    tipCount: 5,
    validityDays: 3,
    features: [
      "5 Premium Tips",
      "Weekend Coverage",
      "Live Updates",
      "Priority Support",
    ],
    iconName: "Calendar",
    colorGradientFrom: "#8B5CF6",
    colorGradientTo: "#7C3AED",
    recommended: false,
    purchaseType: "package",
  },
  {
    id: "weekly_pass",
    name: "Weekly Package",
    description: "Full week coverage with 8 premium tips",
    basePrice: 49.99,
    tipCount: 8,
    validityDays: 7,
    features: [
      "8 Premium Tips",
      "Weekly Analysis",
      "Trend Reports",
      "VIP Chat Access",
    ],
    iconName: "TrendingUp",
    colorGradientFrom: "#10B981",
    colorGradientTo: "#059669",
    recommended: false,
    purchaseType: "package",
  },
  {
    id: "monthly_sub",
    name: "Monthly Package",
    description: "Unlimited tips for the entire month — best value",
    basePrice: 49.99,
    tipCount: -1,
    validityDays: 30,
    features: [
      "Unlimited Tips",
      "Monthly Coverage",
      "Advanced Analytics",
      "Priority Support",
    ],
    iconName: "Crown",
    colorGradientFrom: "#3B82F6",
    colorGradientTo: "#2563EB",
    recommended: true,
    purchaseType: "package",
  },
  {
    id: "vip",
    name: "VIP Package",
    description: "Full platform access — all premium features unlocked",
    basePrice: 79.99,
    tipCount: -1,
    validityDays: 30,
    features: [
      "Everything in Monthly",
      "VIP Intelligence Feed",
      "CLV Tracker",
      "AI Parlay Builder",
      "Hourly CLV Alerts",
      "Cancel Anytime",
    ],
    iconName: "Crown",
    colorGradientFrom: "#F59E0B",
    colorGradientTo: "#D97706",
    recommended: false,
    purchaseType: "subscription",
    subscriptionPlanId: "premium_intelligence",
  },
]

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

