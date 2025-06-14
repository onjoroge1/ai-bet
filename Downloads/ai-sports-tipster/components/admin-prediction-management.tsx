"use client"

import type React from "react"
import { useState, useMemo, useEffect } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  PlusCircle,
  Edit,
  Trash2,
  ListFilter,
  Search,
  CalendarDays,
  Tag,
  ShieldCheck,
  StarIcon,
  BarChartBig,
  Loader2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

// Enhanced Prediction type for admin management
type Match = {
  id: string
  homeTeamId: string
  awayTeamId: string
  leagueId: string
  matchDate: string
  status: string
  homeScore?: number
  awayScore?: number
  minutePlayed?: number
  createdAt: string
  homeTeam: { id: string; name: string }
  awayTeam: { id: string; name: string }
  league: { id: string; name: string }
}

// Update PredictionAdmin type to match form state
type PredictionAdmin = {
  id: string
  match: {
    homeTeam: { id: string; name: string };
    awayTeam: { id: string; name: string };
    league: { id: string; name: string };
    dateTime: string;
    status: "upcoming" | "live" | "finished" | "postponed" | "cancelled";
  }
  league: string
  dateTime: string
  prediction: string
  odds: string
  confidence: number
  analysis: string
  status: "upcoming" | "live" | "finished" | "postponed" | "cancelled"
  result: "won" | "lost" | "pending" | "void"
  isFree: boolean
  isFeatured: boolean
  showOnHomepage?: boolean
  showInDailyTips: boolean
  showInWeeklySpecials: boolean
  type: "single" | "accumulator"
  matchesInAccumulator: Array<{
    match: string;
    prediction: string;
    odds: string;
  }>
  totalOdds: string
  stake: string
  potentialReturn: string
  valueRating: "Low" | "Medium" | "High" | "Very High"
  createdAt: string
  updatedAt: string
}

// Update form state to use consistent structure
type PredictionFormState = {
  matchString: string
  league: string
  dateTime: string
  prediction: string
  odds: string
  confidence: number
  analysis: string
  status: "upcoming" | "live" | "finished" | "postponed" | "cancelled"
  result: "won" | "lost" | "pending" | "void"
  isFree: boolean
  isFeatured: boolean
  showInDailyTips: boolean
  showInWeeklySpecials: boolean
  type: "single" | "accumulator"
  matchesInAccumulator: Array<{
    match: string;
    prediction: string;
    odds: string;
  }>
  totalOdds: string
  stake: string
  potentialReturn: string
  valueRating: "Low" | "Medium" | "High" | "Very High"
}

// API functions
const fetchPredictions = async (): Promise<PredictionAdmin[]> => {
  const response = await fetch('/api/predictions')
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized access. Please log in as an admin.')
    }
    throw new Error('Failed to fetch predictions')
  }
  const data = await response.json()
  
  // Normalize match data structure
  return data.map((prediction: any) => {
    // Normalize match data
    const match = typeof prediction.match === 'string' 
      ? {
          homeTeam: { id: '', name: prediction.match.split(' vs ')[0] || '' },
          awayTeam: { id: '', name: prediction.match.split(' vs ')[1] || '' },
          league: { id: '', name: prediction.league || '' },
          dateTime: prediction.dateTime,
          status: prediction.status
        }
      : prediction.match

    // Normalize matchesInAccumulator
    const matchesInAccumulator = Array.isArray(prediction.matchesInAccumulator)
      ? prediction.matchesInAccumulator.map((match: string) => ({
          match,
          prediction: '',
          odds: ''
        }))
      : []

    // Handle showOnHomepage for backward compatibility
    const isFeatured = prediction.isFeatured || prediction.showOnHomepage || false

    return {
      ...prediction,
      match,
      result: prediction.result || 'pending',
      isFeatured,
      showOnHomepage: isFeatured, // Set for backward compatibility
      showInDailyTips: prediction.showInDailyTips || false,
      showInWeeklySpecials: prediction.showInWeeklySpecials || false,
      type: prediction.type || 'single',
      matchesInAccumulator,
      valueRating: prediction.valueRating || 'Medium'
    }
  })
}

