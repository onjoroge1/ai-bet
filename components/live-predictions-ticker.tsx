'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { 
  Target, 
  TrendingUp, 
  Clock, 
  Zap,
  ArrowRight,
  BarChart3
} from 'lucide-react'
import Link from 'next/link'

interface LivePrediction {
  id: string
  homeTeam: string
  awayTeam: string
  league: string
  prediction: string
  confidence: number
  odds: number
  matchTime: string
  status: 'upcoming' | 'live' | 'completed'
  result?: string
}

// No mock data - only real data from API

export function LivePredictionsTicker() {
  const [predictions, setPredictions] = useState<LivePrediction[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  // Fetch real predictions from API
  useEffect(() => {
    fetchPredictions()
    // Since we have 24-hour caching, we can refresh less frequently
    // Refresh every 5 minutes to check for new predictions
    const interval = setInterval(fetchPredictions, 300000) // Refresh every 5 minutes
    return () => clearInterval(interval)
  }, [])

  const fetchPredictions = async () => {
    try {
      // Use the new optimized endpoint that queries QuickPurchase table with 24-hour caching
      const response = await fetch('/api/predictions/live-ticker')
      const data = await response.json()
      
      if (data.success && data.data.length > 0) {
        // Data is already processed and filtered by the API
        setPredictions(data.data)
        
        // Log cache status for debugging
        if (data.cached) {
          console.log(`Using cached predictions (${data.cacheAge} minutes old)`)
        }
      } else {
        setPredictions([])
      }
    } catch (error) {
      console.error('Error fetching live predictions:', error)
      setPredictions([])
    } finally {
      setLoading(false)
    }
  }

  // Rotate through predictions
  useEffect(() => {
    if (predictions.length === 0) return
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % predictions.length)
    }, 5000) // Change every 5 seconds

    return () => clearInterval(interval)
  }, [predictions.length])

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-slate-800/80 via-slate-700/80 to-slate-800/80 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
            <span className="ml-3 text-slate-300">Loading predictions...</span>
          </div>
        </div>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'completed':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      default:
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'live':
        return <Zap className="w-3 h-3 animate-pulse" />
      case 'completed':
        return <TrendingUp className="w-3 h-3" />
      default:
        return <Clock className="w-3 h-3" />
    }
  }

  const formatMatchTime = (matchTime: string) => {
    const date = new Date(matchTime)
    const now = new Date()
    const diff = date.getTime() - now.getTime()
    
    if (diff < 0) return 'Live'
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  return (
    <div className="bg-gradient-to-r from-slate-800/80 via-slate-700/80 to-slate-800/80 border-b border-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <Target className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Live AI Predictions</h2>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-slate-400">LIVE</span>
            </div>
          </div>
          <Link href="/" className="text-emerald-400 hover:text-emerald-300 text-sm font-medium">
            View All Predictions
            <ArrowRight className="w-4 h-4 inline ml-1" />
          </Link>
        </div>

        {predictions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {predictions.slice(0, 4).map((prediction, index) => (
              <Card 
                key={prediction.id} 
                className={`bg-slate-700/50 border-slate-600 hover:border-emerald-500/50 transition-all duration-300 cursor-pointer ${
                  index === currentIndex ? 'ring-2 ring-emerald-500/50' : ''
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <Badge className={`${getStatusColor(prediction.status)} text-xs`}>
                      {getStatusIcon(prediction.status)}
                      <span className="ml-1">{prediction.status.toUpperCase()}</span>
                    </Badge>
                    <div className="flex items-center gap-1">
                      <BarChart3 className="w-3 h-3 text-emerald-400" />
                      <span className="text-xs text-emerald-400 font-semibold">
                        {prediction.confidence}%
                      </span>
                    </div>
                  </div>

                  <div className="mb-3">
                    <h3 className="text-sm font-semibold text-white mb-1">
                      {prediction.homeTeam} vs {prediction.awayTeam}
                    </h3>
                    <p className="text-xs text-slate-400">{prediction.league}</p>
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <div className="text-center">
                      <p className="text-xs text-slate-400">Prediction</p>
                      <p className="text-sm font-bold text-emerald-400">{prediction.prediction}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-400">Odds</p>
                      <p className="text-sm font-bold text-white">@{prediction.odds}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{formatMatchTime(prediction.matchTime)}</span>
                    {prediction.result && (
                      <Badge className={prediction.result === 'WON' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                        {prediction.result}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="p-4 bg-slate-700/30 rounded-lg max-w-md mx-auto">
              <Target className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-300 mb-2">No Active Predictions</h3>
              <p className="text-slate-400 text-sm mb-4">
                Check back soon for upcoming match predictions and live betting opportunities.
              </p>
              <Link 
                href="/dashboard/predictions" 
                className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-sm font-medium"
              >
                View All Predictions
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {/* Real-time Stats */}
        {predictions.length > 0 && (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-slate-700/30 rounded-lg">
              <div className="text-2xl font-bold text-emerald-400">{predictions.length}</div>
              <div className="text-xs text-slate-400">Active Predictions</div>
            </div>
            <div className="text-center p-3 bg-slate-700/30 rounded-lg">
              <div className="text-2xl font-bold text-blue-400">
                {predictions.filter(p => p.status === 'live').length}
              </div>
              <div className="text-xs text-slate-400">Live Matches</div>
            </div>
            <div className="text-center p-3 bg-slate-700/30 rounded-lg">
              <div className="text-2xl font-bold text-green-400">
                {predictions.filter(p => p.status === 'upcoming').length}
              </div>
              <div className="text-xs text-slate-400">Upcoming</div>
            </div>
            <div className="text-center p-3 bg-slate-700/30 rounded-lg">
              <div className="text-2xl font-bold text-purple-400">
                {predictions.filter(p => p.status === 'completed').length}
              </div>
              <div className="text-xs text-slate-400">Completed</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
