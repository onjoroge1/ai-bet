import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'
import { getSnapBetPicks } from '@/lib/premium-picks-engine'
import { hasPremiumAccess } from '@/lib/premium-access'
import { getOrCompute } from '@/lib/ai-cache'

const BRIEFING_CACHE_VERSION = 'v1'

export const dynamic = 'force-dynamic'

/**
 * GET /api/dashboard/briefing
 *
 * Returns 5 LLM-generated bullets summarising what a bettor should look out
 * for today. Inputs are pulled server-side (top picks, best parlay edge,
 * today's match volume, per-league accuracy, calibration alerts) and sent
 * to OpenAI for a structured response.
 *
 * Caching:
 *   - Single shared cache (the briefing is data-global, identical for all
 *     users), keyed by hour. ~$0.001 per refresh × 24/day ≈ $0.024/day.
 *   - Premium gate is applied at READ time on the cached result (free users
 *     see first 2 bullets, premium see all 5). Don't burn an LLM call per
 *     premium check.
 */

interface BriefingBullet {
  text: string
  tier: 'free' | 'premium'
  icon: 'fire' | 'trend' | 'warn' | 'star' | 'check'
}

interface BriefingResponse {
  bullets: BriefingBullet[]
  generatedAt: string
  cached: boolean
}

// In-memory cache. Module-level — survives the lifetime of the worker.
let _cache: { data: BriefingResponse; expiresAt: number } | null = null
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

async function gatherBriefingInputs() {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000)

  const [picks, upcomingCount, recentFinished] = await Promise.all([
    // Top 5 surfaced picks today
    getSnapBetPicks(5).catch(() => []),
    // Today's match volume
    prisma.marketMatch.count({
      where: { status: 'UPCOMING', isActive: true, kickoffDate: { gte: now } },
    }),
    // Recent finished matches with V3 picks for league accuracy snapshot
    prisma.marketMatch.findMany({
      where: {
        status: 'FINISHED',
        isActive: true,
        finalResult: { not: null },
        v3Model: { not: null },
        kickoffDate: { gte: sevenDaysAgo },
      },
      select: { league: true, v3Model: true, finalResult: true },
      take: 200,
    }),
  ])

  // Top picks (for the LLM): just the headline data
  const topPicks = picks.slice(0, 5).map(p => ({
    league: p.league,
    match: `${p.homeTeam} vs ${p.awayTeam}`,
    pick: p.pickTeam,
    confidence: p.confidence,
    tier: p.tier,
  }))

  // Per-league accuracy over last 7 days (for "leagues to watch" + "leagues to avoid")
  const leagueStats: Record<string, { total: number; correct: number }> = {}
  for (const m of recentFinished) {
    const v3 = m.v3Model as any
    const fr = m.finalResult as any
    const pick = String(v3?.pick ?? '').toLowerCase()
    const outcomeRaw = fr?.outcome ?? (
      (fr?.score?.home ?? 0) > (fr?.score?.away ?? 0) ? 'home'
        : (fr?.score?.away ?? 0) > (fr?.score?.home ?? 0) ? 'away'
        : 'draw'
    )
    const outcome = String(outcomeRaw).toLowerCase().replace('_win', '')
    const norm = (x: string) => x === 'h' ? 'home' : x === 'd' ? 'draw' : x === 'a' ? 'away' : x
    if (!pick || !outcome) continue
    const lg = m.league || 'Unknown'
    leagueStats[lg] ||= { total: 0, correct: 0 }
    leagueStats[lg].total++
    if (norm(pick) === norm(outcome)) leagueStats[lg].correct++
  }
  const leaguesByAccuracy = Object.entries(leagueStats)
    .filter(([, s]) => s.total >= 5)
    .map(([league, s]) => ({ league, accuracy: s.correct / s.total, n: s.total }))
    .sort((a, b) => b.accuracy - a.accuracy)
  const topLeagues = leaguesByAccuracy.slice(0, 3)
  const weakLeagues = leaguesByAccuracy.slice(-3).reverse().filter(l => l.accuracy < 0.45)

  return {
    topPicks,
    matchesToday: upcomingCount,
    topLeagues,
    weakLeagues,
    sampleSize: recentFinished.length,
  }
}

/** Floor `now` to the start of the current UTC hour — used as the briefing
 *  cache key suffix so all instances within an hour converge on one entry. */
function currentHourKey(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}-${String(d.getUTCHours()).padStart(2, '0')}`
}

async function generateBriefing(): Promise<BriefingResponse> {
  // ── L1 hot-path: module memo (per-instance, saves a Postgres roundtrip) ──
  if (_cache && _cache.expiresAt > Date.now()) {
    return { ..._cache.data, cached: true }
  }

  const inputs = await gatherBriefingInputs()

  // No-data fallback (e.g., empty DB after reset). Don't cache — this is a
  // signal that the system is in a bad state, not steady-state.
  if (inputs.topPicks.length === 0 && inputs.matchesToday === 0) {
    return {
      bullets: [
        { text: 'No matches in the next 24 hours — check back when fixtures are scheduled.', tier: 'free', icon: 'check' },
        { text: 'Browse upcoming matches to start tracking opportunities.', tier: 'free', icon: 'trend' },
      ],
      generatedAt: new Date().toISOString(),
      cached: false,
    }
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    logger.warn('[Briefing] OPENAI_API_KEY missing — returning data-only summary')
    return makeFallbackBriefing(inputs)
  }

  // ── L2: DB-backed cache — survives instance forks + cold starts ──
  const cacheKey = `briefing:${BRIEFING_CACHE_VERSION}:global:${currentHourKey()}`
  try {
    const { payload, cached, generatedAt } = await getOrCompute<{ bullets: BriefingBullet[] }>({
      key: cacheKey,
      ttlMs: CACHE_TTL_MS,
      model: 'gpt-4o-mini',
      compute: async () => {
        const openai = new OpenAI({ apiKey })

        const systemPrompt = `You are a sharp sports-betting analyst writing a daily briefing for a sports-tip product called SnapBet.

