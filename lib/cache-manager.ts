import { Redis } from '@upstash/redis'
import { logger } from '@/lib/logger'

interface CacheConfig {
  ttl: number // Time to live in seconds
  prefix: string
  maxRetries?: number
}

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

class CacheManager {
  private redis: Redis
  private defaultTTL = 3600 // 1 hour
  private maxRetries = 3

  constructor() {
    this.redis = new Redis({
      url: process.env.REDIS_URL!,
      token: process.env.REDIS_TOKEN!,
    })
  }

  private getKey(prefix: string, key: string): string {
    return `${prefix}:${key}`
  }

  async get<T>(key: string, config: Partial<CacheConfig> = {}): Promise<T | null> {
    const { prefix = 'default', maxRetries = this.maxRetries } = config
    const fullKey = this.getKey(prefix, key)

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const cached = await this.redis.get<CacheEntry<T>>(fullKey)
        
        if (cached) {
          const now = Date.now()
          const isExpired = (now - cached.timestamp) / 1000 > cached.ttl
          
          if (!isExpired) {
            logger.debug('Cache hit', {
              tags: ['cache', 'hit'],
              data: { key: fullKey, prefix }
            })
            return cached.data
          } else {
            // Remove expired entry
            await this.redis.del(fullKey)
          }
        }

        logger.debug('Cache miss', {
          tags: ['cache', 'miss'],
          data: { key: fullKey, prefix, attempt }
        })
        return null

      } catch (error) {
        logger.warn('Cache get error', {
          tags: ['cache', 'error'],
          error: error instanceof Error ? error : undefined,
          data: { key: fullKey, attempt, maxRetries }
        })

        if (attempt === maxRetries) {
          return null
        }

        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100))
      }
    }

    return null
  }

  async set<T>(
    key: string, 
    data: T, 
    config: Partial<CacheConfig> = {}
  ): Promise<boolean> {
    const { ttl = this.defaultTTL, prefix = 'default', maxRetries = this.maxRetries } = config
    const fullKey = this.getKey(prefix, key)

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.redis.set(fullKey, entry, { ex: ttl })
        
        logger.debug('Cache set', {
          tags: ['cache', 'set'],
          data: { key: fullKey, prefix, ttl }
        })
        return true

      } catch (error) {
        logger.warn('Cache set error', {
          tags: ['cache', 'error'],
          error: error instanceof Error ? error : undefined,
          data: { key: fullKey, attempt, maxRetries }
        })

        if (attempt === maxRetries) {
          return false
        }

        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100))
      }
    }

    return false
  }

  async delete(key: string, config: Partial<CacheConfig> = {}): Promise<boolean> {
    const { prefix = 'default' } = config
    const fullKey = this.getKey(prefix, key)

    try {
      await this.redis.del(fullKey)
      logger.debug('Cache delete', {
        tags: ['cache', 'delete'],
        data: { key: fullKey, prefix }
      })
      return true
    } catch (error) {
      logger.warn('Cache delete error', {
        tags: ['cache', 'error'],
        error: error instanceof Error ? error : undefined,
        data: { key: fullKey, prefix }
      })
      return false
    }
  }

  async invalidatePattern(pattern: string): Promise<number> {
    try {
      // Note: This is a simplified implementation
      // In production, you might want to use SCAN for large datasets
      const keys = await this.redis.keys(pattern)
      if (keys.length > 0) {
        await this.redis.del(...keys)
      }
      
      logger.info('Cache pattern invalidation', {
        tags: ['cache', 'invalidate'],
        data: { pattern, keysDeleted: keys.length }
      })
      
      return keys.length
    } catch (error) {
      logger.error('Cache pattern invalidation error', {
        tags: ['cache', 'error'],
        error: error instanceof Error ? error : undefined,
        data: { pattern }
      })
      return 0
    }
  }

  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    config: Partial<CacheConfig> = {}
  ): Promise<T> {
    const cached = await this.get<T>(key, config)
    
    if (cached !== null) {
      return cached
    }

    const data = await fetcher()
    await this.set(key, data, config)
    return data
  }

  // Predefined cache configurations
  static readonly CONFIGS = {
    COUNTRIES: { ttl: 86400, prefix: 'countries' }, // 24 hours
    PREDICTIONS: { ttl: 3600, prefix: 'predictions' }, // 1 hour
    USER_PROFILE: { ttl: 1800, prefix: 'user' }, // 30 minutes
    PACKAGE_OFFERS: { ttl: 7200, prefix: 'packages' }, // 2 hours
    SYSTEM_HEALTH: { ttl: 300, prefix: 'health' }, // 5 minutes
  } as const
}

export const cacheManager = new CacheManager()

// Convenience functions
export const cache = {
  countries: (key: string) => cacheManager.get(key, CacheManager.CONFIGS.COUNTRIES),
  predictions: (key: string) => cacheManager.get(key, CacheManager.CONFIGS.PREDICTIONS),
  userProfile: (key: string) => cacheManager.get(key, CacheManager.CONFIGS.USER_PROFILE),
  packageOffers: (key: string) => cacheManager.get(key, CacheManager.CONFIGS.PACKAGE_OFFERS),
  systemHealth: (key: string) => cacheManager.get(key, CacheManager.CONFIGS.SYSTEM_HEALTH),
} 