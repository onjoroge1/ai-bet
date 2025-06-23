import * as _os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'
import { SystemHealth, HEALTH_THRESHOLDS } from '../types/system-health'
import prisma from '@/lib/db'

// Runtime guard for Node.js built-ins
const os = (_os && typeof _os.cpus === 'function') ? _os : null
if (!os) {
  throw new Error('Node "os" module unavailable – worker built for browser?')
}

const execAsync = promisify(exec)

// Helper to round numbers to 2 decimal places
const round = (n: number): number => Number(n.toFixed(2))

// Type for drive info from PowerShell
interface DriveInfo {
  Used: number
  Free: number
}

export async function getSystemMetrics(): Promise<SystemHealth> {
  try {
    // Get CPU usage
    const cpus = os!.cpus()
    const cpuUsage = round(cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b)
      const idle = cpu.times.idle
      return acc + ((total - idle) / total) * 100
    }, 0) / cpus.length)

    // Get memory usage
    const totalMem = os!.totalmem()
    const freeMem = os!.freemem()
    const memoryUsage = round(((totalMem - freeMem) / totalMem) * 100)

    // Get disk usage (cross-platform)
    let diskUsage = 0
    try {
      if (process.platform === 'win32') {
        const { stdout } = await execAsync(
          'powershell -Command "Get-PSDrive -PSProvider FileSystem | ' +
          'Select-Object Used,Free | ConvertTo-Json"'
        )
        const drives = JSON.parse(stdout) as DriveInfo[]
        const totals = drives.reduce((a: { used: number; free: number }, d: DriveInfo) => ({
          used: a.used + d.Used,
          free: a.free + d.Free
        }), { used: 0, free: 0 })
        diskUsage = round((totals.used / (totals.used + totals.free)) * 100)
      } else {
        const { stdout } = await execAsync('df -kP /')
        const [, size, used] = stdout.trim().split('\n')[1].split(/\s+/)
        diskUsage = round((+used / +size) * 100)
      }
    } catch (error) {
      console.error('Error getting disk usage:', error)
    }

    // Simplified active connections tracking
    const activeConnections = 0 // TODO: Implement proper connection tracking

    // Calculate API response time (simplified for now)
    const apiResponseTime = process.env.NODE_ENV === 'production' 
      ? 0 
      : round(Math.random() * 100)

    // Calculate error rate (simplified for now)
    const errorRate = process.env.NODE_ENV === 'production'
      ? 0
      : round(Math.random() * 5)

    // Determine status based on metrics
    const getStatus = <T extends { warning: number; critical: number }>(
      value: number, 
      thresholds: T
    ): "healthy" | "degraded" | "down" => {
      if (value >= thresholds.critical) return 'down'
      if (value >= thresholds.warning) return 'degraded'
      return 'healthy'
    }

    const serverStatus = getStatus(cpuUsage, HEALTH_THRESHOLDS.CPU)
    const databaseStatus = getStatus(errorRate, HEALTH_THRESHOLDS.ERROR_RATE)

    try {
      // Use Prisma's create instead of raw SQL
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
  } catch (error) {
    console.error('Error in getSystemMetrics:', error)
    throw error // Let the worker handle the retry logic
  }
} 