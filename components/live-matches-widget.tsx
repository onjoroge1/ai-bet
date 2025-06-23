"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Play, Clock, CheckCircle, XCircle, TrendingUp, Target, Calendar, Trophy, MapPin, Loader2 } from "lucide-react"
import Link from "next/link"

interface Match {
  id: string
  name: string
  price: number
  originalPrice?: number
  description: string
  type: string
  matchId?: string
  matchData?: any
  predictionData?: any
  predictionType?: string
  confidenceScore?: number
  odds?: number
  valueRating?: string
  analysisSummary?: string
  isPredictionActive: boolean
  createdAt: string
  country: {
    currencyCode: string
    currencySymbol: string
  }
}

export function LiveMatchesWidget() {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMatches()
  }, [])

  const fetchMatches = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/quick-purchases')
      if (!response.ok) {
        throw new Error('Failed to fetch matches')
      }
      const data = await response.json()
      
      // Filter to only show prediction/tip type items that have match data
      const predictionMatches = data.filter((item: Match) => 
        (item.type === 'prediction' || item.type === 'tip') && 
        item.matchId && 
        item.isPredictionActive
      )
      
      // Filter to only upcoming matches (not completed)
      const upcomingMatches = predictionMatches.filter((match: Match) => {
        const matchDate = match.matchData?.date ? new Date(match.matchData.date) : null
        if (!matchDate) return false
        return matchDate > new Date()
      })
      
      // Sort by confidence score (highest first) and take top 3
      const topMatches = upcomingMatches
        .sort((a: Match, b: Match) => (b.confidenceScore || 0) - (a.confidenceScore || 0))
        .slice(0, 3)
      
      setMatches(topMatches)
    } catch (error) {
      console.error('Error fetching matches:', error)
    } finally {
      setLoading(false)
    }
  }

  const getMatchStatus = (match: Match) => {
    const matchDate = match.matchData?.date ? new Date(match.matchData.date) : null
    if (!matchDate) return "unknown"
    
    const now = new Date()
    const timeDiff = matchDate.getTime() - now.getTime()
    const hoursDiff = timeDiff / (1000 * 60 * 60)
    
    if (hoursDiff <= 2) return "upcoming"
    return "scheduled"
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "upcoming":
        return (
          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
            <Clock className="w-3 h-3 mr-1" />
            Soon
          </Badge>
        )
      case "scheduled":
        return (
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
            <Calendar className="w-3 h-3 mr-1" />
            Scheduled
          </Badge>
        )
      default:
        return (
          <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
            Unknown
          </Badge>
        )
    }
  }

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 80) {
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">High</Badge>
    } else if (confidence >= 60) {
      return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">Medium</Badge>
    } else {
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">Low</Badge>
    }
  }

  const formatMatchDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const timeDiff = date.getTime() - now.getTime()
    const hoursDiff = timeDiff / (1000 * 60 * 60)
    
    if (hoursDiff < 24) {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      })
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
      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-700 rounded w-1/2"></div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-700 rounded"></div>
          ))}
        </div>
      </Card>
    )
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Target className="w-5 h-5 text-emerald-400" />
          <h3 className="text-lg font-semibold text-white">Top 3 Predictions</h3>
        </div>
        <Link href="/dashboard/matches">
          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
            View All
          </Button>
        </Link>
      </div>

      <div className="space-y-4 max-h-80 overflow-y-auto">
        {matches.length === 0 ? (
          <div className="text-center py-8">
            <Target className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">No upcoming matches</p>
          </div>
        ) : (
          matches.map((match) => {
            const status = getMatchStatus(match)
            const matchData = match.matchData || {}
            
            return (
              <div key={match.id} className="p-4 bg-slate-700/30 rounded-lg border border-slate-600 hover:border-slate-500 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Trophy className="h-3 w-3 text-slate-400" />
                    <span className="text-xs text-slate-400">{matchData.league || "Unknown League"}</span>
                  </div>
                  {getStatusBadge(status)}
                </div>

                <div className="flex items-center justify-between mb-3">
                  <div className="flex-1">
                    <div className="text-white text-sm font-medium">{matchData.home_team || "Home Team"}</div>
                    <div className="text-white text-sm font-medium">{matchData.away_team || "Away Team"}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-slate-400">
                      {matchData.date && formatMatchDate(matchData.date)}
                    </div>
                  </div>
                </div>

                {match.predictionType && (
                  <div className="flex items-center justify-between p-2 bg-slate-600/30 rounded">
                    <div className="flex items-center space-x-2">
                      <div>
                        <div className="text-xs text-white font-medium">
                          {match.predictionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </div>
                        <div className="text-xs text-slate-400">
                          {match.confidenceScore}% confidence
                          {match.odds && ` • ${match.odds}x`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {match.confidenceScore && getConfidenceBadge(match.confidenceScore)}
                      <div className="text-xs text-emerald-400 font-medium">
                        {match.country.currencySymbol}{match.price}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </Card>
  )
}
