"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Calendar, Trophy, Target, TrendingUp, Star, Clock, CheckCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useUserCountry } from "@/contexts/user-country-context"

interface Tip {
  id: string
  purchaseDate: string
  amount: number
  paymentMethod: string
  homeTeam: string
  awayTeam: string
  matchDate: string | null
  venue: string | null
  league: string | null
  matchStatus: string | null
  predictionType: string | null
  confidenceScore: number | null
  odds: number | null
  valueRating: string | null
  analysisSummary: string | null
  name: string
  type: string
  price: number
  description: string
  features: string[]
  isUrgent: boolean
  timeLeft: string | null
  currencySymbol: string
  currencyCode: string
  predictionData: any | null
}

export function MyTipsOverview() {
  const [tips, setTips] = useState<Tip[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const { convertPrice } = useUserCountry()

  useEffect(() => {
    fetchMyTips()
  }, [])

  const fetchMyTips = async () => {
    try {
      const response = await fetch("/api/my-tips")
      if (!response.ok) throw new Error("Failed to fetch tips")
      const data = await response.json()
      
      // Take only the first 3 tips for the overview
      const topTips = data.slice(0, 3)
      setTips(topTips)
    } catch (error) {
      console.error("Error fetching my tips:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatMatchDate = (dateString: string | null) => {
    if (!dateString) return 'TBD'
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getPredictionTypeLabel = (type: string | null) => {
    if (!type) return 'No Prediction'
    switch (type) {
      case 'home_win': return 'Home Win'
      case 'away_win': return 'Away Win'
      case 'draw': return 'Draw'
      default: return type
    }
  }

  const getValueRatingColor = (rating: string | null) => {
    if (!rating) return 'bg-gray-500'
    switch (rating.toLowerCase()) {
      case 'very high': return 'bg-red-500'
      case 'high': return 'bg-orange-500'
      case 'medium': return 'bg-yellow-500'
      case 'low': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  const getMatchStatusColor = (status: string | null) => {
    if (!status) return 'text-slate-400'
    switch (status.toLowerCase()) {
      case 'live': return 'text-red-400'
      case 'finished': return 'text-green-400'
      case 'upcoming': return 'text-blue-400'
      default: return 'text-slate-400'
    }
  }

  const getMatchStatusIcon = (status: string | null) => {
    if (!status) return <Clock className="w-4 h-4" />
    switch (status.toLowerCase()) {
      case 'live': return <TrendingUp className="w-4 h-4" />
      case 'finished': return <CheckCircle className="w-4 h-4" />
      case 'upcoming': return <Clock className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  if (isLoading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      </Card>
    )
  }

  if (tips.length === 0) {
    return (
      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
            <Star className="w-5 h-5 text-emerald-400" />
            <span>My Purchased Tips</span>
          </h2>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-slate-400 hover:text-white"
            onClick={() => router.push('/dashboard/my-tips')}
          >
            <Target className="w-4 h-4 mr-2" />
            View All
          </Button>
        </div>
        <div className="text-center py-8">
          <p className="text-slate-400 mb-4">You haven't purchased any predictions yet.</p>
          <Button 
            onClick={() => router.push('/dashboard/matches')}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            Browse Predictions
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
          <Star className="w-5 h-5 text-emerald-400" />
          <span>My Purchased Tips</span>
        </h2>
        <div className="flex items-center space-x-3">
          <Badge className="bg-emerald-500 text-white animate-pulse">ACTIVE</Badge>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-slate-400 hover:text-white"
            onClick={() => router.push('/dashboard/my-tips')}
          >
            <Target className="w-4 h-4 mr-2" />
            View All
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tips.map((tip) => (
          <Card
            key={tip.id}
            className="rounded-lg border bg-card text-card-foreground shadow-sm bg-gradient-to-br from-slate-700 to-slate-800 p-4 border-slate-600 relative overflow-hidden hover:scale-105 transition-transform duration-300 cursor-pointer"
            onClick={() => router.push('/dashboard/my-tips')}
          >
            {/* Match Status Badge */}
            <div className="absolute top-2 right-2">
              <Badge className={`${getMatchStatusColor(tip.matchStatus)} bg-slate-800/80 border-slate-600 text-xs`}>
                {getMatchStatusIcon(tip.matchStatus)}
                <span className="ml-1">{tip.matchStatus || 'Upcoming'}</span>
              </Badge>
            </div>

            {/* Content */}
            <div className="text-white">
              {/* Match Details */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <div className="flex items-center">
                    <Calendar className="w-3 h-3 mr-1" />
                    <span>{formatMatchDate(tip.matchDate)}</span>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium mb-1">
                    {tip.homeTeam} vs {tip.awayTeam}
                  </div>
                  {tip.league && (
                    <div className="flex items-center justify-center text-xs opacity-80">
                      <Trophy className="w-3 h-3 mr-1" />
                      {tip.league}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Prediction Info */}
              {tip.predictionType && (
                <div className="text-center mb-3">
                  <Badge className="bg-emerald-600 text-white mb-2 text-xs">
                    {getPredictionTypeLabel(tip.predictionType)}
                  </Badge>
                  {tip.confidenceScore && (
                    <div className="text-emerald-400 text-xs">
                      Confidence: {tip.confidenceScore}%
                    </div>
                  )}
                  {tip.valueRating && (
                    <Badge className={`${getValueRatingColor(tip.valueRating)} text-white text-xs ml-1`}>
                      {tip.valueRating} Value
                    </Badge>
                  )}
                </div>
              )}
              
              {/* Purchase Info */}
              <div className="border-t border-slate-600 pt-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Price:</span>
                  <span className="text-emerald-400 font-medium">
                    {convertPrice(tip.price)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs mt-1">
                  <span className="text-slate-400">Purchased:</span>
                  <span className="text-slate-300">
                    {new Date(tip.purchaseDate).toLocaleDateString()}
                  </span>
                </div>
              </div>
              
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  router.push('/dashboard/my-tips')
                }}
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border hover:text-accent-foreground h-8 px-3 py-1 w-full bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border-emerald-600/30 mt-3"
              >
                <TrendingUp className="w-3 h-3 mr-1" />
                View Details
              </button>
            </div>
          </Card>
        ))}
      </div>
    </Card>
  )
} 