Tone: confident, concise, data-driven — never salesy or hype-y. Each bullet must be ≤25 words. Speak directly to the bettor.

You will receive structured data about today's match-day. Generate exactly 5 bullets ranked by usefulness (most actionable first). Mark the first 2 as tier "free" (universal value) and the last 3 as tier "premium" (deeper insights for paying users).

Each bullet needs an icon from this set:
  - "fire": hot pick, strong opportunity
  - "trend": data-driven trend or pattern
  - "warn": caution, avoid, weakness
  - "star": premium / featured
  - "check": confirmed signal

Return ONLY valid JSON with this exact shape:
{"bullets": [{"text": "...", "tier": "free", "icon": "fire"}, ...]}`

        const userPrompt = `DATA FOR TODAY:
- Matches in the next 24h: ${inputs.matchesToday}
- Top surfaced picks (model is most confident on these):
${inputs.topPicks.map(p => `  - ${p.match} (${p.league}): pick ${p.pick}, ${p.confidence}% confidence, tier ${p.tier}`).join('\n') || '  (none today)'}
- Best-performing leagues (last 7d, n≥5):
${inputs.topLeagues.map(l => `  - ${l.league}: ${(l.accuracy * 100).toFixed(0)}% accuracy on ${l.n} matches`).join('\n') || '  (insufficient data)'}
- Leagues to be cautious about (model accuracy < 45%):
${inputs.weakLeagues.map(l => `  - ${l.league}: ${(l.accuracy * 100).toFixed(0)}% accuracy`).join('\n') || '  (none flagged)'}
- Sample size for league stats: ${inputs.sampleSize} matches

Generate the 5-bullet briefing now.`

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.6,
          max_tokens: 800,
        })

        const raw = completion.choices[0]?.message?.content
        if (!raw) throw new Error('Empty response from OpenAI')

        const parsed = JSON.parse(raw) as { bullets: BriefingBullet[] }
        const bullets = (parsed.bullets || []).slice(0, 5)
        if (bullets.length === 0) throw new Error('No bullets in response')

        return {
          payload: { bullets },
          usage: {
            input: completion.usage?.prompt_tokens,
            output: completion.usage?.completion_tokens,
          },
        }
      },
    })

    const result: BriefingResponse = {
      bullets: payload.bullets,
      generatedAt: generatedAt.toISOString(),
      cached,
    }

    // Populate L1 from L2 result so the next request on this instance is free.
    // TTL on the L1 entry mirrors the L2 entry's remaining freshness.
    _cache = { data: result, expiresAt: generatedAt.getTime() + CACHE_TTL_MS }
    return result
  } catch (e) {
    logger.error('[Briefing] OpenAI call failed — falling back to data-only summary', {
      tags: ['briefing', 'error'],
      error: e instanceof Error ? e : undefined,
    })
    return makeFallbackBriefing(inputs)
  }
}

/**
 * Data-only fallback when OpenAI is unavailable. Same shape as a real briefing,
 * but bullets are templated from the inputs directly.
 */
function makeFallbackBriefing(inputs: Awaited<ReturnType<typeof gatherBriefingInputs>>): BriefingResponse {
  const bullets: BriefingBullet[] = []
  if (inputs.topPicks.length > 0) {
    const top = inputs.topPicks[0]
    bullets.push({
      text: `${top.match} (${top.league}) — model's strongest call today at ${top.confidence}% on ${top.pick}.`,
      tier: 'free',
      icon: 'fire',
    })
  }
  if (inputs.matchesToday > 0) {
    bullets.push({
      text: `${inputs.matchesToday} matches in the next 24 hours across major leagues.`,
      tier: 'free',
      icon: 'trend',
    })
  }
  if (inputs.topLeagues[0]) {
    const l = inputs.topLeagues[0]
    bullets.push({
      text: `${l.league} has been the model's strongest league lately — ${(l.accuracy * 100).toFixed(0)}% accuracy over last ${l.n} matches.`,
      tier: 'premium',
      icon: 'star',
    })
  }
  if (inputs.weakLeagues[0]) {
    const w = inputs.weakLeagues[0]
    bullets.push({
      text: `Caution on ${w.league} — accuracy below ${(w.accuracy * 100).toFixed(0)}% over recent matches; lower position size.`,
      tier: 'premium',
      icon: 'warn',
    })
  }
  if (inputs.topPicks.length >= 2) {
    bullets.push({
      text: `${inputs.topPicks.length} picks surfaced today across ${new Set(inputs.topPicks.map(p => p.league)).size} leagues — diversify your slate.`,
      tier: 'premium',
      icon: 'check',
    })
  }
  return { bullets, generatedAt: new Date().toISOString(), cached: false }
}

export async function GET(_request: NextRequest) {
  try {
    const briefing = await generateBriefing()
    const isPremium = await hasPremiumAccess().catch(() => false)

    return NextResponse.json({
      success: true,
      bullets: briefing.bullets,
      isPremium,
      generatedAt: briefing.generatedAt,
      cached: briefing.cached,
    }, {
      headers: {
        // Edge cache for 5 min so a hot dashboard doesn't re-hit Node + LLM
        // every render. Per-request gating is applied above.
        'Cache-Control': 'private, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch (error) {
    logger.error('[Briefing] Fatal', { error: error instanceof Error ? error : undefined })
    return NextResponse.json({
      success: false,
      error: 'Failed to generate briefing',
    }, { status: 500 })
  }
}
