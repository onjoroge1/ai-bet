import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import os from 'os'

interface CpuInfo {
  times: {
    user: number
    nice: number
    sys: number
    idle: number
    irq: number
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Get CPU usage
    const cpus = os.cpus() as CpuInfo[]
    const cpuUsage = cpus.reduce((acc: number, cpu: CpuInfo) => {
      const total = Object.values(cpu.times).reduce((a: number, b: number) => a + b)
      const idle = cpu.times.idle
      return acc + ((total - idle) / total) * 100
    }, 0) / cpus.length

    // Get memory usage
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const memoryUsage = ((totalMem - freeMem) / totalMem) * 100

    // Get disk usage (simplified)
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

    const metrics = {
      id: 'current-' + Date.now(),
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

    // Save metrics to database
    try {
      await prisma.systemHealth.create({
        data: metrics
      })
    } catch (error) {
      console.error('Error saving system metrics:', error)
      // Continue even if saving fails
    }

    return NextResponse.json(metrics)
  } catch (error) {
    console.error('Error in system health endpoint:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
} 