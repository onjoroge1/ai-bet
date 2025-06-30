"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
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
  const router = useRouter()

  // Fetch user profile with country data
  const fetchUserProfile = async (userId: string) => {
    try {
      const response = await fetch('/api/user/profile')
      if (response.ok) {
        const userData = await response.json()
        return userData
      }
    } catch (error) {
      logger.error('Error fetching user profile', {
        tags: ['auth', 'provider'],
        data: { userId, error }
      })
    }
    return null
  }

  // Sync with NextAuth session
  useEffect(() => {
    console.log('AuthProvider useEffect - status:', status, 'session user:', session?.user?.id)
    
    if (status === 'loading') {
      console.log('AuthProvider - status is loading, setting isLoading to true')
      setIsLoading(true)
      return
    }

    if (status === 'authenticated' && session?.user) {
      console.log('AuthProvider - status is authenticated, fetching user profile')
      // Set basic user data immediately to ensure isAuthenticated is true
      setUser({
        id: session.user.id,
        email: session.user.email || '',
        name: session.user.name || undefined,
        role: session.user.role || undefined,
        referralCode: session.user.referralCode || undefined
      })
      setIsLoading(false)
      
      // Then fetch complete user profile including country data
      fetchUserProfile(session.user.id).then((userData) => {
        if (userData) {
          console.log('AuthProvider - user profile fetched successfully:', userData.id)
          setUser({
            id: userData.id,
            email: userData.email || '',
            name: userData.fullName || undefined,
            role: userData.role || undefined,
            country: userData.country || undefined
          })
        } else {
          console.log('AuthProvider - user profile fetch failed, keeping basic session data')
          // Keep the basic session data we already set
        }
        logger.debug('Auth state updated', {
          tags: ['auth', 'provider'],
          data: { 
            status,
            hasUser: true,
            role: session.user.role,
            hasCountry: !!userData?.country
          }
        })
      }).catch((error) => {
        console.log('AuthProvider - user profile fetch error:', error)
        // Keep the basic session data even if profile fetch fails
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
  }, [status, session])

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
      // First, clear the custom token
      const response = await fetch('/api/auth/signout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to clear custom token')
      }

      // Then, sign out from NextAuth
      await signOut({ redirect: false })
      
      // Clear local state
      setUser(null)
      
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
