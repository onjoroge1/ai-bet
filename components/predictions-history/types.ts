// TypeScript interfaces for Predictions History (Public)

export interface Prediction {
  id: string
  match: {
    id: string
    homeTeam: {
      id: string
      name: string
    }
    awayTeam: {
      id: string
      name: string
    }
    league: {
      id: string
      name: string
    }
    matchDate: string
    status: string
    homeScore?: number
    awayScore?: number
  }
  predictionType: string
  confidenceScore: number
  odds: number
  valueRating: string
  explanation?: string
  status: string
  isFree: boolean
  isFeatured: boolean
  showInDailyTips: boolean
  showInWeeklySpecials: boolean
  type: string
  matchesInAccumulator?: any
  totalOdds?: number
  stake?: number
  potentialReturn?: number
  createdAt: string
  resultUpdatedAt?: string
  result: 'won' | 'lost' | 'pending' | 'void'
}

export interface PredictionsHistoryResponse {
  predictions: Prediction[]
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

export interface PredictionsHistoryStats {
  totalPredictions: number
  predictionsByStatus: Record<string, number>
  results: {
    won: number
    lost: number
    pending: number
    void: number
  }
  successRate: number
  averageConfidence: number
  predictionsByValueRating: Record<string, number>
  recentPredictions: number
  topLeagues: number
}

export interface PredictionsFilters {
  page: number
  limit: number
  search: string
  league: string
  status: string
  result: string
  sortBy: string
  sortOrder: 'asc' | 'desc'
  dateFrom?: string
  dateTo?: string
} 