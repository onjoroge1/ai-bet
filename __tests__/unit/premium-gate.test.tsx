/**
 * Unit tests for components/premium-gate.tsx
 *
 * Validates the premium gate overlay that blocks non-premium users from
 * accessing protected dashboard routes (VIP, Analytics, CLV, Parlays).
 */

import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// ── Mocks ──────────────────────────────────────────────────────────

const mockRouterBack = jest.fn()
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: mockRouterBack,
    prefetch: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/dashboard/vip",
}))

// Missing browser APIs for jsdom
Object.defineProperty(window.HTMLElement.prototype, "hasPointerCapture", {
  value: jest.fn(() => false),
  configurable: true,
})
Object.defineProperty(window.HTMLElement.prototype, "setPointerCapture", {
  value: jest.fn(),
  configurable: true,
})
Object.defineProperty(window.HTMLElement.prototype, "releasePointerCapture", {
  value: jest.fn(),
  configurable: true,
})

// Mock fetch for premium check
const originalFetch = global.fetch
let mockFetchResponse: { ok: boolean; json: () => Promise<unknown> }

beforeAll(() => {
  global.fetch = jest.fn(() => Promise.resolve(mockFetchResponse)) as jest.Mock
})
afterAll(() => {
  global.fetch = originalFetch
})

import { PremiumGate } from "@/components/premium-gate"

describe("PremiumGate", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ── Loading state ─────────────────────────────────────────────────

  it("should show loading state initially", () => {
    mockFetchResponse = {
      ok: true,
      json: () => new Promise(() => {}), // Never resolves
    }
    render(<PremiumGate />)
    expect(screen.getByText("Loading...")).toBeInTheDocument()
  })

  // ── User has access ───────────────────────────────────────────────

  it("should render nothing when user has premium access", async () => {
    mockFetchResponse = {
      ok: true,
      json: () => Promise.resolve({ hasAccess: true }),
    }
    const { container } = render(<PremiumGate />)
    await waitFor(() => {
      // The component returns null when user has access
      expect(container.querySelector(".container")).toBeNull()
    })
  })

  // ── User does NOT have access ─────────────────────────────────────

  it("should display gate UI when user does NOT have premium access", async () => {
    mockFetchResponse = {
      ok: true,
      json: () => Promise.resolve({ hasAccess: false }),
    }
    render(<PremiumGate />)
    await waitFor(() => {
      expect(screen.getByText("Premium Feature")).toBeInTheDocument()
      expect(
        screen.getByText("This feature requires an active premium subscription.")
      ).toBeInTheDocument()
    })
  })

  it("should display custom title and description props", async () => {
    mockFetchResponse = {
      ok: true,
      json: () => Promise.resolve({ hasAccess: false }),
    }
    render(
      <PremiumGate
        title="VIP Only"
        description="Upgrade to unlock VIP Intelligence Feed."
        featureName="VIP Intelligence Feed"
      />
    )
    await waitFor(() => {
      expect(screen.getByText("VIP Only")).toBeInTheDocument()
      expect(
        screen.getByText("Upgrade to unlock VIP Intelligence Feed.")
      ).toBeInTheDocument()
      expect(screen.getByText(/Access to VIP Intelligence Feed/)).toBeInTheDocument()
    })
  })

  it("should contain a link to /pricing", async () => {
    mockFetchResponse = {
      ok: true,
      json: () => Promise.resolve({ hasAccess: false }),
    }
    const { container } = render(<PremiumGate />)
    await waitFor(() => {
      const pricingLink = container.querySelector('a[href="/pricing"]')
      expect(pricingLink).toBeInTheDocument()
    })
  })

  it("should show View Premium Plans button", async () => {
    mockFetchResponse = {
      ok: true,
      json: () => Promise.resolve({ hasAccess: false }),
    }
    render(<PremiumGate />)
    await waitFor(() => {
      expect(screen.getByText("View Premium Plans")).toBeInTheDocument()
    })
  })

  it("should show Go Back button that calls router.back()", async () => {
    const user = userEvent.setup()
    mockFetchResponse = {
      ok: true,
      json: () => Promise.resolve({ hasAccess: false }),
    }
    render(<PremiumGate />)
    await waitFor(() => {
      expect(screen.getByText("Go Back")).toBeInTheDocument()
    })
    await user.click(screen.getByText("Go Back"))
    expect(mockRouterBack).toHaveBeenCalled()
  })

  it("should contain a link to /dashboard/support", async () => {
    mockFetchResponse = {
      ok: true,
      json: () => Promise.resolve({ hasAccess: false }),
    }
    const { container } = render(<PremiumGate />)
    await waitFor(() => {
      const supportLink = container.querySelector('a[href="/dashboard/support"]')
      expect(supportLink).toBeInTheDocument()
    })
  })

  it("should list subscription benefits", async () => {
    mockFetchResponse = {
      ok: true,
      json: () => Promise.resolve({ hasAccess: false }),
    }
    render(<PremiumGate />)
    await waitFor(() => {
      expect(screen.getByText("Premium Subscription Benefits")).toBeInTheDocument()
      expect(screen.getByText("Monthly recurring subscription")).toBeInTheDocument()
      expect(screen.getByText("Cancel anytime")).toBeInTheDocument()
      expect(screen.getByText("Priority support")).toBeInTheDocument()
    })
  })

  // ── Error handling ────────────────────────────────────────────────

  it("should show gate UI when fetch fails (safe fallback)", async () => {
    mockFetchResponse = { ok: false, json: () => Promise.resolve({}) }
    render(<PremiumGate />)
    await waitFor(() => {
      // When API fails, the component defaults to no access → shows gate
      expect(screen.getByText("Premium Feature")).toBeInTheDocument()
    })
  })

  it("should show gate UI when fetch throws a network error", async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"))
    render(<PremiumGate />)
    await waitFor(() => {
      expect(screen.getByText("Premium Feature")).toBeInTheDocument()
    })
  })
})

