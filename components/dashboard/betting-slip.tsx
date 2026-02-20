"use client"

import { useState, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  X,
  Trash2,
  Calculator,
  Info,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Check,
  Bookmark,
  Share2,
  Percent,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Zap,
  Grid3X3,
} from "lucide-react"

/** A single selection in the bet slip */
export interface BetSlipItem {
  id: string
  match: string
  pick: string
  odds: string
  league: string
  matchId?: string
  homeTeam?: string
  awayTeam?: string
  betType?: string
}

interface BettingSlipProps {
  items: BetSlipItem[]
  onRemove: (id: string) => void
  onClear: () => void
}

type BetMode = "single" | "parlay" | "roundrobin"

interface SavedBet {
  id: string
  items: BetSlipItem[]
  betType: BetMode
  stake: number
  timestamp: Date
  name?: string
}

interface Sportsbook {
  id: string
  name: string
  logo: string
  color: string
  deepLinkSupport: boolean
}

const sportsbooks: Sportsbook[] = [
  { id: "fanduel", name: "FanDuel", logo: "FD", color: "#1493FF", deepLinkSupport: true },
  { id: "draftkings", name: "DraftKings", logo: "DK", color: "#53D337", deepLinkSupport: true },
  { id: "betmgm", name: "BetMGM", logo: "MGM", color: "#C4A962", deepLinkSupport: true },
  { id: "caesars", name: "Caesars", logo: "CZR", color: "#00643C", deepLinkSupport: true },
  { id: "pointsbet", name: "PointsBet", logo: "PB", color: "#ED1C24", deepLinkSupport: false },
  { id: "bet365", name: "Bet365", logo: "365", color: "#027B5B", deepLinkSupport: false },
]

const roundRobinOptions = [
  { name: "2-Pick Parlays", picks: 2 },
  { name: "3-Pick Parlays", picks: 3 },
  { name: "4-Pick Parlays", picks: 4 },
]

/**
 * BettingSlip - Interactive betting slip component
 *
 * Features:
 * - Single, Parlay, Round Robin bet modes
 * - Kelly Criterion calculator
 * - Quick stake buttons & custom input
 * - Sportsbook export (deep link or manual copy)
 * - Save / copy bet slips
 */
