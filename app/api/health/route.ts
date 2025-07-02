import { NextResponse } from 'next/server'
import { checkDatabaseConnection } from '@/lib/db'
import { cacheManager } from '@/lib/cache-manager'
import { performanceMonitor } from '@/lib/performance-monitor'
import { addSecurityHeaders } from '@/lib/security'
import { logger } from '@/lib/logger'

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'down'
  timestamp: string
  checks: {
    database: {
      status: 'healthy' | 'degraded' | 'down'
      responseTime: number
      error?: string
    }
    cache: {
      status: 'healthy' | 'degraded' | 'down'
      responseTime: number
      error?: string
    }
    memory: {
      status: 'healthy' | 'degraded' | 'down'
      usage: number
      limit: number
    }
    uptime: {
      status: 'healthy'
      uptime: number
    }
  }
  performance: {
    avgResponseTime: number
    totalRequests: number
    slowRequests: number
  }
  version: string
}

export async function GET() {
  const startTime = Date.now()
  const healthStatus: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: { status: 'down', responseTime: 0 },
      cache: { status: 'down', responseTime: 0 },
      memory: { status: 'down', usage: 0, limit: 0 },
      uptime: { status: 'healthy', uptime: 0 }
    },
    performance: {
      avgResponseTime: 0,
      totalRequests: 0,
      slowRequests: 0
    },
    version: process.env.npm_package_version || '1.0.0'
  }

  try {
    // Check database connectivity
    const dbStartTime = Date.now()
    try {
      const isHealthy = await checkDatabaseConnection()
      const dbResponseTime = Date.now() - dbStartTime
      
      healthStatus.checks.database = {
        status: isHealthy ? 'healthy' : 'down',
        responseTime: dbResponseTime
      }
      
      if (!isHealthy) {
        healthStatus.status = 'degraded'
      }
    } catch (error) {
      healthStatus.checks.database = {
        status: 'down',
        responseTime: Date.now() - dbStartTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      healthStatus.status = 'degraded'
    }

    // Check cache connectivity
    const cacheStartTime = Date.now()
    try {
      const testKey = 'health-check-test'
      await cacheManager.set(testKey, { test: true }, { ttl: 60, prefix: 'health' })
      const cached = await cacheManager.get(testKey, { prefix: 'health' })
      await cacheManager.delete(testKey, { prefix: 'health' })
      
      const cacheResponseTime = Date.now() - cacheStartTime
      healthStatus.checks.cache = {
        status: cached ? 'healthy' : 'degraded',
        responseTime: cacheResponseTime
      }
      
      if (!cached) {
        healthStatus.status = 'degraded'
      }
    } catch (error) {
      healthStatus.checks.cache = {
        status: 'down',
        responseTime: Date.now() - cacheStartTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      healthStatus.status = 'degraded'
    }

    // Check memory usage
    const memUsage = process.memoryUsage()
    const memoryUsageMB = memUsage.heapUsed / 1024 / 1024
    const memoryLimitMB = memUsage.heapTotal / 1024 / 1024
    const memoryPercentage = (memoryUsageMB / memoryLimitMB) * 100
    
    healthStatus.checks.memory = {
      status: memoryPercentage < 80 ? 'healthy' : memoryPercentage < 90 ? 'degraded' : 'down',
      usage: Math.round(memoryUsageMB * 100) / 100,
      limit: Math.round(memoryLimitMB * 100) / 100
    }
    
    if (memoryPercentage > 90) {
      healthStatus.status = 'degraded'
    }

    // Check uptime
    healthStatus.checks.uptime = {
      status: 'healthy',
      uptime: Math.floor(process.uptime())
    }

    // Get performance metrics
    const metrics = performanceMonitor.getRecentMetrics(100)
    if (metrics.length > 0) {
      const avgResponseTime = metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length
      const slowRequests = metrics.filter(m => m.responseTime > 1000).length
      
      healthStatus.performance = {
        avgResponseTime: Math.round(avgResponseTime * 100) / 100,
        totalRequests: metrics.length,
        slowRequests
      }
    }

    // Determine overall status
    const failedChecks = Object.values(healthStatus.checks).filter(check => check.status === 'down').length
    if (failedChecks > 0) {
      healthStatus.status = failedChecks >= 2 ? 'down' : 'degraded'
    }

    const responseTime = Date.now() - startTime
    
    logger.info('Health check completed', {
      tags: ['health', 'check'],
      data: {
        status: healthStatus.status,
        responseTime,
        checks: healthStatus.checks,
        performance: healthStatus.performance
      }
    })

    const response = NextResponse.json(healthStatus, {
      status: healthStatus.status === 'down' ? 503 : 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Check': 'true',
        'X-Response-Time': `${responseTime}ms`
      }
    })

    return addSecurityHeaders(response)

  } catch (error) {
    logger.error('Health check failed', {
      tags: ['health', 'error'],
      error: error instanceof Error ? error : undefined
    })

    healthStatus.status = 'down'
    healthStatus.checks.database.error = 'Health check failed'
    
    const response = NextResponse.json(healthStatus, {
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Check': 'true'
      }
    })

    return addSecurityHeaders(response)
  }
} 