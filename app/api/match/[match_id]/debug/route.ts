import { NextRequest, NextResponse } from 'next/server'

const BASE_URL = process.env.BACKEND_API_URL || process.env.BACKEND_URL
const API_KEY = process.env.BACKEND_API_KEY || process.env.NEXT_PUBLIC_MARKET_KEY || "betgenius_secure_key_2024"

/**
 * Debug endpoint to check what the backend API is returning
 * GET /api/match/[match_id]/debug
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ match_id: string }> }
) {
  const resolvedParams = await params
  const matchId = resolvedParams.match_id

  if (!BASE_URL) {
    return NextResponse.json({
      error: 'Backend URL not configured',
      backend_url: BASE_URL
    }, { status: 500 })
  }

  const diagnostics = {
    match_id: matchId,
    timestamp: new Date().toISOString(),
    backend_url: BASE_URL,
    checks: {} as Record<string, any>
  }

  // Check 1: Live endpoint
  try {
    const liveUrl = `${BASE_URL}/market?match_id=${matchId}&status=live`
    const liveResponse = await fetch(liveUrl, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
      },
      cache: 'no-store'
    })

    const liveData = liveResponse.ok ? await liveResponse.json() : null
    const match = liveData?.matches?.[0]

    diagnostics.checks.live_endpoint = {
      url: liveUrl,
      status: liveResponse.status,
      statusText: liveResponse.statusText,
      hasData: !!match,
      match_status: match?.status,
      score: match?.live_data?.current_score,
      minute: match?.live_data?.minute,
      timestamp_in_data: match?.live_data?.timestamp || match?.timestamp,
      momentum: match?.momentum ? {
        home: match.momentum.home,
        away: match.momentum.away,
        minute: match.momentum.minute
      } : null,
      has_model_markets: !!match?.model_markets,
      model_markets_updated_at: match?.model_markets?.updated_at,
      raw_match_keys: match ? Object.keys(match) : []
    }
  } catch (error) {
    diagnostics.checks.live_endpoint = {
      error: error instanceof Error ? error.message : String(error)
    }
  }

  // Check 2: General endpoint (no status filter)
  try {
    const generalUrl = `${BASE_URL}/market?match_id=${matchId}`
    const generalResponse = await fetch(generalUrl, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
      },
      cache: 'no-store'
    })

    const generalData = generalResponse.ok ? await generalResponse.json() : null
    const match = generalData?.matches?.[0]

    diagnostics.checks.general_endpoint = {
      url: generalUrl,
      status: generalResponse.status,
      hasData: !!match,
      match_status: match?.status,
      score: match?.live_data?.current_score || match?.score,
      timestamp_in_data: match?.live_data?.timestamp || match?.timestamp,
      has_live_data: !!match?.live_data,
      has_momentum: !!match?.momentum,
      raw_match_keys: match ? Object.keys(match) : []
    }
  } catch (error) {
    diagnostics.checks.general_endpoint = {
      error: error instanceof Error ? error.message : String(error)
    }
  }

  // Check 3: Compare both responses
  const liveMatch = diagnostics.checks.live_endpoint?.hasData 
    ? (await fetch(`${BASE_URL}/market?match_id=${matchId}&status=live`, {
        headers: { Authorization: `Bearer ${API_KEY}` },
        cache: 'no-store'
      }).then(r => r.json())).matches?.[0]
    : null

  const generalMatch = diagnostics.checks.general_endpoint?.hasData
    ? (await fetch(`${BASE_URL}/market?match_id=${matchId}`, {
        headers: { Authorization: `Bearer ${API_KEY}` },
        cache: 'no-store'
      }).then(r => r.json())).matches?.[0]
    : null

  if (liveMatch && generalMatch) {
    const liveScore = liveMatch.live_data?.current_score || liveMatch.score
    const generalScore = generalMatch.live_data?.current_score || generalMatch.score
    
    diagnostics.checks.comparison = {
      scores_match: JSON.stringify(liveScore) === JSON.stringify(generalScore),
      live_score: liveScore,
      general_score: generalScore,
      live_timestamp: liveMatch.live_data?.timestamp || liveMatch.timestamp,
      general_timestamp: generalMatch.live_data?.timestamp || generalMatch.timestamp,
      is_live_data_newer: (liveMatch.live_data?.timestamp || liveMatch.timestamp) > 
                         (generalMatch.live_data?.timestamp || generalMatch.timestamp)
    }
  }

  // Check 4: Data freshness analysis
  if (liveMatch) {
    const timestamp = liveMatch.live_data?.timestamp || liveMatch.timestamp
    if (timestamp) {
      const dataAge = Date.now() - new Date(timestamp).getTime()
      diagnostics.checks.freshness = {
        data_timestamp: timestamp,
        current_time: new Date().toISOString(),
        age_seconds: Math.round(dataAge / 1000),
        age_minutes: Math.round(dataAge / 60000),
        is_stale: dataAge > 300000, // 5 minutes
        is_very_stale: dataAge > 3600000 // 1 hour
      }
    }
  }

  return NextResponse.json(diagnostics, {
    headers: {
      'Cache-Control': 'no-store'
    }
  })
}



