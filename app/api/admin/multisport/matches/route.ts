import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * GET /api/admin/multisport/matches
 * Returns multisport matches for admin management.
 * Query params: sport (required), status (optional, default 'upcoming'), limit, search
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sport = searchParams.get('sport')
    const status = searchParams.get('status') || 'upcoming'
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 200)
    const search = searchParams.get('search')?.toLowerCase()

    if (!sport) {
      return NextResponse.json({ error: 'sport parameter required' }, { status: 400 })
    }

    const where: Record<string, unknown> = { sport, status }

    if (search) {
      where.OR = [
        { homeTeam: { contains: search, mode: 'insensitive' } },
        { awayTeam: { contains: search, mode: 'insensitive' } },
        { league: { contains: search, mode: 'insensitive' } },
        { eventId: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [matches, total] = await Promise.all([
      prisma.multisportMatch.findMany({
        where,
        orderBy: { commenceTime: status === 'finished' ? 'desc' : 'asc' },
        take: limit,
      }),
      prisma.multisportMatch.count({ where: { sport, status } }),
    ])

    // Transform to admin-friendly shape
    const adminMatches = matches.map(m => {
      const model = m.model as Record<string, any> | null
      const predictions = model?.predictions
      const hasPrediction = !!m.predictionData

      return {
        id: m.id,
        eventId: m.eventId,
        sport: m.sport,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        league: m.league,
        kickoffDate: m.commenceTime.toISOString(),
        status: m.status,
        hasPredictionData: hasPrediction,
        predictionStale: m.predictionFetchedAt
          ? Date.now() - m.predictionFetchedAt.getTime() > 6 * 60 * 60 * 1000
          : true,
        modelPick: predictions?.pick || null,
        modelConfidence: predictions?.confidence
          ? Math.round(predictions.confidence * 100)
          : null,
        modelSource: model?.source || null,
        lastSyncedAt: m.lastSyncedAt?.toISOString() || null,
        syncCount: m.syncCount,
      }
    })

    return NextResponse.json({
      success: true,
      matches: adminMatches,
      total,
      sport,
      status,
    })
  } catch (error) {
    logger.error('Admin multisport matches error', { error, tags: ['admin', 'multisport'] })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch multisport matches' },
      { status: 500 }
    )
  }
}
