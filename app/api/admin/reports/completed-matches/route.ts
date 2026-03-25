import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalise a pick string to a canonical "home" | "away" | "draw" | null. */
function normalisePick(pick: unknown): string | null {
  if (typeof pick !== 'string') return null
  const p = pick.trim().toLowerCase()
  if (['home', 'h', '1', 'home_win', 'h_win'].includes(p)) return 'home'
  if (['away', 'a', '2', 'away_win', 'a_win'].includes(p)) return 'away'
  if (['draw', 'd', 'x'].includes(p)) return 'draw'
  return p || null
}

/** Normalise a recommended_bet to a pick. */
function normaliseRecommendedBet(bet: unknown): string | null {
  if (typeof bet !== 'string') return null
  const b = bet.trim().toLowerCase()
  if (['h_win', 'home_win', 'home', '1'].includes(b)) return 'home'
  if (['a_win', 'away_win', 'away', '2'].includes(b)) return 'away'
  if (['draw', 'd', 'x'].includes(b)) return 'draw'
  return null
}

/** Resolve actual match outcome from finalResult JSON. */
function resolveOutcome(finalResult: Record<string, unknown> | null): string | null {
  if (!finalResult) return null

  const outcome = finalResult.outcome as string | undefined
  if (outcome) {
    const o = outcome.trim().toLowerCase()
    if (['h', 'home', 'home_win', '1'].includes(o)) return 'home'
    if (['a', 'away', 'away_win', '2'].includes(o)) return 'away'
    if (['d', 'draw', 'x'].includes(o)) return 'draw'
  }

  const score = finalResult.score as { home?: number; away?: number } | undefined
  if (score && typeof score.home === 'number' && typeof score.away === 'number') {
    if (score.home > score.away) return 'home'
    if (score.away > score.home) return 'away'
    return 'draw'
  }

  return null
}

/** Normalise a confidence value to integer 0-100. */
function normaliseConfidence(raw: unknown): number | null {
  if (typeof raw !== 'number' || isNaN(raw)) return null
  return raw <= 1 ? Math.round(raw * 100) : Math.round(raw)
}

interface ModelExtract {
  pick: string | null
  confidence: number | null
  probs: Record<string, number> | null
  recommendedBet: string | null
  version: string | null
  agreement?: { agreesWith: boolean; confidenceDelta: number } | null
}

/**
 * Extract V1 and V2 model data from QP predictionData.
 *
 * The enrichment pipeline stores models at:
 *   predictionData.predictions.models = [
 *     { id: "v1_consensus", confidence: 0.428, predictions: { home_win, draw, away_win }, recommended_bet, ... },
 *     { id: "v2_unified",   confidence: 0.446, predictions: { home_win, draw, away_win }, recommended_bet, agreement, ... },
 *   ]
 *
 * Also checks predictionData.models as a fallback for alternative structures.
 */
function extractModelsFromPredictionData(pd: Record<string, unknown> | null): {
  qpV1: ModelExtract | null
  qpV2: ModelExtract | null
  qpV3: ModelExtract | null
} {
  if (!pd) return { qpV1: null, qpV2: null, qpV3: null }

  const preds = pd.predictions as Record<string, unknown> | undefined
  const models = (preds?.models ?? pd.models) as Array<Record<string, unknown>> | undefined
  if (!Array.isArray(models) || models.length === 0) return { qpV1: null, qpV2: null, qpV3: null }

  let qpV1: ModelExtract | null = null
  let qpV2: ModelExtract | null = null
  let qpV3: ModelExtract | null = null

  for (const m of models) {
    const id = (m.id as string)?.toLowerCase() ?? ''
    if ((m.status as string)?.toLowerCase() === 'unavailable') continue

    const preds = m.predictions as Record<string, number> | undefined
    const normProbs = preds ? {
      home: preds.home_win ?? preds.home ?? 0,
      draw: preds.draw ?? 0,
      away: preds.away_win ?? preds.away ?? 0,
    } : null

    // Derive pick: recommended_bet > explicit pick > highest probability
    let pick = normaliseRecommendedBet(m.recommended_bet) ?? normalisePick(m.pick as string)
    if (!pick && normProbs) {
      const best = Object.entries(normProbs).reduce((a, b) => b[1] > a[1] ? b : a)
      if (best[1] > 0) pick = best[0]
    }

    const extract: ModelExtract = {
      pick,
      confidence: normaliseConfidence(m.confidence),
      probs: normProbs,
      recommendedBet: (m.recommended_bet as string) ?? null,
      version: (m.version as string) ?? null,
    }

    if (id.includes('v1') || id === 'v1_consensus') {
      qpV1 = extract
    } else if (id.includes('v2') || id === 'v2_unified') {
      const agr = m.agreement as { agrees_with_v1?: boolean; confidence_delta?: number } | undefined
      extract.agreement = agr ? {
        agreesWith: agr.agrees_with_v1 ?? false,
        confidenceDelta: agr.confidence_delta ?? 0,
      } : null
      qpV2 = extract
    } else if (id.includes('v3') || id === 'v3_sharp') {
      qpV3 = extract
    }
  }

  return { qpV1, qpV2, qpV3 }
}

