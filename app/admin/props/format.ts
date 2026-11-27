export const RESEARCH_NOTE =
  'Paper research only. Probabilities come from an explainable baseline model; "Market shows" is a displayed ' +
  'probability, while break-even and EV use the executable price after fees. Nothing here has been shown to beat ' +
  'the market on fresh games unless the evaluation says it holds.'

const STATS: Record<string, string> = {
  player_points: 'Points', player_rebounds: 'Rebounds', player_assists: 'Assists', player_threes: 'Threes made',
  player_pass_yds: 'Passing yards', player_rush_yds: 'Rushing yards', player_reception_yds: 'Receiving yards',
  player_receptions: 'Receptions', player_anytime_td: 'Anytime TD', player_goals: 'Goals',
  team_win: 'To win', team_margin: 'Winning margin (spread)', team_points: 'Team points', game_total: 'Game total',
}
const SPORTS: Record<string, string> = {
  basketball_nba: 'NBA', americanfootball_nfl: 'NFL', icehockey_nhl: 'NHL', basketball_ncaab: 'NCAAB',
}

export const statLabel = (s: string) => STATS[s] ?? s
export const sportLabel = (s: string) => SPORTS[s] ?? s

export function fmtPct(p: number | null | undefined, digits = 1) {
  return p == null || Number.isNaN(p) ? '–' : `${(p * 100).toFixed(digits)}%`
}

export function fmtSigned(x: number | null | undefined, digits = 1) {
  if (x == null || Number.isNaN(x)) return '–'
  const v = x * 100
  return `${v > 0 ? '+' : ''}${v.toFixed(digits)}%`
}

export function fmtPrice(price: number, format: string) {
  return format === 'dollars' ? `${Math.round(price * 100)}¢` : price.toFixed(2)
}

export function fmtTime(ts: string | null | undefined) {
  if (!ts) return '–'
  const d = new Date(ts)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                                     timeZone: 'America/New_York' }) + ' ET'
}
