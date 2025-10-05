import { NextRequest, NextResponse } from 'next/server'

// GET /api/geo/location - Get user's location based on IP
export async function GET(request: NextRequest) {
  try {
    // Get client IP address - prioritize forwarded headers for VPN detection
    const forwarded = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const cfConnectingIp = request.headers.get('cf-connecting-ip') // Cloudflare
    const xRealIp = request.headers.get('x-real-ip')
    
    // Use the first available real IP, fallback to localhost only if none available
    const ip = forwarded?.split(',')[0] || 
               cfConnectingIp || 
               realIp || 
               xRealIp || 
               '127.0.0.1'

    console.log('Geo-location API - IP detection:', {
      forwarded,
      cfConnectingIp,
      realIp,
      xRealIp,
      finalIp: ip
    })

    // Only use hardcoded fallback for true localhost, not VPN traffic
    if (ip === '127.0.0.1' || ip === '::1') {
      console.log('Using localhost fallback')
      return NextResponse.json({
        success: true,
        data: {
          country: 'US',
          countryName: 'United States',
          city: 'Local',
          region: 'Local',
          timezone: 'America/New_York',
          ip: ip
        }
      })
    }

    // For localhost development, try to get the real external IP first
    if (ip === '127.0.0.1' || ip === '::1') {
      try {
        console.log('Localhost detected, trying to get real external IP...')
        // Try to get the real external IP using a service
        const externalIpResponse = await fetch('https://api.ipify.org?format=json')
        const externalIpData = await externalIpResponse.json()
        const realExternalIp = externalIpData.ip
        
        console.log('Real external IP detected:', realExternalIp)
        
        // Now use the real external IP for geolocation
        const response = await fetch(`http://ip-api.com/json/${realExternalIp}?fields=status,message,country,countryCode,region,regionName,city,timezone,query`)
        const data = await response.json()

        if (data.status === 'success') {
          console.log('Geolocation successful with external IP:', data)
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
        }
      } catch (externalIpError) {
        console.warn('Failed to get external IP, using localhost fallback:', externalIpError)
      }
      
      // Fallback to US for localhost
      return NextResponse.json({
        success: true,
        data: {
          country: 'US',
          countryName: 'United States',
          city: 'Local',
          region: 'Local',
          timezone: 'America/New_York',
          ip: ip
        }
      })
    }

    // Use a free IP geolocation service for non-localhost IPs
    try {
      console.log('Using IP geolocation for:', ip)
      const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,timezone,query`)
      const data = await response.json()

      if (data.status === 'success') {
        console.log('Geolocation successful:', data)
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