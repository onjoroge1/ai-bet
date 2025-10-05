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

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (userData: User) => void
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
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes (increased from 1 minute)
    gcTime: 15 * 60 * 1000, // Cache for 15 minutes (increased from 10 minutes)
    retry: 1, // Reduced retries to prevent excessive calls
    retryDelay: 2000, // Increased delay between retries
    refetchOnWindowFocus: false, // Prevent refetch on window focus
    refetchOnMount: false, // Prevent refetch on component mount if data exists
  })

  // Sync with NextAuth session - Optimized for faster loading
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
    } else if (status === 'unauthenticated') {
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
  }, [status, session]) // Removed userProfile and profileLoading from dependencies to prevent infinite loops

  // Separate effect to handle profile data updates
  useEffect(() => {
    if (status === 'authenticated' && session?.user && userProfile) {
      console.log('AuthProvider - updating user with profile data:', userProfile.id)
      setUser(userProfile)
    }
  }, [userProfile, status, session])

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
      logger.debug('AuthProvider - starting logout process', {
        tags: ['auth', 'provider']
      })
      
      // Clear local state immediately to prevent further API calls
      setUser(null)
      setIsLoading(false)
      
      // Sign out from NextAuth without redirect for faster logout
      await signOut({ 
        redirect: false
      })
      
      // Manual redirect for better performance
      window.location.href = '/'
      
      logger.debug('User logged out successfully', {
        tags: ['auth', 'provider']
      })
    } catch (error: unknown) {
      logger.error('Logout error', {
        tags: ['auth', 'provider'],
        error: error instanceof Error ? error : undefined
      })
      
      // Fallback: clear state and redirect manually
      setUser(null)
      setIsLoading(false)
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
