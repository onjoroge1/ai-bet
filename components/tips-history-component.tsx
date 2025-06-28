"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Search, 
  Filter, 
  Download, 
  TrendingUp, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle,
  Calendar,
  Package,
  Target,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff
} from "lucide-react"
import { useAuth } from "@/components/auth-provider"

interface TipHistoryItem {
  id: string
  tipName: string
  claimedAt: string
  status: 'claimed' | 'used' | 'expired'
  packageName: string
  matchDetails?: {
    homeTeam: string
    awayTeam: string
    prediction: string
    confidence: number
    odds: number
    result?: 'won' | 'lost' | 'pending'
  }
}

export function TipsHistoryComponent() {
  const [tips, setTips] = useState<TipHistoryItem[]>([])
  const [filteredTips, setFilteredTips] = useState<TipHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [packageFilter, setPackageFilter] = useState("all")
  const [sortBy, setSortBy] = useState("date")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [expandedTip, setExpandedTip] = useState<string | null>(null)
  const { user } = useAuth()

  useEffect(() => {
    const fetchTips = async () => {
      try {
        setIsLoading(true)
        const response = await fetch('/api/tips-history')
        
        if (!response.ok) {
          throw new Error('Failed to fetch tips history')
        }
        
        const data = await response.json()
        setTips(data.tips || [])
        setFilteredTips(data.tips || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tips history')
      } finally {
        setIsLoading(false)
      }
    }

    if (user) {
      fetchTips()
    }
  }, [user])

  useEffect(() => {
    let filtered = [...tips]

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(tip => 
        tip.tipName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tip.packageName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tip.matchDetails?.homeTeam.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tip.matchDetails?.awayTeam.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(tip => tip.status === statusFilter)
    }

    // Apply package filter
    if (packageFilter !== "all") {
      filtered = filtered.filter(tip => tip.packageName === packageFilter)
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortBy) {
        case "date":
          aValue = new Date(a.claimedAt).getTime()
          bValue = new Date(b.claimedAt).getTime()
          break
        case "confidence":
          aValue = a.matchDetails?.confidence || 0
          bValue = b.matchDetails?.confidence || 0
          break
        case "name":
          aValue = a.tipName.toLowerCase()
          bValue = b.tipName.toLowerCase()
          break
        default:
          aValue = new Date(a.claimedAt).getTime()
          bValue = new Date(b.claimedAt).getTime()
      }

      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    setFilteredTips(filtered)
  }, [tips, searchTerm, statusFilter, packageFilter, sortBy, sortOrder])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'claimed':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />
      case 'used':
        return <TrendingUp className="w-4 h-4 text-blue-500" />
      case 'expired':
        return <XCircle className="w-4 h-4 text-red-500" />
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'claimed':
        return <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400">Claimed</Badge>
      case 'used':
        return <Badge variant="secondary" className="bg-blue-500/20 text-blue-400">Used</Badge>
      case 'expired':
        return <Badge variant="secondary" className="bg-red-500/20 text-red-400">Expired</Badge>
      default:
        return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400">Unknown</Badge>
    }
  }

  const getResultBadge = (result?: string) => {
    switch (result) {
      case 'won':
        return <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400">Won</Badge>
      case 'lost':
        return <Badge variant="secondary" className="bg-red-500/20 text-red-400">Lost</Badge>
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400">Pending</Badge>
      default:
        return null
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortBy(field)
      setSortOrder("desc")
    }
  }

  const getUniquePackages = () => {
    const packages = tips.map(tip => tip.packageName)
    return Array.from(new Set(packages))
  }

  if (!user) {
    return null
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
          <div>
            <CardTitle className="text-white">Your Tips History</CardTitle>
            <CardDescription className="text-slate-400">
              {filteredTips.length} of {tips.length} tips
            </CardDescription>
          </div>

          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full lg:w-auto">
            <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-700">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Search tips..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-slate-900/50 border-slate-600 text-white"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="claimed">Claimed</SelectItem>
              <SelectItem value="used">Used</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>

          <Select value={packageFilter} onValueChange={setPackageFilter}>
            <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
              <SelectValue placeholder="Package" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Packages</SelectItem>
              {getUniquePackages().map(pkg => (
                <SelectItem key={pkg} value={pkg}>{pkg}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="confidence">Confidence</SelectItem>
              <SelectItem value="name">Name</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tips List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-400">{error}</p>
          </div>
        ) : filteredTips.length === 0 ? (
          <div className="text-center py-12">
            <Target className="w-12 h-12 text-slate-500 mx-auto mb-4" />
            <p className="text-slate-400 mb-2">No tips found</p>
            <p className="text-slate-500 text-sm">
              {searchTerm || statusFilter !== "all" || packageFilter !== "all" 
                ? "Try adjusting your filters" 
                : "Start claiming tips to see them here"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTips.map((tip) => (
              <div key={tip.id} className="bg-slate-700/30 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    {getStatusIcon(tip.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="text-white font-medium truncate">{tip.tipName}</h3>
                        {getStatusBadge(tip.status)}
                        {tip.matchDetails?.result && getResultBadge(tip.matchDetails.result)}
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
                        <div className="flex items-center space-x-1">
                          <Package className="w-3 h-3 text-slate-500" />
                          <span className="text-slate-400">{tip.packageName}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          <span className="text-slate-400">{formatDate(tip.claimedAt)}</span>
                        </div>
                        {tip.matchDetails && (
                          <>
                            <div className="text-slate-400">
                              {tip.matchDetails.homeTeam} vs {tip.matchDetails.awayTeam}
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-emerald-400 font-medium">
                                {tip.matchDetails.prediction}
                              </span>
                              <Badge variant="secondary" className="bg-slate-700 text-slate-300 text-xs">
                                {tip.matchDetails.confidence}%
                              </Badge>
                              {tip.matchDetails.odds && (
                                <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 text-xs">
                                  {tip.matchDetails.odds}
                                </Badge>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedTip(expandedTip === tip.id ? null : tip.id)}
                    className="text-slate-400 hover:text-white"
                  >
                    {expandedTip === tip.id ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </Button>
                </div>

                {/* Expanded Details */}
                {expandedTip === tip.id && (
                  <div className="mt-4 pt-4 border-t border-slate-600">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-white font-medium mb-2">Match Details</h4>
                        {tip.matchDetails ? (
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Teams:</span>
                              <span className="text-white">
                                {tip.matchDetails.homeTeam} vs {tip.matchDetails.awayTeam}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Prediction:</span>
                              <span className="text-emerald-400 font-medium">
                                {tip.matchDetails.prediction}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Confidence:</span>
                              <span className="text-white">{tip.matchDetails.confidence}%</span>
                            </div>
                            {tip.matchDetails.odds && (
                              <div className="flex justify-between">
                                <span className="text-slate-400">Odds:</span>
                                <span className="text-white">{tip.matchDetails.odds}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-slate-400 text-sm">No match details available</p>
                        )}
                      </div>
                      
                      <div>
                        <h4 className="text-white font-medium mb-2">Package Info</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Package:</span>
                            <span className="text-white">{tip.packageName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Claimed:</span>
                            <span className="text-white">{formatDate(tip.claimedAt)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Status:</span>
                            {getStatusBadge(tip.status)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
} 