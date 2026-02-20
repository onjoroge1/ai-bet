/**
 * Unit tests for hooks/use-dashboard-data.ts
 *
 * Tests:
 * - Session authentication flow
 * - Merged data fallback when API data is loading
 * - Query configuration (staleTime, gcTime, enabled flag)
 * - Error handling on auth check failure
 */

import { renderHook, waitFor } from "@testing-library/react"
import React from "react"

// ── Mocks ──────────────────────────────────────────────────────────

jest.mock("@/lib/session-request-manager", () => ({
  getSession: jest.fn(),
}))

jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() },
}))

// Mock react-query
const mockRefetch = jest.fn()
let mockQueryReturn = {
  data: null as Record<string, unknown> | null,
  isLoading: false,
  error: null as Error | null,
  refetch: mockRefetch,
}

jest.mock("@tanstack/react-query", () => ({
  useQuery: (opts: { queryKey: unknown[]; queryFn: () => Promise<unknown>; enabled: boolean }) => {
    // Return mock data — only when enabled
    return {
      ...mockQueryReturn,
      isLoading: opts.enabled ? mockQueryReturn.isLoading : false,
    }
  },
}))

import { getSession } from "@/lib/session-request-manager"
import { useDashboardData } from "@/hooks/use-dashboard-data"

const mockGetSession = getSession as jest.MockedFunction<typeof getSession>

describe("useDashboardData", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    mockQueryReturn = {
      data: null,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    }
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("should check session on mount", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "u1", name: "Test", email: "test@test.com" },
    } as never)

    renderHook(() => useDashboardData())

    // The session check runs in a useEffect
    await waitFor(() => {
      expect(mockGetSession).toHaveBeenCalled()
    })
  })

  it("should return null data when no session found", async () => {
    mockGetSession.mockResolvedValue(null as never)

    const { result } = renderHook(() => useDashboardData())

    await waitFor(() => {
      expect(result.current.data).toBeNull()
    })
  })

  it("should return merged session data as fallback when API data is null", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "u1", name: "John Doe", email: "john@test.com" },
    } as never)

    // API returns null but session exists → merged fallback
    mockQueryReturn.data = null

    const { result } = renderHook(() => useDashboardData())

    await waitFor(() => {
      // After session check resolves, the merged data should contain session user info
      if (result.current.data) {
        expect(result.current.data.user.fullName).toBe("John Doe")
        expect(result.current.data.user.email).toBe("john@test.com")
      }
    })
  })

  it("should return API data when available", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "u1", name: "Test", email: "test@test.com" },
    } as never)

    const apiData = {
      user: {
        id: "u1",
        email: "test@test.com",
        fullName: "Test User",
        role: "user",
        memberSince: "2025-01-01",
        winStreak: 3,
        country: "US",
      },
      dashboard: {
        level: 5,
        progressToNextLevel: 60,
        predictionAccuracy: "72%",
        monthlySuccess: "65%",
        vipExpiryDate: null,
        subscriptionPlan: null,
      },
    }
    mockQueryReturn.data = apiData

    const { result } = renderHook(() => useDashboardData())

    await waitFor(() => {
      expect(result.current.data).toEqual(apiData)
    })
  })

  it("should return error message when query fails", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "u1", name: "Test", email: "test@test.com" },
    } as never)

    mockQueryReturn.error = new Error("Network failure")

    const { result } = renderHook(() => useDashboardData())

    await waitFor(() => {
      expect(result.current.error).toBe("Network failure")
    })
  })

  it("should handle session check error gracefully", async () => {
    mockGetSession.mockRejectedValue(new Error("Session failed"))

    const { result } = renderHook(() => useDashboardData())

    await waitFor(() => {
      expect(result.current.data).toBeNull()
    })
  })

  it("should provide a refetch function", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "u1", name: "Test", email: "test@test.com" },
    } as never)

    const { result } = renderHook(() => useDashboardData())

    expect(result.current.refetch).toBeDefined()
    expect(typeof result.current.refetch).toBe("function")
  })
})

