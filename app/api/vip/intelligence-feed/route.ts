import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * GET /api/vip/intelligence-feed
 *
 * Returns the VIP Intelligence Feed for premium users:
 * - Top high-confidence upcoming matches (≥65% confidence, next 48h)
 * - Top AI/curated parlays with legs
 * - Active CLV opportunities from the cache
 *
 * Premium-protected; admin always gets access.
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = session.user.role?.toLowerCase() === 'admin'

    // isPremium is set by the session callback; also derive locally as a fallback
    // in case the JWT was issued before the session callback was updated.
    const sessionIsPremium = (session.user as any).isPremium === true
    const plan = (session.user as any).subscriptionPlan as string | null ?? ''
    const expiresAt = (session.user as any).subscriptionExpiresAt as string | null
    const derivedIsPremium =
      (plan.toLowerCase().includes('premium') ||
        plan.toLowerCase().includes('monthly') ||
        plan.toLowerCase().includes('vip')) &&
      !!expiresAt &&
      new Date(expiresAt) > new Date()

    // Also check DB in case session token is stale
    let dbIsPremium = false
    if (!sessionIsPremium && !derivedIsPremium && !isAdmin) {
      const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { subscriptionPlan: true, subscriptionExpiresAt: true, role: true },
      })
      if (dbUser) {
        const planLower = (dbUser.subscriptionPlan ?? '').toLowerCase()
        dbIsPremium =
          (planLower.includes('premium') || planLower.includes('monthly') || planLower.includes('vip')) &&
          !!dbUser.subscriptionExpiresAt &&
          new Date(dbUser.subscriptionExpiresAt) > new Date()
      }
    }

    const isPremium = sessionIsPremium || derivedIsPremium || dbIsPremium

    if (!isAdmin && !isPremium) {
      return NextResponse.json({ error: 'Premium access required' }, { status: 403 })
    }

    const now = new Date()
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    // ── 1. Top high-confidence upcoming matches ────────────────────────────
    // QuickPurchase is the match-prediction record; it links to MarketMatch via marketMatchId.
    // confidenceScore is the Int field (0-100); marketMatch.kickoffDate is the kickoff time.
    const rawMatches = await prisma.quickPurchase.findMany({
      where: {
        isActive: true,
        isPredictionActive: true,
        confidenceScore: { gte: 65 },
        OR: [
          // Via MarketMatch relation (preferred — has team names)
          {
            marketMatch: {
              status: { in: ['UPCOMING', 'LIVE'] },
              kickoffDate: { gte: now, lte: in48h },
            },
          },
          // Fallback: use matchData JSON date for older records without MarketMatch link
          {
            marketMatchId: null,
            matchData: { not: {} },
          },
        ],
      },
      include: {
        marketMatch: true,
      },
      orderBy: { confidenceScore: 'desc' },
      take: 30,
    })

    // Deduplicate by matchId (keep highest confidence per match)
    const seenMatchIds = new Set<string>()
    const dedupedMatches = rawMatches.filter(qp => {
      const key = qp.matchId ?? qp.marketMatchId ?? qp.id
      if (seenMatchIds.has(key)) return false
      seenMatchIds.add(key)
      return true
    })

    const topMatches = dedupedMatches.slice(0, 9).map(qp => {
      const confidence = qp.confidenceScore ?? 0
      const mm = qp.marketMatch
      const md = qp.matchData as any

      // Extract team names: prefer MarketMatch, fall back to matchData JSON
      const homeTeam = mm?.homeTeam ?? md?.home_team ?? md?.homeTeam ?? 'TBD'
      const awayTeam = mm?.awayTeam ?? md?.away_team ?? md?.awayTeam ?? 'TBD'
      const league = mm?.league ?? md?.league ?? md?.competition ?? ''
      const startTime = mm?.kickoffDate ?? (md?.date ? new Date(md.date) : now)

      // Determine value rating
      const edge = (qp.predictionData as any)?.edge ?? null
      let valueRating: string
      if (edge === null) valueRating = confidence >= 80 ? 'High' : confidence >= 70 ? 'Medium' : 'Standard'
      else if (edge >= 8) valueRating = 'Excellent'
      else if (edge >= 4) valueRating = 'High'
      else if (edge >= 1) valueRating = 'Medium'
      else valueRating = 'Low'

      // Best decimal odds
      const predOdds = (qp.predictionData as any)?.decimal_odds
      const odds = predOdds && predOdds > 0
        ? predOdds
        : confidence > 0 ? parseFloat((1 / (confidence / 100)).toFixed(2)) : 2.0

      const analysisSummary =
        qp.analysisSummary?.slice(0, 140) ??
        (qp.predictionData as any)?.explanation?.slice(0, 140) ??
        (qp.predictionData as any)?.advanced_markets?.summary?.slice(0, 140) ??
        null

      return {
        id: qp.id,
        name: `${homeTeam} vs ${awayTeam}`,
        homeTeam,
        awayTeam,
        league,
        startTime: startTime instanceof Date ? startTime.toISOString() : new Date(startTime).toISOString(),
        confidence: Math.round(confidence),
        prediction: (qp.predictionType ?? qp.name ?? 'Match Result') as string,
        odds: Number(odds),
        valueRating,
        analysisSummary,
      }
    })

    // ── 2. Top AI parlays ──────────────────────────────────────────────────
    const rawParlays = await prisma.parlayConsensus.findMany({
      where: {
        status: 'active',
        earliestKickoff: { gte: now },
        edgePct: { gt: 0 },
      },
      include: {
        legs: { orderBy: { legOrder: 'asc' }, take: 6 },
      },
      orderBy: [
        { edgePct: 'desc' },
        { combinedProb: 'desc' },
      ],
      take: 6,
    })

    const topParlays = rawParlays
      .filter(p => p.legs.length >= 2)
      .map(p => {
        const adjustedProb = Number(p.adjustedProb)
        const impliedOdds = Number(p.impliedOdds) > 0
          ? Number(p.impliedOdds)
          : adjustedProb > 0 ? parseFloat((1 / adjustedProb).toFixed(2)) : 2.0

        return {
          parlayId: p.parlayId,
          legCount: p.legs.length,
          edgePct: Number(p.edgePct),
          impliedOdds,
          confidenceTier: p.confidenceTier ?? 'standard',
          parlayType: p.parlayType,
          earliestKickoff: p.earliestKickoff?.toISOString() ?? now.toISOString(),
          legs: p.legs.map(leg => ({
            homeTeam: leg.homeTeam ?? 'TBD',
            awayTeam: leg.awayTeam ?? 'TBD',
            outcome: leg.outcome,
            modelProb: Number(leg.modelProb),
            decimalOdds: Number(leg.decimalOdds) > 0
              ? Number(leg.decimalOdds)
              : Number(leg.modelProb) > 0 ? parseFloat((1 / Number(leg.modelProb)).toFixed(2)) : 2.0,
          })),
        }
      })

    // ── 3. CLV opportunities from cache ───────────────────────────────────
    // Expand window to 6h to catch more opportunities
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000)
    const rawCLV = await prisma.cLVOpportunityCache.findMany({
      where: {
        cachedAt: { gte: sixHoursAgo },
        matchDate: { gte: now },
      },
      orderBy: [
        { entryOdds: 'desc' },
        { cachedAt: 'desc' },
      ],
      take: 20,
    })

    // Calculate implied CLV percentage: (entryOdds / closeOdds - 1) * 100
    const clvOpportunities = rawCLV
      .map(c => {
        const entry = Number(c.entryOdds)
        const close = Number(c.closeOdds)
        const clvPct = close > 0 ? ((entry / close) - 1) * 100 : 0
        return {
          alertId: c.id,
          homeTeam: c.homeTeam,
          awayTeam: c.awayTeam,
          league: c.league,
          outcome: c.selection,
          bestOdds: entry,
          clvPct: parseFloat(clvPct.toFixed(2)),
          expiresAt: c.matchDate.toISOString(),
        }
      })
      .filter(c => c.clvPct > 0)
      .sort((a, b) => b.clvPct - a.clvPct)
      .slice(0, 9)

    logger.info('VIP intelligence feed generated', {
      tags: ['api', 'vip', 'intelligence-feed'],
      data: {
        userId: session.user.id,
        matchCount: topMatches.length,
        parlayCount: topParlays.length,
        clvCount: clvOpportunities.length,
      },
    })

    return NextResponse.json({
      topMatches,
      topParlays,
      clvOpportunities,
      generatedAt: now.toISOString(),
    })
  } catch (error) {
    logger.error('Error generating VIP intelligence feed', {
      tags: ['api', 'vip', 'intelligence-feed'],
      error: error instanceof Error ? error : undefined,
    })
    return NextResponse.json({ error: 'Failed to generate intelligence feed' }, { status: 500 })
  }
}
