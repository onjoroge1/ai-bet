import { useQuery } from '@tanstack/react-query'
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

  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['dashboard-data', user?.id],
    queryFn: async (): Promise<DashboardResponse> => {
      const response = await fetch('/api/user/dashboard-data', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard data: ${response.status}`)
      }

      return response.json()
    },
    enabled: isAuthenticated && !!user?.id,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes (increased from 30s)
    gcTime: 10 * 60 * 1000, // Cache for 10 minutes (increased from 5 minutes)
    retry: 1, // Reduced retries to prevent excessive calls
    retryDelay: 2000, // Increased delay between retries
    refetchOnWindowFocus: false, // Prevent refetch on window focus
    refetchOnMount: true, // 🔥 CRITICAL: Refetch on mount when user changes (user ID in query key handles this)
  })

  return {
    data: data || null,
    isLoading,
    error: error ? (error as Error).message : null,
    refetch: async () => {
      await refetch()
    }
  }
} 