import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { DashboardResponse } from '@/types/dashboard'
import { getSession } from '@/lib/session-request-manager'
import { logger } from '@/lib/logger'

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
  const [sessionUser, setSessionUser] = useState<{ name?: string | null; email?: string } | null>(null)

  // 🔥 NEW: Check server-side session to get user ID immediately
  // ✅ Use session request manager for deduplication and caching
  // ✅ FIX: Also store session user data to use as fallback while dashboard data loads
  // ✅ CRITICAL FIX: Re-check session periodically to catch user changes
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // ✅ Use session request manager - deduplicates requests with DashboardLayout
        const session = await getSession()
        if (session?.user?.id) {
          const newUserId = session.user.id
          // ✅ CRITICAL FIX: Only update state if userId actually changed
          // This prevents unnecessary re-renders and ensures we catch user switches
          if (newUserId !== userId) {
            setUserId(newUserId)
            setIsAuthenticated(true)
            // ✅ FIX: Store session user data for immediate use (prevents showing "User" fallback)
            setSessionUser({
              name: session.user.name,
              email: session.user.email,
            })
            logger.info("useDashboardData - User ID updated", {
              tags: ["dashboard", "session"],
              data: {
                newUserId,
                previousUserId: userId,
                email: session.user.email,
              },
            })
          }
        } else {
          if (userId !== null || isAuthenticated) {
            setUserId(null)
            setIsAuthenticated(false)
            setSessionUser(null)
          }
        }
      } catch (error) {
        console.error('[useDashboardData] Auth check error:', error)
        if (userId !== null || isAuthenticated) {
          setUserId(null)
          setIsAuthenticated(false)
          setSessionUser(null)
        }
      }
    }
    
    // Initial check
    checkAuth()
    
    // ✅ CRITICAL FIX: Re-check session every 2 seconds to catch user switches
    // This ensures we detect when a new user logs in
    const interval = setInterval(checkAuth, 2000)
    
    return () => clearInterval(interval)
  }, []) // Empty deps - interval runs continuously to detect user switches

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

  // ✅ FIX: Merge session user data as fallback when dashboard data is loading or unavailable
  // This prevents showing "User" fallback - uses session name immediately
  const mergedData: DashboardResponse | null = data ? data : (sessionUser && userId ? {
    user: {
      id: userId,
      email: sessionUser.email || '',
      fullName: sessionUser.name || null,
      role: 'user',
      memberSince: 'Recently',
      winStreak: 0,
      country: null,
    },
    dashboard: {
      level: 1,
      progressToNextLevel: 0,
      predictionAccuracy: '0%',
      monthlySuccess: '0%',
      vipExpiryDate: null,
      subscriptionPlan: null,
    },
  } : null)

  return {
    data: mergedData,
    isLoading,
    error: error ? (error as Error).message : null,
    refetch: async () => {
      await refetch()
    }
  }
} 