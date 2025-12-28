import { logger } from './logger'

/**
 * Retry helper with exponential backoff and maximum delay cap
 * 
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param initialDelay - Initial delay in milliseconds (default: 2000)
 * @param maxDelay - Maximum delay cap in milliseconds (default: 30000)
 * @returns Promise that resolves with the function result or throws the last error
 * 
 * @example
 * ```typescript
 * const result = await retryWithBackoff(
 *   () => fetchMatchesFromAPI('live', 100),
 *   3,    // Max 3 retries
 *   2000, // Initial 2 second delay
 *   30000 // Max 30 second delay cap
 * )
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 2000,
  maxDelay: number = 30000
): Promise<T> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error')
      
      if (attempt < maxRetries - 1) {
        // Calculate exponential backoff: initialDelay * 2^attempt
        const calculatedDelay = initialDelay * Math.pow(2, attempt)
        // Cap at maxDelay to prevent excessive delays
        const delay = Math.min(calculatedDelay, maxDelay)
        
        logger.warn(`Retry attempt ${attempt + 1}/${maxRetries} failed, retrying in ${delay}ms`, {
          tags: ['retry', 'backoff'],
          error: lastError,
          attempt: attempt + 1,
          maxRetries,
          delay,
          calculatedDelay,
        })
        
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  // All retries exhausted, throw the last error
  if (lastError) {
    logger.error(`All ${maxRetries} retry attempts failed`, {
      tags: ['retry', 'exhausted'],
      error: lastError,
      maxRetries,
    })
    throw lastError
  }
  
  throw new Error('Retry failed with unknown error')
}

