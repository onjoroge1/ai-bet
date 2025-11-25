/**
 * Utility function for checking server-side session with retry logic for rate limits
 * 
 * This function handles 429 (rate limit) errors gracefully by retrying with exponential backoff.
 * It's used throughout the app for consistent session checking behavior.
 */

export interface SessionCheckOptions {
  maxRetries?: number
  baseDelay?: number
  onRateLimit?: (retryCount: number, delay: number) => void
}

export interface SessionCheckResult {
  session: any | null
  error: Error | null
  status: number | null
}

/**
 * Check server-side session with automatic retry on rate limits
 * 
 * @param options Configuration options
 * @returns Session data or null if not authenticated
 */
export async function checkServerSession(
  options: SessionCheckOptions = {}
): Promise<SessionCheckResult> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    onRateLimit,
  } = options

  const attemptCheck = async (retryCount = 0): Promise<SessionCheckResult> => {
    try {
      const res = await fetch('/api/auth/session', {
        cache: 'no-store',
        credentials: 'include',
      } as RequestInit & { cache?: 'no-store' })

      // Handle 429 (rate limit) with exponential backoff retry
      if (res.status === 429) {
        if (retryCount < maxRetries) {
          const delay = baseDelay * Math.pow(2, retryCount) // Exponential backoff
          
          if (onRateLimit) {
            onRateLimit(retryCount + 1, delay)
          }
          
          await new Promise(resolve => setTimeout(resolve, delay))
          return attemptCheck(retryCount + 1)
        } else {
          // Max retries reached - return null but don't throw error
          // This allows components to handle gracefully (e.g., keep existing state)
          return {
            session: null,
            error: new Error('Rate limited after max retries'),
            status: 429,
          }
        }
      }

      // Handle other non-OK responses
      if (!res.ok) {
        return {
          session: null,
          error: new Error(`Session check failed: ${res.status}`),
          status: res.status,
        }
      }

      // Parse and validate session
      const sessionData = await res.json() as any
      
      if (sessionData?.user) {
        return {
          session: sessionData,
          error: null,
          status: res.status,
        }
      } else {
        return {
          session: null,
          error: null,
          status: res.status,
        }
      }
    } catch (error) {
      return {
        session: null,
        error: error instanceof Error ? error : new Error('Unknown error'),
        status: null,
      }
    }
  }

  return attemptCheck()
}

