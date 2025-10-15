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

          // Check localStorage for cached country data first
          const cachedCountry = localStorage.getItem('snapbet_user_country')
          const cachedTimestamp = localStorage.getItem('snapbet_country_timestamp')
          const cacheExpiry = 5 * 60 * 1000 // 5 minutes (reduced from 24 hours for better VPN responsiveness)
          
          // Check for force refresh parameter
          const urlParams = new URLSearchParams(window.location.search)
          const forceRefresh = urlParams.get('refresh_country') === 'true'
          
          // If force refresh is requested, clear the cache
          if (forceRefresh) {
            localStorage.removeItem('snapbet_user_country')
            localStorage.removeItem('snapbet_country_timestamp')
            console.log('Force refresh requested - cleared country cache')
          }

          if (cachedCountry && cachedTimestamp && 
              (Date.now() - parseInt(cachedTimestamp)) < cacheExpiry && !forceRefresh) {
            try {
              const parsedCountry = JSON.parse(cachedCountry)
              setUserCountry(parsedCountry.code)
              setCountryData(parsedCountry.pricing)
              setDetectedFrom("cache")
              setIsLoading(false)
              return
            } catch (e) {
              // Invalid cache, continue with API call
            }
          }

          // Try to detect country from API with timeout
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 3000) // 3 second timeout

          try {
            const response = await fetch('/api/user/country', {
              signal: controller.signal
            })
            clearTimeout(timeoutId)
            
            if (response.ok) {
              const result = await response.json()
              if (result.success) {
                const countryCode = result.country.code.toLowerCase()
                setUserCountry(countryCode)
                setCountryData(result.pricing)
                setDetectedFrom(result.country.detectedFrom)
                
                // Cache the result
                localStorage.setItem('snapbet_user_country', JSON.stringify({
                  code: countryCode,
                  pricing: result.pricing
                }))
                localStorage.setItem('snapbet_country_timestamp', Date.now().toString())
              } else {
                throw new Error('API returned unsuccessful result')
              }
            } else {
              throw new Error(`API returned ${response.status}`)
            }
          } catch (error) {
            clearTimeout(timeoutId)
            if (error.name === 'AbortError') {
              console.warn('Country detection API timed out, using fallback')
            } else {
              console.warn('Failed to detect country:', error)
            }
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