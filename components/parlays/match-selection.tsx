/**
 * Match Selection Component for Parlay Builder
 */

"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2, Search, Calendar, TrendingUp, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

interface Match {
  matchId: string
  homeTeam: string
  awayTeam: string
  homeTeamLogo?: string | null
  awayTeamLogo?: string | null
  league: string
  leagueCountry?: string | null
  leagueFlagEmoji?: string | null
  kickoffDate: string
  marketCount: number
  bestMarket?: {
    marketType: string
    marketSubtype: string | null
    consensusProb: number
    edgeConsensus: number
  } | null
}

interface MatchSelectionProps {
  selectedMatches: string[]
  onMatchSelect: (matchId: string) => void
  onMatchDeselect: (matchId: string) => void
  onMarketSelect: (matchId: string) => void
}

export function MatchSelection({
  selectedMatches,
  onMatchSelect,
  onMatchDeselect,
  onMarketSelect
}: MatchSelectionProps) {
  const [matches, setMatches] = useState<Match[]>([])
  const [leagues, setLeagues] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedLeague, setSelectedLeague] = useState<string>("all")
  const [dateRange, setDateRange] = useState<string>("today")

  useEffect(() => {
    fetchMatches()
  }, [selectedLeague, dateRange])

  const fetchMatches = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        league: selectedLeague,
        dateRange,
        limit: "50"
      })

      const response = await fetch(`/api/parlays/builder/matches?${params}`)
      if (!response.ok) {
        throw new Error("Failed to fetch matches")
      }

      const data = await response.json()
      setMatches(data.matches || [])
      setLeagues(data.leagues || [])
    } catch (error) {
      console.error("Error fetching matches:", error)
      toast.error("Failed to load matches")
    } finally {
      setLoading(false)
    }
  }

  const filteredMatches = matches.filter(match => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    return (
      match.homeTeam.toLowerCase().includes(searchLower) ||
      match.awayTeam.toLowerCase().includes(searchLower) ||
      match.league.toLowerCase().includes(searchLower)
    )
  })

  const handleMatchClick = (matchId: string) => {
    if (selectedMatches.includes(matchId)) {
      onMatchDeselect(matchId)
    } else {
      // Check if we should allow multi-game or enforce single-game
      const isMultiGame = selectedMatches.length > 0
      if (isMultiGame) {
        // Multi-game: Allow multiple matches
        onMatchSelect(matchId)
      } else {
        // First match selected - can be either SGP or start multi-game
        onMatchSelect(matchId)
      }
    }
  }

  const formatKickoffDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (date >= today && date < tomorrow) {
      return `Today ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
    } else if (date >= tomorrow && date < new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)) {
      return `Tomorrow ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }

  if (loading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search matches..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-slate-800/50 border-slate-700 text-white"
            />
          </div>
        </div>
        <Select value={selectedLeague} onValueChange={setSelectedLeague}>
          <SelectTrigger className="w-full sm:w-[200px] bg-slate-800/50 border-slate-700 text-white">
            <SelectValue placeholder="All Leagues" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Leagues</SelectItem>
            {leagues.map((league) => (
              <SelectItem key={league} value={league}>
                {league}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-full sm:w-[200px] bg-slate-800/50 border-slate-700 text-white">
            <SelectValue placeholder="Date Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="tomorrow">Tomorrow</SelectItem>
            <SelectItem value="this_week">This Week</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Match Grid */}
      {filteredMatches.length === 0 ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6 text-center py-12">
            <p className="text-slate-400">No matches found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMatches.map((match) => {
            const isSelected = selectedMatches.includes(match.matchId)
            return (
              <Card
                key={match.matchId}
                className={`cursor-pointer transition-all ${
                  isSelected
                    ? "bg-emerald-900/30 border-emerald-500 ring-2 ring-emerald-500/50"
                    : "bg-slate-800/50 border-slate-700 hover:border-emerald-500/50"
                }`}
                onClick={() => handleMatchClick(match.matchId)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {match.leagueFlagEmoji && (
                        <span className="text-lg">{match.leagueFlagEmoji}</span>
                      )}
                      <span className="text-xs text-slate-400">{match.league}</span>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    )}
                  </div>

                  <div className="space-y-2 mb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">{match.homeTeam}</span>
                    </div>
                    <div className="text-center text-slate-500 text-xs">vs</div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">{match.awayTeam}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{formatKickoffDate(match.kickoffDate)}</span>
                    </div>
                  </div>

                  {match.bestMarket && (
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="outline" className="text-xs border-slate-600 text-slate-300">
                        {match.bestMarket.marketType} {match.bestMarket.marketSubtype || ""}
                      </Badge>
                      <div className="flex items-center gap-1 text-xs">
                        <TrendingUp className="h-3 w-3 text-emerald-400" />
                        <span className="text-emerald-400">
                          {(match.bestMarket.consensusProb * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                      {match.marketCount} markets
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        onMarketSelect(match.matchId)
                      }}
                    >
                      Select Market
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {selectedMatches.length > 0 && (
        <div className="mt-4 p-4 bg-blue-900/20 border border-blue-800/50 rounded-lg">
          <p className="text-sm text-blue-300">
            <strong>{selectedMatches.length}</strong> {selectedMatches.length === 1 ? "match" : "matches"} selected.
            {selectedMatches.length === 1 && " Select markets from this match for a single-game parlay, or add more matches for a multi-game parlay."}
            {selectedMatches.length > 1 && " Select one market from each match for optimal diversification."}
          </p>
        </div>
      )}
    </div>
  )
}