export function BettingSlip({ items, onRemove, onClear }: BettingSlipProps) {
  const [stake, setStake] = useState<number>(10)
  const [betType, setBetType] = useState<BetMode>("parlay")
  const [showKelly, setShowKelly] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showSaved, setShowSaved] = useState(false)
  const [savedBets, setSavedBets] = useState<SavedBet[]>([])
  const [copied, setCopied] = useState(false)
  const [selectedSportsbook, setSelectedSportsbook] = useState<string | null>(null)
  const [roundRobinSize, setRoundRobinSize] = useState(2)
  const [bankroll, setBankroll] = useState(1000)
  const [winProbability, setWinProbability] = useState(55)

  /** Combined odds for parlay */
  const combinedOdds = items.reduce((acc, item) => acc * parseFloat(item.odds), 1)

  /** Calculate potential returns based on bet type */
  const calculations = useMemo(() => {
    if (items.length === 0) return { totalStake: 0, potentialReturn: 0, potentialProfit: 0 }

    if (betType === "single") {
      const totalStake = stake * items.length
      const potentialReturn = items.reduce((acc, item) => acc + stake * parseFloat(item.odds), 0)
      return { totalStake, potentialReturn, potentialProfit: potentialReturn - totalStake }
    } else if (betType === "parlay") {
      return {
        totalStake: stake,
        potentialReturn: stake * combinedOdds,
        potentialProfit: stake * combinedOdds - stake,
      }
    } else {
      const combos = getCombinations(items, roundRobinSize)
      const totalStake = stake * combos.length
      const potentialReturn = combos.reduce((acc, combo) => {
        const comboOdds = combo.reduce((o, item) => o * parseFloat(item.odds), 1)
        return acc + stake * comboOdds
      }, 0)
      return {
        totalStake,
        potentialReturn,
        potentialProfit: potentialReturn - totalStake,
        combosCount: combos.length,
      }
    }
  }, [items, stake, betType, combinedOdds, roundRobinSize])

  /** Kelly Criterion calculation */
  const kellyStake = useMemo(() => {
    if (items.length === 0) return 0
    const odds = betType === "parlay" ? combinedOdds : parseFloat(items[0]?.odds || "1")
    const p = winProbability / 100
    const q = 1 - p
    const b = odds - 1
    const kelly = (b * p - q) / b
    return Math.max(0, kelly * bankroll)
  }, [items, combinedOdds, betType, winProbability, bankroll])

  /** Get combinations for round robin */
  function getCombinations<T>(arr: T[], size: number): T[][] {
    if (size > arr.length) return []
    if (size === arr.length) return [arr]
    if (size === 1) return arr.map((item) => [item])
    const result: T[][] = []
    for (let i = 0; i <= arr.length - size; i++) {
      const head = arr.slice(i, i + 1)
      const tailCombos = getCombinations(arr.slice(i + 1), size - 1)
      for (const tailCombo of tailCombos) {
        result.push([...head, ...tailCombo])
      }
    }
    return result
  }

  /** Save current bet slip */
  const saveBetSlip = () => {
    const newSavedBet: SavedBet = {
      id: Date.now().toString(),
      items: [...items],
      betType,
      stake,
      timestamp: new Date(),
      name: `Bet ${savedBets.length + 1}`,
    }
    setSavedBets([...savedBets, newSavedBet])
  }

  /** Copy bet slip to clipboard */
  const copyBetSlip = () => {
    const text = items.map((item) => `${item.match}: ${item.pick} @ ${item.odds}`).join("\n")
    const summary = `\n\nBet Type: ${betType.charAt(0).toUpperCase() + betType.slice(1)}\nTotal Odds: ${combinedOdds.toFixed(2)}\nStake: $${stake}\nPotential Return: $${calculations.potentialReturn.toFixed(2)}`
    navigator.clipboard.writeText(text + summary)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  /** Generate deep link for sportsbook */
  const generateDeepLink = (sportsbook: Sportsbook) => {
    const bets = encodeURIComponent(
      items.map((item) => `${item.match}|${item.pick}|${item.odds}`).join(",")
    )
    const deepLinks: Record<string, string> = {
      fanduel: `https://sportsbook.fanduel.com/betslip?bets=${bets}`,
      draftkings: `https://sportsbook.draftkings.com/betslip?selections=${bets}`,
      betmgm: `https://sports.betmgm.com/en/sports/betslip?bets=${bets}`,
      caesars: `https://www.caesars.com/sportsbook/betslip?bets=${bets}`,
    }
    return deepLinks[sportsbook.id] || "#"
  }

  // ── Empty state ─────────────────────────────────────────────────
  if (items.length === 0 && !showSaved) {
    return (
      <Card className="bg-slate-800/60 border-slate-700 p-6">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-slate-700/50 flex items-center justify-center mx-auto mb-3">
            <Calculator className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="font-semibold text-white mb-1">Bet Slip Empty</h3>
          <p className="text-sm text-slate-400 mb-4">
            Click on any odds to add picks to your bet slip
          </p>
          {savedBets.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 bg-transparent border-slate-600 text-slate-300"
              onClick={() => setShowSaved(true)}
            >
              <Bookmark className="w-4 h-4" />
              View Saved Bets ({savedBets.length})
            </Button>
          )}
        </div>
      </Card>
    )
  }

  // ── Active bet slip ─────────────────────────────────────────────
  return (
    <Card className="bg-slate-800/60 border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-gradient-to-r from-emerald-500/10 to-transparent">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-white">Bet Slip</h3>
          <Badge variant="outline" className="text-xs border-slate-600 text-slate-300">
            {items.length} {items.length === 1 ? "pick" : "picks"}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-white"
            onClick={copyBetSlip}
            title="Copy bet slip"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-white"
            onClick={saveBetSlip}
            title="Save bet slip"
          >
            <Bookmark className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 gap-1" onClick={onClear}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Bet Type Toggle */}
      <div className="p-4 border-b border-slate-700/50">
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant={betType === "single" ? "default" : "outline"}
            size="sm"
            className={betType === "single" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-transparent border-slate-600 text-slate-300"}
            onClick={() => setBetType("single")}
          >
            Singles
          </Button>
          <Button
            variant={betType === "parlay" ? "default" : "outline"}
            size="sm"
            className={betType === "parlay" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-transparent border-slate-600 text-slate-300"}
            onClick={() => setBetType("parlay")}
            disabled={items.length < 2}
          >
            Parlay
          </Button>
          <Button
            variant={betType === "roundrobin" ? "default" : "outline"}
            size="sm"
            className={betType === "roundrobin" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-transparent border-slate-600 text-slate-300"}
            onClick={() => setBetType("roundrobin")}
            disabled={items.length < 3}
          >
            <Grid3X3 className="w-3 h-3 mr-1" />
            RR
          </Button>
        </div>

        {/* Round Robin Options */}
        {betType === "roundrobin" && items.length >= 3 && (
          <div className="mt-3 flex gap-2">
            {roundRobinOptions
              .filter((opt) => opt.picks <= items.length)
              .map((opt) => (
                <Button
                  key={opt.picks}
                  variant={roundRobinSize === opt.picks ? "default" : "outline"}
                  size="sm"
                  className={`flex-1 text-xs ${roundRobinSize === opt.picks ? "bg-cyan-600" : "bg-transparent border-slate-600 text-slate-300"}`}
                  onClick={() => setRoundRobinSize(opt.picks)}
                >
                  {opt.name}
                </Button>
              ))}
          </div>
        )}
      </div>

      {/* Selections */}
      <div className="max-h-52 overflow-y-auto">
        {items.map((item, index) => (
          <div key={item.id} className="p-3 border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-slate-500 font-medium">#{index + 1}</span>
                  <Badge variant="outline" className="text-[10px] py-0 border-slate-600 text-slate-400">
                    {item.league}
                  </Badge>
                </div>
                <p className="text-sm font-medium text-white truncate">{item.match}</p>
                <p className="text-xs text-emerald-400 mt-0.5 font-medium">{item.pick}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-emerald-400">{item.odds}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-slate-500 hover:text-red-400"
                  onClick={() => onRemove(item.id)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Stake Input */}
      <div className="p-4 border-b border-slate-700/50">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm text-slate-400">Stake Amount</label>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs gap-1 h-6 text-emerald-400 hover:text-emerald-300"
            onClick={() => setShowKelly(!showKelly)}
          >
            <Calculator className="w-3 h-3" />
            Kelly
          </Button>
        </div>

        {/* Quick Stakes */}
        <div className="grid grid-cols-5 gap-1 mb-3">
          {[5, 10, 25, 50, 100].map((amount) => (
            <Button
              key={amount}
              variant={stake === amount ? "default" : "outline"}
              size="sm"
              className={`text-xs ${stake === amount ? "bg-emerald-600 hover:bg-emerald-500" : "bg-transparent border-slate-600 text-slate-300"}`}
              onClick={() => setStake(amount)}
            >
              ${amount}
            </Button>
          ))}
        </div>

        {/* Custom Stake Input */}
        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="number"
            value={stake}
            onChange={(e) => setStake(Number(e.target.value))}
            className="w-full bg-slate-900/60 border border-slate-700 rounded-lg pl-9 pr-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            min={1}
          />
        </div>

        {/* Kelly Calculator */}
        {showKelly && (
          <div className="mt-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-medium text-white">Kelly Criterion</span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Bankroll</label>
                <div className="relative">
                  <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                  <input
                    type="number"
                    value={bankroll}
                    onChange={(e) => setBankroll(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded pl-6 pr-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Win Prob %</label>
                <div className="relative">
                  <Percent className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                  <input
                    type="number"
                    value={winProbability}
                    onChange={(e) => setWinProbability(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded pl-6 pr-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    min={1}
                    max={99}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between p-2 bg-emerald-500/10 rounded border border-emerald-500/20">
              <span className="text-sm text-slate-400">Recommended Stake</span>
              <span className="font-bold text-emerald-400">${kellyStake.toFixed(2)}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2 text-xs bg-transparent border-slate-600 text-slate-300"
              onClick={() => setStake(Math.round(kellyStake))}
              disabled={kellyStake <= 0}
            >
              Apply Kelly Stake
            </Button>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="p-4 space-y-2 bg-gradient-to-b from-transparent to-slate-900/30">
        {betType === "parlay" && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Combined Odds</span>
            <span className="font-bold text-white">{combinedOdds.toFixed(2)}x</span>
          </div>
        )}
        {betType === "roundrobin" && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Number of Bets</span>
            <span className="font-bold text-white">
              {(calculations as Record<string, number>).combosCount ?? 0} parlays
            </span>
          </div>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Total Stake</span>
          <span className="font-bold text-white">${calculations.totalStake.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Potential Return</span>
          <span className="font-bold text-emerald-400">${calculations.potentialReturn.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between text-sm border-t border-slate-700 pt-2">
          <span className="text-slate-400">Potential Profit</span>
          <span className="font-bold text-cyan-400">${calculations.potentialProfit.toFixed(2)}</span>
        </div>
      </div>

      {/* Export to Sportsbook */}
      <div className="p-4 border-t border-slate-700">
        <Button
          variant="outline"
          className="w-full mb-3 justify-between bg-transparent border-slate-600 text-slate-300"
          onClick={() => setShowExport(!showExport)}
        >
          <span className="flex items-center gap-2">
            <Share2 className="w-4 h-4" />
            Export to Sportsbook
          </span>
          {showExport ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>

        {showExport && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">Select a sportsbook to export your bet slip</p>
            <div className="grid grid-cols-2 gap-2">
              {sportsbooks.map((book) => (
                <Button
                  key={book.id}
                  variant="outline"
                  size="sm"
                  className={`justify-start gap-2 bg-transparent border-slate-600 text-slate-300 hover:bg-slate-700 transition-all ${
                    selectedSportsbook === book.id ? "ring-2 ring-emerald-500" : ""
                  }`}
                  onClick={() => setSelectedSportsbook(book.id)}
                >
                  <span
                    className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: book.color }}
                  >
                    {book.logo}
                  </span>
                  <span className="text-xs">{book.name}</span>
                </Button>
              ))}
            </div>

            {selectedSportsbook && (
              <div className="space-y-2 mt-3">
                {sportsbooks.find((b) => b.id === selectedSportsbook)?.deepLinkSupport ? (
                  <>
                    <Button
                      className="w-full gap-2 text-white"
                      style={{
                        backgroundColor: sportsbooks.find((b) => b.id === selectedSportsbook)?.color,
                      }}
                      onClick={() => {
                        const book = sportsbooks.find((b) => b.id === selectedSportsbook)
                        if (book) window.open(generateDeepLink(book), "_blank")
                      }}
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open in {sportsbooks.find((b) => b.id === selectedSportsbook)?.name}
                    </Button>
                    <p className="text-xs text-slate-500 text-center">
                      Opens the sportsbook with your selections pre-loaded
                    </p>
                  </>
                ) : (
                  <>
                    <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-medium text-white">Manual Entry Required</span>
                      </div>
                      <p className="text-xs text-slate-400 mb-2">Copy your selections and enter them manually:</p>
                      <div className="space-y-1 text-xs">
                        {items.map((item) => (
                          <div key={item.id} className="flex justify-between text-white">
                            <span className="truncate flex-1">{item.pick}</span>
                            <span className="font-mono text-emerald-400 ml-2">{item.odds}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full gap-2 bg-transparent border-slate-600 text-slate-300"
                      onClick={copyBetSlip}
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copied ? "Copied!" : "Copy All Selections"}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Saved Bets Toggle */}
      {savedBets.length > 0 && (
        <div className="p-4 border-t border-slate-700">
          <Button
            variant="ghost"
            className="w-full justify-between text-sm text-slate-300"
            onClick={() => setShowSaved(!showSaved)}
          >
            <span className="flex items-center gap-2">
              <Bookmark className="w-4 h-4" />
              Saved Bets ({savedBets.length})
            </span>
            {showSaved ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>

          {showSaved && (
            <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
              {savedBets.map((saved) => (
                <div
                  key={saved.id}
                  className="p-2 bg-slate-900/50 rounded-lg border border-slate-700 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{saved.name}</p>
                    <p className="text-xs text-slate-400">
                      {saved.items.length} picks - ${saved.stake} stake
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-400 hover:text-emerald-400"
                      onClick={() => {
                        setStake(saved.stake)
                        setBetType(saved.betType)
                      }}
                    >
                      <TrendingUp className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-400 hover:text-red-400"
                      onClick={() => setSavedBets(savedBets.filter((b) => b.id !== saved.id))}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Info Footer */}
      <div className="p-3 border-t border-slate-700 bg-slate-900/30">
        <div className="flex items-start gap-2 text-xs text-slate-500">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>Export your picks to your preferred sportsbook. Deep links open pre-filled bet slips where supported.</p>
        </div>
      </div>
    </Card>
  )
}

