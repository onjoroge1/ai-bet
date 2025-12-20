"use client"

import React, { useState, useEffect } from "react"
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
import { Badge } from "@/components/ui/badge"
import {
  PlusCircle,
  Search,
  Loader2,
  Target,
  Calendar,
  Users,
  Trophy,
  Zap,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react"
import { toast } from "sonner"

// Types
type Match = {
  match_id: number
  home_team: string
  away_team: string
  league: string
  date: string
  venue?: string
  hasQuickPurchase: boolean
  quickPurchaseId?: string
}

type Country = {
  id: string
  name: string
  currencyCode: string
  currencySymbol: string
}

type CreateQuickPurchaseData = {
  matchId: number
  countryId: string
  price: string
  name?: string
  description?: string
}

// API functions
const fetchMatches = async (leagueId: string = '39', limit: string = '10'): Promise<{ matches: Match[], filters: any }> => {
  const response = await fetch(`/api/predictions/create-quickpurchase?league_id=${leagueId}&limit=${limit}`)
  if (!response.ok) {
    throw new Error('Failed to fetch matches')
  }
  return response.json()
}

const fetchCountries = async (): Promise<Country[]> => {
  const response = await fetch('/api/countries')
  if (!response.ok) {
    throw new Error('Failed to fetch countries')
  }
  return response.json()
}

const createQuickPurchase = async (data: CreateQuickPurchaseData): Promise<any> => {
  const response = await fetch('/api/predictions/create-quickpurchase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create QuickPurchase')
  }
  return response.json()
}

interface PredictionQuickPurchaseManagerProps {
  shouldLoadData?: boolean
}

