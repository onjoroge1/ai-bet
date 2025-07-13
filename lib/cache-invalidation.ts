import { cacheManager } from './cache-manager'
import { logger } from './logger'

/**
 * Cache invalidation utilities for maintaining cache consistency
 */
export class CacheInvalidation {
  /**
   * Invalidate homepage free tip cache
   */
  static async invalidateHomepageFreeTip(): Promise<void> {
    try {
      await cacheManager.delete('current-free-tip', { prefix: 'homepage-free-tip' })
      logger.debug('Cache invalidation - Homepage free tip', {
        tags: ['cache', 'invalidation', 'homepage-free-tip']
      })
    } catch (error) {
      logger.warn('Cache invalidation failed - Homepage free tip', {
        tags: ['cache', 'invalidation', 'error'],
        error: error instanceof Error ? error : undefined
      })
    }
  }

  /**
   * Invalidate user notifications cache
   */
  static async invalidateUserNotifications(userId: string): Promise<void> {
    try {
      // Invalidate all notification patterns for this user
      await cacheManager.invalidatePattern(`*:notifications:${userId}:*`)
      logger.debug('Cache invalidation - User notifications', {
        tags: ['cache', 'invalidation', 'user-notifications'],
        data: { userId }
      })
    } catch (error) {
      logger.warn('Cache invalidation failed - User notifications', {
        tags: ['cache', 'invalidation', 'error'],
        error: error instanceof Error ? error : undefined,
        data: { userId }
      })
    }
  }

  /**
   * Invalidate user predictions timeline cache
   */
  static async invalidateUserTimeline(userId: string): Promise<void> {
    try {
      // Invalidate all timeline patterns for this user
      await cacheManager.invalidatePattern(`*:timeline:${userId}:*`)
      logger.debug('Cache invalidation - User timeline', {
        tags: ['cache', 'invalidation', 'predictions-timeline'],
        data: { userId }
      })
    } catch (error) {
      logger.warn('Cache invalidation failed - User timeline', {
        tags: ['cache', 'invalidation', 'error'],
        error: error instanceof Error ? error : undefined,
        data: { userId }
      })
    }
  }

  /**
   * Invalidate all user-related caches
   */
  static async invalidateUserCaches(userId: string): Promise<void> {
    await Promise.all([
      this.invalidateUserNotifications(userId),
      this.invalidateUserTimeline(userId)
    ])
  }

  /**
   * Invalidate prediction-related caches
   */
  static async invalidatePredictionCaches(predictionId: string): Promise<void> {
    try {
      // Invalidate homepage free tip if this prediction was featured
      await this.invalidateHomepageFreeTip()
      
      // Invalidate all timeline caches (since prediction data changed)
      await cacheManager.invalidatePattern(`*:timeline:*`)
      
      logger.debug('Cache invalidation - Prediction caches', {
        tags: ['cache', 'invalidation', 'prediction'],
        data: { predictionId }
      })
    } catch (error) {
      logger.warn('Cache invalidation failed - Prediction caches', {
        tags: ['cache', 'invalidation', 'error'],
        error: error instanceof Error ? error : undefined,
        data: { predictionId }
      })
    }
  }

  /**
   * Invalidate match-related caches
   */
  static async invalidateMatchCaches(matchId: string): Promise<void> {
    try {
      // Invalidate homepage free tip if this match had a free tip
      await this.invalidateHomepageFreeTip()
      
      // Invalidate all timeline caches (since match data changed)
      await cacheManager.invalidatePattern(`*:timeline:*`)
      
      logger.debug('Cache invalidation - Match caches', {
        tags: ['cache', 'invalidation', 'match'],
        data: { matchId }
      })
    } catch (error) {
      logger.warn('Cache invalidation failed - Match caches', {
        tags: ['cache', 'invalidation', 'error'],
        error: error instanceof Error ? error : undefined,
        data: { matchId }
      })
    }
  }
} 