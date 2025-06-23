import { useState, useEffect } from 'react'
import { useAuth } from '@/components/auth-provider'
import { DashboardResponse } from '@/types/dashboard'

interface UseDashboardDataReturn {
  data: DashboardResponse | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useDashboardData(): UseDashboardDataReturn {
  const { user, isAuthenticated } = useAuth()
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboardData = async () => {
    if (!isAuthenticated || !user) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/user/dashboard-data', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard data: ${response.status}`)
      }

      const dashboardData: DashboardResponse = await response.json()
      setData(dashboardData)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch dashboard data'
      setError(errorMessage)
      console.error('Error fetching dashboard data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [isAuthenticated, user?.id])

  const refetch = async () => {
    await fetchDashboardData()
  }

  return {
    data,
    isLoading,
    error,
    refetch
  }
} 