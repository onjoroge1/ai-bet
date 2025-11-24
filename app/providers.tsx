"use client"

import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SessionProvider } from "next-auth/react"
import { ThemeProvider } from "@/components/theme-provider"
import { UserCountryProvider } from "@/contexts/user-country-context"
import { AuthProvider } from "@/components/auth-provider"
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
      <SessionProvider
        refetchInterval={60} // Refetch session every 60 seconds (6x less frequent - optimized for performance)
        refetchOnWindowFocus={false} // Only when needed (reduces excessive API calls)
        // basePath is not needed - NextAuth defaults to /api/auth
        // 🔥 OPTIMIZED: Reduced refetch frequency to improve performance
        // Critical auth decisions use /api/auth/session directly (server-side first)
        // useSession() is used only for UI display (non-blocking)
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
    </QueryClientProvider>
  )
} 