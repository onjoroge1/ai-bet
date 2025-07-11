"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { useQuery } from '@tanstack/react-query'
import { logger } from "@/lib/logger"

// Define the User type with country information
interface User {
  id: string
  email: string
  name?: string
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

// Define the AuthContext type
interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (userData: User) => void
  logout: () => Promise<void>
}

// Create the AuthContext
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Create a hook to use the AuthContext
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

// Create the AuthProvider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch user profile with React Query for better caching
  const {
    data: userProfile,
    isLoading: profileLoading
  } = useQuery({
    queryKey: ['user-profile', session?.user?.id],
    queryFn: async (): Promise<User> => {
      const response = await fetch('/api/user/profile')
      if (response.ok) {
        const userData = await response.json()
        return {
          id: userData.id,
          email: userData.email || '',
          name: userData.fullName || undefined,
          role: userData.role || undefined,
          country: userData.country || undefined
        }
      } else if (response.status === 404) {
        // Profile not found - this might happen during signout or session invalidation
        logger.warn('User profile not found (404)', {
          tags: ['auth', 'provider'],
          data: { userId: session?.user?.id, status: response.status }
        })
        throw new Error('Profile not found')
      } else {
        // Other error status
        logger.error('User profile fetch failed', {
          tags: ['auth', 'provider'],
          data: { userId: session?.user?.id, status: response.status }
        })
        throw new Error('Failed to fetch profile')
      }
    },
    enabled: status === 'authenticated' && !!session?.user?.id,
    staleTime: 60000, // Consider data fresh for 1 minute
    gcTime: 10 * 60 * 1000, // Cache for 10 minutes
    retry: 1,
    retryDelay: 1000,
  })

  // Sync with NextAuth session
  useEffect(() => {
    console.log('AuthProvider useEffect - status:', status, 'session user:', session?.user?.id)
    
    if (status === 'loading') {
      console.log('AuthProvider - status is loading, setting isLoading to true')
      setIsLoading(true)
      return
    }

    if (status === 'authenticated' && session?.user) {
      console.log('AuthProvider - status is authenticated')
      // Set basic user data immediately to ensure isAuthenticated is true
      const basicUser = {
        id: session.user.id,
        email: session.user.email || '',
        name: session.user.name || undefined,
        role: session.user.role || undefined,
        referralCode: session.user.referralCode || undefined
      }
      
      // If we have profile data, use it; otherwise use basic session data
      if (userProfile) {
        console.log('AuthProvider - using profile data:', userProfile.id)
        setUser(userProfile)
      } else {
        console.log('AuthProvider - using basic session data')
        setUser(basicUser)
      }
      
      setIsLoading(false)
      
      logger.debug('Auth state updated', {
        tags: ['auth', 'provider'],
        data: { 
          status,
          hasUser: true,
          role: session.user.role,
          hasProfile: !!userProfile,
          profileLoading
        }
      })
    } else {
      console.log('AuthProvider - status is not authenticated, setting user to null')
      setUser(null)
      setIsLoading(false)
      logger.debug('Auth state updated', {
        tags: ['auth', 'provider'],
        data: { 
          status,
          hasUser: false
        }
      })
    }
  }, [status, session, userProfile, profileLoading])

  const login = (userData: User) => {
    setUser(userData)
    logger.debug('User logged in', {
      tags: ['auth', 'provider'],
      data: { 
        userId: userData.id,
        role: userData.role
      }
    })
  }

  const logout = async () => {
    try {
      // Clear local state immediately to prevent further API calls
      setUser(null)
      setIsLoading(false)
      
      // First, clear the custom token
      const response = await fetch('/api/auth/signout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        logger.warn('Failed to clear custom token', {
          tags: ['auth', 'provider'],
          data: { status: response.status }
        })
      }

      // Then, sign out from NextAuth
      await signOut({ redirect: false })
      
      logger.debug('User logged out', {
        tags: ['auth', 'provider']
      })

      // Force a hard refresh to clear all state
      window.location.href = '/'
    } catch (error: unknown) {
      logger.error('Logout error', {
        tags: ['auth', 'provider'],
        error: error instanceof Error ? error : undefined
      })
      // Even if there's an error, try to redirect to home
      window.location.href = '/'
    }
  }

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
