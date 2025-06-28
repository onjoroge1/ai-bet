"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { CalendarIcon, Search, Filter, Package, Clock, CheckCircle, XCircle, AlertCircle, Edit3, Eye } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface Tip {
  id: string
  claimedAt: string
  status: 'claimed' | 'used' | 'expired' | 'cancelled'
  expiresAt?: string
  notes?: string
  package: {
    id: string
    name: string
    type: string
    colorGradientFrom: string
    colorGradientTo: string
    iconName: string
  }
  prediction: {
    id: string
    predictionType: string
    confidenceScore: number
    odds: number
    valueRating: string
    explanation?: string
    status: string
    match: {
      id: string
      matchDate: string
      status: string
      homeScore?: number
      awayScore?: number
      homeTeam: { id: string; name: string }
      awayTeam: { id: string; name: string }
      league: { id: string; name: string }
    }
  }
  usage?: {
    id: string
    usedAt: string
    stakeAmount?: number
    actualReturn?: number
    notes?: string
  }
}

interface Package {
  id: string
  name: string
  type: string
  status: string
  tipsRemaining: number
  totalTips: number
  purchasedAt: string
  expiresAt: string
  colorGradientFrom: string
  colorGradientTo: string
  iconName: string
}

interface TipsHistoryResponse {
  tips: Tip[]
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

export default function TipsHistory() {
  const [tips, setTips] = useState<Tip[]>([])
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState<any>(null)
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('all')
  const [packageFilter, setPackageFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState<Date>()
  const [dateTo, setDateTo] = useState<Date>()
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  
  // Modal states
  const [selectedTip, setSelectedTip] = useState<Tip | null>(null)
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  
  // Form states
  const [newStatus, setNewStatus] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [stakeAmount, setStakeAmount] = useState('')
  const [usageNotes, setUsageNotes] = useState('')

  // Fetch packages for filter
  useEffect(() => {
    fetchPackages()
  }, [])

  // Fetch tips when filters change
  useEffect(() => {
    fetchTips()
  }, [statusFilter, packageFilter, dateFrom, dateTo, searchQuery, currentPage])

  const fetchPackages = async () => {
    try {
      const response = await fetch('/api/user-packages/packages')
      if (response.ok) {
        const data = await response.json()
        setPackages(data)
      }
    } catch (error) {
      console.error('Error fetching packages:', error)
    }
  }

  const fetchTips = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        packageId: packageFilter,
        page: currentPage.toString(),
        limit: '10'
      })
      
      if (dateFrom) params.append('dateFrom', dateFrom.toISOString())
      if (dateTo) params.append('dateTo', dateTo.toISOString())
      if (searchQuery) params.append('search', searchQuery)

