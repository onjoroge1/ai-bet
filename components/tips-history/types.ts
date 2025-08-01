// Unified TypeScript interfaces for Tips History

export interface Tip {
  id: string
  claimedAt: string
  status: 'claimed' | 'used' | 'expired' | 'cancelled'
  expiresAt?: string
  notes?: string
  result?: 'won' | 'lost' | 'pending' | 'cancelled'
  resultUpdatedAt?: string
  performance?: {
    roi?: number
    profitLoss?: number
    stakeAmount?: number
    actualReturn?: number
  }
  auditLog?: Array<{
    timestamp: string
    action: string
    fromStatus?: string
    toStatus?: string
    notes?: string
  }>
  package: {
    id: string
    name: string
    type: string
    colorGradientFrom: string
    colorGradientTo: string
    iconName: string
  }
  prediction: {
    id: string
    predictionType: string
    confidenceScore: number
    odds: number
    valueRating: string
    explanation?: string
    status: string
    match: {
      id: string
      matchDate: string
      status: string
      homeScore?: number
      awayScore?: number
      homeTeam: { id: string; name: string }
      awayTeam: { id: string; name: string }
      league: { id: string; name: string }
    }
  }
  usage?: {
    id: string
    usedAt: string
    stakeAmount?: number
    actualReturn?: number
    notes?: string
  }
}

export interface Package {
  id: string
  name: string
  type: string
  status: string
  tipsRemaining: number
  totalTips: number
  purchasedAt: string
  expiresAt: string
  colorGradientFrom: string
  colorGradientTo: string
  iconName: string
}

export interface TipsHistoryStats {
  totalTips: number
  claimedTips: number
  usedTips: number
  expiredTips: number
  successRate: number
  averageConfidence: number
  recentPerformance?: {
    last7Days: number
    last30Days: number
    totalROI: number
  }
}

export interface TipsHistoryResponse {
  tips: Tip[]
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
  stats?: TipsHistoryStats
}

export interface TipsFilters {
  page: number
  limit: number
  status: string
  package: string
  dateFrom?: string
  dateTo?: string
  search: string
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

export interface TipsHistoryState {
  tips: Tip[]
  stats: TipsHistoryStats
  loading: boolean
  error: string | null
  pagination: TipsHistoryResponse['pagination'] | null
  filters: TipsFilters
} 