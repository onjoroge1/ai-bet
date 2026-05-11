"use client"

import Link from "next/link"
import { Star, Lock, TrendingUp, Clock, Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface SnapBetPick {
  id: string
  sport: string
  sportEmoji: string
  homeTeam: string
  awayTeam: string
  league: string
  kickoff: string
  pick: string
  pickTeam: string
  confidence: number
  tier: "premium" | "strong" | "value" | "standard"
  starRating: number
  reasons: string[]
  edge?: number
  spread?: number
  totalLine?: number
  // Per-pick EV inputs from the engine. If both are present the UI can compute
  // live per-pick EV: (pickProb * pickOdds) - 1.
  pickProb?: number
  pickOdds?: number
  slug?: string
}

// Live per-pick EV from model prob × market decimal odds.
// Returns null when inputs are missing.
function perPickEv(pick: SnapBetPick): number | null {
  if (pick.pickProb == null || pick.pickOdds == null) return null
  if (pick.pickOdds <= 1) return null
  return pick.pickProb * pick.pickOdds - 1
}

// Tier explanations shown in the badge tooltip. Sources: 90-day fresh-era
// soccer insights (scripts/premium-tier-analysis.ts Matrix F).
const TIER_TOOLTIPS: Record<SnapBetPick["tier"], { title: string; body: string; ev?: string }> = {
  premium: {
    title: "Premium Pick",
    body: "Highest accuracy tier — model is exceptionally confident. Historical hit-rate ~71% at short odds. Best for steady, low-variance plays.",
  },
  strong: {
    title: "Strong Pick",
    body: "High-conviction pick — model signals align across V1 and V3. Historical hit-rate ~53%. Good baseline play.",
  },
  value: {
    title: "Value Pick — Market Edge",
    body: "Contrarian or draw-detection pick. Lower hit-rate (~38-40%) but the market under-prices it, so payoff covers the misses. Best as part of a portfolio.",
    ev: "+31 to +39% avg EV per unit (last 90d)",
  },
  standard: {
    title: "Standard Pick",
    body: "Baseline pick that passes our quality gate. Near coin-flip accuracy — surface area for users who want broader coverage.",
  },
}

// Per-pick EV estimate for value picks, derived from the reason string the
// engine emits. These map to the empirical EV measured in Matrix F /
// multisport-alpha-analysis over the last 90 days. The full historical
// (acc, odds, n) is included so the tooltip can show how the EV was earned.
interface ValueHint {
  pct: number      // EV % per unit
  label: string    // short label for tooltip headline
  acc: number      // historical accuracy %
  odds: number     // average decimal odds
  sample: number   // n
}

function valueEvHint(reasons: string[]): ValueHint | null {
  const first = reasons[0] ?? ""
  // ── Soccer ──
  if (first.includes("V3 contrarian")) return { pct: 31, label: "contrarian alpha", acc: 38, odds: 3.45, sample: 95 }
  if (first.includes("V3 high-conf draw")) return { pct: 39, label: "draw-detection alpha", acc: 40, odds: 3.48, sample: 20 }
  // ── NBA ──
  if (first.includes("NBA value bucket")) return { pct: 19, label: "NBA mid-confidence alpha", acc: 71, odds: 1.67, sample: 28 }
  // ── NHL ──
  if (first.includes("NHL sweet spot")) return { pct: 31, label: "NHL calibration alpha", acc: 60, odds: 2.18, sample: 60 }
  if (first.includes("NHL underdog")) return { pct: 15, label: "NHL underdog alpha", acc: 49, odds: 2.36, sample: 164 }
  return null
}

interface Props {
  pick: SnapBetPick
  isPremium: boolean
  index: number
}

const tierColors = {
  premium: { border: "border-l-amber-400", bg: "bg-amber-500/5", badge: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  strong: { border: "border-l-emerald-400", bg: "bg-emerald-500/5", badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  // Value picks: contrarian / draw-detection patterns with empirical +EV.
  // Violet chosen to be visually distinct from premium (amber) and strong
  // (emerald) — these are a DIFFERENT KIND of pick, not a lower-confidence one.
  value: { border: "border-l-violet-400", bg: "bg-violet-500/5", badge: "bg-violet-500/20 text-violet-300 border-violet-500/30" },
  standard: { border: "border-l-blue-400", bg: "bg-blue-500/5", badge: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
}

export function SnapBetPickCard({ pick, isPremium, index }: Props) {
  const colors = tierColors[pick.tier]
  const tooltipCopy = TIER_TOOLTIPS[pick.tier]
  const kickoff = new Date(pick.kickoff)
  const now = new Date()
  const hoursUntil = Math.round((kickoff.getTime() - now.getTime()) / 3600000)
  const timeLabel = hoursUntil < 1 ? "Starting soon" : hoursUntil < 24 ? `In ${hoursUntil}h` : `In ${Math.ceil(hoursUntil / 24)}d`
  const ev = pick.tier === "value" ? valueEvHint(pick.reasons) : null
  // Live per-pick EV from model prob × current market odds. Falls back to
  // pattern EV if engine didn't supply pickProb/pickOdds.
  const liveEv = pick.tier === "value" ? perPickEv(pick) : null
  const displayEvPct = liveEv != null ? Math.round(liveEv * 100) : ev?.pct ?? null

  return (
    <Link href={pick.slug || "#"} className="block group">
      <div className={`relative rounded-xl border-l-4 ${colors.border} ${colors.bg} border border-slate-700/50 hover:border-slate-600/80 transition-all duration-200 p-4 hover:shadow-lg hover:shadow-slate-900/50`}>
        {/* Tier badge */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{pick.sportEmoji}</span>
            <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">{pick.league}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              {Array.from({ length: pick.starRating }).map((_, i) => (
                <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
              ))}
              {Array.from({ length: 5 - pick.starRating }).map((_, i) => (
                <Star key={i} className="w-3 h-3 text-slate-600" />
              ))}
            </div>
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-semibold cursor-help ${colors.badge}`}
                    onClick={(e) => e.preventDefault() /* let the tooltip handle, don't navigate */}
                  >
                    {pick.tier.charAt(0).toUpperCase() + pick.tier.slice(1)}
                    <Info className="w-3 h-3 opacity-70" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[260px] text-xs leading-relaxed">
                  <div className="font-semibold mb-1">{tooltipCopy.title}</div>
                  <div className="text-slate-300">{tooltipCopy.body}</div>
                  {tooltipCopy.ev && (
                    <div className="mt-2 pt-2 border-t border-slate-700 text-violet-300 font-medium">
                      {tooltipCopy.ev}
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Teams */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate">{pick.homeTeam}</div>
            <div className="text-sm text-slate-400 truncate">{pick.awayTeam}</div>
          </div>

          {/* Confidence ring or lock */}
          {isPremium ? (
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className="relative flex items-center justify-center" style={{ width: 48, height: 48 }}>
                <svg width="48" height="48" className="-rotate-90">
                  <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-700/50" />
                  <circle
                    cx="24" cy="24" r="21" fill="none" strokeWidth="3" strokeLinecap="round"
                    className={
                      pick.tier === 'premium' ? 'stroke-amber-400'
                      : pick.tier === 'strong' ? 'stroke-emerald-400'
                      : pick.tier === 'value' ? 'stroke-violet-400'
                      : 'stroke-blue-400'
                    }
                    strokeDasharray={`${2 * Math.PI * 21}`}
                    strokeDashoffset={`${2 * Math.PI * 21 * (1 - pick.confidence / 100)}`}
                    style={{ transition: 'stroke-dashoffset 0.6s' }}
                  />
                </svg>
                <span className={`absolute text-xs font-bold ${
                  pick.tier === 'premium' ? 'text-amber-400'
                  : pick.tier === 'strong' ? 'text-emerald-400'
                  : pick.tier === 'value' ? 'text-violet-400'
                  : 'text-blue-400'
                }`}>
                  {pick.confidence}%
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-slate-700/50 border border-slate-600/50">
              <Lock className="w-4 h-4 text-slate-500" />
            </div>
          )}
        </div>

        {/* Pick info */}
        {isPremium ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <TrendingUp className={`w-3.5 h-3.5 ${pick.tier === 'value' ? 'text-violet-400' : 'text-emerald-400'}`} />
              <span className={`text-sm font-medium ${pick.tier === 'value' ? 'text-violet-300' : 'text-emerald-400'}`}>
                Pick: {pick.pickTeam}
              </span>
              {pick.edge && pick.edge > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full">
                  +{Math.round(pick.edge * 100)}% edge
                </span>
              )}
              {ev && displayEvPct != null && (
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold cursor-help ${
                          displayEvPct >= 0
                            ? "bg-violet-500/20 text-violet-300"
                            : "bg-slate-500/20 text-slate-400"
                        }`}
                        onClick={(e) => e.preventDefault()}
                      >
                        {displayEvPct >= 0 ? "+" : ""}{displayEvPct}% EV
                        <Info className="w-2.5 h-2.5 opacity-70" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[300px] text-xs leading-relaxed">
                      {liveEv != null ? (
                        <>
                          <div className="font-semibold mb-1 text-violet-300">
                            Live EV: {liveEv >= 0 ? "+" : ""}{Math.round(liveEv * 100)}% per unit
                          </div>
                          <div className="text-slate-300">
                            Computed from <span className="font-mono text-white">{Math.round((pick.pickProb ?? 0) * 100)}%</span> model
                            probability × <span className="font-mono text-white">{(pick.pickOdds ?? 0).toFixed(2)}x</span> market
                            decimal odds for <span className="text-violet-200">{pick.pickTeam}</span>.
                          </div>
                          <div className="mt-2 pt-2 border-t border-slate-700 text-slate-400">
                            Historical pattern ({ev.label}): hit ~{ev.acc}% at avg {ev.odds.toFixed(2)}x
                            over the last 90 days (n={ev.sample}). Live number above reflects
                            this specific match's pricing.
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="font-semibold mb-1 text-violet-300">Pattern EV: +{ev.pct}% per unit</div>
                          <div className="text-slate-300">
                            Historical {ev.label}: this pattern hit ~{ev.acc}%
                            at avg {ev.odds.toFixed(2)}x odds over the last 90 days
                            (n={ev.sample} sample). Live odds not available for this match
                            yet — pattern average shown.
                          </div>
                        </>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            {pick.spread != null && (
              <div className="text-xs text-slate-400">
                Spread: {pick.spread > 0 ? '+' : ''}{pick.spread} | O/U: {pick.totalLine || '—'}
              </div>
            )}
            {pick.reasons.length > 0 && (
              <div className="text-[11px] text-slate-500 leading-relaxed">
                {pick.reasons[0]}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 py-1">
            <Lock className="w-3 h-3 text-slate-500" />
            <span className="text-xs text-slate-500">Premium pick — upgrade to see details</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-700/30">
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <Clock className="w-3 h-3" />
            <span>{timeLabel}</span>
          </div>
          <span className="text-[11px] text-slate-600 group-hover:text-slate-400 transition-colors">
            View details →
          </span>
        </div>
      </div>
    </Link>
  )
}
