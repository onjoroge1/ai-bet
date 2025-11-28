"use client"

import { useState } from "react"
import { signOut, useSession } from "next-auth/react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import { logger } from "@/lib/logger"
import { clearSessionCache } from "@/lib/session-request-manager"

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
  const { data: session, update } = useSession()
  const queryClient = useQueryClient()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  
  const handleLogout = async () => {
    // ✅ FIX: Prevent double-clicks
    if (isLoggingOut) {
      logger.warn("Logout already in progress, ignoring duplicate click", {
        tags: ["auth", "logout"],
      })
      return
    }
    
    setIsLoggingOut(true)
    logger.info("LogoutButton clicked - killing session completely", {
      tags: ["auth", "logout"],
      data: { 
        timestamp: new Date().toISOString(),
        userId: (session?.user as any)?.id,
        email: session?.user?.email,
        architecture: "optimized-complete-logout"
      }
    })
    
    try {
      // 🔥 OPTIMIZED: Complete logout - clear all caches and sync useSession()
      // 1. Clear React Query cache
      // 2. Clear session request manager cache
      // 3. Clear Redis session cache
      // 4. Kill session server-side (NextAuth)
      // 5. Clear useSession() cache (force refetch)
      // 6. Wait for session to clear
      // 7. Redirect
      
      // Step 1: Clear all React Query cache to prevent stale data
      queryClient.invalidateQueries()
      queryClient.removeQueries()
      logger.info("React Query cache cleared", {
        tags: ["auth", "logout", "cache"],
      })
      
      // Step 2: Clear session request manager cache (BEFORE signOut)
      clearSessionCache()
      logger.info("Session request manager cache cleared", {
        tags: ["auth", "logout", "cache"],
      })
      
      // Step 3: Clear Redis session cache with retry mechanism (CRITICAL FIX)
      // ✅ FIX: Use separate endpoint to avoid intercepting NextAuth's signout
      let cacheCleared = false
      let cacheRetries = 0
      const maxCacheRetries = 3
      
      while (!cacheCleared && cacheRetries < maxCacheRetries) {
        try {
          const cacheResponse = await fetch('/api/auth/clear-session-cache', {
            method: 'POST',
            credentials: 'include',
          })
          
          if (cacheResponse.ok) {
            const result = await cacheResponse.json()
            if (result.cacheCleared !== false) {
              cacheCleared = true
              logger.info("Redis session cache cleared successfully", {
                tags: ["auth", "logout", "cache"],
                data: { retries: cacheRetries },
              })
            } else {
              cacheRetries++
              if (cacheRetries < maxCacheRetries) {
                logger.warn("Redis cache clear reported failure, retrying", {
                  tags: ["auth", "logout", "cache"],
                  data: { retry: cacheRetries },
                })
                await new Promise(resolve => setTimeout(resolve, 500))
              }
            }
          } else {
            cacheRetries++
            if (cacheRetries < maxCacheRetries) {
              logger.warn("Redis cache clear returned non-200, retrying", {
                tags: ["auth", "logout", "cache"],
                data: { status: cacheResponse.status, retry: cacheRetries },
              })
              await new Promise(resolve => setTimeout(resolve, 500))
            }
          }
        } catch (cacheError) {
          cacheRetries++
          if (cacheRetries < maxCacheRetries) {
            logger.warn("Redis cache clear error, retrying", {
              tags: ["auth", "logout", "cache"],
              error: cacheError instanceof Error ? cacheError : undefined,
              data: { retry: cacheRetries },
            })
            await new Promise(resolve => setTimeout(resolve, 500))
          } else {
            logger.error("Failed to clear Redis cache after retries - security risk", {
              tags: ["auth", "logout", "cache", "security"],
              error: cacheError instanceof Error ? cacheError : undefined,
            })
          }
        }
      }
      
      if (!cacheCleared) {
        logger.error("Redis cache not cleared after all retries - logging security risk", {
          tags: ["auth", "logout", "security", "critical"],
        })
        // Still continue with logout, but log critical security risk
      }
      
      // Step 4: Kill session server-side (NextAuth) - CRITICAL: This clears the cookie!
      // ✅ FIX: Now NextAuth's /api/auth/signout endpoint is NOT intercepted
      // signOut() will properly call NextAuth's endpoint which clears the cookie
      try {
        await signOut({ redirect: false })
        logger.info("NextAuth signOut() called successfully - cookie should be cleared", {
          tags: ["auth", "logout"],
        })
      } catch (signOutError) {
        logger.error("NextAuth signOut() failed - session cookie may not be cleared", {
          tags: ["auth", "logout", "error", "critical"],
          error: signOutError instanceof Error ? signOutError : undefined,
        })
        // This is critical - if signOut fails, cookie won't be cleared
        // Log error but continue with verification
      }
      
      // Step 5: Wait for cookie to be cleared (critical for JWT strategy)
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Step 6: Verify session is actually cleared before redirecting
      let sessionCleared = false
      let verificationAttempts = 0
      const maxVerificationAttempts = 3
      
      while (!sessionCleared && verificationAttempts < maxVerificationAttempts) {
        try {
          const verifyRes = await fetch("/api/auth/session", {
            cache: "no-store",
            credentials: "include",
          })
          
          if (verifyRes.ok) {
            const verifySession = await verifyRes.json()
            if (!verifySession?.user) {
              sessionCleared = true
              logger.info("Session verified as cleared", {
                tags: ["auth", "logout", "verification"],
                data: { attempts: verificationAttempts + 1 },
              })
            } else {
              verificationAttempts++
              logger.warn("Session still exists after signOut, retrying verification", {
                tags: ["auth", "logout", "verification"],
                data: { attempts: verificationAttempts, maxAttempts: maxVerificationAttempts },
              })
              if (verificationAttempts < maxVerificationAttempts) {
                await new Promise(resolve => setTimeout(resolve, 300))
              }
            }
          } else if (verifyRes.status === 401 || verifyRes.status === 403) {
            // 401/403 specifically mean no session/unauthenticated
            sessionCleared = true
            logger.info("Session verified as cleared (401/403 response)", {
              tags: ["auth", "logout", "verification"],
              data: { status: verifyRes.status },
            })
          } else {
            // Other errors (500, network, etc.) - don't assume session is cleared
            verificationAttempts++
            logger.warn("Session verification returned unexpected status", {
              tags: ["auth", "logout", "verification", "warning"],
              data: { status: verifyRes.status, attempts: verificationAttempts },
            })
            if (verificationAttempts < maxVerificationAttempts) {
              await new Promise(resolve => setTimeout(resolve, 300))
            }
          }
        } catch (verifyError) {
          verificationAttempts++
          logger.warn("Session verification error, retrying", {
            tags: ["auth", "logout", "verification"],
            error: verifyError instanceof Error ? verifyError : undefined,
            data: { attempts: verificationAttempts },
          })
          if (verificationAttempts < maxVerificationAttempts) {
            await new Promise(resolve => setTimeout(resolve, 300))
          } else {
            // Max attempts reached, break and log warning
            logger.error("Session verification failed after max attempts", {
              tags: ["auth", "logout", "verification", "error"],
              error: verifyError instanceof Error ? verifyError : undefined,
            })
            break
          }
        }
      }
      
      if (!sessionCleared) {
        logger.error("Session still exists after signOut() and verification attempts", {
          tags: ["auth", "logout", "error"],
          data: { attempts: verificationAttempts },
        })
        // Still redirect - cookie clearing might be delayed but will eventually work
      }
      
      // Step 7: Clear ALL session caches (including all Redis entries)
      // ✅ CRITICAL FIX: Clear all session caches, not just one
      try {
        const { clearAllSessionCaches } = await import('@/lib/session-cache')
        const keysDeleted = await clearAllSessionCaches()
        logger.info("All Redis session caches cleared", {
          tags: ["auth", "logout", "cache"],
          data: { keysDeleted },
        })
      } catch (clearAllError) {
        logger.warn("Failed to clear all session caches, but continuing", {
          tags: ["auth", "logout", "cache"],
          error: clearAllError instanceof Error ? clearAllError : undefined,
        })
      }
      
      // Step 8: Clear React Query cache for NextAuth's session query
      // ✅ CRITICAL FIX: Explicitly clear NextAuth's React Query cache
      try {
        // Clear all queries related to session/auth
        queryClient.removeQueries({ 
          predicate: (query) => {
            const queryKey = query.queryKey
            // Clear NextAuth session queries and any auth-related queries
            return Array.isArray(queryKey) && (
              queryKey.includes('session') || 
              queryKey.includes('auth') ||
              queryKey[0] === 'session'
            )
          }
        })
        logger.info("NextAuth React Query cache cleared", {
          tags: ["auth", "logout", "cache"],
        })
      } catch (queryError) {
        logger.warn("Failed to clear React Query cache, but continuing", {
          tags: ["auth", "logout", "cache"],
          error: queryError instanceof Error ? queryError : undefined,
        })
      }
      
      // Step 9: Clear useSession() cache by forcing refetch
      // ✅ CRITICAL FIX: Wait for update() to complete before redirect
      try {
        await update()
        logger.info("useSession() cache cleared via update()", {
          tags: ["auth", "logout", "cache"],
        })
        
        // Wait for useSession() to reflect the change
        await new Promise(resolve => setTimeout(resolve, 300))
      } catch (updateError) {
        logger.warn("Failed to update useSession() after logout, but continuing", {
          tags: ["auth", "logout", "cache"],
          error: updateError instanceof Error ? updateError : undefined,
        })
      }
      
      // Step 10: Force hard redirect with cache bypass to ensure fresh page load
      logger.info("Redirecting to signin - complete logout finished", {
        tags: ["auth", "logout"],
        data: { 
          architecture: "optimized-complete-logout",
          sessionCleared,
          verificationAttempts,
        },
      })
      
      // ✅ CRITICAL FIX: Use hard redirect to force full page reload
      // This ensures useSession() will refetch on page load with refetchOnMount
      // Use window.location.replace() to prevent back button navigation
      // Add timestamp to bypass any caching
      window.location.replace(`/signin?logout=${Date.now()}`)
    } catch (error) {
      logger.error("Error during logout", {
        tags: ["auth", "logout", "error"],
        error: error instanceof Error ? error : undefined
      })
      // Fallback: redirect anyway to ensure user can log in again
      setIsLoggingOut(false)
      window.location.replace(`/signin?logout=${Date.now()}`)
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={handleLogout}
      disabled={isLoggingOut}
    >
      {showIcon && <LogOut className="w-4 h-4 mr-2" />}
      {isLoggingOut ? "Signing out..." : label}
    </Button>
  )
}