      const response = await fetch(`/api/user-packages/tips-history?${params}`)
      if (response.ok) {
        const data: TipsHistoryResponse = await response.json()
        setTips(data.tips)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error('Error fetching tips:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateTipStatus = async () => {
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
        fetchTips() // Refresh the list
      }
    } catch (error) {
      console.error('Error updating tip status:', error)
    }
  }

  const recordTipUsage = async () => {
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
        fetchTips() // Refresh the list
      }
    } catch (error) {
      console.error('Error recording tip usage:', error)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'claimed': return <Clock className="h-4 w-4 text-blue-500" />
      case 'used': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'expired': return <XCircle className="h-4 w-4 text-red-500" />
      case 'cancelled': return <AlertCircle className="h-4 w-4 text-orange-500" />
      default: return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'claimed': return 'bg-blue-100 text-blue-800'
      case 'used': return 'bg-green-100 text-green-800'
      case 'expired': return 'bg-red-100 text-red-800'
      case 'cancelled': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getValueRatingColor = (rating: string) => {
    switch (rating.toLowerCase()) {
      case 'very high': return 'bg-purple-100 text-purple-800'
      case 'high': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Tips History</h2>
          <p className="text-muted-foreground">
            Track your claimed tips and their usage
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search teams or leagues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
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
            <Select value={packageFilter} onValueChange={setPackageFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by package" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Packages</SelectItem>
                {packages.map((pkg) => (
                  <SelectItem key={pkg.id} value={pkg.id}>
                    {pkg.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date Range */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom ? format(dateFrom, "PPP") : "Date from"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={setDateFrom}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* Tips List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Tips</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : tips.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No tips found matching your criteria
            </div>
          ) : (
            <div className="space-y-4">
              {tips.map((tip) => (
                <div key={tip.id} className="border rounded-lg p-4 space-y-3">
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
                        <p className="font-medium">{tip.package.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Claimed {format(new Date(tip.claimedAt), "PPP")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(tip.status)}
                      <Badge className={getStatusColor(tip.status)}>
                        {tip.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Match Info */}
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{tip.prediction.match.homeTeam.name}</span>
                        <span className="text-muted-foreground">vs</span>
                        <span className="font-medium">{tip.prediction.match.awayTeam.name}</span>
                      </div>
                      <Badge variant="outline">{tip.prediction.match.league.name}</Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <span>Prediction: <strong>{tip.prediction.predictionType}</strong></span>
                      <span>Odds: <strong>{tip.prediction.odds}</strong></span>
                      <span>Confidence: <strong>{tip.prediction.confidenceScore}%</strong></span>
                      <Badge className={getValueRatingColor(tip.prediction.valueRating)}>
                        {tip.prediction.valueRating}
                      </Badge>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedTip(tip)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Tip Details</DialogTitle>
                        </DialogHeader>
                        {selectedTip && (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Status</Label>
                                <p className="text-sm">{selectedTip.status}</p>
                              </div>
                              <div>
                                <Label>Claimed</Label>
                                <p className="text-sm">{format(new Date(selectedTip.claimedAt), "PPP")}</p>
                              </div>
                            </div>
                            {selectedTip.prediction.explanation && (
                              <div>
                                <Label>Analysis</Label>
                                <p className="text-sm">{selectedTip.prediction.explanation}</p>
                              </div>
                            )}
                            {selectedTip.notes && (
                              <div>
                                <Label>Your Notes</Label>
                                <p className="text-sm">{selectedTip.notes}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>

                    {tip.status === 'claimed' && (
                      <>
                        <Dialog open={isStatusModalOpen} onOpenChange={setIsStatusModalOpen}>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setSelectedTip(tip)
                                setNewStatus(tip.status)
                                setNewNotes(tip.notes || '')
                              }}
                            >
                              <Edit3 className="h-4 w-4 mr-1" />
                              Update Status
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Update Tip Status</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label>Status</Label>
                                <Select value={newStatus} onValueChange={setNewStatus}>
                                  <SelectTrigger>
                                    <SelectValue />
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
                                <Label>Notes</Label>
                                <Textarea 
                                  value={newNotes}
                                  onChange={(e) => setNewNotes(e.target.value)}
                                  placeholder="Add notes about this tip..."
                                />
                              </div>
                              <Button onClick={updateTipStatus}>Update Status</Button>
                            </div>
                          </DialogContent>
                        </Dialog>

                        <Dialog open={isUsageModalOpen} onOpenChange={setIsUsageModalOpen}>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setSelectedTip(tip)
                                setStakeAmount('')
                                setUsageNotes('')
                              }}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Record Usage
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Record Tip Usage</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label>Stake Amount</Label>
                                <Input 
                                  type="number"
                                  value={stakeAmount}
                                  onChange={(e) => setStakeAmount(e.target.value)}
                                  placeholder="Enter stake amount..."
                                />
                              </div>
                              <div>
                                <Label>Notes</Label>
                                <Textarea 
                                  value={usageNotes}
                                  onChange={(e) => setUsageNotes(e.target.value)}
                                  placeholder="Add notes about your bet..."
                                />
                              </div>
                              <Button onClick={recordTipUsage}>Record Usage</Button>
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
          {pagination && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-muted-foreground">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.totalCount)} of {pagination.totalCount} tips
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.hasPrevPage}
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.hasNextPage}
                  onClick={() => setCurrentPage(currentPage + 1)}
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