/**
 * Extract general prediction info (confidence, pick, explanation) from QP data.
 * Falls back through multiple possible structures.
 */
function extractPredictionMeta(qp: {
  confidenceScore: number | null
  predictionData: unknown
  predictionType: string | null
  valueRating: string | null
  odds: { toNumber: () => number } | null
}): {
  confidence: number | null
  predictionType: string | null
  valueRating: string | null
  odds: number | null
  explanation: string | null
} {
  const pd = qp.predictionData as Record<string, unknown> | null

  let confidence = qp.confidenceScore ?? null
  let explanation: string | null = null

  if (pd) {
    if (confidence === null) {
      const ml = (pd.comprehensive_analysis as Record<string, unknown>)?.ml_prediction as Record<string, unknown> | undefined
        ?? pd.predictions as Record<string, unknown> | undefined
        ?? (pd.prediction as Record<string, unknown>)?.predictions as Record<string, unknown> | undefined
        ?? pd.ml_prediction as Record<string, unknown> | undefined

      const rawConf = ml?.confidence ?? (pd.analysis as Record<string, unknown>)?.confidence ?? pd.confidence
      if (typeof rawConf === 'number') {
        confidence = rawConf <= 1 ? Math.round(rawConf * 100) : Math.round(rawConf)
      }
    }

    const analysis = pd.analysis as Record<string, unknown> | undefined
    if (typeof analysis?.explanation === 'string') {
      explanation = analysis.explanation
    }
  }

  return {
    confidence,
    predictionType: qp.predictionType ?? null,
    valueRating: qp.valueRating ?? null,
    odds: qp.odds ? qp.odds.toNumber() : null,
    explanation,
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/reports/completed-matches
 *
 * Returns completed MarketMatch records joined with QuickPurchase prediction
 * data. V1 and V2 model predictions are extracted from BOTH:
 *   1. MarketMatch.v1Model / v2Model (populated by the sync cron)
 *   2. QuickPurchase.predictionData.models[] (populated by the enrichment pipeline)
 *
 * The QP source is preferred when available because it reflects the enriched
 * prediction payload (with recommended_bet, agreement, quality_metrics).
 *
 * Query params: page, limit, league, search, result, dateFrom, dateTo
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sp = request.nextUrl.searchParams
    const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10))
    const limit = Math.min(200, Math.max(1, parseInt(sp.get('limit') ?? '50', 10)))
    const search = sp.get('search')?.trim() ?? ''
    const league = sp.get('league')?.trim() ?? ''
    const resultFilter = sp.get('result')?.trim() ?? ''
    const dateFrom = sp.get('dateFrom') ?? ''
    const dateTo = sp.get('dateTo') ?? ''

    const where: Record<string, unknown> = { status: 'FINISHED', isActive: true }

    if (search) {
      where.OR = [
        { homeTeam: { contains: search, mode: 'insensitive' } },
        { awayTeam: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (league) where.league = { contains: league, mode: 'insensitive' }
    if (dateFrom || dateTo) {
      const kf: Record<string, unknown> = {}
      if (dateFrom) kf.gte = new Date(dateFrom)
      if (dateTo) kf.lte = new Date(dateTo)
      where.kickoffDate = kf
    }

    const [totalCount, matches] = await Promise.all([
      prisma.marketMatch.count({ where: where as never }),
      prisma.marketMatch.findMany({
        where: where as never,
        include: {
          quickPurchases: {
            where: { isActive: true, predictionData: { not: null } },
            select: {
              id: true,
              confidenceScore: true,
              predictionData: true,
              predictionType: true,
              valueRating: true,
              odds: true,
              matchId: true,
            },
            take: 1,
          },
        },
        orderBy: { kickoffDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    // Transform rows
    const rows = matches.map((m) => {
      const fr = m.finalResult as Record<string, unknown> | null
      const score = fr?.score as { home?: number; away?: number } | undefined
      const actualOutcome = resolveOutcome(fr)

      // --- V1 / V2 / V3 from MarketMatch columns (sync cron source) ---
      const mmV1 = m.v1Model as { pick?: string; confidence?: number; probs?: Record<string, number> } | null
      const mmV2 = m.v2Model as { pick?: string; confidence?: number; probs?: Record<string, number> } | null
      const mmV3 = (m as any).v3Model as { pick?: string; confidence?: number; probs?: Record<string, number>; conviction_tier?: string } | null

      // --- V1 / V2 / V3 from QuickPurchase predictionData.models[] (enrichment source) ---
      const qp = m.quickPurchases[0]
      const pd = qp?.predictionData as Record<string, unknown> | null
      const { qpV1, qpV2, qpV3 } = extractModelsFromPredictionData(pd)

      // Merge: prefer QP models (richer data), fall back to MarketMatch columns
      const v1Pick = qpV1?.pick ?? normalisePick(mmV1?.pick)
      const v1Conf = qpV1?.confidence ?? (mmV1?.confidence != null ? normaliseConfidence(mmV1.confidence) : null)
      const v1Probs = qpV1?.probs ?? mmV1?.probs ?? null

      const v2Pick = qpV2?.pick ?? normalisePick(mmV2?.pick)
      const v2Conf = qpV2?.confidence ?? (mmV2?.confidence != null ? normaliseConfidence(mmV2.confidence) : null)
      const v2Probs = qpV2?.probs ?? mmV2?.probs ?? null

      const v3Pick = qpV3?.pick ?? normalisePick(mmV3?.pick)
      const v3Conf = qpV3?.confidence ?? (mmV3?.confidence != null ? normaliseConfidence(mmV3.confidence) : null)
      const v3Probs = qpV3?.probs ?? mmV3?.probs ?? null

      const v1Correct = v1Pick && actualOutcome ? v1Pick === actualOutcome : null
      const v2Correct = v2Pick && actualOutcome ? v2Pick === actualOutcome : null
      const v3Correct = v3Pick && actualOutcome ? v3Pick === actualOutcome : null

      const qpMeta = qp ? extractPredictionMeta(qp) : null

      // V1 vs V2 agreement
      const modelsAgree = v1Pick && v2Pick ? v1Pick === v2Pick : null

      return {
        id: m.id,
        matchId: m.matchId,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        league: m.league,
        kickoffDate: m.kickoffDate.toISOString(),
        score: score ? { home: score.home ?? null, away: score.away ?? null } : null,
        actualOutcome,
        outcomeText: (fr?.outcome_text as string) ?? null,

        v1: (v1Pick || v1Conf != null) ? {
          pick: v1Pick,
          confidence: v1Conf,
          probs: v1Probs,
          correct: v1Correct,
          recommendedBet: qpV1?.recommendedBet ?? null,
          source: qpV1 ? 'enrichment' : 'sync',
        } : null,

        v2: (v2Pick || v2Conf != null) ? {
          pick: v2Pick,
          confidence: v2Conf,
          probs: v2Probs,
          correct: v2Correct,
          recommendedBet: qpV2?.recommendedBet ?? null,
          agreement: qpV2?.agreement ?? null,
          source: qpV2 ? 'enrichment' : 'sync',
        } : null,

        v3: (v3Pick || v3Conf != null) ? {
          pick: v3Pick,
          confidence: v3Conf,
          probs: v3Probs,
          correct: v3Correct,
          recommendedBet: qpV3?.recommendedBet ?? null,
          convictionTier: mmV3?.conviction_tier ?? null,
          source: qpV3 ? 'enrichment' : 'sync',
        } : null,

        modelsAgree,

        prediction: qpMeta ? {
          confidence: qpMeta.confidence,
          type: qpMeta.predictionType,
          valueRating: qpMeta.valueRating,
          odds: qpMeta.odds,
          explanation: qpMeta.explanation,
        } : null,

        consensusOdds: m.consensusOdds as { home?: number; draw?: number; away?: number } | null,
      }
    })

    // Optional post-filter
    let filtered = rows
    if (resultFilter === 'correct') {
      filtered = rows.filter((r) => r.v1?.correct === true || r.v2?.correct === true || r.v3?.correct === true)
    } else if (resultFilter === 'incorrect') {
      filtered = rows.filter((r) =>
        (r.v1 && r.v1.correct === false) || (r.v2 && r.v2.correct === false) || (r.v3 && r.v3.correct === false)
      )
    } else if (resultFilter === 'no_prediction') {
      filtered = rows.filter((r) => !r.v1 && !r.v2 && !r.v3)
    }

    // ── Aggregate stats scoped to current filters ─────────────────────────
    // Uses the same `where` clause so stats reflect the active date/league/search
    const allFinished = await prisma.marketMatch.findMany({
      where: where as never,
      select: {
        v1Model: true,
        v2Model: true,
        v3Model: true,
        finalResult: true,
        currentScore: true,
        quickPurchases: {
          where: { isActive: true, predictionData: { not: null } },
          select: { predictionData: true, premiumTier: true, premiumScore: true, predictionType: true },
          take: 1,
        },
      },
    })

    let v1Total = 0, v1CorrectCount = 0
    let v2Total = 0, v2CorrectCount = 0
    let v3Total = 0, v3CorrectCount = 0
    let totalWithScores = 0
    let totalMissingScores = 0
    let totalWithQpModels = 0
    let agreeBoth = 0, agreeCorrect = 0
    let disagreeBoth = 0, disagreeV1Right = 0, disagreeV2Right = 0
    let agreeAllThree = 0, agreeAllThreeCorrect = 0

    // Premium tier accuracy tracking
    const tierStats: Record<string, { total: number; correct: number }> = {
      premium: { total: 0, correct: 0 },
      strong: { total: 0, correct: 0 },
      standard: { total: 0, correct: 0 },
      speculative: { total: 0, correct: 0 },
    }

    for (const am of allFinished) {
      const aFr = am.finalResult as Record<string, unknown> | null
      const aOutcome = resolveOutcome(aFr)
      if (aFr && Object.keys(aFr).length > 0) {
        totalWithScores++
      } else {
        totalMissingScores++
      }

      // Extract V1/V2/V3 from QP models first, fall back to MarketMatch columns
      const qpPd = am.quickPurchases[0]?.predictionData as Record<string, unknown> | null
      const { qpV1, qpV2, qpV3 } = extractModelsFromPredictionData(qpPd)
      if (qpV1 || qpV2 || qpV3) totalWithQpModels++

      const aV1Pick = qpV1?.pick ?? normalisePick((am.v1Model as { pick?: string } | null)?.pick)
      const aV2Pick = qpV2?.pick ?? normalisePick((am.v2Model as { pick?: string } | null)?.pick)
      const aV3Pick = qpV3?.pick ?? normalisePick((am.v3Model as { pick?: string } | null)?.pick)

      if (aV1Pick && aOutcome) {
        v1Total++
        if (aV1Pick === aOutcome) v1CorrectCount++
      }
      if (aV2Pick && aOutcome) {
        v2Total++
        if (aV2Pick === aOutcome) v2CorrectCount++
      }
      if (aV3Pick && aOutcome) {
        v3Total++
        if (aV3Pick === aOutcome) v3CorrectCount++
      }

      // V1 vs V2 head-to-head
      if (aV1Pick && aV2Pick && aOutcome) {
        if (aV1Pick === aV2Pick) {
          agreeBoth++
          if (aV1Pick === aOutcome) agreeCorrect++
        } else {
          disagreeBoth++
          if (aV1Pick === aOutcome) disagreeV1Right++
          if (aV2Pick === aOutcome) disagreeV2Right++
        }
      }

      // All three models agree
      if (aV1Pick && aV2Pick && aV3Pick && aOutcome) {
        if (aV1Pick === aV2Pick && aV2Pick === aV3Pick) {
          agreeAllThree++
          if (aV1Pick === aOutcome) agreeAllThreeCorrect++
        }
      }

      // Premium tier accuracy
      const qpData = am.quickPurchases[0]
      const tier = (qpData as any)?.premiumTier as string | null
      if (tier && tierStats[tier] && aOutcome) {
        const qpPick = normalisePick((qpData as any)?.predictionType)
        if (qpPick) {
          tierStats[tier].total++
          if (qpPick === aOutcome) tierStats[tier].correct++
        }
      }
    }

    // Distinct leagues (always unfiltered)
    const leagueRows = await prisma.marketMatch.findMany({
      where: { status: 'FINISHED', isActive: true },
      select: { league: true },
      distinct: ['league'],
      orderBy: { league: 'asc' },
    })

    // Global missing scores count (unfiltered — for the backfill button)
    const globalMissing = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(`
      SELECT COUNT(*) as cnt FROM "MarketMatch"
      WHERE "status" = 'FINISHED' AND "isActive" = true
      AND ("finalResult" IS NULL OR "finalResult" = '{}'::jsonb OR "finalResult" = 'null'::jsonb)
    `)

    return NextResponse.json({
      success: true,
      data: filtered,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      stats: {
        totalFinished: allFinished.length,
        totalWithScores,
        totalMissingScores,
        globalMissingScores: Number(globalMissing[0]?.cnt ?? 0),
        totalWithQpModels,
        v1: {
          total: v1Total,
          correct: v1CorrectCount,
          accuracy: v1Total > 0 ? Math.round((v1CorrectCount / v1Total) * 1000) / 10 : null,
        },
        v2: {
          total: v2Total,
          correct: v2CorrectCount,
          accuracy: v2Total > 0 ? Math.round((v2CorrectCount / v2Total) * 1000) / 10 : null,
        },
        v3: {
          total: v3Total,
          correct: v3CorrectCount,
          accuracy: v3Total > 0 ? Math.round((v3CorrectCount / v3Total) * 1000) / 10 : null,
        },
        headToHead: {
          agreeBoth,
          agreeCorrect,
          agreeAccuracy: agreeBoth > 0 ? Math.round((agreeCorrect / agreeBoth) * 1000) / 10 : null,
          disagreeBoth,
          disagreeV1Right,
          disagreeV2Right,
          disagreeNeitherRight: disagreeBoth - disagreeV1Right - disagreeV2Right,
        },
        allThreeAgree: {
          total: agreeAllThree,
          correct: agreeAllThreeCorrect,
          accuracy: agreeAllThree > 0 ? Math.round((agreeAllThreeCorrect / agreeAllThree) * 1000) / 10 : null,
        },
        premiumTiers: Object.fromEntries(
          Object.entries(tierStats).map(([tier, s]) => [
            tier,
            { total: s.total, correct: s.correct, accuracy: s.total > 0 ? Math.round((s.correct / s.total) * 1000) / 10 : null },
          ])
        ),
      },
      leagues: leagueRows.map((l) => l.league),
    })
  } catch (error) {
    console.error('[Admin Reports] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
