/**
 * One-shot refresh of V3 predictions for all upcoming soccer matches.
 *
 * Calls our own /api/predictions/predict endpoint per match. The route
 * already persists v3Model to MarketMatch (line 585-588) and is now fixed
 * (commit bd85fd6) to write picks correctly. This script just triggers
 * fresh writes via the new code path.
 *
 * Why this exists: historical v3Model rows were written by the broken
 * upstream / route combo. The repair script fixed picks against the
 * already-stored (suspect) probs. A proper test of fixed V3 requires
 * fresh probs from the now-fixed upstream + route — that's what this does.
 *
 * Run with:
 *   npx tsx scripts/refresh-upcoming-v3.ts                 # full run, production base
 *   npx tsx scripts/refresh-upcoming-v3.ts --dry-run       # list targets, no calls
 *   npx tsx scripts/refresh-upcoming-v3.ts --limit 10      # smoke test
 *   npx tsx scripts/refresh-upcoming-v3.ts --concurrency 4 # default 3
 *   npx tsx scripts/refresh-upcoming-v3.ts --base-url http://localhost:3000
 */

import prisma from '../lib/db'
import * as path from 'path'
import * as fs from 'fs'

// Load .env.local so CRON_SECRET is available when running from CLI
function loadEnvFile() {
  const root = path.resolve(__dirname, '..')
  for (const name of ['.env.local', '.env', 'env']) {
    const p = path.join(root, name)
    if (!fs.existsSync(p)) continue
    const lines = fs.readFileSync(p, 'utf-8').split('\n')
    for (const line of lines) {
      const match = line.match(/^([^#=\s][^=]*)=(.*)$/)
      if (match) {
        const [, key, val] = match
        if (!process.env[key]) process.env[key] = val.trim()
      }
    }
    break
  }
}
loadEnvFile()

const CRON_SECRET = process.env.CRON_SECRET
if (!CRON_SECRET) {
  console.error('CRON_SECRET not set. Add it to .env.local and retry.')
  process.exit(1)
}

const DRY_RUN = process.argv.includes('--dry-run')
const LIMIT_ARG = process.argv.indexOf('--limit')
const LIMIT = LIMIT_ARG !== -1 ? parseInt(process.argv[LIMIT_ARG + 1], 10) : undefined
const CONC_ARG = process.argv.indexOf('--concurrency')
// Default 2 — observed in production that concurrency 3 saturated the
// upstream Replit instance after ~30 min sustained, triggering 504s.
const CONCURRENCY = CONC_ARG !== -1 ? parseInt(process.argv[CONC_ARG + 1], 10) : 2
const BASE_ARG = process.argv.indexOf('--base-url')
const BASE_URL = BASE_ARG !== -1 ? process.argv[BASE_ARG + 1] : 'https://www.snapbet.bet'
const DELAY_ARG = process.argv.indexOf('--batch-delay')
const BATCH_DELAY_MS = DELAY_ARG !== -1 ? parseInt(process.argv[DELAY_ARG + 1], 10) : 1500
// --id-file <path>: read newline-separated match_ids from file instead of
// querying upcoming. Use for targeted retries or backfilling finished matches.
const ID_FILE_ARG = process.argv.indexOf('--id-file')
const ID_FILE = ID_FILE_ARG !== -1 ? process.argv[ID_FILE_ARG + 1] : undefined

interface Match {
  matchId: string
  homeTeam: string
  awayTeam: string
  league: string
  kickoffDate: Date
}

interface Result {
  matchId: string
  ok: boolean
  ms: number
  v3Pick?: string | null
  v3Conf?: number | null
  selectedModel?: string | null
  error?: string
}

async function callPredict(matchId: string): Promise<Result> {
  const url = `${BASE_URL}/api/predictions/predict`
  const t0 = Date.now()
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CRON_SECRET}`,
      },
      body: JSON.stringify({ match_id: Number(matchId), force: true }),
      signal: AbortSignal.timeout(60000),
    })
    const ms = Date.now() - t0
    if (!r.ok) {
      const txt = await r.text().catch(() => '')
      return { matchId, ok: false, ms, error: `HTTP ${r.status}: ${txt.slice(0, 100)}` }
    }
    // Best-effort read of returned shape so we can log V3 info
    const j: any = await r.json().catch(() => ({}))
    const fd = j?.prediction?.predictions?.final_decision || j?.predictions?.final_decision || {}
    return {
      matchId,
      ok: true,
      ms,
      v3Pick: fd?.model_agreement?.v3_pick ?? null,
      selectedModel: fd?.selected_model ?? null,
    }
  } catch (e: any) {
    return { matchId, ok: false, ms: Date.now() - t0, error: e?.message ?? String(e) }
  }
}

async function processBatch(batch: Match[]): Promise<Result[]> {
  return Promise.all(batch.map((m) => callPredict(m.matchId)))
}

async function main() {
  const now = new Date()
  console.log(`Refreshing V3 for upcoming soccer matches`)
  console.log(`  base URL:    ${BASE_URL}`)
  console.log(`  concurrency: ${CONCURRENCY}`)
  console.log(`  batch delay: ${BATCH_DELAY_MS}ms`)
  console.log(`  dry-run:     ${DRY_RUN}`)
  if (LIMIT) console.log(`  limit:       ${LIMIT}`)
  console.log()

  let matches: Match[]
  if (ID_FILE) {
    // Targeted mode: read IDs from file, look up metadata for logging.
    if (!fs.existsSync(ID_FILE)) {
      console.error(`--id-file not found: ${ID_FILE}`)
      process.exit(1)
    }
    const ids = fs.readFileSync(ID_FILE, 'utf-8').split('\n').map(s => s.trim()).filter(Boolean)
    console.log(`  source:      --id-file ${ID_FILE} (${ids.length} IDs)`)
    matches = (await prisma.marketMatch.findMany({
      where: { matchId: { in: ids } },
      select: { matchId: true, homeTeam: true, awayTeam: true, league: true, kickoffDate: true },
      ...(LIMIT ? { take: LIMIT } : {}),
    })) as Match[]
    // Preserve file order
    const order = new Map(ids.map((id, i) => [id, i]))
    matches.sort((a, b) => (order.get(a.matchId) ?? 0) - (order.get(b.matchId) ?? 0))
  } else {
    matches = (await prisma.marketMatch.findMany({
      where: {
        status: 'UPCOMING',
        isActive: true,
        kickoffDate: { gte: now },
      },
      select: { matchId: true, homeTeam: true, awayTeam: true, league: true, kickoffDate: true },
      orderBy: { kickoffDate: 'asc' },
      ...(LIMIT ? { take: LIMIT } : {}),
    })) as Match[]
  }

  console.log(`Targets: ${matches.length} matches\n`)

  if (DRY_RUN) {
    for (const m of matches.slice(0, 20)) {
      console.log(`  ${m.matchId}  ${m.kickoffDate.toISOString().slice(0, 16)}  ${m.homeTeam} v ${m.awayTeam}  (${m.league})`)
    }
    if (matches.length > 20) console.log(`  ... and ${matches.length - 20} more`)
    await prisma.$disconnect()
    return
  }

  const t0 = Date.now()
  let succeeded = 0
  let failed = 0
  const errors: Result[] = []
  const samples: Result[] = []

  for (let i = 0; i < matches.length; i += CONCURRENCY) {
    const batch = matches.slice(i, i + CONCURRENCY)
    const results = await processBatch(batch)
    for (let j = 0; j < results.length; j++) {
      const r = results[j]
      const m = batch[j]
      if (r.ok) {
        succeeded++
        if (samples.length < 6) samples.push(r)
        const pickInfo = r.v3Pick ? `v3=${r.v3Pick}` : 'v3=?'
        const modelInfo = r.selectedModel || '?'
        process.stdout.write(`✓ ${r.matchId} ${m.homeTeam.slice(0, 14).padEnd(14)} v ${m.awayTeam.slice(0, 14).padEnd(14)} ${pickInfo.padEnd(12)} sel=${modelInfo.padEnd(10)} (${r.ms}ms)\n`)
      } else {
        failed++
        errors.push(r)
        process.stdout.write(`✗ ${r.matchId} FAIL (${r.ms}ms) — ${r.error}\n`)
      }
    }
    const done = i + batch.length
    const elapsed = ((Date.now() - t0) / 1000).toFixed(0)
    const rate = (done / Math.max(1, parseInt(elapsed))).toFixed(1)
    if (done % (CONCURRENCY * 5) === 0) {
      console.log(`  ── progress: ${done}/${matches.length}  (${elapsed}s, ${rate} matches/s)\n`)
    }
    if (i + CONCURRENCY < matches.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS))
    }
  }

  const totalMs = Date.now() - t0
  console.log()
  console.log('='.repeat(72))
  console.log(`Done in ${(totalMs / 1000).toFixed(1)}s`)
  console.log(`  Succeeded: ${succeeded}/${matches.length}`)
  console.log(`  Failed:    ${failed}`)
  if (errors.length > 0) {
    console.log(`\nFirst 5 errors:`)
    for (const e of errors.slice(0, 5)) {
      console.log(`  ${e.matchId}: ${e.error}`)
    }
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('refresh-upcoming-v3 fatal:', e)
  process.exit(1)
})
