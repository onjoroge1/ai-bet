// Utility to decode optimized data structure back to frontend-compatible format

interface OptimizedData {
  m: Record<string, any> // matches
  pr: Record<string, any> // predictions
  c: Record<string, any> // countries
  i: any[] // items
}

interface DecodedItem {
  id: string
  name: string
  price: number
  originalPrice?: number
  type: string
  matchId?: string
  country?: {
    currencyCode: string
    currencySymbol: string
  }
  confidenceScore?: number
  odds?: number
  valueRating?: string
  isActive: boolean
  createdAt: string
  matchData?: any
  predictionData?: any
}

// Decode abbreviated keys back to full names
function decodeKeys(obj: any): any {
  const keyMap: Record<string, string> = {
    'pt': 'predictionType',
    'cs': 'confidenceScore',
    'as': 'analysisSummary',
    'ipa': 'isPredictionActive',
    'ca': 'createdAt',
    'ua': 'updatedAt',
    'op': 'originalPrice',
    'vr': 'valueRating',
    'cc': 'currencyCode',
    'do': 'displayOrder',
    'dp': 'discountPercentage',
    'iu': 'isUrgent',
    'ip': 'isPopular',
    'tl': 'timeLeft',
    'tlk': 'targetLink',
    'in': 'iconName',
    'cgf': 'colorGradientFrom',
    'cgt': 'colorGradientTo',
    'md': 'matchData',
    'pd': 'predictionData',
    'ht': 'home_team',
    'at': 'away_team',
    'if': 'is_finished',
    'ss': 'status_short',
    'pr': 'prediction_ready',
    // Optimized structure keys
    'n': 'name',
    'p': 'price',
    't': 'type',
    'mi': 'matchId',
    'o': 'odds',
    'ia': 'isActive',
    'd': 'date',
    'v': 'venue',
    'l': 'league',
    's': 'status',
    'cl': 'confidence_level',
    'ro': 'recommended_outcome',
    'ml': 'ml_prediction',
    'pb': 'primary_bet'
  }

  if (Array.isArray(obj)) {
    return obj.map(decodeKeys)
  }
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [
        keyMap[k] || k,
        decodeKeys(v)
      ])
    )
  }
  return obj
}

// Decode optimized data structure to frontend-compatible format
export function decodeOptimizedData(optimizedData: OptimizedData): DecodedItem[] {
  const { m: matches, pr: predictions, c: countries, i: items } = optimizedData

  return items.map(item => {
    const decodedItem: DecodedItem = {
      id: item.id,
      name: item.n,
      price: item.p,
      originalPrice: item.op,
      type: item.t,
      matchId: item.mi,
      country: {
        currencyCode: item.cc,
        currencySymbol: countries[item.cc]?.s || '$'
      },
      confidenceScore: item.cs,
      odds: item.o,
      valueRating: item.vr,
      isActive: item.ia,
      createdAt: item.ca
    }

    // Add match data if available
    if (item.mi && matches[item.mi]) {
      const match = matches[item.mi]
      decodedItem.matchData = {
        date: match.d,
        venue: match.v,
        league: match.l,
        home_team: match.ht,
        away_team: match.at,
        status: match.s,
        status_short: match.s,
        match_id: item.mi,
        is_finished: false,
        is_upcoming: true,
        prediction_ready: true
      }
    }

    // Add prediction data if available
    if (item.mi && predictions[item.mi]) {
      const pred = predictions[item.mi]
      decodedItem.predictionData = {
        source: 'backend',
        match_id: item.mi,
        prediction: {
          comprehensive_analysis: {
            ai_verdict: {
              confidence_level: pred.cl,
              recommended_outcome: pred.ro,
              probability_assessment: pred.p
            },
            ml_prediction: pred.ml,
            betting_intelligence: {
              primary_bet: pred.pb
            }
          }
        }
      }
    }

    return decodedItem
  })
}

// Legacy support: handle both optimized and non-optimized data
export function decodeQuickPurchasesData(data: any): DecodedItem[] {
  // Check if data is in optimized format
  if (data && typeof data === 'object' && data.m && data.pr && data.c && data.i) {
    return decodeOptimizedData(data)
  }
  
  // If it's already in legacy format, return as-is
  if (Array.isArray(data)) {
    return data
  }
  
  // Fallback
  return []
} 