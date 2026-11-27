/**
 * Prop analysis (research, paper only): read the pipeline's tables
 * multisport_prop_estimates / multisport_prop_lines / multisport_prop_reports
 * (written by pipeline/snapbet_pipeline/prop_analysis). Same database as Prisma.
 */
import prisma from '@/lib/db'
import { Prisma } from '@prisma/client'

export type PropMode = 'live' | 'backtest'

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v))

export interface PropListRow {
  estimate_id: number
  sport_key: string
  event_id: string
  commence_time: string
  home_team: string | null
  away_team: string | null
  subject_type: string
  subject: string
  team: string | null
  opponent: string | null
  stat: string
  mode: PropMode
  prediction_ts: string
  mean: number | null
  actual: number | null
  threshold: number
  side: 'yes' | 'no'
  source: string
  book: string
  price: number
  price_format: string
  fee: number
  breakeven_prob: number
  displayed_prob: number | null
  our_prob: number | null
  our_lo: number | null
  our_hi: number | null
  ev: number | null
  result: string | null
  pnl: number | null
  quote_ts: string
  hit_rate: number | null
  hit_n: number | null
  hit_threshold: number | null
  quotes: number
}

const SORTS: Record<string, string> = {
  ev: 'ev', our_prob: 'our_prob', edge: 'edge', hit_rate: 'hit_rate', hit_n: 'hit_n',
  commence_time: 'commence_time', prediction_ts: 'prediction_ts', threshold: 'threshold', subject: 'subject',
}

export interface PropListParams {
  mode?: PropMode
  sport?: string
  stat?: string
  source?: string
  side?: string
  minSample?: number
  positiveOnly?: boolean
  search?: string
  sort?: string
  dir?: 'asc' | 'desc'
  limit?: number
}

