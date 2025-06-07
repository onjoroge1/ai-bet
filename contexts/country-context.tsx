"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { getCountryFromDomain, getCountryPricing, type CountryPricing } from "@/lib/country-pricing"

interface CountryContextType {
  selectedCountry: string
  countryData: CountryPricing
  setSelectedCountry: (country: string) => void
  convertPrice: (basePrice: string | number) => string
}

const CountryContext = createContext<CountryContextType | undefined>(undefined)

export function CountryProvider({ children }: { children: ReactNode }) {
  const [selectedCountry, setSelectedCountry] = useState("kenya")

  useEffect(() => {
    // Auto-detect country from domain on initial load
    if (typeof window !== "undefined") {
      const detectedCountry = getCountryFromDomain(window.location.hostname)
      setSelectedCountry(detectedCountry)
    }
  }, [])

  const countryData = getCountryPricing(selectedCountry)

  // Currency conversion rates (base: KES)
  const conversionRates: Record<string, { rate: number; symbol: string }> = {
    kenya: { rate: 1, symbol: "KES" },
    nigeria: { rate: 32, symbol: "₦" },
    "south-africa": { rate: 12, symbol: "R" },
    uganda: { rate: 12, symbol: "UGX" },
    tanzania: { rate: 6.7, symbol: "TSH" },
    ghana: { rate: 0.73, symbol: "GHS" },
  }

  const convertPrice = (basePrice: string | number): string => {
    const numericPrice = typeof basePrice === "string" ? Number.parseInt(basePrice.replace(/[^\d]/g, "")) : basePrice

    const conversion = conversionRates[selectedCountry] || conversionRates.kenya
    const localPrice = Math.round(numericPrice * conversion.rate)

    return `${conversion.symbol} ${localPrice.toLocaleString()}`
  }

  return (
    <CountryContext.Provider
      value={{
        selectedCountry,
        countryData,
        setSelectedCountry,
        convertPrice,
      }}
    >
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
