/**
 * Identify upcoming MarketMatch rows that need /predict refreshed and
 * call the production endpoint for each. Mirrors the "Run Predict" button
 * behaviour in /admin/matches but in bulk + headless.
 *
 * "Needs predict" criteria (matches admin page logic at
 * app/api/admin/matches/upcoming/route.ts:180-195):
 *   - UPCOMING status
 *   - kickoff within --hours window (default 72)
 *   - AND either:
 *       a. No QuickPurchase row OR predictionData is null/empty
 *       b. predictionData exists but lastEnrichmentAt > 6h ago (stale)
 *
 * Usage:
 *   npx tsx scripts/refresh-stale-predictions.ts --dry-run           (default)
 *   npx tsx scripts/refresh-stale-predictions.ts --commit
 *   npx tsx scripts/refresh-stale-predictions.ts --commit --hours=24
 *   npx tsx scripts/refresh-stale-predictions.ts --commit --include-stale  (include 6h+ stale, default ON)
 *   npx tsx scripts/refresh-stale-predictions.ts --commit --missing-only   (skip stale, only no-data)
 *
 * Calls https://www.snapbet.bet/api/predictions/predict with Bearer
 * CRON_SECRET so we don't need an admin session. Rate-limited to 1
 * request per 600ms to be polite to the upstream model server.
 */
import prisma from '../lib/db'
import { config as dotenv } from 'dotenv'

dotenv({ path: '.env.local' })
dotenv({ path: '.env' })

const PREDICTION_TTL_MS = 6 * 60 * 60 * 1000
const RATE_LIMIT_MS = 600
const PROD_URL = process.env.PREDICT_PROD_URL || 'https://www.snapbet.bet'

function arg(flag: string, defaultValue: string | null = null): string | null {
  const found = process.argv.find(a => a === flag || a.startsWith(`${flag}=`))
  if (!found) return defaultValue
  if (found === flag) return ''
  return found.split('=', 2)[1]
}

