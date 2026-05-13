/**
 * AI profile generator for team pages. Produces a ~300-word HTML blurb
 * grounded on the team's actual stats. Refreshed quarterly (90 days)
 * per the approved plan.
 *
 * Reuses lib/ai-cache.ts for spend control — 24h cache lets us re-run
 * iteratively without re-billing.
 */
import OpenAI from 'openai'
import { getOrCompute, hashInput } from '@/lib/ai-cache'

export interface TeamProfileInputs {
  name: string
  league: string | null
  country: string | null
  matchesPlayed: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  bttsCount: number
  over25Count: number
  formLast10: string | null
  v1ModelAccuracy: number | null
  v1ModelSampleN: number | null
  v3ModelAccuracy: number | null
  v3ModelSampleN: number | null
  recommendedModel: 'v1' | 'v3' | null
  h2hTopOpponents: Array<{ opponent: string; wins: number; draws: number; losses: number }>
}

const SYSTEM_PROMPT = `You are a sports analyst writing brief team profile narratives for SnapBet AI.

VOICE:
- Neutral expert tone. No hype. No "guaranteed winners". No betting recommendations.
- Match-of-fact summary of what the data shows.
- Reference specific numbers from the stats provided, not made-up details.
- Never reference current-season league position, recent transfers, manager moves, or any news event you can't verify — stick to what the stats show.

LENGTH:
- 250-350 words total.
- 3-4 short paragraphs.

STRUCTURE (in order):
1. One-paragraph overview: form, record, goal patterns.
2. One-paragraph model performance: what V1 and V3 have been doing on this team's matches, sample sizes, which model has been more accurate.
3. One-paragraph H2H + tendencies: notable rivalries, scoring patterns (BTTS, over 2.5).
4. Closing one-sentence reminder: this is data analysis, not a betting recommendation, link readers to /performance.

OUTPUT FORMAT:
- Plain HTML only — <p>, <strong>, <em>. No <h1>, no <ul>, no <a> tags, no markdown.
- Do not wrap in <html>, <body>, or any container. Just paragraphs.
- Do not include a heading or title — the page already has one.

HARD CONSTRAINTS:
- Never use "guaranteed", "lock", "risk-free", "easy money", "100% accurate".
- Never make up stats. If a number isn't in the input, don't reference it.
- Don't speculate about why the model favours one team over another.
- Don't reference today's date or "current season" — these blurbs refresh quarterly.`

function buildUserPrompt(inputs: TeamProfileInputs): string {
  const lines = [
    `Team: ${inputs.name}`,
    inputs.league ? `League: ${inputs.league}` : '',
    inputs.country ? `Country: ${inputs.country}` : '',
    '',
    'RECENT RECORD (last 365d of finished matches):',
    `  Matches: ${inputs.matchesPlayed}`,
    `  W-D-L: ${inputs.wins}-${inputs.draws}-${inputs.losses}`,
    `  Goals for: ${inputs.goalsFor}`,
    `  Goals against: ${inputs.goalsAgainst}`,
    `  BTTS in ${inputs.bttsCount}/${inputs.matchesPlayed} matches`,
    `  Over 2.5 in ${inputs.over25Count}/${inputs.matchesPlayed} matches`,
    inputs.formLast10 ? `  Form (recent → older): ${inputs.formLast10}` : '',
    '',
    'MODEL ACCURACY:',
    inputs.v1ModelAccuracy !== null
      ? `  V1: ${(inputs.v1ModelAccuracy * 100).toFixed(1)}% over ${inputs.v1ModelSampleN} matches`
      : `  V1: insufficient data`,
    inputs.v3ModelAccuracy !== null
      ? `  V3 (Sharp Intelligence): ${(inputs.v3ModelAccuracy * 100).toFixed(1)}% over ${inputs.v3ModelSampleN} matches`
      : `  V3: insufficient data`,
    inputs.recommendedModel ? `  Recommended for ${inputs.name}: ${inputs.recommendedModel.toUpperCase()}` : '  No clear winner between models (both shown side-by-side)',
    '',
    'TOP HEAD-TO-HEAD OPPONENTS:',
    ...inputs.h2hTopOpponents.map(o => `  vs ${o.opponent}: ${o.wins}W-${o.draws}D-${o.losses}L`),
    '',
    'Write a 250-350 word team profile in HTML following the structure in the system prompt. Reference the specific numbers above. Output ONLY paragraphs.',
  ]
  return lines.filter(Boolean).join('\n')
}

export interface ProfileResult {
  html: string
  cached: boolean
  generatedAt: Date
  prompt: string
}

/**
 * Generate (or read from cache) a team profile blurb.
 *
 * Cache key is content-hashed: same team + same stats → same cached
 * output. When stats roll up nightly, the hash changes and a new
 * generation happens on next call. Quarterly refreshDueAt is enforced
 * by the cron, not the cache.
 */
export async function generateTeamProfile(inputs: TeamProfileInputs): Promise<ProfileResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY missing — set in env before generating team profiles')
  }

  const userPrompt = buildUserPrompt(inputs)
  const promptHash = hashInput(SYSTEM_PROMPT + userPrompt)
  const cacheKey = `team-profile:v1:${inputs.name}:${promptHash}`

  const result = await getOrCompute<{ html: string }>({
    key: cacheKey,
    ttlMs: 24 * 60 * 60 * 1000,
    model: 'gpt-4o',
    compute: async () => {
      const openai = new OpenAI({ apiKey })
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.6,
        max_tokens: 700,
      })
      const html = completion.choices[0]?.message?.content?.trim() ?? ''
      if (!html) throw new Error('Empty LLM response')
      return {
        payload: { html },
        usage: {
          input: completion.usage?.prompt_tokens,
          output: completion.usage?.completion_tokens,
        },
        promptHash,
      }
    },
  })

  return {
    html: result.payload.html,
    cached: result.cached,
    generatedAt: result.generatedAt,
    prompt: userPrompt,
  }
}
