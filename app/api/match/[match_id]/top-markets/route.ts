import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/match/[match_id]/top-markets?limit=3
 *
 * Returns the top markets for a match, sorted by consensus edge desc.
 * Public endpoint (read-only) — used by the live match page to surface
 * the highest-conviction additional markets (BTTS, totals, DNB, asian
 * handicap, etc.) without requiring a parlay-builder session.
 *
 * Filters:
 *   - consensusProb ≥ 0.55 (model thinks it's more likely than coin-flip)
 *   - modelAgreement ≥ 0.6 (V1 + V2 agree)
 *   - edgeConsensus > 0     (positive expected value vs market)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ match_id: string }> }
) {
  try {
    const { match_id } = await params
    const matchId = String(match_id || '').trim()
    if (!matchId) {
      return NextResponse.json({ error: 'match_id required' }, { status: 400 })
    }

    const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get('limit') ?? '3'), 1), 10)

    const rows = await prisma.additionalMarketData.findMany({
      where: {
        matchId,
        consensusProb: { gte: 0.55 },
        modelAgreement: { gte: 0.6 },
        edgeConsensus: { gt: 0 },
      },
      orderBy: [{ edgeConsensus: 'desc' }, { consensusProb: 'desc' }],
      take: limit,
      select: {
        id: true,
        marketType: true,
        marketSubtype: true,
        line: true,
        decimalOdds: true,
        consensusProb: true,
        consensusConfidence: true,
        modelAgreement: true,
        edgeConsensus: true,
        riskLevel: true,
      },
    })

    const markets = rows.map((m) => ({
      id: m.id,
      marketType: m.marketType,
      marketSubtype: m.marketSubtype,
      line: m.line ? Number(m.line) : null,
      decimalOdds: m.decimalOdds ? Number(m.decimalOdds) : null,
      consensusProb: Number(m.consensusProb),
      consensusConfidence: m.consensusConfidence ? Number(m.consensusConfidence) : null,
      modelAgreement: Number(m.modelAgreement),
      edge: Number(m.edgeConsensus) * 100, // Convert to percentage
      riskLevel: m.riskLevel,
      displayLabel: formatMarketLabel(m.marketType, m.marketSubtype, m.line ? Number(m.line) : null),
    }))

    return NextResponse.json(
      { matchId, count: markets.length, markets },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      }
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

function formatMarketLabel(
  marketType: string,
  marketSubtype: string,
  line: number | null
): string {
  const sub = (marketSubtype || '').replace(/_/g, ' ')
  switch (marketType) {
    case 'TOTALS':
      // OVER_2_5 → Over 2.5 Goals
      return line != null
        ? `${sub.replace(/[\d.]+/g, '').trim()} ${line.toFixed(1)} Goals`
        : `Total ${sub}`
    case 'BTTS':
      return `Both Teams to Score: ${sub}`
    case 'DNB':
      return `Draw No Bet: ${sub}`
    case 'ASIAN_HANDICAP':
      return line != null ? `Asian Handicap ${sub} ${line > 0 ? '+' : ''}${line.toFixed(2)}` : `AH ${sub}`
    case 'TEAM_TOTALS':
      return line != null ? `Team Total ${sub} ${line.toFixed(1)}` : `Team Total ${sub}`
    case 'DOUBLE_CHANCE':
      return `Double Chance: ${sub}`
    case 'WIN_TO_NIL':
      return `Win to Nil: ${sub}`
    case '1X2':
      return sub === 'HOME' ? 'Home Win' : sub === 'AWAY' ? 'Away Win' : 'Draw'
    default:
      return `${marketType}: ${sub}`
  }
}
