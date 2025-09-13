import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

// GET /api/admin/predictions/upcoming-matches - Get QuickPurchase records that need refetching
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Upcoming matches API called')
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      console.log('❌ Unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.log('✅ Admin access granted')

    const { searchParams } = new URL(request.url)
    const timeWindow = searchParams.get('timeWindow') || '72h' // 72h, 48h, 24h
    const leagueId = searchParams.get('leagueId') // Optional league filter

    // Calculate time windows
    const now = new Date()
    const hoursFromNow = {
      '72h': 72,
      '48h': 48,
      '24h': 24
    }[timeWindow] || 72

    const cutoffDate = new Date(now.getTime() + (hoursFromNow * 60 * 60 * 1000))

    // Use raw SQL for proper date filtering on JSON field
    let sqlQuery = `
      SELECT * FROM "QuickPurchase" 
      WHERE "matchId" IS NOT NULL 
        AND "isPredictionActive" = true
        AND ("matchData"->>'date')::timestamp >= $1::timestamp
        AND ("matchData"->>'date')::timestamp <= $2::timestamp
      ORDER BY "createdAt" ASC 
      LIMIT 100
    `
    
    let queryParams = [now.toISOString(), cutoffDate.toISOString()]
    
    // Add league filter if provided
    if (leagueId && leagueId !== 'all') {
      sqlQuery = `
        SELECT * FROM "QuickPurchase" 
        WHERE "matchId" IS NOT NULL 
          AND "isPredictionActive" = true
          AND ("matchData"->>'date')::timestamp >= $1::timestamp
          AND ("matchData"->>'date')::timestamp <= $2::timestamp
          AND ("matchData"->>'league') = $3
        ORDER BY "createdAt" ASC 
        LIMIT 100
      `
      queryParams = [now.toISOString(), cutoffDate.toISOString(), leagueId]
    }

    // Execute raw SQL query
    const upcomingMatches = await prisma.$queryRawUnsafe(sqlQuery, ...queryParams)

    // No need for JavaScript filtering since SQL handles it
    const filteredMatches = upcomingMatches as any[]

    // Process the data to extract match information
    const processedMatches = filteredMatches.map(qp => {
      const matchData = qp.matchData as any
      const predictionData = qp.predictionData as any
      
      return {
        id: qp.id,
        matchId: qp.matchId,
        name: qp.name,
        homeTeam: matchData?.home_team || 'Unknown',
        awayTeam: matchData?.away_team || 'Unknown',
        league: matchData?.league || 'Unknown',
        matchDate: matchData?.date || null,
        venue: matchData?.venue || null,
        hasPrediction: !!qp.predictionData,
        predictionType: qp.predictionType || 'unknown',
        confidenceScore: qp.confidenceScore || 0,
        lastEnrichmentAt: qp.lastEnrichmentAt,
        enrichmentCount: qp.enrichmentCount || 0,
        nextRefetchAt: qp.nextRefetchAt,
        refetchPriority: qp.refetchPriority,
        hoursUntilMatch: matchData?.date ? 
          Math.round((new Date(matchData.date).getTime() - now.getTime()) / (1000 * 60 * 60)) : 
          null
      }
    })

    // Group by time windows (inclusive from 0 to specified hours)
    const groupedMatches = {
      '72h': processedMatches.filter(m => m.hoursUntilMatch && m.hoursUntilMatch <= 72),
      '48h': processedMatches.filter(m => m.hoursUntilMatch && m.hoursUntilMatch <= 48),
      '24h': processedMatches.filter(m => m.hoursUntilMatch && m.hoursUntilMatch <= 24),
      'urgent': processedMatches.filter(m => m.hoursUntilMatch && m.hoursUntilMatch <= 6)
    }

    // Get counts for each window
    const counts = {
      '72h': groupedMatches['72h'].length,
      '48h': groupedMatches['48h'].length,
      '24h': groupedMatches['24h'].length,
      'urgent': groupedMatches['urgent'].length,
      'total': processedMatches.length
    }

    console.log('📊 API Results:', {
      timeWindow,
      leagueId,
      totalFound: processedMatches.length,
      counts,
      cutoffDate: cutoffDate.toISOString(),
      currentTime: now.toISOString()
    })
    
    logger.info('Fetched upcoming matches from QuickPurchase database', {
      tags: ['api', 'admin', 'predictions', 'upcoming-matches'],
      data: {
        timeWindow,
        leagueId,
        totalFound: processedMatches.length,
        counts,
        cutoffDate: cutoffDate.toISOString(),
        currentTime: now.toISOString()
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        matches: processedMatches,
        groupedMatches,
        counts,
        filters: {
          timeWindow,
          leagueId,
          cutoffDate: cutoffDate.toISOString(),
          currentTime: now.toISOString()
        }
      }
    })

  } catch (error) {
    logger.error('GET /api/admin/predictions/upcoming-matches - Error', {
      tags: ['api', 'admin', 'predictions', 'upcoming-matches'],
      error: error instanceof Error ? error : undefined
    })

    return NextResponse.json(
      { 
        error: 'Failed to fetch upcoming matches',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
