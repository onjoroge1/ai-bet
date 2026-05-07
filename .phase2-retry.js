// Retry the 57 Phase 2 failures from the re-run.
require('dotenv').config({ path: '.env.local' })
const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

const BASE_URL = process.env.BACKEND_API_URL
const API_KEY = process.env.BACKEND_API_KEY || process.env.NEXT_PUBLIC_MARKET_KEY || 'betgenius_secure_key_2024'
const SINCE = new Date('2026-04-27T22:00:00Z')

function valueRatingFor(c) {
  if (c == null) return null
  if (c >= 80) return 'Very High'
  if (c >= 60) return 'High'
  if (c >= 40) return 'Medium'
  return 'Low'
}

async function predictWithRetry(matchId, attempt = 1) {
  try {
    const res = await fetch(BASE_URL + '/predict', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ match_id: parseInt(matchId), include_analysis: true }),
      signal: AbortSignal.timeout(120000), // longer timeout for retries
    })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    return await res.json()
  } catch (e) {
    if (attempt < 3) {
      await new Promise(r => setTimeout(r, 5000))
      return predictWithRetry(matchId, attempt + 1)
    }
    throw e
  }
}

(async () => {
  // Find all soccer QPs that did NOT get touched in the re-run (lastEnrichmentAt < SINCE)
  const soccerMatches = await p.marketMatch.findMany({
    where: { isActive: true },
    select: { matchId: true },
  })
  const idSet = new Set(soccerMatches.map(m => m.matchId))

  const stale = await p.quickPurchase.findMany({
    where: {
      matchId: { in: Array.from(idSet) },
      isActive: true,
      OR: [
        { lastEnrichmentAt: { lt: SINCE } },
        { lastEnrichmentAt: null },
      ],
    },
    select: { id: true, matchId: true, predictionData: true },
  })

  console.log('Stale soccer QPs to retry:', stale.length, '\n')

  let ok = 0, fail = 0
  const t0 = Date.now()

  for (const qp of stale) {
    try {
      const fresh = await predictWithRetry(qp.matchId)
      const pred = fresh?.predictions ?? {}
      const existingLegacy = qp.predictionData?.legacy_v3_broken ?? null
      const legacy = existingLegacy ?? qp.predictionData ?? null
      const enriched = { ...fresh, legacy_v3_broken: legacy }

      const conf = pred.confidence ?? pred.calibrated_confidence
      const confScore = typeof conf === 'number' ? Math.round(conf * 100) : null

      await p.quickPurchase.update({
        where: { id: qp.id },
        data: {
          predictionData: enriched,
          predictionType: pred.recommended_bet ?? null,
          confidenceScore: confScore,
          odds: fresh?.match_info?.odds?.home || null,
          valueRating: valueRatingFor(confScore),
          isPredictionActive: true,
          lastEnrichmentAt: new Date(),
          enrichmentCount: { increment: 1 },
        },
      })
      ok++
      console.log('  ✓ ' + qp.matchId + ' pick=' + pred.recommended_bet + ' tone=' + pred.recommendation_tone + ' surface=' + pred.should_surface)
    } catch (e) {
      fail++
      console.log('  ✗ ' + qp.matchId + ' err=' + (e.message || e).slice(0, 80))
    }
  }

  console.log('\n=== Retry complete ===')
  console.log('Time   :', ((Date.now() - t0) / 1000).toFixed(0) + 's')
  console.log('Success:', ok)
  console.log('Failed :', fail)

  await p.$disconnect()
})().catch(e => { console.error('FATAL:', e); process.exit(1) })
