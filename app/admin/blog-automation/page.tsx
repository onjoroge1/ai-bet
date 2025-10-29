'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AdvancedBreadcrumb } from '@/components/advanced-breadcrumb'
import { 
  Rss, 
  Play, 
  Pause, 
  RefreshCw, 
  Trash2, 
  Plus,
  Settings,
  BarChart3,
  FileText,
  Globe,
  Clock,
  CheckCircle,
  AlertCircle,
  Activity,
  X,
  Eye,
  Target,
  TrendingUp,
  Loader2,
  Sparkles,
  LayoutTemplate,
  Search,
  Save
} from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

interface RSSFeed {
  id: string
  name: string
  url: string
  category: 'sports' | 'betting' | 'football' | 'general'
  priority: 'high' | 'medium' | 'low'
  isActive: boolean
  lastChecked: Date
  checkInterval: number
}

interface MonitoringStats {
  isActive: boolean
  processedItemsCount: number
  lastProcessedDate: Date
  uptime: number
  dailyLimit?: number
  processedToday?: number
  remainingSlots?: number
}

interface FeedHealth {
  totalFeeds: number
  activeFeeds: number
  lastChecked: Date | null
  averageCheckInterval: number
}

interface AddFeedFormData {
  name: string
  url: string
  category: 'sports' | 'betting' | 'football' | 'general'
  priority: 'high' | 'medium' | 'low'
  checkInterval: number
  isActive: boolean
}

