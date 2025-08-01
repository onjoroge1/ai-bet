"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { 
  Search, 
  Filter, 
  Download, 
  TrendingUp, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle,
  Calendar as CalendarIcon,
  Package,
  Target,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  RefreshCw,
  Settings
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth-provider"
import { useTipsHistory, useTipsHistoryStats } from "./hooks/use-tips-history"
import { useTipsFilters } from "./hooks/use-tips-filters"
import { Tip, TipsHistoryStats } from "./types"

export default function TipsHistory() {
  const { user } = useAuth()
  const { filters, updateFilters, resetFilters, setPage, toggleSort } = useTipsFilters()
  
  // Data fetching with React Query
  const { 
    data: tipsData, 
    isLoading: tipsLoading, 
    error: tipsError,
    refetch: refetchTips 
  } = useTipsHistory(filters)
  
  const { 
    data: stats, 
    isLoading: statsLoading,
    refetch: refetchStats 
  } = useTipsHistoryStats()

  // Modal states
  const [selectedTip, setSelectedTip] = useState<Tip | null>(null)
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false)

  // Form states
  const [newStatus, setNewStatus] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [stakeAmount, setStakeAmount] = useState('')
  const [usageNotes, setUsageNotes] = useState('')

  // Helper functions
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'claimed':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />
      case 'used':
        return <TrendingUp className="w-4 h-4 text-blue-500" />
      case 'expired':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'cancelled':
        return <AlertCircle className="w-4 h-4 text-orange-500" />
      default:
        return <Clock className="w-4 h-4 text-yellow-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'claimed':
        return "bg-emerald-500/20 text-emerald-400"
      case 'used':
        return "bg-blue-500/20 text-blue-400"
      case 'expired':
        return "bg-red-500/20 text-red-400"
      case 'cancelled':
        return "bg-orange-500/20 text-orange-400"
      default:
        return "bg-yellow-500/20 text-yellow-400"
    }
  }

  const getResultColor = (result?: string) => {
    switch (result) {
      case 'won':
        return "bg-emerald-500/20 text-emerald-400"
      case 'lost':
        return "bg-red-500/20 text-red-400"
      case 'pending':
        return "bg-yellow-500/20 text-yellow-400"
      case 'cancelled':
        return "bg-gray-500/20 text-gray-400"
      default:
        return "bg-gray-500/20 text-gray-400"
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

  // Action handlers
  const handleUpdateTipStatus = async () => {
    if (!selectedTip) return
    
    try {
      const response = await fetch(`/api/user-packages/tips/${selectedTip.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus || selectedTip.status,
          notes: newNotes || selectedTip.notes
        })
      })
      
      if (response.ok) {
        setIsStatusModalOpen(false)
        setNewStatus('')
        setNewNotes('')
        refetchTips() // Refresh the list
      }
    } catch (error) {
      console.error('Error updating tip status:', error)
    }
  }

  const handleRecordTipUsage = async () => {
    if (!selectedTip || !stakeAmount) return
    
    try {
      const response = await fetch(`/api/user-packages/tips/${selectedTip.id}/use`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stakeAmount: parseFloat(stakeAmount),
          notes: usageNotes
        })
      })
      
      if (response.ok) {
        setIsUsageModalOpen(false)
        setStakeAmount('')
        setUsageNotes('')
        refetchTips() // Refresh the list
      }
    } catch (error) {
      console.error('Error recording tip usage:', error)
    }
  }

  const handleExport = async () => {
    try {
      const response = await fetch('/api/tips-history/export', {
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
        a.download = `tips-history-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Error exporting tips history:', error)
    }
  }

  if (!user) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Authentication Required</h2>
          <p className="text-slate-400 mb-4">Please sign in to view your tips history.</p>
          <Button asChild>
            <a href="/signin">Sign In</a>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Tips History</h1>
        <p className="text-slate-400">
          Track your claimed tips, monitor performance, and analyze your betting patterns
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
                <p className="text-slate-400 text-xs">Total Tips</p>
                <p className="text-white text-lg font-bold">
                  {statsLoading ? '...' : (stats as any)?.totalTips || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-slate-400 text-xs">Claimed</p>
                <p className="text-white text-lg font-bold">
                  {statsLoading ? '...' : (stats as any)?.claimedTips || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <p className="text-slate-400 text-xs">Used</p>
                <p className="text-white text-lg font-bold">
                  {statsLoading ? '...' : (stats as any)?.usedTips || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-orange-400" />
              </div>
              <div>
                <p className="text-slate-400 text-xs">Success Rate</p>
                <p className="text-white text-lg font-bold">
                  {statsLoading ? '...' : `${(stats as any)?.successRate || 0}%`}
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
                onClick={() => { refetchTips(); refetchStats(); }}
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

              {/* Status Filter */}
              <Select value={filters.status} onValueChange={(value) => updateFilters({ status: value })}>
                <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="claimed">Claimed</SelectItem>
                  <SelectItem value="used">Used</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              {/* Package Filter */}
              <Select value={filters.package} onValueChange={(value) => updateFilters({ package: value })}>
                <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                  <SelectValue placeholder="Filter by package" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Packages</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="unlimited">Unlimited</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort By */}
              <Select value={filters.sortBy} onValueChange={(value) => updateFilters({ sortBy: value })}>
                <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="claimedAt">Date Claimed</SelectItem>
                  <SelectItem value="confidenceScore">Confidence</SelectItem>
                  <SelectItem value="odds">Odds</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Tips List */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">Tips History</CardTitle>
              <CardDescription className="text-slate-400">
                {(tipsData as any)?.pagination ? 
                  `Showing ${(((tipsData as any).pagination.page - 1) * (tipsData as any).pagination.limit) + 1} to ${Math.min((tipsData as any).pagination.page * (tipsData as any).pagination.limit, (tipsData as any).pagination.totalCount)} of ${(tipsData as any).pagination.totalCount} tips` :
                  'Loading tips...'
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
          {tipsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
          ) : tipsError ? (
            <div className="text-center py-8 text-red-400">
              <AlertCircle className="w-12 h-12 mx-auto mb-4" />
              <p>Failed to load tips history</p>
              <Button 
                variant="outline" 
                onClick={() => refetchTips()}
                className="mt-4 border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Try Again
              </Button>
            </div>
          ) : !(tipsData as any)?.tips || (tipsData as any).tips.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Package className="w-12 h-12 mx-auto mb-4" />
              <p>No tips found matching your criteria</p>
            </div>
          ) : (
            <div className="space-y-4">
              {(tipsData as any).tips.map((tip: any) => (
                <div key={tip.id} className="border border-slate-700 rounded-lg p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                        style={{
                          background: `linear-gradient(135deg, ${tip.package.colorGradientFrom}, ${tip.package.colorGradientTo})`
                        }}
                      >
                        <Package className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{tip.package.name}</p>
                        <p className="text-sm text-slate-400">
                          Claimed {format(new Date(tip.claimedAt), "PPP")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(tip.status)}
                      <Badge className={getStatusColor(tip.status)}>
                        {tip.status}
                      </Badge>
                      {tip.result && (
                        <Badge className={getResultColor(tip.result)}>
                          {tip.result}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Match Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-white font-medium">
                        {tip.prediction.match.homeTeam.name} vs {tip.prediction.match.awayTeam.name}
                      </p>
                      <p className="text-slate-400 text-sm">{tip.prediction.match.league.name}</p>
                      <p className="text-slate-400 text-sm">
                        {format(new Date(tip.prediction.match.matchDate), "PPP")}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Prediction:</span>
                        <span className="text-white font-medium">
                          {formatPredictionType(tip.prediction.predictionType)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Confidence:</span>
                        <Badge className="bg-slate-700 text-slate-300">
                          {tip.prediction.confidenceScore}%
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Odds:</span>
                        <span className="text-white">{tip.prediction.odds}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Value Rating:</span>
                        <Badge className={getValueRatingColor(tip.prediction.valueRating)}>
                          {tip.prediction.valueRating}
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
                          onClick={() => setSelectedTip(tip)}
                          className="border-slate-600 text-slate-300 hover:bg-slate-700"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-slate-800 border-slate-700">
                        <DialogHeader>
                          <DialogTitle className="text-white">Tip Details</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label className="text-slate-300">Match</Label>
                            <p className="text-white">
                              {tip.prediction.match.homeTeam.name} vs {tip.prediction.match.awayTeam.name}
                            </p>
                          </div>
                          <div>
                            <Label className="text-slate-300">Prediction</Label>
                            <p className="text-white">{formatPredictionType(tip.prediction.predictionType)}</p>
                          </div>
                          <div>
                            <Label className="text-slate-300">Explanation</Label>
                            <p className="text-slate-400">{tip.prediction.explanation || 'No explanation available'}</p>
                          </div>
                          {tip.notes && (
                            <div>
                              <Label className="text-slate-300">Notes</Label>
                              <p className="text-slate-400">{tip.notes}</p>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>

                    {tip.status === 'claimed' && (
                      <>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedTip(tip)
                                setIsStatusModalOpen(true)
                              }}
                              className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white"
                            >
                              <Settings className="w-4 h-4 mr-2" />
                              Update Status
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-slate-800 border-slate-700">
                            <DialogHeader>
                              <DialogTitle className="text-white">Update Tip Status</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label className="text-slate-300">Status</Label>
                                <Select value={newStatus} onValueChange={setNewStatus}>
                                  <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                                    <SelectValue placeholder="Select status" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="claimed">Claimed</SelectItem>
                                    <SelectItem value="used">Used</SelectItem>
                                    <SelectItem value="expired">Expired</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-slate-300">Notes</Label>
                                <Textarea
                                  value={newNotes}
                                  onChange={(e) => setNewNotes(e.target.value)}
                                  placeholder="Add notes..."
                                  className="bg-slate-900/50 border-slate-600 text-white"
                                />
                              </div>
                              <div className="flex justify-end space-x-2">
                                <Button
                                  variant="outline"
                                  onClick={() => setIsStatusModalOpen(false)}
                                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                                >
                                  Cancel
                                </Button>
                                <Button onClick={handleUpdateTipStatus}>
                                  Update Status
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedTip(tip)
                                setIsUsageModalOpen(true)
                              }}
                              className="border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-white"
                            >
                              <TrendingUp className="w-4 h-4 mr-2" />
                              Record Usage
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-slate-800 border-slate-700">
                            <DialogHeader>
                              <DialogTitle className="text-white">Record Tip Usage</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label className="text-slate-300">Stake Amount</Label>
                                <Input
                                  type="number"
                                  value={stakeAmount}
                                  onChange={(e) => setStakeAmount(e.target.value)}
                                  placeholder="Enter stake amount..."
                                  className="bg-slate-900/50 border-slate-600 text-white"
                                />
                              </div>
                              <div>
                                <Label className="text-slate-300">Notes</Label>
                                <Textarea
                                  value={usageNotes}
                                  onChange={(e) => setUsageNotes(e.target.value)}
                                  placeholder="Add usage notes..."
                                  className="bg-slate-900/50 border-slate-600 text-white"
                                />
                              </div>
                              <div className="flex justify-end space-x-2">
                                <Button
                                  variant="outline"
                                  onClick={() => setIsUsageModalOpen(false)}
                                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                                >
                                  Cancel
                                </Button>
                                <Button onClick={handleRecordTipUsage}>
                                  Record Usage
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {(tipsData as any)?.pagination && (tipsData as any).pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-slate-400">
                Showing {(((tipsData as any).pagination.page - 1) * (tipsData as any).pagination.limit) + 1} to {Math.min((tipsData as any).pagination.page * (tipsData as any).pagination.limit, (tipsData as any).pagination.totalCount)} of {(tipsData as any).pagination.totalCount} tips
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!(tipsData as any).pagination.hasPrevPage}
                  onClick={() => setPage((tipsData as any).pagination.page - 1)}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  Previous
                </Button>
                <span className="text-sm text-slate-400">
                  Page {(tipsData as any).pagination.page} of {(tipsData as any).pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!(tipsData as any).pagination.hasNextPage}
                  onClick={() => setPage((tipsData as any).pagination.page + 1)}
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