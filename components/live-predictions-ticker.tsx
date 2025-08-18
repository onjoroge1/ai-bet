'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Target, ArrowRight } from 'lucide-react'
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

interface LivePredictionsTickerProps {
  compact?: boolean
}

export function LivePredictionsTicker({ compact = false }: LivePredictionsTickerProps) {
  const [predictions, setPredictions] = useState<LivePrediction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPredictions = async () => {
      try {
        const response = await fetch('/api/predictions/live-ticker')
        const data = await response.json()
        
        if (data.success && data.data.length > 0) {
          setPredictions(data.data)
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

    fetchPredictions()
  }, [])

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-slate-800/80 via-slate-700/80 to-slate-800/80 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
            <span className="ml-3 text-slate-300">Loading live predictions...</span>
          </div>
        </div>
      </div>
    )
  }

  if (predictions.length === 0) {
    return (
      <div className="bg-gradient-to-r from-slate-800/80 via-slate-700/80 to-slate-800/80 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center py-8">
            <div className="p-6 bg-slate-700/30 rounded-lg max-w-md mx-auto border border-slate-600">
              <div className="p-3 bg-emerald-500/20 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Target className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-300 mb-2">Predictions Coming Soon</h3>
              <p className="text-slate-400 text-sm mb-4">
                Our AI is analyzing upcoming matches. Check back soon for live predictions and betting opportunities.
              </p>
              <Link 
                href="/dashboard/predictions" 
                className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Explore Predictions
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-r from-slate-800/80 via-slate-700/80 to-slate-800/80 border-b border-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg animate-pulse">
              <Target className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Live AI Predictions</h2>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-red-400 font-semibold animate-pulse">LIVE</span>
            </div>
          </div>
          <Link href="/dashboard/predictions" className="text-emerald-400 hover:text-emerald-300 text-sm font-medium transition-colors duration-200 hover:scale-105 transform">
            View All Predictions
            <ArrowRight className="w-4 h-4 inline ml-1" />
          </Link>
        </div>

        <div className={`grid gap-4 ${
          compact 
            ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' 
            : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
        }`}>
          {predictions.slice(0, compact ? 3 : 4).map((prediction) => (
            <Card 
              key={prediction.id} 
              className="bg-slate-700/50 border-slate-600 hover:border-emerald-500/50 transition-all duration-300 cursor-pointer transform hover:scale-105 hover:shadow-lg hover:shadow-emerald-500/20"
            >
              <CardContent className={`${compact ? 'p-3' : 'p-4'}`}>
                <div className="flex items-center justify-between mb-3">
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                    {prediction.status.toUpperCase()}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-emerald-400 font-semibold">
                      {prediction.confidence}%
                    </span>
                  </div>
                </div>

                <div className="mb-3">
                  <h3 className={`font-semibold text-white mb-1 ${compact ? 'text-xs' : 'text-sm'}`}>
                    {prediction.homeTeam} vs {prediction.awayTeam}
                  </h3>
                  <p className="text-xs text-slate-400">{prediction.league}</p>
                </div>

                <div className="flex items-center justify-between mb-3">
                  <div className="text-center">
                    <p className="text-xs text-slate-400">Prediction</p>
                    <p className={`font-bold text-emerald-400 ${compact ? 'text-xs' : 'text-sm'}`}>{prediction.prediction}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-400">Odds</p>
                    <p className={`font-bold text-white ${compact ? 'text-xs' : 'text-sm'}`}>@{prediction.odds}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {compact && predictions.length > 0 && (
          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-3 p-4 bg-gradient-to-r from-emerald-500/20 to-blue-500/20 border border-emerald-500/30 rounded-lg">
              <Target className="w-5 h-5 text-emerald-400" />
              <span className="text-slate-300 text-sm">
                Get access to <span className="text-emerald-400 font-semibold">all predictions</span> and start winning today!
              </span>
              <Link 
                href="/dashboard/predictions" 
                className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                View All Predictions
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
