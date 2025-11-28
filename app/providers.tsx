"use client"

import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SessionProvider } from "next-auth/react"
import { ThemeProvider } from "@/components/theme-provider"
import { UserCountryProvider } from "@/contexts/user-country-context"
import { AuthProvider } from "@/components/auth-provider"
import { AuthErrorBoundary } from "@/components/auth-error-boundary"
import { Toaster } from "sonner"

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        refetchOnWindowFocus: false,
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <AuthErrorBoundary>
        <SessionProvider
          refetchInterval={60} // Refetch session every 60 seconds (background sync)
          refetchOnWindowFocus={false} // Only when needed (reduces excessive API calls)
          refetchOnMount={true} // ✅ OPTIMIZED: Check session on every page load for fresh state
          // basePath is not needed - NextAuth defaults to /api/auth
          // 🔥 OPTIMIZED: refetchOnMount ensures fresh session check on page navigation
          // This is critical for immediate session sync after login redirect
          // Critical auth decisions use /api/auth/session directly (server-side first)
          // useSession() syncs in background and on mount for UI components
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem={false}
            disableTransitionOnChange
          >
            <AuthProvider>
              <UserCountryProvider>
                {children}
                <Toaster richColors position="top-right" />
              </UserCountryProvider>
            </AuthProvider>
          </ThemeProvider>
        </SessionProvider>
      </AuthErrorBoundary>
    </QueryClientProvider>
  )
} 