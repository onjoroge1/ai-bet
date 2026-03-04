import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY
const BACKEND_BASE = process.env.BACKEND_API_URL || process.env.BACKEND_URL
const BACKEND_KEY = process.env.BACKEND_API_KEY || process.env.NEXT_PUBLIC_MARKET_KEY || 'betgenius_secure_key_2024'

const API_FOOTBALL_HOST = 'api-football-v1.p.rapidapi.com'
const API_FOOTBALL_BASE = `https://${API_FOOTBALL_HOST}/v3`
const REQUEST_DELAY = 350
const BATCH_SIZE = 5

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildFinalResult(home: number, away: number) {
  return {
    score: { home, away },
    outcome: home > away ? 'home' : away > home ? 'away' : 'draw',
    outcome_text: home > away ? 'Home Win' : away > home ? 'Away Win' : 'Draw',
  }
}

/** Normalise team name for fuzzy comparison. */
function normaliseTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\bfc\b/g, '')
    .replace(/\bsc\b/g, '')
    .replace(/\bac\b/g, '')
    .replace(/\bcf\b/g, '')
    .replace(/\bsv\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

/**
 * Simple similarity score between two team names (0-1).
 * Uses normalised substring matching.
 */
function teamSimilarity(a: string, b: string): number {
  const na = normaliseTeamName(a)
  const nb = normaliseTeamName(b)
  if (na === nb) return 1
  if (na.includes(nb) || nb.includes(na)) return 0.9
  // Levenshtein-lite: check shared prefix ratio
  let shared = 0
  const minLen = Math.min(na.length, nb.length)
  for (let i = 0; i < minLen; i++) {
    if (na[i] === nb[i]) shared++
    else break
  }
  return shared / Math.max(na.length, nb.length)
}

interface ApiFootballFixture {
  fixture: { id: number; date: string; status: { short: string } }
  teams: { home: { name: string }; away: { name: string } }
  goals: { home: number | null; away: number | null }
  score: { fulltime: { home: number | null; away: number | null } }
}

/**
 * Fetch completed fixtures from API-Football for a given date and league.
 * Caches by (date, leagueId) to avoid duplicate calls.
 */
const fixtureCache = new Map<string, ApiFootballFixture[]>()

/** Derive the football season year from a match date (Aug–Dec = that year, Jan–Jul = previous year). */
function seasonFromDate(dateStr: string): number {
  const d = new Date(dateStr)
  const month = d.getMonth() // 0-indexed
  return month >= 7 ? d.getFullYear() : d.getFullYear() - 1
}

async function fetchApiFootballFixtures(
  dateStr: string,
  leagueId: number
): Promise<ApiFootballFixture[]> {
  const cacheKey = `${dateStr}_${leagueId}`
  if (fixtureCache.has(cacheKey)) return fixtureCache.get(cacheKey)!

  if (!RAPIDAPI_KEY) return []

  try {
    const season = seasonFromDate(dateStr)
    const url = `${API_FOOTBALL_BASE}/fixtures?date=${dateStr}&league=${leagueId}&season=${season}&status=FT`
    const res = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': API_FOOTBALL_HOST,
      },
    })
    if (!res.ok) {
      console.warn(`[Backfill] API-Football ${res.status} for ${dateStr} league ${leagueId}`)
      fixtureCache.set(cacheKey, [])
      return []
    }
    const data = await res.json()
    if (data.errors && Object.keys(data.errors).length > 0) {
      console.warn(`[Backfill] API-Football errors for ${dateStr} league ${leagueId}:`, data.errors)
    }
    const fixtures = (data.response ?? []) as ApiFootballFixture[]
    console.log(`[Backfill] API-Football: ${dateStr} league ${leagueId} season ${season} → ${fixtures.length} fixtures`)
    fixtureCache.set(cacheKey, fixtures)
    return fixtures
  } catch (err) {
    console.warn(`[Backfill] API-Football fetch error:`, err)
    fixtureCache.set(cacheKey, [])
    return []
  }
}

/**
 * Try to find a matching fixture for a MarketMatch by team name similarity.
 */
