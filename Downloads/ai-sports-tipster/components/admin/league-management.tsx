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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  PlusCircle,
  Edit,
  Trash2,
  Search,
  RefreshCw,
  Wifi,
  WifiOff,
  Activity,
  Settings,
  Database,
  Target,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  Globe,
  Shield,
  Zap,
  BarChart3,
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

const enrichPredictions = async (params: { limit?: number; leagueId?: string }): Promise<any> => {
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

export function AdminLeagueManagement() {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState("")
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingLeague, setEditingLeague] = useState<League | null>(null)
  const [currentTab, setCurrentTab] = useState("all")
  const [syncStatus, setSyncStatus] = useState<Record<string, SyncStatus>>({})

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

  const handleEnrichPredictions = (limit: number = 10) => {
    enrichMutation.mutate({ limit })
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
                onClick={() => handleEnrichPredictions(10)}
                disabled={enrichMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {enrichMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                <span className="ml-2">Enrich Predictions</span>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
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