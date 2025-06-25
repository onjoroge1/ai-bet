import { NextResponse } from 'next/server'
import { getSupportedCountries, getCountryByCode } from '@/lib/countries'
import { NextRequest } from 'next/server'

// GET /api/countries - Public endpoint for signup form
export async function GET(request: NextRequest) {
  try {
    // Get supported countries from our comprehensive system
    const countries = getSupportedCountries()
    
    // If you want to sync with database, you can do that here
    // For now, we'll use the static system which is more reliable
    
    return NextResponse.json(countries)
  } catch (error) {
    console.error('Error fetching countries:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST /api/countries - For country detection
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { countryCode } = body

    if (!countryCode) {
      return NextResponse.json({ error: 'Country code is required' }, { status: 400 })
    }

    const country = getCountryByCode(countryCode)
    if (!country) {
      return NextResponse.json({ error: 'Invalid country code' }, { status: 400 })
    }

    return NextResponse.json(country)
  } catch (error) {
    console.error('Error processing country request:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
} 