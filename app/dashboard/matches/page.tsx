"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, MapPin, Trophy, Target, TrendingUp, Eye, CheckCircle, Loader2, Search, Filter, X, CreditCard } from "lucide-react"
import { useRouter } from "next/navigation"
import { decodeQuickPurchasesData } from "@/lib/optimized-data-decoder"
import { QuickPurchaseModal } from "@/components/quick-purchase-modal"
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

// Add QuickPurchaseItem type for modal (matches QuickPurchaseModal interface)
interface QuickPurchaseItem {
  id: string
  name: string
  price: number
  originalPrice?: number
  description: string
  features: string[]
  type: "prediction" | "tip" | "package" | "vip"
  iconName: string
  colorGradientFrom: string
  colorGradientTo: string
  isUrgent?: boolean
  timeLeft?: string
  isPopular?: boolean
  discountPercentage?: number
  confidenceScore?: number
  matchData?: {
    home_team: string
    away_team: string
    league: string
    date: string
  }
  country?: {
    currencyCode: string
    currencySymbol: string
  }
  tipCount?: number
  predictionType?: string
  odds?: number
  valueRating?: string
  analysisSummary?: string
}

/**
 * MatchesPage - Server-Side First Authentication
 * 
 * 🔥 NEW ARCHITECTURE: Uses /api/auth/session as primary source of truth
 * - Checks server-side session directly (no waiting for useSession() sync)
 * - Fast and reliable authentication decisions
 * - No blocking on client-side auth sync
 */
