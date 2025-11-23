"use client"

import { signOut, useSession } from "next-auth/react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import { logger } from "@/lib/logger"

interface LogoutButtonProps {
  label?: string
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm" | "lg"
  className?: string
  showIcon?: boolean
}

/**
 * LogoutButton - Single canonical logout component
 * 
 * Uses NextAuth's signOut() directly - no custom logic, no manual cookie clearing
 * This ensures logout works consistently across all pages
 */
export function LogoutButton({ 
  label = "Sign Out", 
  variant = "outline",
  size = "sm",
  className,
  showIcon = true
}: LogoutButtonProps) {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  
  const handleLogout = async () => {
    logger.info("LogoutButton clicked - clearing cache and calling NextAuth signOut", {
      tags: ["auth", "logout"],
      data: { 
        timestamp: new Date().toISOString(),
        userId: (session?.user as any)?.id,
        email: session?.user?.email
      }
    })
    
    try {
      // 🔥 Step 1: Clear all React Query cache to prevent stale data
      queryClient.invalidateQueries()
      queryClient.removeQueries()
      logger.info("React Query cache cleared", {
        tags: ["auth", "logout", "cache"],
      })
      
      // 🔥 Step 2: Clear server-side session cookie
      await signOut({ redirect: false })
      
      // 🔥 SIMPLIFIED: Direct /api/auth/session check for immediate verification
      // This is faster (~30-100ms) than waiting for useSession() to poll/update
      try {
        const verifySessionCleared = async (maxRetries = 3): Promise<boolean> => {
          for (let i = 0; i < maxRetries; i++) {
            const res = await fetch("/api/auth/session", {
              cache: "no-store",
              credentials: "include",
            })
            const session = await res.json()
            
            if (!session?.user) {
              logger.info("Session cleared verified successfully after logout", {
                tags: ["auth", "logout"],
                data: { attempt: i + 1 },
              })
              return true
            }
            
            // Wait a bit before retry (cookie clearing might take a moment)
            if (i < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, 100))
            }
          }
          return false
        }
        
        const sessionCleared = await verifySessionCleared(3)
        if (!sessionCleared) {
          logger.warn("Session clear verification failed, but continuing with redirect", {
            tags: ["auth", "logout"],
          })
          // Still redirect - the session is cleared server-side, useSession() will catch up
        }
      } catch (verifyError) {
        logger.warn("Session clear verification error, but continuing with redirect", {
          tags: ["auth", "logout"],
          error: verifyError instanceof Error ? verifyError : undefined,
        })
        // Still redirect - don't block user from proceeding
      }
      
      // 🔥 Step 3: Hard redirect - useSession() will automatically sync on page load
      window.location.href = "/signin"
    } catch (error) {
      logger.error("Error during logout", {
        tags: ["auth", "logout", "error"],
        error: error instanceof Error ? error : undefined
      })
      // Fallback: redirect anyway to ensure user can log in again
      window.location.href = "/signin"
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={handleLogout}
    >
      {showIcon && <LogOut className="w-4 h-4 mr-2" />}
      {label}
    </Button>
  )
}

