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
    logger.info("LogoutButton clicked - killing session (server-side first)", {
      tags: ["auth", "logout"],
      data: { 
        timestamp: new Date().toISOString(),
        userId: (session?.user as any)?.id,
        email: session?.user?.email,
        architecture: "server-side-first"
      }
    })
    
    try {
      // 🔥 NEW ARCHITECTURE: Server-side first logout
      // 1. Clear React Query cache
      // 2. Kill session server-side
      // 3. Verify session cleared (optional)
      // 4. Redirect immediately
      
      // Step 1: Clear all React Query cache to prevent stale data
      queryClient.invalidateQueries()
      queryClient.removeQueries()
      logger.info("React Query cache cleared", {
        tags: ["auth", "logout", "cache"],
      })
      
      // Step 2: Clear Redis session cache (BEFORE signOut)
      try {
        const cacheResponse = await fetch('/api/auth/signout', {
          method: 'POST',
          credentials: 'include',
        })
        
        if (cacheResponse.ok) {
          logger.info("Redis session cache cleared", {
            tags: ["auth", "logout", "cache"],
          })
        } else {
          logger.warn("Failed to clear Redis session cache, but continuing with logout", {
            tags: ["auth", "logout", "cache"],
            data: { status: cacheResponse.status },
          })
        }
      } catch (cacheError) {
        // Don't block logout if cache clearing fails
        logger.warn("Error clearing Redis session cache, but continuing with logout", {
          tags: ["auth", "logout", "cache"],
          error: cacheError instanceof Error ? cacheError : undefined,
        })
      }
      
      // Step 3: Kill session server-side (NextAuth)
      await signOut({ redirect: false })
      
      // Step 4: Verify session is cleared (optional but recommended)
      try {
        const res = await fetch("/api/auth/session", {
          cache: "no-store",
          credentials: "include",
        })
        const session = await res.json()
        
        if (!session?.user) {
          logger.info("Session killed successfully - verified server-side", {
            tags: ["auth", "logout"],
            data: { architecture: "server-side-first" },
          })
        } else {
          logger.warn("Session still exists after signOut, but continuing with redirect", {
            tags: ["auth", "logout"],
          })
          // Still redirect - signOut() clears cookie, might just need a moment
        }
      } catch (verifyError) {
        logger.warn("Session verification error, but continuing with redirect", {
          tags: ["auth", "logout"],
          error: verifyError instanceof Error ? verifyError : undefined,
        })
        // Still redirect - don't block user from proceeding
      }
      
      // Step 5: Immediate redirect - signin page will check server-side session
      logger.info("Redirecting to signin - session killed server-side", {
        tags: ["auth", "logout"],
        data: { architecture: "server-side-first" },
      })
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

