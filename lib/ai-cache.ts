/**
 * AI insight cache — Postgres-backed read-through cache for OpenAI responses.
 *
 * Why this exists: module-level memos don't survive Vercel instance forks or
 * cold starts. A single shared cache means we pay for one OpenAI call per key
 * per TTL window across the entire fleet, instead of N (where N is number of
 * concurrent serverless instances).
 *
 * Pattern:
 *   const { payload, cached } = await getOrCompute({
 *     key: 'briefing:global:2026-04-30-19',
 *     ttlMs: 60 * 60 * 1000,
 *     model: 'gpt-4o-mini',
 *     compute: async () => { ...openai call...; return { payload, usage } },
 *   })
 */

import crypto from 'node:crypto'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

export interface AICacheComputeResult<T> {
  payload: T
  usage?: { input?: number; output?: number }
  promptHash?: string
}

export interface AICacheOpts<T> {
  /** Deterministic, namespaced cache key. Must include a version if the prompt
   *  shape changes (e.g. "briefing:v2:global:..."). */
  key: string
  /** How long the entry is fresh, in ms. */
  ttlMs: number
  /** Model identifier for observability. */
  model: string
  /** Compute function — invoked only on miss. Should return the parsed payload
   *  and optionally token usage for cost tracking. */
  compute: () => Promise<AICacheComputeResult<T>>
}

export interface AICacheReadResult<T> {
  payload: T
  cached: boolean
  generatedAt: Date
  hitCount: number
}

/**
 * Read-through cache. Returns the cached payload if fresh, otherwise calls
 * `compute()`, persists the result, and returns it.
 *
 * Race behavior: two concurrent misses on the same key may both call
 * `compute()` (acceptable — happens at most once per TTL per key). The UPSERT
 * keeps the DB consistent; the second writer wins, which is fine since both
 * calls produce equivalent payloads for the same input.
 *
 * Failure mode: if `compute()` throws, the cache is NOT populated and the
 * error propagates. Callers should provide their own fallback.
 */
export async function getOrCompute<T>(opts: AICacheOpts<T>): Promise<AICacheReadResult<T>> {
  const { key, ttlMs, model, compute } = opts
  const now = new Date()

  // ─── Read ──────────────────────────────────────────────────────
  try {
    const existing = await prisma.aIInsightCache.findUnique({ where: { cacheKey: key } })
    if (existing && existing.expiresAt > now) {
      // Fire-and-forget hit-count increment — don't block the response on it
      prisma.aIInsightCache
        .update({ where: { cacheKey: key }, data: { hitCount: { increment: 1 } } })
        .catch(() => {/* non-fatal */})
      logger.info('[AICache] HIT', {
        tags: ['ai-cache', 'hit'],
        data: { key, model: existing.modelUsed, hitCount: existing.hitCount + 1, ageMs: now.getTime() - existing.generatedAt.getTime() },
      })
      return {
        payload: existing.payload as T,
        cached: true,
        generatedAt: existing.generatedAt,
        hitCount: existing.hitCount + 1,
      }
    }
  } catch (e) {
    // DB read failure should not block the user — fall through to compute
    logger.warn('[AICache] read error — falling through to compute', {
      tags: ['ai-cache', 'read-error'],
      error: e instanceof Error ? e : undefined,
      data: { key },
    })
  }

  // ─── Compute ──────────────────────────────────────────────────
  const startedAt = Date.now()
  const computed = await compute()
  const computeMs = Date.now() - startedAt

  // ─── Write ────────────────────────────────────────────────────
  const expiresAt = new Date(now.getTime() + ttlMs)
  try {
    await prisma.aIInsightCache.upsert({
      where: { cacheKey: key },
      create: {
        cacheKey: key,
        payload: computed.payload as any,
        modelUsed: model,
        promptHash: computed.promptHash ?? null,
        inputTokens: computed.usage?.input ?? null,
        outputTokens: computed.usage?.output ?? null,
        expiresAt,
      },
      update: {
        payload: computed.payload as any,
        modelUsed: model,
        promptHash: computed.promptHash ?? null,
        inputTokens: computed.usage?.input ?? null,
        outputTokens: computed.usage?.output ?? null,
        generatedAt: now,
        expiresAt,
        hitCount: 0, // reset on regen
      },
    })
  } catch (e) {
    // Persistence failure shouldn't fail the user-facing call — they got their answer
    logger.warn('[AICache] write error', {
      tags: ['ai-cache', 'write-error'],
      error: e instanceof Error ? e : undefined,
      data: { key },
    })
  }

  logger.info('[AICache] MISS — generated fresh', {
    tags: ['ai-cache', 'miss'],
    data: {
      key,
      model,
      computeMs,
      inputTokens: computed.usage?.input,
      outputTokens: computed.usage?.output,
    },
  })

  return {
    payload: computed.payload,
    cached: false,
    generatedAt: now,
    hitCount: 0,
  }
}

/**
 * Helper for endpoints that want a stable hash of structured input as part of
 * their cache key.
 *
 * Example:
 *   const key = `clv-trade:${hashInput(opportunityIds.sort().join('|'))}:${bucket}`
 */
export function hashInput(input: string): string {
  return crypto.createHash('sha1').update(input).digest('hex').slice(0, 16)
}

/**
 * Bucket a numeric value into discrete cache-friendly ranges. Useful for
 * fields like bankroll where the LLM output doesn't actually depend on the
 * exact value, only its order of magnitude.
 */
export function bucketBankroll(units: number): string {
  if (units < 1000) return 'lt1k'
  if (units < 10000) return '1k-10k'
  return 'gt10k'
}
