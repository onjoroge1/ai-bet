import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'

// Input sanitization
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
}

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const key = identifier
  const windowStart = now - windowMs

  // Clean up expired entries
  for (const [k, v] of rateLimitStore.entries()) {
    if (v.resetTime < now) {
      rateLimitStore.delete(k)
    }
  }

  // Get or create rate limit entry
  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, {
      count: 0,
      resetTime: now + windowMs
    })
  }

  const entry = rateLimitStore.get(key)!
  
  // Check if window has reset
  if (entry.resetTime < now) {
    entry.count = 0
    entry.resetTime = now + windowMs
  }

  // Increment count
  entry.count++

  const allowed = entry.count <= maxRequests
  const remaining = Math.max(0, maxRequests - entry.count)

  if (!allowed) {
    logger.warn('Rate limit exceeded', {
      tags: ['security', 'rate-limit'],
      data: { identifier, count: entry.count, maxRequests }
    })
  }

  return {
    allowed,
    remaining,
    resetTime: entry.resetTime
  }
}

// Input validation schemas
export const validationSchemas = {
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name too long'),
  countryCode: z.string().length(2, 'Country code must be 2 characters'),
  userId: z.string().min(1, 'User ID is required'),
  matchId: z.string().min(1, 'Match ID is required'),
  packageId: z.string().min(1, 'Package ID is required'),
}

// Security headers middleware
export function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }

  return response
}

// CORS configuration
export function configureCORS(response: NextResponse, origin?: string): NextResponse {
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_APP_URL,
    'http://localhost:3000',
    'https://snapbet.com'
  ].filter(Boolean)

  const requestOrigin = origin || allowedOrigins[0]
  
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    response.headers.set('Access-Control-Allow-Origin', requestOrigin)
  }

  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')

  return response
}

// SQL injection prevention
export function sanitizeSQLInput(input: string): string {
  return input
    .replace(/['";\\]/g, '') // Remove SQL injection characters
    .replace(/--/g, '') // Remove SQL comments
    .replace(/\/\*.*?\*\//g, '') // Remove SQL block comments
}

// XSS prevention
export function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}

// CSRF token validation
export function validateCSRFToken(token: string, sessionToken?: string): boolean {
  if (!token || !sessionToken) {
    return false
  }
  
  // In production, use a proper CSRF token validation library
  // This is a simplified implementation
  return token === sessionToken
}

// Request validation middleware
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
  try {
    const validated = schema.parse(data)
    return { success: true, data: validated }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      }
    }
    return { success: false, errors: ['Validation failed'] }
  }
}

// Audit logging
export function logSecurityEvent(
  event: string,
  data: Record<string, any>,
  severity: 'info' | 'warn' | 'error' = 'info'
) {
  logger[severity]('Security event', {
    tags: ['security', event],
    data: {
      ...data,
      timestamp: new Date().toISOString(),
      userAgent: data.userAgent,
      ip: data.ip
    }
  })
} 