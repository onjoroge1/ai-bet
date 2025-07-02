"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { useAuth } from "@/components/auth-provider"
import { getCountryPricing, type CountryPricing } from "@/lib/country-pricing"
import { getCountryPricing as getEnvPricing, formatPrice } from "@/lib/pricing-service"

interface UserCountryContextType {
  userCountry: string
  countryData: CountryPricing
  convertPrice: (basePrice: string | number) => string
  isLoading: boolean
  detectedFrom: string
}

const UserCountryContext = createContext<UserCountryContextType | undefined>(undefined)

export function UserCountryProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const [userCountry, setUserCountry] = useState("us") // Default fallback
  const [countryData, setCountryData] = useState<CountryPricing>(getCountryPricing("us"))
  const [isLoading, setIsLoading] = useState(true)
  const [detectedFrom, setDetectedFrom] = useState("default")

  useEffect(() => {
    const detectCountry = async () => {
      try {
        // Wait for auth to finish loading
        if (authLoading) {
          return
        }

        // If user is authenticated and has a country preference, use that
        if (isAuthenticated && user?.country?.code) {
          const countryCode = user.country.code.toLowerCase()
          setUserCountry(countryCode)
          
          // Get the pricing data (may fallback to US pricing)
          const pricingData = getCountryPricing(countryCode)
          
          // But preserve the user's actual country information
          const actualCountryData = {
            ...pricingData,
            name: user.country.name || pricingData.name,
            flag: user.country.flagEmoji || pricingData.flag,
            currencyCode: user.country.currencyCode || pricingData.currency,
            currencySymbol: user.country.currencySymbol || pricingData.currencySymbol
          }
          
          setCountryData(actualCountryData)
          setDetectedFrom("user_profile")
          setIsLoading(false)
          return
        }

        // If user is authenticated but doesn't have country data yet, 
        // the user profile might still be loading. Don't fall back to API detection yet.
        if (isAuthenticated && !user?.country?.code) {
          // Keep waiting for the user profile to be fully loaded
          // The effect will re-run when user.country.code becomes available
          return
        }

        // Only do API detection if user is not authenticated
        if (!isAuthenticated) {
          // Check if we're in a browser environment (not during build)
          if (typeof window === 'undefined') {
            // During build time, use default values
            setUserCountry("us")
            setCountryData(getCountryPricing("us"))
            setDetectedFrom("build_time")
            setIsLoading(false)
            return
          }

          // Try to detect country from API
          const response = await fetch('/api/user/country')
          if (response.ok) {
            const result = await response.json()
            if (result.success) {
              const countryCode = result.country.code.toLowerCase()
              setUserCountry(countryCode)
              setCountryData(result.pricing)
              setDetectedFrom(result.country.detectedFrom)
            } else {
              // Fallback to US
              setUserCountry("us")
              setCountryData(getCountryPricing("us"))
              setDetectedFrom("fallback")
            }
          } else {
            // Fallback to US
            setUserCountry("us")
            setCountryData(getCountryPricing("us"))
            setDetectedFrom("fallback")
          }
        }
      } catch (error) {
        console.warn('Failed to detect country:', error)
        // Fallback to US
        setUserCountry("us")
        setCountryData(getCountryPricing("us"))
        setDetectedFrom("fallback")
      } finally {
        setIsLoading(false)
      }
    }

    detectCountry()
  }, [isAuthenticated, user?.country?.code, authLoading])

  const convertPrice = (basePrice: string | number): string => {
    const price = typeof basePrice === "string" ? parseFloat(basePrice) : basePrice
    
    // Always use the API price and format it with the user's country currency
    // This ensures the UI displays the correct price from the database
    return formatPrice(price, countryData.currencySymbol, countryData.currency)
  }

  return (
    <UserCountryContext.Provider value={{ userCountry, countryData, convertPrice, isLoading, detectedFrom }}>
      {children}
    </UserCountryContext.Provider>
  )
}

export function useUserCountry() {
  const context = useContext(UserCountryContext)
  if (context === undefined) {
    throw new Error("useUserCountry must be used within a UserCountryProvider")
  }
  return context
} 