/** Best executable quote per estimate x threshold x side, priced against our estimate. */
export async function listProps(p: PropListParams): Promise<PropListRow[]> {
  const mode = p.mode === 'backtest' ? 'backtest' : 'live'
  const sortCol = SORTS[p.sort ?? 'ev'] ?? 'ev'
  const dir = p.dir === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`
  const limit = Math.min(Math.max(p.limit ?? 300, 1), 1000)
  const where: Prisma.Sql[] = [Prisma.sql`e.mode = ${mode}`]
  if (mode === 'live') where.push(Prisma.sql`e.commence_time > now() - interval '6 hours'`)
  if (p.sport) where.push(Prisma.sql`e.sport_key = ${p.sport}`)
  if (p.stat) where.push(Prisma.sql`e.stat = ${p.stat}`)
  if (p.source) where.push(Prisma.sql`l.source = ${p.source}`)
  if (p.side) where.push(Prisma.sql`l.side = ${p.side}`)
  if (p.search) where.push(Prisma.sql`(e.subject ILIKE ${'%' + p.search + '%'} OR e.home_team ILIKE ${'%' + p.search + '%'}
                                       OR e.away_team ILIKE ${'%' + p.search + '%'})`)
  const outer: Prisma.Sql[] = [Prisma.sql`TRUE`]
  if (p.minSample) outer.push(Prisma.sql`COALESCE(hit_n, 0) >= ${p.minSample}`)
  if (p.positiveOnly) outer.push(Prisma.sql`ev > 0`)
  const rows = await prisma.$queryRaw<PropListRow[]>`
    WITH best AS (
      SELECT DISTINCT ON (l.estimate_id, l.threshold, l.side)
             e.id::int AS estimate_id, e.sport_key, e.event_id, e.commence_time, e.home_team, e.away_team,
             e.subject_type, e.subject, e.team, e.opponent, e.stat, e.mode, e.prediction_ts,
             e.mean::float8 AS mean, e.actual::float8 AS actual,
             l.threshold::float8 AS threshold, l.side, l.source, l.book, l.price::float8 AS price, l.price_format,
             l.fee::float8 AS fee, l.breakeven_prob::float8 AS breakeven_prob, l.displayed_prob::float8 AS displayed_prob,
             l.our_prob::float8 AS our_prob, l.our_lo::float8 AS our_lo, l.our_hi::float8 AS our_hi,
             l.ev::float8 AS ev, l.result, l.pnl::float8 AS pnl, l.quote_ts,
             (e.hit_rate->'overall'->>'rate')::float8 AS hit_rate, (e.hit_rate->'overall'->>'n')::int AS hit_n,
             (e.hit_rate->>'threshold')::float8 AS hit_threshold,
             COUNT(*) OVER (PARTITION BY l.estimate_id, l.threshold, l.side)::int AS quotes
        FROM multisport_prop_estimates e
        JOIN multisport_prop_lines l ON l.estimate_id = e.id
       WHERE ${Prisma.join(where, ' AND ')}
       ORDER BY l.estimate_id, l.threshold, l.side, l.ev DESC NULLS LAST)
    SELECT *, (our_prob - breakeven_prob) AS edge FROM best
     WHERE ${Prisma.join(outer, ' AND ')}
     ORDER BY ${Prisma.raw(sortCol)} ${dir} NULLS LAST
     LIMIT ${limit}`
  return rows.map(r => ({ ...r, commence_time: iso(r.commence_time), prediction_ts: iso(r.prediction_ts),
                          quote_ts: iso(r.quote_ts) }))
}

export async function propFacets(mode: PropMode) {
  return prisma.$queryRaw<{ sport_key: string; stat: string; estimates: number }[]>`
    SELECT sport_key, stat, COUNT(*)::int AS estimates FROM multisport_prop_estimates
     WHERE mode = ${mode} AND (${mode} = 'backtest' OR commence_time > now() - interval '6 hours')
     GROUP BY 1, 2 ORDER BY 1, 2`
}

export async function getPropDetail(id: number) {
  const est = await prisma.$queryRaw<any[]>`
    SELECT id::int, sport_key, event_id, commence_time, home_team, away_team, subject_type, subject, team, opponent,
           is_home, stat, mode, model_version, prediction_ts, mean::float8 AS mean, dist, dist_params, curve, hit_rate,
           factors, combos, history, actual::float8 AS actual, updated_at
      FROM multisport_prop_estimates WHERE id = ${id}`
  if (!est.length) return null
  const e = est[0]
  const lines = await prisma.$queryRaw<any[]>`
    SELECT source, book, market_id, threshold::float8 AS threshold, side, quote_ts, price::float8 AS price, price_format,
           fee::float8 AS fee, breakeven_prob::float8 AS breakeven_prob, displayed_prob::float8 AS displayed_prob,
           our_prob::float8 AS our_prob, our_lo::float8 AS our_lo, our_hi::float8 AS our_hi, ev::float8 AS ev,
           result, pnl::float8 AS pnl
      FROM multisport_prop_lines WHERE estimate_id = ${id} ORDER BY threshold, side, ev DESC NULLS LAST`
  const related = await prisma.$queryRaw<any[]>`
    SELECT id::int, stat, mean::float8 AS mean FROM multisport_prop_estimates
     WHERE event_id = ${e.event_id} AND subject = ${e.subject} AND mode = ${e.mode} AND id <> ${id} ORDER BY stat`
  const rules = await prisma.$queryRaw<{ ticker: string; rules_primary: string | null; result: string | null }[]>`
    SELECT ticker, rules_primary, result FROM multisport_kalshi_markets
     WHERE ticker IN (SELECT market_id FROM multisport_prop_lines WHERE estimate_id = ${id} AND source = 'kalshi')`
  const family = await latestFamilyMetrics(e.sport_key, e.stat)
  return { estimate: e, lines, related, rules, family }
}

export async function latestReport() {
  const r = await prisma.$queryRaw<{ id: number; created_at: Date; report: any }[]>`
    SELECT id::int, created_at, report FROM multisport_prop_reports WHERE kind = 'evaluation'
     ORDER BY created_at DESC LIMIT 1`
  return r[0] ?? null
}

async function latestFamilyMetrics(sport: string, stat: string) {
  const r = await latestReport()
  const fams: any[] = r?.report?.families ?? []
  return fams.find(f => f.sport === sport && f.stat === stat) ?? null
}
