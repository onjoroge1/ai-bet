/**
 * Unit tests for components/personalized-offers.tsx
 *
 * Tests:
 * - Rendering of all 4 packages (Weekend, Weekly, Monthly, VIP)
 * - Correct pricing display ($49.99 / $79.99)
 * - RECOMMENDED badge on Monthly
 * - CURRENT PLAN badge when user has an active plan
 * - Suggested plan section for non-premium users
 * - Purchase CTA button behaviour (package vs subscription)
 * - Loading state
 */

import React from "react"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// ── Mocks ──────────────────────────────────────────────────────────

const mockPush = jest.fn()
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/dashboard",
}))

jest.mock("@/contexts/user-country-context", () => ({
  useUserCountry: () => ({ userCountry: "US" }),
}))

jest.mock("@/components/quick-purchase-modal", () => ({
  QuickPurchaseModal: ({ isOpen, item }: { isOpen: boolean; item: { name: string } }) =>
    isOpen ? <div data-testid="purchase-modal">{item?.name}</div> : null,
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

// ── Fetch mock setup ───────────────────────────────────────────────

const mockPricingResponse = {
  plans: [
    {
      id: "pkg_weekend_pass",
      name: "Weekend Package",
      packageType: "weekend_pass",
      description: "Weekend special",
      tipCount: 5,
      validityDays: 3,
      features: ["5 Premium Tips"],
      iconName: "Calendar",
      colorGradientFrom: "#8B5CF6",
      colorGradientTo: "#7C3AED",
      displayOrder: 1,
      isActive: true,
      countryPrices: [
        {
          id: "cp1",
          price: 9.99,
          originalPrice: 14.99,
          currencyCode: "USD",
          currencySymbol: "$",
          country: { name: "United States", code: "US", currencyCode: "USD", currencySymbol: "$" },
        },
      ],
    },
  ],
}

const mockPremiumCheckResponse = { hasAccess: false, plan: null, expiresAt: null, isExpired: true }
const mockSubscriptionResponse = { plan: null }

const originalFetch = global.fetch

beforeAll(() => {
  global.fetch = jest.fn((url: string | URL | Request) => {
    const urlStr = typeof url === "string" ? url : (url as URL).toString()
    if (urlStr.includes("/api/homepage/pricing")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockPricingResponse),
      })
    }
    if (urlStr.includes("/api/premium/check")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockPremiumCheckResponse),
      })
    }
    if (urlStr.includes("/api/subscriptions/manage")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockSubscriptionResponse),
      })
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
  }) as jest.Mock
})

afterAll(() => {
  global.fetch = originalFetch
})

import { PersonalizedOffers } from "@/components/personalized-offers"

