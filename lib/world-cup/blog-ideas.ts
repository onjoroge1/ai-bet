/**
 * World Cup blog-idea generator — surfaces WRITABLE, data-grounded angles
 * from the fixtures + model + edge data we already hold. Pure and
 * deterministic: same inputs → same ranked ideas (sort by data strength,
 * not randomness).
 *
 * Each idea ships with:
 *  - the concrete real numbers that ground it (`dataHooks`) so a writer never
 *    invents a stat, and
 *  - a `searchQuery` to enrich the piece with current news/form via internet
 *    search (form, injuries, lineup buzz) — the data sets the spine, search
 *    adds the colour.
 *
 * Nothing here auto-publishes; this feeds the existing human-review blog flow.
 */
import { GROUPS } from './tournament'
import { simulateGroup, type GroupSimFixtureInput } from './metrics'
import { hasActionableValue } from '@/lib/edge/extract'
import type { WCFixture } from './data'

export type WCBlogCategory =
  | 'group-preview' | 'value-bet' | 'upset-watch' | 'team-path' | 'daily-roundup'

export interface WCBlogIdea {
  id: string
  title: string
  /** The hook — why this is worth writing now. */
  angle: string
  category: WCBlogCategory
  /** 0..100 — data strength, higher = stronger story. Sort key. */
  priority: number
  /** Concrete real numbers to ground the piece (no invented stats). */
  dataHooks: string[]
  /** Internet-search query to enrich with current form/news. */
  searchQuery: string
  /** MarketMatch ids the piece can link to. */
  marketMatchIds: string[]
}

function pct(n: number): string { return `${(n * 100).toFixed(0)}%` }

/**
 * Generate ranked WC blog ideas from current fixtures. `now` frames daily
 * roundups; pass it in (scripts/SSR) rather than reading the clock here.
 */
