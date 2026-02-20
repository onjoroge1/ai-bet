"use client"

import { useState, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Zap,
  Minus,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Save,
  Trash2,
  Copy,
  Check,
  Info,
  Lock,
} from "lucide-react"
import { toast } from "sonner"

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

/** A single selection on the bet slip. */
export interface BetSlipItem {
  /** Unique key, e.g. `1x2-home`, `btts-yes`, `cs-0-2` */
  id: string
  /** Market category, e.g. "Match Result", "Both Teams to Score" */
  market: string
  /** Human-readable pick, e.g. "Newcastle Win", "Over 2.5" */
  selection: string
  /** Model probability (0-1) */
  probability: number
  /** Decimal odds — bookmaker best (1X2) or fair value (1/prob) for others */
  decimalOdds: number
  /** Optional sub-label, e.g. match name */
  matchLabel?: string
  /** The bookmaker offering the best odds for this selection */
  bestBookmaker?: string
}

/* ═══════════════════════════════════════════════════════════════════════════
   SPORTSBOOK CONFIG
   ═══════════════════════════════════════════════════════════════════════════ */

/** Sportsbook links we can deep-link to, keyed by name (lower-case). */
const SPORTSBOOKS: {
  key: string
  label: string
  url: string
  color: string
}[] = [
  { key: "bet365", label: "bet365", url: "https://www.bet365.com/#/AS/B1/", color: "text-emerald-400" },
  { key: "fanduel", label: "FanDuel", url: "https://sportsbook.fanduel.com/soccer", color: "text-blue-400" },
  { key: "draftkings", label: "DraftKings", url: "https://sportsbook.draftkings.com/leagues/soccer", color: "text-emerald-400" },
  { key: "pinnacle", label: "Pinnacle", url: "https://www.pinnacle.com/en/soccer", color: "text-amber-400" },
  { key: "unibet", label: "Unibet", url: "https://www.unibet.com/betting/sports/filter/football", color: "text-green-400" },
  { key: "betfair", label: "Betfair", url: "https://www.betfair.com/sport/football", color: "text-yellow-400" },
]

/* ═══════════════════════════════════════════════════════════════════════════
   PROPS
   ═══════════════════════════════════════════════════════════════════════════ */

interface BetSlipProps {
  items: BetSlipItem[]
  stake: number
  onStakeChange: (stake: number) => void
  onRemove: (id: string) => void
  onClear: () => void
  matchName: string
  /** The league name, used for context in the clipboard copy */
  leagueName?: string
  /** When true, total odds / potential win / copy / sportsbook actions are blurred */
  premiumLocked?: boolean
  /** Called when user clicks the locked premium area to trigger purchase flow */
  onUnlockPremium?: () => void
}

const QUICK_STAKES = [10, 25, 50, 100] as const

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * BetSlip — floating panel (bottom-right) where users compose a custom slip
 * from selections made across the match page.
 *
 * • Shows combined decimal odds & potential win.
 * • Quick-stake buttons ($10 / $25 / $50 / $100).
 * • "Save Bet Slip" persists to localStorage.
 * • "Copy to Clipboard" generates a formatted summary for manual placement.
 * • Smart deep-links to popular sportsbooks (soccer/football sections).
 * • Shows which bookmaker has the best odds per selection.
 */
