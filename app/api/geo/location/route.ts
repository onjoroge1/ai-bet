import { NextRequest, NextResponse } from 'next/server'

// GET /api/geo/location - Get user's location based on IP
export async function GET(request: NextRequest) {
  try {
    // Get client IP address
    const forwarded = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const ip = forwarded?.split(',')[0] || realIp || '127.0.0.1'

    // For development, return a default location
    if (process.env.NODE_ENV === 'development' || ip === '127.0.0.1') {
      return NextResponse.json({
        success: true,
        data: {
          country: 'KE',
          countryName: 'Kenya',
          city: 'Nairobi',
          region: 'Nairobi',
          timezone: 'Africa/Nairobi',
          ip: ip
        }
      })
    }

    // Use a free IP geolocation service
    // In production, you might want to use a paid service like MaxMind or IP2Location
    try {
      const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,timezone,query`)
      const data = await response.json()

      if (data.status === 'success') {
        return NextResponse.json({
          success: true,
          data: {
            country: data.countryCode,
            countryName: data.country,
            city: data.city,
            region: data.regionName,
            timezone: data.timezone,
            ip: data.query
          }
        })
      } else {
        throw new Error('IP geolocation failed')
      }
    } catch (geoError) {
      console.error('Geo-location error:', geoError)
      
      // Fallback to default location
      return NextResponse.json({
        success: true,
        data: {
          country: 'worldwide',
          countryName: 'Worldwide',
          city: 'Unknown',
          region: 'Unknown',
          timezone: 'UTC',
          ip: ip
        }
      })
    }

  } catch (error) {
    console.error('Error detecting location:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to detect location' },
      { status: 500 }
    )
  }
} 