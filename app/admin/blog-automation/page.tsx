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
  X
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

  useEffect(() => {
    fetchData()
  }, [])

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
        <Tabs defaultValue="feeds" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-slate-800 border-slate-700">
            <TabsTrigger value="feeds" className="data-[state=active]:bg-emerald-600">
              <Rss className="w-4 h-4 mr-2" />
              RSS Feeds
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="data-[state=active]:bg-emerald-600">
              <Activity className="w-4 h-4 mr-2" />
              Monitoring
            </TabsTrigger>
            <TabsTrigger value="generation" className="data-[state=active]:bg-emerald-600">
              <FileText className="w-4 h-4 mr-2" />
              Content Generation
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
                <CardTitle className="text-white">Content Generation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                  <p className="text-slate-400 mb-4">OpenAI integration coming soon</p>
                  <p className="text-slate-500 text-sm">
                    This feature will allow automatic blog post generation from RSS feeds using OpenAI.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
} 