export default function BlogAutomationPage() {
  const router = useRouter()
  const [feeds, setFeeds] = useState<RSSFeed[]>([])
  const [monitoringStats, setMonitoringStats] = useState<MonitoringStats | null>(null)
  const [feedHealth, setFeedHealth] = useState<FeedHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [isAddFeedOpen, setIsAddFeedOpen] = useState(false)
  const [addFeedForm, setAddFeedForm] = useState<AddFeedFormData>({
    name: '',
    url: '',
    category: 'sports',
    priority: 'medium',
    checkInterval: 30,
    isActive: true
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showMatchPreview, setShowMatchPreview] = useState(false)
  const [upcomingMatches, setUpcomingMatches] = useState<any[]>([])
  const [matchGenerationStats, setMatchGenerationStats] = useState<any>(null)
  const [previewBlogData, setPreviewBlogData] = useState<any>(null)
  const [matchesLoading, setMatchesLoading] = useState(false)
  
  // Template blogs state
  const [templateMatches, setTemplateMatches] = useState<any[]>([])
  const [templateLoading, setTemplateLoading] = useState(false)
  const [templateStats, setTemplateStats] = useState<any>(null)

  // Team logo fetcher state
  const [logoTeamName, setLogoTeamName] = useState('')
  const [logoLoading, setLogoLoading] = useState(false)
  const [logoResult, setLogoResult] = useState<any>(null)
  const [savedLogos, setSavedLogos] = useState<any[]>([])
  const [savedLogosLoading, setSavedLogosLoading] = useState(false)

  useEffect(() => {
    console.log('Blog automation page mounted')
    fetchData()
    fetchUpcomingMatches()
    fetchTemplateMatches()
    fetchSavedLogos()
  }, [])

  useEffect(() => {
    console.log('Upcoming matches updated:', upcomingMatches.length)
    console.log('Match generation stats updated:', matchGenerationStats)
  }, [upcomingMatches, matchGenerationStats])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch feeds and health
      const feedsResponse = await fetch('/api/rss/feeds')
      const feedsData = await feedsResponse.json()
      
      if (feedsData.success) {
        setFeeds(feedsData.data.feeds)
        setFeedHealth(feedsData.data.health)
      }

      // Fetch monitoring stats
      const monitoringResponse = await fetch('/api/rss/monitoring')
      const monitoringData = await monitoringResponse.json()
      
      if (monitoringData.success) {
        setMonitoringStats(monitoringData.data.monitoring)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load automation data')
    } finally {
      setLoading(false)
    }
  }

  const handleMonitoringAction = async (action: string) => {
    try {
      setRefreshing(true)
      
      const response = await fetch('/api/rss/monitoring', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action })
      })

      const data = await response.json()
      
      if (data.success) {
        toast.success(data.message)
        await fetchData() // Refresh data
      } else {
        toast.error(data.error || 'Action failed')
      }
    } catch (error) {
      console.error('Error performing action:', error)
      toast.error('Failed to perform action')
    } finally {
      setRefreshing(false)
    }
  }

  const handleDeleteFeed = async (feedId: string) => {
    if (!confirm('Are you sure you want to delete this RSS feed?')) {
      return
    }

    try {
      const response = await fetch(`/api/rss/feeds?id=${feedId}`, {
        method: 'DELETE'
      })

      const data = await response.json()
      
      if (data.success) {
        toast.success('RSS feed deleted successfully')
        await fetchData() // Refresh data
      } else {
        toast.error(data.error || 'Failed to delete feed')
      }
    } catch (error) {
      console.error('Error deleting feed:', error)
      toast.error('Failed to delete feed')
    }
  }

  const handleAddFeed = async () => {
    if (!addFeedForm.name || !addFeedForm.url) {
      toast.error('Name and URL are required')
      return
    }

    if (!addFeedForm.url.startsWith('http')) {
      toast.error('Please enter a valid URL starting with http:// or https://')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/rss/feeds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: addFeedForm.name.toLowerCase().replace(/\s+/g, '-'),
          ...addFeedForm
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to add feed')
      }

      const newFeed = await response.json()
      setFeeds(prev => [...prev, newFeed])
      setIsAddFeedOpen(false)
      setAddFeedForm({
        name: '',
        url: '',
        category: 'sports',
        priority: 'medium',
        checkInterval: 30,
        isActive: true
      })
      toast.success('RSS feed added successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add feed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetAddFeedForm = () => {
    setAddFeedForm({
      name: '',
      url: '',
      category: 'sports',
      priority: 'medium',
      checkInterval: 30,
      isActive: true
    })
  }

  const handleMatchBlogAction = async (action: string, matchId?: string) => {
    try {
      setRefreshing(true)
      
      const response = await fetch('/api/admin/match-blog-generation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, matchId })
      })

      const data = await response.json()
      
      if (data.success) {
        toast.success(data.message || 'Action completed successfully')
        
        if (action === 'generate-blogs') {
          setMatchGenerationStats(data.data)
        }
        
        await fetchData() // Refresh main data
      } else {
        toast.error(data.error || 'Action failed')
      }
    } catch (error) {
      console.error('Error performing match blog action:', error)
      toast.error('Failed to perform action')
    } finally {
      setRefreshing(false)
    }
  }

  const fetchTemplateMatches = async () => {
    try {
      setTemplateLoading(true)
      const response = await fetch('/api/admin/template-blogs')
      const data = await response.json()
      
      if (data.success) {
        setTemplateMatches(data.data)
        setTemplateStats({
          availableMatches: data.data.length,
        })
      }
    } catch (error) {
      console.error('Error fetching template matches:', error)
      toast.error('Failed to load template matches')
    } finally {
      setTemplateLoading(false)
    }
  }

  const handleFetchTeamLogo = async () => {
    if (!logoTeamName.trim()) return

    try {
      setLogoLoading(true)
      setLogoResult(null)
      
      const response = await fetch(`/api/team-logo?team=${encodeURIComponent(logoTeamName.trim())}`)
      const data = await response.json()
      
      if (response.ok) {
        setLogoResult(data)
        toast.success(`Found logo for ${data.name}`)
      } else {
        toast.error(data.error || 'Failed to fetch team logo')
      }
    } catch (error) {
      console.error('Error fetching team logo:', error)
      toast.error('Failed to fetch team logo')
    } finally {
      setLogoLoading(false)
    }
  }

  const handleSaveLogo = async (logoData: any) => {
    try {
      const response = await fetch('/api/admin/team-logos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          teamId: logoData.id,
          teamName: logoData.name,
          logoUrl: logoData.logo,
          country: logoData.country,
        }),
      })

      const data = await response.json()
      
      if (response.ok) {
        toast.success(`Logo saved for ${logoData.name}`)
        fetchSavedLogos() // Refresh the saved logos list
      } else {
        toast.error(data.error || 'Failed to save logo')
      }
    } catch (error) {
      console.error('Error saving logo:', error)
      toast.error('Failed to save logo')
    }
  }

  const fetchSavedLogos = async () => {
    try {
      setSavedLogosLoading(true)
      const response = await fetch('/api/admin/team-logos')
      const data = await response.json()
      
      if (data.success) {
        setSavedLogos(data.data)
      }
    } catch (error) {
      console.error('Error fetching saved logos:', error)
    } finally {
      setSavedLogosLoading(false)
    }
  }

  const handleDeleteLogo = async (logoId: string) => {
    if (!confirm('Are you sure you want to delete this logo?')) return

    try {
      const response = await fetch(`/api/admin/team-logos?id=${logoId}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (response.ok) {
        toast.success('Logo deleted successfully')
        fetchSavedLogos() // Refresh the saved logos list
      } else {
        toast.error(data.error || 'Failed to delete logo')
      }
    } catch (error) {
      console.error('Error deleting logo:', error)
      toast.error('Failed to delete logo')
    }
  }

  const handleTemplateBlogGeneration = async (action: 'generate_all' | 'generate_single', matchId?: string) => {
    try {
      setRefreshing(true)
      
      const response = await fetch('/api/admin/template-blogs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, matchId })
      })

      const data = await response.json()
      
      if (data.success) {
        if (action === 'generate_all') {
          toast.success(`Generated ${data.data.success} templates, skipped ${data.data.skipped} existing`)
        } else {
          // Single generation
          if (data.data.created) {
            toast.success('Template blog draft created successfully')
          } else if (data.data.error) {
            toast.error(`Failed to create blog: ${data.data.error}`)
          } else {
            toast.info('Blog already exists for this match')
          }
        }
        await fetchTemplateMatches() // Refresh the list
      } else {
        toast.error(data.error || 'Action failed')
      }
    } catch (error) {
      console.error('Error generating template blogs:', error)
      toast.error('Failed to generate template blogs')
    } finally {
      setRefreshing(false)
    }
  }

  const fetchUpcomingMatches = async () => {
    try {
      setMatchesLoading(true)
      console.log('Fetching upcoming matches...')
      const response = await fetch('/api/admin/match-blog-generation?action=upcoming-matches')
      const data = await response.json()
      
      console.log('Upcoming matches response:', data)
      
      if (data.success) {
        setUpcomingMatches(data.data.matches)
        setMatchGenerationStats({
          availableMatches: data.data.total,
          generatedToday: 0, // You can implement this based on your needs
          totalGenerated: 0  // You can implement this based on your needs
        })
        console.log('Set upcoming matches:', data.data.matches.length)
        console.log('Set match generation stats:', { availableMatches: data.data.total })
      }
    } catch (error) {
      console.error('Error fetching upcoming matches:', error)
      toast.error('Failed to fetch upcoming matches')
    } finally {
      setMatchesLoading(false)
    }
  }

  const previewMatchBlog = async (matchId: string) => {
    try {
      const response = await fetch('/api/admin/match-blog-generation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'preview-match', matchId })
      })

      const data = await response.json()
      
      if (data.success) {
        setPreviewBlogData(data.data.blogData)
      } else {
        toast.error(data.error || 'Failed to generate preview')
      }
    } catch (error) {
      console.error('Error generating preview:', error)
      toast.error('Failed to generate preview')
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'low': return 'bg-green-500/20 text-green-400 border-green-500/30'
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'sports': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'football': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
      case 'betting': return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      case 'general': return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-slate-700 rounded w-1/4 mb-8"></div>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-24 bg-slate-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Breadcrumb Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <AdvancedBreadcrumb />
      </div>

      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center space-x-2">
              <Rss className="w-8 h-8 text-emerald-400" />
              <span>Blog Automation</span>
            </h1>
            <p className="text-slate-300">Manage RSS feeds and automated content generation</p>
          </div>

          <div className="flex items-center space-x-4 mt-4 md:mt-0">
            <Button
              onClick={() => router.push('/admin/blog-automation/generated')}
              variant="outline"
              className="border-blue-600 text-blue-300 hover:bg-blue-700 hover:text-white"
            >
              <FileText className="w-4 h-4 mr-2" />
              View Generated Content
            </Button>
            
            <Button
              onClick={() => handleMonitoringAction('process-feeds')}
              disabled={refreshing || (monitoringStats?.remainingSlots || 0) <= 0}
              variant="outline"
              className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Process Feeds ({monitoringStats?.remainingSlots || 0} slots)
            </Button>
            
            {(monitoringStats?.remainingSlots || 0) <= 0 && (
              <Button
                onClick={() => handleMonitoringAction('reset-daily-limit')}
                disabled={refreshing}
                variant="outline"
                className="border-orange-600 text-orange-300 hover:bg-orange-700 hover:text-white"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Reset Daily Limit
              </Button>
            )}
            
            {monitoringStats?.isActive ? (
              <Button
                onClick={() => handleMonitoringAction('stop')}
                disabled={refreshing}
                variant="destructive"
              >
                <Pause className="w-4 h-4 mr-2" />
                Stop Monitoring
              </Button>
            ) : (
              <Button
                onClick={() => handleMonitoringAction('start')}
                disabled={refreshing}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Play className="w-4 h-4 mr-2" />
                Start Monitoring
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Total Feeds</p>
                  <p className="text-2xl font-bold text-white">{feedHealth?.totalFeeds || 0}</p>
                </div>
                <Rss className="w-8 h-8 text-emerald-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Active Feeds</p>
                  <p className="text-2xl font-bold text-white">{feedHealth?.activeFeeds || 0}</p>
                </div>
                <Activity className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Processed Items</p>
                  <p className="text-2xl font-bold text-white">{monitoringStats?.processedItemsCount || 0}</p>
                </div>
                <FileText className="w-8 h-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Daily Limit</p>
                  <p className="text-2xl font-bold text-white">
                    {monitoringStats?.processedToday || 0}/{monitoringStats?.dailyLimit || 3}
                  </p>
                  <p className="text-xs text-slate-500">
                    {monitoringStats?.remainingSlots || 3} slots remaining
                  </p>
                </div>
                <Clock className="w-8 h-8 text-orange-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Monitoring Status</p>
                  <div className="flex items-center space-x-2">
                    {monitoringStats?.isActive ? (
                      <>
                        <CheckCircle className="w-5 h-5 text-green-400" />
                        <span className="text-green-400 font-semibold">Active</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-5 h-5 text-red-400" />
                        <span className="text-red-400 font-semibold">Inactive</span>
                      </>
                    )}
                  </div>
                </div>
                <Settings className="w-8 h-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <Tabs defaultValue="generation" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-slate-800 border-slate-700">
            <TabsTrigger value="feeds" className="data-[state=active]:bg-emerald-600">
              <Rss className="w-4 h-4 mr-2" />
              RSS Feeds
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="data-[state=active]:bg-emerald-600">
              <Activity className="w-4 h-4 mr-2" />
              Monitoring
            </TabsTrigger>
            <TabsTrigger 
              value="generation" 
              className="data-[state=active]:bg-emerald-600"
            >
              <FileText className="w-4 h-4 mr-2" />
              Content Generation
            </TabsTrigger>
            <TabsTrigger 
              value="templates" 
              className="data-[state=active]:bg-emerald-600"
            >
              <Target className="w-4 h-4 mr-2" />
              Template Blogs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="feeds" className="space-y-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-white">RSS Feeds</CardTitle>
                  <Dialog open={isAddFeedOpen} onOpenChange={setIsAddFeedOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Feed
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-slate-800 border-slate-700 text-white">
                      <DialogHeader>
                        <DialogTitle className="text-white">Add New RSS Feed</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="name" className="text-slate-300">Feed Name</Label>
                          <Input
                            id="name"
                            value={addFeedForm.name}
                            onChange={(e) => setAddFeedForm(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="e.g., BBC Sport"
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                        </div>
                        <div>
                          <Label htmlFor="url" className="text-slate-300">Feed URL</Label>
                          <Input
                            id="url"
                            value={addFeedForm.url}
                            onChange={(e) => setAddFeedForm(prev => ({ ...prev, url: e.target.value }))}
                            placeholder="https://feeds.bbci.co.uk/sport/rss.xml"
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                        </div>
                        <div>
                          <Label htmlFor="category" className="text-slate-300">Category</Label>
                          <Select value={addFeedForm.category} onValueChange={(value: any) => setAddFeedForm(prev => ({ ...prev, category: value }))}>
                            <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-700 border-slate-600">
                              <SelectItem value="sports">Sports</SelectItem>
                              <SelectItem value="betting">Betting</SelectItem>
                              <SelectItem value="football">Football</SelectItem>
                              <SelectItem value="general">General</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="priority" className="text-slate-300">Priority</Label>
                          <Select value={addFeedForm.priority} onValueChange={(value: any) => setAddFeedForm(prev => ({ ...prev, priority: value }))}>
                            <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-700 border-slate-600">
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="low">Low</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="checkInterval" className="text-slate-300">Check Interval (minutes)</Label>
                          <Input
                            id="checkInterval"
                            type="number"
                            value={addFeedForm.checkInterval}
                            onChange={(e) => setAddFeedForm(prev => ({ ...prev, checkInterval: parseInt(e.target.value) || 30 }))}
                            min="5"
                            max="1440"
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="isActive"
                            checked={addFeedForm.isActive}
                            onCheckedChange={(checked) => setAddFeedForm(prev => ({ ...prev, isActive: checked }))}
                          />
                          <Label htmlFor="isActive" className="text-slate-300">Active</Label>
                        </div>
                        <div className="flex justify-end space-x-2 pt-4">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setIsAddFeedOpen(false)
                              resetAddFeedForm()
                            }}
                            className="border-slate-600 text-slate-300 hover:bg-slate-700"
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleAddFeed}
                            disabled={isSubmitting}
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            {isSubmitting ? 'Adding...' : 'Add Feed'}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {feeds.map((feed) => (
                    <div key={feed.id} className="flex items-center justify-between p-4 bg-slate-700 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-semibold text-white">{feed.name}</h3>
                          <Badge className={getPriorityColor(feed.priority)}>
                            {feed.priority}
                          </Badge>
                          <Badge className={getCategoryColor(feed.category)}>
                            {feed.category}
                          </Badge>
                          {feed.isActive ? (
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                              Active
                            </Badge>
                          ) : (
                            <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <p className="text-slate-400 text-sm mb-2">{feed.url}</p>
                        <div className="flex items-center space-x-4 text-xs text-slate-500">
                          <span className="flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            Check every {feed.checkInterval} minutes
                          </span>
                          <span className="flex items-center">
                            <Globe className="w-3 h-3 mr-1" />
                            Last checked: {new Date(feed.lastChecked).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteFeed(feed.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {feeds.length === 0 && (
                    <div className="text-center py-8">
                      <Rss className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                      <p className="text-slate-400">No RSS feeds configured</p>
                      <Button 
                        className="mt-4 bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => setIsAddFeedOpen(true)}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Your First Feed
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="monitoring" className="space-y-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Monitoring Status</CardTitle>
              </CardHeader>
              <CardContent>
                {monitoringStats && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-700 rounded-lg">
                        <h4 className="font-semibold text-white mb-2">Status</h4>
                        <div className="flex items-center space-x-2">
                          {monitoringStats.isActive ? (
                            <>
                              <CheckCircle className="w-5 h-5 text-green-400" />
                              <span className="text-green-400">Active</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-5 h-5 text-red-400" />
                              <span className="text-red-400">Inactive</span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div className="p-4 bg-slate-700 rounded-lg">
                        <h4 className="font-semibold text-white mb-2">Processed Items</h4>
                        <p className="text-2xl font-bold text-white">{monitoringStats.processedItemsCount}</p>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-slate-700 rounded-lg">
                      <h4 className="font-semibold text-white mb-2">Last Activity</h4>
                      <p className="text-slate-300">
                        {new Date(monitoringStats.lastProcessedDate).toLocaleString()}
                      </p>
                    </div>
                    
                    <div className="flex space-x-4">
                      <Button
                        onClick={() => handleMonitoringAction('clear-cache')}
                        disabled={refreshing}
                        variant="outline"
                        className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                      >
                        Clear Cache
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="generation" className="space-y-6">

            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-white">Match-Based Blog Generation</CardTitle>
                  <div className="flex items-center space-x-2">
                    {matchesLoading && (
                      <div className="flex items-center text-blue-400">
                        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                        <span className="text-sm">Loading...</span>
                      </div>
                    )}
                    {!matchesLoading && upcomingMatches.length > 0 && (
                      <Badge variant="secondary" className="bg-green-600 text-white">
                        {upcomingMatches.length} matches available
                      </Badge>
                    )}
                    {!matchesLoading && upcomingMatches.length === 0 && (
                      <Badge variant="secondary" className="bg-yellow-600 text-white">
                        No matches found
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="bg-slate-700 border-slate-600">
                      <CardHeader>
                        <CardTitle className="text-white text-lg">Quick Actions</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <Button
                          onClick={() => handleMatchBlogAction('generate-blogs')}
                          disabled={refreshing}
                          className="w-full bg-emerald-600 hover:bg-emerald-700"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          Generate All Match Blogs
                        </Button>
                        
                        <Button
                          onClick={() => setShowMatchPreview(true)}
                          variant="outline"
                          className="w-full border-blue-600 text-blue-300 hover:bg-blue-700 hover:text-white"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Preview Upcoming Matches
                        </Button>
                        
                        <Button
                          onClick={fetchUpcomingMatches}
                          disabled={matchesLoading}
                          variant="outline"
                          className="w-full border-green-600 text-green-300 hover:bg-green-700 hover:text-white"
                        >
                          <RefreshCw className={`w-4 h-4 mr-2 ${matchesLoading ? 'animate-spin' : ''}`} />
                          Refresh Matches
                        </Button>
                      </CardContent>
                    </Card>

                    <Card className="bg-slate-700 border-slate-600">
                      <CardHeader>
                        <CardTitle className="text-white text-lg">Generation Stats</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {matchesLoading ? (
                          <div className="flex items-center justify-center py-4">
                            <RefreshCw className="w-5 h-5 text-blue-400 animate-spin mr-2" />
                            <span className="text-slate-300">Loading matches...</span>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex justify-between">
                              <span className="text-slate-300">Available Matches:</span>
                              <span className="text-white font-semibold">{matchGenerationStats?.availableMatches || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-300">Generated Today:</span>
                              <span className="text-white font-semibold">{matchGenerationStats?.generatedToday || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-300">Total Generated:</span>
                              <span className="text-white font-semibold">{matchGenerationStats?.totalGenerated || 0}</span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <div className="p-4 bg-slate-700 rounded-lg">
                    <h4 className="font-semibold text-white mb-3">How It Works</h4>
                    <div className="text-slate-300 text-sm space-y-2">
                      <p>• <strong>Match Detection:</strong> Automatically identifies upcoming matches from QuickPurchase table</p>
                      <p>• <strong>Data Enrichment:</strong> Integrates with RapidAPI and Odds API for additional match information</p>
                      <p>• <strong>Content Generation:</strong> Creates engaging blog posts without revealing predictions</p>
                      <p>• <strong>AI Enhancement:</strong> Uses OpenAI GPT-3.5 for creative, unique content generation</p>
                      <p>• <strong>SEO Optimization:</strong> Generates optimized titles, descriptions, and keywords</p>
                      <p>• <strong>Excitement Building:</strong> Teases the match to encourage purchases</p>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-700 rounded-lg">
                    <h4 className="font-semibold text-white mb-3">AI Status</h4>
                    <div className="text-slate-300 text-sm space-y-2">
                      <div className="flex items-center space-x-2">
                        <span>OpenAI Integration:</span>
                        <Badge variant="secondary" className="bg-blue-600 text-white">
                          Available
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400">
                        • AI will generate unique titles, excerpts, and content for each match
                        • Falls back to templates if OpenAI is unavailable
                        • Creates engaging, SEO-optimized blog posts
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Template Blogs Tab */}
          <TabsContent value="templates" className="space-y-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-white">Template-Only Blog Generation</CardTitle>
                  <Badge className="bg-blue-600 text-white">
                    No AI Required
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="p-4 bg-slate-700 rounded-lg">
                    <h4 className="font-semibold text-white mb-2">About Template Blogs</h4>
                    <p className="text-slate-300 text-sm mb-3">
                      Generate simple blog previews from QuickPurchase matches. These are template-only blogs (no AI) 
                      that create compelling preview content to drive purchases without revealing full predictions.
                    </p>
                    <div className="text-slate-400 text-xs space-y-1">
                      <p>• Creates unpublished drafts for admin review</p>
                      <p>• Links back to original QuickPurchase via sourceUrl</p>
                      <p>• No AI badge - set as aiGenerated: false</p>
                      <p>• Team logos available via manual API fetch</p>
                      <p>• Minimum 60% confidence threshold</p>
                    </div>
                  </div>

                  {/* Team Logo Fetcher */}
                  <div className="p-4 bg-slate-700 rounded-lg">
                    <h4 className="font-semibold text-white mb-3">Team Logo Fetcher</h4>
                    <div className="flex gap-3 items-end">
                      <div className="flex-1">
                        <label className="block text-sm text-slate-300 mb-1">Team Name</label>
                        <input
                          type="text"
                          placeholder="e.g., Arsenal, Real Madrid"
                          className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={logoTeamName}
                          onChange={(e) => setLogoTeamName(e.target.value)}
                        />
                      </div>
                      <Button
                        onClick={handleFetchTeamLogo}
                        disabled={!logoTeamName.trim() || logoLoading}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {logoLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Fetching...
                          </>
                        ) : (
                          <>
                            <Search className="w-4 h-4 mr-2" />
                            Get Logo
                          </>
                        )}
                      </Button>
                    </div>
                    {logoResult && (
                      <div className="mt-3 p-3 bg-slate-600 rounded-md">
                        <div className="flex items-center gap-3">
                          {logoResult.logo && (
                            <img 
                              src={logoResult.logo} 
                              alt={`${logoResult.name} logo`}
                              className="w-12 h-12 object-contain"
                            />
                          )}
                          <div className="flex-1">
                            <p className="text-white font-medium">{logoResult.name}</p>
                            <p className="text-slate-300 text-sm">ID: {logoResult.id}</p>
                            <p className="text-slate-300 text-sm">Country: {logoResult.country}</p>
                            {logoResult.logo && (
                              <p className="text-blue-400 text-xs break-all">{logoResult.logo}</p>
                            )}
                          </div>
                          <Button
                            onClick={() => handleSaveLogo(logoResult)}
                            disabled={logoLoading}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <Save className="w-4 h-4 mr-1" />
                            Save Logo
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Saved Team Logos */}
                  <div className="p-4 bg-slate-700 rounded-lg">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-semibold text-white">Saved Team Logos</h4>
                      <Button
                        onClick={fetchSavedLogos}
                        disabled={savedLogosLoading}
                        size="sm"
                        variant="outline"
                        className="border-slate-500 text-slate-300 hover:bg-slate-600"
                      >
                        <RefreshCw className={`w-4 h-4 mr-1 ${savedLogosLoading ? 'animate-spin' : ''}`} />
                        Refresh
                      </Button>
                    </div>
                    
                    {savedLogosLoading ? (
                      <div className="flex items-center justify-center p-8">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                        <span className="ml-3 text-slate-400">Loading saved logos...</span>
                      </div>
                    ) : savedLogos.length === 0 ? (
                      <p className="text-slate-400 text-center py-8">No team logos saved yet.</p>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[300px] overflow-y-auto">
                        {savedLogos.map((logo) => (
                          <div key={logo.id} className="bg-slate-600 rounded-lg p-3">
                            <div className="flex flex-col items-center text-center">
                              <img 
                                src={logo.url} 
                                alt={logo.alt}
                                className="w-12 h-12 object-contain mb-2"
                              />
                              <p className="text-white text-sm font-medium truncate w-full">{logo.filename}</p>
                              <p className="text-slate-300 text-xs">{logo.caption}</p>
                              <Button
                                onClick={() => handleDeleteLogo(logo.id)}
                                size="sm"
                                variant="outline"
                                className="mt-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="bg-slate-700 border-slate-600">
                      <CardHeader>
                        <CardTitle className="text-white text-lg">Quick Actions</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <Button
                          onClick={() => handleTemplateBlogGeneration('generate_all')}
                          disabled={refreshing || templateLoading}
                          className="w-full bg-emerald-600 hover:bg-emerald-700"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          Generate All Template Blogs
                        </Button>
                        
                        <Button
                          onClick={fetchTemplateMatches}
                          disabled={templateLoading}
                          variant="outline"
                          className="w-full border-green-600 text-green-300 hover:bg-green-700 hover:text-white"
                        >
                          <RefreshCw className={`w-4 h-4 mr-2 ${templateLoading ? 'animate-spin' : ''}`} />
                          Refresh Matches
                        </Button>
                      </CardContent>
                    </Card>

                    <Card className="bg-slate-700 border-slate-600">
                      <CardHeader>
                        <CardTitle className="text-white text-lg">Stats</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {templateLoading ? (
                          <div className="flex items-center justify-center py-4">
                            <RefreshCw className="w-5 h-5 text-blue-400 animate-spin mr-2" />
                            <span className="text-slate-300">Loading matches...</span>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex justify-between">
                              <span className="text-slate-300">Available Matches:</span>
                              <span className="text-white font-semibold">{templateStats?.availableMatches || 0}</span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {templateMatches.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-white font-semibold">Eligible Matches</h3>
                      <div className="space-y-2">
                        {templateMatches.slice(0, 10).map((match) => (
                          <Card key={match.id} className="bg-slate-700 border-slate-600">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <h4 className="text-white font-semibold">{match.name}</h4>
                                  {match.description && (
                                    <p className="text-slate-400 text-sm mt-1">{match.description.slice(0, 100)}...</p>
                                  )}
                                  <div className="flex items-center gap-4 mt-2 text-sm">
                                    {match.confidenceScore && (
                                      <span className="text-slate-300">
                                        Confidence: <strong>{match.confidenceScore}%</strong>
                                      </span>
                                    )}
                                    {match.valueRating && (
                                      <span className="text-slate-300">
                                        Value: <strong>{match.valueRating}</strong>
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="ml-4">
                                  <Button
                                    onClick={() => handleTemplateBlogGeneration('generate_single', match.id)}
                                    disabled={refreshing}
                                    size="sm"
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                  >
                                    <FileText className="w-4 h-4 mr-1" />
                                    Generate
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Match Preview Dialog */}
      <Dialog open={showMatchPreview} onOpenChange={setShowMatchPreview}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Upcoming Matches Preview</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {upcomingMatches.length === 0 ? (
              <div className="text-center py-8">
                <Target className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                <p className="text-slate-400">No upcoming matches found</p>
                <p className="text-slate-500 text-sm mt-2">
                  Make sure you have active predictions in the QuickPurchase table
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-white">
                    Available Matches ({upcomingMatches.length})
                  </h3>
                  <Button
                    onClick={() => handleMatchBlogAction('generate-blogs')}
                    disabled={refreshing}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Generate All Blogs
                  </Button>
                </div>
                
                {upcomingMatches.map((match) => (
                  <Card key={match.id} className="bg-slate-700 border-slate-600">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-semibold text-white mb-2">{match.name}</h4>
                          <p className="text-slate-300 text-sm mb-2">{match.description}</p>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                            <div>
                              <span className="text-slate-400">Type:</span>
                              <span className="text-white ml-2">{match.type}</span>
                            </div>
                            {match.odds && (
                              <div>
                                <span className="text-slate-400">Odds:</span>
                                <span className="text-white ml-2">{match.odds}</span>
                              </div>
                            )}
                            {match.confidenceScore && (
                              <div>
                                <span className="text-slate-400">Confidence:</span>
                                <span className="text-white ml-2">{match.confidenceScore}%</span>
                              </div>
                            )}
                            {match.valueRating && (
                              <div>
                                <span className="text-slate-400">Value:</span>
                                <span className="text-white ml-2">{match.valueRating}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex space-x-2 ml-4">
                          <Button
                            onClick={() => previewMatchBlog(match.id)}
                            variant="outline"
                            size="sm"
                            className="border-blue-600 text-blue-300 hover:bg-blue-700 hover:text-white"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Preview
                          </Button>
                          
                          <Button
                            onClick={() => handleMatchBlogAction('generate-single', match.id)}
                            disabled={refreshing}
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            <FileText className="w-4 h-4 mr-1" />
                            Generate
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Blog Preview Dialog */}
      <Dialog open={!!previewBlogData} onOpenChange={() => setPreviewBlogData(null)}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Blog Preview</DialogTitle>
                     </DialogHeader>
          
          {previewBlogData && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-700 rounded-lg">
                <h3 className="text-xl font-bold text-white mb-2">{previewBlogData.title}</h3>
                <p className="text-slate-300 mb-4">{previewBlogData.excerpt}</p>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                  <div>
                    <span className="text-slate-400">Category:</span>
                    <span className="text-white ml-2">{previewBlogData.category}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Read Time:</span>
                    <span className="text-white ml-2">{previewBlogData.readTime} min</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Tags:</span>
                    <span className="text-white ml-2">{previewBlogData.tags.join(', ')}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">SEO Title:</span>
                    <span className="text-white ml-2 text-xs">{previewBlogData.seoTitle}</span>
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-slate-700 rounded-lg">
                <h4 className="font-semibold text-white mb-3">Generated Content</h4>
                <div 
                  className="prose prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: previewBlogData.content }}
                />
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setPreviewBlogData(null)}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
} 