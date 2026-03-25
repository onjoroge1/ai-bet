import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * GET /api/admin/predictions/refresh-progressive - Progressive prediction refresh
 *
 * Refreshes predictions more frequently as kickoff approaches:
 * - >24h before kickoff: skip (handled by 2-hour sync)
 * - 6-24h before kickoff: refresh if prediction > 6 hours old
 * - 1-6h before kickoff: refresh if prediction > 2 hours old
 * - <1h before kickoff: refresh if prediction > 30 min old
 *
 * This captures odds movements that improve model confidence near kickoff.
 * Schedule: Every 30 minutes via Vercel cron
 */

export const maxDuration = 120
export const runtime = 'nodejs'

const BACKEND_URL = process.env.BACKEND_API_URL || process.env.BACKEND_URL
const API_KEY = process.env.BACKEND_API_KEY || 'betgenius_secure_key_2024'

// Rate limit: max predictions per cron cycle to avoid overloading backend
const MAX_PREDICTIONS_PER_CYCLE = 15
const DELAY_BETWEEN_PREDICTIONS = 2000 // 2s between calls

interface RefreshResult {
  matchId: string
  homeTeam: string
  awayTeam: string
  endpoint: string
  success: boolean
  confidence?: number
  previousConfidence?: number
  error?: string
  responseTime: number
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Auth: cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)
    const sixHoursFromNow = new Date(now.getTime() + 6 * 60 * 60 * 1000)
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    // Find matches that need prediction refresh based on proximity to kickoff
    // Priority: closest to kickoff first
    const matchesNeedingRefresh = await prisma.marketMatch.findMany({
      where: {
        status: 'UPCOMING',
        isActive: true,
        kickoffDate: {
          gte: now, // Not started yet
          lte: twentyFourHoursFromNow, // Within 24 hours
        },
      },
      include: {
        quickPurchases: {
          where: { isActive: true },
          select: {
            id: true,
            predictionData: true,
            confidenceScore: true,
            updatedAt: true,
          },
          take: 1,
          orderBy: { updatedAt: 'desc' },
        },
      },
      orderBy: { kickoffDate: 'asc' }, // Closest kickoff first
    })

    logger.info('🔄 Progressive refresh: scanning matches', {
      tags: ['predictions', 'progressive-refresh', 'cron'],
      data: { totalEligible: matchesNeedingRefresh.length },
    })

    // Determine which matches actually need a refresh
    const toRefresh: Array<{
      match: typeof matchesNeedingRefresh[0]
      reason: string
      hoursToKickoff: number
      previousConfidence: number | null
    }> = []

    for (const match of matchesNeedingRefresh) {
      const hoursToKickoff = (match.kickoffDate.getTime() - now.getTime()) / (60 * 60 * 1000)
      const qp = match.quickPurchases[0]
      const lastPredictionAge = qp?.updatedAt
        ? (now.getTime() - qp.updatedAt.getTime()) / (60 * 60 * 1000) // hours
        : Infinity

      let needsRefresh = false
      let reason = ''

      if (!qp?.predictionData) {
        // No prediction at all — always refresh
        needsRefresh = true
        reason = 'no prediction data'
      } else if (hoursToKickoff <= 1) {
        // <1h to kickoff: refresh if prediction > 30 min old
        if (lastPredictionAge > 0.5) {
          needsRefresh = true
          reason = `<1h to kickoff, prediction ${lastPredictionAge.toFixed(1)}h old`
        }
      } else if (hoursToKickoff <= 6) {
        // 1-6h to kickoff: refresh if prediction > 2 hours old
        if (lastPredictionAge > 2) {
          needsRefresh = true
          reason = `${hoursToKickoff.toFixed(1)}h to kickoff, prediction ${lastPredictionAge.toFixed(1)}h old`
        }
      } else {
        // 6-24h to kickoff: refresh if prediction > 6 hours old
        if (lastPredictionAge > 6) {
          needsRefresh = true
          reason = `${hoursToKickoff.toFixed(1)}h to kickoff, prediction ${lastPredictionAge.toFixed(1)}h old`
        }
      }

      if (needsRefresh) {
        toRefresh.push({
          match,
          reason,
          hoursToKickoff,
          previousConfidence: qp?.confidenceScore ?? null,
        })
      }
    }

    logger.info('🔄 Progressive refresh: matches needing refresh', {
      tags: ['predictions', 'progressive-refresh', 'cron'],
      data: {
        needRefresh: toRefresh.length,
        reasons: toRefresh.slice(0, 5).map(r => `${r.match.homeTeam} vs ${r.match.awayTeam}: ${r.reason}`),
      },
    })

    // Process top N matches (closest to kickoff first, already sorted)
    const batch = toRefresh.slice(0, MAX_PREDICTIONS_PER_CYCLE)
    const results: RefreshResult[] = []

    for (const item of batch) {
      const { match, previousConfidence } = item
      const callStart = Date.now()

      try {
        // Try /predict first (richer payload), fall back to /predict-v3
        let response: Response
        let usedEndpoint = '/predict'

        try {
          response = await fetch(`${BACKEND_URL}/predict`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${API_KEY}`,
            },
            body: JSON.stringify({ match_id: parseInt(match.matchId) }),
            signal: AbortSignal.timeout(35000),
          })

          if (!response.ok) {
            throw new Error(`/predict returned ${response.status}`)
          }
        } catch {
          // Fallback to /predict-v3
          usedEndpoint = '/predict-v3'
          response = await fetch(`${BACKEND_URL}/predict-v3`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${API_KEY}`,
            },
            body: JSON.stringify({ match_id: parseInt(match.matchId) }),
            signal: AbortSignal.timeout(30000),
          })
        }

        if (!response.ok) {
          throw new Error(`${usedEndpoint} returned ${response.status}`)
        }

        const predictionData = await response.json()

        // Extract confidence
        const rawConfidence =
          predictionData.comprehensive_analysis?.ml_prediction?.confidence ??
          predictionData.predictions?.confidence ??
          predictionData.analysis?.confidence
        let confidenceScore = 50
        if (typeof rawConfidence === 'number') {
          confidenceScore = rawConfidence <= 1 ? rawConfidence * 100 : rawConfidence
        }
        confidenceScore = Math.max(0, Math.min(100, Math.round(confidenceScore)))

        // Update QuickPurchase with fresh prediction
        const qp = match.quickPurchases[0]
        if (qp) {
          // Determine prediction type
          const probs = predictionData.comprehensive_analysis?.ml_prediction?.probs ??
            predictionData.predictions ?? {}
          const homeWin = probs.home_win ?? probs.home ?? 0
          const draw = probs.draw ?? 0
          const awayWin = probs.away_win ?? probs.away ?? 0
          const predictionType = homeWin > draw && homeWin > awayWin ? 'home'
            : awayWin > draw && awayWin > homeWin ? 'away' : 'draw'

          await prisma.quickPurchase.update({
            where: { id: qp.id },
            data: {
              predictionData: predictionData as any,
              confidenceScore,
              predictionType,
              updatedAt: new Date(),
            },
          })
        }

        results.push({
          matchId: match.matchId,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          endpoint: usedEndpoint,
          success: true,
          confidence: confidenceScore,
          previousConfidence: previousConfidence ?? undefined,
          responseTime: Date.now() - callStart,
        })

        logger.info('🔄 Progressive refresh: prediction updated', {
          tags: ['predictions', 'progressive-refresh'],
          data: {
            matchId: match.matchId,
            match: `${match.homeTeam} vs ${match.awayTeam}`,
            endpoint: usedEndpoint,
            confidence: confidenceScore,
            previousConfidence,
            delta: previousConfidence ? confidenceScore - previousConfidence : null,
          },
        })
      } catch (error) {
        results.push({
          matchId: match.matchId,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          endpoint: '/predict',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          responseTime: Date.now() - callStart,
        })

        logger.warn('🔄 Progressive refresh: prediction failed', {
          tags: ['predictions', 'progressive-refresh', 'error'],
          data: {
            matchId: match.matchId,
            error: error instanceof Error ? error.message : 'Unknown',
          },
        })
      }

      // Rate limit delay between calls
      if (batch.indexOf(item) < batch.length - 1) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_PREDICTIONS))
      }
    }

    const duration = Date.now() - startTime
    const successful = results.filter(r => r.success)
    const failed = results.filter(r => !r.success)
    const confidenceChanges = successful
      .filter(r => r.previousConfidence != null && r.confidence != null)
      .map(r => ({
        match: `${r.homeTeam} vs ${r.awayTeam}`,
        from: r.previousConfidence,
        to: r.confidence,
        delta: (r.confidence ?? 0) - (r.previousConfidence ?? 0),
      }))

    logger.info('🔄 Progressive refresh: completed', {
      tags: ['predictions', 'progressive-refresh', 'cron'],
      data: {
        total: batch.length,
        successful: successful.length,
        failed: failed.length,
        skipped: toRefresh.length - batch.length,
        duration: `${duration}ms`,
        avgResponseTime: successful.length > 0
          ? `${Math.round(successful.reduce((s, r) => s + r.responseTime, 0) / successful.length)}ms`
          : 'n/a',
      },
    })

    return NextResponse.json({
      success: true,
      summary: {
        eligible: matchesNeedingRefresh.length,
        needRefresh: toRefresh.length,
        processed: batch.length,
        successful: successful.length,
        failed: failed.length,
        skippedDueToLimit: Math.max(0, toRefresh.length - MAX_PREDICTIONS_PER_CYCLE),
      },
      confidenceChanges: confidenceChanges.length > 0 ? confidenceChanges : undefined,
      results: results.slice(0, 20),
      duration: `${duration}ms`,
      timestamp: now.toISOString(),
    })
  } catch (error) {
    logger.error('🔄 Progressive refresh: fatal error', {
      tags: ['predictions', 'progressive-refresh', 'cron', 'error'],
      error: error instanceof Error ? error : undefined,
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
