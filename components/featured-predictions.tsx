"use client"

import { useQuery } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, Star, TrendingUp, Lock, Brain, Loader2 } from "lucide-react"
import Link from "next/link"

// Type for the prediction data
type Prediction = {
  id: string
  match: {
    homeTeam: { id: string; name: string }
    awayTeam: { id: string; name: string }
    league: { id: string; name: string }
    dateTime: string
    status: "upcoming" | "live" | "finished" | "postponed" | "cancelled"
  }
  league: string
  prediction: string
  odds: string
  confidence: number
  analysis: string
  isFree: boolean
  valueRating: "Low" | "Medium" | "High" | "Very High"
  status: "upcoming" | "live" | "finished" | "postponed" | "cancelled"
}

// Function to fetch featured predictions
const fetchFeaturedPredictions = async (): Promise<Prediction[]> => {
  const response = await fetch('/api/predictions')
  if (!response.ok) {
    throw new Error('Failed to fetch predictions')
  }
  const data = await response.json()
  
  // Filter for featured predictions and normalize the data
  return data
    .filter((p: any) => p.isFeatured)
    .map((p: any) => ({
      id: p.id,
      match: typeof p.match === 'string' 
        ? {
            homeTeam: { id: '', name: p.match.split(' vs ')[0] || '' },
            awayTeam: { id: '', name: p.match.split(' vs ')[1] || '' },
            league: { id: '', name: p.league || '' },
            dateTime: p.dateTime,
            status: p.status
          }
        : p.match,
      league: p.league,
      prediction: p.prediction,
      odds: p.odds,
      confidence: p.confidence,
      analysis: p.analysis || '',
      isFree: p.isFree,
      valueRating: p.valueRating || 'Medium',
      status: p.status
    }))
}

export function FeaturedPredictions() {
  const { data: predictions = [], isLoading, error } = useQuery({
    queryKey: ['featured-predictions'],
    queryFn: fetchFeaturedPredictions,
  })

  if (isLoading) {
    return (
      <section className="py-16 px-4 bg-slate-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Today's AI Predictions</h2>
            <p className="text-slate-300 text-lg">Data-driven insights from our advanced machine learning algorithms</p>
          </div>
          <div className="flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          </div>
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="py-16 px-4 bg-slate-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Today's AI Predictions</h2>
            <p className="text-slate-300 text-lg">Data-driven insights from our advanced machine learning algorithms</p>
          </div>
          <div className="text-center text-red-400">
            Failed to load predictions. Please try again later.
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="py-16 px-4 bg-slate-900/50">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Today's AI Predictions</h2>
          <p className="text-slate-300 text-lg">Data-driven insights from our advanced machine learning algorithms</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {predictions.map((prediction) => (
            <Card
              key={prediction.id}
              className="bg-slate-800/50 border-slate-700 p-6 hover:bg-slate-800/70 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="bg-slate-700 text-slate-300">
                      {prediction.league}
                    </Badge>
                    {prediction.isFree ? (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Free</Badge>
                    ) : (
                      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                        <Lock className="w-3 h-3 mr-1" />
                        VIP
                      </Badge>
                    )}
                  </div>
                  <h3 className="text-white font-semibold text-lg">
                    {prediction.match.homeTeam.name} vs {prediction.match.awayTeam.name}
                  </h3>
                  <div className="flex items-center text-slate-400 text-sm mt-1">
                    <Clock className="w-4 h-4 mr-1" />
                    {new Date(prediction.match.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-emerald-400">{prediction.confidence}%</div>
                  <div className="text-slate-400 text-sm">Confidence</div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">{prediction.prediction}</div>
                    <div className="text-slate-400 text-sm">Odds: {prediction.odds}</div>
                  </div>
                  <div className="flex items-center">
                    <Star className="w-4 h-4 text-amber-400 mr-1" />
                    <span className="text-amber-400 text-sm">{prediction.valueRating} Value</span>
                  </div>
                </div>

                <div className="bg-slate-900/50 rounded-lg p-3">
                  <div className="text-slate-300 text-sm">
                    {prediction.isFree ? (
                      prediction.analysis
                    ) : (
                      <div className="flex items-center">
                        <Lock className="w-4 h-4 mr-2 text-slate-500" />
                        {prediction.analysis}
                      </div>
                    )}
                  </div>
                </div>

                {!prediction.isFree && (
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Unlock VIP Analysis
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>

        <div className="text-center mt-12">
          <Link href="/daily-tips">
            <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8">
              View All Predictions
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