function findMatchingFixture(
  fixtures: ApiFootballFixture[],
  homeTeam: string,
  awayTeam: string
): ApiFootballFixture | null {
  let bestMatch: ApiFootballFixture | null = null
  let bestScore = 0

  for (const f of fixtures) {
    const homeScore = teamSimilarity(homeTeam, f.teams.home.name)
    const awayScore = teamSimilarity(awayTeam, f.teams.away.name)
    const combined = (homeScore + awayScore) / 2

    if (combined > bestScore && combined >= 0.5) {
      bestScore = combined
      bestMatch = f
    }
  }

  return bestMatch
}

/** Fetch score from backend API (existing backfill logic). */
async function fetchFromBackendApi(matchId: string): Promise<{ home: number; away: number } | null> {
  if (!BACKEND_BASE) return null
  try {
    const abort = new AbortController()
    const timeout = setTimeout(() => abort.abort(), 10_000)
    const res = await fetch(`${BACKEND_BASE}/market?match_id=${matchId}&status=finished`, {
      headers: { Authorization: `Bearer ${BACKEND_KEY}` },
      signal: abort.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) return null
    const data = await res.json()
    const match = data.matches?.[0]
    if (!match) return null

    const fr = match.final_result
    if (fr?.score?.home !== undefined && fr?.score?.away !== undefined) {
      return { home: Number(fr.score.home), away: Number(fr.score.away) }
    }
    const cs = match.current_score ?? match.live_data?.current_score ?? match.score
    if (cs?.home !== undefined && cs?.away !== undefined) {
      return { home: Number(cs.home), away: Number(cs.away) }
    }
    return null
  } catch {
    return null
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

/**
 * POST /api/admin/reports/backfill-scores
 *
 * Three-phase backfill for missing finalResult:
 *   Phase 1: Derive from existing DB currentScore.
 *   Phase 2: Match against API-Football (RapidAPI) by date + league + team names.
 *   Phase 3: Fetch from backend prediction API as last resort.
 *
 * Body: { limit?: number, skipApiFootball?: boolean, skipBackend?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const maxApiCalls = Math.min(300, Math.max(1, body.limit ?? 100))
    const skipApiFootball = body.skipApiFootball === true
    const skipBackend = body.skipBackend === true

    // ── Phase 1: derive from DB currentScore ──────────────────────────────
    const withCurrentScore = await prisma.$queryRawUnsafe<
      Array<{ matchId: string; currentScore: unknown }>
    >(`
      SELECT "matchId", "currentScore"
      FROM "MarketMatch"
      WHERE "status" = 'FINISHED'
      AND ("finalResult" IS NULL OR "finalResult" = '{}'::jsonb OR "finalResult" = 'null'::jsonb)
      AND "currentScore" IS NOT NULL AND "currentScore" != '{}'::jsonb AND "currentScore" != 'null'::jsonb
    `)

    let phase1Fixed = 0
    for (const m of withCurrentScore) {
      const cs = m.currentScore as { home?: number; away?: number } | null
      if (!cs || typeof cs.home !== 'number' || typeof cs.away !== 'number') continue
      await prisma.marketMatch.update({
        where: { matchId: m.matchId },
        data: { finalResult: buildFinalResult(cs.home, cs.away) },
      })
      phase1Fixed++
    }

    // ── Phase 2: API-Football (RapidAPI) ──────────────────────────────────
    let phase2Fixed = 0
    let phase2NoMatch = 0
    let phase2Errors = 0
    let apiCallsMade = 0

    if (!skipApiFootball && RAPIDAPI_KEY) {
      const stillMissing = await prisma.$queryRawUnsafe<
        Array<{ matchId: string; homeTeam: string; awayTeam: string; kickoffDate: Date; leagueId: string | null }>
      >(`
        SELECT "matchId", "homeTeam", "awayTeam", "kickoffDate", "leagueId"
        FROM "MarketMatch"
        WHERE "status" = 'FINISHED'
        AND ("finalResult" IS NULL OR "finalResult" = '{}'::jsonb OR "finalResult" = 'null'::jsonb)
        AND "leagueId" IS NOT NULL
        ORDER BY "kickoffDate" DESC
        LIMIT ${maxApiCalls}
      `)

      // Group by (date, leagueId) to minimise API calls
      const groups = new Map<string, typeof stillMissing>()
      for (const m of stillMissing) {
        const dateStr = new Date(m.kickoffDate).toISOString().split('T')[0]
        const key = `${dateStr}_${m.leagueId}`
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key)!.push(m)
      }

      for (const [key, matches] of groups) {
        const [dateStr, leagueIdStr] = key.split('_')
        const leagueId = parseInt(leagueIdStr, 10)
        if (isNaN(leagueId)) continue

        const fixtures = await fetchApiFootballFixtures(dateStr, leagueId)
        apiCallsMade++

        for (const m of matches) {
          const fixture = findMatchingFixture(fixtures, m.homeTeam, m.awayTeam)
          if (!fixture) {
            phase2NoMatch++
            continue
          }

          const goals = fixture.score?.fulltime ?? fixture.goals
          if (goals?.home == null || goals?.away == null) {
            phase2NoMatch++
            continue
          }

          try {
            await prisma.marketMatch.update({
              where: { matchId: m.matchId },
              data: {
                finalResult: buildFinalResult(goals.home, goals.away),
                currentScore: { home: goals.home, away: goals.away },
              },
            })
            phase2Fixed++
          } catch {
            phase2Errors++
          }
        }

        await new Promise((r) => setTimeout(r, REQUEST_DELAY))
      }
    }

    // ── Phase 3: Backend prediction API ───────────────────────────────────
    let phase3Fixed = 0
    let phase3NoData = 0
    let phase3Errors = 0

    if (!skipBackend && BACKEND_BASE) {
      const stillMissing2 = await prisma.$queryRawUnsafe<
        Array<{ matchId: string }>
      >(`
        SELECT "matchId"
        FROM "MarketMatch"
        WHERE "status" = 'FINISHED'
        AND ("finalResult" IS NULL OR "finalResult" = '{}'::jsonb OR "finalResult" = 'null'::jsonb)
        ORDER BY "kickoffDate" DESC
        LIMIT ${Math.min(50, maxApiCalls)}
      `)

      for (let i = 0; i < stillMissing2.length; i += BATCH_SIZE) {
        const batch = stillMissing2.slice(i, i + BATCH_SIZE)
        await Promise.all(
          batch.map(async (m) => {
            try {
              const score = await fetchFromBackendApi(m.matchId)
              if (!score) { phase3NoData++; return }
              await prisma.marketMatch.update({
                where: { matchId: m.matchId },
                data: {
                  finalResult: buildFinalResult(score.home, score.away),
                  currentScore: { home: score.home, away: score.away },
                },
              })
              phase3Fixed++
            } catch {
              phase3Errors++
            }
          })
        )
        if (i + BATCH_SIZE < stillMissing2.length) {
          await new Promise((r) => setTimeout(r, 800))
        }
      }
    }

    // ── Final count ───────────────────────────────────────────────────────
    const remaining = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(`
      SELECT COUNT(*) as cnt FROM "MarketMatch"
      WHERE "status" = 'FINISHED'
      AND ("finalResult" IS NULL OR "finalResult" = '{}'::jsonb OR "finalResult" = 'null'::jsonb)
    `)

    fixtureCache.clear()

    return NextResponse.json({
      success: true,
      phase1: { fixed: phase1Fixed, source: 'DB currentScore' },
      phase2: {
        fixed: phase2Fixed,
        noMatch: phase2NoMatch,
        errors: phase2Errors,
        apiCalls: apiCallsMade,
        source: 'API-Football (RapidAPI)',
        available: !!RAPIDAPI_KEY && !skipApiFootball,
      },
      phase3: {
        fixed: phase3Fixed,
        noData: phase3NoData,
        errors: phase3Errors,
        source: 'Backend prediction API',
        available: !!BACKEND_BASE && !skipBackend,
      },
      totalFixed: phase1Fixed + phase2Fixed + phase3Fixed,
      remainingMissing: Number(remaining[0]?.cnt ?? 0),
    })
  } catch (error) {
    console.error('[Backfill Scores] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
