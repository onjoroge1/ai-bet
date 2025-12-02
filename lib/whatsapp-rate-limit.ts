/**
 * WhatsApp Rate Limiting
 * Uses Redis to track message counts per user
 */

import { cacheManager } from '@/lib/cache-manager';
import { logger } from '@/lib/logger';

const RATE_LIMIT_PREFIX = 'whatsapp:rate-limit';
const MAX_MESSAGES_PER_MINUTE = 10;
const MAX_MESSAGES_PER_HOUR = 50;
const WINDOW_MINUTE = 60; // 1 minute in seconds
const WINDOW_HOUR = 3600; // 1 hour in seconds

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  limit: number;
}

/**
 * Check rate limit for a WhatsApp user
 * @param waId - WhatsApp user ID
 * @returns Rate limit result
 */
export async function checkWhatsAppRateLimit(waId: string): Promise<RateLimitResult> {
  try {
    const now = Math.floor(Date.now() / 1000);
    
    // Check per-minute limit
    const minuteKey = `${RATE_LIMIT_PREFIX}:minute:${waId}`;
    const minuteCount = await cacheManager.get<number>(minuteKey, {
      prefix: '',
      ttl: WINDOW_MINUTE,
    }) || 0;

    if (minuteCount >= MAX_MESSAGES_PER_MINUTE) {
      logger.warn('WhatsApp rate limit exceeded (per minute)', {
        waId,
        count: minuteCount,
        limit: MAX_MESSAGES_PER_MINUTE,
      });
      
      return {
        allowed: false,
        remaining: 0,
        resetTime: now + WINDOW_MINUTE,
        limit: MAX_MESSAGES_PER_MINUTE,
      };
    }

    // Check per-hour limit
    const hourKey = `${RATE_LIMIT_PREFIX}:hour:${waId}`;
    const hourCount = await cacheManager.get<number>(hourKey, {
      prefix: '',
      ttl: WINDOW_HOUR,
    }) || 0;

    if (hourCount >= MAX_MESSAGES_PER_HOUR) {
      logger.warn('WhatsApp rate limit exceeded (per hour)', {
        waId,
        count: hourCount,
        limit: MAX_MESSAGES_PER_HOUR,
      });
      
      return {
        allowed: false,
        remaining: 0,
        resetTime: now + WINDOW_HOUR,
        limit: MAX_MESSAGES_PER_HOUR,
      };
    }

    // Increment counters
    await cacheManager.set(minuteKey, minuteCount + 1, {
      prefix: '',
      ttl: WINDOW_MINUTE,
    });

    await cacheManager.set(hourKey, hourCount + 1, {
      prefix: '',
      ttl: WINDOW_HOUR,
    });

    return {
      allowed: true,
      remaining: Math.min(
        MAX_MESSAGES_PER_MINUTE - minuteCount - 1,
        MAX_MESSAGES_PER_HOUR - hourCount - 1
      ),
      resetTime: now + WINDOW_MINUTE,
      limit: MAX_MESSAGES_PER_MINUTE,
    };
  } catch (error) {
    // If Redis fails, allow the request but log the error
    logger.error('Error checking WhatsApp rate limit', {
      waId,
      error: error instanceof Error ? error : undefined,
    });
    
    // Fail open - allow request if rate limiting fails
    return {
      allowed: true,
      remaining: MAX_MESSAGES_PER_MINUTE,
      resetTime: Math.floor(Date.now() / 1000) + WINDOW_MINUTE,
      limit: MAX_MESSAGES_PER_MINUTE,
    };
  }
}

