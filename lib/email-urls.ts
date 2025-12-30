import { logger } from '@/lib/logger'

/**
 * Default production URL - used as fallback if NEXT_PUBLIC_APP_URL is not set
 */
const DEFAULT_PRODUCTION_URL = 'https://www.snapbet.bet'

/**
 * Get the application URL with proper environment handling
 * Uses https://www.snapbet.bet as default in production if NEXT_PUBLIC_APP_URL is not set
 */
export function getAppUrl(providedUrl?: string): string {
  // Prefer provided URL
  if (providedUrl) {
    return providedUrl
  }

  // Use environment variable
  const envUrl = process.env.NEXT_PUBLIC_APP_URL
  if (envUrl) {
    return envUrl
  }

  // In production, use default production URL instead of throwing error
  if (process.env.NODE_ENV === 'production') {
    logger.warn('NEXT_PUBLIC_APP_URL not set in production, using default production URL', {
      environment: process.env.NODE_ENV,
      defaultUrl: DEFAULT_PRODUCTION_URL,
    })
    return DEFAULT_PRODUCTION_URL
  }

  // Only allow localhost in development
  if (process.env.NODE_ENV === 'development') {
    logger.warn('Using localhost fallback for appUrl in development mode', {
      environment: process.env.NODE_ENV,
    })
    return 'http://localhost:3000'
  }

  // Fallback for other environments (testing, etc.) - use production URL
  logger.warn('Using default production URL fallback', {
    environment: process.env.NODE_ENV,
    defaultUrl: DEFAULT_PRODUCTION_URL,
  })
  return DEFAULT_PRODUCTION_URL
}

/**
 * Get password reset URL
 */
export function getPasswordResetUrl(token: string, appUrl?: string): string {
  const baseUrl = appUrl || getAppUrl()
  return `${baseUrl}/reset-password?token=${token}`
}

/**
 * Get email verification URL
 */
export function getEmailVerificationUrl(token: string, appUrl?: string): string {
  const baseUrl = appUrl || getAppUrl()
  return `${baseUrl}/verify-email?token=${token}`
}

/**
 * Validate email configuration
 * Logs warnings but doesn't throw errors (uses default production URL as fallback)
 * Call this during application startup
 */
export function validateEmailConfiguration(): void {
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.NEXT_PUBLIC_APP_URL) {
      logger.warn(
        'NEXT_PUBLIC_APP_URL environment variable is not set in production. ' +
        `Using default production URL: ${DEFAULT_PRODUCTION_URL}. ` +
        'Consider setting NEXT_PUBLIC_APP_URL for better control.'
      )
      return // Don't throw error, just log warning
    }

    // Validate URL format if set
    try {
      const url = new URL(process.env.NEXT_PUBLIC_APP_URL)
      if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        logger.warn(
          `NEXT_PUBLIC_APP_URL has invalid protocol: ${url.protocol}. ` +
          `Using default production URL: ${DEFAULT_PRODUCTION_URL}`
        )
        return
      }
      logger.info('Email configuration validated successfully', {
        appUrl: process.env.NEXT_PUBLIC_APP_URL,
      })
    } catch (urlError) {
      logger.warn(
        `Invalid NEXT_PUBLIC_APP_URL format: ${process.env.NEXT_PUBLIC_APP_URL}. ` +
        `Using default production URL: ${DEFAULT_PRODUCTION_URL}`
      )
      // Don't throw error, just log warning
    }
  }
}
