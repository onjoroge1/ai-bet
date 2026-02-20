"use client"

import { useState, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Calculator,
  DollarSign,
  Percent,
  TrendingUp,
  Zap,
  Info,
  Plus,
  X,
  RotateCcw,
  ArrowRight,
} from "lucide-react"

/** A single leg in the parlay calculator */
interface ParlayLeg {
  id: string
  name: string
  odds: string
}

/** Kelly calculator state */
interface KellyInput {
  bankroll: number
  odds: number
  winProbability: number
}

/**
 * ToolsPage - Betting calculators and tools
 *
 * Features:
 * - Parlay calculator (combine odds, see potential returns)
 * - Kelly Criterion calculator (optimal bet sizing)
 * - Odds converter (decimal / American / fractional)
 * - Implied probability calculator
 */
export default function ToolsPage() {
  // ── Parlay Calculator State ──────────────────────────────
  const [parlayLegs, setParlayLegs] = useState<ParlayLeg[]>([
    { id: "1", name: "Leg 1", odds: "1.50" },
    { id: "2", name: "Leg 2", odds: "2.00" },
  ])
  const [parlayStake, setParlayStake] = useState<number>(10)

  // ── Kelly Calculator State ───────────────────────────────
  const [kelly, setKelly] = useState<KellyInput>({
    bankroll: 1000,
    odds: 2.0,
    winProbability: 55,
  })

  // ── Odds Converter State ─────────────────────────────────
  const [decimalOdds, setDecimalOdds] = useState<number>(2.5)
  const [oddsFormat, setOddsFormat] = useState<"decimal" | "american" | "fractional">("decimal")

  // ── Parlay Calculations ──────────────────────────────────
  const parlayCalc = useMemo(() => {
    const combinedOdds = parlayLegs.reduce(
      (acc, leg) => acc * (parseFloat(leg.odds) || 1),
      1
    )
    const potentialReturn = parlayStake * combinedOdds
    const profit = potentialReturn - parlayStake
    const impliedProb = combinedOdds > 0 ? (1 / combinedOdds) * 100 : 0
    return { combinedOdds, potentialReturn, profit, impliedProb }
  }, [parlayLegs, parlayStake])

  // ── Kelly Calculations ───────────────────────────────────
  const kellyCalc = useMemo(() => {
    const p = kelly.winProbability / 100
    const q = 1 - p
    const b = kelly.odds - 1
    if (b <= 0) return { fraction: 0, stake: 0, edge: 0 }
    const fraction = (b * p - q) / b
    const stake = Math.max(0, fraction * kelly.bankroll)
    const edge = (p * (kelly.odds - 1) - q) * 100
    return {
      fraction: Math.max(0, fraction),
      stake,
      edge,
      halfKelly: stake / 2,
      quarterKelly: stake / 4,
    }
  }, [kelly])

  // ── Odds Conversion ──────────────────────────────────────
  const oddsConversion = useMemo(() => {
    const dec = decimalOdds
    const american =
      dec >= 2.0 ? `+${((dec - 1) * 100).toFixed(0)}` : `-${(100 / (dec - 1)).toFixed(0)}`
    const fractionalNum = dec - 1
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
    const num = Math.round(fractionalNum * 100)
    const den = 100
    const g = gcd(num, den)
    const fractional = `${num / g}/${den / g}`
    const impliedProb = dec > 0 ? (1 / dec) * 100 : 0
    return { decimal: dec.toFixed(2), american, fractional, impliedProb }
  }, [decimalOdds])

  const addParlayLeg = () => {
    const nextId = String(Date.now())
    setParlayLegs([
      ...parlayLegs,
      { id: nextId, name: `Leg ${parlayLegs.length + 1}`, odds: "1.50" },
    ])
  }

  const removeParlayLeg = (id: string) => {
    if (parlayLegs.length <= 2) return
    setParlayLegs(parlayLegs.filter((l) => l.id !== id))
  }

  const updateParlayLeg = (
    id: string,
    field: "name" | "odds",
    value: string
  ) => {
    setParlayLegs(
      parlayLegs.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-white">Bet Tools</h1>
        <p className="text-slate-400">
          Calculators and utilities to sharpen your betting strategy
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* ── Parlay Calculator ────────────────────────── */}
        <Card className="bg-slate-800/60 border-slate-700 overflow-hidden">
          <div className="p-5 border-b border-slate-700 bg-gradient-to-r from-emerald-500/10 to-transparent">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-white">
                Parlay Calculator
              </h2>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Combine odds and calculate potential returns
            </p>
          </div>

          <div className="p-5 space-y-4">
            {/* Legs */}
            {parlayLegs.map((leg, index) => (
              <div key={leg.id} className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-medium text-white">
                  {index + 1}
                </span>
                <input
                  type="text"
                  placeholder="Selection name"
                  value={leg.name}
                  onChange={(e) =>
                    updateParlayLeg(leg.id, "name", e.target.value)
                  }
                  className="flex-1 bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <div className="relative w-24">
                  <input
                    type="number"
                    step="0.01"
                    min="1.01"
                    value={leg.odds}
                    onChange={(e) =>
                      updateParlayLeg(leg.id, "odds", e.target.value)
                    }
                    className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-emerald-400 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-slate-500 hover:text-red-400"
                  onClick={() => removeParlayLeg(leg.id)}
                  disabled={parlayLegs.length <= 2}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}

            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 bg-transparent border-slate-600 text-slate-300 hover:bg-slate-700"
              onClick={addParlayLeg}
            >
              <Plus className="w-4 h-4" />
              Add Leg
            </Button>

            {/* Stake */}
            <div>
              <label className="text-sm text-slate-400 mb-2 block">
                Stake Amount
              </label>
              <div className="flex gap-2">
                {[5, 10, 25, 50, 100].map((amt) => (
                  <Button
                    key={amt}
                    variant={parlayStake === amt ? "default" : "outline"}
                    size="sm"
                    className={`flex-1 text-xs ${
                      parlayStake === amt
                        ? "bg-emerald-600 hover:bg-emerald-500"
                        : "bg-transparent border-slate-600 text-slate-300"
                    }`}
                    onClick={() => setParlayStake(amt)}
                  >
                    ${amt}
                  </Button>
                ))}
              </div>
              <div className="relative mt-2">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="number"
                  min={1}
                  value={parlayStake}
                  onChange={(e) => setParlayStake(Number(e.target.value))}
                  className="w-full bg-slate-900/60 border border-slate-700 rounded-lg pl-9 pr-4 py-2.5 text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Results */}
            <div className="bg-slate-900/50 rounded-xl p-4 space-y-3 border border-slate-700/50">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Combined Odds</span>
                <span className="text-lg font-bold text-white">
                  {parlayCalc.combinedOdds.toFixed(2)}x
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Implied Probability</span>
                <span className="text-sm font-medium text-amber-400">
                  {parlayCalc.impliedProb.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-700 pt-3">
                <span className="text-sm text-slate-400">Potential Return</span>
                <span className="text-lg font-bold text-emerald-400">
                  ${parlayCalc.potentialReturn.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Profit</span>
                <span className="text-lg font-bold text-cyan-400">
                  +${parlayCalc.profit.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* ── Kelly Criterion Calculator ──────────────── */}
        <Card className="bg-slate-800/60 border-slate-700 overflow-hidden">
          <div className="p-5 border-b border-slate-700 bg-gradient-to-r from-cyan-500/10 to-transparent">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-semibold text-white">
                Kelly Criterion
              </h2>
              <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-[10px]">
                Pro
              </Badge>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Optimal bet sizing based on edge and bankroll
            </p>
          </div>

          <div className="p-5 space-y-5">
            {/* Bankroll */}
            <div>
              <label className="text-sm text-slate-400 mb-2 block">
                Total Bankroll
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="number"
                  min={1}
                  value={kelly.bankroll}
                  onChange={(e) =>
                    setKelly({ ...kelly, bankroll: Number(e.target.value) })
                  }
                  className="w-full bg-slate-900/60 border border-slate-700 rounded-lg pl-9 pr-4 py-2.5 text-white font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>

            {/* Odds */}
            <div>
              <label className="text-sm text-slate-400 mb-2 block">
                Decimal Odds
              </label>
              <input
                type="number"
                step="0.01"
                min="1.01"
                value={kelly.odds}
                onChange={(e) =>
                  setKelly({ ...kelly, odds: Number(e.target.value) })
                }
                className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-4 py-2.5 text-emerald-400 font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            {/* Win Probability */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-slate-400">
                  Estimated Win Probability
                </label>
                <span className="text-sm font-medium text-white">
                  {kelly.winProbability}%
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={99}
                value={kelly.winProbability}
                onChange={(e) =>
                  setKelly({
                    ...kelly,
                    winProbability: Number(e.target.value),
                  })
                }
                className="w-full h-2 rounded-full appearance-none cursor-pointer bg-slate-700 accent-cyan-500"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>1%</span>
                <span>50%</span>
                <span>99%</span>
              </div>
            </div>

            {/* Results */}
            <div className="bg-slate-900/50 rounded-xl p-4 space-y-3 border border-slate-700/50">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Kelly Fraction</span>
                <span className="text-sm font-bold text-white">
                  {(kellyCalc.fraction * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Edge</span>
                <span
                  className={`text-sm font-bold ${kellyCalc.edge > 0 ? "text-green-400" : "text-red-400"}`}
                >
                  {kellyCalc.edge >= 0 ? "+" : ""}
                  {kellyCalc.edge.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-700 pt-3">
                <span className="text-sm text-slate-400">Full Kelly Stake</span>
                <span className="text-lg font-bold text-cyan-400">
                  ${kellyCalc.stake.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Half Kelly (safer)</span>
                <span className="text-sm font-medium text-white">
                  ${(kellyCalc.halfKelly ?? 0).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Quarter Kelly (conservative)</span>
                <span className="text-sm font-medium text-white">
                  ${(kellyCalc.quarterKelly ?? 0).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Info box */}
            <div className="flex items-start gap-2 p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-lg">
              <Info className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-slate-400">
                Most professional bettors use <strong className="text-white">Half Kelly</strong> to
                reduce variance. Only bet when you have a positive edge (green).
              </p>
            </div>
          </div>
        </Card>

        {/* ── Odds Converter ─────────────────────────── */}
        <Card className="bg-slate-800/60 border-slate-700 overflow-hidden">
          <div className="p-5 border-b border-slate-700 bg-gradient-to-r from-purple-500/10 to-transparent">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-semibold text-white">
                Odds Converter
              </h2>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Convert between decimal, American, and fractional odds
            </p>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">
                Enter Decimal Odds
              </label>
              <input
                type="number"
                step="0.01"
                min="1.01"
                value={decimalOdds}
                onChange={(e) => setDecimalOdds(Number(e.target.value))}
                className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-4 py-2.5 text-emerald-400 font-mono text-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50 text-center">
                <p className="text-xs text-slate-500 mb-1">Decimal</p>
                <p className="text-xl font-bold text-white">
                  {oddsConversion.decimal}
                </p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50 text-center">
                <p className="text-xs text-slate-500 mb-1">American</p>
                <p className="text-xl font-bold text-white">
                  {oddsConversion.american}
                </p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50 text-center">
                <p className="text-xs text-slate-500 mb-1">Fractional</p>
                <p className="text-xl font-bold text-white">
                  {oddsConversion.fractional}
                </p>
              </div>
            </div>

            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Implied Probability</span>
                <span className="text-lg font-bold text-amber-400">
                  {oddsConversion.impliedProb.toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-2 bg-slate-700 rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-500"
                  style={{
                    width: `${Math.min(100, oddsConversion.impliedProb)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* ── Quick Reference ────────────────────────── */}
        <Card className="bg-slate-800/60 border-slate-700 overflow-hidden">
          <div className="p-5 border-b border-slate-700 bg-gradient-to-r from-amber-500/10 to-transparent">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-semibold text-white">
                Quick Reference
              </h2>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Common odds and probability conversions
            </p>
          </div>

          <div className="p-5">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 text-slate-400 font-medium">
                      Decimal
                    </th>
                    <th className="text-left py-2 text-slate-400 font-medium">
                      American
                    </th>
                    <th className="text-left py-2 text-slate-400 font-medium">
                      Fractional
                    </th>
                    <th className="text-right py-2 text-slate-400 font-medium">
                      Prob.
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { dec: 1.2, us: "-500", frac: "1/5", prob: "83.3%" },
                    { dec: 1.5, us: "-200", frac: "1/2", prob: "66.7%" },
                    { dec: 2.0, us: "+100", frac: "1/1", prob: "50.0%" },
                    { dec: 2.5, us: "+150", frac: "3/2", prob: "40.0%" },
                    { dec: 3.0, us: "+200", frac: "2/1", prob: "33.3%" },
                    { dec: 4.0, us: "+300", frac: "3/1", prob: "25.0%" },
                    { dec: 5.0, us: "+400", frac: "4/1", prob: "20.0%" },
                    { dec: 10.0, us: "+900", frac: "9/1", prob: "10.0%" },
                  ].map((row) => (
                    <tr
                      key={row.dec}
                      className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors"
                    >
                      <td className="py-2 text-emerald-400 font-mono">
                        {row.dec.toFixed(2)}
                      </td>
                      <td className="py-2 text-white font-mono">{row.us}</td>
                      <td className="py-2 text-white font-mono">{row.frac}</td>
                      <td className="py-2 text-right text-amber-400">
                        {row.prob}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

