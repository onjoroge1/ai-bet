"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { 
  Search, 
  Filter, 
  Download, 
  TrendingUp, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle,
  Target,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Eye,
  RefreshCw,
  Trophy,
  Calendar,
  Zap
} from "lucide-react"
import { format } from "date-fns"
import { usePredictionsHistory, usePredictionsHistoryStats } from "./hooks/use-predictions-history"
import { usePredictionsFilters } from "./hooks/use-predictions-filters"
import { Prediction } from "./types"

export default function PredictionsHistory() {
  const { filters, updateFilters, resetFilters, setPage, toggleSort } = usePredictionsFilters()
  
  // Data fetching with React Query
  const { 
    data: predictionsData, 
    isLoading: predictionsLoading, 
    error: predictionsError,
    refetch: refetchPredictions 
  } = usePredictionsHistory(filters)
  
  const { 
    data: stats, 
    isLoading: statsLoading,
    refetch: refetchStats 
  } = usePredictionsHistoryStats()

  // Modal states
  const [selectedPrediction, setSelectedPrediction] = useState<Prediction | null>(null)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false)

  // Helper functions
  const getResultIcon = (result: string) => {
    switch (result) {
      case 'won':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />
      case 'lost':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'void':
        return <AlertCircle className="w-4 h-4 text-orange-500" />
      case 'pending_result':
        return <RefreshCw className="w-4 h-4 text-blue-500" />
      default:
        return <Clock className="w-4 h-4 text-yellow-500" />
    }
  }

  const getResultColor = (result: string) => {
    switch (result) {
      case 'won':
        return "bg-emerald-500/20 text-emerald-400"
      case 'lost':
        return "bg-red-500/20 text-red-400"
      case 'void':
        return "bg-orange-500/20 text-orange-400"
      case 'pending_result':
        return "bg-blue-500/20 text-blue-400"
      default:
        return "bg-yellow-500/20 text-yellow-400"
    }
  }

  const getValueRatingColor = (rating: string) => {
    switch (rating.toLowerCase()) {
      case 'very high':
        return "bg-emerald-500/20 text-emerald-400"
      case 'high':
        return "bg-blue-500/20 text-blue-400"
      case 'medium':
        return "bg-yellow-500/20 text-yellow-400"
      case 'low':
        return "bg-orange-500/20 text-orange-400"
      case 'very low':
        return "bg-red-500/20 text-red-400"
      default:
        return "bg-gray-500/20 text-gray-400"
    }
  }

  const formatPredictionType = (type: string) => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const handleExport = async () => {
    try {
      const response = await fetch('/api/predictions/history/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: 'csv',
          filters: filters
        })
      })
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `predictions-history-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Error exporting predictions history:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Predictions History</h1>
        <p className="text-slate-400">
          Browse our complete history of AI-powered sports predictions for matches that have occurred. Most matches show "Awaiting Result" as match results are updated separately from the prediction system.
        </p>
      </div>

      {/* Header with Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                <Target className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-slate-400 text-xs">Total Predictions</p>
                <p className="text-white text-lg font-bold">
                  {statsLoading ? '...' : stats?.totalPredictions || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Trophy className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-slate-400 text-xs">Success Rate</p>
                <p className="text-white text-lg font-bold">
                  {statsLoading ? '...' : `${stats?.successRate || 0}%`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <p className="text-slate-400 text-xs">Avg Confidence</p>
                <p className="text-white text-lg font-bold">
                  {statsLoading ? '...' : `${stats?.averageConfidence || 0}%`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <Calendar className="w-4 h-4 text-orange-400" />
              </div>
              <div>
                <p className="text-slate-400 text-xs">Last 30 Days</p>
                <p className="text-white text-lg font-bold">
                  {statsLoading ? '...' : stats?.recentPredictions || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-slate-400" />
              <CardTitle className="text-white text-lg">Filters</CardTitle>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                {isFiltersExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {isFiltersExpanded ? 'Hide' : 'Show'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={resetFilters}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Reset
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { refetchPredictions(); refetchStats(); }}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        {isFiltersExpanded && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search teams or leagues..."
                  value={filters.search}
                  onChange={(e) => updateFilters({ search: e.target.value })}
                  className="pl-10 bg-slate-900/50 border-slate-600 text-white"
                />
              </div>

              {/* Result Filter */}
              <Select value={filters.result} onValueChange={(value) => updateFilters({ result: value })}>
                <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                  <SelectValue placeholder="Filter by result" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Results</SelectItem>
                  <SelectItem value="won">Won</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="pending_result">Awaiting Result</SelectItem>
                  <SelectItem value="void">Void</SelectItem>
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <Select value={filters.status} onValueChange={(value) => updateFilters({ status: value })}>
                <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="finished">Finished</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort By */}
              <Select value={filters.sortBy} onValueChange={(value) => updateFilters({ sortBy: value })}>
                <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">Date Created</SelectItem>
                  <SelectItem value="confidenceScore">Confidence</SelectItem>
                  <SelectItem value="odds">Odds</SelectItem>
                  <SelectItem value="match.matchDate">Match Date</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Predictions List */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">Completed Match Predictions</CardTitle>
              <CardDescription className="text-slate-400">
                {predictionsData?.pagination ? 
                  `Showing ${((predictionsData.pagination.page - 1) * predictionsData.pagination.limit) + 1} to ${Math.min(predictionsData.pagination.page * predictionsData.pagination.limit, predictionsData.pagination.totalCount)} of ${predictionsData.pagination.totalCount} completed match predictions` :
                  'Loading completed match predictions...'
                }
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={handleExport}
              className="border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          {predictionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
          ) : predictionsError ? (
            <div className="text-center py-8 text-red-400">
              <AlertCircle className="w-12 h-12 mx-auto mb-4" />
              <p>Failed to load predictions history</p>
              <Button 
                variant="outline" 
                onClick={() => refetchPredictions()}
                className="mt-4 border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Try Again
              </Button>
            </div>
          ) : !predictionsData?.predictions || predictionsData.predictions.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Target className="w-12 h-12 mx-auto mb-4" />
              <p>No past match predictions found matching your criteria</p>
              <p className="text-sm mt-2">Only matches that occurred more than 24 hours ago are shown in the history</p>
            </div>
          ) : (
            <div className="space-y-4">
              {predictionsData.predictions.map((prediction) => (
                <div key={prediction.id} className="border border-slate-700 rounded-lg p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
                        <Target className="h-4 w-4 text-slate-300" />
                      </div>
                      <div>
                        <p className="font-medium text-white">
                          {prediction.match.homeTeam.name} vs {prediction.match.awayTeam.name}
                        </p>
                        <p className="text-sm text-slate-400">
                          {prediction.match.league.name} • {format(new Date(prediction.createdAt), "PPP")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getResultIcon(prediction.result)}
                      <Badge className={getResultColor(prediction.result)}>
                        {prediction.result}
                      </Badge>
                      {prediction.isFeatured && (
                        <Badge className="bg-purple-500/20 text-purple-400">
                          Featured
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Match Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-white font-medium">
                        {prediction.match.homeTeam.name} vs {prediction.match.awayTeam.name}
                      </p>
                      <p className="text-slate-400 text-sm">{prediction.match.league.name}</p>
                      <p className="text-slate-400 text-sm">
                        {format(new Date(prediction.match.matchDate), "PPP")}
                      </p>
                      {prediction.match.homeScore !== null && prediction.match.awayScore !== null && (
                        <p className="text-white text-sm font-medium">
                          Final Score: {prediction.match.homeScore} - {prediction.match.awayScore}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Prediction:</span>
                        <span className="text-white font-medium">
                          {formatPredictionType(prediction.predictionType)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Confidence:</span>
                        <Badge className="bg-slate-700 text-slate-300">
                          {prediction.confidenceScore}%
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Odds:</span>
                        <span className="text-white">{prediction.odds}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Value Rating:</span>
                        <Badge className={getValueRatingColor(prediction.valueRating)}>
                          {prediction.valueRating}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-700">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedPrediction(prediction)}
                          className="border-slate-600 text-slate-300 hover:bg-slate-700"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-slate-800 border-slate-700">
                        <DialogHeader>
                          <DialogTitle className="text-white">Prediction Details</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <p className="text-slate-300 text-sm">Match</p>
                            <p className="text-white">
                              {prediction.match.homeTeam.name} vs {prediction.match.awayTeam.name}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-300 text-sm">League</p>
                            <p className="text-white">{prediction.match.league.name}</p>
                          </div>
                          <div>
                            <p className="text-slate-300 text-sm">Prediction</p>
                            <p className="text-white">{formatPredictionType(prediction.predictionType)}</p>
                          </div>
                          <div>
                            <p className="text-slate-300 text-sm">Explanation</p>
                            <p className="text-slate-400">{prediction.explanation || 'No explanation available'}</p>
                          </div>
                          <div>
                            <p className="text-slate-300 text-sm">Result</p>
                            <Badge className={getResultColor(prediction.result)}>
                              {prediction.result}
                            </Badge>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {predictionsData?.pagination && predictionsData.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-slate-400">
                Showing {((predictionsData.pagination.page - 1) * predictionsData.pagination.limit) + 1} to {Math.min(predictionsData.pagination.page * predictionsData.pagination.limit, predictionsData.pagination.totalCount)} of {predictionsData.pagination.totalCount} predictions
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!predictionsData.pagination.hasPrevPage}
                  onClick={() => setPage(predictionsData.pagination.page - 1)}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  Previous
                </Button>
                <span className="text-sm text-slate-400">
                  Page {predictionsData.pagination.page} of {predictionsData.pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!predictionsData.pagination.hasNextPage}
                  onClick={() => setPage(predictionsData.pagination.page + 1)}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 