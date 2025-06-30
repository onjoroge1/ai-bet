import { NextResponse, NextRequest } from 'next/server'
import { getCountryByCode } from '@/lib/countries'
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// GET /api/countries - Public endpoint for signup form
export async function GET() {
  try {
    const countries = await prisma.country.findMany({
      orderBy: { name: "asc" }
    })
    
    return NextResponse.json(countries)
  } catch (error) {
    console.error("Error fetching countries:", error)
    return NextResponse.json({ error: "Failed to fetch countries" }, { status: 500 })
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