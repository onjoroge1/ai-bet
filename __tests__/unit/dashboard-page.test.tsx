/**
 * Unit tests for the main Dashboard page (app/dashboard/page.tsx)
 *
 * Tests:
 * - Rendering of page header with user name
 * - Quick action navigation cards
 * - Upgrade banner visibility based on URL params
 * - Loading/skeleton states
 * - Widget suspense boundaries
 */

import React from "react"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// ── Mocks ──────────────────────────────────────────────────────────

// Mock next/navigation
const mockPush = jest.fn()
const mockReplace = jest.fn()
let mockSearchParams = new URLSearchParams()

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, prefetch: jest.fn() }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => "/dashboard",
}))

// Mock next/dynamic to render children synchronously
jest.mock("next/dynamic", () => {
  return (loader: () => Promise<{ default: React.ComponentType }>, _opts?: Record<string, unknown>) => {
    const DynamicComponent = (props: Record<string, unknown>) => {
      const [Comp, setComp] = React.useState<React.ComponentType | null>(null)
      React.useEffect(() => {
        loader().then((mod) => setComp(() => (mod as { default: React.ComponentType }).default ?? mod))
      }, [])
      if (!Comp) return <div data-testid="widget-skeleton">Loading…</div>
      return <Comp {...props} />
    }
    DynamicComponent.displayName = "DynamicMock"
    return DynamicComponent
  }
})

// Mock useDashboardData hook
const mockDashboardData = {
  user: {
    id: "u1",
    email: "obadiah@test.com",
    fullName: "Obadiah Test",
    role: "user",
    memberSince: "2025-01-01",
    winStreak: 5,
    country: "US",
  },
  dashboard: {
    level: 3,
    progressToNextLevel: 45,
    predictionAccuracy: "72%",
    monthlySuccess: "65%",
    vipExpiryDate: null,
    subscriptionPlan: null,
  },
}

jest.mock("@/hooks/use-dashboard-data", () => ({
  useDashboardData: () => ({
    data: mockDashboardData,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
}))

// Mock dynamic child components so they render quickly
jest.mock("@/components/dashboard/stats-overview", () => ({
  StatsOverview: () => <div data-testid="stats-overview">StatsOverview</div>,
}))
jest.mock("@/components/dashboard/package-credits", () => ({
  PackageCredits: () => <div data-testid="package-credits">PackageCredits</div>,
}))
jest.mock("@/components/notifications-widget", () => ({
  NotificationsWidget: () => <div data-testid="notifications-widget">NotificationsWidget</div>,
}))
jest.mock("@/components/live-matches-widget", () => ({
  LiveMatchesWidget: () => <div data-testid="live-matches-widget">LiveMatchesWidget</div>,
}))
jest.mock("@/components/dashboard/ai-recommendations", () => ({
  AIRecommendations: () => <div data-testid="ai-recommendations">AIRecommendations</div>,
}))
jest.mock("@/components/dashboard/timeline-feed", () => ({
  TimelineFeed: () => <div data-testid="timeline-feed">TimelineFeed</div>,
}))
jest.mock("@/components/upgrade-offers", () => ({
  UpgradeOffers: () => <div data-testid="upgrade-offers">UpgradeOffers</div>,
}))
jest.mock("@/components/personalized-offers", () => ({
  PersonalizedOffers: () => <div data-testid="personalized-offers">PersonalizedOffers</div>,
}))

// Missing browser APIs for jsdom
Object.defineProperty(window.HTMLElement.prototype, "hasPointerCapture", {
  value: jest.fn(() => false),
})
Object.defineProperty(window.HTMLElement.prototype, "setPointerCapture", {
  value: jest.fn(),
})
Object.defineProperty(window.HTMLElement.prototype, "releasePointerCapture", {
  value: jest.fn(),
})

// Import after mocks
import DashboardPage from "@/app/dashboard/page"

describe("DashboardPage", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSearchParams = new URLSearchParams()
  })

  // ── Page header ──────────────────────────────────────────────────

  describe("Page header", () => {
    it("should render the welcome message with the user's first name", async () => {
      render(<DashboardPage />)
      await waitFor(() => {
        expect(screen.getByText(/Welcome back, Obadiah!/)).toBeInTheDocument()
      })
    })

    it("should display the win streak when > 0", async () => {
      render(<DashboardPage />)
      await waitFor(() => {
        expect(screen.getByText("5-win streak")).toBeInTheDocument()
      })
    })

    it("should display the prediction accuracy", async () => {
      render(<DashboardPage />)
      await waitFor(() => {
        expect(screen.getByText(/72% accuracy/)).toBeInTheDocument()
      })
    })

    it('should show "AI Active" badge', async () => {
      render(<DashboardPage />)
      await waitFor(() => {
        expect(screen.getByText("AI Active")).toBeInTheDocument()
      })
    })
  })

  // ── Quick Actions ─────────────────────────────────────────────────

  describe("Quick Actions", () => {
    it("should render 4 quick action cards", async () => {
      render(<DashboardPage />)
      await waitFor(() => {
        expect(screen.getByText("Browse Matches")).toBeInTheDocument()
        expect(screen.getByText("AI Parlays")).toBeInTheDocument()
        expect(screen.getByText("My Tips")).toBeInTheDocument()
        expect(screen.getByText("Daily Tips")).toBeInTheDocument()
      })
    })

    it("should link quick actions to correct dashboard routes", () => {
      const { container } = render(<DashboardPage />)
      const links = container.querySelectorAll("a")
      const hrefs = Array.from(links).map((l) => l.getAttribute("href"))

      expect(hrefs).toContain("/dashboard/matches")
      expect(hrefs).toContain("/dashboard/parlays")
      expect(hrefs).toContain("/dashboard/my-tips")
      expect(hrefs).toContain("/dashboard/daily-tips")
    })
  })

  // ── Upgrade banner ────────────────────────────────────────────────

  describe("Upgrade banner", () => {
    it("should NOT show upgrade banner by default", () => {
      render(<DashboardPage />)
      expect(screen.queryByText("Premium Required")).not.toBeInTheDocument()
    })

    it("should show upgrade banner when ?upgrade=true is set", async () => {
      mockSearchParams = new URLSearchParams("upgrade=true")
      render(<DashboardPage />)
      await waitFor(() => {
        expect(screen.getByText("Premium Required")).toBeInTheDocument()
      })
    })

    it("should contain a link to the pricing page when upgrade banner shows", async () => {
      mockSearchParams = new URLSearchParams("upgrade=true")
      const { container } = render(<DashboardPage />)
      await waitFor(() => {
        const pricingLink = container.querySelector('a[href*="/pricing"]')
        expect(pricingLink).toBeInTheDocument()
      })
    })

    it("should hide upgrade banner when dismiss button is clicked", async () => {
      const user = userEvent.setup()
      mockSearchParams = new URLSearchParams("upgrade=true")
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText("Premium Required")).toBeInTheDocument()
      })

      const dismissBtn = screen.getByLabelText("Dismiss")
      await user.click(dismissBtn)

      await waitFor(() => {
        expect(screen.queryByText("Premium Required")).not.toBeInTheDocument()
      })
    })
  })
})