export function wcBlogIdeas(fixtures: WCFixture[], now: Date): WCBlogIdea[] {
  const ideas: WCBlogIdea[] = []

  // ── 1. Group advancement races (one per group, prioritised by tightness)
  for (const group of GROUPS) {
    const gf = fixtures.filter(f => f.groupLetter === group.letter && f.homeWCTeam && f.awayWCTeam)
    if (gf.length < 3) continue
    const inputs: GroupSimFixtureInput[] = gf.map(f => ({
      homeSlug: f.homeWCTeam!.slug, awaySlug: f.awayWCTeam!.slug,
      // Trust probs only from a real model run — fallback priors would
      // manufacture misleading "favourite" angles (e.g. Jordon > Argentina).
      probs: f.modelSource ? f.probs : null,
      result: f.status === 'FINISHED' ? f.result : null,
    }))
    const sim = simulateGroup(group.teams, inputs)
    if (sim.teams.length < 4) continue
    // Skip group-race angles built mostly on fallback priors — the model
    // hasn't run on enough of the group to make the "favourite" meaningful.
    if (sim.coverage < 0.5) continue
    const [first, second, third] = sim.teams
    // Tightness: smaller gap between the 2nd and 3rd advance odds = better race.
    const cutGap = Math.abs(second.advanceProb - third.advanceProb)
    const tightness = Math.max(0, 1 - cutGap / 0.4) // gap 0 → 1.0, gap ≥0.4 → 0
    ideas.push({
      id: `group-${group.letter.toLowerCase()}`,
      title: `World Cup 2026 Group ${group.letter}: ${first.name} favoured, but who grabs the second spot?`,
      angle: `Our model makes ${first.name} the group favourite (${pct(first.winGroupProb)} to top it), with ${second.name} and ${third.name} splitting the second qualifying place — a genuine race to write into.`,
      category: 'group-preview',
      priority: Math.round(40 + tightness * 45 * sim.coverage),
      dataHooks: [
        `${first.name} ${pct(first.advanceProb)} to advance, ${pct(first.winGroupProb)} to win the group`,
        `${second.name} ${pct(second.advanceProb)} vs ${third.name} ${pct(third.advanceProb)} for the second spot`,
        `Expected points: ${sim.teams.map(t => `${t.name} ${t.expectedPoints}`).join(', ')}`,
      ],
      searchQuery: `${group.teams.map(t => t.name).join(' ')} World Cup 2026 group ${group.letter} form news`,
      marketMatchIds: gf.map(f => f.marketMatchId),
    })
  }

  // ── 2. Value bets (where a validated model overprices an outcome)
  const valueFixtures = fixtures
    .filter(f => f.edge && hasActionableValue(f.edge) && f.status === 'UPCOMING')
    .sort((a, b) => (b.edge!.ev ?? 0) - (a.edge!.ev ?? 0))
  for (const f of valueFixtures.slice(0, 6)) {
    const e = f.edge!
    const sideLabel = e.outcome === 'home' ? f.homeTeam : e.outcome === 'away' ? f.awayTeam : 'the draw'
    const evPct = (e.ev! * 100).toFixed(0)
    const isUpset = e.price !== null && e.price >= 2.8
    ideas.push({
      id: `value-${f.matchId}`,
      title: isUpset
        ? `Upset watch: why our model backs ${sideLabel} in ${f.homeTeam} vs ${f.awayTeam}`
        : `Value spot: ${sideLabel} in ${f.homeTeam} vs ${f.awayTeam}`,
      angle: `The market underrates ${sideLabel} here — our model flags +${evPct}% expected value at ${e.price?.toFixed(2)}${e.book ? ` (${e.book})` : ''}. A clean "market vs model" explainer grounded in the edge.`,
      category: isUpset ? 'upset-watch' : 'value-bet',
      priority: Math.round(55 + Math.min(35, (e.ev ?? 0) * 100)),
      dataHooks: [
        `Best price ${e.price?.toFixed(2)} on ${sideLabel}${e.book ? ` at ${e.book}` : ''}`,
        `Model edge rating: ${e.rating}, +${evPct}% EV`,
        e.minAcceptableOdds !== null ? `Value holds down to ${e.minAcceptableOdds.toFixed(2)}` : 'Min acceptable odds available',
      ],
      searchQuery: `${f.homeTeam} vs ${f.awayTeam} World Cup 2026 preview team news lineup`,
      marketMatchIds: [f.marketMatchId],
    })
  }

  // ── 3. Daily roundup (if there are value bets kicking off today/tomorrow)
  const soon = fixtures.filter(f => {
    if (f.status !== 'UPCOMING' || !f.edge || !hasActionableValue(f.edge)) return false
    const hrs = (f.kickoffDate.getTime() - now.getTime()) / 3_600_000
    return hrs >= 0 && hrs <= 48
  })
  if (soon.length >= 2) {
    ideas.push({
      id: 'daily-roundup',
      title: `Today's World Cup value bets: ${soon.length} spots our model likes`,
      angle: `A scannable roundup of the next 48 hours' value bets — market price vs model probability for each, with the honest "most matches have no edge" framing.`,
      category: 'daily-roundup',
      priority: 70,
      dataHooks: soon.slice(0, 5).map(f =>
        `${f.homeTeam} vs ${f.awayTeam}: ${f.edge!.rating}, +${((f.edge!.ev ?? 0) * 100).toFixed(0)}% EV`),
      searchQuery: `World Cup 2026 fixtures today predictions odds`,
      marketMatchIds: soon.map(f => f.marketMatchId),
    })
  }

  // ── 4. Standout team paths (clear favourites / surprise contenders)
  for (const group of GROUPS) {
    const gf = fixtures.filter(f => f.groupLetter === group.letter && f.homeWCTeam && f.awayWCTeam)
    if (gf.length < 3) continue
    const inputs: GroupSimFixtureInput[] = gf.map(f => ({
      homeSlug: f.homeWCTeam!.slug, awaySlug: f.awayWCTeam!.slug,
      // Trust probs only from a real model run — fallback priors would
      // manufacture misleading "favourite" angles (e.g. Jordon > Argentina).
      probs: f.modelSource ? f.probs : null,
      result: f.status === 'FINISHED' ? f.result : null,
    }))
    const sim = simulateGroup(group.teams, inputs)
    const top = sim.teams[0]
    if (top && top.advanceProb >= 0.72 && sim.coverage >= 0.5) {
      ideas.push({
        id: `path-${top.slug}`,
        title: `${top.name}'s route through Group ${group.letter} — and what could trip them up`,
        angle: `Our model makes ${top.name} the strongest qualifier in the group (${pct(top.advanceProb)} to advance). A team-path piece with the fixtures, the danger game, and the model's read.`,
        category: 'team-path',
        priority: Math.round(50 + (top.advanceProb - 0.72) * 100),
        dataHooks: [
          `${top.name} ${pct(top.advanceProb)} to advance, ${pct(top.winGroupProb)} to win Group ${group.letter}`,
          `Group rivals: ${group.teams.filter(t => t.slug !== top.slug).map(t => t.name).join(', ')}`,
        ],
        searchQuery: `${top.name} World Cup 2026 squad form fixtures`,
        marketMatchIds: gf.filter(f => f.homeWCTeam?.slug === top.slug || f.awayWCTeam?.slug === top.slug).map(f => f.marketMatchId),
      })
    }
  }

  return ideas.sort((a, b) => b.priority - a.priority)
}
