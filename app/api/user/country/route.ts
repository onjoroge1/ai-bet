import { NextRequest, NextResponse } from "next/server"
import { getCountryPricing } from "@/lib/country-pricing"
import prisma from "@/lib/db"

// Helper function to check if country is supported
function isCountrySupported(countryCode: string): boolean {
  // For now, assume all countries are supported
  // This can be enhanced to check against a list of supported countries
  return true
}

export async function GET(request: NextRequest) {
  try {
    // For guest users, use ONLY geolocation - no user session needed
    console.log('Guest user country detection - using geolocation only')
    
    // Get country from IP using our geo-location API
    let ipCountryCode: string | undefined
    
    try {
      // Use our internal geo-location API
      const geoResponse = await fetch(`${request.nextUrl.origin}/api/geo/location`)
      
      if (geoResponse.ok) {
        const geoData = await geoResponse.json()
        if (geoData.success && geoData.data.country) {
          ipCountryCode = geoData.data.country
          console.log('Guest user - IP geolocation detected country:', ipCountryCode)
        }
      }
    } catch (error) {
      console.warn('Guest user - Failed to detect country from IP:', error)
    }
    
    // Use geolocation result or fallback to US
    let detectedCountry: string
    
    if (ipCountryCode) {
      try {
        // Look up country in database dynamically
        const country = await prisma.country.findFirst({
          where: {
            code: {
              equals: ipCountryCode,
              mode: 'insensitive'
            },
            isActive: true
          }
        })
        
        if (country) {
          detectedCountry = country.code.toLowerCase()
          console.log('Guest user - using geolocation from database:', detectedCountry)
        } else {
          // Country not supported in database, use US fallback
          detectedCountry = 'us'
          console.log('Guest user - unsupported country in database, using US fallback')
        }
      } catch (dbError) {
        console.warn('Database lookup failed, using US fallback:', dbError)
        detectedCountry = 'us'
      }
    } else {
      detectedCountry = 'us' // Fallback if geolocation fails
      console.log('Guest user - geolocation failed, using US fallback')
    }
    
    // Get the country pricing data
    const countryData = getCountryPricing(detectedCountry)
    
    return NextResponse.json({
      success: true,
      country: {
        code: countryData.code,
        name: countryData.name,
        flag: countryData.flag,
        currency: countryData.currency,
        currencySymbol: countryData.currencySymbol,
        isSupported: isCountrySupported(detectedCountry),
        detectedFrom: ipCountryCode ? 'ip_geolocation' : 'fallback'
      },
      pricing: countryData
    })
    
  } catch (error) {
    console.error('Error detecting country:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to detect country',
        country: {
          code: 'US',
          name: 'United States',
          flag: '🇺🇸',
          currency: 'USD',
          currencySymbol: '$',
          isSupported: true,
          detectedFrom: 'fallback'
        }
      },
      { status: 500 }
    )
  }
} 