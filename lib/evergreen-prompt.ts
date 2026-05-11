/**
 * Evergreen blog prompt builder. Produces a single system + user prompt
 * pair the AI uses to draft an evergreen blog matching the structure of
 * our 4 viral top-performers ("Top 5 Strategies", "How AI Works",
 * "Confidence Scores", "Liverpool vs Bournemouth").
 *
 * Shared shape across the winners:
 *   - 1,200-2,500 word target
 *   - Hook intro (1-2 paragraphs, identifies the question being answered)
 *   - Table of contents (rendered as a bulleted list of section titles)
 *   - 4-6 H2 sections covering the topic
 *   - "How SnapBet helps" section tying back to a product feature
 *   - Practical takeaway / closer
 */

import OpenAI from 'openai'
import { getOrCompute, hashInput } from './ai-cache'

const SYSTEM_PROMPT = `You are SnapBet's senior content writer. Your job is to write evergreen blog posts that rank for educational and strategy queries in sports betting.

VOICE
- Expert-friendly, neutral, not salesy.
- Speak directly to the reader as "you".
- Use plain English; explain jargon when first introduced.
- Avoid hype phrases like "boost your bankroll", "winning every time", "easy money".
- Always mention responsible betting where relevant; never imply guaranteed wins.

STRUCTURE (target 1,200-2,500 words total)
1. Hook (1-2 paragraphs): name the question, hint at the answer, set stakes.
2. Table of contents: a single <h3>What's covered</h3> followed by a <ul> of 4-6 section titles.
3. 4-6 H2 sections, each with 2-4 short paragraphs.
4. "How SnapBet helps" H2 — concrete link to the product feature (use the productAnchor field).
5. Practical takeaway H2 — 3-5 bullet points the reader can act on tomorrow.

HTML FORMATTING
Return HTML only (no markdown). Use <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>. No inline styles, no <div>, no <script>. Tables OK with <table>/<tr>/<td> if comparing 2-3 things.

SEO
The blog will be indexed by Google. The target query is given — naturally weave it into the H1 (which we set externally from the title), the first 100 words, one H2, and the closing paragraph. Avoid keyword-stuffing.

OUTPUT
Return ONLY the HTML body content (no <html>, no <head>, no <body> tags). Do not include the H1 title — we render that separately.`

interface PromptInputs {
  title: string
  targetQuery: string
  bucket: 'explainer' | 'strategy' | 'concept' | 'league' | 'beginner'
  productAnchor?: string | null
  promptHint?: string | null
  seoKeywords: string[]
}

function buildUserPrompt(inputs: PromptInputs): string {
  const anchor = inputs.productAnchor
    ? `\nProduct anchor: ${inputs.productAnchor} — this is the SnapBet feature to tie the article back to in the "How SnapBet helps" section.`
    : '\nProduct anchor: snapbet-picks (default — point readers to the daily SnapBet AI picks).'
  const hint = inputs.promptHint ? `\nExtra guidance: ${inputs.promptHint}` : ''
  const keywords = inputs.seoKeywords.length
    ? `\nSecondary keywords to weave in naturally: ${inputs.seoKeywords.join(', ')}`
    : ''

  return `Write the evergreen blog body for the following topic.

TITLE: ${inputs.title}
TARGET QUERY: "${inputs.targetQuery}"
BUCKET: ${inputs.bucket}
${anchor}${hint}${keywords}

Write the full body HTML now.`
}

export interface DraftResult {
  html: string
  cached: boolean
  generatedAt: Date
  tokenUsage?: { input?: number; output?: number }
}

/**
 * Generate (or fetch cached) an evergreen blog draft. Uses the AI cache so
 * re-draft requests within the TTL window don't double-bill.
 *
 * TTL is 24h — long enough to support iterative review, short enough that
 * a topic re-drafted next week gets a fresh take.
 */
export async function generateEvergreenDraft(inputs: PromptInputs): Promise<DraftResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY missing — set in env before generating evergreens')
  }

  const userPrompt = buildUserPrompt(inputs)
  const promptHash = hashInput(SYSTEM_PROMPT + userPrompt)
  const cacheKey = `evergreen-draft:v1:${inputs.bucket}:${promptHash}`

  const result = await getOrCompute<{ html: string }>({
    key: cacheKey,
    ttlMs: 24 * 60 * 60 * 1000, // 24h — supports iterative review of the same prompt
    model: 'gpt-4o',
    compute: async () => {
      const openai = new OpenAI({ apiKey })
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o', // better long-form prose than gpt-4o-mini
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4000,
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
  }
}

/**
 * Extract a 150-character excerpt from generated HTML. Strips tags and
 * cuts at the first sentence boundary after 100 chars.
 */
export function excerptFromHtml(html: string): string {
  const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  if (plain.length <= 150) return plain
  const cut = plain.slice(0, 200)
  const sentenceEnd = cut.lastIndexOf('. ')
  if (sentenceEnd > 100) return cut.slice(0, sentenceEnd + 1)
  return cut.slice(0, 147).trimEnd() + '…'
}

/**
 * Estimate read time from generated HTML (~225 wpm average).
 */
export function readTimeFromHtml(html: string): number {
  const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const wordCount = plain.split(' ').length
  return Math.max(2, Math.round(wordCount / 225))
}
