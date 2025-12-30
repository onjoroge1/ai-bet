import { validateEmailConfiguration } from './email-urls'
import { logger } from './logger'

/**
 * Validate all required configuration on application startup
 * Call this during app initialization
 * Note: This now logs warnings instead of throwing errors (uses default production URL)
 */
export function validateApplicationConfiguration(): void {
  try {
    // Validate email configuration (logs warnings, doesn't throw)
    validateEmailConfiguration()
    
    logger.info('Application configuration validated successfully')
  } catch (error) {
    // This should rarely happen now since validateEmailConfiguration doesn't throw
    logger.error('Application configuration validation failed', {
      error: error instanceof Error ? error : undefined,
    })
    
    // In development, log warning but continue
    if (process.env.NODE_ENV === 'development') {
      logger.warn('Continuing in development mode despite configuration issues', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

/**
 * Validate configuration for API routes
 * Call this at the start of API route handlers
 * Note: This now logs warnings instead of throwing errors
 */
export function validateApiConfiguration(): void {
  // Validate email configuration (logs warnings, doesn't throw)
  validateEmailConfiguration()
}

