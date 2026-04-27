import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * GET /api/admin/multisport/reports
 * Returns finished multisport matches with accuracy stats for admin reports.
 * Query params: sport (required), search, page, limit, dateFrom, dateTo
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sport = searchParams.get('sport')
    const search = searchParams.get('search')?.toLowerCase()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    if (!sport) {
      return NextResponse.json({ error: 'sport parameter required' }, { status: 400 })
    }

    const where: Record<string, unknown> = {
      sport,
      status: 'finished',
      finalResult: { not: null },
    }

    if (search) {
      where.OR = [
        { homeTeam: { contains: search, mode: 'insensitive' } },
        { awayTeam: { contains: search, mode: 'insensitive' } },
        { league: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (dateFrom || dateTo) {
      where.commenceTime = {}
      if (dateFrom) (where.commenceTime as Record<string, unknown>).gte = new Date(dateFrom)
      if (dateTo) (where.commenceTime as Record<string, unknown>).lte = new Date(dateTo)
    }

    const [matches, total] = await Promise.all([
      prisma.multisportMatch.findMany({
        where,
        orderBy: { commenceTime: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.multisportMatch.count({ where }),
    ])

    // Calculate accuracy
    let v3Correct = 0
    let v3Total = 0
    let totalConfidence = 0

    const rows = matches.map(m => {
      const model = m.model as Record<string, any> | null
      const predictions = model?.predictions
      const finalResult = m.finalResult as Record<string, any> | null
      const score = finalResult?.score as { home: number; away: number } | null

      let correct: boolean | null = null
      if (predictions?.pick && score) {
        let predicted: string | null = null
        if (predictions.pick === 'H' || predictions.pick === 'home') predicted = 'home'
        else if (predictions.pick === 'A' || predictions.pick === 'away') predicted = 'away'
        else if (predictions.pick === 'D' || predictions.pick === 'draw') predicted = 'draw'

        const actual = score.home > score.away ? 'home' : score.away > score.home ? 'away' : 'draw'
        correct = predicted === actual
        v3Total++
        if (correct) v3Correct++
      }

      if (predictions?.confidence) {
        totalConfidence += predictions.confidence
      }

      return {
        id: m.id,
        eventId: m.eventId,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        league: m.league,
        kickoffDate: m.commenceTime.toISOString(),
        score: score || null,
        overtime: finalResult?.overtime || false,
        modelPick: predictions?.pick || null,
        modelConfidence: predictions?.confidence
          ? Math.round(predictions.confidence * 100)
          : null,
        correct,
      }
    })

    // Fetch aggregate stats across all finished matches for this sport (not just current page)
    const allFinished = await prisma.multisportMatch.findMany({
      where: { sport, status: 'finished', finalResult: { not: null } },
      select: { model: true, finalResult: true },
    })

    let allCorrect = 0
    let allTotal = 0
    let allConfidenceSum = 0
    let allConfidenceCount = 0

    for (const m of allFinished) {
      const model = m.model as Record<string, any> | null
      const predictions = model?.predictions
      const finalResult = m.finalResult as Record<string, any> | null
      const score = finalResult?.score as { home: number; away: number } | null

      if (predictions?.pick && score) {
        let predicted: string | null = null
        if (predictions.pick === 'H' || predictions.pick === 'home') predicted = 'home'
        else if (predictions.pick === 'A' || predictions.pick === 'away') predicted = 'away'
        else if (predictions.pick === 'D' || predictions.pick === 'draw') predicted = 'draw'

        const actual = score.home > score.away ? 'home' : score.away > score.home ? 'away' : 'draw'
        allTotal++
        if (predicted === actual) allCorrect++
      }
      if (predictions?.confidence) {
        allConfidenceSum += predictions.confidence
        allConfidenceCount++
      }
    }

    return NextResponse.json({
      success: true,
      matches: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats: {
        totalMatches: allTotal,
        v3Correct: allCorrect,
        v3Accuracy: allTotal > 0 ? Math.round((allCorrect / allTotal) * 100) : 0,
        avgConfidence: allConfidenceCount > 0
          ? Math.round((allConfidenceSum / allConfidenceCount) * 100)
          : 0,
      },
    })
  } catch (error) {
    logger.error('Admin multisport reports error', { error, tags: ['admin', 'multisport', 'reports'] })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch multisport reports' },
      { status: 500 }
    )
  }
}
