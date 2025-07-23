// API Response Types
export interface ApiResponse<T = unknown> {
  success?: boolean
  data?: T
  error?: string
  message?: string
}

// Prediction Data Types
export interface PredictionPayload {
  prediction?: {
    match_info?: MatchInfo
    comprehensive_analysis?: ComprehensiveAnalysis
    additional_markets?: AdditionalMarkets
  }
  comprehensive_analysis?: ComprehensiveAnalysis
  additional_markets?: AdditionalMarkets
  analysis_metadata?: Record<string, unknown>
  processing_time?: number
  timestamp?: string
}

export interface MatchInfo {
  home_team?: string
  away_team?: string
  league?: string
  date?: string
  venue?: string
  match_importance?: string
  status?: string
}

export interface ComprehensiveAnalysis {
  ai_verdict?: {
    detailed_reasoning?: string
    probability_assessment?: Record<string, number>
  }
  detailed_reasoning?: {
    form_analysis?: string
    injury_impact?: string
    tactical_factors?: string
    historical_context?: string
    ml_model_weight?: string
  }
  betting_intelligence?: {
    avoid_bets?: string[]
  }
  risk_analysis?: {
    overall_risk?: string
  }
  confidence_breakdown?: string
  ml_prediction?: {
    confidence?: number
    [key: string]: unknown
  }
}

export interface AdditionalMarkets {
  total_goals?: Record<string, number>
  both_teams_score?: {
    yes: number
    no: number
  }
  asian_handicap?: Record<string, number>
  [key: string]: unknown
}

// Payment Types
export interface PaymentIntent {
  id: string
  amount: number
  currency: string
  status: string
  metadata: {
    userId?: string
    itemType?: string
    itemId?: string
    packageType?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

export interface StripeEvent {
  id: string
  type: string
  data: {
    object: PaymentIntent
  }
  [key: string]: unknown
}

// Quick Purchase Types
export interface QuickPurchaseData {
  matchData?: Record<string, unknown>
  predictionData?: PredictionPayload
  predictionType?: string
  confidenceScore?: number
  odds?: number
  valueRating?: string
  analysisSummary?: string
  isPredictionActive?: boolean
}

// Market Data Types
export interface MarketData {
  market: string
  prediction: string
  probability: number
  reasoning: string
}

export interface GoalsData {
  [threshold: string]: number
}

export interface BttsData {
  yes: number
  no: number
}

export interface HandicapData {
  [option: string]: number
}

// Formatted Prediction Types
export interface FormattedPrediction {
  match: MatchInfo
  prediction: string
  odds: string
  confidence: number
  analysis: string
  valueRating: string
  detailedReasoning: string[]
  extraMarkets: MarketData[]
  additionalMarkets: MarketData[]
  thingsToAvoid: string[]
  riskLevel: string
  confidenceStars: number
  probabilitySnapshot: Record<string, number>
  aiVerdict: Record<string, unknown>
  mlPrediction: {
    confidence: number
    [key: string]: unknown
  }
  riskAnalysis: Record<string, unknown>
  bettingIntelligence: Record<string, unknown>
  confidenceBreakdown: string
  analysisMetadata?: Record<string, unknown>
  processingTime?: number
  timestamp?: string
}

// Revenue Analytics Types
export interface RevenueData {
  totalRevenue: number
  revenueByCountry: Record<string, number>
  revenueByPackage: Record<string, number>
  revenueByDate: Record<string, number>
}

export interface AnalyticsResponse {
  revenue: RevenueData
  [key: string]: unknown
}

// Socket Types
export interface SocketRequest {
  type: string
  [key: string]: unknown
}

export interface SocketResponse {
  status: string
  error?: string
}

// Generic API Error Types
export interface ApiError {
  error: string
  details?: string[]
  status?: number
}

// Validation Types
export interface ValidationResult {
  isValid: boolean
  errors: string[]
}

// Database Model Types (for Prisma)
export interface PrismaDecimal {
  toNumber(): number
  toString(): string
}

// Component Props Types
export interface PredictionComponentProps {
  predictions: FormattedPrediction[]
  loading?: boolean
  error?: string
}

// User Package Types
export interface UserPackageData {
  id: string
  userId: string
  packageOfferId?: string
  packageType: string
  tipsRemaining: number
  totalTips: number
  status: string
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
}

// Country Pricing Types
export interface CountryPricing {
  price: number
  originalPrice: number
  currencyCode: string
  currencySymbol: string
}

// Notification Types
export interface NotificationData {
  id: string
  userId: string
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: Date
  [key: string]: unknown
}

// Quiz Types
export interface QuizQuestion {
  id: string
  question: string
  options: string[]
  correctAnswer: number
  explanation?: string
}

export interface QuizSubmission {
  userId: string
  answers: Record<string, number>
  score: number
  timeSpent: number
}

// Leaderboard Types
export interface LeaderboardEntry {
  userId: string
  username: string
  score: number
  rank: number
  lastPlayed: Date
}

// Sitemap Types
export interface SitemapEntry {
  url: string
  lastModified: Date
  changeFrequency: string
  priority: number
}

// Generic Record Types for Flexible Data
export type FlexibleRecord = Record<string, unknown>
export type StringRecord = Record<string, string>
export type NumberRecord = Record<string, number>
export type BooleanRecord = Record<string, boolean>

// Utility Types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
} 