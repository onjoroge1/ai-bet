'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Target, 
  TrendingUp, 
  Calendar, 
  MapPin, 
  Trophy, 
  Star, 
  Zap, 
  ArrowRight,
  Loader2,
  LogIn,
  Users,
  Clock,
  BarChart3,
  Eye
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { TeamLogoGenerator, SimpleTeamLogo } from './team-logo-generator'

interface MatchData {
  home_team?: string
  away_team?: string
  league?: string
  date?: string
  venue?: string
}

interface BlogMatchPrediction {
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

export function BlogMatchPredictions() {
  const router = useRouter()
  const [predictions, setPredictions] = useState<BlogMatchPrediction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPredictions()
  }, [])

  const fetchPredictions = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/blog/predictions')
      
      if (!response.ok) {
        throw new Error(`Failed to fetch predictions: ${response.status}`)
      }
      
      const data = await response.json()
      setPredictions(data)
    } catch (error) {
      console.error('Error fetching blog predictions:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch predictions')
    } finally {
      setLoading(false)
    }
  }

  const getMatchStatus = (prediction: BlogMatchPrediction) => {
    const matchDate = prediction.matchData?.date ? new Date(prediction.matchData.date) : null
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
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Very High</Badge>
      case "high":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">High</Badge>
      case "medium":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Medium</Badge>
      case "low":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Low</Badge>
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-400 mx-auto mb-2" />
            <div className="text-slate-400 text-sm">Loading predictions...</div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <div className="text-red-400 text-sm mb-2">Error loading predictions</div>
          <Button onClick={fetchPredictions} variant="outline" size="sm">
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  if (predictions.length === 0) {
    return null
  }

  return (
    <div className="bg-slate-800/30 border-b border-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-emerald-500/20 rounded-lg">
            <Target className="w-6 h-6 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">Upcoming Match Predictions</h2>
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
            LIVE
          </Badge>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {predictions.map((prediction) => {
            const status = getMatchStatus(prediction)
            const matchData = prediction.matchData || {}
            
            return (
              <Card key={prediction.id} className="bg-slate-800/60 border-slate-600/50 backdrop-blur-sm hover:border-slate-500/70 hover:bg-slate-800/70 transition-all duration-200">
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
                      {prediction.confidenceScore && getConfidenceBadge(prediction.confidenceScore)}
                      {prediction.valueRating && getValueRatingBadge(prediction.valueRating)}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Team Logos */}
                  <div className="flex items-center justify-center">
                    <TeamLogoGenerator
                      homeTeam={matchData.home_team || "Home Team"}
                      awayTeam={matchData.away_team || "Away Team"}
                      league={matchData.league}
                      className="w-full max-w-sm"
                    />
                  </div>

                  {/* Match Date */}
                  {matchData.date && (
                    <div className="flex items-center space-x-2 text-slate-400">
                      <Calendar className="h-4 w-4" />
                      <span className="text-sm">{formatMatchDate(matchData.date)}</span>
                    </div>
                  )}

                  {/* Prediction Details */}
                  {prediction.predictionType && (
                    <div className="bg-slate-700/30 rounded-lg p-3">
                      <div className="mb-2">
                        <span className="text-emerald-400 font-medium">Our Prediction</span>
                      </div>
                      <div className="text-white font-semibold mb-1">
                        {prediction.predictionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </div>
                      {prediction.confidenceScore && (
                        <div className="text-slate-400 text-sm">
                          {prediction.confidenceScore}% confidence
                        </div>
                      )}
                    </div>
                  )}

                  {/* Analysis Summary */}
                  {prediction.analysisSummary && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                      <div className="flex items-center mb-2">
                        <TrendingUp className="h-4 w-4 text-emerald-400 mr-2" />
                        <span className="text-emerald-400 font-medium text-sm">Analysis</span>
                      </div>
                      <div className="text-slate-200 text-sm leading-relaxed">
                        {prediction.analysisSummary}
                      </div>
                    </div>
                  )}

                  {/* Price and CTA */}
                  <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-lg p-4">
                    <div className="text-center">
                      <div className="flex items-center justify-center mb-3">
                        <Star className="h-5 w-5 text-emerald-400 mr-2" />
                        <span className="text-emerald-400 font-medium">Premium Prediction</span>
                      </div>
                      <div className="text-white font-semibold mb-2">
                        {prediction.country?.currencySymbol}{prediction.price}
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

        {/* View All CTA */}
        <div className="text-center mt-8">
          <Button 
            asChild
            variant="outline" 
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            <a href="/matches">
              View All Predictions
              <ArrowRight className="w-4 h-4 ml-2" />
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
}

