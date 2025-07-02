import { NextResponse, NextRequest } from 'next/server'
import { getCountryByCode } from '@/lib/countries'
import { PrismaClient } from "@prisma/client"
import { cacheManager } from '@/lib/cache-manager'
import { withPerformanceMonitoring } from '@/lib/performance-monitor'
import { createErrorResponse, Errors } from '@/lib/error-handler'
import { addSecurityHeaders } from '@/lib/security'
import { logger } from '@/lib/logger'

const prisma = new PrismaClient()

// GET /api/countries - Public endpoint for signup form
export const GET = withPerformanceMonitoring(async () => {
  try {
    const cacheKey = 'all-countries'
    
    // Try to get from cache first
    const cachedCountries = await cacheManager.get(cacheKey, {
      ttl: 86400, // 24 hours
      prefix: 'countries'
    })

    if (cachedCountries) {
      logger.debug('Countries served from cache', {
        tags: ['api', 'countries', 'cache-hit']
      })
      
      const response = NextResponse.json(cachedCountries, {
        headers: {
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
          'X-Cache': 'HIT'
        }
      })
      
      return addSecurityHeaders(response)
    }

    // Fetch fresh data from database with optimized query
    logger.info('Fetching countries from database', {
      tags: ['api', 'countries', 'cache-miss']
    })
    
    const countries = await prisma.country.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        flagEmoji: true,
        currencyCode: true,
        currencySymbol: true,
        brandName: true,
        tagline: true,
        marketContext: true,
        isActive: true
      },
      // Add limit to prevent memory issues
      take: 250
    })
    
    // Cache the results asynchronously to not block the response
    cacheManager.set(cacheKey, countries, {
      ttl: 86400, // 24 hours
      prefix: 'countries'
    }).catch(error => {
      logger.warn('Failed to cache countries data', {
        tags: ['api', 'countries', 'cache-error'],
        error: error instanceof Error ? error : undefined
      })
    })
    
    const response = NextResponse.json(countries, {
      headers: {
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'X-Cache': 'MISS'
      }
    })
    
    return addSecurityHeaders(response)
    
  } catch (error) {
    logger.error('Error fetching countries', {
      tags: ['api', 'countries', 'error'],
      error: error instanceof Error ? error : undefined
    })
    
    return createErrorResponse(
      Errors.DatabaseError('Failed to fetch countries'),
      'countries-api'
    )
  }
})

// POST /api/countries - For country detection
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { countryCode } = body

    if (!countryCode) {
      return NextResponse.json({ error: 'Country code is required' }, { status: 400 })
    }

    const country = getCountryByCode(countryCode)
    if (!country) {
      return NextResponse.json({ error: 'Invalid country code' }, { status: 400 })
    }

    return NextResponse.json(country)
  } catch (error) {
    console.error('Error processing country request:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PUT /api/countries - Invalidate cache (admin only)
export async function PUT(request: NextRequest) {
  try {
    // Clear the countries cache
    const cacheKey = 'all-countries'
    await cacheManager.delete(cacheKey, { prefix: 'countries' })
    
    logger.info('Countries cache invalidated', {
      tags: ['api', 'countries', 'cache-invalidate']
    })
    
    const response = NextResponse.json({ 
      message: 'Cache invalidated successfully',
      timestamp: Date.now()
    })
    
    return addSecurityHeaders(response)
    
  } catch (error) {
    logger.error('Error invalidating countries cache', {
      tags: ['api', 'countries', 'cache-error'],
      error: error instanceof Error ? error : undefined
    })
    
    return createErrorResponse(
      Errors.DatabaseError('Failed to invalidate cache'),
      'countries-cache-invalidate'
    )
  }
} 