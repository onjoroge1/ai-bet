"use client"

interface ConsensusOdds {
  home_odds: number | null
  away_odds: number | null
  home_prob: number | null
  away_prob: number | null
  home_spread: number | null
  total_line: number | null
  over_odds: number | null
  under_odds: number | null
  n_bookmakers: number | null
}

interface Props {
  consensus: ConsensusOdds | null
  pick?: string
  compact?: boolean
}

export function OddsDisplay({ consensus, pick, compact }: Props) {
  if (!consensus) {
    return (
      <div className="text-xs text-slate-500 italic">No odds available</div>
    )
  }

  const homeProb = consensus.home_prob ?? 0
  const awayProb = consensus.away_prob ?? 0
  const homePct = Math.round(homeProb * 100)
  const awayPct = Math.round(awayProb * 100)

  return (
    <div className="space-y-2">
      {/* Binary probability bar */}
      <div className="relative h-6 rounded-full overflow-hidden bg-slate-700/50 flex">
        <div
          className={`h-full flex items-center justify-start pl-2 text-[10px] font-bold transition-all ${
            pick === "H" ? "bg-emerald-500/60" : "bg-blue-500/40"
          }`}
          style={{ width: `${homePct}%`, minWidth: homePct > 8 ? undefined : "24px" }}
        >
          {homePct > 15 && <span className="text-white">{homePct}%</span>}
        </div>
        <div
          className={`h-full flex items-center justify-end pr-2 text-[10px] font-bold transition-all ${
            pick === "A" ? "bg-emerald-500/60" : "bg-red-500/40"
          }`}
          style={{ width: `${awayPct}%`, minWidth: awayPct > 8 ? undefined : "24px" }}
        >
          {awayPct > 15 && <span className="text-white">{awayPct}%</span>}
        </div>
      </div>

      {!compact && (
        <div className="flex items-center justify-between text-[11px]">
          {/* Moneyline */}
          <div className="flex gap-3">
            {consensus.home_odds && (
              <span className="text-slate-400">
                ML: <span className="text-white font-medium">{consensus.home_odds.toFixed(2)}</span>
                {" / "}
                <span className="text-white font-medium">{consensus.away_odds?.toFixed(2)}</span>
              </span>
            )}
          </div>
          {/* Book count */}
          {consensus.n_bookmakers && (
            <span className="text-slate-500">{consensus.n_bookmakers} books</span>
          )}
        </div>
      )}

      {/* Spread & Total */}
      {!compact && (consensus.home_spread !== null || consensus.total_line !== null) && (
        <div className="flex gap-4 text-[11px]">
          {consensus.home_spread !== null && (
            <div className="flex items-center gap-1">
              <span className="text-slate-500">Spread:</span>
              <span className="text-white font-medium">
                {consensus.home_spread > 0 ? "+" : ""}{consensus.home_spread}
              </span>
            </div>
          )}
          {consensus.total_line !== null && (
            <div className="flex items-center gap-1">
              <span className="text-slate-500">O/U:</span>
              <span className="text-white font-medium">{consensus.total_line}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