export function PredictionQuickPurchaseManager({ shouldLoadData = true }: PredictionQuickPurchaseManagerProps) {
  const [matches, setMatches] = useState<Match[]>([])
  const [countries, setCountries] = useState<Country[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedLeague, setSelectedLeague] = useState("39")
  const [formData, setFormData] = useState<CreateQuickPurchaseData>({
    matchId: 0,
    countryId: "",
    price: "",
    name: "",
    description: ""
  })

  // Load data only when shouldLoadData is true
  useEffect(() => {
    if (shouldLoadData) {
      loadData()
    } else {
      setIsLoading(false)
    }
  }, [selectedLeague, shouldLoadData])

  const loadData = async () => {
    try {
      setIsLoading(true)
      const [matchesData, countriesData] = await Promise.all([
        fetchMatches(selectedLeague, '20'),
        fetchCountries()
      ])
      setMatches(matchesData.matches)
      setCountries(countriesData)
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateQuickPurchase = (match: Match) => {
    setSelectedMatch(match)
    setFormData({
      matchId: match.match_id,
      countryId: "",
      price: "",
      name: `${match.home_team} vs ${match.away_team} - Expert Prediction`,
      description: `Get our AI-powered prediction for ${match.home_team} vs ${match.away_team} in ${match.league}`
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async () => {
    if (!formData.countryId || !formData.price) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      setIsCreating(true)
      await createQuickPurchase(formData)
      toast.success('QuickPurchase created successfully!')
      setIsModalOpen(false)
      loadData() // Refresh the matches list
    } catch (error) {
      console.error('Error creating QuickPurchase:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create QuickPurchase')
    } finally {
      setIsCreating(false)
    }
  }

  const filteredMatches = matches.filter(match => {
    const searchLower = searchTerm.toLowerCase()
    return (
      match.home_team.toLowerCase().includes(searchLower) ||
      match.away_team.toLowerCase().includes(searchLower) ||
      match.league.toLowerCase().includes(searchLower)
    )
  })

  const formatMatchDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (isLoading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            <span className="ml-2 text-slate-300">Loading matches...</span>
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
            <Target className="w-6 h-6 mr-2 text-emerald-400" />
            Prediction QuickPurchase Manager
          </h2>
          <p className="text-slate-400 mt-1">
            Create purchasable predictions from upcoming matches
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Total Matches</p>
                <p className="text-2xl font-bold text-white">{matches.length}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Available for Purchase</p>
                <p className="text-2xl font-bold text-white">
                  {matches.filter(m => !m.hasQuickPurchase).length}
                </p>
              </div>
              <Zap className="w-8 h-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Already Created</p>
                <p className="text-2xl font-bold text-white">
                  {matches.filter(m => m.hasQuickPurchase).length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Select value={selectedLeague} onValueChange={setSelectedLeague}>
            <SelectTrigger className="w-48 bg-slate-700 border-slate-600 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700 text-white">
              <SelectItem value="39">Premier League</SelectItem>
              <SelectItem value="140">La Liga</SelectItem>
              <SelectItem value="78">Bundesliga</SelectItem>
              <SelectItem value="135">Serie A</SelectItem>
              <SelectItem value="61">Ligue 1</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search matches..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-700 border-slate-600 text-white placeholder-slate-400"
          />
        </div>
      </div>

      {/* Matches Table */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Trophy className="w-5 h-5 mr-2 text-emerald-400" />
            Upcoming Matches ({filteredMatches.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-900/50">
                <TableRow className="border-slate-700">
                  <TableHead className="text-white">Match</TableHead>
                  <TableHead className="text-white">League</TableHead>
                  <TableHead className="text-white">Date</TableHead>
                  <TableHead className="text-white">Status</TableHead>
                  <TableHead className="text-white">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMatches.map((match) => (
                  <TableRow key={match.match_id} className="border-slate-700 hover:bg-slate-700/30">
                    <TableCell>
                      <div>
                        <div className="font-medium text-white">
                          {match.home_team} vs {match.away_team}
                        </div>
                        {match.venue && (
                          <div className="text-xs text-slate-400">{match.venue}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-slate-300">{match.league}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-slate-300">
                        {formatMatchDate(match.date)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {match.hasQuickPurchase ? (
                        <Badge className="bg-green-600 text-white">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Created
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-yellow-600 text-yellow-400">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Available
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {!match.hasQuickPurchase ? (
                        <Button
                          size="sm"
                          onClick={() => handleCreateQuickPurchase(match)}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          <PlusCircle className="w-3 h-3 mr-1" />
                          Create
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled
                          className="text-slate-400 border-slate-600"
                        >
                          <XCircle className="w-3 h-3 mr-1" />
                          Created
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create QuickPurchase Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px] bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-emerald-400">
              Create QuickPurchase from Prediction
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Create a purchasable prediction for this match.
            </DialogDescription>
          </DialogHeader>

          {selectedMatch && (
            <div className="space-y-4">
              {/* Match Info */}
              <div className="bg-slate-700/50 p-3 rounded-lg">
                <h4 className="font-semibold text-white mb-2">Match Details</h4>
                <div className="text-sm text-slate-300">
                  <div><strong>Teams:</strong> {selectedMatch.home_team} vs {selectedMatch.away_team}</div>
                  <div><strong>League:</strong> {selectedMatch.league}</div>
                  <div><strong>Date:</strong> {formatMatchDate(selectedMatch.date)}</div>
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="countryId" className="text-slate-300">Country *</Label>
                  <Select
                    value={formData.countryId}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, countryId: value }))}
                  >
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                      <SelectValue placeholder="Select a country" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-white">
                      {countries.map((country) => (
                        <SelectItem key={country.id} value={country.id}>
                          {country.name} ({country.currencySymbol})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="price" className="text-slate-300">Price *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                    placeholder="0.00"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>

                <div>
                  <Label htmlFor="name" className="text-slate-300">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>

                <div>
                  <Label htmlFor="description" className="text-slate-300">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              className="border-slate-600 text-slate-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isCreating || !formData.countryId || !formData.price}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Create QuickPurchase
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 