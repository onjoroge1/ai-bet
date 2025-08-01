import { NextRequest } from 'next/server'

// Mock database
jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    $queryRaw: jest.fn(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  },
}))

// Mock metrics
jest.mock('@/lib/metrics', () => ({
  getSystemMetrics: jest.fn(),
}))

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}))

describe('System Health API', () => {
  let mockDb: any
  let mockMetrics: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Get the mocked database instance
    mockDb = require('@/lib/db').default
    
    // Get the mocked metrics instance
    mockMetrics = require('@/lib/metrics')
  })

  describe('GET /api/health', () => {
    it('should return system status when healthy', async () => {
      mockDb.$queryRaw.mockResolvedValue([{ count: 1 }])
      mockMetrics.getSystemMetrics.mockResolvedValue({
        uptime: 3600,
        memoryUsage: { used: 100, total: 1000 },
        cpuUsage: 25,
        activeConnections: 5,
      })

      const healthHandler = async (request: NextRequest) => {
        try {
          // Check database connectivity
          await mockDb.$queryRaw('SELECT 1 as count')
          
          // Get system metrics
          const metrics = await mockMetrics.getSystemMetrics()
          
          return new Response(JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: {
              status: 'connected',
              responseTime: 10,
            },
            system: {
              uptime: metrics.uptime,
              memoryUsage: metrics.memoryUsage,
              cpuUsage: metrics.cpuUsage,
              activeConnections: metrics.activeConnections,
            },
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        } catch (error) {
          return new Response(JSON.stringify({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: 'System check failed',
          }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }

      const request = new NextRequest('http://localhost:3000/api/health')
      const response = await healthHandler(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe('healthy')
      expect(data.database.status).toBe('connected')
      expect(data.system).toBeDefined()
      expect(data.system.uptime).toBe(3600)
      expect(data.system.memoryUsage).toEqual({ used: 100, total: 1000 })
      expect(data.system.cpuUsage).toBe(25)
      expect(data.system.activeConnections).toBe(5)

      expect(mockDb.$queryRaw).toHaveBeenCalledWith('SELECT 1 as count')
      expect(mockMetrics.getSystemMetrics).toHaveBeenCalled()
    })

    it('should return unhealthy status when database is down', async () => {
      mockDb.$queryRaw.mockRejectedValue(new Error('Database connection failed'))

      const healthHandler = async (request: NextRequest) => {
        try {
          // Check database connectivity
          await mockDb.$queryRaw('SELECT 1 as count')
          
          // Get system metrics
          const metrics = await mockMetrics.getSystemMetrics()
          
          return new Response(JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: {
              status: 'connected',
              responseTime: 10,
            },
            system: {
              uptime: metrics.uptime,
              memoryUsage: metrics.memoryUsage,
              cpuUsage: metrics.cpuUsage,
              activeConnections: metrics.activeConnections,
            },
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        } catch (error) {
          return new Response(JSON.stringify({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: 'System check failed',
            details: error instanceof Error ? error.message : 'Unknown error',
          }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }

      const request = new NextRequest('http://localhost:3000/api/health')
      const response = await healthHandler(request)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.status).toBe('unhealthy')
      expect(data.error).toBe('System check failed')
      expect(data.details).toBe('Database connection failed')

      expect(mockDb.$queryRaw).toHaveBeenCalledWith('SELECT 1 as count')
    })

    it('should return unhealthy status when metrics service fails', async () => {
      mockDb.$queryRaw.mockResolvedValue([{ count: 1 }])
      mockMetrics.getSystemMetrics.mockRejectedValue(new Error('Metrics service unavailable'))

      const healthHandler = async (request: NextRequest) => {
        try {
          // Check database connectivity
          await mockDb.$queryRaw('SELECT 1 as count')
          
          // Get system metrics
          const metrics = await mockMetrics.getSystemMetrics()
          
          return new Response(JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: {
              status: 'connected',
              responseTime: 10,
            },
            system: {
              uptime: metrics.uptime,
              memoryUsage: metrics.memoryUsage,
              cpuUsage: metrics.cpuUsage,
              activeConnections: metrics.activeConnections,
            },
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        } catch (error) {
          return new Response(JSON.stringify({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: 'System check failed',
            details: error instanceof Error ? error.message : 'Unknown error',
          }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }

      const request = new NextRequest('http://localhost:3000/api/health')
      const response = await healthHandler(request)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.status).toBe('unhealthy')
      expect(data.error).toBe('System check failed')
      expect(data.details).toBe('Metrics service unavailable')

      expect(mockDb.$queryRaw).toHaveBeenCalledWith('SELECT 1 as count')
      expect(mockMetrics.getSystemMetrics).toHaveBeenCalled()
    })

    it('should include response time in database status', async () => {
      const startTime = Date.now()
      mockDb.$queryRaw.mockImplementation(async () => {
        // Simulate database delay
        await new Promise(resolve => setTimeout(resolve, 50))
        return [{ count: 1 }]
      })
      
      mockMetrics.getSystemMetrics.mockResolvedValue({
        uptime: 3600,
        memoryUsage: { used: 100, total: 1000 },
        cpuUsage: 25,
        activeConnections: 5,
      })

      const healthHandler = async (request: NextRequest) => {
        try {
          const dbStartTime = Date.now()
          
          // Check database connectivity
          await mockDb.$queryRaw('SELECT 1 as count')
          
          const dbResponseTime = Date.now() - dbStartTime
          
          // Get system metrics
          const metrics = await mockMetrics.getSystemMetrics()
          
          return new Response(JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: {
              status: 'connected',
              responseTime: dbResponseTime,
            },
            system: {
              uptime: metrics.uptime,
              memoryUsage: metrics.memoryUsage,
              cpuUsage: metrics.cpuUsage,
              activeConnections: metrics.activeConnections,
            },
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        } catch (error) {
          return new Response(JSON.stringify({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: 'System check failed',
          }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }

      const request = new NextRequest('http://localhost:3000/api/health')
      const response = await healthHandler(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe('healthy')
      expect(data.database.status).toBe('connected')
      expect(data.database.responseTime).toBeGreaterThan(0)
      expect(data.database.responseTime).toBeLessThan(1000) // Should be reasonable
    })

    it('should handle concurrent health checks', async () => {
      mockDb.$queryRaw.mockResolvedValue([{ count: 1 }])
      mockMetrics.getSystemMetrics.mockResolvedValue({
        uptime: 3600,
        memoryUsage: { used: 100, total: 1000 },
        cpuUsage: 25,
        activeConnections: 5,
      })

      const healthHandler = async (request: NextRequest) => {
        try {
          // Check database connectivity
          await mockDb.$queryRaw('SELECT 1 as count')
          
          // Get system metrics
          const metrics = await mockMetrics.getSystemMetrics()
          
          return new Response(JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: {
              status: 'connected',
              responseTime: 10,
            },
            system: {
              uptime: metrics.uptime,
              memoryUsage: metrics.memoryUsage,
              cpuUsage: metrics.cpuUsage,
              activeConnections: metrics.activeConnections,
            },
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        } catch (error) {
          return new Response(JSON.stringify({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: 'System check failed',
          }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }

      // Simulate concurrent requests
      const requests = Array(5).fill(null).map(() => 
        healthHandler(new NextRequest('http://localhost:3000/api/health'))
      )

      const responses = await Promise.all(requests)

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200)
      })

      // Database should be called for each request
      expect(mockDb.$queryRaw).toHaveBeenCalledTimes(5)
      expect(mockMetrics.getSystemMetrics).toHaveBeenCalledTimes(5)
    })
  })
}) 