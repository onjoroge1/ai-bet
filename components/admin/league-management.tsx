"use client"

import React, { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  PlusCircle,
  Edit,
  Trash2,
  Search,
  RefreshCw,
  Wifi,
  Activity,
  Settings,
  Database,
  Target,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  XCircle,
  Globe,
  Zap,
  Calendar,
  Users,
  Trophy
} from "lucide-react"
import { toast } from "sonner"

// Types for league management
type League = {
  id: string
  name: string
  countryCode?: string
  sport: string
  isActive: boolean
  logoUrl?: string
  externalLeagueId?: string
  isDataCollectionEnabled: boolean
  dataCollectionPriority: number
  lastDataSync?: string
  syncFrequency: string
  matchLimit: number
  isPredictionEnabled: boolean
  createdAt: string
  updatedAt: string
  _count: {
    matches: number
    teams: number
  }
}

type LeagueFormData = {
  name: string
  countryCode: string
  sport: string
  isActive: boolean
  logoUrl: string
  externalLeagueId: string
  isDataCollectionEnabled: boolean
  dataCollectionPriority: number
  syncFrequency: string
  matchLimit: number
  isPredictionEnabled: boolean
}

type SyncStatus = {
  success: boolean
  message: string
  data: {
    leagueId: string
    leagueName: string
    matchesFetched?: number
    connectionStatus?: string
    lastSync?: string
  }
}

// API functions
const fetchLeagues = async (): Promise<League[]> => {
  const response = await fetch('/api/admin/leagues')
  if (!response.ok) {
    throw new Error('Failed to fetch leagues')
  }
  return response.json()
}

const createLeague = async (data: LeagueFormData): Promise<League> => {
  const response = await fetch('/api/admin/leagues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create league')
  }
  return response.json()
}

const updateLeague = async (data: LeagueFormData & { id: string }): Promise<League> => {
  const response = await fetch('/api/admin/leagues', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update league')
  }
  return response.json()
}

const deleteLeague = async (id: string): Promise<void> => {
  const response = await fetch(`/api/admin/leagues?id=${id}`, {
    method: 'DELETE'
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete league')
  }
}

const syncLeague = async (id: string): Promise<SyncStatus> => {
  const response = await fetch(`/api/admin/leagues/${id}/sync`, {
    method: 'POST'
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to sync league')
  }
  return response.json()
}

const testConnection = async (id: string): Promise<SyncStatus> => {
  const response = await fetch(`/api/admin/leagues/${id}/sync`)
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to test connection')
  }
  return response.json()
}

const enrichPredictions = async (params: { limit?: number; leagueId?: string; timeWindow?: string }): Promise<any> => {
  const response = await fetch('/api/admin/predictions/enrich-quickpurchases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to enrich predictions')
  }
  return response.json()
}

const getEnrichmentStatus = async (): Promise<any> => {
  const response = await fetch('/api/admin/predictions/enrich-quickpurchases')
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to get enrichment status')
  }
  return response.json()
}

const syncPredictions = async (params: { timeWindow: string; leagueId?: string; limit?: number }): Promise<any> => {
  const response = await fetch('/api/admin/predictions/sync-quickpurchases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to sync predictions')
  }
  return response.json()
}

const triggerConsensus = async (matchIds: number[]): Promise<any> => {
  const response = await fetch('/api/admin/predictions/trigger-consensus', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ matchIds })
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to trigger consensus')
  }
  return response.json()
}

