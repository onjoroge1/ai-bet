/**
 * Unit tests for the blog-eligibility WHERE clause builder.
 *
 * Tests the contract that Prisma is given, NOT a live DB query — but since
 * the contract IS the filter, if these assertions hold then by definition
 * Prisma can never return:
 *   - a FINISHED match
 *   - an UPCOMING match with kickoff in the past (zombie)
 *   - a match outside the pre-match window (default 48h)
 *   - an inactive match
 *   - a match that already has an active blog (when includeWithBlogs=false)
 *
 * Stabilization sprint 2026-05-12: stops finished-match blog generation
 * before any more low-quality inventory is created.
 */
import { buildBlogEligibilityWhere, MAX_BLOGS_PER_RUN } from '@/lib/blog/eligibility'

describe('buildBlogEligibilityWhere', () => {
  // Pin a deterministic "now" so kickoff window assertions are stable
  const FIXED_NOW = new Date('2026-05-12T12:00:00Z')

  it('always requires status=UPCOMING (never FINISHED)', () => {
    const where = buildBlogEligibilityWhere({ now: FIXED_NOW })
    expect(where.status).toBe('UPCOMING')
  })

  it('always requires isActive=true', () => {
    const where = buildBlogEligibilityWhere({ now: FIXED_NOW })
    expect(where.isActive).toBe(true)
  })

  it('requires kickoffDate >= now (excludes zombie past-kickoff UPCOMING rows)', () => {
    const where = buildBlogEligibilityWhere({ now: FIXED_NOW })
    expect(where.kickoffDate.gte).toEqual(FIXED_NOW)
  })

  it('requires kickoffDate <= now + 48h by default (pre-match window)', () => {
    const where = buildBlogEligibilityWhere({ now: FIXED_NOW })
    const expected = new Date(FIXED_NOW.getTime() + 48 * 60 * 60 * 1000)
    expect(where.kickoffDate.lte).toEqual(expected)
  })

  it('accepts custom windowHours and applies it correctly', () => {
    const where = buildBlogEligibilityWhere({ now: FIXED_NOW, windowHours: 24 })
    const expected = new Date(FIXED_NOW.getTime() + 24 * 60 * 60 * 1000)
    expect(where.kickoffDate.lte).toEqual(expected)
  })

  it('excludes matches with an existing active blog by default', () => {
    const where = buildBlogEligibilityWhere({ now: FIXED_NOW })
    expect(where.blogPosts).toEqual({ none: { isActive: true } })
  })

  it('includes matches with existing blogs when includeWithBlogs=true', () => {
    const where = buildBlogEligibilityWhere({ now: FIXED_NOW, includeWithBlogs: true })
    expect(where.blogPosts).toBeUndefined()
  })

  it('does NOT include a status filter for FINISHED, LIVE, CANCELLED, POSTPONED', () => {
    // The status filter is exact-match ('UPCOMING'), so any other status
    // values cannot satisfy this where clause. Verify by trying common
    // alternates and confirming the WHERE doesn't accept them by any path.
    const where = buildBlogEligibilityWhere({ now: FIXED_NOW })
    expect(where.status).not.toBe('FINISHED')
    expect(where.status).not.toBe('LIVE')
    expect(where.status).not.toBe('CANCELLED')
    expect(where.status).not.toBe('POSTPONED')
    expect(where.status).not.toBe('AET')
    expect(where.status).not.toBe('PEN')
    expect(where.status).not.toBe('FT')
    // No OR clause that could re-admit those values
    expect(where.OR).toBeUndefined()
  })

  it('MAX_BLOGS_PER_RUN is a sane positive integer ≤ 20', () => {
    expect(MAX_BLOGS_PER_RUN).toBeGreaterThan(0)
    expect(MAX_BLOGS_PER_RUN).toBeLessThanOrEqual(20)
    expect(Number.isInteger(MAX_BLOGS_PER_RUN)).toBe(true)
  })

  it('default current-time now is used when not provided', () => {
    const before = Date.now()
    const where = buildBlogEligibilityWhere({})
    const after = Date.now()
    expect(where.kickoffDate.gte.getTime()).toBeGreaterThanOrEqual(before)
    expect(where.kickoffDate.gte.getTime()).toBeLessThanOrEqual(after)
  })
})
