"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Target, 
  TrendingUp, 
  TrendingDown,
  Eye,
  Calendar,
  Trophy,
  DollarSign,
  Star,
  ExternalLink
} from "lucide-react"
import Link from "next/link"
import { ClaimTipButton } from "@/components/ui/ClaimTipButton"

// Types
type TimelineItem = {
  id: string
  match: {
    id: string
    homeTeam: { id: string; name: string }
    awayTeam: { id: string; name: string }
    league: { id: string; name: string }
    matchDate: string
    status: string
    homeScore?: number
    awayScore?: number
  }
  prediction: {
    type: string
    odds: number
    confidence: number
    valueRating: string
    explanation?: string
    isFree: boolean
    status: string
    resultUpdatedAt?: string
  }
  userPrediction?: {
    id: string
    status: string
    amount: number
    potentialReturn: number
    profit?: number
    placedAt: string
  } | null
  timelineStatus: 'won' | 'lost' | 'pending' | 'upcoming'
  createdAt: string
}

// Fetch timeline data
const fetchTimelineData = async (): Promise<TimelineItem[]> => {
  const response = await fetch('/api/predictions/timeline?limit=4')
  if (!response.ok) {
    throw new Error('Failed to fetch timeline data')
  }
  return response.json()
}

// Status configuration
const statusConfig = {
  won: {
    icon: CheckCircle,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/20",
    borderColor: "border-emerald-500/30",
    label: "Won",
    emoji: "🏆"
  },
  lost: {
    icon: XCircle,
    color: "text-red-400",
    bgColor: "bg-red-500/20",
    borderColor: "border-red-500/30",
    label: "Lost",
    emoji: "❌"
  },
  pending: {
    icon: Clock,
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/20",
    borderColor: "border-yellow-500/30",
    label: "Pending",
    emoji: "⏳"
  },
  upcoming: {
    icon: Target,
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
    borderColor: "border-blue-500/30",
    label: "Upcoming",
    emoji: "🎯"
  }
}

export function TimelineFeed() {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  
  const { data: timelineData = [], isLoading, error, refetch } = useQuery({
    queryKey: ['timeline'],
    queryFn: fetchTimelineData,
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  // Filter data based on selected status
  const filteredData = selectedStatus === 'all' 
    ? timelineData 
    : timelineData.filter(item => item.timelineStatus === selectedStatus)

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 1) return 'Today'
    if (diffDays === 2) return 'Yesterday'
    if (diffDays <= 7) return `${diffDays - 1} days ago`
    return date.toLocaleDateString()
  }

  // Format match time
  const formatMatchTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // Get status configuration
  const getStatusConfig = (status: string) => {
    return statusConfig[status as keyof typeof statusConfig] || statusConfig.upcoming
  }

  if (isLoading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <div className="flex items-center space-x-2 mb-6">
          <h2 className="text-xl font-semibold text-white">Recent Predictions</h2>
          <Star className="w-5 h-5 text-yellow-400 animate-pulse" />
        </div>
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-slate-700/50 rounded-lg p-4 animate-pulse">
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1">
                  <div className="h-4 bg-slate-600 rounded mb-2 w-3/4"></div>
                  <div className="h-3 bg-slate-600 rounded w-1/2"></div>
                </div>
                <div className="h-6 w-16 bg-slate-600 rounded"></div>
              </div>
              <div className="flex items-center justify-between">
                <div className="h-4 bg-slate-600 rounded w-1/3"></div>
                <div className="h-4 bg-slate-600 rounded w-16"></div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <div className="text-center text-red-400">
          Failed to load timeline data.
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => refetch()}
            className="ml-2"
          >
            Retry
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700 p-6 relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <h2 className="text-xl font-semibold text-white">Recent Predictions</h2>
          <Star className="w-5 h-5 text-yellow-400 animate-pulse" />
        </div>
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-300 hover:text-white hover:scale-105 transition-transform"
            onClick={() => window.location.href = '/dashboard/predictions'}
          >
            View All Predictions
          </Button>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-4">
        {filteredData.length === 0 && (
          <div className="text-center text-slate-400 py-8">
            No predictions found for the selected filter.
          </div>
        )}
        
        {filteredData.map((item, index) => {
          const status = getStatusConfig(item.timelineStatus)
          const StatusIcon = status.icon
          
          return (
            <div
              key={item.id}
              className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 hover:bg-slate-900/70 hover:border-slate-600 transition-all duration-300"
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="text-white font-medium text-sm">
                      {item.match.homeTeam.name} vs {item.match.awayTeam.name}
                    </h3>
                    {item.match.homeScore !== undefined && item.match.awayScore !== undefined && (
                      <Badge variant="outline" className="text-xs">
                        {item.match.homeScore} - {item.match.awayScore}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center space-x-4 text-slate-400 text-xs">
                    <span>{item.match.league.name}</span>
                    <span>•</span>
                    <span>{formatDate(item.match.matchDate)}</span>
                    <span>•</span>
                    <span>{formatMatchTime(item.match.matchDate)}</span>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <StatusIcon className={`w-4 h-4 ${status.color}`} />
                  <Badge className={`${status.bgColor} ${status.color} ${status.borderColor} text-xs`}>
                    {status.emoji} {status.label}
                  </Badge>
                </div>
              </div>

              {/* Prediction and Bet Details */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="text-emerald-400 font-medium text-sm">
                    {item.prediction.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </div>
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="text-slate-300">@{item.prediction.odds}</span>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                      {item.prediction.confidence}%
                    </Badge>
                  </div>
                </div>

                {/* User Bet Info */}
                {item.userPrediction && (
                  <div className="text-right">
                    <div className="text-white font-medium text-sm">
                      ${item.userPrediction.amount}
                    </div>
                    {item.userPrediction.profit !== undefined && (
                      <div className={`text-xs font-medium ${
                        item.userPrediction.profit > 0 
                          ? 'text-emerald-400' 
                          : item.userPrediction.profit < 0 
                            ? 'text-red-400' 
                            : 'text-slate-400'
                      }`}>
                        {item.userPrediction.profit > 0 ? '+' : ''}${item.userPrediction.profit}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700">
                <div className="flex items-center space-x-2">
                  {item.prediction.isFree && (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                      Free
                    </Badge>
                  )}
                  <Link href={`/dashboard/matches?matchId=${item.match.id}`}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-slate-400 hover:text-white p-1 h-6"
                      title="View match details"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </Link>
                </div>
                
                <div className="flex items-center space-x-2">
                  {/* Claim Tip Button - only show for non-free tips */}
                  {!item.prediction.isFree && (
                    <ClaimTipButton
                      predictionId={item.id}
                      predictionType={item.prediction.type}
                      odds={item.prediction.odds}
                      confidenceScore={item.prediction.confidence}
                      valueRating={item.prediction.valueRating}
                      matchDetails={{
                        homeTeam: item.match.homeTeam.name,
                        awayTeam: item.match.awayTeam.name,
                        league: item.match.league.name,
                        matchDate: item.match.matchDate
                      }}
                      className="text-xs"
                      onClaimSuccess={(data) => {
                        // Refresh the data after successful claim
                        refetch();
                      }}
                    />
                  )}
                  
                  {item.timelineStatus === 'won' && (
                    <div className="flex items-center space-x-1 text-emerald-400">
                      <Trophy className="w-3 h-3" />
                      <span className="text-xs font-medium">Winner!</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
} 