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
        refetchInterval={10} // Refetch session every 10 seconds to keep it in sync (reduced from 30 for faster sync)
        refetchOnWindowFocus={true} // Refetch when window regains focus
        refetchOnMount={true} // Refetch when component mounts for fresh session
        // basePath is not needed - NextAuth defaults to /api/auth
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