/**
 * Integration tests for GET /api/premium/check
 *
 * Verifies the premium check API that PremiumGate, PersonalizedOffers,
 * and DashboardLayout all rely on.
 */

// ── Mock dependencies ────────────────────────────────────────────────

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

import { GET } from "@/app/api/premium/check/route"
import { getServerSession } from "next-auth"
import prisma from "@/lib/db"

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>
const mockFindUnique = prisma.user.findUnique as jest.MockedFunction<typeof prisma.user.findUnique>

const futureDate = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
const pastDate = () => new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)

describe("GET /api/premium/check", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("should return hasAccess: false when user is not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null)
    const response = await GET()
    const data = await response.json()
    expect(data.hasAccess).toBe(false)
    expect(data.plan).toBeNull()
  })

  it("should return hasAccess: true for admin users", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "u1" } } as never)
    mockFindUnique.mockResolvedValue({
      role: "admin",
      subscriptionPlan: null,
      subscriptionStatus: null,
      subscriptionExpiresAt: null,
    } as never)
    const response = await GET()
    const data = await response.json()
    expect(data.hasAccess).toBe(true)
  })

  it("should return hasAccess: true for active premium user", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "u1" } } as never)
    mockFindUnique.mockResolvedValue({
      role: "user",
      subscriptionPlan: "premium_intelligence",
      subscriptionStatus: "active",
      subscriptionExpiresAt: futureDate(),
    } as never)
    const response = await GET()
    const data = await response.json()
    expect(data.hasAccess).toBe(true)
    expect(data.plan).toBe("premium_intelligence")
    expect(data.isExpired).toBe(false)
  })

  it("should return hasAccess: false for expired premium user", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "u1" } } as never)
    mockFindUnique.mockResolvedValue({
      role: "user",
      subscriptionPlan: "premium_intelligence",
      subscriptionStatus: "active",
      subscriptionExpiresAt: pastDate(),
    } as never)
    const response = await GET()
    const data = await response.json()
    expect(data.hasAccess).toBe(false)
    expect(data.isExpired).toBe(true)
  })

  it("should return hasAccess: false for canceled user", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "u1" } } as never)
    mockFindUnique.mockResolvedValue({
      role: "user",
      subscriptionPlan: "premium_intelligence",
      subscriptionStatus: "canceled",
      subscriptionExpiresAt: futureDate(),
    } as never)
    const response = await GET()
    const data = await response.json()
    expect(data.hasAccess).toBe(false)
  })

  it("should return hasAccess: false for free user", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "u1" } } as never)
    mockFindUnique.mockResolvedValue({
      role: "user",
      subscriptionPlan: null,
      subscriptionStatus: null,
      subscriptionExpiresAt: null,
    } as never)
    const response = await GET()
    const data = await response.json()
    expect(data.hasAccess).toBe(false)
  })

  it("should set Cache-Control headers on successful response", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "u1" } } as never)
    mockFindUnique.mockResolvedValue({
      role: "user",
      subscriptionPlan: "premium_intelligence",
      subscriptionStatus: "active",
      subscriptionExpiresAt: futureDate(),
    } as never)
    const response = await GET()
    const cacheControl = response.headers.get("Cache-Control")
    expect(cacheControl).toContain("private")
    expect(cacheControl).toContain("max-age=60")
  })

  it("should return hasAccess: false when getPremiumStatus catches an internal error", async () => {
    // getPremiumStatus has its own try/catch, so even if getServerSession throws,
    // the error is caught internally and returns { hasAccess: false } with status 200
    mockGetServerSession.mockRejectedValue(new Error("DB exploded"))
    const response = await GET()
    // Route returns 200 because getPremiumStatus swallows the error
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.hasAccess).toBe(false)
    expect(data.plan).toBeNull()
  })
})

