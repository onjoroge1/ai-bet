import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { DashboardResponse } from '@/types/dashboard'

interface UseDashboardDataReturn {
  data: DashboardResponse | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * useDashboardData - Server-Side First Architecture
 * 
 * 🔥 NEW: Uses server-side session check instead of useAuth()
 * - Checks /api/auth/session directly (no waiting for useSession() sync)
 * - Ensures correct user ID is used immediately
 * - Prevents showing generic/placeholder user data
 */
export function useDashboardData(): UseDashboardDataReturn {
  const [userId, setUserId] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)

  // 🔥 NEW: Check server-side session to get user ID immediately
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/session', {
          cache: 'no-store',
          credentials: 'include',
        })
        const session = await res.json()
        if (session?.user?.id) {
          setUserId(session.user.id)
          setIsAuthenticated(true)
        } else {
          setUserId(null)
          setIsAuthenticated(false)
        }
      } catch (error) {
        console.error('[useDashboardData] Auth check error:', error)
        setUserId(null)
        setIsAuthenticated(false)
      }
    }
    checkAuth()
  }, [])

  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['dashboard-data', userId],
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
    enabled: isAuthenticated && !!userId, // Only fetch when we have a valid user ID from server-side session
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