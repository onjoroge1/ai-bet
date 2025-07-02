import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { checkDatabaseConnection } from '@/lib/db'

interface PerformanceMetrics {
  responseTime: number
  memoryUsage: number
  cpuUsage: number
  databaseStatus: 'healthy' | 'degraded' | 'down'
  timestamp: Date
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private metrics: PerformanceMetrics[] = []
  private readonly MAX_METRICS = 1000

  private constructor() {}

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  async recordRequest(
    req: NextRequest,
    res: NextResponse,
    startTime: number,
    context?: string
  ) {
    const endTime = Date.now()
    const responseTime = endTime - startTime

    // Get system metrics
    const memoryUsage = process.memoryUsage()
    const cpuUsage = process.cpuUsage()
    const databaseStatus = await this.checkDatabaseHealth()

    const metric: PerformanceMetrics = {
      responseTime,
      memoryUsage: memoryUsage.heapUsed / 1024 / 1024, // MB
      cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000, // seconds
      databaseStatus,
      timestamp: new Date()
    }

    this.metrics.push(metric)

    // Keep only recent metrics
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS)
    }

    // Log slow requests
    if (responseTime > 1000) {
      logger.warn('Slow API request detected', {
        tags: ['performance', 'slow-request'],
        data: {
          path: req.nextUrl.pathname,
          method: req.method,
          responseTime: `${responseTime}ms`,
          context,
          memoryUsage: `${metric.memoryUsage.toFixed(2)}MB`
        }
      })
    }

    // Log performance metrics periodically
    if (this.metrics.length % 100 === 0) {
      this.logPerformanceSummary()
    }

    return metric
  }

  private async checkDatabaseHealth(): Promise<'healthy' | 'degraded' | 'down'> {
    try {
      const isHealthy = await checkDatabaseConnection()
      return isHealthy ? 'healthy' : 'down'
    } catch (error) {
      return 'down'
    }
  }

  private logPerformanceSummary() {
    if (this.metrics.length === 0) return

    const recentMetrics = this.metrics.slice(-100)
    const avgResponseTime = recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length
    const avgMemoryUsage = recentMetrics.reduce((sum, m) => sum + m.memoryUsage, 0) / recentMetrics.length
    const slowRequests = recentMetrics.filter(m => m.responseTime > 1000).length

    logger.info('Performance summary', {
      tags: ['performance', 'summary'],
      data: {
        avgResponseTime: `${avgResponseTime.toFixed(2)}ms`,
        avgMemoryUsage: `${avgMemoryUsage.toFixed(2)}MB`,
        slowRequests,
        totalRequests: recentMetrics.length,
        databaseStatus: recentMetrics[recentMetrics.length - 1]?.databaseStatus
      }
    })

    // Memory optimization: clear old metrics if we have too many
    if (this.metrics.length > this.MAX_METRICS * 2) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS)
      logger.debug('Performance monitor: cleared old metrics to prevent memory leaks', {
        tags: ['performance', 'memory-optimization']
      })
    }
  }

  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics]
  }

  getRecentMetrics(limit: number = 100): PerformanceMetrics[] {
    return this.metrics.slice(-limit)
  }

  clearMetrics() {
    this.metrics = []
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance()

// Middleware wrapper for performance monitoring
export function withPerformanceMonitoring(handler: Function) {
  return async (req: NextRequest, ...args: any[]) => {
    const startTime = Date.now()
    
    try {
      const response = await handler(req, ...args)
      await performanceMonitor.recordRequest(req, response, startTime)
      return response
    } catch (error) {
      await performanceMonitor.recordRequest(req, new NextResponse(), startTime, 'error')
      throw error
    }
  }
} 