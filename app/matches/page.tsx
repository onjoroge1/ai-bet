"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, MapPin, Trophy, Target, TrendingUp, Eye, CheckCircle, Loader2, Search, Filter, X, LogIn, Star, Users, Zap } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import { decodeQuickPurchasesData } from "@/lib/optimized-data-decoder"
import { toast } from "sonner"

interface MatchData {
  home_team?: string
  away_team?: string
  league?: string
  date?: string
  venue?: string
}

interface Match {
  id: string
  name: string
  price: number
  originalPrice?: number
  type: string
  matchId?: string
  matchData?: MatchData
  predictionData?: unknown
  predictionType?: string
  confidenceScore?: number
  odds?: number
  valueRating?: string
  analysisSummary?: string
  isActive: boolean
  createdAt: string
  country?: {
    currencyCode: string
    currencySymbol: string
  }
  features?: string[]
  iconName?: string
  colorGradientFrom?: string
  colorGradientTo?: string
  isUrgent?: boolean
  timeLeft?: string
  isPopular?: boolean
  discountPercentage?: number
  tipCount?: number
}

interface MatchFilters {
  search: string
  status: string
  confidence: string
  valueRating: string
  sortBy: string
}

export default function PublicMatchesPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [matches, setMatches] = useState<Match[]>([])
  const [filteredMatches, setFilteredMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<MatchFilters>({
    search: "",
    status: "all",
    confidence: "all",
    valueRating: "all",
    sortBy: "date"
  })

  console.log('PublicMatchesPage render - authLoading:', authLoading, 'isAuthenticated:', isAuthenticated, 'loading:', loading, 'matches count:', matches.length, 'filtered count:', filteredMatches.length, 'error:', error)

  const applyFilters = useCallback((matches: Match[], filters: MatchFilters) => {
    let filtered = [...matches]

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      filtered = filtered.filter(match => {
        const matchData = match.matchData || {}
        const homeTeam = matchData.home_team?.toLowerCase() || ""
        const awayTeam = matchData.away_team?.toLowerCase() || ""
        const league = matchData.league?.toLowerCase() || ""
        const predictionType = match.predictionType?.toLowerCase() || ""
        
        return homeTeam.includes(searchLower) || 
               awayTeam.includes(searchLower) || 
               league.includes(searchLower) ||
               predictionType.includes(searchLower)
      })
    }

    // Status filter
    if (filters.status !== "all") {
      filtered = filtered.filter(match => {
        const status = getMatchStatus(match)
        return status === filters.status
      })
    }

    // Confidence filter
    if (filters.confidence !== "all") {
      filtered = filtered.filter(match => {
        const confidence = match.confidenceScore || 0
        switch (filters.confidence) {
          case "high":
            return confidence >= 80
          case "medium":
            return confidence >= 60 && confidence < 80
          case "low":
            return confidence < 60
          default:
            return true
        }
      })
    }

    // Value rating filter
    if (filters.valueRating !== "all") {
      filtered = filtered.filter(match => {
        const rating = match.valueRating?.toLowerCase() || ""
        return rating === filters.valueRating.toLowerCase()
      })
    }

    // Sort
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case "confidence":
          return (b.confidenceScore || 0) - (a.confidenceScore || 0)
        case "price":
          return a.price - b.price
        case "name":
          const aName = `${a.matchData?.home_team || ""} vs ${a.matchData?.away_team || ""}`
          const bName = `${b.matchData?.home_team || ""} vs ${b.matchData?.away_team || ""}`
          return aName.localeCompare(bName)
        case "date":
        default:
          const aDate = a.matchData?.date ? new Date(a.matchData.date) : new Date(0)
          const bDate = b.matchData?.date ? new Date(b.matchData.date) : new Date(0)
          return aDate.getTime() - bDate.getTime()
      }
    })

    return filtered
  }, [])

  useEffect(() => {
    if (!authLoading) {
      setFilteredMatches(applyFilters(matches, filters))
    }
  }, [matches, filters, applyFilters, authLoading])

  const fetchMatches = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log('Fetching matches from /api/quick-purchases...')
      
      const response = await fetch('/api/quick-purchases')
      console.log('Response status:', response.status)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch matches: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      console.log('Raw API response:', data)
      console.log('Total items received:', data.length)
      
      // Decode the optimized data structure
      const decodedData = decodeQuickPurchasesData(data)
      console.log('Decoded data:', decodedData.length, 'items')
      
      // Filter to only show prediction/tip type items that have match data
      const predictionMatches = (decodedData as Match[]).filter((item) => {
        // Basic filters
        const hasValidType = (item.type === 'prediction' || item.type === 'tip')
        const hasMatchId = !!item.matchId
        const isActive = !!item.isActive
        
        // Filter out completed matches
        const matchDate = item.matchData?.date ? new Date(item.matchData.date) : null
        const isNotCompleted = matchDate ? matchDate > new Date() : false
        
        // Filter out matches with no confidence or zero confidence
        const hasValidConfidence = item.confidenceScore && item.confidenceScore > 0
        
        return hasValidType && hasMatchId && isActive && isNotCompleted && hasValidConfidence
      })
      
      console.log('Filtered prediction matches:', predictionMatches.length)
      console.log('Sample match data:', predictionMatches[0])
      
      setMatches(predictionMatches)
    } catch (error) {
      console.error('Error fetching matches:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch matches')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMatches()
  }, [])

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
        return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Upcoming</Badge>
      case "scheduled":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Scheduled</Badge>
      default:
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">Unknown</Badge>
    }
  }

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 80) {
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">{confidence}%</Badge>
    } else if (confidence >= 60) {
      return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">{confidence}%</Badge>
    } else {
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">{confidence}%</Badge>
    }
  }

  const getValueRatingBadge = (rating: string) => {
    const ratingLower = rating.toLowerCase()
    switch (ratingLower) {
      case "very high":
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Very High Value</Badge>
      case "high":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">High Value</Badge>
      case "medium":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Medium Value</Badge>
      case "low":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Low Value</Badge>
      default:
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">{rating}</Badge>
    }
  }

  const formatMatchDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (date.getTime() - now.getTime()) / (1000 * 60 * 60)
    
    if (diffInHours < 1) {
      const minutes = Math.floor(diffInHours * 60)
      return `In ${minutes} minutes`
    } else if (diffInHours < 24) {
      const hours = Math.floor(diffInHours)
      return `In ${hours} hours`
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }

  const handleLoginClick = () => {
    router.push('/signin?callbackUrl=/dashboard/matches')
  }

  const handleSignUpClick = () => {
    router.push('/signup?callbackUrl=/dashboard/matches')
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-400 mx-auto mb-4" />
            <div className="text-white text-lg font-semibold mb-2">Loading Matches</div>
            <div className="text-slate-400 text-sm">Fetching the latest predictions...</div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-red-400 text-lg font-semibold mb-2">Error Loading Matches</div>
            <div className="text-slate-400 text-sm mb-4">{error}</div>
            <Button onClick={fetchMatches} variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-white mb-4">
          AI-Powered Sports Predictions
        </h1>
        <p className="text-xl text-slate-300 mb-6 max-w-3xl mx-auto">
          Discover upcoming matches with our advanced AI predictions. See confidence scores, 
          analysis, and value ratings - all powered by machine learning.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            onClick={handleSignUpClick}
            size="lg"
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3"
          >
            <Zap className="h-5 w-5 mr-2" />
            Get Started Free
          </Button>
          <Button 
            onClick={handleLoginClick}
            variant="outline"
            size="lg"
            className="border-slate-600 text-white hover:bg-slate-800 px-8 py-3"
          >
            <LogIn className="h-5 w-5 mr-2" />
            Sign In
          </Button>
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        <Card className="bg-slate-800/60 border-slate-600/50 backdrop-blur-sm p-6 text-center">
          <div className="text-3xl font-bold text-emerald-400 mb-2">{filteredMatches.length}</div>
          <div className="text-slate-400">Available Predictions</div>
        </Card>
        <Card className="bg-slate-800/60 border-slate-600/50 backdrop-blur-sm p-6 text-center">
          <div className="text-3xl font-bold text-blue-400 mb-2">
            {filteredMatches.filter(m => (m.confidenceScore || 0) >= 80).length}
          </div>
          <div className="text-slate-400">High Confidence (80%+)</div>
        </Card>
        <Card className="bg-slate-800/60 border-slate-600/50 backdrop-blur-sm p-6 text-center">
          <div className="text-3xl font-bold text-orange-400 mb-2">
            {filteredMatches.filter(m => getMatchStatus(m) === "upcoming").length}
          </div>
          <div className="text-slate-400">Starting Soon</div>
        </Card>
        <Card className="bg-slate-800/60 border-slate-600/50 backdrop-blur-sm p-6 text-center">
          <div className="text-3xl font-bold text-purple-400 mb-2">
            {filteredMatches.filter(m => m.valueRating?.toLowerCase() === "very high").length}
          </div>
          <div className="text-slate-400">Very High Value</div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-slate-800/60 border-slate-600/50 backdrop-blur-sm p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search matches..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="pl-10"
            />
          </div>
          
          <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="upcoming">Upcoming (Next 2 hours)</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.confidence} onValueChange={(value) => setFilters({ ...filters, confidence: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Confidence" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Confidence</SelectItem>
              <SelectItem value="high">80%+ Confidence</SelectItem>
              <SelectItem value="medium">60-79% Confidence</SelectItem>
              <SelectItem value="low">&lt;60% Confidence</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.valueRating} onValueChange={(value) => setFilters({ ...filters, valueRating: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Value Rating" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ratings</SelectItem>
              <SelectItem value="very high">Very High</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.sortBy} onValueChange={(value) => setFilters({ ...filters, sortBy: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="confidence">Confidence</SelectItem>
              <SelectItem value="price">Price</SelectItem>
              <SelectItem value="name">Name</SelectItem>
            </SelectContent>
          </Select>

          <Button 
            variant="outline" 
            onClick={() => setFilters({
              search: "",
              status: "all",
              confidence: "all",
              valueRating: "all",
              sortBy: "date"
            })}
          >
            <Filter className="h-4 w-4 mr-2" />
            Clear
          </Button>
        </div>
      </Card>

      {/* Matches Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredMatches.map((match) => {
          const status = getMatchStatus(match)
          const matchData = match.matchData || {}
          
          return (
            <Card key={match.id} className="bg-slate-800/60 border-slate-600/50 backdrop-blur-sm hover:border-slate-500/70 hover:bg-slate-800/70 transition-all duration-200">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-white text-lg mb-2">
                      {matchData.home_team || "Home Team"} vs {matchData.away_team || "Away Team"}
                    </CardTitle>
                    <div className="flex items-center space-x-2 mb-2">
                      <Trophy className="h-4 w-4 text-slate-400" />
                      <span className="text-slate-400 text-sm">{matchData.league || "Unknown League"}</span>
                    </div>
                    {matchData.venue && (
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-4 w-4 text-slate-400" />
                        <span className="text-slate-400 text-sm">{matchData.venue}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end space-y-2">
                    {getStatusBadge(status)}
                    {match.confidenceScore && getConfidenceBadge(match.confidenceScore)}
                    {match.valueRating && getValueRatingBadge(match.valueRating)}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Match Date */}
                {matchData.date && (
                  <div className="flex items-center space-x-2 text-slate-400">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm">{formatMatchDate(matchData.date)}</span>
                  </div>
                )}

                {/* Prediction Details */}
                {match.predictionType && (
                  <div className="bg-slate-700/30 rounded-lg p-3">
                    <div className="mb-2">
                      <span className="text-emerald-400 font-medium">Our Prediction</span>
                    </div>
                    <div className="text-white font-semibold mb-1">
                      {match.predictionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </div>
                    {match.confidenceScore && (
                      <div className="text-slate-400 text-sm">
                        {match.confidenceScore}% confidence
                      </div>
                    )}
                  </div>
                )}

                {/* Analysis Summary */}
                {match.analysisSummary && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                    <div className="flex items-center mb-2">
                      <TrendingUp className="h-4 w-4 text-emerald-400 mr-2" />
                      <span className="text-emerald-400 font-medium text-sm">Analysis</span>
                    </div>
                    <div className="text-slate-200 text-sm leading-relaxed">
                      {match.analysisSummary}
                    </div>
                  </div>
                )}

                {/* Login CTA */}
                <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-lg p-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-3">
                      <Star className="h-5 w-5 text-emerald-400 mr-2" />
                      <span className="text-emerald-400 font-medium">Premium Prediction</span>
                    </div>
                    <div className="text-white font-semibold mb-2">
                      {match.country?.currencySymbol}{match.price}
                    </div>
                    <div className="text-slate-400 text-sm mb-4">
                      Get full access to this prediction and analysis
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button 
                        onClick={handleLoginClick}
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 flex-1"
                      >
                        <LogIn className="h-4 w-4 mr-1" />
                        Login to Purchase
                      </Button>
                      <Button 
                        onClick={handleSignUpClick}
                        variant="outline"
                        size="sm"
                        className="border-slate-600 text-white hover:bg-slate-800 flex-1"
                      >
                        <Users className="h-4 w-4 mr-1" />
                        Sign Up
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Empty State */}
      {filteredMatches.length === 0 && !loading && (
        <Card className="bg-slate-800/60 border-slate-600/50 backdrop-blur-sm p-12">
          <div className="text-center">
            <Target className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No matches found</h3>
            <p className="text-slate-400 mb-4">
              Try adjusting your filters or search terms
            </p>
            <Button 
              variant="outline" 
              onClick={() => setFilters({
                search: "",
                status: "all",
                confidence: "all",
                valueRating: "all",
                sortBy: "date"
              })}
            >
              Clear all filters
            </Button>
          </div>
        </Card>
      )}

      {/* Bottom CTA */}
      <div className="mt-16 text-center">
        <Card className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 p-8">
          <h2 className="text-2xl font-bold text-white mb-4">
            Ready to Start Winning?
          </h2>
          <p className="text-slate-300 mb-6 max-w-2xl mx-auto">
            Join thousands of successful bettors who trust our AI predictions. 
            Get access to premium analysis, confidence scores, and value ratings.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={handleSignUpClick}
              size="lg"
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3"
            >
              <Zap className="h-5 w-5 mr-2" />
              Start Free Trial
            </Button>
            <Button 
              onClick={handleLoginClick}
              variant="outline"
              size="lg"
              className="border-slate-600 text-white hover:bg-slate-800 px-8 py-3"
            >
              <LogIn className="h-5 w-5 mr-2" />
              Already have an account?
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
