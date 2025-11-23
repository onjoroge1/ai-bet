/**
 * Session Sync Utility
 * 
 * Provides utilities for synchronizing client-side useSession() with server-side /api/auth/session
 * Ensures immediate synchronization after login/logout actions
 */

import { logger } from "@/lib/logger"

export interface SessionSyncOptions {
  /** Maximum number of retries if sync fails */
  maxRetries?: number
  /** Delay between retries in milliseconds */
  retryDelay?: number
  /** Timeout in milliseconds for sync verification */
  timeout?: number
}

const DEFAULT_OPTIONS: Required<SessionSyncOptions> = {
  maxRetries: 3,
  retryDelay: 100,
  timeout: 2000,
}

/**
 * Fetches the current session from the API endpoint
 */
export async function fetchApiSession(): Promise<any> {
  try {
    const res = await fetch("/api/auth/session", {
      cache: "no-store",
      credentials: "include",
    } as RequestInit & { cache?: "no-store" })
    if (!res.ok) {
      throw new Error(`Failed to fetch session: ${res.status}`)
    }
    return await res.json()
  } catch (error) {
    logger.error("Failed to fetch API session", {
      tags: ["auth", "session-sync"],
      error: error instanceof Error ? error : undefined,
    })
    throw error
  }
}

/**
 * Verifies that the session matches the expected state
 */
export function verifySessionSync(
  apiSession: any,
  expectedState: "authenticated" | "unauthenticated",
  expectedUserId?: string
): boolean {
  const hasUser = !!apiSession?.user
  const userId = apiSession?.user?.id || (apiSession?.user as any)?.id

  if (expectedState === "authenticated") {
    if (!hasUser) {
      logger.warn("Session sync verification failed: Expected authenticated but API returned unauthenticated", {
        tags: ["auth", "session-sync"],
        data: { apiSession },
      })
      return false
    }
    if (expectedUserId && userId !== expectedUserId) {
      logger.warn("Session sync verification failed: User ID mismatch", {
        tags: ["auth", "session-sync"],
        data: { expectedUserId, actualUserId: userId },
      })
      return false
    }
    return true
  } else {
    if (hasUser) {
      logger.warn("Session sync verification failed: Expected unauthenticated but API returned authenticated", {
        tags: ["auth", "session-sync"],
        data: { apiSession },
      })
      return false
    }
    return true
  }
}

/**
 * Waits for the session to be in sync with the expected state
 * Polls the API endpoint until sync is verified or timeout occurs
 */
export async function waitForSessionSync(
  expectedState: "authenticated" | "unauthenticated",
  updateSession: () => Promise<any>,
  options: SessionSyncOptions = {}
): Promise<boolean> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const startTime = Date.now()

  logger.info("Waiting for session sync", {
    tags: ["auth", "session-sync"],
    data: { expectedState, timeout: opts.timeout },
  })

  // First, trigger an update to refresh the client session
  try {
    await updateSession()
  } catch (error) {
    logger.warn("Session update failed, continuing with verification", {
      tags: ["auth", "session-sync"],
      error: error instanceof Error ? error : undefined,
    })
  }

  // Wait a bit for the update to propagate
  await new Promise((resolve) => setTimeout(resolve, 100))

  // Poll API endpoint until sync is verified
  for (let attempt = 0; attempt < opts.maxRetries; attempt++) {
    // Check timeout
    if (Date.now() - startTime > opts.timeout) {
      logger.warn("Session sync timeout", {
        tags: ["auth", "session-sync"],
        data: { expectedState, elapsed: Date.now() - startTime },
      })
      return false
    }

    try {
      // Fetch API session
      const apiSession = await fetchApiSession()

      // Verify sync
      const isSynced = verifySessionSync(apiSession, expectedState)

      if (isSynced) {
        logger.info("Session sync verified", {
          tags: ["auth", "session-sync"],
          data: {
            expectedState,
            attempt: attempt + 1,
            elapsed: Date.now() - startTime,
          },
        })
        return true
      }

      // If not synced, trigger another update and wait
      if (attempt < opts.maxRetries - 1) {
        await updateSession()
        await new Promise((resolve) => setTimeout(resolve, opts.retryDelay))
      }
    } catch (error) {
      logger.warn("Session sync verification attempt failed", {
        tags: ["auth", "session-sync"],
        error: error instanceof Error ? error : undefined,
        data: { attempt: attempt + 1 },
      })

      if (attempt < opts.maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, opts.retryDelay))
      }
    }
  }

  logger.warn("Session sync verification failed after all retries", {
    tags: ["auth", "session-sync"],
    data: { expectedState, attempts: opts.maxRetries },
  })
  return false
}

/**
 * Forces immediate session synchronization
 * Triggers update() and verifies sync within a short timeout
 */
export async function syncSession(
  updateSession: () => Promise<any>,
  expectedState: "authenticated" | "unauthenticated",
  options: SessionSyncOptions = {}
): Promise<boolean> {
  const opts = { ...DEFAULT_OPTIONS, timeout: 1000, ...options }

  logger.info("Forcing session sync", {
    tags: ["auth", "session-sync"],
    data: { expectedState },
  })

  try {
    // Trigger immediate update
    await updateSession()

    // Verify sync (with shorter timeout for immediate sync)
    const isSynced = await waitForSessionSync(expectedState, updateSession, opts)

    if (isSynced) {
      logger.info("Session sync completed successfully", {
        tags: ["auth", "session-sync"],
        data: { expectedState },
      })
      return true
    } else {
      logger.warn("Session sync completed but verification failed", {
        tags: ["auth", "session-sync"],
        data: { expectedState },
      })
      return false
    }
  } catch (error) {
    logger.error("Session sync failed", {
      tags: ["auth", "session-sync"],
      error: error instanceof Error ? error : undefined,
      data: { expectedState },
    })
    return false
  }
}

/**
 * Sets up a session change listener that triggers callback when session state changes
 * Useful for debugging and monitoring session sync
 */
export function setupSessionChangeListener(
  callback: (apiSession: any) => void,
  interval: number = 2000
): () => void {
  let intervalId: NodeJS.Timeout | null = null
  let lastSession: string | null = null

  const checkSession = async () => {
    try {
      const apiSession = await fetchApiSession()
      const sessionString = JSON.stringify(apiSession)

      // Only trigger callback if session changed
      if (sessionString !== lastSession) {
        lastSession = sessionString
        callback(apiSession)
      }
    } catch (error) {
      logger.warn("Session change listener error", {
        tags: ["auth", "session-sync"],
        error: error instanceof Error ? error : undefined,
      })
    }
  }

  // Initial check
  checkSession()

  // Set up interval
  intervalId = setInterval(checkSession, interval)

  // Return cleanup function
  return () => {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }
}