export default function MatchesPage() {
  const router = useRouter()
  const [matches, setMatches] = useState<Match[]>([])
  const [filteredMatches, setFilteredMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
  const [modalItem, setModalItem] = useState<QuickPurchaseItem | null>(null)
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false) // Server-side auth state
  const [filters, setFilters] = useState<MatchFilters>({
    search: "",
    status: "all",
    confidence: "all",
    valueRating: "all",
    sortBy: "date"
  })

  // 🔥 NEW: Check server-side session on mount (fast, non-blocking)
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/session', {
          cache: 'no-store',
          credentials: 'include',
        })
        const session = await res.json()
        const serverIsAuthenticated = !!session?.user
        setIsAuthenticated(serverIsAuthenticated)
        
        if (!serverIsAuthenticated) {
          router.push('/matches')
          return
        }
        
        // Fetch matches immediately if authenticated
        fetchMatches()
      } catch (error) {
        console.error('[MatchesPage] Auth check error:', error)
        setIsAuthenticated(false)
        router.push('/matches')
      }
    }
    checkAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]) // Only check on mount

  const applyFilters = useCallback(() => {
    let filtered = [...matches]

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      filtered = filtered.filter(match => 
        match.name.toLowerCase().includes(searchLower) ||
        (match.matchData?.home_team && match.matchData.home_team.toLowerCase().includes(searchLower)) ||
        (match.matchData?.away_team && match.matchData.away_team.toLowerCase().includes(searchLower)) ||
        (match.matchData?.league && match.matchData.league.toLowerCase().includes(searchLower))
      )
    }

    // Status filter (upcoming, scheduled)
    if (filters.status !== "all") {
      filtered = filtered.filter(match => {
        const matchDate = match.matchData?.date ? new Date(match.matchData.date) : null
        const now = new Date()
        
        if (filters.status === "upcoming") {
          // Show matches starting within next 2 hours
          const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000)
          return matchDate && matchDate > now && matchDate <= twoHoursFromNow
        } else if (filters.status === "scheduled") {
          // Show matches scheduled for later (more than 2 hours away)
          const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000)
          return matchDate && matchDate > twoHoursFromNow
        }
        return true
      })
    }

    // Confidence filter
    if (filters.confidence !== "all") {
      filtered = filtered.filter(match => {
        const confidence = match.confidenceScore || 0
        switch (filters.confidence) {
          case "high": return confidence >= 80
          case "medium": return confidence >= 60 && confidence < 80
          case "low": return confidence < 60
          default: return true
        }
      })
    }

    // Value rating filter
    if (filters.valueRating !== "all") {
      filtered = filtered.filter(match => 
        match.valueRating?.toLowerCase() === filters.valueRating
      )
    }

    // Sort
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case "confidence":
          return (b.confidenceScore || 0) - (a.confidenceScore || 0)
        case "date":
          const dateA = a.matchData?.date ? new Date(a.matchData.date) : new Date(0)
          const dateB = b.matchData?.date ? new Date(b.matchData.date) : new Date(0)
          return dateA.getTime() - dateB.getTime()
        case "price":
          return a.price - b.price
        case "name":
          return a.name.localeCompare(b.name)
        default:
          return 0
      }
    })

    setFilteredMatches(filtered)
  }, [matches, filters])

  // 🔥 REMOVED: No longer blocking on isAuthenticated from useAuth()
  // Matches are fetched immediately after server-side auth check

  useEffect(() => {
    console.log('MatchesPage useEffect - applying filters')
    applyFilters()
  }, [matches, filters, applyFilters])

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showPurchaseModal) {
        setShowPurchaseModal(false)
        setSelectedMatch(null)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [showPurchaseModal])

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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setError(errorMessage)
      // Set empty array to prevent infinite loading
      setMatches([])
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
    
    // Since we filter out completed matches, we only have upcoming and scheduled
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
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">Unknown</Badge>
    }
  }

  const getConfidenceBadge = (confidence: number) => {
    let colorClass = 'bg-red-500/20 text-red-400 border-red-500/30'
    if (confidence >= 80) {
      colorClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    } else if (confidence >= 60) {
      colorClass = 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    }
    
    return (
      <Badge className={colorClass}>
        {confidence}%
      </Badge>
    )
  }

  const getValueRatingBadge = (rating: string) => {
    switch (rating?.toLowerCase()) {
      case "very high":
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Very High</Badge>
      case "high":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">High</Badge>
      case "medium":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Medium</Badge>
      case "low":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Low</Badge>
      default:
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">Unknown</Badge>
    }
  }

  const formatMatchDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handlePurchaseClick = (match: Match) => {
    const quickPurchaseItem: QuickPurchaseItem = {
      id: match.id,
      name: match.name,
      price: match.price,
      originalPrice: match.originalPrice,
      description: match.analysisSummary || `AI prediction for ${match.name}`,
      features: match.features || ['AI Analysis', 'Match Statistics', 'Risk Assessment'],
      type: (match.type as "prediction" | "tip" | "package" | "vip"),
      iconName: match.iconName || 'Star',
      colorGradientFrom: match.colorGradientFrom || '#3B82F6',
      colorGradientTo: match.colorGradientTo || '#1D4ED8',
      isUrgent: match.isUrgent || false,
      timeLeft: match.timeLeft,
      isPopular: match.isPopular || false,
      discountPercentage: match.discountPercentage,
      confidenceScore: match.confidenceScore,
      matchData: match.matchData ? {
        home_team: match.matchData.home_team || '',
        away_team: match.matchData.away_team || '',
        league: match.matchData.league || '',
        date: match.matchData.date || new Date().toISOString()
      } : undefined,
      country: match.country,
      tipCount: match.tipCount,
      predictionType: match.predictionType,
      odds: match.odds,
      valueRating: match.valueRating,
      analysisSummary: match.analysisSummary
    }
    setModalItem(quickPurchaseItem)
    setShowPurchaseModal(true)
  }

  // 🔥 REMOVED: No longer blocking on authLoading
  // Server-side auth check happens on mount, page loads immediately

  if (!isAuthenticated) {
    console.log('MatchesPage - not authenticated, showing auth required state')
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-red-400 text-lg font-semibold mb-2">Authentication Required</div>
            <div className="text-slate-400 text-sm mb-4">You need to be logged in to view this page.</div>
            <Button onClick={() => window.location.href = '/signin'} variant="outline">
              Go to Sign In
            </Button>
          </div>
        </div>
      </div>
    )
  }

  console.log('MatchesPage - authenticated, proceeding with normal render')

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
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
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Upcoming Matches</h1>
        <p className="text-slate-400">
          Browse and filter through upcoming match predictions with confidence scores
        </p>
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

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-slate-800/60 border-slate-600/50 backdrop-blur-sm p-4 hover:bg-slate-800/70 transition-colors">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{filteredMatches.length}</div>
            <div className="text-slate-400 text-sm">Total Matches</div>
          </div>
        </Card>
        <Card className="bg-slate-800/60 border-slate-600/50 backdrop-blur-sm p-4 hover:bg-slate-800/70 transition-colors">
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-400">
              {filteredMatches.filter(m => (m.confidenceScore || 0) >= 80).length}
            </div>
            <div className="text-slate-400 text-sm">80%+ Confidence</div>
          </div>
        </Card>
        <Card className="bg-slate-800/60 border-slate-600/50 backdrop-blur-sm p-4 hover:bg-slate-800/70 transition-colors">
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-400">
              {filteredMatches.filter(m => getMatchStatus(m) === "upcoming").length}
            </div>
            <div className="text-slate-400 text-sm">Upcoming</div>
          </div>
        </Card>
        <Card className="bg-slate-800/60 border-slate-600/50 backdrop-blur-sm p-4 hover:bg-slate-800/70 transition-colors">
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">
              {filteredMatches.filter(m => m.valueRating?.toLowerCase() === "very high").length}
            </div>
            <div className="text-slate-400 text-sm">Very High Value</div>
          </div>
        </Card>
      </div>

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

                {/* Price and Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-700">
                  <div className="flex items-center space-x-2">
                    <span className="text-white font-bold">
                      {match.country?.currencySymbol}{match.price}
                    </span>
                    {match.originalPrice && match.originalPrice > match.price && (
                      <span className="text-slate-400 line-through text-sm">
                        {match.country?.currencySymbol}{match.originalPrice}
                      </span>
                    )}
                  </div>
                  <Button 
                    size="sm" 
                    onClick={() => handlePurchaseClick(match)}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Target className="h-4 w-4 mr-1" />
                    Purchase
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Purchase Modal */}
      {showPurchaseModal && modalItem && (
        <QuickPurchaseModal
          isOpen={showPurchaseModal}
          onClose={() => {
            setShowPurchaseModal(false)
            setModalItem(null)
          }}
          item={modalItem}
        />
      )}

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
    </div>
  )
} 