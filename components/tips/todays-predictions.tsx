"use client"
import { useQuery } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, Star, TrendingUp, Lock, Eye, Target, Brain } from "lucide-react"

// Prediction type (matches normalized structure)
type Prediction = {
  id: string
  match: {
    homeTeam: { id: string; name: string }
    awayTeam: { id: string; name: string }
    league: { id: string; name: string }
    dateTime: string
    status: string
  }
  league: string
  dateTime: string
  prediction: string
  odds: string
  confidence: number
  analysis: string
  status: string
  result: string
  isFree: boolean
  isFeatured: boolean
  showInDailyTips: boolean
  showInWeeklySpecials: boolean
  type: string
  matchesInAccumulator: Array<{
    match: string
    prediction: string
    odds: string
  }>
  totalOdds: string
  stake: string
  potentialReturn: string
  valueRating: string
  createdAt: string
  updatedAt: string
}

const fetchPredictions = async (): Promise<Prediction[]> => {
  const response = await fetch('/api/predictions')
  if (!response.ok) {
    throw new Error('Failed to fetch predictions')
  }
  const data = await response.json()
  return data.map((p: any) => ({
    id: p.id,
    match: typeof p.match === 'string'
      ? {
          homeTeam: { id: '', name: p.match.split(' vs ')[0] || '' },
          awayTeam: { id: '', name: p.match.split(' vs ')[1] || '' },
          league: { id: '', name: p.league || '' },
          dateTime: p.dateTime,
          status: p.status
        }
      : {
          homeTeam: p.match?.homeTeam || { id: '', name: '' },
          awayTeam: p.match?.awayTeam || { id: '', name: '' },
          league: p.match?.league || { id: '', name: '' },
          dateTime: p.match?.matchDate || p.match?.dateTime || p.dateTime || '',
          status: p.match?.status || p.status || ''
        },
    league: p.league || p.match?.league?.name || '',
    dateTime: p.dateTime || p.match?.matchDate || '',
    prediction: p.predictionType || p.prediction || '',
    odds: p.odds?.toString() || '',
    confidence: p.confidenceScore ?? p.confidence ?? 0,
    analysis: p.explanation || p.analysis || '',
    status: p.status || '',
    result: p.result || 'pending',
    isFree: p.isFree,
    isFeatured: p.isFeatured,
    showInDailyTips: p.showInDailyTips || false,
    showInWeeklySpecials: p.showInWeeklySpecials || false,
    type: p.type || 'single',
    matchesInAccumulator: Array.isArray(p.matchesInAccumulator)
      ? p.matchesInAccumulator.map((m: any) => ({
          match: typeof m === 'string' ? m : m.match,
          prediction: typeof m === 'string' ? '' : m.prediction,
          odds: typeof m === 'string' ? '' : m.odds
        }))
      : [],
    totalOdds: p.totalOdds?.toString() || '',
    stake: p.stake?.toString() || '',
    potentialReturn: p.potentialReturn?.toString() || '',
    valueRating: p.valueRating || 'Medium',
    createdAt: p.createdAt,
    updatedAt: p.updatedAt
  }))
}

export function TodaysPredictions() {
  const { data: predictions = [], isLoading, error } = useQuery({
    queryKey: ['predictions'],
    queryFn: fetchPredictions,
  })

  // Filter for today's date and showInDailyTips
  const today = new Date()
  const isToday = (dateString: string) => {
    const d = new Date(dateString)
    return d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
  }
  const filtered = predictions.filter(p => p.showInDailyTips && isToday(p.dateTime))

  const getValueColor = (value: string) => {
    switch (value) {
      case "Very High":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30"
      case "High":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
      case "Medium":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
      default:
        return "bg-slate-500/20 text-slate-400 border-slate-500/30"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "live":
        return "bg-red-500/20 text-red-400 border-red-500/30 animate-pulse"
      case "upcoming":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30"
      default:
        return "bg-slate-500/20 text-slate-400 border-slate-500/30"
    }
  }

  if (isLoading) {
    return <div className="text-center text-slate-400 py-8">Loading predictions...</div>
  }
  if (error) {
    return <div className="text-center text-red-400 py-8">Failed to load predictions.</div>
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
          <Target className="w-5 h-5 text-emerald-400" />
          <span>Today's Predictions</span>
        </h2>
        <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white">
          <TrendingUp className="w-4 h-4 mr-2" />
          Sort by Confidence
        </Button>
      </div>
      <div className="space-y-4">
        {filtered.length === 0 && (
          <div className="text-center text-slate-400 py-8">No predictions for today.</div>
        )}
        {filtered.map((prediction) => (
          <Card
            key={prediction.id}
            className="bg-slate-900/50 border-slate-700 p-4 hover:bg-slate-900/70 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <h3 className="text-white font-semibold">
                    {prediction.match.homeTeam.name} vs {prediction.match.awayTeam.name}
                  </h3>
                  <Badge variant="secondary" className="bg-slate-700 text-slate-300 text-xs">
                    {prediction.league}
                  </Badge>
                  <Badge className={getStatusColor(prediction.status)}>
                    {prediction.status === "live"
                      ? "LIVE"
                      : new Date(prediction.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Badge>
                </div>
                <div className="flex items-center space-x-4 mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-emerald-400 font-medium">{prediction.prediction}</span>
                    <span className="text-slate-400 text-sm">@ {prediction.odds}</span>
                  </div>
                  <Badge className={getValueColor(prediction.valueRating)}>{prediction.valueRating} Value</Badge>
                  {prediction.isFree ? (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Free</Badge>
                  ) : (
                    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                      <Lock className="w-3 h-3 mr-1" />
                      VIP
                    </Badge>
                  )}
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3 mb-3">
                  <div className="flex items-start space-x-2">
                    <Brain className="w-4 h-4 text-emerald-400 mt-0.5" />
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
                </div>
              </div>
              <div className="text-right ml-4">
                <div className="text-2xl font-bold text-white mb-1">{prediction.confidence}%</div>
                <div className="text-slate-400 text-sm mb-2">Confidence</div>
                <div className="flex items-center space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3 h-3 ${
                        i < Math.floor(prediction.confidence / 20) ? "text-yellow-400 fill-current" : "text-slate-600"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <span className="text-slate-400 text-sm">
                  {prediction.status === "live"
                    ? "Match in progress"
                    : `Starts at ${new Date(prediction.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                {prediction.isFree ? (
                  <Button size="sm" variant="outline" className="text-emerald-400 border-emerald-400">
                    <Eye className="w-4 h-4 mr-1" />
                    View Analysis
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="text-amber-400 border-amber-400">
                    <Lock className="w-4 h-4 mr-1" />
                    Unlock VIP
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </Card>
  )
}
