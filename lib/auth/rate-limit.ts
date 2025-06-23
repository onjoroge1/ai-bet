import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
})

const RATE_LIMIT_WINDOW = 60 * 60 // 1 hour in seconds
const MAX_ATTEMPTS = 5 // Maximum number of attempts within the window

export async function checkRateLimit(identifier: string): Promise<boolean> {
  const key = `rate-limit:${identifier}`
  const attempts = await redis.incr(key)
  
  if (attempts === 1) {
    await redis.expire(key, RATE_LIMIT_WINDOW)
  }
  
  return attempts <= MAX_ATTEMPTS
}

export async function resetRateLimit(identifier: string): Promise<void> {
  const key = `rate-limit:${identifier}`
  await redis.del(key)
} 