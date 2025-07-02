"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { getCountryFromDomain, getCountryPricing, type CountryPricing } from "@/lib/country-pricing"

interface CountryContextType {
  selectedCountry: string
  countryData: CountryPricing
  setSelectedCountry: (country: string) => void
  convertPrice: (basePrice: string | number) => string
  countries: Array<{
    id: string
    name: string
    currencyCode: string
    currencySymbol: string
  }>
}

const CountryContext = createContext<CountryContextType | undefined>(undefined)

export function CountryProvider({ children }: { children: ReactNode }) {
  const [selectedCountry, setSelectedCountry] = useState("us")
  const [countryData, setCountryData] = useState<CountryPricing>(() => ({
    code: "US",
    name: "United States",
    flag: "🇺🇸",
    currency: "USD",
    currencySymbol: "$",
    brandName: "US Sports Predictions",
    tagline: "America's Premier SnapBet",
    plans: {
      free: {
        name: "Free",
        price: "$0",
        features: ["3 free predictions daily", "Basic AI analysis", "Community access", "Mobile app access"]
      },
      vip: {
        name: "VIP",
        price: "$9.99",
        popular: true,
        features: [
          "Unlimited predictions",
          "Advanced AI analysis",
          "Confidence scores",
          "Priority support",
          "Historical data",
          "NFL & NBA coverage"
        ]
      },
      pro: {
        name: "Pro",
        price: "$24.99",
        features: [
          "Everything in VIP",
          "Multi-sport coverage",
          "Live predictions",
          "Custom strategies",
          "API access",
          "All major US sports"
        ]
      }
    },
    flexibleOptions: [
      { name: "Single Tip", price: "$2.99", description: "One premium prediction" },
      { name: "Weekend Package", price: "$9.99", description: "Weekend matches bundle" },
      { name: "Game Day Special", price: "$19.99", description: "Full day coverage" }
    ],
    paymentMethods: ["Credit Card", "PayPal", "Apple Pay", "Google Pay"],
    globalPaymentMethods: ["Visa/Mastercard", "PayPal", "Apple Pay", "Google Pay"],
    marketContext: "US sports betting market leader"
  }))

  // Define countries list
  const countries = [
    {
      id: "us",
      name: "United States",
      currencyCode: "USD",
      currencySymbol: "$"
    },
    {
      id: "ke",
      name: "Kenya",
      currencyCode: "KES",
      currencySymbol: "KES"
    },
    {
      id: "ng",
      name: "Nigeria",
      currencyCode: "NGN",
      currencySymbol: "₦"
    },
    {
      id: "za",
      name: "South Africa",
      currencyCode: "ZAR",
      currencySymbol: "R"
    },
    {
      id: "gh",
      name: "Ghana",
      currencyCode: "GHS",
      currencySymbol: "GH₵"
    },
    {
      id: "ug",
      name: "Uganda",
      currencyCode: "UGX",
      currencySymbol: "USh"
    },
    {
      id: "tz",
      name: "Tanzania",
      currencyCode: "TZS",
      currencySymbol: "TSh"
    }
  ]

  useEffect(() => {
    // Auto-detect country from domain on initial load
    if (typeof window !== "undefined") {
      const detectedCountry = getCountryFromDomain(window.location.hostname)
      if (detectedCountry) {
        setSelectedCountry(detectedCountry)
      }
    }
  }, [])

  useEffect(() => {
    // Update country data when selected country changes
    const data = getCountryPricing(selectedCountry)
    setCountryData(data)
  }, [selectedCountry])

  const convertPrice = (basePrice: string | number): string => {
    const price = typeof basePrice === "string" ? parseFloat(basePrice) : basePrice
    const rate = conversionRates[selectedCountry] || 1
    const convertedPrice = price * rate
    return `${countryData.currencySymbol}${convertedPrice.toFixed(2)}`
  }

  return (
    <CountryContext.Provider value={{ selectedCountry, countryData, setSelectedCountry, convertPrice, countries }}>
      {children}
    </CountryContext.Provider>
  )
}

export function useCountry() {
  const context = useContext(CountryContext)
  if (context === undefined) {
    throw new Error("useCountry must be used within a CountryProvider")
  }
  return context
}

// Conversion rates relative to USD
const conversionRates: Record<string, number> = {
  us: 1,
  ke: 130,
  ng: 1500,
  za: 18,
  gh: 12,
  ug: 3800,
  tz: 2600
}