const createPrediction = async (data: Omit<PredictionAdmin, 'id' | 'createdAt' | 'updatedAt'>) => {
  const response = await fetch('/api/predictions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    throw new Error('Failed to create prediction')
  }
  return response.json()
}

const updatePrediction = async (data: PredictionAdmin) => {
  const response = await fetch('/api/predictions', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    throw new Error('Failed to update prediction')
  }
  return response.json()
}

const deletePrediction = async (id: string) => {
  const response = await fetch(`/api/predictions?id=${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    throw new Error('Failed to delete prediction')
  }
  return response.json()
}

// Add a helper function for datetime handling
const formatDateTimeForInput = (date: Date | string): string => {
  const d = new Date(date)
  if (isNaN(d.getTime())) {
    return new Date().toISOString().slice(0, 16)
  }
  return d.toISOString().slice(0, 16)
}

export function AdminPredictionManagement() {
  const queryClient = useQueryClient()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPrediction, setEditingPrediction] = useState<PredictionAdmin | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentTab, setCurrentTab] = useState<"all" | "homepage" | "daily" | "specials">("all")

  // Fetch predictions
  const { data: predictions = [], isLoading, error } = useQuery({
    queryKey: ['predictions'],
    queryFn: fetchPredictions,
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: createPrediction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['predictions'] })
      toast.success('Prediction created successfully')
      setIsModalOpen(false)
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: updatePrediction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['predictions'] })
      toast.success('Prediction updated successfully')
      setIsModalOpen(false)
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deletePrediction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['predictions'] })
      toast.success('Prediction deleted successfully')
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const handleAddNew = () => {
    setEditingPrediction(null)
    setIsModalOpen(true)
  }

  const handleEdit = (prediction: PredictionAdmin) => {
    setEditingPrediction({
      ...prediction,
      isFeatured: prediction.isFeatured ?? false
    })
    setIsModalOpen(true)
  }

  const handleDelete = (predictionId: string) => {
    if (window.confirm('Are you sure you want to delete this prediction?')) {
      deleteMutation.mutate(predictionId)
    }
  }

  const handleSavePrediction = (formData: PredictionAdmin) => {
    if (editingPrediction) {
      updateMutation.mutate(formData)
    } else {
      createMutation.mutate(formData)
    }
  }

  const filteredPredictions = useMemo(() => {
    return predictions
      .filter((p) => {
        if (currentTab === "homepage") return p.isFeatured
        if (currentTab === "daily") return p.showInDailyTips
        if (currentTab === "specials") return p.showInWeeklySpecials
        return true // 'all' tab
      })
      .filter((p) => {
        const searchLower = searchTerm.toLowerCase()
        const matchString = typeof p.match === 'string' ? p.match : `${p.match.homeTeam.name} vs ${p.match.awayTeam.name}`
        const matchLower = matchString.toLowerCase()
        const leagueLower = typeof p.league === 'string' ? p.league.toLowerCase() : ''
        const predictionLower = typeof p.prediction === 'string' ? p.prediction.toLowerCase() : ''
        
        return matchLower.includes(searchLower) ||
               leagueLower.includes(searchLower) ||
               predictionLower.includes(searchLower)
      })
      .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime())
  }, [predictions, searchTerm, currentTab])

  const PredictionForm = ({
    isOpen,
    onClose,
    onSave,
    initialData,
  }: {
    isOpen: boolean
    onClose: () => void
    onSave: (data: PredictionAdmin) => void
    initialData: PredictionAdmin | null
  }) => {
    const [formData, setFormData] = useState<PredictionFormState>(() => {
      const defaultState: PredictionFormState = {
        matchString: '',
        league: '',
        dateTime: formatDateTimeForInput(new Date()),
        prediction: '',
        odds: '0',
        confidence: 0,
        analysis: '',
        status: 'upcoming',
        result: 'pending',
        isFree: true,
        isFeatured: false,
        showInDailyTips: false,
        showInWeeklySpecials: false,
        type: 'single',
        matchesInAccumulator: [],
        totalOdds: '0',
        stake: '0',
        potentialReturn: '0',
        valueRating: 'Medium'
      }

      if (!initialData) {
        return defaultState
      }

      // Normalize matchesInAccumulator
      const matchesInAccumulator = Array.isArray(initialData.matchesInAccumulator)
        ? initialData.matchesInAccumulator.map(match => 
            typeof match === 'string'
              ? { match, prediction: '', odds: '' }
              : match
          )
        : []

      return {
        ...defaultState,
        matchString: typeof initialData.match === 'string' 
          ? initialData.match 
          : `${initialData.match.homeTeam.name} vs ${initialData.match.awayTeam.name}`,
        league: initialData.league,
        dateTime: formatDateTimeForInput(initialData.dateTime),
        prediction: initialData.prediction,
        odds: initialData.odds || '0',
        confidence: initialData.confidence || 0,
        analysis: initialData.analysis || '',
        status: initialData.status,
        result: initialData.result || 'pending',
        isFree: initialData.isFree,
        isFeatured: initialData.isFeatured,
        showInDailyTips: initialData.showInDailyTips,
        showInWeeklySpecials: initialData.showInWeeklySpecials,
        type: initialData.type,
        matchesInAccumulator,
        totalOdds: initialData.totalOdds || '0',
        stake: initialData.stake || '0',
        potentialReturn: initialData.potentialReturn || '0',
        valueRating: initialData.valueRating
      }
    })

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault()
      
      // Split match string into home and away teams
      const [homeTeam, awayTeam] = formData.matchString.split(' vs ').map(t => t.trim())
      
      // Ensure valid datetime
      const dateTime = new Date(formData.dateTime).toISOString()
      
      // Prepare submission data
      const submissionData: Omit<PredictionAdmin, 'id' | 'createdAt' | 'updatedAt'> = {
        match: {
          homeTeam: { id: '', name: homeTeam },
          awayTeam: { id: '', name: awayTeam },
          league: { id: '', name: formData.league },
          dateTime,
          status: formData.status
        },
        league: formData.league,
        dateTime,
        prediction: formData.prediction,
        odds: formData.odds,
        confidence: formData.confidence,
        analysis: formData.analysis,
        status: formData.status,
        result: formData.result,
        isFree: formData.isFree,
        isFeatured: formData.isFeatured,
        showInDailyTips: formData.showInDailyTips,
        showInWeeklySpecials: formData.showInWeeklySpecials,
        type: formData.type,
        matchesInAccumulator: formData.matchesInAccumulator.map(m => ({
          match: m.match,
          prediction: m.prediction,
          odds: m.odds
        })),
        totalOdds: formData.totalOdds,
        stake: formData.stake,
        potentialReturn: formData.potentialReturn,
        valueRating: formData.valueRating
      }

      onSave(submissionData as PredictionAdmin)
    }

    const handleCheckboxChange = (name: string, checked: boolean) => {
      console.log('Checkbox changed:', {
        name,
        checked,
        currentFormData: formData
      })
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }))
    }

    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px] bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-emerald-400">
              {initialData ? "Edit Prediction" : "Add New Prediction"}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Fill in the details for the match prediction.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="matchString" className="text-slate-300">
                  Match (e.g., Arsenal vs Chelsea)
                </Label>
                <Input
                  id="matchString"
                  name="matchString"
                  value={formData.matchString}
                  onChange={(e) => setFormData(prev => ({ ...prev, matchString: e.target.value }))}
                  placeholder="Enter match"
                  required
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label htmlFor="league" className="text-slate-300">
                  League
                </Label>
                <Input
                  id="league"
                  name="league"
                  value={formData.league || ""}
                  onChange={(e) => {
                    const { name, value } = e.target
                    console.log('Handle Change:', {
                      name,
                      value,
                      type: e.target.type,
                      currentFormData: formData
                    })
                    setFormData({ ...formData, [name]: value })
                  }}
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="dateTime" className="text-slate-300">
                Date & Time
              </Label>
              <Input
                id="dateTime"
                name="dateTime"
                type="datetime-local"
                value={formData.dateTime}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, dateTime: e.target.value }))
                }}
                required
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div>
              <Label htmlFor="prediction" className="text-slate-300">
                Prediction (e.g., Over 2.5 Goals)
              </Label>
              <Input
                id="prediction"
                name="prediction"
                value={formData.prediction || ""}
                onChange={(e) => {
                  const { name, value } = e.target
                  console.log('Handle Change:', {
                    name,
                    value,
                    type: e.target.type,
                    currentFormData: formData
                  })
                  setFormData({ ...formData, [name]: value })
                }}
                required
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="odds" className="text-slate-300">
                  Odds (e.g., 1.85)
                </Label>
                <Input
                  id="odds"
                  name="odds"
                  value={formData.odds || ""}
                  onChange={(e) => {
                    const { name, value } = e.target
                    console.log('Handle Change:', {
                      name,
                      value,
                      type: e.target.type,
                      currentFormData: formData
                    })
                    setFormData({ ...formData, [name]: value })
                  }}
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label htmlFor="confidence" className="text-slate-300">
                  Confidence (0-100)
                </Label>
                <Input
                  id="confidence"
                  name="confidence"
                  type="number"
                  value={formData.confidence || ""}
                  onChange={(e) => {
                    const { name, value } = e.target
                    console.log('Handle Change:', {
                      name,
                      value,
                      type: e.target.type,
                      currentFormData: formData
                    })
                    setFormData({ ...formData, [name]: Number.parseFloat(value) })
                  }}
                  min="0"
                  max="100"
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="valueRating" className="text-slate-300">
                Value Rating
              </Label>
              <Select
                name="valueRating"
                value={formData.valueRating}
                onValueChange={(value) => {
                  console.log('Handle Change:', {
                    name: 'valueRating',
                    value,
                    type: 'select',
                    currentFormData: formData
                  })
                  setFormData({ ...formData, valueRating: value as "Low" | "Medium" | "High" | "Very High" })
                }}
              >
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="Select value rating" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  <SelectItem value="Low" className="hover:bg-slate-700">
                    Low
                  </SelectItem>
                  <SelectItem value="Medium" className="hover:bg-slate-700">
                    Medium
                  </SelectItem>
                  <SelectItem value="High" className="hover:bg-slate-700">
                    High
                  </SelectItem>
                  <SelectItem value="Very High" className="hover:bg-slate-700">
                    Very High
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="analysis" className="text-slate-300">
                Analysis
              </Label>
              <Textarea
                id="analysis"
                name="analysis"
                value={formData.analysis || ""}
                onChange={(e) => {
                  const { name, value } = e.target
                  console.log('Handle Change:', {
                    name,
                    value,
                    type: e.target.type,
                    currentFormData: formData
                  })
                  setFormData({ ...formData, [name]: value })
                }}
                rows={3}
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="status" className="text-slate-300">
                  Status
                </Label>
                <Select
                  name="status"
                  value={formData.status}
                  onValueChange={(value) => {
                    console.log('Handle Change:', {
                      name: 'status',
                      value,
                      type: 'select',
                      currentFormData: formData
                    })
                    setFormData({ ...formData, status: value as "upcoming" | "live" | "finished" | "postponed" | "cancelled" })
                  }}
                  required
                >
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-white">
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="live">Live</SelectItem>
                    <SelectItem value="finished">Finished</SelectItem>
                    <SelectItem value="postponed">Postponed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.status === "finished" && (
                <div>
                  <Label htmlFor="result" className="text-slate-300">
                    Result
                  </Label>
                  <Select
                    name="result"
                    value={formData.result}
                    onValueChange={(value) => {
                      console.log('Handle Change:', {
                        name: 'result',
                        value,
                        type: 'select',
                        currentFormData: formData
                      })
                      setFormData({ ...formData, result: value as "won" | "lost" | "pending" | "void" })
                    }}
                  >
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                      <SelectValue placeholder="Select result" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-white">
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="won">Won</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                      <SelectItem value="void">Void</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="type" className="text-slate-300">
                Prediction Type
              </Label>
              <Select name="type" value={formData.type} onValueChange={(value) => {
                console.log('Handle Change:', {
                  name: 'type',
                  value,
                  type: 'select',
                  currentFormData: formData
                })
                setFormData({ ...formData, type: value as "single" | "accumulator" })
              }}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  <SelectItem value="single">Single</SelectItem>
                  <SelectItem value="accumulator">Accumulator</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.type === "accumulator" && (
              <>
                <div>
                  <Label htmlFor="matchesInAccumulator" className="text-slate-300">
                    Matches in Accumulator (comma-separated)
                  </Label>
                  <Input
                    id="matchesInAccumulator"
                    name="matchesInAccumulator"
                    value={Array.isArray(formData.matchesInAccumulator) ? formData.matchesInAccumulator.map(m => m.match).join(", ") : ""}
                    onChange={(e) => {
                      console.log('Handle Change:', {
                        name: 'matchesInAccumulator',
                        value: e.target.value,
                        type: e.target.type,
                        currentFormData: formData
                      })
                      setFormData({ ...formData, matchesInAccumulator: e.target.value.split(",").map((s) => ({ match: s.trim(), prediction: "", odds: "" })) })
                    }}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="totalOdds" className="text-slate-300">
                    Total Odds for Accumulator
                  </Label>
                  <Input
                    id="totalOdds"
                    name="totalOdds"
                    value={formData.totalOdds || ""}
                    onChange={(e) => {
                      console.log('Handle Change:', {
                        name: 'totalOdds',
                        value: e.target.value,
                        type: e.target.type,
                        currentFormData: formData
                      })
                      setFormData({ ...formData, totalOdds: e.target.value })
                    }}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="stake" className="text-slate-300">
                    Recommended Stake (e.g., KES 1000)
                  </Label>
                  <Input
                    id="stake"
                    name="stake"
                    value={formData.stake || ""}
                    onChange={(e) => {
                      console.log('Handle Change:', {
                        name: 'stake',
                        value: e.target.value,
                        type: e.target.type,
                        currentFormData: formData
                      })
                      setFormData({ ...formData, stake: e.target.value })
                    }}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="potentialReturn" className="text-slate-300">
                    Potential Return (e.g., KES 5000)
                  </Label>
                  <Input
                    id="potentialReturn"
                    name="potentialReturn"
                    value={formData.potentialReturn || ""}
                    onChange={(e) => {
                      console.log('Handle Change:', {
                        name: 'potentialReturn',
                        value: e.target.value,
                        type: e.target.type,
                        currentFormData: formData
                      })
                      setFormData({ ...formData, potentialReturn: e.target.value })
                    }}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
              </>
            )}

            <div className="space-y-2 pt-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isFree"
                  name="isFree"
                  checked={formData.isFree}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isFree: !!checked }))}
                />
                <Label htmlFor="isFree" className="text-slate-300">
                  Free Tip (Visible to all users)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isFeatured"
                  name="isFeatured"
                  checked={formData.isFeatured}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isFeatured: !!checked }))}
                />
                <Label htmlFor="isFeatured" className="text-slate-300">
                  Show on Homepage (Featured)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="showInDailyTips"
                  name="showInDailyTips"
                  checked={formData.showInDailyTips}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, showInDailyTips: !!checked }))}
                />
                <Label htmlFor="showInDailyTips" className="text-slate-300">
                  Show in Daily Tips
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="showInWeeklySpecials"
                  name="showInWeeklySpecials"
                  checked={formData.showInWeeklySpecials}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, showInWeeklySpecials: !!checked }))}
                />
                <Label htmlFor="showInWeeklySpecials" className="text-slate-300">
                  Show in Weekly Specials
                </Label>
              </div>
            </div>
            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="text-slate-300 border-slate-600 hover:bg-slate-700"
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Save Prediction
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    )
  }

  const getStatusBadge = (status: PredictionAdmin["status"]) => {
    switch (status) {
      case "upcoming":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Upcoming</Badge>
      case "live":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 animate-pulse">Live</Badge>
      case "finished":
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">Finished</Badge>
      case "postponed":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Postponed</Badge>
      case "cancelled":
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">Cancelled</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getResultBadge = (result?: PredictionAdmin["result"]) => {
    if (!result) return null
    switch (result) {
      case "won":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Won</Badge>
      case "lost":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Lost</Badge>
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pending</Badge>
      case "void":
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">Void</Badge>
      default:
        return <Badge variant="secondary">{result}</Badge>
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-red-400">
        Error loading predictions: {(error as Error).message}
      </div>
    )
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700 text-white">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-2xl font-bold text-emerald-400 flex items-center">
          <BarChartBig className="w-6 h-6 mr-3 text-emerald-500" />
          Prediction Management
        </CardTitle>
        <Button onClick={handleAddNew} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <PlusCircle className="w-4 h-4 mr-2" />
          Add New Prediction
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs value={currentTab} onValueChange={(value) => setCurrentTab(value as any)} className="mb-4">
          <TabsList className="grid w-full grid-cols-4 bg-slate-700/50 border-slate-600">
            <TabsTrigger value="all" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              All Predictions
            </TabsTrigger>
            <TabsTrigger value="homepage" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              Homepage
            </TabsTrigger>
            <TabsTrigger value="daily" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              Daily Tips
            </TabsTrigger>
            <TabsTrigger value="specials" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              Weekly Specials
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center justify-between mb-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search predictions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-slate-700 border-slate-600 text-white placeholder-slate-400"
            />
          </div>
          <Button variant="outline" className="ml-2 text-slate-300 border-slate-600 hover:bg-slate-700">
            <ListFilter className="w-4 h-4 mr-2" />
            Filters
          </Button>
        </div>

        <div className="overflow-x-auto rounded-md border border-slate-700">
          <Table>
            <TableHeader className="bg-slate-900/50">
              <TableRow className="border-slate-700">
                <TableHead className="text-white">Match</TableHead>
                <TableHead className="text-white">Prediction</TableHead>
                <TableHead className="text-white">Date/Time</TableHead>
                <TableHead className="text-white">Status</TableHead>
                <TableHead className="text-white">Result</TableHead>
                <TableHead className="text-white">Sections</TableHead>
                <TableHead className="text-white text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPredictions.length > 0 ? (
                filteredPredictions.map((p) => (
                  <TableRow key={p.id} className="border-slate-700 hover:bg-slate-700/30">
                    <TableCell>
                      <div className="font-medium text-white">
                        {typeof p.match === 'string' ? p.match : `${p.match.homeTeam.name} vs ${p.match.awayTeam.name}`}
                      </div>
                      <div className="text-xs text-slate-400">
                        {p.league}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-white">{p.prediction}</div>
                      <div className="text-xs text-slate-400">
                        {p.odds && `Odds: ${p.odds}`} {p.confidence && `| Conf: ${p.confidence}%`}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-300">{new Date(p.dateTime).toLocaleString()}</TableCell>
                    <TableCell>{getStatusBadge(p.status)}</TableCell>
                    <TableCell>{getResultBadge(p.result)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {p.isFeatured && (
                          <Badge variant="outline" className="border-purple-500 text-purple-400">
                            <StarIcon className="w-3 h-3 mr-1" />
                            Homepage
                          </Badge>
                        )}
                        {p.showInDailyTips && (
                          <Badge variant="outline" className="border-sky-500 text-sky-400">
                            <CalendarDays className="w-3 h-3 mr-1" />
                            Daily
                          </Badge>
                        )}
                        {p.showInWeeklySpecials && (
                          <Badge variant="outline" className="border-amber-500 text-amber-400">
                            <Tag className="w-3 h-3 mr-1" />
                            Special
                          </Badge>
                        )}
                        {p.isFree === false && (
                          <Badge variant="outline" className="border-yellow-400 text-yellow-300">
                            <ShieldCheck className="w-3 h-3 mr-1" />
                            VIP
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(p)}
                        className="text-emerald-400 hover:text-emerald-300 mr-1"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(p.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className="border-slate-700">
                  <TableCell colSpan={7} className="text-center text-slate-400 py-8">
                    No predictions found for the current filter or tab.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {isModalOpen && (
          <PredictionForm
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false)
              setEditingPrediction(null)
            }}
            onSave={handleSavePrediction}
            initialData={editingPrediction}
          />
        )}
      </CardContent>
    </Card>
  )
}
