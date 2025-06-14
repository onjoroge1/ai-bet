"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { logger } from "@/lib/logger"

// Define the User type
interface User {
  id: string
  email: string
  name?: string
  role?: string
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

  // Sync with NextAuth session
  useEffect(() => {
    if (status === 'loading') {
      setIsLoading(true)
      return
    }

    if (status === 'authenticated' && session?.user) {
      setUser({
        id: session.user.id,
        email: session.user.email || '',
        name: session.user.name || undefined,
        role: session.user.role || undefined
      })
      logger.debug('Auth state updated', {
        tags: ['auth', 'provider'],
        data: { 
          status,
          hasUser: true,
          role: session.user.role
        }
      })
    } else {
      setUser(null)
      logger.debug('Auth state updated', {
        tags: ['auth', 'provider'],
        data: { 
          status,
          hasUser: false
        }
      })
    }
    setIsLoading(false)
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
