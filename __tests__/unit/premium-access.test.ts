/**
 * Unit tests for lib/premium-access.ts
 *
 * Tests the hasPremiumAccess() and getPremiumStatus() functions that gate
 * premium dashboard pages (VIP, Analytics, CLV, Parlays).
 */

// Mock dependencies before importing the module
jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}))

jest.mock("@/lib/auth", () => ({
  authOptions: {},
}))

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
  },
}))

import { hasPremiumAccess, getPremiumStatus } from "@/lib/premium-access"
import { getServerSession } from "next-auth"
import prisma from "@/lib/db"

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>
const mockFindUnique = prisma.user.findUnique as jest.MockedFunction<typeof prisma.user.findUnique>

/** Helper: creates a future date string */
const futureDate = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // +30 days
/** Helper: creates a past date string */
const pastDate = () => new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // -1 day

describe("premium-access", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ── hasPremiumAccess ──────────────────────────────────────────────

  describe("hasPremiumAccess", () => {
    it("should return false when there is no session", async () => {
      mockGetServerSession.mockResolvedValue(null)
      expect(await hasPremiumAccess()).toBe(false)
    })

    it("should return false when session has no user id", async () => {
      mockGetServerSession.mockResolvedValue({ user: {} } as never)
      expect(await hasPremiumAccess()).toBe(false)
    })

    it("should return false when user not found in DB", async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: "u1" } } as never)
      mockFindUnique.mockResolvedValue(null)
      expect(await hasPremiumAccess()).toBe(false)
    })

    it("should return true for admin users regardless of subscription", async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: "u1" } } as never)
      mockFindUnique.mockResolvedValue({
        role: "admin",
        subscriptionPlan: null,
        subscriptionStatus: null,
        subscriptionExpiresAt: null,
      } as never)
      expect(await hasPremiumAccess()).toBe(true)
    })

    it("should return true for user with active premium plan", async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: "u1" } } as never)
      mockFindUnique.mockResolvedValue({
        role: "user",
        subscriptionPlan: "premium_intelligence",
        subscriptionStatus: "active",
        subscriptionExpiresAt: futureDate(),
      } as never)
      expect(await hasPremiumAccess()).toBe(true)
    })

    it("should return true for user with VIP plan", async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: "u1" } } as never)
      mockFindUnique.mockResolvedValue({
        role: "user",
        subscriptionPlan: "vip_monthly",
        subscriptionStatus: "active",
        subscriptionExpiresAt: futureDate(),
      } as never)
      expect(await hasPremiumAccess()).toBe(true)
    })

    it("should return true when subscriptionStatus is null (webhook not yet fired)", async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: "u1" } } as never)
      mockFindUnique.mockResolvedValue({
        role: "user",
        subscriptionPlan: "monthly",
        subscriptionStatus: null,
        subscriptionExpiresAt: futureDate(),
      } as never)
      expect(await hasPremiumAccess()).toBe(true)
    })

    it("should return false when subscription is expired", async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: "u1" } } as never)
      mockFindUnique.mockResolvedValue({
        role: "user",
        subscriptionPlan: "premium_intelligence",
        subscriptionStatus: "active",
        subscriptionExpiresAt: pastDate(),
      } as never)
      expect(await hasPremiumAccess()).toBe(false)
    })

    it("should return false when subscription status is canceled", async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: "u1" } } as never)
      mockFindUnique.mockResolvedValue({
        role: "user",
        subscriptionPlan: "premium_intelligence",
        subscriptionStatus: "canceled",
        subscriptionExpiresAt: futureDate(),
      } as never)
      expect(await hasPremiumAccess()).toBe(false)
    })

    it("should return false when subscription status is cancelled (British spelling)", async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: "u1" } } as never)
      mockFindUnique.mockResolvedValue({
        role: "user",
        subscriptionPlan: "premium_intelligence",
        subscriptionStatus: "cancelled",
        subscriptionExpiresAt: futureDate(),
      } as never)
      expect(await hasPremiumAccess()).toBe(false)
    })

    it("should return false when subscription status is unpaid", async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: "u1" } } as never)
      mockFindUnique.mockResolvedValue({
        role: "user",
        subscriptionPlan: "premium_intelligence",
        subscriptionStatus: "unpaid",
        subscriptionExpiresAt: futureDate(),
      } as never)
      expect(await hasPremiumAccess()).toBe(false)
    })

    it("should return false when subscription status is incomplete_expired", async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: "u1" } } as never)
      mockFindUnique.mockResolvedValue({
        role: "user",
        subscriptionPlan: "premium_intelligence",
        subscriptionStatus: "incomplete_expired",
        subscriptionExpiresAt: futureDate(),
      } as never)
      expect(await hasPremiumAccess()).toBe(false)
    })

    it("should return true when status is trialing (not explicitly blocked)", async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: "u1" } } as never)
      mockFindUnique.mockResolvedValue({
        role: "user",
        subscriptionPlan: "premium_intelligence",
        subscriptionStatus: "trialing",
        subscriptionExpiresAt: futureDate(),
      } as never)
      expect(await hasPremiumAccess()).toBe(true)
    })

    it("should return false when user has no subscription plan", async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: "u1" } } as never)
      mockFindUnique.mockResolvedValue({
        role: "user",
        subscriptionPlan: null,
        subscriptionStatus: null,
        subscriptionExpiresAt: null,
      } as never)
      expect(await hasPremiumAccess()).toBe(false)
    })

    it("should return false when plan does not contain premium/monthly/vip", async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: "u1" } } as never)
      mockFindUnique.mockResolvedValue({
        role: "user",
        subscriptionPlan: "basic_free",
        subscriptionStatus: "active",
        subscriptionExpiresAt: futureDate(),
      } as never)
      expect(await hasPremiumAccess()).toBe(false)
    })

    it("should return false and not throw on DB error", async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: "u1" } } as never)
      mockFindUnique.mockRejectedValue(new Error("DB connection failed"))
      expect(await hasPremiumAccess()).toBe(false)
    })
  })

  // ── getPremiumStatus ──────────────────────────────────────────────

  describe("getPremiumStatus", () => {
    it("should return no access when there is no session", async () => {
      mockGetServerSession.mockResolvedValue(null)
      const result = await getPremiumStatus()
      expect(result).toEqual({
        hasAccess: false,
        plan: null,
        expiresAt: null,
        isExpired: true,
      })
    })

    it("should return no access when user not found", async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: "u1" } } as never)
      mockFindUnique.mockResolvedValue(null)
      const result = await getPremiumStatus()
      expect(result.hasAccess).toBe(false)
      expect(result.plan).toBeNull()
    })

    it("should grant admin access regardless of subscription", async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: "u1" } } as never)
      mockFindUnique.mockResolvedValue({
        role: "admin",
        subscriptionPlan: null,
        subscriptionStatus: null,
        subscriptionExpiresAt: null,
      } as never)
      const result = await getPremiumStatus()
      expect(result.hasAccess).toBe(true)
      expect(result.isExpired).toBe(false)
    })

    it("should return correct status for active premium user", async () => {
      const expires = futureDate()
      mockGetServerSession.mockResolvedValue({ user: { id: "u1" } } as never)
      mockFindUnique.mockResolvedValue({
        role: "user",
        subscriptionPlan: "premium_intelligence",
        subscriptionStatus: "active",
        subscriptionExpiresAt: expires,
      } as never)
      const result = await getPremiumStatus()
      expect(result.hasAccess).toBe(true)
      expect(result.plan).toBe("premium_intelligence")
      expect(result.expiresAt).toEqual(expires)
      expect(result.isExpired).toBe(false)
    })

    it("should mark expired subscription correctly", async () => {
      const expires = pastDate()
      mockGetServerSession.mockResolvedValue({ user: { id: "u1" } } as never)
      mockFindUnique.mockResolvedValue({
        role: "user",
        subscriptionPlan: "premium_intelligence",
        subscriptionStatus: "active",
        subscriptionExpiresAt: expires,
      } as never)
      const result = await getPremiumStatus()
      expect(result.hasAccess).toBe(false)
      expect(result.isExpired).toBe(true)
    })

    it("should return no access and not throw on DB error", async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: "u1" } } as never)
      mockFindUnique.mockRejectedValue(new Error("DB down"))
      const result = await getPremiumStatus()
      expect(result.hasAccess).toBe(false)
      expect(result.plan).toBeNull()
    })
  })
})

