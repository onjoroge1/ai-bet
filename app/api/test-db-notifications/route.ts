import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    // Test database connection
    const result = await sql`SELECT COUNT(*) as count FROM "UserNotification"`
    const count = result.rows[0]?.count || 0

    logger.info('Database connection test successful', {
      notificationCount: count,
    })

    return NextResponse.json({
      success: true,
      message: 'Database connection working',
      notificationCount: count,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logger.error('Database connection test failed', {
      error: error as Error,
    })

    return NextResponse.json({
      success: false,
      message: 'Database connection failed',
      error: (error as Error).message,
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
} 