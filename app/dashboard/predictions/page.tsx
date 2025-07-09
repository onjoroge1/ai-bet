"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Target, 
  Eye,
  Calendar,
  Trophy,
  DollarSign,
  Star,
  Filter,
  Search,
  ArrowLeft,
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

// Fetch timeline data with filters
const fetchTimelineData = async (filters: any): Promise<TimelineItem[]> => {
  const params = new URLSearchParams()
  if (filters.limit) params.append('limit', filters.limit.toString())
  if (filters.status && filters.status !== 'all') params.append('status', filters.status)
  if (filters.dateFrom) params.append('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.append('dateTo', filters.dateTo)
  
  const response = await fetch(`/api/predictions/timeline?${params.toString()}`)
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

export default function PredictionsPage() {
  const [filters, setFilters] = useState({
    limit: 50,
    status: 'all',
    dateFrom: '',
    dateTo: '',
    search: ''
  })
  
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  
  const { data: timelineData = [], isLoading, error, refetch } = useQuery({
    queryKey: ['timeline', filters],
    queryFn: () => fetchTimelineData(filters),
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  // Filter data based on search
  const filteredData = timelineData.filter(item => {
    if (!filters.search) return true
    
    const searchTerm = filters.search.toLowerCase()
    return (
      item.match.homeTeam.name.toLowerCase().includes(searchTerm) ||
      item.match.awayTeam.name.toLowerCase().includes(searchTerm) ||
      item.match.league.name.toLowerCase().includes(searchTerm) ||
      item.prediction.type.toLowerCase().includes(searchTerm)
    )
  })

  // Filter data based on status
  const statusFilteredData = filteredData.filter(item => {
    if (filters.status === 'all') return true
    return item.timelineStatus === filters.status
  })

  // Calculate statistics
  const stats = {
    total: statusFilteredData.length,
    won: statusFilteredData.filter(item => item.timelineStatus === 'won').length,
    lost: statusFilteredData.filter(item => item.timelineStatus === 'lost').length,
    pending: statusFilteredData.filter(item => item.timelineStatus === 'pending').length,
    upcoming: statusFilteredData.filter(item => item.timelineStatus === 'upcoming').length,
    totalProfit: statusFilteredData.reduce((sum, item) => {
      return sum + (item.userPrediction?.profit || 0)
    }, 0)
  }

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
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center space-x-4 mb-8">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-white">All Predictions</h1>
        </div>
        <div className="text-center text-slate-400 py-8">Loading predictions...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center space-x-4 mb-8">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-white">All Predictions</h1>
        </div>
        <div className="text-center text-red-400">
          Failed to load predictions.
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => refetch()}
            className="ml-2"
          >
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center space-x-4 mb-8">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">All Predictions</h1>
          <p className="text-slate-400">Track all your prediction history and performance</p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
        <Card className="bg-slate-800/50 border-slate-700 p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-sm text-slate-400">Total</div>
          </div>
        </Card>
        <Card className="bg-emerald-500/20 border-emerald-500/30 p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-400">{stats.won}</div>
            <div className="text-sm text-emerald-300">Won</div>
          </div>
        </Card>
        <Card className="bg-red-500/20 border-red-500/30 p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">{stats.lost}</div>
            <div className="text-sm text-red-300">Lost</div>
          </div>
        </Card>
        <Card className="bg-yellow-500/20 border-yellow-500/30 p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
            <div className="text-sm text-yellow-300">Pending</div>
          </div>
        </Card>
        <Card className="bg-blue-500/20 border-blue-500/30 p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">{stats.upcoming}</div>
            <div className="text-sm text-blue-300">Upcoming</div>
          </div>
        </Card>
        <Card className="bg-purple-500/20 border-purple-500/30 p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">
              ${stats.totalProfit > 0 ? '+' : ''}{stats.totalProfit.toFixed(2)}
            </div>
            <div className="text-sm text-purple-300">Total Profit</div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-slate-800/50 border-slate-700 p-6 mb-8">
        <div className="flex items-center space-x-2 mb-4">
          <Filter className="w-5 h-5 text-slate-400" />
          <h2 className="text-lg font-semibold text-white">Filters</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search teams, leagues..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="pl-10 bg-slate-700/50 border-slate-600 text-white"
            />
          </div>
          <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
            <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="won">Won</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            placeholder="From Date"
            value={filters.dateFrom}
            onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
            className="bg-slate-700/50 border-slate-600 text-white"
          />
          <Input
            type="date"
            placeholder="To Date"
            value={filters.dateTo}
            onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
            className="bg-slate-700/50 border-slate-600 text-white"
          />
          <Select value={filters.limit.toString()} onValueChange={(value) => setFilters(prev => ({ ...prev, limit: parseInt(value) }))}>
            <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="20">20 items</SelectItem>
              <SelectItem value="50">50 items</SelectItem>
              <SelectItem value="100">100 items</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Predictions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statusFilteredData.length === 0 && (
          <div className="col-span-full text-center text-slate-400 py-8">
            No predictions found for the selected filters.
          </div>
        )}
        
        {statusFilteredData.map((item, index) => {
          const status = getStatusConfig(item.timelineStatus)
          const StatusIcon = status.icon
          
          return (
            <Card
              key={item.id}
              className={`bg-slate-900/50 border transition-all duration-300 hover:bg-slate-900/70 hover:border-slate-600 hover:scale-[1.02] ${
                hoveredItem === item.id 
                  ? 'bg-slate-900/70 border-slate-600 scale-[1.02]' 
                  : 'border-slate-700'
              }`}
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <div className="p-4">
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

                {/* Prediction details */}
                <div className="bg-slate-800/30 rounded-lg p-3 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-emerald-400 font-medium text-xs">Prediction</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-300 text-xs">@{item.prediction.odds}</span>
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                        {item.prediction.confidence}%
                      </Badge>
                    </div>
                  </div>
                  <div className="text-white font-semibold text-sm">
                    {item.prediction.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </div>
                  {item.prediction.valueRating && (
                    <div className="text-slate-400 text-xs mt-1">
                      Value Rating: {item.prediction.valueRating}
                    </div>
                  )}
                </div>

                {/* User prediction details */}
                {item.userPrediction && (
                  <div className="bg-blue-500/10 rounded-lg p-3 mb-3 border border-blue-500/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <DollarSign className="w-4 h-4 text-blue-400" />
                        <span className="text-blue-400 font-medium text-xs">Your Bet</span>
                      </div>
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
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {item.prediction.isFree && (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                        Free
                      </Badge>
                    )}
                    {item.prediction.explanation && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-400 hover:text-white p-1"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    )}
                    <Link href={`/dashboard/matches?matchId=${item.match.id}`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-400 hover:text-white p-1"
                        title="View match details"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {/* Claim Tip Button or View Tip Button */}
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
                        <Trophy className="w-4 h-4" />
                        <span className="text-xs font-medium">Winner!</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