export function BetSlip({
  items,
  stake,
  onStakeChange,
  onRemove,
  onClear,
  matchName,
  leagueName,
  premiumLocked = false,
  onUnlockPremium,
}: BetSlipProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [justSaved, setJustSaved] = useState(false)
  const [justCopied, setJustCopied] = useState(false)
  const [showBooks, setShowBooks] = useState(false)

  const combinedOdds = items.reduce((acc, item) => acc * item.decimalOdds, 1)
  const potentialWin = stake * combinedOdds

  /** Build a formatted plain-text summary of the bet slip for clipboard. */
  const clipboardText = useMemo(() => {
    const lines: string[] = []
    lines.push("🎯 SnapBet AI — Bet Slip")
    lines.push(`📋 ${matchName}`)
    if (leagueName) lines.push(`🏆 ${leagueName}`)
    lines.push("─".repeat(32))
    items.forEach((item, i) => {
      lines.push(
        `${i + 1}. ${item.selection}  (${item.market})  @${item.decimalOdds.toFixed(2)}`
      )
      if (item.bestBookmaker) {
        lines.push(`   🏷️ Best odds at: ${item.bestBookmaker}`)
      }
    })
    lines.push("─".repeat(32))
    lines.push(`💰 Stake: $${stake.toFixed(2)}`)
    lines.push(`📊 Combined Odds: ${combinedOdds.toFixed(2)}`)
    lines.push(`🏆 Potential Win: $${potentialWin.toFixed(2)}`)
    lines.push("")
    lines.push("Powered by SnapBet AI — snapbet.ai")
    return lines.join("\n")
  }, [items, stake, matchName, leagueName, combinedOdds, potentialWin])

  /** Copy the bet slip to clipboard */
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(clipboardText)
      setJustCopied(true)
      toast.success("Bet slip copied to clipboard!")
      setTimeout(() => setJustCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const ta = document.createElement("textarea")
      ta.value = clipboardText
      ta.style.position = "fixed"
      ta.style.left = "-9999px"
      document.body.appendChild(ta)
      ta.select()
      document.execCommand("copy")
      document.body.removeChild(ta)
      setJustCopied(true)
      toast.success("Bet slip copied to clipboard!")
      setTimeout(() => setJustCopied(false), 2000)
    }
  }

  /* Don't render anything when the slip is empty */
  if (items.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[370px] max-w-[calc(100vw-2rem)] flex flex-col">
      {/* ── Header (always visible) ──────────────────────────────── */}
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className="flex items-center justify-between w-full bg-slate-800/95 backdrop-blur-xl border border-slate-700 rounded-t-xl px-4 py-3 hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-emerald-400" />
          <span className="text-white font-semibold">Bet Slip</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-500 text-white border-none text-xs px-2 py-0.5">
            {items.length}
          </Badge>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* ── Body (collapsible) ───────────────────────────────────── */}
      {isExpanded && (
        <Card className="bg-slate-900/95 backdrop-blur-xl border-slate-700 border-t-0 rounded-t-none rounded-b-xl overflow-hidden flex flex-col">
          {/* Selections list */}
          <div className="max-h-[220px] overflow-y-auto divide-y divide-slate-800 scrollbar-thin scrollbar-thumb-slate-700">
            {items.map((item) => (
              <div
                key={item.id}
                className="px-4 py-3 hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white text-sm truncate">
                      {item.selection}
                    </div>
                    <div className="text-slate-400 text-xs">{item.market}</div>
                    {item.bestBookmaker && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] text-slate-500">Best at</span>
                        <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[9px] px-1 py-0 h-3.5">
                          {item.bestBookmaker}
                        </Badge>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-emerald-400 font-bold text-base tabular-nums ${premiumLocked ? "blur-[5px] select-none" : ""}`}>
                      {item.decimalOdds.toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemove(item.id)}
                      className="p-1 hover:bg-slate-700 rounded transition-colors"
                    >
                      <Minus className="h-3.5 w-3.5 text-slate-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Stake input ──────────────────────────────────────── */}
          <div className="px-4 pt-4 pb-3 border-t border-slate-800 space-y-3">
            <div className="text-slate-400 text-xs font-medium">Stake</div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <span className="text-slate-400 text-sm">$</span>
              </div>
              <input
                type="number"
                min={0}
                value={stake || ""}
                onChange={(e) => onStakeChange(Number(e.target.value) || 0)}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg pl-7 pr-4 py-2.5 text-right text-white text-lg font-semibold focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none tabular-nums"
              />
            </div>
            <div className="flex gap-2">
              {QUICK_STAKES.map((qs) => (
                <button
                  key={qs}
                  type="button"
                  onClick={() => onStakeChange(qs)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    stake === qs
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-600"
                  }`}
                >
                  ${qs}
                </button>
              ))}
            </div>
          </div>

          {/* ── Totals ───────────────────────────────────────────── */}
          <div className="px-4 pb-2 space-y-2 relative">
            {premiumLocked && (
              <button
                type="button"
                onClick={onUnlockPremium}
                className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] rounded-lg cursor-pointer group"
                title="Unlock with premium"
              >
                <div className="flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/30 rounded-full px-3 py-1">
                  <Lock className="h-3 w-3 text-amber-400" />
                  <span className="text-amber-400 text-[10px] font-semibold">Premium</span>
                </div>
              </button>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Total Odds</span>
              <span className={`text-white font-semibold tabular-nums ${premiumLocked ? "blur-[6px] select-none" : ""}`}>
                {combinedOdds.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">Potential Win</span>
              <span className={`text-emerald-400 font-bold text-xl tabular-nums ${premiumLocked ? "blur-[6px] select-none" : ""}`}>
                ${potentialWin.toFixed(2)}
              </span>
            </div>
          </div>

          {/* ── Actions ──────────────────────────────────────────── */}
          <div className="px-4 pb-4 pt-2 space-y-3">
            {/* Primary actions row — Save + Copy */}
            <div className="flex gap-2">
              {premiumLocked ? (
                <Button
                  className="flex-1 bg-amber-500/20 border border-amber-500/30 text-amber-400 font-semibold py-2.5 rounded-xl gap-1.5 text-sm hover:bg-amber-500/30"
                  onClick={onUnlockPremium}
                >
                  <Lock className="h-4 w-4" />
                  Unlock Odds & Insights
                </Button>
              ) : (
                <>
                  <Button
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 gap-1.5 text-sm"
                    onClick={() => {
                      const saved = {
                        items,
                        stake,
                        matchName,
                        combinedOdds,
                        potentialWin,
                        savedAt: new Date().toISOString(),
                      }
                      const existing: unknown[] = JSON.parse(
                        localStorage.getItem("betSlips") || "[]"
                      )
                      existing.unshift(saved)
                      localStorage.setItem(
                        "betSlips",
                        JSON.stringify(existing.slice(0, 20))
                      )
                      setJustSaved(true)
                      toast.success("Bet slip saved!")
                      setTimeout(() => setJustSaved(false), 2000)
                    }}
                  >
                    <Save className="h-4 w-4" />
                    {justSaved ? "Saved ✓" : "Save"}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-slate-700 bg-slate-800/80 text-white hover:bg-slate-700 hover:text-white font-semibold py-2.5 rounded-xl gap-1.5 text-sm"
                    onClick={handleCopy}
                  >
                    {justCopied ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {justCopied ? "Copied ✓" : "Copy Slip"}
                  </Button>
                </>
              )}
            </div>

            {/* ── How-to banner ─────────────────────────────────── */}
            <div className="flex items-start gap-2 bg-slate-800/60 border border-slate-700/60 rounded-lg p-2.5">
              <Info className="h-3.5 w-3.5 text-blue-400 mt-0.5 shrink-0" />
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Copy your picks, then place them on your preferred sportsbook.
                We&apos;ve highlighted which bookmaker offers the best odds for each selection.
              </p>
            </div>

            {/* ── Place on sportsbook toggle ─────────────────────── */}
            <button
              type="button"
              onClick={() => setShowBooks((v) => !v)}
              className="w-full flex items-center justify-center gap-1.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-emerald-400 text-xs font-medium hover:border-emerald-500/50 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Place on Sportsbook
              {showBooks ? (
                <ChevronUp className="h-3 w-3 ml-1" />
              ) : (
                <ChevronDown className="h-3 w-3 ml-1" />
              )}
            </button>

            {/* ── Sportsbook links grid ──────────────────────────── */}
            {showBooks && (
              <div className="grid grid-cols-3 gap-1.5">
                {SPORTSBOOKS.map((book) => (
                  <a
                    key={book.key}
                    href={book.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1 py-2 bg-slate-800/80 border border-slate-700/60 rounded-lg text-slate-300 text-[10px] font-medium hover:border-emerald-500/40 hover:text-emerald-400 transition-colors"
                  >
                    {book.label}
                    <ExternalLink className="h-2.5 w-2.5 opacity-50" />
                  </a>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={onClear}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors py-1"
            >
              <Trash2 className="h-3 w-3" />
              Clear all selections
            </button>
          </div>
        </Card>
      )}
    </div>
  )
}

