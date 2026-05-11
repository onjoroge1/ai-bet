/**
 * Pure helpers for blog-generation eligibility — separated from the rest of
 * the generator so they can be unit-tested without dragging OpenAI / Prisma
 * imports into the jsdom test environment.
 *
 * Stabilization sprint 2026-05-12: prevents the cron from creating new
 * blogs for FINISHED matches, capped per run, narrow pre-match window.
 */
import type { Prisma } from '@prisma/client'

/**
 * Per-run hard cap on number of blogs to generate. With cron now at every 3h,
 * max daily output = 8 * MAX_BLOGS_PER_RUN. Set conservatively so the /blog
 * index doesn't get flooded by a single cron firing (the "199 blogs in one
 * day" pattern from the 2026-05-11 audit).
 */
export const MAX_BLOGS_PER_RUN = 15

/**
 * Build the Prisma WHERE clause for blog-eligible matches. Pure function so
 * it can be unit-tested without a DB connection (see
 * __tests__/unit/blog-eligibility.test.ts).
 *
 * Rules:
 *   1. status must be UPCOMING — never write blogs for FINISHED matches
 *   2. isActive must be true
 *   3. kickoffDate must be in [now, now + windowHours] — exclude zombies
 *      (UPCOMING rows whose kickoff is already in the past) and matches
 *      too far in the future to drive timely SEO traffic
 *   4. blogPosts.none when includeWithBlogs=false — don't duplicate
 */
export function buildBlogEligibilityWhere(opts: {
  now?: Date
  windowHours?: number
  includeWithBlogs?: boolean
} = {}): Prisma.MarketMatchWhereInput {
  const now = opts.now ?? new Date()
  const windowHours = opts.windowHours ?? 48
  const cutoff = new Date(now.getTime() + windowHours * 60 * 60 * 1000)

  const where: Prisma.MarketMatchWhereInput = {
    status: 'UPCOMING',
    isActive: true,
    kickoffDate: {
      gte: now,    // future kickoff only — no zombies
      lte: cutoff, // pre-match window (default 48h)
    },
  }

  if (!opts.includeWithBlogs) {
    where.blogPosts = { none: { isActive: true } }
  }

  return where
}
