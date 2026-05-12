/**
 * Pure aggregation helpers for the Premium Pick Tracker.
 *
 * Inputs come from the PremiumPickHistory table (Chunk A Day 2). These
 * functions never touch the DB — callers select rows and pass them in.
 * Tested in __tests__/unit/premium-tracker-stats.test.ts.
 *
 * Design: zero dependencies on Prisma so jsdom-based jest can exercise
 * the math without dragging in @prisma/client.
 */

export type PickResult = 'win' | 'loss' | 'push' | 'void' | 'pending'

export interface TrackerPickRow {
  oddsAtPublish: number
  stakeDollars: number
  netDollars: number | null
  netUnits: number | null
  result: PickResult
  tier?: string         // 'premium' | 'strong' | ...
  publishedAt?: Date
  kickoffDate?: Date
  settledAt?: Date | null
  sport?: string
  league?: string | null
  market?: string
}

export interface TrackerStats {
  record: {
    wins: number
    losses: number
    pushes: number
    voids: number
    pending: number
  }
  totalStakedDollars: number
  netDollars: number
  netUnits: number
  /** ROI as a percent, e.g. 14.5 (not 0.145). 0 if no settled stakes. */
  roiPct: number
  /** Average decimal odds across settled picks. 0 if none. */
  avgOdds: number
  /** Hit rate as a percent over wins+losses (excludes pushes/voids). */
  hitRatePct: number
  /** Total settled (win+loss+push+void). */
  settledCount: number
  /** Picks count (all rows passed in). */
  picksCount: number
  /** First and last publish dates of the supplied rows. */
  windowStart: Date | null
  windowEnd: Date | null
}

/**
 * Aggregate a list of tracker rows into a TrackerStats summary.
 *
 * Math contract:
 *   - Wins and losses contribute to ROI denominator (totalStakedDollars).
 *   - Pushes/voids count toward `record` but never toward ROI math.
 *   - Pending picks count toward `record.pending` only.
 *   - Hit rate = wins / (wins + losses). Empty denominator → 0%.
 *   - ROI = netDollars / totalStakedDollars * 100. Empty → 0%.
 *   - Avg odds = mean(oddsAtPublish) across win+loss rows only.
 *
 * No special handling for missing netDollars — settle cron is responsible
 * for populating those before the row leaves 'pending'. If a settled row
 * has null netDollars, it's a settle bug; ROI will under-count but won't
 * crash.
 */
export function aggregateStats(rows: TrackerPickRow[]): TrackerStats {
  const record = { wins: 0, losses: 0, pushes: 0, voids: 0, pending: 0 }
  let totalStakedDollars = 0
  let netDollars = 0
  let netUnits = 0
  let oddsSum = 0
  let oddsCount = 0
  let windowStart: Date | null = null
  let windowEnd: Date | null = null

  for (const r of rows) {
    // Update window
    if (r.publishedAt) {
      if (!windowStart || r.publishedAt < windowStart) windowStart = r.publishedAt
      if (!windowEnd || r.publishedAt > windowEnd) windowEnd = r.publishedAt
    }

    switch (r.result) {
      case 'win':
        record.wins++
        totalStakedDollars += r.stakeDollars
        netDollars += r.netDollars ?? 0
        netUnits += r.netUnits ?? 0
        oddsSum += r.oddsAtPublish
        oddsCount++
        break
      case 'loss':
        record.losses++
        totalStakedDollars += r.stakeDollars
        netDollars += r.netDollars ?? 0
        netUnits += r.netUnits ?? 0
        oddsSum += r.oddsAtPublish
        oddsCount++
        break
      case 'push':
        record.pushes++
        break
      case 'void':
        record.voids++
        break
      case 'pending':
        record.pending++
        break
    }
  }

  const settledCount = record.wins + record.losses + record.pushes + record.voids
  const winsLosses = record.wins + record.losses
  const hitRatePct = winsLosses > 0 ? +(record.wins / winsLosses * 100).toFixed(2) : 0
  const roiPct = totalStakedDollars > 0 ? +(netDollars / totalStakedDollars * 100).toFixed(2) : 0
  const avgOdds = oddsCount > 0 ? +(oddsSum / oddsCount).toFixed(2) : 0

  return {
    record,
    totalStakedDollars: +totalStakedDollars.toFixed(2),
    netDollars: +netDollars.toFixed(2),
    netUnits: +netUnits.toFixed(3),
    roiPct,
    avgOdds,
    hitRatePct,
    settledCount,
    picksCount: rows.length,
    windowStart,
    windowEnd,
  }
}

/**
 * Filter rows to a rolling-window of N days (by publishedAt).
 * Used by the public read endpoint to compute 7d / 30d / 90d slices.
 */
export function filterRowsByWindow(
  rows: TrackerPickRow[],
  windowDays: number,
  now: Date = new Date(),
): TrackerPickRow[] {
  if (windowDays <= 0) return rows
  const cutoff = new Date(now.getTime() - windowDays * 86400 * 1000)
  return rows.filter(r => r.publishedAt && r.publishedAt >= cutoff)
}

/**
 * Filter rows to a single tier. Returns ALL rows if tier='all' or empty.
 */
export function filterRowsByTier(rows: TrackerPickRow[], tier?: string): TrackerPickRow[] {
  if (!tier || tier === 'all') return rows
  return rows.filter(r => r.tier === tier)
}

/**
 * Filter rows to a single sport.
 */
export function filterRowsBySport(rows: TrackerPickRow[], sport?: string): TrackerPickRow[] {
  if (!sport || sport === 'all') return rows
  return rows.filter(r => r.sport === sport)
}
