"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, ArrowRight, TrendingUp, Radio, ChevronDown } from "lucide-react"
import type { MarketMatch, BookKey, MatchSide } from "@/lib/market/types"
import {
  formatKickoffTime,
  formatDate,
  formatMinute,
  formatScore,
  getConfidenceColorClass,
  sortByKickoff,
  sortByConfidence,
} from "@/lib/market/formatters"
import type { SelectHTMLAttributes } from "react"

interface OddsPredictionTableProps {
  status?: "upcoming" | "live" | "all"
  limit?: number
  leagueId?: number
  showStatusTabs?: boolean
}

export function OddsPredictionTable({
  status = "upcoming",
  limit = 10,
  leagueId,
  showStatusTabs = true,
}: OddsPredictionTableProps) {
  const router = useRouter()
  const [allMatches, setAllMatches] = useState<MarketMatch[]>([]) // Store all fetched matches
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<"kickoff" | "confidence">("kickoff")
  const [selectedDate, setSelectedDate] = useState<string>("all") // For upcoming date filtering

  useEffect(() => {
    loadMatches()
    // Poll every 2min for upcoming (since we cache for 60s), 1min for live
    const interval = setInterval(loadMatches, status === "live" ? 60000 : 120000)
    return () => clearInterval(interval)
  }, [status, limit, leagueId])

  useEffect(() => {
    loadMatches()
  }, [])

  const loadMatches = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Use Next.js API route instead of direct backend call
      // Fetch more matches for upcoming to enable date filtering
      const fetchLimit = status === "upcoming" ? 50 : limit
      let url = `/api/market?status=${status}&limit=${fetchLimit}`
      if (leagueId) {
        url += `&league=${leagueId}`
      }
      
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      
      // Adapt the raw API data to MarketMatch format
      const rawMatches = data.matches || []
      
      // Filter out matches with "TBD" team names or empty team names
      // But allow TBD matches if no valid matches exist (fallback behavior)
      const validMatches = rawMatches.filter((match: any) => {
        const homeName = (match.home?.name || "").trim()
        const awayName = (match.away?.name || "").trim()
        
        // Filter out TBD, empty, or placeholder team names
        const invalidNames = ["TBD", "TBA", "TBC", "", "HOME", "AWAY", "TEAM 1", "TEAM 2"]
        const isHomeValid = homeName && !invalidNames.includes(homeName.toUpperCase())
        const isAwayValid = awayName && !invalidNames.includes(awayName.toUpperCase())
        
        return isHomeValid && isAwayValid
      })
      
      // If no valid matches found, fallback to showing TBD matches with placeholder names
      let matchesToProcess = validMatches
      if (validMatches.length === 0 && rawMatches.length > 0) {
        console.log(`⚠️ No valid matches found, falling back to TBD matches with placeholders`)
        console.log(`📊 Raw matches count: ${rawMatches.length}`)
        matchesToProcess = rawMatches.map((match: any) => {
          const homeName = `Team ${match.match_id || 'Home'}`
          const awayName = `Team ${(match.match_id || 0) + 1}`
          console.log(`Creating placeholder: ${homeName} vs ${awayName}`)
          return {
            ...match,
            home: { ...match.home, name: homeName },
            away: { ...match.away, name: awayName }
          }
        })
        console.log(`✅ Created ${matchesToProcess.length} matches with placeholders`)
      }
      
      console.log(`Processing ${matchesToProcess.length} matches (${validMatches.length} valid, ${rawMatches.length} total)`)
      
      const adaptedMatches = matchesToProcess.map((match: any): MarketMatch => {
        console.log("Processing match:", match)
        
        // Extract odds from novig_current
        const novigOdds = match.odds?.novig_current
        const normalizedOdds: any = {}
        let primaryBook: BookKey | undefined
        
        if (novigOdds) {
          // Convert probabilities to decimal odds
          normalizedOdds.pinnacle = {
            home: novigOdds.home ? Number((1 / novigOdds.home).toFixed(2)) : 0,
            draw: novigOdds.draw ? Number((1 / novigOdds.draw).toFixed(2)) : 0,
            away: novigOdds.away ? Number((1 / novigOdds.away).toFixed(2)) : 0,
          }
          primaryBook = "pinnacle"
        }

        // Extract predictions from models - prefer V2 over V1 if available
        // V2 is premium (masked), V1 is free (visible)
        const predictions: MarketMatch["predictions"] = {}
        const v2Model = match.models?.v2_lightgbm
        const v1Model = match.models?.v1_consensus
        const primaryModel = match.ui_hints?.primary_model || (v2Model ? 'v2_lightgbm' : 'v1_consensus')
        
        // If V2 is available, use it as premium (masked)
        if (v2Model) {
          const pick = v2Model.pick?.toLowerCase() // 'home', 'away', or 'draw'
          const confidence = Math.round((v2Model.confidence || 0) * 100) // Convert 0-1 to 0-100
          
          console.log(`Match ${match.match_id || match.id}: Using V2 (Premium), confidence: ${confidence}%, pick: ${pick}`)
          
          predictions.premium = {
            side: pick as MatchSide,
            confidence: confidence || 0,
            model: 'v2_lightgbm' as const
          } as any // Type assertion to include model field
        }
        
        // Always provide V1 as free prediction (visible)
        if (v1Model) {
          const pick = v1Model.pick?.toLowerCase() // 'home', 'away', or 'draw'
          const confidence = Math.round((v1Model.confidence || 0) * 100) // Convert 0-1 to 0-100
          
          console.log(`Match ${match.match_id || match.id}: Using V1 (Free), confidence: ${confidence}%, pick: ${pick}`)
          
          predictions.free = {
            side: pick as MatchSide,
            confidence: confidence || 0,
            model: 'v1_consensus' as const
          } as any // Type assertion to include model field
        }
        
        if (!v2Model && !v1Model) {
          console.log(`Match ${match.match_id || match.id}: No prediction model available`)
        }

        return {
          id: match.match_id || match.id || Date.now(),
          status: (match.status?.toUpperCase() === "LIVE" || match.status === "live") ? "live" : "upcoming",
          kickoff_utc: match.kickoff_at || match.kickoff_utc || new Date().toISOString(),
          minute: match.minute || match.elapsed,
          score: match.score ? { home: match.score.home || 0, away: match.score.away || 0 } : undefined,
          league: {
            id: match.league?.id || 0,
            name: match.league?.name || `League ${match.league?.id || "Unknown"}`,
            country: "",
          },
          home: {
            id: 0,
            name: match.home?.name || "Home",
            logoUrl: match.home?.logo_url || "",
          },
          away: {
            id: 0,
            name: match.away?.name || "Away",
            logoUrl: match.away?.logo_url || "",
          },
          odds: normalizedOdds,
          primaryBook,
          predictions,
          link: `/matches/${match.match_id || match.id}`,
        }
      })
      
      // Store all matches
      console.log(`Setting allMatches to ${adaptedMatches.length} matches`)
      adaptedMatches.forEach((m: MarketMatch, i: number) => {
        console.log(`Match ${i + 1}: ${m.home.name} vs ${m.away.name} on ${m.kickoff_utc}`)
      })
      setAllMatches(adaptedMatches)
    } catch (err) {
      console.error("Error loading matches:", err)
      setError(err instanceof Error ? err.message : "Failed to load matches")
    } finally {
      setLoading(false)
    }
  }

  // Filter by selected date for upcoming matches
  const filteredMatches = useMemo(() => {
    if (status !== "upcoming") return allMatches
    
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
    const dayAfter = new Date(today.getTime() + 48 * 60 * 60 * 1000)

    console.log(`Filtering matches - selectedDate: ${selectedDate}, allMatches: ${allMatches.length}`)
    console.log(`Today: ${today.toISOString()}, Tomorrow: ${tomorrow.toISOString()}`)

    const filtered = allMatches.filter((m) => {
      const matchDate = new Date(m.kickoff_utc)
      const matchDateOnly = new Date(matchDate.getFullYear(), matchDate.getMonth(), matchDate.getDate())

      if (selectedDate === "today") {
        return matchDateOnly.getTime() === today.getTime()
      } else if (selectedDate === "tomorrow") {
        return matchDateOnly.getTime() === tomorrow.getTime()
      } else if (selectedDate === "dayafter") {
        return matchDateOnly.getTime() === dayAfter.getTime()
      } else if (selectedDate === "upcoming") {
        return matchDateOnly.getTime() > dayAfter.getTime()
      }
      // Default "all" shows all upcoming matches
      return matchDateOnly.getTime() >= today.getTime()
    })
    
    console.log(`Filtered to ${filtered.length} matches for selectedDate: ${selectedDate}`)
    return filtered
  }, [allMatches, status, selectedDate])

  const sortedMatches = useMemo(() => {
    const sorted = sortBy === "kickoff" ? sortByKickoff(filteredMatches) : sortByConfidence(filteredMatches)
    return sorted
  }, [filteredMatches, sortBy])

  // Calculate match counts for each date tab
  const matchCounts = useMemo((): {
    all: number;
    today: number;
    tomorrow: number;
    dayafter: number;
    upcoming: number;
  } => {
    if (status !== "upcoming") return {
      all: 0,
      today: 0,
      tomorrow: 0,
      dayafter: 0,
      upcoming: 0
    }
    
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
    const dayAfter = new Date(today.getTime() + 48 * 60 * 60 * 1000)

    const counts = {
      all: allMatches.filter(m => {
        const matchDate = new Date(m.kickoff_utc)
        const matchDateOnly = new Date(matchDate.getFullYear(), matchDate.getMonth(), matchDate.getDate())
        return matchDateOnly.getTime() >= today.getTime()
      }).length,
      today: allMatches.filter(m => {
        const matchDate = new Date(m.kickoff_utc)
        const matchDateOnly = new Date(matchDate.getFullYear(), matchDate.getMonth(), matchDate.getDate())
        return matchDateOnly.getTime() === today.getTime()
      }).length,
      tomorrow: allMatches.filter(m => {
        const matchDate = new Date(m.kickoff_utc)
        const matchDateOnly = new Date(matchDate.getFullYear(), matchDate.getMonth(), matchDate.getDate())
        return matchDateOnly.getTime() === tomorrow.getTime()
      }).length,
      dayafter: allMatches.filter(m => {
        const matchDate = new Date(m.kickoff_utc)
        const matchDateOnly = new Date(matchDate.getFullYear(), matchDate.getMonth(), matchDate.getDate())
        return matchDateOnly.getTime() === dayAfter.getTime()
      }).length,
      upcoming: allMatches.filter(m => {
        const matchDate = new Date(m.kickoff_utc)
        const matchDateOnly = new Date(matchDate.getFullYear(), matchDate.getMonth(), matchDate.getDate())
        return matchDateOnly.getTime() > dayAfter.getTime()
      }).length,
    }

    return counts
  }, [allMatches, status])

  if (loading && allMatches.length === 0) {
    return <SkeletonLoader />
  }

  if (error) {
    return (
      <Card className="bg-red-900/30 border border-red-800 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-red-300 font-medium">Error loading matches</p>
            <p className="text-red-400 text-sm">{error}</p>
          </div>
          <Button onClick={loadMatches} variant="outline" size="sm">
            Retry
          </Button>
        </div>
      </Card>
    )
  }

  if (filteredMatches.length === 0) {
    return (
      <Card className="bg-slate-900/50 border border-slate-700 p-12 text-center">
        <Radio className="h-12 w-12 text-slate-500 mx-auto mb-4" />
        <p className="text-slate-400 mb-2">No matches found</p>
        <p className="text-slate-500 text-sm">
          {allMatches.length === 0 
            ? "No upcoming matches available" 
            : `All ${allMatches.length} matches have placeholder team names`}
        </p>
        {allMatches.length > 0 && (
          <div className="mt-4 p-3 bg-slate-800/50 rounded-lg">
            <p className="text-slate-300 text-sm mb-2">Available matches with placeholder names:</p>
            <div className="text-slate-400 text-xs space-y-1">
              {allMatches.slice(0, 3).map((match, index) => (
                <div key={match.id}>
                  {formatDate(match.kickoff_utc)} - {formatKickoffTime(match.kickoff_utc)}
                </div>
              ))}
              {allMatches.length > 3 && <div>...and {allMatches.length - 3} more</div>}
            </div>
          </div>
        )}
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Date tabs for upcoming matches */}
      {status === "upcoming" && (
        <div className="space-y-3">
          {/* Placeholder matches indicator */}
          {allMatches.length > 0 && allMatches.some(m => m.home.name.startsWith('Team ')) && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                <span className="text-amber-300 text-sm font-medium">
                  Showing matches with placeholder team names
                </span>
              </div>
              <p className="text-amber-200/80 text-xs mt-1">
                Real team names will be updated closer to match time
              </p>
            </div>
          )}
          
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => setSelectedDate("all")}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              selectedDate === "all"
                ? "bg-slate-700 text-slate-100 border border-slate-600"
                : "bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-750"
            }`}
          >
            All {matchCounts.all > 0 && `(${matchCounts.all})`}
          </button>
          <button
            onClick={() => setSelectedDate("today")}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              selectedDate === "today"
                ? "bg-slate-700 text-slate-100 border border-slate-600"
                : "bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-750"
            }`}
          >
            Today {matchCounts.today > 0 && `(${matchCounts.today})`}
          </button>
          <button
            onClick={() => setSelectedDate("tomorrow")}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              selectedDate === "tomorrow"
                ? "bg-slate-700 text-slate-100 border border-slate-600"
                : "bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-750"
            }`}
          >
            Tomorrow {matchCounts.tomorrow > 0 && `(${matchCounts.tomorrow})`}
          </button>
          <button
            onClick={() => setSelectedDate("dayafter")}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              selectedDate === "dayafter"
                ? "bg-slate-700 text-slate-100 border border-slate-600"
                : "bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-750"
            }`}
          >
            Day After {matchCounts.dayafter > 0 && `(${matchCounts.dayafter})`}
          </button>
          <button
            onClick={() => setSelectedDate("upcoming")}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              selectedDate === "upcoming"
                ? "bg-slate-700 text-slate-100 border border-slate-600"
                : "bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-750"
            }`}
          >
            Future {matchCounts.upcoming > 0 && `(${matchCounts.upcoming})`}
          </button>
        </div>
        </div>
      )}

      {/* Header with sort */}
      <div className="flex items-center justify-end">
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "kickoff" | "confidence")}
          className="bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-slate-300"
        >
          <option value="kickoff">Kickoff (asc)</option>
          <option value="confidence">AI Confidence (desc)</option>
        </select>
      </div>

      {/* Desktop Table */}
      <Card className="hidden lg:block border border-slate-700 bg-slate-900/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800/60 sticky top-0 z-10">
              <tr className="text-slate-300 text-xs uppercase tracking-wide">
                <th className="text-left py-3 px-4 min-w-[280px]">Match</th>
                <th className="text-left py-3 px-4 w-[150px]">League</th>
                <th className="text-left py-3 px-4 w-[90px]">Time</th>
                <th className="text-center py-3 px-4 min-w-[280px]">Odds (1X2)</th>
                <th className="text-right py-3 px-4 w-[210px]">Prediction</th>
                <th className="text-right py-3 px-4 w-[44px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {sortedMatches.map((match) => (
                <MatchTableRow key={match.id} match={match} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {sortedMatches.map((match) => (
          <MatchCard key={match.id} match={match} />
        ))}
      </div>
    </div>
  )
}

function MatchTableRow({ match }: { match: MarketMatch }) {
  const router = useRouter()
  const isLive = match.status === "live"
  const homeOdds = match.odds[match.primaryBook || "bet365"]
  
  const handleClick = () => {
    router.push(match.link || `/matches/${match.id}`)
  }

  const getSideName = (side: string) => {
    if (side === "home") return match.home.name
    if (side === "away") return match.away.name
    return "Draw"
  }

  return (
    <tr
      onClick={handleClick}
      className="group hover:bg-slate-800/40 transition cursor-pointer h-16 lg:h-20"
    >
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-slate-100 font-semibold truncate">
              {match.home.logoUrl && (
                <img
                  src={match.home.logoUrl}
                  alt={match.home.name}
                  className="w-5 h-5 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = "none"
                  }}
                />
              )}
              <span className={`truncate ${match.home.name.startsWith('Team ') ? 'text-slate-400 italic' : ''}`}>
                {match.home.name}
              </span>
              <span className="text-slate-500 text-xs">vs</span>
              {match.away.logoUrl && (
                <img
                  src={match.away.logoUrl}
                  alt={match.away.name}
                  className="w-5 h-5 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = "none"
                  }}
                />
              )}
              <span className={`truncate ${match.away.name.startsWith('Team ') ? 'text-slate-400 italic' : ''}`}>
                {match.away.name}
              </span>
            </div>
            {isLive && match.score && (
              <div className="flex items-center gap-2 mt-1">
                <Badge className="bg-emerald-500/10 text-emerald-300 border border-emerald-600/40 px-2 py-0.5 text-xs">
                  LIVE
                </Badge>
                <span className="text-emerald-400 font-semibold">
                  {formatScore(match.score)}
                </span>
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          {match.league.flagUrl && (
            <img
              src={match.league.flagUrl}
              alt={match.league.country}
              className="w-4 h-4"
              onError={(e) => {
                e.currentTarget.style.display = "none"
              }}
            />
          )}
          <span className="text-slate-300 text-sm truncate">{match.league.name}</span>
        </div>
      </td>
      <td className="py-3 px-4">
        {isLive && match.minute ? (
          <span className="text-emerald-400 font-medium">{formatMinute(match.minute)}</span>
        ) : (
          <div className="text-slate-400 text-sm">
            <div>{formatKickoffTime(match.kickoff_utc)}</div>
            <div className="text-xs text-slate-500">{formatDate(match.kickoff_utc)}</div>
          </div>
        )}
      </td>
      <td className="py-3 px-4">
        {homeOdds ? (
          <div className="flex items-center justify-center gap-2">
            <div className="flex flex-col items-center gap-1">
              <div className="text-xs text-slate-400 uppercase">Home</div>
              <div className="px-2 py-1 rounded-md border border-slate-700 text-slate-200 text-sm min-w-[50px] text-center">
                {typeof homeOdds.home === 'number' ? homeOdds.home.toFixed(2) : homeOdds.home}
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="text-xs text-slate-400 uppercase">Draw</div>
              <div className="px-2 py-1 rounded-md border border-slate-700 text-slate-200 text-sm min-w-[50px] text-center">
                {typeof homeOdds.draw === 'number' ? homeOdds.draw.toFixed(2) : homeOdds.draw}
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="text-xs text-slate-400 uppercase">Away</div>
              <div className="px-2 py-1 rounded-md border border-slate-700 text-slate-200 text-sm min-w-[50px] text-center">
                {typeof homeOdds.away === 'number' ? homeOdds.away.toFixed(2) : homeOdds.away}
              </div>
            </div>
          </div>
        ) : (
          <span className="text-slate-500 text-sm">N/A</span>
        )}
      </td>
      <td className="py-3 px-4 text-right">
        {/* Show premium prediction if available (V2), otherwise show free (V1) */}
        {match.predictions?.premium ? (
          <div className="flex flex-col items-end gap-1">
            <span className="text-slate-300 text-sm">
              {getSideName(match.predictions.premium.side)}
            </span>
            <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 text-xs font-semibold shadow-[0_0_8px_rgba(245,158,11,0.4)]">
              Unlock Premium
            </Badge>
          </div>
        ) : match.predictions?.free ? (
          <div className="flex flex-col items-end gap-1">
            <span className="text-slate-300 text-sm">
              {getSideName(match.predictions.free.side)}
            </span>
            <span className={`font-bold text-lg ${getConfidenceColorClass(match.predictions.free.confidence)}`}>
              {match.predictions.free.confidence}%
            </span>
          </div>
        ) : null}
      </td>
      <td className="py-3 px-4">
        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition">
          <ArrowRight className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  )
}

function MatchCard({ match }: { match: MarketMatch }) {
  const router = useRouter()
  const isLive = match.status === "live"
  const homeOdds = match.odds[match.primaryBook || "bet365"]

  const handleClick = () => {
    router.push(match.link || `/matches/${match.id}`)
  }

  const getSideName = (side: string) => {
    if (side === "home") return match.home.name
    if (side === "away") return match.away.name
    return "Draw"
  }

  return (
    <Card
      onClick={handleClick}
      className="p-4 rounded-xl border border-slate-700 bg-slate-900/60 space-y-3 hover:bg-slate-800/40 transition cursor-pointer group"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {match.league.flagUrl && (
            <img
              src={match.league.flagUrl}
              alt={match.league.country}
              className="w-4 h-4"
            />
          )}
          <span className="text-slate-400 text-sm">{match.league.name}</span>
        </div>
        {isLive && match.minute ? (
          <Badge className="bg-emerald-500/10 text-emerald-300 border border-emerald-600/40 px-2 py-0.5 text-xs">
            LIVE {formatMinute(match.minute)}
          </Badge>
        ) : (
          <span className="text-slate-500 text-xs">
            {formatKickoffTime(match.kickoff_utc)} {formatDate(match.kickoff_utc)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-slate-100 font-semibold flex-1">
          {match.home.logoUrl && (
            <img 
              src={match.home.logoUrl} 
              alt={match.home.name}
              className="w-5 h-5 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          )}
          <span className={match.home.name.startsWith('Team ') ? 'text-slate-400 italic' : ''}>
            {match.home.name}
          </span>
          <span className="text-slate-400 mx-2">vs</span>
          {match.away.logoUrl && (
            <img 
              src={match.away.logoUrl} 
              alt={match.away.name}
              className="w-5 h-5 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          )}
          <span className={match.away.name.startsWith('Team ') ? 'text-slate-400 italic' : ''}>
            {match.away.name}
          </span>
        </div>
      </div>

      {isLive && match.score && (
        <div className="text-emerald-400 font-bold text-xl">
          {formatScore(match.score)}
        </div>
      )}

      {homeOdds && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center gap-1">
              <div className="text-xs text-slate-400 uppercase">Home</div>
              <div className="px-2 py-1 rounded-md border border-slate-700 text-slate-200 text-sm w-full text-center">
                {typeof homeOdds.home === 'number' ? homeOdds.home.toFixed(2) : homeOdds.home}
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="text-xs text-slate-400 uppercase">Draw</div>
              <div className="px-2 py-1 rounded-md border border-slate-700 text-slate-200 text-sm w-full text-center">
                {typeof homeOdds.draw === 'number' ? homeOdds.draw.toFixed(2) : homeOdds.draw}
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="text-xs text-slate-400 uppercase">Away</div>
              <div className="px-2 py-1 rounded-md border border-slate-700 text-slate-200 text-sm w-full text-center">
                {typeof homeOdds.away === 'number' ? homeOdds.away.toFixed(2) : homeOdds.away}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Show premium prediction if available (V2), otherwise show free (V1) */}
      {match.predictions?.premium ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div>
              <span className="text-slate-300 text-sm">
                {getSideName(match.predictions.premium.side)}
              </span>
              <div className="mt-1">
                <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2 py-0.5 text-xs font-medium">
                  Unlock Premium
                </Badge>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm">
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      ) : match.predictions?.free ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div>
              <span className="text-slate-300 text-sm">
                {getSideName(match.predictions.free.side)}
              </span>
              <span className={`block mt-1 font-bold text-lg ${getConfidenceColorClass(match.predictions.free.confidence)}`}>
                {match.predictions.free.confidence}%
              </span>
            </div>
          </div>
          <Button variant="ghost" size="sm">
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </Card>
  )
}

function SkeletonLoader() {
  return (
    <Card className="bg-slate-900/50 border border-slate-700 overflow-hidden">
      <div className="p-4 space-y-3">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 animate-pulse">
            <div className="h-12 w-12 bg-slate-700 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-700 rounded w-3/4" />
              <div className="h-3 bg-slate-700 rounded w-1/2" />
            </div>
            <div className="h-8 w-20 bg-slate-700 rounded" />
            <div className="h-8 w-20 bg-slate-700 rounded" />
            <div className="h-8 w-20 bg-slate-700 rounded" />
          </div>
        ))}
      </div>
    </Card>
  )
}

