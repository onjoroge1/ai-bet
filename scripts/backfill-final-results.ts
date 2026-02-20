/**
 * Backfill script: populate finalResult for all FINISHED MarketMatch records.
 *
 * Strategy (in priority order for each match):
 *   1. If `currentScore` is already in DB → derive finalResult from it (no API call needed).
 *   2. If no local score → call the external BACKEND_API_URL to fetch the finished match.
 *   3. If external API returns a score → persist it.
 *   4. If external API fails / times out → skip and log.
 *
 * Run with:
 *   npx tsx scripts/backfill-final-results.ts
 *
 * Optional env vars (read from process.env or from .env / env file):
 *   BACKEND_API_URL  – base URL for the match API
 *   BACKEND_API_KEY  – bearer token (defaults to dev key)
 *   BACKFILL_BATCH   – how many API calls to make in parallel  (default 5)
 *   BACKFILL_DELAY   – ms to wait between batches              (default 1000)
 */

import prisma from '../lib/db'
import * as path from 'path'
import * as fs from 'fs'

// ── Load .env / env file if running standalone ──────────────────────────────
function loadEnvFile() {
  const root = path.resolve(__dirname, '..')
  for (const name of ['.env.local', '.env', 'env']) {
    const p = path.join(root, name)
    if (!fs.existsSync(p)) continue
    const lines = fs.readFileSync(p, 'utf-8').split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx < 1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
      if (!process.env[key]) process.env[key] = val
    }
    console.log(`[env] Loaded ${p}`)
    break
  }
}
loadEnvFile()

const BASE_URL = process.env.BACKEND_API_URL || process.env.BACKEND_URL
const API_KEY = process.env.BACKEND_API_KEY || process.env.NEXT_PUBLIC_MARKET_KEY || 'betgenius_secure_key_2024'
const BATCH_SIZE = parseInt(process.env.BACKFILL_BATCH || '5', 10)
const BATCH_DELAY = parseInt(process.env.BACKFILL_DELAY || '1000', 10)
const API_TIMEOUT = 10_000 // 10s per individual request

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true when finalResult is null or an empty object `{}` */
function isMissingFinalResult(fr: unknown): boolean {
  if (fr === null || fr === undefined) return true
  if (typeof fr === 'object' && Object.keys(fr as object).length === 0) return true
  return false
}

/** Derives a finalResult object from a raw score {home, away} */
function buildFinalResult(home: number, away: number) {
  return {
    score: { home, away },
    outcome: home > away ? 'home' : away > home ? 'away' : 'draw',
    outcome_text: home > away ? 'Home Win' : away > home ? 'Away Win' : 'Draw',
  }
}

/** Fetch a finished match from the external API */
async function fetchMatchFromApi(matchId: string): Promise<{ home: number; away: number } | null> {
  if (!BASE_URL) return null

  const url = `${BASE_URL}/market?match_id=${matchId}&status=finished`
  try {
    const abort = new AbortController()
    const timeout = setTimeout(() => abort.abort(), API_TIMEOUT)
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      signal: abort.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) return null
    const data = await res.json()
    const match = data.matches?.[0]
    if (!match) return null

    // Try final_result first
    const fr = match.final_result
    if (fr?.score?.home !== undefined && fr?.score?.away !== undefined) {
      return { home: Number(fr.score.home), away: Number(fr.score.away) }
    }
    // Fall back to current_score / live_data
    const cs = match.current_score ?? match.live_data?.current_score
    if (cs?.home !== undefined && cs?.away !== undefined) {
      return { home: Number(cs.home), away: Number(cs.away) }
    }
    return null
  } catch {
    return null
  }
}

// ── Phase 1: derive from existing currentScore ───────────────────────────────

async function backfillFromCurrentScore(): Promise<{ fixed: number; skipped: number }> {
  console.log('\n📋 Phase 1: Copy currentScore → finalResult where score already in DB\n')

  const matches = await prisma.marketMatch.findMany({
    where: {
      status: 'FINISHED',
      currentScore: { not: null },
    },
    select: { matchId: true, homeTeam: true, awayTeam: true, currentScore: true, finalResult: true },
  })

  const toDo = matches.filter(m => isMissingFinalResult(m.finalResult))
  console.log(`   Found ${toDo.length} / ${matches.length} FINISHED matches needing finalResult from currentScore\n`)

  let fixed = 0
  let skipped = 0

  for (const m of toDo) {
    const cs = m.currentScore as { home?: number; away?: number } | null
    if (!cs || cs.home === undefined || cs.away === undefined) {
      console.log(`   ⚠️  ${m.matchId} — currentScore malformed, skipping`)
      skipped++
      continue
    }
    const finalResult = buildFinalResult(cs.home, cs.away)
    await prisma.marketMatch.update({
      where: { matchId: m.matchId },
      data: { finalResult },
    })
    console.log(`   ✅ ${m.matchId}: ${m.homeTeam} ${cs.home}-${cs.away} ${m.awayTeam}`)
    fixed++
  }

  return { fixed, skipped }
}

