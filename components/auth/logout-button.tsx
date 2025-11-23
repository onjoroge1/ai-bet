"use client"

import { signOut, useSession } from "next-auth/react"
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
  
  const handleLogout = async () => {
    logger.info("LogoutButton clicked - calling NextAuth signOut", {
      tags: ["auth", "logout"],
      data: { 
        timestamp: new Date().toISOString(),
        userId: (session?.user as any)?.id,
        email: session?.user?.email
      }
    })
    
    // 🔥 Use NextAuth's signOut() with redirect: false first
    // This ensures the session is cleared before redirect
    // Then manually redirect to ensure clean state
    try {
      await signOut({ redirect: false })
      
      // Small delay to ensure session cookie is cleared
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Hard redirect ensures full page reload and session refresh
      window.location.href = "/signin"
    } catch (error) {
      logger.error("Error during logout", {
        tags: ["auth", "logout", "error"],
        error: error instanceof Error ? error : undefined
      })
      // Fallback: redirect anyway
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

