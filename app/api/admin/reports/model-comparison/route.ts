import { NextRequest, NextResponse } from 'next/server'

const BASE_URL = process.env.BACKEND_API_URL || process.env.BACKEND_URL
const API_KEY = process.env.BACKEND_API_KEY || process.env.NEXT_PUBLIC_MARKET_KEY || 'betgenius_secure_key_2024'

/**
 * GET /api/admin/reports/model-comparison?window=30d
 * Proxy to backend GET /performance/models
 */
export async function GET(request: NextRequest) {
  if (!BASE_URL) {
    return NextResponse.json({ error: 'Backend URL not configured' }, { status: 503 })
  }

  const window = request.nextUrl.searchParams.get('window') || '30d'

  try {
    const response = await fetch(`${BASE_URL}/performance/models?window=${window}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      next: { revalidate: 60 },
    })

    if (!response.ok) {
      const text = await response.text()
      return NextResponse.json({ error: 'Backend error', detail: text }, { status: response.status })
    }

    return NextResponse.json(await response.json())
  } catch (error: any) {
    console.error('[Model Comparison API]', error)
    return NextResponse.json({ error: 'Failed to fetch', detail: error.message }, { status: 500 })
  }
}