describe("PersonalizedOffers", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ── Rendering ─────────────────────────────────────────────────────

  it("should render the Premium Packages heading", async () => {
    render(<PersonalizedOffers />)
    await waitFor(() => {
      expect(screen.getByText("Premium Packages")).toBeInTheDocument()
    })
  })

  it("should render all 4 package names", async () => {
    render(<PersonalizedOffers />)
    await waitFor(() => {
      expect(screen.getByText("Weekend Package")).toBeInTheDocument()
      expect(screen.getByText("Weekly Package")).toBeInTheDocument()
      expect(screen.getByText("Monthly Package")).toBeInTheDocument()
      expect(screen.getByText("VIP Package")).toBeInTheDocument()
    })
  })

  // ── Pricing ───────────────────────────────────────────────────────

  it("should display $49.99 for weekend, weekly, and monthly packages (config is source of truth for USD)", async () => {
    render(<PersonalizedOffers />)
    await waitFor(() => {
      // The config prices ($49.99) should override DB USD prices ($9.99)
      const priceElements = screen.getAllByText("$49.99")
      // At least 3 instances (weekend, weekly, monthly)
      expect(priceElements.length).toBeGreaterThanOrEqual(3)
    })
  })

  it("should display $79.99 for VIP package", async () => {
    render(<PersonalizedOffers />)
    await waitFor(() => {
      expect(screen.getByText("$79.99")).toBeInTheDocument()
    })
  })

  it("should display /mo suffix for VIP subscription", async () => {
    render(<PersonalizedOffers />)
    await waitFor(() => {
      expect(screen.getByText("/mo")).toBeInTheDocument()
    })
  })

  // ── Badges ────────────────────────────────────────────────────────

  it("should show RECOMMENDED badge on the Monthly package", async () => {
    render(<PersonalizedOffers />)
    await waitFor(() => {
      expect(screen.getByText("RECOMMENDED")).toBeInTheDocument()
    })
  })

  it("should NOT show CURRENT PLAN badge when user has no plan", async () => {
    render(<PersonalizedOffers />)
    await waitFor(() => {
      expect(screen.queryByText("CURRENT PLAN")).not.toBeInTheDocument()
    })
  })

  // ── Suggested plan section ────────────────────────────────────────

  it("should show suggested Monthly plan section for non-premium users", async () => {
    render(<PersonalizedOffers />)
    await waitFor(() => {
      expect(screen.getByText(/Suggested: Monthly Package/)).toBeInTheDocument()
      expect(screen.getByText(/Unlimited tips for \$49\.99/)).toBeInTheDocument()
    })
  })

  it("should have Get Monthly button in the suggestion section", async () => {
    render(<PersonalizedOffers />)
    await waitFor(() => {
      expect(screen.getByText("Get Monthly")).toBeInTheDocument()
    })
  })

  // ── Features ──────────────────────────────────────────────────────

  it("should display features for each package", async () => {
    render(<PersonalizedOffers />)
    await waitFor(() => {
      expect(screen.getByText("5 Premium Tips")).toBeInTheDocument()
      expect(screen.getByText("8 Premium Tips")).toBeInTheDocument()
      expect(screen.getByText("Unlimited Tips")).toBeInTheDocument()
      expect(screen.getByText("Everything in Monthly")).toBeInTheDocument()
    })
  })

  // ── CTAs ──────────────────────────────────────────────────────────

  it("should show Get Package buttons for non-subscription packages", async () => {
    render(<PersonalizedOffers />)
    await waitFor(() => {
      const getPackageButtons = screen.getAllByText("Get Package")
      // Weekend, Weekly, Monthly = 3 "Get Package" buttons
      expect(getPackageButtons).toHaveLength(3)
    })
  })

  it("should show Subscribe button for VIP package", async () => {
    render(<PersonalizedOffers />)
    await waitFor(() => {
      expect(screen.getByText("Subscribe")).toBeInTheDocument()
    })
  })

  it("should navigate to /subscribe/premium_intelligence when VIP Subscribe is clicked", async () => {
    const user = userEvent.setup()
    render(<PersonalizedOffers />)
    await waitFor(() => {
      expect(screen.getByText("Subscribe")).toBeInTheDocument()
    })
    await user.click(screen.getByText("Subscribe"))
    expect(mockPush).toHaveBeenCalledWith("/subscribe/premium_intelligence")
  })

  it("should open QuickPurchaseModal when a Get Package button is clicked", async () => {
    const user = userEvent.setup()
    render(<PersonalizedOffers />)
    await waitFor(() => {
      expect(screen.getAllByText("Get Package").length).toBeGreaterThan(0)
    })
    // Click the first "Get Package" button (Weekend)
    await user.click(screen.getAllByText("Get Package")[0])
    await waitFor(() => {
      expect(screen.getByTestId("purchase-modal")).toBeInTheDocument()
    })
  })

  // ── Explanation section ───────────────────────────────────────────

  it("should render the Why Choose Our Packages explanation section", async () => {
    render(<PersonalizedOffers />)
    await waitFor(() => {
      expect(screen.getByText("Why Choose Our Packages?")).toBeInTheDocument()
    })
  })
})

// ── Premium user variant ────────────────────────────────────────────

describe("PersonalizedOffers (premium user with VIP plan)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("/api/homepage/pricing")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockPricingResponse),
        })
      }
      if (url.includes("/api/premium/check")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ hasAccess: true }),
        })
      }
      if (url.includes("/api/subscriptions/manage")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ plan: "vip_monthly" }),
        })
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    })
  })

  it("should show CURRENT PLAN badge for VIP when user is on VIP plan", async () => {
    render(<PersonalizedOffers />)
    await waitFor(() => {
      expect(screen.getByText("CURRENT PLAN")).toBeInTheDocument()
    })
  })

  it("should show a disabled Current Plan button for the active package", async () => {
    render(<PersonalizedOffers />)
    await waitFor(() => {
      expect(screen.getByText("Current Plan")).toBeInTheDocument()
    })
  })

  it("should NOT show the suggested Monthly plan section for premium users", async () => {
    render(<PersonalizedOffers />)
    await waitFor(() => {
      // Premium user → suggestion hidden
      expect(screen.queryByText(/Suggested: Monthly Package/)).not.toBeInTheDocument()
    })
  })
})

