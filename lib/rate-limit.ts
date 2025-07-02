import { NextRequest, NextResponse } from "next/server"

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
  keyGenerator?: (req: NextRequest) => string // Custom key generator
}

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

// In-memory store (consider Redis for production)
const store: RateLimitStore = {}

// Helper function to get IP address from request
function getClientIP(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         req.headers.get('x-real-ip') ||
         req.headers.get('cf-connecting-ip') ||
         'unknown'
}

export function createRateLimiter(config: RateLimitConfig) {
  return async function rateLimit(req: NextRequest) {
    const key = config.keyGenerator 
      ? config.keyGenerator(req) 
      : getClientIP(req)
    
    const now = Date.now()
    const windowStart = now - config.windowMs
    
    // Clean up expired entries
    Object.keys(store).forEach(k => {
      if (store[k].resetTime < now) {
        delete store[k]
      }
    })
    
    // Get or create rate limit entry
    if (!store[key]) {
      store[key] = {
        count: 0,
        resetTime: now + config.windowMs
      }
    }
    
    // Check if window has reset
    if (store[key].resetTime < now) {
      store[key] = {
        count: 0,
        resetTime: now + config.windowMs
      }
    }
    
    // Increment count
    store[key].count++
    
    // Check if limit exceeded
    if (store[key].count > config.maxRequests) {
      const retryAfter = Math.ceil((store[key].resetTime - now) / 1000)
      
      return NextResponse.json(
        { 
          error: "Rate limit exceeded",
          retryAfter,
          limit: config.maxRequests,
          windowMs: config.windowMs
        },
        { 
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': config.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': store[key].resetTime.toString()
          }
        }
      )
    }
    
    // Add rate limit headers
    const response = NextResponse.next()
    response.headers.set('X-RateLimit-Limit', config.maxRequests.toString())
    response.headers.set('X-RateLimit-Remaining', (config.maxRequests - store[key].count).toString())
    response.headers.set('X-RateLimit-Reset', store[key].resetTime.toString())
    
    return response
  }
}

// Predefined rate limiters
export const rateLimiters = {
  // Quiz API - 10 requests per minute
  quiz: createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    keyGenerator: (req) => {
      // Use user ID if available, otherwise IP
      const userId = req.headers.get('x-user-id')
      return userId || getClientIP(req)
    }
  }),
  
  // General API - 100 requests per minute
  general: createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100
  }),
  
  // Auth endpoints - 5 requests per minute
  auth: createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5
  })
} 