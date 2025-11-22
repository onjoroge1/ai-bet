"use client"

import React, { createContext, useContext, useMemo, useEffect, useRef } from 'react'
import { useSession, signOut } from "next-auth/react"
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { logger } from "@/lib/logger"

// Define the User type with country information
interface User {
  id: string
  email: string
  name?: string | null
  role?: string
  referralCode?: string | null
  country?: {
    id: string
    code: string
    name: string
    flagEmoji: string
    currencyCode: string
    currencySymbol: string
  }
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

/**
 * AuthProvider - Trusts ONLY NextAuth's useSession() as the single source of truth
 * 
 * 🔥 CRITICAL: This provider does NOT:
 * - Check document.cookie (HttpOnly cookies are invisible to JavaScript)
 * - Block on profile fetch (profile is optional enrichment only)
 * - Manually delete cookies (HttpOnly cookies can't be deleted via JavaScript)
 * - Use custom JWT tokens
 * 
 * ✅ This provider ONLY:
 * - Trusts useSession() status === 'authenticated' && !!session?.user
 * - Fetches profile as optional enrichment (country, etc.)
 * - Uses NextAuth's signOut() for logout
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const queryClient = useQueryClient()
  const previousUserId = React.useRef<string | undefined>(undefined)

  // Log session changes and invalidate cache when user switches
  useEffect(() => {
    const currentUserId = (session?.user as any)?.id
    
    logger.debug('AuthProvider - Session status changed', {
      tags: ['auth', 'provider', 'session'],
      data: {
        status,
        hasSession: !!session,
        userEmail: session?.user?.email,
        userId: currentUserId,
        userRole: (session?.user as any)?.role,
        previousUserId: previousUserId.current,
        timestamp: new Date().toISOString()
      }
    })

    // 🔥 CRITICAL: Clear cache when user logs out (status changes to unauthenticated)
    if (previousUserId.current && status === 'unauthenticated') {
      logger.info('User logged out - clearing all cached data', {
        tags: ['auth', 'provider', 'cache', 'logout'],
        data: {
          previousUserId: previousUserId.current,
        }
      })
      // Clear all queries to remove cached user data
      queryClient.invalidateQueries({ queryKey: [] })
      queryClient.removeQueries({ queryKey: [] })
      previousUserId.current = undefined
    }

    // 🔥 CRITICAL: If user ID changed (user switched accounts), invalidate all queries
    // This ensures we don't show cached data from the previous user
    if (previousUserId.current && previousUserId.current !== currentUserId && currentUserId) {
      logger.warn('User switched accounts - invalidating all queries', {
        tags: ['auth', 'provider', 'cache'],
        data: {
          previousUserId: previousUserId.current,
          currentUserId,
        }
      })
      // Clear all queries first, then invalidate to force refetch
      queryClient.invalidateQueries({ queryKey: [] })
      queryClient.removeQueries({ queryKey: [] })
    }

    previousUserId.current = currentUserId
  }, [status, session, queryClient])

  // Fetch user profile as optional enrichment only (adds country, etc.)
  // This does NOT block authentication state - we trust NextAuth's session immediately
  // 🔥 CRITICAL: Include user ID in query key so cache is user-specific
  const userId = (session?.user as any)?.id
  const { data: profile } = useQuery({
    queryKey: ['user-profile', userId],
    queryFn: async () => {
      const response = await fetch('/api/user/profile')
      if (!response.ok) {
        logger.warn('User profile fetch failed or unauthorized', {
          tags: ['auth', 'provider', 'profile'],
          data: { status: response.status }
        })
        throw new Error('Failed to fetch profile')
      }
      return response.json()
    },
    enabled: status === 'authenticated' && !!userId,
    retry: 1,
    refetchOnWindowFocus: false,
  })

  const value = useMemo<AuthContextType>(() => {
    // 🔥 SINGLE SOURCE OF TRUTH: Only useSession() determines authentication
    const isAuthenticated = status === 'authenticated' && !!session?.user

    // Still determining session
    if (status === 'loading') {
      return {
        user: null,
        isAuthenticated: false,
        isLoading: true,
        logout: async () => {
          await signOut({ redirect: true, callbackUrl: '/signin' })
        },
      }
    }

    // Authenticated via NextAuth - trust this immediately
    if (isAuthenticated) {
      const baseUser: User = {
        id: (session!.user as any).id,
        email: session!.user.email || '',
        name: session!.user.name,
        role: (session!.user as any).role,
        referralCode: (session!.user as any).referralCode,
      }

      // Enrich with profile data if available (country, etc.)
      // 🔥 CRITICAL: Only use profile if it matches the current user ID
      // This prevents showing stale profile data from a previous user
      // The profile query key includes userId, so when user switches, old profile is invalidated
      // But we double-check here to be safe
      const profileUserId = profile?.id
      const enrichedUser: User = profile && profileUserId === baseUser.id
        ? {
            ...baseUser,
            country: profile.country,
          }
        : baseUser

      return {
        user: enrichedUser,
        isAuthenticated: true, // Set immediately - no waiting for profile fetch
        isLoading: false,
        logout: async () => {
          // 🔥 CRITICAL: Clear all cached data BEFORE signing out
          // This prevents showing stale data from the previous user
          logger.info('Logging out - clearing all cached data', {
            tags: ['auth', 'provider', 'logout', 'cache'],
            data: { userId: (session!.user as any).id, email: session!.user.email }
          })
          queryClient.invalidateQueries({ queryKey: [] }) // Invalidate all queries
          queryClient.removeQueries({ queryKey: [] }) // Remove all queries from cache
          previousUserId.current = undefined // Reset user ID tracking
          
          // Then sign out and redirect
          await signOut({ redirect: true, callbackUrl: '/signin' })
        },
      }
    }

    // Unauthenticated
    return {
      user: null,
      isAuthenticated: false,
      isLoading: false,
      logout: async () => {
        await signOut({ redirect: true, callbackUrl: '/signin' })
      },
    }
  }, [status, session, profile])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