export function AdminLeagueManagement() {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState("")
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingLeague, setEditingLeague] = useState<League | null>(null)
  const [currentTab, setCurrentTab] = useState("all")
  const [selectedLeagueForMatches, setSelectedLeagueForMatches] = useState("all")
  const [upcomingMatches, setUpcomingMatches] = useState<any[]>([])
  const [upcomingMatchesStatus, setUpcomingMatchesStatus] = useState<any>(null)

  // Queries
  const { data: leagues = [], isLoading, error } = useQuery({
    queryKey: ['admin-leagues'],
    queryFn: fetchLeagues
  })

  const { data: enrichmentStatus } = useQuery({
    queryKey: ['enrichment-status'],
    queryFn: getEnrichmentStatus,
    refetchInterval: 30000 // Refresh every 30 seconds
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: createLeague,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-leagues'] })
      toast.success('League created successfully')
      setIsFormOpen(false)
    },
    onError: (error) => {
      toast.error(error.message)
    }
  })

  const updateMutation = useMutation({
    mutationFn: updateLeague,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-leagues'] })
      toast.success('League updated successfully')
      setIsFormOpen(false)
      setEditingLeague(null)
    },
    onError: (error) => {
      toast.error(error.message)
    }
  })

  const deleteMutation = useMutation({
    mutationFn: deleteLeague,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-leagues'] })
      toast.success('League deleted successfully')
    },
    onError: (error) => {
      toast.error(error.message)
    }
  })

  const syncMutation = useMutation({
    mutationFn: syncLeague,
    onSuccess: (data, leagueId) => {
      setSyncStatus(prev => ({ ...prev, [leagueId]: data }))
      queryClient.invalidateQueries({ queryKey: ['admin-leagues'] })
      toast.success(data.message)
    },
    onError: (error) => {
      toast.error(error.message)
    }
  })

  const testConnectionMutation = useMutation({
    mutationFn: testConnection,
    onSuccess: (data, leagueId) => {
      setSyncStatus(prev => ({ ...prev, [leagueId]: data }))
      toast.success(data.message)
    },
    onError: (error) => {
      toast.error(error.message)
    }
  })

  const enrichMutation = useMutation({
    mutationFn: enrichPredictions,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['enrichment-status'] })
      toast.success(data.message)
    },
    onError: (error) => {
      toast.error(error.message)
    }
  })

  const syncPredictionsMutation = useMutation({
    mutationFn: syncPredictions,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['enrichment-status'] })
      toast.success(data.message)
    },
    onError: (error) => {
      toast.error(error.message)
    }
  })

  const syncMatchesMutation = useMutation({
    mutationFn: async () => {
      console.log('🌐 Making API call to upcoming matches')
      const leagueId = selectedLeagueForMatches === 'all' ? undefined : selectedLeagueForMatches
      const params = new URLSearchParams()
      if (leagueId) params.append('leagueId', leagueId)
      params.append('timeWindow', '72h')
      const url = `/api/admin/predictions/upcoming-matches?${params.toString()}`
      console.log('📡 API URL:', url)
      const response = await fetch(url)
      console.log('📡 API Response status:', response.status)
      if (!response.ok) {
        throw new Error('Failed to fetch upcoming matches')
      }
      return response.json()
    },
    onSuccess: (data) => {
      console.log('Sync matches success:', data)
      console.log('Matches data:', data.data.matches)
      console.log('Counts data:', data.data.counts)
      
      setUpcomingMatches(data.data.matches || [])
      setUpcomingMatchesStatus({
        data: {
          totalMatches: data.data.counts.total || 0,
          newMatches: data.data.counts['72h'] || 0,
          lastSync: new Date().toISOString(),
          counts: data.data.counts
        }
      })
      toast.success(`Found ${data.data.counts.total || 0} upcoming matches`)
    },
    onError: (error) => {
      toast.error(error.message)
    }
  })

  const triggerConsensusMutation = useMutation({
    mutationFn: triggerConsensus,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['enrichment-status'] })
      toast.success(data.message)
    },
    onError: (error) => {
      toast.error(error.message)
    }
  })

  // Filtered leagues
  const filteredLeagues = useMemo(() => {
    return leagues
      .filter((league) => {
        if (currentTab === "active") return league.isActive
        if (currentTab === "inactive") return !league.isActive
        if (currentTab === "collecting") return league.isDataCollectionEnabled
        if (currentTab === "not-collecting") return !league.isDataCollectionEnabled
        return true
      })
      .filter((league) => {
        const searchLower = searchTerm.toLowerCase()
        return (
          league.name.toLowerCase().includes(searchLower) ||
          league.countryCode?.toLowerCase().includes(searchLower) ||
          league.sport.toLowerCase().includes(searchLower)
        )
      })
      .sort((a, b) => b.dataCollectionPriority - a.dataCollectionPriority)
  }, [leagues, searchTerm, currentTab])

  // Handlers
  const handleCreate = () => {
    setEditingLeague(null)
    setIsFormOpen(true)
  }

  const handleEdit = (league: League) => {
    setEditingLeague(league)
    setIsFormOpen(true)
  }

  const handleDelete = (league: League) => {
    if (window.confirm(`Are you sure you want to delete "${league.name}"?`)) {
      deleteMutation.mutate(league.id)
    }
  }

  const handleSync = (leagueId: string) => {
    syncMutation.mutate(leagueId)
  }

  const handleTestConnection = (leagueId: string) => {
    testConnectionMutation.mutate(leagueId)
  }

  const handleEnrichPredictions = (limit: number = 100) => {
    // Use the new availability-based enrichment system
    // This will call /predict/availability first, then only /predict for ready matches
    // No timeWindow needed since /predict/availability handles timing logic
    enrichMutation.mutate({ 
      limit,
      leagueId: selectedLeagueForMatches === 'all' ? undefined : selectedLeagueForMatches
    })
  }

  const handleSyncUpcomingMatches = () => {
    console.log('🔄 Sync upcoming matches button clicked')
    syncMatchesMutation.mutate()
  }


  const handleSyncAllUpcoming = () => {
    // Sync all upcoming matches (not time window specific)
    syncPredictionsMutation.mutate({
      timeWindow: 'all',
      leagueId: selectedLeagueForMatches === 'all' ? undefined : selectedLeagueForMatches,
      limit: 100
    })
  }

  const handleTriggerConsensus = () => {
    // Get all waiting matches and trigger consensus
    const waitingMatches = upcomingMatches
      .filter(match => match.predictionType === 'waiting_consensus')
      .map(match => parseInt(match.matchId))
      .filter(id => !isNaN(id))
    
    if (waitingMatches.length === 0) {
      toast.info('No matches are currently waiting for consensus')
      return
    }
    
    triggerConsensusMutation.mutate(waitingMatches)
  }

  const handleSave = (formData: LeagueFormData) => {
    if (editingLeague) {
      updateMutation.mutate({ ...formData, id: editingLeague.id })
    } else {
      createMutation.mutate(formData)
    }
  }

  // Helper functions
  const getSyncHealthColor = (league: League) => {
    if (!league.lastDataSync) return "text-slate-400"
    
    const now = new Date()
    const lastSync = new Date(league.lastDataSync)
    const hoursSinceLastSync = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60)
    
    switch (league.syncFrequency) {
      case 'hourly':
        return hoursSinceLastSync <= 1 ? "text-green-400" : hoursSinceLastSync <= 2 ? "text-yellow-400" : "text-red-400"
      case 'daily':
        return hoursSinceLastSync <= 24 ? "text-green-400" : hoursSinceLastSync <= 48 ? "text-yellow-400" : "text-red-400"
      case 'weekly':
        return hoursSinceLastSync <= 168 ? "text-green-400" : hoursSinceLastSync <= 336 ? "text-yellow-400" : "text-red-400"
      default:
        return "text-slate-400"
    }
  }

  const getSyncHealthIcon = (league: League) => {
    if (!league.lastDataSync) return <Clock className="w-4 h-4" />
    
    const now = new Date()
    const lastSync = new Date(league.lastDataSync)
    const hoursSinceLastSync = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60)
    
    switch (league.syncFrequency) {
      case 'hourly':
        return hoursSinceLastSync <= 1 ? <CheckCircle className="w-4 h-4" /> : hoursSinceLastSync <= 2 ? <AlertCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />
      case 'daily':
        return hoursSinceLastSync <= 24 ? <CheckCircle className="w-4 h-4" /> : hoursSinceLastSync <= 48 ? <AlertCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />
      case 'weekly':
        return hoursSinceLastSync <= 168 ? <CheckCircle className="w-4 h-4" /> : hoursSinceLastSync <= 336 ? <AlertCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />
      default:
        return <Clock className="w-4 h-4" />
    }
  }

  if (error) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-6">
          <div className="text-center text-red-400">
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            <p>Failed to load leagues: {error.message}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center">
            <Trophy className="w-6 h-6 mr-2 text-emerald-400" />
            League Management
          </h2>
          <p className="text-slate-400 mt-1">
            Manage leagues, data collection, and sync settings
          </p>
        </div>
        <Button onClick={handleCreate} className="bg-emerald-600 hover:bg-emerald-700">
          <PlusCircle className="w-4 h-4 mr-2" />
          Add League
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Total Leagues</p>
                <p className="text-2xl font-bold text-white">{leagues.length}</p>
              </div>
              <Globe className="w-8 h-8 text-emerald-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Active Collection</p>
                <p className="text-2xl font-bold text-white">
                  {leagues.filter(l => l.isDataCollectionEnabled).length}
                </p>
              </div>
              <Database className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Total Matches</p>
                <p className="text-2xl font-bold text-white">
                  {leagues.reduce((sum, l) => sum + l._count.matches, 0)}
                </p>
              </div>
              <Target className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Total Teams</p>
                <p className="text-2xl font-bold text-white">
                  {leagues.reduce((sum, l) => sum + l._count.teams, 0)}
                </p>
              </div>
              <Users className="w-8 h-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Prediction Enrichment Section */}
      {enrichmentStatus && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <div className="flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-blue-400" />
                Prediction Enrichment
              </div>
              <Button
                onClick={() => handleEnrichPredictions()}
                disabled={enrichMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
                title="Uses availability system - only processes ready matches"
              >
                {enrichMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                <span className="ml-2">Enrich All Predictions (Smart)</span>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-sm text-blue-300">
                <strong>Smart Enrichment:</strong> Processes all pending matches using the availability system to check which are ready for prediction before calling the backend. No time window filtering needed - the backend determines readiness based on consensus data availability.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-slate-400 text-sm">Total QuickPurchases</p>
                <p className="text-2xl font-bold text-white">{enrichmentStatus.data?.totalQuickPurchases || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-slate-400 text-sm">Enriched</p>
                <p className="text-2xl font-bold text-green-400">{enrichmentStatus.data?.enrichedQuickPurchases || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-slate-400 text-sm">Pending</p>
                <p className="text-2xl font-bold text-yellow-400">{enrichmentStatus.data?.pendingEnrichment || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-slate-400 text-sm">Enrichment Rate</p>
                <p className="text-2xl font-bold text-blue-400">{enrichmentStatus.data?.enrichmentRate || 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Matches Section */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <div className="flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-purple-400" />
              Upcoming Matches
            </div>
            <div className="flex items-center space-x-2">
              <Select value={selectedLeagueForMatches} onValueChange={setSelectedLeagueForMatches}>
                <SelectTrigger className="w-40 bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="Select League" />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  <SelectItem value="all">All Leagues</SelectItem>
                  {leagues.map((league) => (
                    <SelectItem key={league.id} value={league.id}>
                      {league.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleSyncUpcomingMatches}
                disabled={syncMatchesMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {syncMatchesMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                <span className="ml-2">Sync Matches</span>
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingMatchesStatus ? (
            <div className="space-y-4">
              {/* Debug info */}
              <div className="text-xs text-slate-500 mb-2">
                Debug: upcomingMatches.length = {upcomingMatches.length}, 
                upcomingMatchesStatus.data.totalMatches = {upcomingMatchesStatus.data?.totalMatches}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                <div className="text-center">
                  <p className="text-slate-400 text-sm">Total Matches</p>
                  <p className="text-2xl font-bold text-white">{upcomingMatchesStatus.data?.totalMatches || 0}</p>
                </div>
                <div className="text-center">
                  <p className="text-slate-400 text-sm">72h Window</p>
                  <p className="text-2xl font-bold text-blue-400">{upcomingMatchesStatus.data?.counts?.['72h'] || 0}</p>
                </div>
                <div className="text-center">
                  <p className="text-slate-400 text-sm">48h Window</p>
                  <p className="text-2xl font-bold text-yellow-400">{upcomingMatchesStatus.data?.counts?.['48h'] || 0}</p>
                </div>
                <div className="text-center">
                  <p className="text-slate-400 text-sm">24h Window</p>
                  <p className="text-2xl font-bold text-orange-400">{upcomingMatchesStatus.data?.counts?.['24h'] || 0}</p>
                </div>
                <div className="text-center">
                  <p className="text-slate-400 text-sm">Urgent (≤6h)</p>
                  <p className="text-2xl font-bold text-red-400">{upcomingMatchesStatus.data?.counts?.['urgent'] || 0}</p>
                </div>
              </div>
              
              <div className="flex items-center justify-center space-x-4 mb-6">
                <Button
                  onClick={handleSyncAllUpcoming}
                  disabled={syncPredictionsMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 px-6 py-2"
                  size="lg"
                >
                  {syncPredictionsMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Zap className="w-4 h-4 mr-2" />
                  )}
                  Sync All Upcoming Matches
                </Button>
                <Button
                  onClick={handleTriggerConsensus}
                  disabled={triggerConsensusMutation.isPending}
                  className="bg-orange-600 hover:bg-orange-700 px-6 py-2"
                  size="lg"
                >
                  {triggerConsensusMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Activity className="w-4 h-4 mr-2" />
                  )}
                  Trigger Consensus
                </Button>
              </div>
              
              {upcomingMatches.length > 0 && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-900/50">
                      <TableRow className="border-slate-700">
                        <TableHead className="text-white">Match</TableHead>
                        <TableHead className="text-white">League</TableHead>
                        <TableHead className="text-white">Date & Time</TableHead>
                        <TableHead className="text-white">Prediction Status</TableHead>
                        <TableHead className="text-white">Enrichment History</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {upcomingMatches.slice(0, 10).map((match) => (
                        <TableRow key={match.id} className="border-slate-700">
                          <TableCell className="text-white">
                            <div>
                              <p className="font-medium">{match.homeTeam} vs {match.awayTeam}</p>
                              <p className="text-sm text-slate-400">{match.venue || 'TBD'}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-white">
                            <Badge variant="outline" className="border-slate-600 text-slate-300">
                              {match.league || 'Unknown'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-white">
                            <div>
                              <p>{match.matchDate ? new Date(match.matchDate).toLocaleDateString() : 'TBD'}</p>
                              <p className="text-sm text-slate-400">
                                {match.hoursUntilMatch !== null ? `${match.hoursUntilMatch}h until match` : 'Unknown'}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-white">
                            {match.predictionType === 'waiting_consensus' ? (
                              <Badge variant="outline" className="border-blue-600 text-blue-400">
                                <Clock className="w-3 h-3 mr-1" />
                                Collecting Odds
                              </Badge>
                            ) : match.predictionType === 'no_odds' ? (
                              <Badge variant="outline" className="border-gray-600 text-gray-400">
                                <XCircle className="w-3 h-3 mr-1" />
                                No Markets
                              </Badge>
                            ) : match.hasPrediction && match.confidenceScore > 0 ? (
                              <Badge variant="outline" className="border-green-600 text-green-400">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                {match.predictionType} ({match.confidenceScore}%)
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-yellow-600 text-yellow-400">
                                <Clock className="w-3 h-3 mr-1" />
                                No Prediction
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-white">
                            <div className="text-sm">
                              <p>Enriched: {match.enrichmentCount || 0}x</p>
                              <p className="text-slate-400">
                                {match.lastEnrichmentAt ? 
                                  new Date(match.lastEnrichmentAt).toLocaleString() : 
                                  'Never'
                                }
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {upcomingMatches.length > 10 && (
                    <p className="text-center text-slate-400 text-sm mt-2">
                      Showing first 10 matches. Total: {upcomingMatches.length}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-400">No upcoming matches data available</p>
              <p className="text-slate-500 text-sm">Click &quot;Sync Matches&quot; to fetch the latest data</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters and Search */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Tabs value={currentTab} onValueChange={setCurrentTab}>
            <TabsList className="bg-slate-700">
              <TabsTrigger value="all" className="text-slate-300">All</TabsTrigger>
              <TabsTrigger value="active" className="text-slate-300">Active</TabsTrigger>
              <TabsTrigger value="inactive" className="text-slate-300">Inactive</TabsTrigger>
              <TabsTrigger value="collecting" className="text-slate-300">Collecting</TabsTrigger>
              <TabsTrigger value="not-collecting" className="text-slate-300">Not Collecting</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search leagues..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-700 border-slate-600 text-white placeholder-slate-400"
          />
        </div>
      </div>

      {/* Leagues Table */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Settings className="w-5 h-5 mr-2 text-emerald-400" />
            Leagues ({filteredLeagues.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-900/50">
                  <TableRow className="border-slate-700">
                    <TableHead className="text-white">League</TableHead>
                    <TableHead className="text-white">Status</TableHead>
                    <TableHead className="text-white">Data Collection</TableHead>
                    <TableHead className="text-white">Sync Status</TableHead>
                    <TableHead className="text-white">Stats</TableHead>
                    <TableHead className="text-white">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeagues.map((league) => (
                    <TableRow key={league.id} className="border-slate-700 hover:bg-slate-700/30">
                      <TableCell>
                        <div>
                          <div className="font-medium text-white">{league.name}</div>
                          <div className="text-xs text-slate-400">
                            {league.countryCode && `${league.countryCode} • `}{league.sport}
                            {league.externalLeagueId && ` • ID: ${league.externalLeagueId}`}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={league.isActive ? "default" : "secondary"}>
                          {league.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={league.isDataCollectionEnabled}
                            disabled
                            className="data-[state=checked]:bg-emerald-600"
                          />
                          <span className="text-sm text-slate-300">
                            {league.isDataCollectionEnabled ? "Enabled" : "Disabled"}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          Priority: {league.dataCollectionPriority} • {league.syncFrequency}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <div className={getSyncHealthColor(league)}>
                            {getSyncHealthIcon(league)}
                          </div>
                          <div>
                            <div className="text-sm text-slate-300">
                              {league.lastDataSync 
                                ? new Date(league.lastDataSync).toLocaleDateString()
                                : "Never"
                              }
                            </div>
                            <div className="text-xs text-slate-400">
                              {league.syncFrequency} sync
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-slate-300">
                          <div>{league._count.matches} matches</div>
                          <div>{league._count.teams} teams</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleTestConnection(league.id)}
                            disabled={testConnectionMutation.isPending}
                            className="text-slate-300 border-slate-600 hover:bg-slate-700"
                          >
                            {testConnectionMutation.isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Wifi className="w-3 h-3" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSync(league.id)}
                            disabled={syncMutation.isPending || !league.isDataCollectionEnabled}
                            className="text-slate-300 border-slate-600 hover:bg-slate-700"
                          >
                            {syncMutation.isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3 h-3" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(league)}
                            className="text-slate-300 border-slate-600 hover:bg-slate-700"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(league)}
                            disabled={league._count.matches > 0 || league._count.teams > 0}
                            className="text-red-400 border-red-600 hover:bg-red-900/20"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* League Form Dialog */}
      <LeagueForm
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false)
          setEditingLeague(null)
        }}
        onSave={handleSave}
        league={editingLeague}
      />
    </div>
  )
}

// League Form Component
function LeagueForm({
  isOpen,
  onClose,
  onSave,
  league
}: {
  isOpen: boolean
  onClose: () => void
  onSave: (data: LeagueFormData) => void
  league: League | null
}) {
  const [formData, setFormData] = useState<LeagueFormData>({
    name: "",
    countryCode: "",
    sport: "football",
    isActive: true,
    logoUrl: "",
    externalLeagueId: "",
    isDataCollectionEnabled: true,
    dataCollectionPriority: 0,
    syncFrequency: "daily",
    matchLimit: 10,
    isPredictionEnabled: true
  })

  // Reset form when league changes
  React.useEffect(() => {
    if (league) {
      setFormData({
        name: league.name,
        countryCode: league.countryCode || "",
        sport: league.sport,
        isActive: league.isActive,
        logoUrl: league.logoUrl || "",
        externalLeagueId: league.externalLeagueId || "",
        isDataCollectionEnabled: league.isDataCollectionEnabled,
        dataCollectionPriority: league.dataCollectionPriority,
        syncFrequency: league.syncFrequency,
        matchLimit: league.matchLimit,
        isPredictionEnabled: league.isPredictionEnabled
      })
    } else {
      setFormData({
        name: "",
        countryCode: "",
        sport: "football",
        isActive: true,
        logoUrl: "",
        externalLeagueId: "",
        isDataCollectionEnabled: true,
        dataCollectionPriority: 0,
        syncFrequency: "daily",
        matchLimit: 10,
        isPredictionEnabled: true
      })
    }
  }, [league])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-slate-800 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-emerald-400">
            {league ? "Edit League" : "Add New League"}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Configure league settings and data collection parameters.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name" className="text-slate-300">League Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div>
              <Label htmlFor="countryCode" className="text-slate-300">Country Code</Label>
              <Input
                id="countryCode"
                value={formData.countryCode}
                onChange={(e) => setFormData(prev => ({ ...prev, countryCode: e.target.value }))}
                placeholder="e.g., EN, ES, DE"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="sport" className="text-slate-300">Sport</Label>
              <Select
                value={formData.sport}
                onValueChange={(value) => setFormData(prev => ({ ...prev, sport: value }))}
              >
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  <SelectItem value="football">Football</SelectItem>
                  <SelectItem value="basketball">Basketball</SelectItem>
                  <SelectItem value="tennis">Tennis</SelectItem>
                  <SelectItem value="cricket">Cricket</SelectItem>
                  <SelectItem value="rugby">Rugby</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="externalLeagueId" className="text-slate-300">External League ID</Label>
              <Input
                id="externalLeagueId"
                value={formData.externalLeagueId}
                onChange={(e) => setFormData(prev => ({ ...prev, externalLeagueId: e.target.value }))}
                placeholder="e.g., 71"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="logoUrl" className="text-slate-300">Logo URL</Label>
            <Input
              id="logoUrl"
              value={formData.logoUrl}
              onChange={(e) => setFormData(prev => ({ ...prev, logoUrl: e.target.value }))}
              placeholder="https://example.com/logo.png"
              className="bg-slate-700 border-slate-600 text-white"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dataCollectionPriority" className="text-slate-300">Collection Priority</Label>
              <Input
                id="dataCollectionPriority"
                type="number"
                value={formData.dataCollectionPriority}
                onChange={(e) => setFormData(prev => ({ ...prev, dataCollectionPriority: parseInt(e.target.value) || 0 }))}
                min="0"
                max="100"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div>
              <Label htmlFor="matchLimit" className="text-slate-300">Match Limit</Label>
              <Input
                id="matchLimit"
                type="number"
                value={formData.matchLimit}
                onChange={(e) => setFormData(prev => ({ ...prev, matchLimit: parseInt(e.target.value) || 10 }))}
                min="1"
                max="100"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="syncFrequency" className="text-slate-300">Sync Frequency</Label>
            <Select
              value={formData.syncFrequency}
              onValueChange={(value) => setFormData(prev => ({ ...prev, syncFrequency: value }))}
            >
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700 text-white">
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-slate-300">Active League</Label>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                className="data-[state=checked]:bg-emerald-600"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-slate-300">Enable Data Collection</Label>
              <Switch
                checked={formData.isDataCollectionEnabled}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isDataCollectionEnabled: checked }))}
                className="data-[state=checked]:bg-emerald-600"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-slate-300">Enable Predictions</Label>
              <Switch
                checked={formData.isPredictionEnabled}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isPredictionEnabled: checked }))}
                className="data-[state=checked]:bg-emerald-600"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} className="border-slate-600 text-slate-300">
              Cancel
            </Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
              {league ? "Update League" : "Create League"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 