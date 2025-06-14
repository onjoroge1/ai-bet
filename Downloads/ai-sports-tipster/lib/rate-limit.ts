import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

let redis: Redis | null = null

try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  }
} catch (error) {
  console.error('Failed to initialize Redis client:', error)
}

const RATE_LIMIT_WINDOW = 60 * 60 // 1 hour in seconds
const MAX_ATTEMPTS = 5 // Maximum number of attempts within the window

export async function rateLimit(identifier: string): Promise<{ success: boolean; remaining: number }> {
  if (!redis) {
    // If Redis is not configured, allow all requests
    return { success: true, remaining: MAX_ATTEMPTS }
  }

  try {
    const key = `rate-limit:${identifier}`
    const attempts = await redis.incr(key)
    
    if (attempts === 1) {
      await redis.expire(key, RATE_LIMIT_WINDOW)
    }
    
    const remaining = Math.max(0, MAX_ATTEMPTS - attempts)
    const success = attempts <= MAX_ATTEMPTS
    
    return { success, remaining }
  } catch (error) {
    console.error('Rate limit error:', error)
    // If Redis operations fail, allow the request
    return { success: true, remaining: MAX_ATTEMPTS }
  }
}

export async function resetRateLimit(identifier: string): Promise<void> {
  if (!redis) return

  try {
    const key = `rate-limit:${identifier}`
    await redis.del(key)
  } catch (error) {
    console.error('Reset rate limit error:', error)
  }
}

export async function withRateLimit(
  identifier: string,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const { success, remaining } = await rateLimit(identifier)
  
  if (!success) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      { status: 429, headers: { 'X-RateLimit-Remaining': remaining.toString() } }
    )
  }
  
  return handler()
} 