;(async () => {
  const commit = process.argv.includes('--commit')
  const missingOnly = process.argv.includes('--missing-only')
  const hours = parseInt(arg('--hours', '72') || '72', 10)
  const now = new Date()
  const horizon = new Date(now.getTime() + hours * 3600 * 1000)
  const staleCutoff = now.getTime() - PREDICTION_TTL_MS

  const cronSecret = process.env.CRON_SECRET
  if (commit && !cronSecret) {
    console.error('❌ CRON_SECRET not found in .env / .env.local — required for --commit')
    process.exit(1)
  }

  console.log('\n══════════════════════════════════════════════════════════')
  console.log(` Refresh Stale Predictions · ${commit ? '🔴 COMMIT' : '🟡 DRY-RUN'}`)
  console.log(`  Window:        upcoming + kickoff within ${hours}h`)
  console.log(`  Mode:          ${missingOnly ? 'missing-only (skip stale)' : 'missing + stale (>6h)'}`)
  console.log(`  Target:        ${PROD_URL}/api/predictions/predict`)
  console.log('══════════════════════════════════════════════════════════\n')

  // Pull candidate matches + their QuickPurchase rows (to detect predictionData + lastEnrichmentAt)
  const matches = await prisma.marketMatch.findMany({
    where: {
      status: 'UPCOMING',
      kickoffDate: { gte: now, lte: horizon },
      isActive: true,
    },
    select: {
      id: true,
      matchId: true,
      homeTeam: true,
      awayTeam: true,
      league: true,
      kickoffDate: true,
    },
    orderBy: { kickoffDate: 'asc' },
  })
  console.log(`Upcoming matches in window: ${matches.length}`)

  const matchIds = matches.map(m => m.matchId)
  const qps = await prisma.quickPurchase.findMany({
    where: { matchId: { in: matchIds } },
    select: { matchId: true, predictionData: true, lastEnrichmentAt: true, isPredictionActive: true },
  })
  const qpByMatchId = new Map<string, typeof qps>()
  for (const qp of qps) {
    const arr = qpByMatchId.get(qp.matchId) || []
    arr.push(qp)
    qpByMatchId.set(qp.matchId, arr)
  }

  // Filter to needs-refresh
  type Candidate = {
    matchId: string
    homeTeam: string
    awayTeam: string
    league: string
    kickoffDate: Date
    reason: 'missing' | 'stale'
    lastEnrichmentAt: Date | null
  }
  const candidates: Candidate[] = []
  let skipFresh = 0
  for (const m of matches) {
    const matchQps = qpByMatchId.get(m.matchId) || []
    const hasPredData = matchQps.some(qp => {
      if (!qp.predictionData) return false
      const s = JSON.stringify(qp.predictionData)
      return s !== '{}' && s !== 'null' && s !== '[]'
    })

    if (!hasPredData) {
      candidates.push({
        matchId: m.matchId,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        league: m.league,
        kickoffDate: m.kickoffDate,
        reason: 'missing',
        lastEnrichmentAt: null,
      })
      continue
    }

    if (missingOnly) { skipFresh++; continue }

    // Stale check
    const enrichmentTs = matchQps
      .map(qp => qp.lastEnrichmentAt?.getTime())
      .filter((t): t is number => typeof t === 'number')
    const newest = enrichmentTs.length > 0 ? Math.max(...enrichmentTs) : null
    if (newest === null || newest < staleCutoff) {
      candidates.push({
        matchId: m.matchId,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        league: m.league,
        kickoffDate: m.kickoffDate,
        reason: 'stale',
        lastEnrichmentAt: newest ? new Date(newest) : null,
      })
    } else {
      skipFresh++
    }
  }

  const missingCount = candidates.filter(c => c.reason === 'missing').length
  const staleCount = candidates.filter(c => c.reason === 'stale').length
  console.log(`Needs predict: ${candidates.length}`)
  console.log(`  · Missing predictionData:  ${missingCount}`)
  console.log(`  · Stale (>6h enrichment):  ${staleCount}`)
  console.log(`  · Fresh (skipped):         ${skipFresh}`)

  console.log('\nSample (first 10):')
  for (const c of candidates.slice(0, 10)) {
    const age = c.lastEnrichmentAt
      ? `${Math.round((now.getTime() - c.lastEnrichmentAt.getTime()) / 3600000)}h old`
      : 'never'
    console.log(`  [${c.reason.padEnd(7)}] ${c.kickoffDate.toISOString().slice(0, 16)} · ${c.matchId} · ${c.homeTeam} vs ${c.awayTeam} (${c.league}) · last enriched: ${age}`)
  }

  if (!commit) {
    console.log('\n🟡 DRY-RUN — pass --commit to actually refresh.\n')
    await prisma.$disconnect()
    process.exit(0)
  }

  if (candidates.length === 0) {
    console.log('\n✅ Nothing to refresh.\n')
    await prisma.$disconnect()
    process.exit(0)
  }

  console.log(`\n🔴 Refreshing ${candidates.length} matches at ${PROD_URL}/api/predictions/predict ...`)
  console.log(`Rate limit: 1 req per ${RATE_LIMIT_MS}ms (~${Math.round(60000 / RATE_LIMIT_MS)} req/min)`)
  console.log(`ETA: ~${Math.ceil((candidates.length * RATE_LIMIT_MS) / 60000)} min\n`)

  let ok = 0
  let fail = 0
  let i = 0
  for (const c of candidates) {
    i++
    try {
      const t0 = Date.now()
      const res = await fetch(`${PROD_URL}/api/predictions/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cronSecret}`,
        },
        body: JSON.stringify({ match_id: parseInt(c.matchId), force: c.reason === 'stale' }),
      })
      const dt = Date.now() - t0

      if (!res.ok) {
        fail++
        const errBody = await res.text().catch(() => '')
        console.log(`  [${i}/${candidates.length}] ❌ ${c.matchId} ${c.homeTeam} vs ${c.awayTeam} — HTTP ${res.status} (${dt}ms): ${errBody.slice(0, 120)}`)
      } else {
        ok++
        const data = await res.json().catch(() => null) as { success?: boolean; message?: string } | null
        const tag = data?.success === false ? '⚠️' : '✅'
        const msg = data?.message ?? ''
        console.log(`  [${i}/${candidates.length}] ${tag} ${c.matchId} ${c.homeTeam} vs ${c.awayTeam} (${dt}ms) ${msg}`)
      }
    } catch (e) {
      fail++
      console.log(`  [${i}/${candidates.length}] ❌ ${c.matchId}: ${e instanceof Error ? e.message : e}`)
    }

    if (i < candidates.length) {
      await new Promise(r => setTimeout(r, RATE_LIMIT_MS))
    }
  }

  console.log(`\n══════════════════════════════════════════════════════════`)
  console.log(`Done. ${ok} succeeded · ${fail} failed · ${candidates.length} total\n`)
  await prisma.$disconnect()
  process.exit(fail > 0 ? 1 : 0)
})()
