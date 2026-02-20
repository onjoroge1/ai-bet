"use client"

import { useState, useEffect, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Bookmark,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  Clock,
  TrendingUp,
  Search,
  ChevronDown,
  Calendar,
  DollarSign,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react"

/** A single pick within a saved bet (DB format) */
interface BetItem {
  matchId?: string
  match?: string
  pick: string
  odds: number | string
  league?: string
  market?: string
  homeTeam?: string
  awayTeam?: string
}

/** A saved bet (DB format) */
interface SavedBet {
  id: string
  betType: "single" | "parlay" | "roundrobin"
  totalOdds: number
  stake: number
  potentialReturn: number | null
  actualReturn: number | null
  sportsbook: string | null
  notes: string | null
  status: "pending" | "won" | "lost" | "void" | "partial"
  items: BetItem[]
  createdAt: string
  settledAt: string | null
}

/** Sportsbook data for export buttons */
const sportsbooks = [
  { id: "fanduel", name: "FanDuel", logo: "FD", color: "#1493FF" },
  { id: "draftkings", name: "DraftKings", logo: "DK", color: "#53D337" },
  { id: "betmgm", name: "BetMGM", logo: "MGM", color: "#C4A962" },
  { id: "caesars", name: "Caesars", logo: "CZR", color: "#00643C" },
]

function deriveBetName(bet: SavedBet): string {
  if (!bet.items?.length) return `${bet.betType} Bet`
  const first = bet.items[0]
  const matchLabel = first.homeTeam && first.awayTeam
    ? `${first.homeTeam} vs ${first.awayTeam}`
    : first.match ?? "Match"
  if (bet.items.length === 1) return matchLabel
  return `${matchLabel} +${bet.items.length - 1} more`
}

function getMatchLabel(item: BetItem): string {
  if (item.homeTeam && item.awayTeam) return `${item.homeTeam} vs ${item.awayTeam}`
  return item.match ?? item.matchId ?? "Match"
}

export default function SavedBetsPage() {
  const [savedBets, setSavedBets] = useState<SavedBet[]>([])
  const [total, setTotal] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [expandedBet, setExpandedBet] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const fetchBets = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ limit: "100" })
      if (statusFilter !== "all") params.set("status", statusFilter)
      const res = await fetch(`/api/saved-bets?${params}`, { cache: "no-store" })
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      setSavedBets(data.bets ?? [])
      setTotal(data.total ?? 0)
    } catch (err) {
      console.error("[saved-bets]", err)
    } finally {
      setIsLoading(false)
      setLoaded(true)
    }
  }, [statusFilter])

  useEffect(() => { fetchBets() }, [fetchBets])

  /** Filter bets client-side by search */
  const filteredBets = savedBets.filter(bet => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      deriveBetName(bet).toLowerCase().includes(q) ||
      bet.items?.some(item => getMatchLabel(item).toLowerCase().includes(q))
    )
  })

  /** Copy a bet slip to clipboard */
  const copyBet = (bet: SavedBet) => {
    const text = bet.items
      ?.map(item => `${getMatchLabel(item)}: ${item.pick} @ ${Number(item.odds).toFixed(2)}`)
      .join("\n")
    const summary = `\n\n${deriveBetName(bet)}\nType: ${bet.betType}\nTotal Odds: ${bet.totalOdds.toFixed(2)}\nStake: $${bet.stake}`
    navigator.clipboard.writeText((text ?? "") + summary)
    setCopiedId(bet.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  /** Update status via API */
  const updateStatus = async (id: string, status: SavedBet["status"]) => {
    setUpdatingId(id)
    try {
      await fetch("/api/saved-bets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      })
      setSavedBets(prev => prev.map(b => b.id === id ? { ...b, status } : b))
    } catch (err) {
      console.error("[saved-bets update]", err)
    } finally {
      setUpdatingId(null)
    }
  }

  /** Delete via API */
  const deleteBet = async (id: string) => {
    setUpdatingId(id)
    try {
      await fetch(`/api/saved-bets?id=${id}`, { method: "DELETE" })
      setSavedBets(prev => prev.filter(b => b.id !== id))
      setTotal(prev => Math.max(0, prev - 1))
    } catch (err) {
      console.error("[saved-bets delete]", err)
    } finally {
      setUpdatingId(null)
    }
  }

  /** Status badge */
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs"><Clock className="w-3 h-3 mr-1" />Pending</Badge>
      case "won":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs"><TrendingUp className="w-3 h-3 mr-1" />Won</Badge>
      case "lost":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs"><AlertCircle className="w-3 h-3 mr-1" />Lost</Badge>
      case "void":
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30 text-xs">Void</Badge>
      case "partial":
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">Partial</Badge>
      default:
        return null
    }
  }

  /** Aggregated stats */
  const stats = {
    total,
    pending: savedBets.filter(b => b.status === "pending").length,
    won: savedBets.filter(b => b.status === "won").length,
    lost: savedBets.filter(b => b.status === "lost").length,
    totalStaked: savedBets.reduce((acc, b) => acc + (b.stake ?? 0), 0),
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Saved Bets</h1>
          <p className="text-slate-400">Track your bet slips — results update automatically</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-slate-600 text-slate-300 hover:bg-slate-700 self-start sm:self-auto"
          onClick={fetchBets}
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* ── Stats Overview ─────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { icon: Bookmark, value: stats.total, label: "Total Saved", color: "text-slate-300", bg: "bg-slate-700/60" },
          { icon: Clock, value: stats.pending, label: "Pending", color: "text-blue-400", bg: "bg-blue-500/20" },
          { icon: TrendingUp, value: stats.won, label: "Won", color: "text-emerald-400", bg: "bg-emerald-500/20" },
          { icon: AlertCircle, value: stats.lost, label: "Lost", color: "text-red-400", bg: "bg-red-500/20" },
          { icon: DollarSign, value: `$${stats.totalStaked.toFixed(0)}`, label: "Total Staked", color: "text-cyan-400", bg: "bg-cyan-500/20" },
        ].map(s => (
          <Card key={s.label} className="bg-slate-800/60 border-slate-700 p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* ── Filters ────────────────────────────────────────── */}
      <Card className="bg-slate-800/60 border-slate-700 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search saved bets..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/60 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {["all", "pending", "won", "lost", "void"].map(s => (
              <Button
                key={s}
                variant={statusFilter === s ? "default" : "outline"}
                size="sm"
                className={statusFilter === s
                  ? "bg-emerald-600 hover:bg-emerald-500"
                  : "bg-transparent border-slate-600 text-slate-300 hover:bg-slate-700"}
                onClick={() => setStatusFilter(s)}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* ── Saved Bets List ────────────────────────────────── */}
      <div className="space-y-4">
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          </div>
        )}

        {!isLoading && filteredBets.length === 0 && (
          <Card className="bg-slate-800/60 border-slate-700 p-12 text-center">
            <Bookmark className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No saved bets found</h3>
            <p className="text-slate-400 text-sm">
              {searchQuery || statusFilter !== "all"
                ? "Try adjusting your filters"
                : "Save bets from the Parlays or Matches page to see them here"}
            </p>
          </Card>
        )}

        {!isLoading && filteredBets.map(bet => {
          const totalOdds = bet.totalOdds ?? bet.items?.reduce((acc, i) => acc * Number(i.odds || 1), 1)
          const potentialReturn = bet.potentialReturn ?? (bet.stake * totalOdds)
          const isExpanded = expandedBet === bet.id
          const isUpdating = updatingId === bet.id

          return (
            <Card
              key={bet.id}
              className="bg-slate-800/60 border-slate-700 overflow-hidden hover:border-emerald-500/30 transition-colors"
            >
              {/* Main Row */}
              <div className="p-4 cursor-pointer" onClick={() => setExpandedBet(isExpanded ? null : bet.id)}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="font-semibold text-white truncate">{deriveBetName(bet)}</h3>
                      {getStatusBadge(bet.status)}
                      <Badge variant="outline" className="text-xs border-slate-600 text-slate-400 shrink-0">
                        {bet.betType === "roundrobin" ? "Round Robin" : bet.betType.charAt(0).toUpperCase() + bet.betType.slice(1)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(bet.createdAt).toLocaleDateString()}
                      </span>
                      <span>{bet.items?.length ?? 0} picks</span>
                      <span className="text-emerald-400 font-medium">{totalOdds.toFixed(2)}x odds</span>
                      {bet.sportsbook && <span className="text-slate-500">{bet.sportsbook}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-white">${bet.stake}</p>
                    <p className="text-sm text-emerald-400">Returns ${potentialReturn.toFixed(2)}</p>
                    {bet.status === "won" && bet.actualReturn && (
                      <p className="text-xs text-emerald-300 font-medium">
                        Actual: ${Number(bet.actualReturn).toFixed(2)}
                      </p>
                    )}
                  </div>
                  <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="border-t border-slate-700/50">
                  {/* Picks */}
                  <div className="p-4 bg-slate-900/30">
                    <h4 className="text-sm font-medium text-slate-400 mb-3">Selections</h4>
                    <div className="space-y-2">
                      {bet.items?.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-slate-800/60 rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs font-medium text-emerald-400">
                              {index + 1}
                            </span>
                            <div>
                              <p className="text-sm font-medium text-white">{getMatchLabel(item)}</p>
                              <p className="text-xs text-emerald-400">{item.pick}</p>
                              {item.league && <p className="text-xs text-slate-500">{item.league}</p>}
                            </div>
                          </div>
                          <span className="text-lg font-bold text-white">{Number(item.odds).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  {bet.notes && (
                    <div className="px-4 py-3 border-t border-slate-700/50">
                      <p className="text-sm text-slate-400">
                        <span className="font-medium text-white">Notes:</span> {bet.notes}
                      </p>
                    </div>
                  )}

                  {/* Status actions */}
                  <div className="px-4 py-3 border-t border-slate-700/50 flex flex-wrap gap-2 items-center">
                    <span className="text-sm text-slate-500 mr-2">Mark as:</span>
                    {(["pending", "won", "lost", "void"] as const).map(s => (
                      <Button
                        key={s}
                        variant={bet.status === s ? "default" : "outline"}
                        size="sm"
                        disabled={isUpdating}
                        className={`text-xs ${bet.status === s ? "bg-emerald-600 hover:bg-emerald-500" : "bg-transparent border-slate-600 text-slate-300"}`}
                        onClick={e => { e.stopPropagation(); updateStatus(bet.id, s) }}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </Button>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="p-4 border-t border-slate-700/50 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 bg-transparent border-slate-600 text-slate-300"
                      onClick={e => { e.stopPropagation(); copyBet(bet) }}
                    >
                      {copiedId === bet.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      {copiedId === bet.id ? "Copied!" : "Copy"}
                    </Button>

                    {/* Export to sportsbooks (visual only — links) */}
                    {bet.status === "pending" && sportsbooks.map(book => (
                      <Button
                        key={book.id}
                        variant="outline"
                        size="sm"
                        className="gap-2 bg-transparent border-slate-600 text-slate-300"
                        onClick={e => { e.stopPropagation(); updateStatus(bet.id, "pending") }}
                      >
                        <span className="w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: book.color }}>
                          {book.logo}
                        </span>
                        {book.name}
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    ))}

                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isUpdating}
                      className="gap-2 text-red-400 hover:text-red-300 ml-auto"
                      onClick={e => { e.stopPropagation(); deleteBet(bet.id) }}
                    >
                      {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
