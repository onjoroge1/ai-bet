import { cacheManager } from '@/lib/cache-manager';
import { logger } from '@/lib/logger';

const CACHE_KEY = 'market:upcoming';
const CACHE_PREFIX = 'whatsapp';
const CACHE_TTL = 600; // 10 minutes in seconds

// Check if Redis is available
const isRedisAvailable = () => {
  try {
    return !!process.env.REDIS_URL && !!process.env.REDIS_TOKEN;
  } catch {
    return false;
  }
};

interface CachedMarketData {
  matches: any[];
  cachedAt: string;
  total_count: number;
}

/**
 * Get cached upcoming matches from Redis
 */
export async function getCachedUpcomingMatches(): Promise<CachedMarketData | null> {
  if (!isRedisAvailable()) {
    logger.debug('Redis not available, skipping cache', {
      tags: ['whatsapp', 'cache', 'market'],
    });
    return null;
  }

  try {
    const cached = await cacheManager.get<CachedMarketData>(CACHE_KEY, {
      prefix: CACHE_PREFIX,
      ttl: CACHE_TTL,
    });

    if (cached) {
      logger.debug('Market API cache hit', {
        tags: ['whatsapp', 'cache', 'market'],
        data: {
          matchCount: cached.matches?.length || 0,
          cachedAt: cached.cachedAt,
        },
      });
      return cached;
    }

    logger.debug('Market API cache miss', {
      tags: ['whatsapp', 'cache', 'market'],
    });
    return null;
  } catch (error) {
    logger.warn('Error getting cached market data', {
      tags: ['whatsapp', 'cache', 'market', 'error'],
      error: error instanceof Error ? error : undefined,
    });
    return null;
  }
}

/**
 * Set cached upcoming matches in Redis
 */
export async function setCachedUpcomingMatches(
  data: { matches: any[]; total_count: number }
): Promise<boolean> {
  if (!isRedisAvailable()) {
    logger.debug('Redis not available, skipping cache set', {
      tags: ['whatsapp', 'cache', 'market'],
    });
    return false;
  }

  try {
    const cacheData: CachedMarketData = {
      matches: data.matches,
      total_count: data.total_count,
      cachedAt: new Date().toISOString(),
    };

    const success = await cacheManager.set(CACHE_KEY, cacheData, {
      prefix: CACHE_PREFIX,
      ttl: CACHE_TTL,
    });

    if (success) {
      logger.info('Market API data cached successfully', {
        tags: ['whatsapp', 'cache', 'market'],
        data: {
          matchCount: data.matches.length,
          totalCount: data.total_count,
        },
      });
    }

    return success;
  } catch (error) {
    logger.warn('Error caching market data', {
      tags: ['whatsapp', 'cache', 'market', 'error'],
      error: error instanceof Error ? error : undefined,
    });
    return false;
  }
}

/**
 * Invalidate cached upcoming matches (optional, for admin use)
 */
export async function invalidateUpcomingMatchesCache(): Promise<boolean> {
  try {
    const success = await cacheManager.delete(CACHE_KEY, {
      prefix: CACHE_PREFIX,
    });

    if (success) {
      logger.info('Market API cache invalidated', {
        tags: ['whatsapp', 'cache', 'market'],
      });
    }

    return success;
  } catch (error) {
    logger.warn('Error invalidating market cache', {
      tags: ['whatsapp', 'cache', 'market', 'error'],
      error: error instanceof Error ? error : undefined,
    });
    return false;
  }
}

