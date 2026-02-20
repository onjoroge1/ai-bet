import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

/**
 * GET /api/dashboard/recommendations
 *
 * Returns the "Today's Intelligence Feed" for the dashboard overview.
 * Aggregates:
 *  - Top 3 upcoming matches by confidence
 *  - Top AI parlay (highest combined probability)
 *  - Top CLV opportunity from cache
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const tomorrow = new Date(now.getTime() + 36 * 60 * 60 * 1000)

    // ── Top matches by confidence ─────────────────────────────────────
    const topMatches = await prisma.quickPurchase.findMany({
      where: {
        match: {
          startTime: { gte: now, lte: tomorrow },
          status: { in: ['UPCOMING', 'SCHEDULED'] },
        },
        confidence: { not: null },
      },
      include: {
        match: {
          include: {
            homeTeam: true,
            awayTeam: true,
            league: true,
          },
        },
      },
      orderBy: { confidence: 'desc' },
      take: 3,
    })

    // ── Top AI parlay ─────────────────────────────────────────────────
    const topParlay = await prisma.parlayConsensus.findFirst({
      where: {
        status: 'active',
        parlayType: { in: ['curated_multi_1x2', 'ai_picks', 'curated'] },
      },
      include: {
        legs: { orderBy: { legOrder: 'asc' }, take: 5 },
      },
      orderBy: { combinedProb: 'desc' },
    })

    // ── Top CLV opportunity from cache ────────────────────────────────
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const topCLV = await prisma.cLVOpportunityCache.findFirst({
      where: { cachedAt: { gte: oneHourAgo } },
      orderBy: { entryOdds: 'desc' },
    })

    return NextResponse.json({
      topMatches: topMatches.map((qp) => ({
        id: qp.id,
        matchId: qp.matchId,
        homeTeam: qp.match?.homeTeam?.name ?? 'TBD',
        awayTeam: qp.match?.awayTeam?.name ?? 'TBD',
        league: qp.match?.league?.name ?? '',
        startTime: qp.match?.startTime,
        confidence: qp.confidence,
        prediction: qp.prediction,
        slug: qp.matchId ? `${slugify(qp.match?.homeTeam?.name ?? '')}-vs-${slugify(qp.match?.awayTeam?.name ?? '')}` : null,
      })),
      topParlay: topParlay
        ? {
            id: topParlay.id,
            parlayType: topParlay.parlayType,
            combinedProb: topParlay.combinedProb,
            edgePct: topParlay.edgePct,
            legCount: topParlay.legs.length,
            legs: topParlay.legs.map((l) => ({
              matchDescription: l.matchDescription,
              marketType: l.marketType,
              outcome: l.outcome,
              consensusProb: l.consensusProb,
            })),
          }
        : null,
      topCLV: topCLV
        ? {
            homeTeam: topCLV.homeTeam,
            awayTeam: topCLV.awayTeam,
            league: topCLV.league,
            selection: topCLV.selection,
            entryOdds: topCLV.entryOdds,
            closeOdds: topCLV.closeOdds,
            matchDate: topCLV.matchDate,
          }
        : null,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[GET /api/dashboard/recommendations]', error)
    return NextResponse.json({ error: 'Failed to fetch recommendations' }, { status: 500 })
  }
}

/** Simple slug helper */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

