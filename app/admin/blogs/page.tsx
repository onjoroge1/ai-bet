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
  Star,
  MoreVertical,
  ArrowUpDown
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Checkbox } from '@/components/ui/checkbox'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

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
  publishedAt: string | null
  createdAt?: string
  viewCount: number
  shareCount: number
  readTime: number
  isPublished: boolean
  isActive: boolean
  aiGenerated?: boolean
  sourceUrl?: string
}


export default function AdminBlogsPage() {
  const [blogs, setBlogs] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState<'date' | 'views' | 'title'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [selectedBlogs, setSelectedBlogs] = useState<Set<string>>(new Set())
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetchBlogs()
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


  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this blog post?')) return

    try {
      const response = await fetch(`/api/blogs/${id}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        toast.success('Blog post deleted successfully')
        fetchBlogs() // Refresh the list
      } else {
        toast.error(data.error || 'Failed to delete blog post')
      }
    } catch (error) {
      console.error('Error deleting blog:', error)
      toast.error('Failed to delete blog post')
    }
  }

  const handlePublish = async (id: string) => {
    try {
      const blog = blogs.find(b => b.id === id)
      if (!blog) return

      // Use PUT endpoint to update isPublished (works for all posts)
      const response = await fetch(`/api/blogs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...blog,
          isPublished: true,
          publishedAt: blog.publishedAt || new Date().toISOString()
        })
      })

      if (response.ok) {
        toast.success('Blog post published successfully')
        fetchBlogs() // Refresh the list
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to publish blog post')
      }
    } catch (error) {
      console.error('Error publishing blog:', error)
      toast.error('Failed to publish blog post')
    }
  }

  const handleToggleFeatured = async (id: string, currentFeatured: boolean) => {
    try {
      const blog = blogs.find(b => b.id === id)
      if (!blog) return

      const response = await fetch(`/api/blogs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...blog, featured: !currentFeatured })
      })

      if (response.ok) {
        toast.success(currentFeatured ? 'Removed from featured' : 'Added to featured')
        fetchBlogs()
      } else {
        toast.error('Failed to update featured status')
      }
    } catch (error) {
      console.error('Error toggling featured:', error)
      toast.error('Failed to update featured status')
    }
  }

  const handleAutoFeatureLatest = async () => {
    if (!confirm('This will unfeature all current featured posts and feature the latest published post. Continue?')) {
      return
    }

    try {
      setBulkActionLoading(true)
      
      // Get the latest published post
      const publishedBlogs = blogs.filter(b => b.isPublished).sort((a, b) => 
        new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime()
      )
      
      if (publishedBlogs.length === 0) {
        toast.error('No published posts found')
        return
      }

      const latestPost = publishedBlogs[0]

      // Unfeature all current featured posts
      const featuredPosts = blogs.filter(b => b.featured && b.id !== latestPost.id)
      const unfeaturePromises = featuredPosts.map(blog =>
        fetch(`/api/blogs/${blog.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...blog, featured: false })
        })
      )

      // Feature the latest post
      const featurePromise = fetch(`/api/blogs/${latestPost.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...latestPost, featured: true })
      })

      await Promise.all([...unfeaturePromises, featurePromise])
      
      toast.success(`Featured "${latestPost.title}" as the latest post`)
      fetchBlogs()
      setSelectedBlogs(new Set())
    } catch (error) {
      console.error('Error auto-featuring latest:', error)
      toast.error('Failed to auto-feature latest post')
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleBulkAction = async (action: 'delete' | 'publish' | 'unpublish' | 'feature' | 'unfeature') => {
    if (selectedBlogs.size === 0) {
      toast.error('Please select at least one blog post')
      return
    }

    const actionText = {
      delete: 'delete',
      publish: 'publish',
      unpublish: 'unpublish',
      feature: 'feature',
      unfeature: 'unfeature'
    }[action]

    if (!confirm(`Are you sure you want to ${actionText} ${selectedBlogs.size} post(s)?`)) {
      return
    }

    try {
      setBulkActionLoading(true)
      const promises = Array.from(selectedBlogs).map(async (id) => {
        const blog = blogs.find(b => b.id === id)
        if (!blog) return

        if (action === 'delete') {
          return fetch(`/api/blogs/${id}`, { method: 'DELETE' })
        } else if (action === 'publish') {
          // Use PUT endpoint for publishing (works for all posts)
          return fetch(`/api/blogs/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...blog,
              isPublished: true,
              publishedAt: blog.publishedAt || new Date().toISOString()
            })
          })
        } else {
          const updateData: any = { ...blog }
          if (action === 'unpublish') updateData.isPublished = false
          if (action === 'feature') updateData.featured = true
          if (action === 'unfeature') updateData.featured = false

          return fetch(`/api/blogs/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
          })
        }
      })

      await Promise.all(promises)
      toast.success(`Successfully ${actionText}ed ${selectedBlogs.size} post(s)`)
      fetchBlogs()
      setSelectedBlogs(new Set())
    } catch (error) {
      console.error(`Error ${action}ing blogs:`, error)
      toast.error(`Failed to ${actionText} posts`)
    } finally {
      setBulkActionLoading(false)
    }
  }

  const toggleSelectBlog = (id: string) => {
    const newSelected = new Set(selectedBlogs)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedBlogs(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedBlogs.size === filteredBlogs.length) {
      setSelectedBlogs(new Set())
    } else {
      setSelectedBlogs(new Set(filteredBlogs.map(b => b.id)))
    }
  }


  const filteredBlogs = blogs
    .filter(blog => {
      const matchesSearch = blog.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           blog.excerpt.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategory = categoryFilter === 'all' || blog.category === categoryFilter
      const matchesStatus = statusFilter === 'all' || 
                           (statusFilter === 'published' && blog.isPublished) ||
                           (statusFilter === 'draft' && !blog.isPublished)

      return matchesSearch && matchesCategory && matchesStatus
    })
    .sort((a, b) => {
      let comparison = 0
      
      if (sortBy === 'date') {
        const dateA = new Date(a.publishedAt || a.createdAt).getTime()
        const dateB = new Date(b.publishedAt || b.createdAt).getTime()
        comparison = dateA - dateB
      } else if (sortBy === 'views') {
        comparison = a.viewCount - b.viewCount
      } else if (sortBy === 'title') {
        comparison = a.title.localeCompare(b.title)
      }
      
      return sortOrder === 'asc' ? comparison : -comparison
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
                  <p className="text-xs text-slate-500 mt-1">
                    {blogs.filter(b => !b.isPublished).length} drafts
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
                  <button
                    onClick={handleAutoFeatureLatest}
                    disabled={bulkActionLoading}
                    className="text-xs text-emerald-400 hover:text-emerald-300 mt-1 disabled:opacity-50"
                  >
                    Auto-feature latest
                  </button>
                </div>
                <div className="p-3 bg-yellow-500/20 rounded-lg">
                  <Star className="w-6 h-6 text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>


      {/* Filters and Bulk Actions */}
      <div className="px-8">
        <Card className="bg-slate-800 border-slate-700 mb-6">
          <CardContent className="p-6 space-y-4">
            {/* Search and Filters Row */}
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

              <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
                const [by, order] = value.split('-') as ['date' | 'views' | 'title', 'asc' | 'desc']
                setSortBy(by)
                setSortOrder(order)
              }}>
                <SelectTrigger className="w-full md:w-48 bg-slate-700 border-slate-600 text-white">
                  <div className="flex items-center gap-2">
                    <ArrowUpDown className="w-4 h-4" />
                    <SelectValue placeholder="Sort" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-desc">Newest First</SelectItem>
                  <SelectItem value="date-asc">Oldest First</SelectItem>
                  <SelectItem value="views-desc">Most Views</SelectItem>
                  <SelectItem value="views-asc">Least Views</SelectItem>
                  <SelectItem value="title-asc">Title A-Z</SelectItem>
                  <SelectItem value="title-desc">Title Z-A</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Bulk Actions Bar */}
            {selectedBlogs.size > 0 && (
              <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-slate-300">
                    {selectedBlogs.size} post(s) selected
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleSelectAll}
                    className="text-slate-400 hover:text-white"
                  >
                    {selectedBlogs.size === filteredBlogs.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={bulkActionLoading}
                        className="border-slate-600 text-slate-300"
                      >
                        Bulk Actions
                        <MoreVertical className="w-4 h-4 ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                      <DropdownMenuItem
                        onClick={() => handleBulkAction('publish')}
                        className="text-green-400"
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Publish Selected
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleBulkAction('unpublish')}
                        className="text-orange-400"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Unpublish Selected
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleBulkAction('feature')}
                        className="text-yellow-400"
                      >
                        <Star className="w-4 h-4 mr-2" />
                        Feature Selected
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleBulkAction('unfeature')}
                        className="text-slate-400"
                      >
                        <Star className="w-4 h-4 mr-2" />
                        Unfeature Selected
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleBulkAction('delete')}
                        className="text-red-400"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Selected
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedBlogs(new Set())}
                    className="text-slate-400 hover:text-white"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Blog List */}
      <div className="px-8 space-y-4">
        {filteredBlogs.map((blog) => (
          <Card key={blog.id} className={`bg-slate-800 border-slate-700 hover:border-slate-600 transition-colors ${selectedBlogs.has(blog.id) ? 'border-emerald-500/50 bg-emerald-900/10' : ''}`}>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                {/* Checkbox for bulk selection */}
                <div className="pt-1">
                  <Checkbox
                    checked={selectedBlogs.has(blog.id)}
                    onCheckedChange={() => toggleSelectBlog(blog.id)}
                    className="border-slate-600"
                  />
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="text-lg font-semibold text-white">{blog.title}</h3>
                    {blog.featured && (
                      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                        <Star className="w-3 h-3 mr-1" />
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
                  
                  <div className="flex items-center gap-6 text-sm text-slate-400 flex-wrap">
                    <div className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {blog.author}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(blog.publishedAt || blog.createdAt).toLocaleDateString()}
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
                
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-400 hover:text-white"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                      <DropdownMenuItem
                        onClick={() => router.push(`/blog/${blog.slug}`)}
                        className="text-blue-400"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Post
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => router.push(`/admin/blogs/${blog.id}`)}
                        className="text-emerald-400"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {!blog.isPublished && (
                        <DropdownMenuItem
                          onClick={() => handlePublish(blog.id)}
                          className="text-green-400"
                        >
                          <Send className="w-4 h-4 mr-2" />
                          Publish
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => handleToggleFeatured(blog.id, blog.featured)}
                        className={blog.featured ? "text-orange-400" : "text-yellow-400"}
                      >
                        <Star className="w-4 h-4 mr-2" />
                        {blog.featured ? 'Unfeature' : 'Feature'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDelete(blog.id)}
                        className="text-red-400"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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