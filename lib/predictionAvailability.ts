// lib/predictionAvailability.ts
export type AvailabilityItem = {
  match_id: number
  enrich: boolean // true => call /predict
  reason: string
  bookmakers?: number
  time_bucket?: '3h'|'6h'|'12h'|'24h'|'48h'|'72h'|null
  last_updated?: string // ISO; use in cache key versioning
  min_secs_to_kickoff?: number
}

export type AvailabilityResponse = {
  availability: AvailabilityItem[]
  meta: {
    requested: number
    deduped: number
    enrich_true: number
    enrich_false: number
    failure_breakdown: Record<string, any>
  }
}

export async function fetchAvailability(matchIds: number[], trigger = true, stalenessHours = 168): Promise<AvailabilityResponse> {
  const requestBody = { 
    match_ids: matchIds, 
    trigger_consensus: trigger, 
    staleness_hours: stalenessHours 
  }
  
  console.log('[FETCH_AVAILABILITY] Making request:', {
    url: `${process.env.BACKEND_URL}/predict/availability`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.BACKEND_API_KEY!}`
    },
    body: requestBody
  })
  
  const res = await fetch(`${process.env.BACKEND_URL}/predict/availability`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.BACKEND_API_KEY!}`
    },
    body: JSON.stringify(requestBody)
  })
  
  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`availability failed: ${res.status} - ${errorText}`)
  }
  
  const data = await res.json()
  return data as AvailabilityResponse
}

// Helper function to partition availability results
export function partitionAvailability(items: AvailabilityItem[]) {
  const ready: number[] = []
  const waiting: AvailabilityItem[] = []
  const noOdds: AvailabilityItem[] = []
  
  for (const item of items) {
    if (item.enrich) {
      ready.push(item.match_id)
    } else if (item.reason === 'waiting_consensus' || item.reason === 'collecting_odds') {
      waiting.push(item)
    } else {
      noOdds.push(item)
    }
  }
  
  return { ready, waiting, noOdds }
}
