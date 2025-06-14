"use client"

import { useQuery } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Download, CheckCircle, XCircle, Clock } from "lucide-react"

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

export function TipsHistory() {
  const { data: predictions = [], isLoading, error } = useQuery({
    queryKey: ['predictions'],
    queryFn: fetchPredictions,
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "won":
        return <CheckCircle className="w-4 h-4 text-emerald-400" />
      case "lost":
        return <XCircle className="w-4 h-4 text-red-400" />
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-400" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "won":
        return "text-emerald-400"
      case "lost":
        return "text-red-400"
      case "pending":
        return "text-yellow-400"
      default:
        return "text-slate-400"
    }
  }

  if (isLoading) {
    return <Card className="bg-slate-800/50 border-slate-700 p-6">Loading tips history...</Card>
  }
  if (error) {
    return <Card className="bg-slate-800/50 border-slate-700 p-6 text-red-400">Failed to load tips history.</Card>
  }

  // Sort by date descending
  const sorted = [...predictions].sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime())

  return (
    <Card className="bg-slate-800/50 border-slate-700 p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <h2 className="text-xl font-semibold text-white mb-4 md:mb-0">Tips History</h2>

        <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2 w-full md:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Search matches..."
              className="pl-10 bg-slate-900/50 border-slate-600 text-white w-full md:w-64"
            />
          </div>
          <Select>
            <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white w-full md:w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="won">Won</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-800">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left text-slate-400 font-medium py-3">Date</th>
              <th className="text-left text-slate-400 font-medium py-3">Match</th>
              <th className="text-left text-slate-400 font-medium py-3">Prediction</th>
              <th className="text-left text-slate-400 font-medium py-3">Confidence</th>
              <th className="text-left text-slate-400 font-medium py-3">Odds</th>
              <th className="text-left text-slate-400 font-medium py-3">Stake</th>
              <th className="text-left text-slate-400 font-medium py-3">Status</th>
              <th className="text-left text-slate-400 font-medium py-3">Profit/Loss</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((tip) => (
              <tr key={tip.id} className="border-b border-slate-800 hover:bg-slate-900/30">
                <td className="py-4 text-slate-300">{new Date(tip.dateTime).toLocaleDateString()}</td>
                <td className="py-4">
                  <div>
                    <div className="text-white font-medium">{tip.match.homeTeam.name} vs {tip.match.awayTeam.name}</div>
                    <div className="text-slate-400 text-sm">{tip.league || tip.match.league?.name}</div>
                  </div>
                </td>
                <td className="py-4 text-white">{tip.prediction}</td>
                <td className="py-4">
                  <Badge className="bg-slate-700 text-slate-300">{tip.confidence}%</Badge>
                </td>
                <td className="py-4 text-slate-300">{tip.odds}</td>
                <td className="py-4 text-slate-300">{tip.stake}</td>
                <td className="py-4">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(tip.result)}
                    <span className={`capitalize ${getStatusColor(tip.result)}`}>{tip.result}</span>
                  </div>
                </td>
                <td className={`py-4 font-semibold ${getStatusColor(tip.result)}`}>{tip.potentialReturn || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
