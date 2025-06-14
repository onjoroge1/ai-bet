import { Server as NetServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { Worker } from 'worker_threads'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import os from 'os'
import { EVENT_SYSTEM_METRICS } from '../types/system-health'

const prisma = new PrismaClient()

type SystemHealth = {
  id: string
  serverStatus: "healthy" | "degraded" | "down"
  apiResponseTime: number
  databaseStatus: "healthy" | "degraded" | "down"
  errorRate: number
  activeConnections: number
  cpuUsage: number
  memoryUsage: number
  diskUsage: number
  lastCheckedAt: Date
  createdAt: Date
  updatedAt: Date
}

declare global {
  var io: SocketIOServer | null
  var worker: Worker | null
}

let io: SocketIOServer | null = null
let worker: Worker | null = null

function startWorker() {
  if (worker) {
    console.log('Cleaning up existing worker...')
    worker.removeAllListeners()
    worker.terminate()
  }

  // Use the compiled JS file from dist/workers
  const workerPath = path.join(process.cwd(), 'dist', 'workers', 'system-metrics.worker.js')

  console.log('Starting worker with path:', workerPath)
  worker = new Worker(workerPath)

  worker.on('message', (message) => {
    console.log('Received worker message:', message.type)
    if (io && message.type === EVENT_SYSTEM_METRICS) {
      console.log('Broadcasting metrics to clients')
      io.emit(EVENT_SYSTEM_METRICS, message.data)
    }
  })

  worker.on('error', (error) => {
    console.error('Worker error:', error)
  })

  worker.on('exit', (code) => {
    console.log(`Worker exited with code ${code}`)
    if (code !== 0) {
      console.error(`Worker stopped with exit code ${code}`)
      // Attempt to restart the worker
      setTimeout(startWorker, 5000)
    }
  })
}

export function initSocket(httpServer: NetServer) {
  if (io) {
    console.log('Socket server already initialized')
    return io
  }

  console.log('Initializing socket server...')
  io = new SocketIOServer(httpServer, {
    path: '/api/socket/io',
    addTrailingSlash: false,
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling']
  })

  // Create a namespace for system health with auth
  const healthNamespace = io.of('/health')
  healthNamespace.use((socket, next) => {
    const token = socket.handshake.auth.token
    if (!token || token !== process.env.SYSTEM_HEALTH_TOKEN) {
      console.log('Unauthorized health client connection attempt')
      return next(new Error('Unauthorized'))
    }
    console.log('Authorized health client connection')
    next()
  })

  healthNamespace.on('connection', (socket) => {
    console.log('Health client connected:', socket.id)
    
    socket.on('disconnect', () => {
      console.log('Health client disconnected:', socket.id)
    })
  })

  // Initialize worker for system metrics
  try {
    console.log('Starting system metrics worker...')
    startWorker()
  } catch (error) {
    console.error('Failed to initialize worker:', error)
  }

  // Cleanup on server shutdown
  httpServer.on('close', () => {
    console.log('HTTP server closing, cleaning up...')
    if (worker) {
      worker.removeAllListeners()
      worker.terminate()
    }
    if (io) {
      io.close()
    }
  })

  return io
}

export function getIO() {
  if (!io) {
    throw new Error('Socket.IO server not initialized')
  }
  return io
}

async function getSystemMetrics() {
  // Get CPU usage
  const cpus = os.cpus()
  const cpuUsage = cpus.reduce((acc, cpu) => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b)
    const idle = cpu.times.idle
    return acc + ((total - idle) / total) * 100
  }, 0) / cpus.length

  // Get memory usage
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const memoryUsage = ((totalMem - freeMem) / totalMem) * 100

  // Get disk usage (this is a simplified version)
  const diskUsage = 0 // You'll need to implement actual disk usage monitoring

  // Get active connections (simplified)
  const activeConnections = Math.floor(Math.random() * 100) // Replace with actual connection tracking

  // Calculate API response time (simplified)
  const apiResponseTime = Math.floor(Math.random() * 100) // Replace with actual API monitoring

  // Calculate error rate (simplified)
  const errorRate = Math.random() * 5 // Replace with actual error tracking

  // Determine status based on metrics
  const getStatus = (value: number, thresholds: { warning: number; critical: number }): "healthy" | "degraded" | "down" => {
    if (value >= thresholds.critical) return 'down'
    if (value >= thresholds.warning) return 'degraded'
    return 'healthy'
  }

  const serverStatus = getStatus(cpuUsage, { warning: 70, critical: 90 })
  const databaseStatus = getStatus(errorRate, { warning: 2, critical: 5 })

  try {
    // Save metrics to database using raw SQL with ID generation
    const result = await prisma.$queryRaw<SystemHealth[]>`
      INSERT INTO "SystemHealth" (
        "id",
        "serverStatus",
        "apiResponseTime",
        "databaseStatus",
        "errorRate",
        "activeConnections",
        "cpuUsage",
        "memoryUsage",
        "diskUsage",
        "lastCheckedAt",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        gen_random_uuid(),
        ${serverStatus},
        ${apiResponseTime},
        ${databaseStatus},
        ${errorRate},
        ${activeConnections},
        ${cpuUsage},
        ${memoryUsage},
        ${diskUsage},
        ${new Date()},
        ${new Date()},
        ${new Date()}
      )
      RETURNING *
    `
    return result[0]
  } catch (error) {
    console.error('Error saving system metrics:', error)
    // Return metrics without saving to database
    return {
      id: 'temp-' + Date.now(),
      serverStatus,
      apiResponseTime,
      databaseStatus,
      errorRate,
      activeConnections,
      cpuUsage,
      memoryUsage,
      diskUsage,
      lastCheckedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }
} 