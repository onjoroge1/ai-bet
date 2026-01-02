'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { AdvancedBreadcrumb } from '@/components/advanced-breadcrumb'
import { 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Calendar,
  Target,
  FileText,
  Share2,
  Zap,
  Loader2,
  Search,
  Filter,
  MoreVertical,
  Eye,
  ExternalLink,
  Clock,
  Send
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface MatchWithStatus {
  id: string
  matchId: string
  homeTeam: string
  awayTeam: string
  league: string
  kickoffDate: string
  status: string
  hasBlog: boolean
  hasSocialMediaPost: boolean
  hasPredictionData: boolean
  needsPredict: boolean
  quickPurchaseCount: number
  blogCount: number
  socialMediaPostCount: number
}

type FilterType = 'all' | 'needsPredict' | 'needsBlog' | 'needsSocial' | 'allReady'

export default function AdminMatchesPage() {
  const [matches, setMatches] = useState<MatchWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [blogDialogOpen, setBlogDialogOpen] = useState(false)
  const [socialDialogOpen, setSocialDialogOpen] = useState(false)
  const [selectedMatchForAction, setSelectedMatchForAction] = useState<MatchWithStatus | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [scheduledAt, setScheduledAt] = useState<string>('')

  const fetchMatches = async () => {
    try {
      setRefreshing(true)
      const response = await fetch('/api/admin/matches/upcoming?status=UPCOMING&limit=200')
      
      if (!response.ok) {
        throw new Error('Failed to fetch matches')
      }

      const data = await response.json()
      if (data.success) {
        setMatches(data.matches || [])
      } else {
        throw new Error(data.error || 'Failed to fetch matches')
      }
    } catch (error) {
      console.error('Error fetching matches:', error)
      toast.error('Failed to fetch matches', {
        description: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchMatches()
  }, [])

  // Filter and search matches
  const filteredMatches = useMemo(() => {
    let filtered = matches

    // Apply filter
    switch (filter) {
      case 'needsPredict':
        filtered = filtered.filter(m => m.needsPredict)
        break
      case 'needsBlog':
        filtered = filtered.filter(m => m.hasPredictionData && !m.hasBlog)
        break
      case 'needsSocial':
        filtered = filtered.filter(m => m.hasPredictionData && !m.hasSocialMediaPost)
        break
      case 'allReady':
        filtered = filtered.filter(m => m.hasPredictionData && m.hasBlog && m.hasSocialMediaPost)
        break
      default:
        break
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(m => 
        m.homeTeam.toLowerCase().includes(query) ||
        m.awayTeam.toLowerCase().includes(query) ||
        m.league.toLowerCase().includes(query) ||
        m.matchId.includes(query)
      )
    }

    return filtered
  }, [matches, filter, searchQuery])

  const handleRunPredict = async (matchIds: string[]) => {
    if (matchIds.length === 0) {
      toast.error('Please select at least one match')
      return
    }

    try {
      const selectedMatchesData = matchIds
        .map(id => matches.find(m => m.id === id))
        .filter(Boolean) as MatchWithStatus[]

      const toastId = toast.loading(`Running /predict on ${selectedMatchesData.length} match(es)...`)
      
      let successCount = 0
      let errorCount = 0

      for (const match of selectedMatchesData) {
        try {
          const response = await fetch('/api/predictions/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ match_id: parseInt(match.matchId) })
          })

          const responseData = await response.json()
          
          if (response.ok && responseData.success !== false) {
            successCount++
            console.log(`✅ Successfully ran /predict for match ${match.matchId}`)
          } else {
            errorCount++
            const errorMsg = responseData.error || responseData.details || `HTTP ${response.status}`
            console.error(`❌ Failed to run /predict for match ${match.matchId}:`, errorMsg)
            toast.error(`Failed for match ${match.matchId}`, {
              description: errorMsg,
              duration: 3000
            })
          }
        } catch (error) {
          errorCount++
          const errorMsg = error instanceof Error ? error.message : 'Unknown error'
          console.error(`❌ Error running /predict for match ${match.matchId}:`, errorMsg)
          toast.error(`Error for match ${match.matchId}`, {
            description: errorMsg,
            duration: 3000
          })
        }

        await new Promise(resolve => setTimeout(resolve, 500))
      }

      toast.dismiss(toastId)
      
      if (successCount > 0) {
        toast.success(`Successfully processed ${successCount} match(es)${errorCount > 0 ? `, ${errorCount} failed` : ''}`)
        await fetchMatches()
        setSelectedMatches(new Set())
      } else {
        toast.error(`Failed to process all matches (${errorCount} errors)`)
      }
    } catch (error) {
      console.error('Error running /predict:', error)
      toast.error('Failed to run /predict', {
        description: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  const handleGenerateBlog = async (marketMatchId: string) => {
    try {
      const toastId = toast.loading('Generating blog...')
      const response = await fetch('/api/admin/template-blogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_single',
          marketMatchId
        })
      })
      
      const data = await response.json()
      toast.dismiss(toastId)
      
      if (data.success && data.data.created) {
        toast.success('Blog generated successfully')
        await fetchMatches()
        setBlogDialogOpen(false)
      } else {
        toast.error(data.data?.error || 'Failed to generate blog')
      }
    } catch (error) {
      toast.error('Error generating blog')
      console.error(error)
    }
  }

  const handleBulkGenerateBlogs = async () => {
    const eligibleMatches = filteredMatches.filter(m => m.hasPredictionData && !m.hasBlog)
    if (eligibleMatches.length === 0) {
      toast.error('No matches eligible for blog generation')
      return
    }

    try {
      const toastId = toast.loading(`Generating blogs for ${eligibleMatches.length} match(es)...`)
      let successCount = 0
      let errorCount = 0

      for (const match of eligibleMatches) {
        try {
          const response = await fetch('/api/admin/template-blogs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'generate_single',
              marketMatchId: match.id
            })
          })
          
          const data = await response.json()
          if (data.success && data.data.created) {
            successCount++
          } else {
            errorCount++
          }
        } catch (error) {
          errorCount++
        }
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      toast.dismiss(toastId)
      toast.success(`Generated ${successCount} blog(s)${errorCount > 0 ? `, ${errorCount} failed` : ''}`)
      await fetchMatches()
    } catch (error) {
      toast.error('Error generating blogs')
    }
  }

  const handleSchedulePost = async (matchId: string, templateId?: string, scheduledAt?: string) => {
    try {
      const toastId = toast.loading('Scheduling post...')
      const response = await fetch('/api/admin/social/twitter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_match',
          matchId,
          templateId,
          scheduledAt,
          postNow: !scheduledAt
        })
      })
      
      const data = await response.json()
      toast.dismiss(toastId)
      
      if (data.success) {
        toast.success('Post scheduled successfully')
        await fetchMatches()
        setSocialDialogOpen(false)
        setSelectedTemplate('')
        setScheduledAt('')
      } else {
        toast.error(data.error || 'Failed to schedule post')
      }
    } catch (error) {
      toast.error('Error scheduling post')
      console.error(error)
    }
  }

  const handleBulkScheduleSocialPosts = async () => {
    // Get eligible matches: has predictionData, no existing social post, sorted by kickoff (earliest first)
    const eligibleMatches = filteredMatches
      .filter(m => m.hasPredictionData && !m.hasSocialMediaPost)
      .sort((a, b) => new Date(a.kickoffDate).getTime() - new Date(b.kickoffDate).getTime())
    
    if (eligibleMatches.length === 0) {
      toast.error('No matches eligible for social post scheduling')
      return
    }

    try {
      const toastId = toast.loading(`Scheduling ${eligibleMatches.length} social post(s)...`)
      let successCount = 0
      let errorCount = 0
      
      // Templates to randomize between
      const templates = ['neutral-preview', 'value-signal']
      
      // Start scheduling from now, 15 minutes apart
      // Add 5 minutes buffer to start (so first post isn't immediate)
      let currentScheduleTime = new Date()
      currentScheduleTime.setMinutes(currentScheduleTime.getMinutes() + 5)
      const startTime = new Date(currentScheduleTime)

      for (const match of eligibleMatches) {
        try {
          // Randomly select template
          const randomTemplate = templates[Math.floor(Math.random() * templates.length)]
          
          // Format scheduled time as ISO string
          const scheduledAtISO = currentScheduleTime.toISOString()
          
          const response = await fetch('/api/admin/social/twitter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'generate_match',
              matchId: match.matchId,
              templateId: randomTemplate,
              scheduledAt: scheduledAtISO,
              postNow: false
            })
          })
          
          const data = await response.json()
          if (data.success) {
            successCount++
          } else {
            errorCount++
            console.error(`Failed to schedule post for match ${match.matchId}:`, data.error)
          }
          
          // Move to next 15-minute slot (regardless of success/failure to maintain spacing)
          currentScheduleTime.setMinutes(currentScheduleTime.getMinutes() + 15)
        } catch (error) {
          errorCount++
          console.error(`Error scheduling post for match ${match.matchId}:`, error)
          // Still increment time to maintain spacing
          currentScheduleTime.setMinutes(currentScheduleTime.getMinutes() + 15)
        }
        // Small delay between API calls to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      toast.dismiss(toastId)
      const endTime = new Date(currentScheduleTime)
      const duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60))
      
      toast.success(
        `Scheduled ${successCount} post(s)${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
        {
          description: `Posts scheduled 15 minutes apart, starting ${startTime.toLocaleTimeString()}, spanning ${duration} minutes`
        }
      )
      await fetchMatches()
    } catch (error) {
      toast.error('Error scheduling social posts')
      console.error(error)
    }
  }

  const toggleMatchSelection = (matchId: string) => {
    const newSelected = new Set(selectedMatches)
    if (newSelected.has(matchId)) {
      newSelected.delete(matchId)
    } else {
      newSelected.add(matchId)
    }
    setSelectedMatches(newSelected)
  }

  const selectAllNeedingPredict = () => {
    const needingPredict = filteredMatches
      .filter(m => m.needsPredict)
      .map(m => m.id)
    setSelectedMatches(new Set(needingPredict))
  }

  const selectAll = () => {
    setSelectedMatches(new Set(filteredMatches.map(m => m.id)))
  }

  const clearSelection = () => {
    setSelectedMatches(new Set())
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const matchesNeedingPredict = filteredMatches.filter(m => m.needsPredict).length
  const matchesNeedingBlog = filteredMatches.filter(m => m.hasPredictionData && !m.hasBlog).length
  const matchesNeedingSocial = filteredMatches.filter(m => m.hasPredictionData && !m.hasSocialMediaPost).length

  // Get available templates for social posts
  // Filters templates based on whether match has blog and confidence data
  const getAvailableTemplates = (match: MatchWithStatus) => {
    const hasBlog = match.hasBlog
    const hasConfidence = match.hasPredictionData // If has predictionData, likely has confidence
    
    const templates: Array<{ id: string; name: string; requiresConfidence?: boolean }> = []
    
    if (hasBlog) {
      // Templates that work with blogs
      templates.push(
        { id: 'neutral-preview', name: 'Neutral Preview' },
        { id: 'ai-vs-market', name: 'AI vs Market' },
        { id: 'value-signal', name: 'Value Signal' },
        { id: 'minimal', name: 'Minimal' }
      )
      
      // Only add confidence-requiring templates if confidence is available
      if (hasConfidence) {
        templates.push({ id: 'ai-confidence', name: 'AI Confidence', requiresConfidence: true })
      }
    } else {
      // Templates that work without blogs
      templates.push(
        { id: 'fixture-alert', name: 'Fixture Alert' },
        { id: 'league-focus', name: 'League Focus' }
      )
    }
    
    return templates
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <AdvancedBreadcrumb
          items={[
            { label: 'Admin', href: '/admin' },
            { label: 'Matches', href: '/admin/matches' },
          ]}
        />

        <div className="mt-4 sm:mt-6 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2 sm:gap-3">
                <Target className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-500" />
                Upcoming Matches
              </h1>
              <p className="text-slate-400 mt-2 text-sm sm:text-base">
                View all upcoming matches and their content status (blog, social media, predictions)
              </p>
            </div>
            <Button
              onClick={fetchMatches}
              disabled={refreshing}
              variant="outline"
              size="sm"
              className="border-slate-600 self-start sm:self-auto"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Summary Stats - Mobile Responsive */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-slate-400">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-white">{filteredMatches.length}</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-slate-400">Need /predict</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-amber-500">{matchesNeedingPredict}</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-slate-400">Need Blog</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-emerald-500">{matchesNeedingBlog}</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-slate-400">Need Social</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-blue-500">{matchesNeedingSocial}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search - Mobile Responsive */}
        <Card className="bg-slate-800/50 border-slate-700 mb-4 sm:mb-6">
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search matches..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-slate-700/50 border-slate-600 text-white"
                />
              </div>
              <Select value={filter} onValueChange={(value) => setFilter(value as FilterType)}>
                <SelectTrigger className="w-full sm:w-[200px] bg-slate-700/50 border-slate-600 text-white">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Matches</SelectItem>
                  <SelectItem value="needsPredict">Need /predict</SelectItem>
                  <SelectItem value="needsBlog">Need Blog</SelectItem>
                  <SelectItem value="needsSocial">Need Social Post</SelectItem>
                  <SelectItem value="allReady">All Ready</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions Bar - Mobile Responsive */}
        {(selectedMatches.size > 0 || matchesNeedingPredict > 0 || matchesNeedingBlog > 0) && (
          <Card className="bg-slate-800/50 border-slate-700 mb-4 sm:mb-6">
            <CardContent className="pt-4 sm:pt-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <div className="text-sm text-slate-400">
                    {selectedMatches.size > 0 
                      ? `${selectedMatches.size} match(es) selected`
                      : `${matchesNeedingPredict} need /predict, ${matchesNeedingBlog} need blogs`}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {matchesNeedingPredict > 0 && (
                      <Button
                        onClick={selectAllNeedingPredict}
                        variant="outline"
                        size="sm"
                        className="border-slate-600 text-xs sm:text-sm"
                      >
                        Select All Needing /predict
                      </Button>
                    )}
                    <Button
                      onClick={selectAll}
                      variant="outline"
                      size="sm"
                      className="border-slate-600 text-xs sm:text-sm"
                    >
                      Select All
                    </Button>
                    {selectedMatches.size > 0 && (
                      <Button
                        onClick={clearSelection}
                        variant="outline"
                        size="sm"
                        className="border-slate-600 text-xs sm:text-sm"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {selectedMatches.size > 0 && (
                    <Button
                      onClick={() => handleRunPredict(Array.from(selectedMatches))}
                      className="bg-emerald-600 hover:bg-emerald-700 text-xs sm:text-sm"
                      size="sm"
                    >
                      <Zap className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                      Run /predict ({selectedMatches.size})
                    </Button>
                  )}
                  {matchesNeedingBlog > 0 && (
                    <Button
                      onClick={handleBulkGenerateBlogs}
                      variant="outline"
                      size="sm"
                      className="border-emerald-600 text-emerald-400 text-xs sm:text-sm"
                    >
                      <FileText className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                      Generate All Blogs
                    </Button>
                  )}
                  {matchesNeedingSocial > 0 && (
                    <Button
                      onClick={handleBulkScheduleSocialPosts}
                      variant="outline"
                      size="sm"
                      className="border-blue-600 text-blue-400 text-xs sm:text-sm"
                    >
                      <Send className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                      Schedule All Social Posts
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Matches Table - Mobile Responsive */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-lg sm:text-xl">Upcoming Matches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="w-10 sm:w-12 px-2 sm:px-4">
                        <input
                          type="checkbox"
                          checked={selectedMatches.size === filteredMatches.filter(m => m.needsPredict).length && filteredMatches.filter(m => m.needsPredict).length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              selectAllNeedingPredict()
                            } else {
                              clearSelection()
                            }
                          }}
                          className="rounded border-slate-600"
                        />
                      </TableHead>
                      <TableHead className="text-slate-300 px-2 sm:px-4 min-w-[200px]">Match</TableHead>
                      <TableHead className="text-slate-300 px-2 sm:px-4 hidden sm:table-cell">League</TableHead>
                      <TableHead className="text-slate-300 px-2 sm:px-4 hidden md:table-cell">Kickoff</TableHead>
                      <TableHead className="text-slate-300 text-center px-2 sm:px-4 w-16 sm:w-20">Blog</TableHead>
                      <TableHead className="text-slate-300 text-center px-2 sm:px-4 w-16 sm:w-20">Social</TableHead>
                      <TableHead className="text-slate-300 text-center px-2 sm:px-4 w-16 sm:w-20">Pred</TableHead>
                      <TableHead className="text-slate-300 text-center px-2 sm:px-4 hidden lg:table-cell">Needs /predict</TableHead>
                      <TableHead className="text-slate-300 text-center px-2 sm:px-4 w-20 sm:w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMatches.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-slate-400 py-8">
                          No matches found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredMatches.map((match) => (
                        <TableRow 
                          key={match.id} 
                          className={`border-slate-700 ${match.needsPredict ? 'bg-amber-500/10' : ''}`}
                        >
                          <TableCell className="px-2 sm:px-4">
                            {match.needsPredict && (
                              <input
                                type="checkbox"
                                checked={selectedMatches.has(match.id)}
                                onChange={() => toggleMatchSelection(match.id)}
                                className="rounded border-slate-600"
                              />
                            )}
                          </TableCell>
                          <TableCell className="px-2 sm:px-4">
                            <div className="font-medium text-white text-sm sm:text-base">
                              {match.homeTeam} vs {match.awayTeam}
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                              <Badge variant="outline" className="border-slate-600 text-slate-300 text-xs sm:hidden mr-2">
                                {match.league}
                              </Badge>
                              <span className="hidden sm:inline">ID: {match.matchId}</span>
                              <span className="sm:hidden">#{match.matchId.slice(-6)}</span>
                            </div>
                            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1 md:hidden">
                              <Calendar className="w-3 h-3" />
                              {formatDate(match.kickoffDate)}
                            </div>
                          </TableCell>
                          <TableCell className="px-2 sm:px-4 hidden sm:table-cell">
                            <Badge variant="outline" className="border-slate-600 text-slate-300">
                              {match.league}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-2 sm:px-4 hidden md:table-cell">
                            <div className="flex items-center gap-2 text-slate-300 text-sm">
                              <Calendar className="w-4 h-4" />
                              {formatDate(match.kickoffDate)}
                            </div>
                          </TableCell>
                          <TableCell className="text-center px-2 sm:px-4">
                            {match.hasBlog ? (
                              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500 mx-auto" />
                            ) : (
                              <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600 mx-auto" />
                            )}
                          </TableCell>
                          <TableCell className="text-center px-2 sm:px-4">
                            {match.hasSocialMediaPost ? (
                              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 mx-auto" />
                            ) : (
                              <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600 mx-auto" />
                            )}
                          </TableCell>
                          <TableCell className="text-center px-2 sm:px-4">
                            {match.hasPredictionData ? (
                              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500 mx-auto" />
                            ) : (
                              <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600 mx-auto" />
                            )}
                          </TableCell>
                          <TableCell className="text-center px-2 sm:px-4 hidden lg:table-cell">
                            {match.needsPredict ? (
                              <Badge variant="outline" className="border-amber-500 text-amber-500 text-xs">
                                Yes
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-slate-600 text-slate-400 text-xs">
                                No
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="px-2 sm:px-4">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                                {match.hasPredictionData && !match.hasBlog && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedMatchForAction(match)
                                      setBlogDialogOpen(true)
                                    }}
                                    className="text-emerald-400"
                                  >
                                    <FileText className="w-4 h-4 mr-2" />
                                    Generate Blog
                                  </DropdownMenuItem>
                                )}
                                {match.hasBlog && (
                                  <DropdownMenuItem
                                    onClick={() => window.open(`/blog/${match.matchId}`, '_blank')}
                                  >
                                    <Eye className="w-4 h-4 mr-2" />
                                    View Blog
                                  </DropdownMenuItem>
                                )}
                                {match.hasPredictionData && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedMatchForAction(match)
                                      setSelectedTemplate('')
                                      setScheduledAt('')
                                      setSocialDialogOpen(true)
                                    }}
                                    className="text-blue-400"
                                  >
                                    <Share2 className="w-4 h-4 mr-2" />
                                    Schedule Post
                                  </DropdownMenuItem>
                                )}
                                {match.needsPredict && (
                                  <DropdownMenuItem
                                    onClick={() => handleRunPredict([match.id])}
                                    className="text-amber-400"
                                  >
                                    <Zap className="w-4 h-4 mr-2" />
                                    Run /predict
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => window.open(`/match/${match.matchId}`, '_blank')}
                                >
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  View Match
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Blog Generation Dialog */}
        <Dialog open={blogDialogOpen} onOpenChange={setBlogDialogOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white">
            <DialogHeader>
              <DialogTitle>Generate Blog</DialogTitle>
              <DialogDescription className="text-slate-400">
                {selectedMatchForAction && (
                  <>Generate blog for {selectedMatchForAction.homeTeam} vs {selectedMatchForAction.awayTeam}</>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setBlogDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => selectedMatchForAction && handleGenerateBlog(selectedMatchForAction.id)}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Generate Blog
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Social Post Scheduling Dialog */}
        <Dialog open={socialDialogOpen} onOpenChange={setSocialDialogOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
            <DialogHeader>
              <DialogTitle>Schedule Social Media Post</DialogTitle>
              <DialogDescription className="text-slate-400">
                {selectedMatchForAction && (
                  <>Schedule post for {selectedMatchForAction.homeTeam} vs {selectedMatchForAction.awayTeam}</>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label className="text-slate-300">Template</Label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white mt-1">
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {selectedMatchForAction && getAvailableTemplates(selectedMatchForAction).map(template => (
                      <SelectItem key={template.id} value={template.id} className="text-white">
                        {template.name}
                        {template.requiresConfidence && (
                          <span className="text-xs text-slate-400 ml-2">(requires confidence)</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedMatchForAction && !selectedMatchForAction.hasPredictionData && (
                  <p className="text-xs text-amber-400 mt-1">
                    Note: Some templates require prediction data. Run /predict first if needed.
                  </p>
                )}
              </div>
              <div>
                <Label className="text-slate-300">Schedule At (Optional)</Label>
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="bg-slate-700/50 border-slate-600 text-white mt-1"
                  min={new Date().toISOString().slice(0, 16)}
                />
                <p className="text-xs text-slate-400 mt-1">
                  Leave empty to post immediately
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setSocialDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (selectedMatchForAction) {
                      handleSchedulePost(
                        selectedMatchForAction.matchId,
                        selectedTemplate || undefined,
                        scheduledAt || undefined
                      )
                    }
                  }}
                  disabled={!selectedTemplate}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {scheduledAt ? 'Schedule' : 'Post Now'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
