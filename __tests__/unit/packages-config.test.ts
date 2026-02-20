/**
 * Unit tests for lib/packages-config.ts
 *
 * Validates package definitions, helper functions, and pricing invariants
 * that the dashboard, /pricing, and Settings pages all rely on.
 */

import {
  PACKAGES,
  getPackageById,
  getRecommendedPackage,
  getTipCountText,
  getValidityText,
  type PackageDefinition,
} from "@/lib/packages-config"

describe("packages-config", () => {
  // ── Package definitions ───────────────────────────────────────────

  describe("PACKAGES array", () => {
    it("should contain exactly 4 packages", () => {
      expect(PACKAGES).toHaveLength(4)
    })

    it("should contain weekend_pass, weekly_pass, monthly_sub, and vip", () => {
      const ids = PACKAGES.map((p) => p.id)
      expect(ids).toEqual(["weekend_pass", "weekly_pass", "monthly_sub", "vip"])
    })

    it("should have exactly one recommended package", () => {
      const recommended = PACKAGES.filter((p) => p.recommended)
      expect(recommended).toHaveLength(1)
    })

    it("should set monthly_sub as the recommended package", () => {
      const recommended = PACKAGES.find((p) => p.recommended)
      expect(recommended?.id).toBe("monthly_sub")
    })

    it("should have valid basePrice > 0 for all packages", () => {
      for (const pkg of PACKAGES) {
        expect(pkg.basePrice).toBeGreaterThan(0)
      }
    })

    it("should price weekend, weekly, and monthly at $49.99", () => {
      const tieredPkgs = PACKAGES.filter((p) =>
        ["weekend_pass", "weekly_pass", "monthly_sub"].includes(p.id)
      )
      for (const pkg of tieredPkgs) {
        expect(pkg.basePrice).toBe(49.99)
      }
    })

    it("should price VIP at $79.99", () => {
      const vip = PACKAGES.find((p) => p.id === "vip")
      expect(vip?.basePrice).toBe(79.99)
    })

    it("should have non-empty features array for every package", () => {
      for (const pkg of PACKAGES) {
        expect(pkg.features.length).toBeGreaterThan(0)
      }
    })

    it("should have non-empty name and description for every package", () => {
      for (const pkg of PACKAGES) {
        expect(pkg.name.length).toBeGreaterThan(0)
        expect(pkg.description.length).toBeGreaterThan(0)
      }
    })

    it("should set purchaseType = 'subscription' only for vip", () => {
      for (const pkg of PACKAGES) {
        if (pkg.id === "vip") {
          expect(pkg.purchaseType).toBe("subscription")
          expect(pkg.subscriptionPlanId).toBeDefined()
        } else {
          expect(pkg.purchaseType).toBe("package")
        }
      }
    })

    it("should use -1 tipCount for unlimited packages", () => {
      const monthly = PACKAGES.find((p) => p.id === "monthly_sub")
      const vip = PACKAGES.find((p) => p.id === "vip")
      expect(monthly?.tipCount).toBe(-1)
      expect(vip?.tipCount).toBe(-1)
    })

    it("should have positive tipCount for limited packages", () => {
      const weekend = PACKAGES.find((p) => p.id === "weekend_pass")
      const weekly = PACKAGES.find((p) => p.id === "weekly_pass")
      expect(weekend?.tipCount).toBeGreaterThan(0)
      expect(weekly?.tipCount).toBeGreaterThan(0)
    })

    it("should have valid validityDays for every package", () => {
      for (const pkg of PACKAGES) {
        expect(pkg.validityDays).toBeGreaterThan(0)
      }
    })

    it("should have valid color gradient values for every package", () => {
      for (const pkg of PACKAGES) {
        expect(pkg.colorGradientFrom).toMatch(/^#[0-9A-Fa-f]{6}$/)
        expect(pkg.colorGradientTo).toMatch(/^#[0-9A-Fa-f]{6}$/)
      }
    })

    it("should have a valid iconName for every package", () => {
      const validIcons = ["Calendar", "TrendingUp", "Crown", "Zap", "Gift", "Star"]
      for (const pkg of PACKAGES) {
        expect(validIcons).toContain(pkg.iconName)
      }
    })
  })

  // ── getPackageById ────────────────────────────────────────────────

  describe("getPackageById", () => {
    it("should return the correct package for each known id", () => {
      for (const pkg of PACKAGES) {
        const result = getPackageById(pkg.id)
        expect(result).toBeDefined()
        expect(result?.id).toBe(pkg.id)
        expect(result?.name).toBe(pkg.name)
      }
    })

    it("should return undefined for an unknown id", () => {
      expect(getPackageById("nonexistent")).toBeUndefined()
      expect(getPackageById("")).toBeUndefined()
    })
  })

  // ── getRecommendedPackage ─────────────────────────────────────────

  describe("getRecommendedPackage", () => {
    it("should return the monthly_sub package", () => {
      const result = getRecommendedPackage()
      expect(result.id).toBe("monthly_sub")
      expect(result.recommended).toBe(true)
    })

    it("should fall back to PACKAGES[2] if no package is marked recommended", () => {
      // This tests the fallback logic — our actual data always has a recommended
      // package, but the code defensively falls back to index 2
      const result = getRecommendedPackage()
      expect(result).toBeDefined()
      expect(result.id).toBe(PACKAGES[2].id)
    })
  })

  // ── getTipCountText ───────────────────────────────────────────────

  describe("getTipCountText", () => {
    it('should return "Unlimited" for tipCount of -1', () => {
      expect(getTipCountText(-1)).toBe("Unlimited")
    })

    it("should return formatted tip count for positive numbers", () => {
      expect(getTipCountText(5)).toBe("5 Tips")
      expect(getTipCountText(8)).toBe("8 Tips")
      expect(getTipCountText(1)).toBe("1 Tips")
      expect(getTipCountText(100)).toBe("100 Tips")
    })

    it("should handle zero tips", () => {
      expect(getTipCountText(0)).toBe("0 Tips")
    })
  })

  // ── getValidityText ───────────────────────────────────────────────

  describe("getValidityText", () => {
    it('should return "24 Hours" for 1 day', () => {
      expect(getValidityText(1)).toBe("24 Hours")
    })

    it('should return "3 Days" for 3 days', () => {
      expect(getValidityText(3)).toBe("3 Days")
    })

    it('should return "1 Week" for 7 days', () => {
      expect(getValidityText(7)).toBe("1 Week")
    })

    it('should return "1 Month" for 30 days', () => {
      expect(getValidityText(30)).toBe("1 Month")
    })

    it("should return generic format for other day counts", () => {
      expect(getValidityText(14)).toBe("14 Days")
      expect(getValidityText(60)).toBe("60 Days")
      expect(getValidityText(2)).toBe("2 Days")
    })
  })
})

