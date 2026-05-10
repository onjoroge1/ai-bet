/**
 * Backfill script: fix MarketMatch.v3Model.pick for all rows where pick='draw'
 * but argmax(v3Model.probs) is actually 'home' or 'away'.
 *
 * Root cause: predict/route.ts had a broken JSON path that always stored pick='draw'
 * regardless of the actual V3 model prediction. The probs were stored correctly;
 * only the pick field was wrong.
 *
 * Strategy: for each affected row, recompute pick = argmax(v3Model.probs.home_win,
 * v3Model.probs.draw, v3Model.probs.away_win) and write it back.
 *
 * Run with:
 *   npx tsx scripts/backfill-v3model-picks.ts
 *
 * Flags:
 *   --dry-run   Print what would change without writing to DB
 *   --limit N   Only process first N rows (default: all)
 */

import prisma from '../lib/db'
import * as path from 'path'
import * as fs from 'fs'

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

const DRY_RUN = process.argv.includes('--dry-run')
const LIMIT_ARG = process.argv.indexOf('--limit')
const LIMIT = LIMIT_ARG !== -1 ? parseInt(process.argv[LIMIT_ARG + 1], 10) : undefined

const PICK_NORM: Record<string, string> = {
  home_win: 'home', home: 'home',
  away_win: 'away', away: 'away',
  draw: 'draw',
}

function argmaxPick(probs: Record<string, number>): string | null {
  // probs keys can be home_win/draw/away_win or home/draw/away
  const homeVal = probs.home_win ?? probs.home ?? 0
  const drawVal = probs.draw ?? 0
  const awayVal = probs.away_win ?? probs.away ?? 0

  if (homeVal === 0 && drawVal === 0 && awayVal === 0) return null

  if (homeVal >= drawVal && homeVal >= awayVal) return 'home'
  if (awayVal >= drawVal && awayVal >= homeVal) return 'away'
  return 'draw'
}

async function main() {
  console.log(`[Backfill] V3Model pick correction — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  if (LIMIT) console.log(`[Backfill] Limit: ${LIMIT} rows`)

  // Fetch all MarketMatch rows that have a v3Model stored
  const rows = await (prisma as any).marketMatch.findMany({
    where: { v3Model: { not: null } },
    select: { id: true, matchId: true, v3Model: true },
    ...(LIMIT ? { take: LIMIT } : {}),
  })

  console.log(`[Backfill] Found ${rows.length} MarketMatch rows with v3Model`)

  let alreadyCorrect = 0
  let noProbs = 0
  let willFix = 0
  let fixed = 0
  let errors = 0

  for (const row of rows) {
    const v3 = row.v3Model as any
    if (!v3 || typeof v3 !== 'object') { noProbs++; continue }

    const probs = v3.probs as Record<string, number> | undefined
    if (!probs || typeof probs !== 'object') { noProbs++; continue }

    const correctPick = argmaxPick(probs)
    if (!correctPick) { noProbs++; continue }

    const storedPick = PICK_NORM[v3.pick as string] ?? v3.pick

    if (storedPick === correctPick) {
      alreadyCorrect++
      continue
    }

    willFix++
    console.log(
      `[Backfill] matchId=${row.matchId} | stored pick="${v3.pick}" → correct pick="${correctPick}"` +
      ` | probs: home=${(probs.home_win ?? probs.home ?? 0).toFixed(3)}` +
      ` draw=${(probs.draw ?? 0).toFixed(3)}` +
      ` away=${(probs.away_win ?? probs.away ?? 0).toFixed(3)}`
    )

    if (!DRY_RUN) {
      try {
        await (prisma as any).marketMatch.update({
          where: { id: row.id },
          data: {
            v3Model: {
              ...v3,
              pick: correctPick,
            },
          },
        })
        fixed++
      } catch (e) {
        errors++
        console.error(`[Backfill] ❌ Failed to update matchId=${row.matchId}:`, e instanceof Error ? e.message : e)
      }
    }
  }

  console.log('\n[Backfill] Summary:')
  console.log(`  Already correct:  ${alreadyCorrect}`)
  console.log(`  No probs / skip:  ${noProbs}`)
  console.log(`  Need fix:         ${willFix}`)
  if (!DRY_RUN) {
    console.log(`  Fixed:            ${fixed}`)
    console.log(`  Errors:           ${errors}`)
  } else {
    console.log(`  (dry run — no writes performed)`)
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('[Backfill] Fatal error:', e)
  process.exit(1)
})
