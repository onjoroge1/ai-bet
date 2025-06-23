import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

type SystemHealth = {
  id: string
  serverStatus: string
  apiResponseTime: number
  databaseStatus: string
  errorRate: number
  activeConnections: number
  cpuUsage: number
  memoryUsage: number
  diskUsage: number
  lastCheckedAt: Date
  createdAt: Date
  updatedAt: Date
}

export async function GET() {
  try {
    // Get latest system health metrics
    const latestMetrics = await prisma.$queryRaw<SystemHealth[]>`
      SELECT * FROM "SystemHealth"
      ORDER BY "createdAt" DESC
      LIMIT 1
    `

    // Get historical data for the last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const historicalData = await prisma.$queryRaw<SystemHealth[]>`
      SELECT * FROM "SystemHealth"
      WHERE "createdAt" >= ${twentyFourHoursAgo}
      ORDER BY "createdAt" ASC
    `

    return NextResponse.json({
      current: latestMetrics[0],
      historical: historicalData,
    })
  } catch (error) {
    console.error('Error fetching system health:', error)
    return NextResponse.json(
      { error: 'Failed to fetch system health metrics' },
      { status: 500 }
    )
  }
} 