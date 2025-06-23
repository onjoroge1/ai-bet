export interface UserCountry {
  id: string
  code: string
  name: string
  flagEmoji: string
  currencyCode: string
  currencySymbol: string
}

export interface DashboardUser {
  id: string
  email: string
  fullName: string | null
  role: string
  memberSince: string
  winStreak: number
  country: UserCountry | null
}

export interface DashboardData {
  level: number
  progressToNextLevel: number
  predictionAccuracy: string
  monthlySuccess: string
  vipExpiryDate: string | null
  subscriptionPlan: string | null
}

export interface DashboardResponse {
  user: DashboardUser
  dashboard: DashboardData
}

export interface DashboardHeaderProps {
  user: DashboardUser
  dashboard: DashboardData
  isLoading?: boolean
} 