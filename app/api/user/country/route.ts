import { NextRequest, NextResponse } from "next/server"
import { getCountryFromRequest, getCountryPricing, isCountrySupported } from "@/lib/country-pricing"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    // Get user session to check if they have a country preference
    const session = await getServerSession(authOptions)
    
    // Get user's IP address
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown'
    
    // Get country from IP (optional - you can enable this in production)
    let ipCountryCode: string | undefined
    
    // Uncomment the following code to enable IP-based country detection
    // try {
    //   const response = await fetch(`https://ipapi.co/${ip}/json/`)
    //   const data = await response.json()
    //   ipCountryCode = data.country_code
    // } catch (error) {
    //   console.warn('Failed to detect country from IP:', error)
    // }
    
    // Get user's country preference from their profile
    const userCountryCode = session?.user?.country?.code
    
    // Detect country using the enhanced function
    const detectedCountry = await getCountryFromRequest(
      request.headers.get('host') || '',
      userCountryCode,
      ipCountryCode
    )
    
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
        detectedFrom: userCountryCode ? 'user_profile' : ipCountryCode ? 'ip_geolocation' : 'domain_or_default'
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