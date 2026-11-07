import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { ACTIVE_MULTISPORT_KEYS, MULTISPORT, multisportSeasonStatus } from '@/lib/multisport/sports'

/**
 * GET /api/multisport/sports
 *
 * Per-sport availability for the selector, derived entirely from the
 * MultisportMatch rows the pipeline publishes (no backend proxy).
 */
export const runtime = 'nodejs'
export const maxDuration = 15

export async function GET() {
  const now = new Date()
  const recentCutoff = new Date(now.getTime() - 6 * 60 * 60 * 1000) // keep in-progress games
  try {
    const sports = await Promise.all(
      ACTIVE_MULTISPORT_KEYS.map(async key => {
        const def = MULTISPORT[key]
        const [upcoming, upcomingWithModel, finished, latestModelRow] = await Promise.all([
          prisma.multisportMatch.count({ where: { sport: key, status: 'upcoming', commenceTime: { gte: recentCutoff } } }),
          prisma.multisportMatch.count({
            where: { sport: key, status: 'upcoming', commenceTime: { gte: recentCutoff }, model: { not: { equals: null as unknown as object } } },
          }),
          prisma.multisportMatch.count({ where: { sport: key, status: 'finished' } }),
          prisma.multisportMatch.findFirst({
            where: { sport: key, modelInfo: { not: { equals: null as unknown as object } } },
            orderBy: { predictionFetchedAt: 'desc' },
            select: { modelInfo: true },
          }),
        ])
        const modelInfo = (latestModelRow?.modelInfo || null) as { n_samples?: number; edge_gate?: { validation?: string } } | null
        const trainingSamples = modelInfo?.n_samples ?? 0
        return {
          sport_key: key,
          name: def.name,
          count: upcoming,
          available: true,
          fixtures: { upcoming, upcoming_with_odds: upcoming, finished, total: upcoming + finished },
          season: multisportSeasonStatus(key, now),
          model: {
            available: upcomingWithModel > 0,
            training_samples: trainingSamples,
            confidence_note: upcomingWithModel > 0
              ? (modelInfo?.edge_gate?.validation ?? null)
              : 'Market line only — no trained model yet for this sport',
          },
          live_data_available: false,
        }
      })
    )
    return NextResponse.json(
      { sports, source: 'database' },
      { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' } }
    )
  } catch (error) {
    console.error('[Multisport Sports API]', error)
    return NextResponse.json({ error: 'Failed to load sports', sports: [] }, { status: 200 })
  }
}