// ── Phase 2: fetch missing scores from external API ──────────────────────────

async function backfillFromApi(): Promise<{ fixed: number; failed: number; noData: number }> {
  console.log('\n📡 Phase 2: Fetch finalResult from external API for matches still missing scores\n')

  if (!BASE_URL) {
    console.log('   ⚠️  BACKEND_API_URL not set — skipping API phase\n')
    return { fixed: 0, failed: 0, noData: 0 }
  }

  // Re-query — Phase 1 may have fixed some, now find what's still missing
  const stillMissing = await prisma.marketMatch.findMany({
    where: { status: 'FINISHED' },
    select: { matchId: true, homeTeam: true, awayTeam: true, finalResult: true },
  })

  const toDo = stillMissing.filter(m => isMissingFinalResult(m.finalResult))
  console.log(`   Found ${toDo.length} FINISHED matches still without finalResult — will query API\n`)
  console.log(`   Batch size: ${BATCH_SIZE}, delay between batches: ${BATCH_DELAY}ms\n`)

  let fixed = 0
  let failed = 0
  let noData = 0

  for (let i = 0; i < toDo.length; i += BATCH_SIZE) {
    const batch = toDo.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(toDo.length / BATCH_SIZE)
    console.log(`   Batch ${batchNum}/${totalBatches} (matches ${i + 1}–${Math.min(i + BATCH_SIZE, toDo.length)})`)

    await Promise.all(
      batch.map(async (m) => {
        try {
          const score = await fetchMatchFromApi(m.matchId)
          if (!score) {
            console.log(`     ⬜ ${m.matchId} (${m.homeTeam} vs ${m.awayTeam}) — no score from API`)
            noData++
            return
          }
          const finalResult = buildFinalResult(score.home, score.away)
          await prisma.marketMatch.update({
            where: { matchId: m.matchId },
            data: { finalResult, currentScore: { home: score.home, away: score.away } },
          })
          console.log(`     ✅ ${m.matchId}: ${m.homeTeam} ${score.home}-${score.away} ${m.awayTeam}`)
          fixed++
        } catch (err) {
          console.error(`     ❌ ${m.matchId}: error —`, (err as Error).message)
          failed++
        }
      })
    )

    if (i + BATCH_SIZE < toDo.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY))
    }
  }

  return { fixed, failed, noData }
}

// ── Phase 3: fix stale LIVE matches (>3 h since kickoff) ────────────────────

async function fixStaleLiveMatches(): Promise<{ fixed: number }> {
  console.log('\n🔄 Phase 3: Flip stale LIVE matches (>3 h) to FINISHED\n')

  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000)

  const stale = await prisma.marketMatch.findMany({
    where: {
      status: 'LIVE',
      kickoffDate: { lt: threeHoursAgo },
      currentScore: { not: null },
    },
    select: { matchId: true, homeTeam: true, awayTeam: true, currentScore: true, kickoffDate: true },
  })

  console.log(`   Found ${stale.length} stale LIVE matches\n`)

  let fixed = 0
  for (const m of stale) {
    const cs = m.currentScore as { home?: number; away?: number } | null
    if (!cs || cs.home === undefined || cs.away === undefined) continue

    const hoursOld = ((Date.now() - m.kickoffDate.getTime()) / 3600_000).toFixed(1)
    const finalResult = buildFinalResult(cs.home, cs.away)

    await prisma.marketMatch.update({
      where: { matchId: m.matchId },
      data: { status: 'FINISHED', finalResult },
    })
    console.log(`   ✅ ${m.matchId} (${hoursOld}h old): ${m.homeTeam} ${cs.home}-${cs.away} ${m.awayTeam}`)
    fixed++
  }

  return { fixed }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + '═'.repeat(70))
  console.log('  SnapBet AI — finalResult Backfill Script')
  console.log('═'.repeat(70))
  console.log(`  Started: ${new Date().toISOString()}`)
  console.log(`  API base: ${BASE_URL || '(not configured)'}`)
  console.log('═'.repeat(70))

  const p1 = await backfillFromCurrentScore()
  const p2 = await backfillFromApi()
  const p3 = await fixStaleLiveMatches()

  console.log('\n' + '═'.repeat(70))
  console.log('  SUMMARY')
  console.log('═'.repeat(70))
  console.log(`  Phase 1 (currentScore → finalResult): ✅ ${p1.fixed} fixed, ⚠️  ${p1.skipped} skipped`)
  console.log(`  Phase 2 (API fetch):                  ✅ ${p2.fixed} fixed, ⬜ ${p2.noData} no data, ❌ ${p2.failed} errors`)
  console.log(`  Phase 3 (stale LIVE → FINISHED):      ✅ ${p3.fixed} fixed`)
  console.log(`  Total fixed: ${p1.fixed + p2.fixed + p3.fixed}`)
  console.log(`  Completed: ${new Date().toISOString()}`)
  console.log('═'.repeat(70) + '\n')

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error('Fatal error:', err)
  await prisma.$disconnect()
  process.exit(1)
})
