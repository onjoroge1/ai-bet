"use client"

import { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from "react"
import { useRouter } from "next/navigation" // Import useRouter
import { logger } from "@/lib/logger"

// Define the User type
type User = {
  id: string
  name: string
  email: string
  image?: string
  role?: string
  countryId?: string
}

// Define the AuthContext type
type AuthContextType = {
  user: User | null
  isLoading: boolean // Indicates if auth state is being determined
  isAuthenticated: boolean // Derived from user state
  login: (userData: User) => void
  logout: () => Promise<void>
}

// Create the AuthContext
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Create a hook to use the AuthContext
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

// Create the AuthProvider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true) // Start as true
  const router = useRouter() // Initialize useRouter

  // Check local storage for user session on initial mount
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user")
      if (storedUser) {
        const parsedUser: User = JSON.parse(storedUser)
        setUser(parsedUser)
        logger.info("User session restored from localStorage", {
          tags: ["auth", "session"],
          data: { userId: parsedUser.id },
        })
      }
    } catch (error) {
      logger.error("Failed to parse user from localStorage", { tags: ["auth", "session"], error })
      localStorage.removeItem("user") // Clear corrupted data
    } finally {
      setIsLoading(false) // Finished loading auth state
    }
  }, [])

  const login = useCallback((userData: User) => {
    setUser(userData)
    localStorage.setItem("user", JSON.stringify(userData))
    logger.info("User logged in and session stored", { tags: ["auth", "login"], data: { userId: userData.id } })
  }, [])

  const logout = useCallback(async () => {
    setIsLoading(true)
    try {
      // Call the signout API route
      const response = await fetch("/api/auth/signout", { method: "POST" })
      if (!response.ok) {
        logger.error("Sign out API call failed", { tags: ["auth", "signout"], status: response.status })
        // Still proceed with client-side logout
      } else {
        logger.info("Sign out API call successful", { tags: ["auth", "signout"] })
      }
    } catch (error) {
      logger.error("Error during signout API call", { tags: ["auth", "signout"], error })
    } finally {
      setUser(null)
      localStorage.removeItem("user")
      logger.info("User logged out and session cleared", { tags: ["auth", "logout"] })
      setIsLoading(false)
      router.push("/signin") // Redirect to signin page after logout
    }
  }, [router])

  const isAuthenticated = !!user

  const value = {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
