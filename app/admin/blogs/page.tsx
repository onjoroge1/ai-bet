'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AdvancedBreadcrumb } from '@/components/advanced-breadcrumb'
import { 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Eye, 
  Calendar,
  User,
  Tag,
  Globe,
  TrendingUp,
  BookOpen,
  Send,
  Bot,
  AlertTriangle,
  Megaphone,
  Settings,
  Clock,
  Trophy,
  RefreshCw,
  Download,
  Zap,
  Play,
  Square
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt: string
  author: string
  category: string
  tags: string[]
  geoTarget: string[]
  featured: boolean
  publishedAt: string
  viewCount: number
  shareCount: number
  readTime: number
  isPublished: boolean
  isActive: boolean
  aiGenerated?: boolean
  sourceUrl?: string
}

interface BreakingNews {
  id: string
  title: string
  message: string
  priority: number
  isActive: boolean
  expiresAt?: string
  createdAt: string
  updatedAt: string
  sourceType?: string // Added for completed matches
}

interface CompletedMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  league: string;
  matchDate: string;
  venue?: string;
  referee?: string;
  syncedToBreakingNews?: boolean;
  syncedAt?: string;
}

export default function AdminBlogsPage() {
  const [blogs, setBlogs] = useState<BlogPost[]>([])
  const [breakingNews, setBreakingNews] = useState<BreakingNews[]>([])
  const [completedMatches, setCompletedMatches] = useState<CompletedMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [breakingNewsLoading, setBreakingNewsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showBreakingNewsForm, setShowBreakingNewsForm] = useState(false)
  const [breakingNewsForm, setBreakingNewsForm] = useState({
    title: '',
    message: '',
    priority: 1,
    isActive: true,
    expiresAt: ''
  })
  const [showBreakingNewsModal, setShowBreakingNewsModal] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [cronStatus, setCronStatus] = useState({
    isRunning: false,
    activeIntervals: 0,
    nextSyncIn: 'Not running',
    nextCleanupIn: 'Not running'
  })
  const router = useRouter()

  useEffect(() => {
    fetchBlogs()
    fetchBreakingNews()
    fetchCompletedMatches()
    fetchCronStatus()
  }, [])

  const fetchBlogs = async () => {
    try {
      const response = await fetch('/api/blogs?limit=50')
      const data = await response.json()
      
      if (data.success) {
        setBlogs(data.data)
      }
    } catch (error) {
      console.error('Error fetching blogs:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchBreakingNews = async () => {
    try {
      const response = await fetch('/api/admin/breaking-news')
      const data = await response.json()
      
      if (data.success) {
        setBreakingNews(data.data)
      }
    } catch (error) {
      console.error('Error fetching breaking news:', error)
    }
  }

  const fetchCompletedMatches = async () => {
    try {
      const response = await fetch('/api/admin/match-results?action=list')
      const data = await response.json()
      if (data.matches) {
        setCompletedMatches(data.matches)
      }
    } catch (error) {
      console.error('Error fetching completed matches:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this blog post?')) return

    try {
      const response = await fetch(`/api/blogs/${id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        fetchBlogs() // Refresh the list
      }
    } catch (error) {
      console.error('Error deleting blog:', error)
    }
  }

  const handlePublish = async (id: string) => {
    try {
      const response = await fetch(`/api/blogs/${id}/publish`, {
        method: 'POST'
      })
      
      if (response.ok) {
        fetchBlogs() // Refresh the list
      }
    } catch (error) {
      console.error('Error publishing blog:', error)
    }
  }

  const handleBreakingNewsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBreakingNewsLoading(true)
    
    try {
      const response = await fetch('/api/admin/breaking-news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(breakingNewsForm)
      })
      
      if (response.ok) {
        setBreakingNewsForm({ title: '', message: '', priority: 1, isActive: true, expiresAt: '' })
        setShowBreakingNewsForm(false)
        fetchBreakingNews()
      }
    } catch (error) {
      console.error('Error creating breaking news:', error)
    } finally {
      setBreakingNewsLoading(false)
    }
  }

  const handleBreakingNewsToggle = async (id: string, isActive: boolean) => {
    try {
      const newsItem = breakingNews.find(item => item.id === id)
      if (!newsItem) return
      
      const response = await fetch('/api/admin/breaking-news', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newsItem, isActive: !isActive })
      })
      
      if (response.ok) {
        fetchBreakingNews()
      }
    } catch (error) {
      console.error('Error updating breaking news:', error)
    }
  }

  const handleBreakingNewsDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this breaking news item?')) return
    
    try {
      const response = await fetch(`/api/admin/breaking-news?id=${id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        fetchBreakingNews()
      }
    } catch (error) {
      console.error('Error deleting breaking news:', error)
    }
  }

  const toggleBreakingNewsStatus = async (id: string) => {
    try {
      const newsItem = breakingNews.find(item => item.id === id)
      if (!newsItem) return
      
      const response = await fetch('/api/admin/breaking-news', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newsItem, isActive: !newsItem.isActive })
      })
      
      if (response.ok) {
        fetchBreakingNews()
      }
    } catch (error) {
      console.error('Error toggling breaking news status:', error)
    }
  }

  const deleteBreakingNews = async (id: string) => {
    if (!confirm('Are you sure you want to delete this breaking news item?')) return
    
    try {
      const response = await fetch(`/api/admin/breaking-news?id=${id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        fetchBreakingNews()
      }
    } catch (error) {
      console.error('Error deleting breaking news:', error)
    }
  }

  const handleFetchMatches = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/match-results?action=fetch')
      const data = await response.json()
      if (data.success) {
        fetchCompletedMatches()
        alert('Completed matches fetched successfully!')
      } else {
        alert('Failed to fetch completed matches.')
      }
    } catch (error) {
      console.error('Error fetching matches:', error)
      alert('Failed to fetch completed matches.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSyncToNews = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/match-results?action=sync')
      const data = await response.json()
      if (data.success) {
        fetchCompletedMatches()
        alert('Completed matches synced to news successfully!')
      } else {
        alert('Failed to sync completed matches to news.')
      }
    } catch (error) {
      console.error('Error syncing matches to news:', error)
      alert('Failed to sync completed matches to news.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleManualSync = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/match-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'manual-sync' })
      })
      const data = await response.json()
      if (data.success) {
        fetchCompletedMatches()
        alert('Full sync completed successfully!')
      } else {
        alert('Failed to perform full sync.')
      }
    } catch (error) {
      console.error('Error performing full sync:', error)
      alert('Failed to perform full sync.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSyncMatch = async (id: string) => {
    if (!confirm('Are you sure you want to sync this match to breaking news?')) return
    setIsLoading(true)
    try {
      // For individual match sync, we'll use the sync action which will process all unsynced matches
      const response = await fetch('/api/admin/match-results?action=sync')
      const data = await response.json()
      if (data.success) {
        fetchCompletedMatches()
        alert('Match synced to breaking news successfully!')
      } else {
        alert('Failed to sync match to breaking news.')
      }
    } catch (error) {
      console.error('Error syncing match:', error)
      alert('Failed to sync match to breaking news.')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchCronStatus = async () => {
    try {
      const response = await fetch('/api/admin/cron')
      const data = await response.json()
      if (data.success) {
        setCronStatus(data.status)
      }
    } catch (error) {
      console.error('Error fetching cron status:', error)
    }
  }

  const handleStartCron = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' })
      })
      const data = await response.json()
      if (data.success) {
        fetchCronStatus()
        alert('Automated sync started successfully!')
      } else {
        alert('Failed to start automated sync.')
      }
    } catch (error) {
      console.error('Error starting cron:', error)
      alert('Failed to start automated sync.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleStopCron = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' })
      })
      const data = await response.json()
      if (data.success) {
        fetchCronStatus()
        alert('Automated sync stopped successfully!')
      } else {
        alert('Failed to stop automated sync.')
      }
    } catch (error) {
      console.error('Error stopping cron:', error)
      alert('Failed to stop automated sync.')
    } finally {
      setIsLoading(false)
    }
  }

  const filteredBlogs = blogs.filter(blog => {
    const matchesSearch = blog.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         blog.excerpt.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || blog.category === categoryFilter
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'published' && blog.isPublished) ||
                         (statusFilter === 'draft' && !blog.isPublished)

    return matchesSearch && matchesCategory && matchesStatus
  })

  const categories = ['all', 'predictions', 'strategy', 'analysis', 'technology', 'success-stories', 'tips']
  const statuses = ['all', 'published', 'draft']

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-700 rounded w-1/4 mb-8"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-slate-700 rounded"></div>
            ))}
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
              <BookOpen className="w-8 h-8 text-emerald-400" />
              <span>Blog Management</span>
            </h1>
            <p className="text-slate-300">Create, edit, and manage blog content</p>
          </div>

          <div className="flex items-center space-x-4 mt-4 md:mt-0">
            <Button asChild className="bg-purple-600 hover:bg-purple-700">
              <Link href="/admin/blog-automation">
                <Bot className="w-4 h-4 mr-2" />
                Blog Automation
              </Link>
            </Button>
            
            <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
              <Link href="/admin/blogs/create">
                <Plus className="w-4 h-4 mr-2" />
                Create Post
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Total Posts</p>
                  <p className="text-2xl font-bold text-white">{blogs.length}</p>
                </div>
                <div className="p-3 bg-blue-500/20 rounded-lg">
                  <Edit className="w-6 h-6 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Published</p>
                  <p className="text-2xl font-bold text-white">
                    {blogs.filter(b => b.isPublished).length}
                  </p>
                </div>
                <div className="p-3 bg-green-500/20 rounded-lg">
                  <Eye className="w-6 h-6 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Total Views</p>
                  <p className="text-2xl font-bold text-white">
                    {blogs.reduce((sum, blog) => sum + blog.viewCount, 0).toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-purple-500/20 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Featured</p>
                  <p className="text-2xl font-bold text-white">
                    {blogs.filter(b => b.featured).length}
                  </p>
                </div>
                <div className="p-3 bg-yellow-500/20 rounded-lg">
                  <Tag className="w-6 h-6 text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Breaking News Management */}
      <div className="px-8">
        <Card className="bg-slate-800 border-slate-700 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Breaking News Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <p className="text-slate-300 text-sm">
                Manage breaking news items that appear in the blog ticker
              </p>
              <Button 
                onClick={() => setShowBreakingNewsForm(true)}
                className="bg-red-600 hover:bg-red-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Breaking News
              </Button>
            </div>
            
            {/* Breaking News Form */}
            {showBreakingNewsForm && (
              <form onSubmit={handleBreakingNewsSubmit} className="bg-slate-700/50 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-300 mb-2 block">Title</label>
                    <Input
                      placeholder="Breaking news title"
                      value={breakingNewsForm.title}
                      onChange={(e) => setBreakingNewsForm(prev => ({ ...prev, title: e.target.value }))}
                      className="bg-slate-600 border-slate-500 text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-300 mb-2 block">Priority</label>
                    <Select 
                      value={breakingNewsForm.priority.toString()} 
                      onValueChange={(value) => setBreakingNewsForm(prev => ({ ...prev, priority: parseInt(value) }))}
                    >
                      <SelectTrigger className="bg-slate-600 border-slate-500 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Low Priority</SelectItem>
                        <SelectItem value="2">Medium Priority</SelectItem>
                        <SelectItem value="3">High Priority</SelectItem>
                        <SelectItem value="4">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm text-slate-300 mb-2 block">Message</label>
                    <Input
                      placeholder="Full breaking news message"
                      value={breakingNewsForm.message}
                      onChange={(e) => setBreakingNewsForm(prev => ({ ...prev, message: e.target.value }))}
                      className="bg-slate-600 border-slate-500 text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-300 mb-2 block">Expires At (Optional)</label>
                    <Input
                      type="datetime-local"
                      value={breakingNewsForm.expiresAt}
                      onChange={(e) => setBreakingNewsForm(prev => ({ ...prev, expiresAt: e.target.value }))}
                      className="bg-slate-600 border-slate-500 text-white"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={breakingNewsForm.isActive}
                      onChange={(e) => setBreakingNewsForm(prev => ({ ...prev, isActive: e.target.checked }))}
                      className="rounded border-slate-500 bg-slate-600 text-red-500 focus:ring-red-500"
                    />
                    <label htmlFor="isActive" className="text-sm text-slate-300">Active immediately</label>
                  </div>
                </div>
                <div className="mt-4">
                  <Button 
                    type="submit" 
                    className="bg-red-600 hover:bg-red-700"
                    disabled={breakingNewsLoading}
                  >
                    {breakingNewsLoading ? 'Creating...' : 'Create Breaking News'}
                  </Button>
                </div>
              </form>
            )}

            {/* Breaking News List */}
            <div className="space-y-3">
              {breakingNews.map((news) => (
                <div key={news.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg border border-slate-600">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-white">{news.title}</h4>
                      <Badge className={`${
                        news.priority === 4 ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                        news.priority === 3 ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                        news.priority === 2 ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                        'bg-blue-500/20 text-blue-400 border-blue-500/30'
                      }`}>
                        Priority {news.priority}
                      </Badge>
                      {news.isActive ? (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>
                      ) : (
                        <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">Inactive</Badge>
                      )}
                    </div>
                    <p className="text-slate-300 text-sm mb-2">{news.message}</p>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span>Created: {new Date(news.createdAt).toLocaleDateString()}</span>
                      {news.expiresAt && (
                        <span>Expires: {new Date(news.expiresAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBreakingNewsToggle(news.id, news.isActive)}
                      className={`${
                        news.isActive 
                          ? 'border-orange-500 text-orange-400 hover:bg-orange-500/20' 
                          : 'border-green-500 text-green-400 hover:bg-green-500/20'
                      }`}
                    >
                      {news.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBreakingNewsDelete(news.id)}
                      className="border-red-500 text-red-400 hover:bg-red-500/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {breakingNews.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  <Megaphone className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                  <p>No breaking news items yet</p>
                  <p className="text-sm">Create your first breaking news item to get started</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Completed Matches Management */}
      <div className="px-8">
        <Card className="bg-slate-800 border-slate-700 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Trophy className="w-5 h-5 text-emerald-400" />
              Completed Matches Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <p className="text-slate-300 text-sm">
                Automatically sync completed matches from RapidAPI to breaking news
              </p>
              <div className="flex gap-2">
                <Button 
                  onClick={handleFetchMatches}
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isLoading ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  Fetch Matches
                </Button>
                <Button 
                  onClick={handleSyncToNews}
                  disabled={isLoading}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {isLoading ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Sync to News
                </Button>
                <Button 
                  onClick={handleManualSync}
                  disabled={isLoading}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {isLoading ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4 mr-2" />
                  )}
                  Full Sync
                </Button>
              </div>
            </div>
            
            {/* Completed Matches List */}
            <div className="space-y-3">
              {completedMatches.map((match) => (
                <div key={match.id} className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-white">
                        {match.homeTeam} {match.homeScore} - {match.awayScore} {match.awayTeam}
                      </h4>
                      <Badge variant="outline" className="text-blue-400 border-blue-400">
                        {match.league}
                      </Badge>
                      {match.syncedToBreakingNews && (
                        <Badge variant="outline" className="text-emerald-400 border-emerald-400">
                          Synced
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                      <span>Date: {new Date(match.matchDate).toLocaleDateString()}</span>
                      <span>Venue: {match.venue || 'N/A'}</span>
                      <span>Referee: {match.referee || 'N/A'}</span>
                      {match.syncedAt && (
                        <span>Synced: {new Date(match.syncedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!match.syncedToBreakingNews && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSyncMatch(match.id)}
                        disabled={isLoading}
                        className="border-emerald-500 text-emerald-500 hover:bg-emerald-500/10"
                      >
                        Sync Now
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Automated Sync Management */}
      <div className="px-8">
        <Card className="bg-slate-800 border-slate-700 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Settings className="w-5 h-5 text-blue-400" />
              Automated Sync Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <p className="text-slate-300 text-sm">
                Control automated sync tasks that run every 2 hours to fetch new matches and sync to breaking news
              </p>
              <div className="flex gap-2">
                <Button 
                  onClick={handleStartCron}
                  disabled={isLoading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Auto-Sync
                </Button>
                <Button 
                  onClick={handleStopCron}
                  disabled={isLoading}
                  variant="outline"
                  className="border-red-500 text-red-500 hover:bg-red-500/10"
                >
                  <Square className="w-4 h-4 mr-2" />
                  Stop Auto-Sync
                </Button>
              </div>
            </div>
            
            {/* Cron Status */}
            <div className="bg-slate-700 rounded-lg p-4">
              <h4 className="font-medium text-white mb-3">Sync Task Status</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-400">Status:</span>
                  <span className={`ml-2 font-medium ${cronStatus.isRunning ? 'text-green-400' : 'text-red-400'}`}>
                    {cronStatus.isRunning ? 'Running' : 'Stopped'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Next Sync:</span>
                  <span className="ml-2 text-white">{cronStatus.nextSyncIn}</span>
                </div>
                <div>
                  <span className="text-slate-400">Next Cleanup:</span>
                  <span className="ml-2 text-white">{cronStatus.nextCleanupIn}</span>
                </div>
                <div>
                  <span className="text-slate-400">Active Tasks:</span>
                  <span className="ml-2 text-white">{cronStatus.activeIntervals}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="px-8">
        <Card className="bg-slate-800 border-slate-700 mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Search blogs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-slate-700 border-slate-600 text-white"
                  />
                </div>
              </div>
              
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full md:w-48 bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category === 'all' ? 'All Categories' : category.charAt(0).toUpperCase() + category.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48 bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map(status => (
                    <SelectItem key={status} value={status}>
                      {status === 'all' ? 'All Status' : status.charAt(0).toUpperCase() + status.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Blog List */}
      <div className="px-8 space-y-4">
        {filteredBlogs.map((blog) => (
          <Card key={blog.id} className="bg-slate-800 border-slate-700 hover:border-slate-600 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">{blog.title}</h3>
                    {blog.featured && (
                      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                        Featured
                      </Badge>
                    )}
                    {blog.aiGenerated && (
                      <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                        AI Generated
                      </Badge>
                    )}
                    <Badge className={blog.isPublished ? 
                      "bg-green-500/20 text-green-400 border-green-500/30" : 
                      "bg-orange-500/20 text-orange-400 border-orange-500/30"
                    }>
                      {blog.isPublished ? 'Published' : 'Draft'}
                    </Badge>
                  </div>
                  
                  <p className="text-slate-300 mb-3 line-clamp-2">{blog.excerpt}</p>
                  
                  <div className="flex items-center gap-6 text-sm text-slate-400">
                    <div className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {blog.author}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(blog.publishedAt).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      {blog.viewCount} views
                    </div>
                    <div className="flex items-center gap-1">
                      <Tag className="w-4 h-4" />
                      {blog.category}
                    </div>
                    <div className="flex items-center gap-1">
                      <Globe className="w-4 h-4" />
                      {blog.geoTarget.join(', ')}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/blog/${blog.slug}`)}
                    className="text-blue-400 hover:text-blue-300"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  {!blog.isPublished && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePublish(blog.id)}
                      className="text-green-400 hover:text-green-300"
                      title="Publish post"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/admin/blogs/${blog.id}`)}
                    className="text-emerald-400 hover:text-emerald-300"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(blog.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {filteredBlogs.length === 0 && (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-12 text-center">
              <p className="text-slate-400 mb-4">No blog posts found</p>
              <Button 
                onClick={() => router.push('/admin/blogs/create')}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Post
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
} 