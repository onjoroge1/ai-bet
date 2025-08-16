'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Search, 
  Filter, 
  Calendar, 
  Clock, 
  User, 
  Eye,
  X,
  ArrowRight,
  TrendingUp,
  Target,
  BarChart3,
  Zap,
  Star,
  Sparkles,
  BookOpen,
  Loader2
} from 'lucide-react'
import Link from 'next/link'
import { useDebounce } from '@/hooks/use-debounce'

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
  imageUrl?: string
}

interface SearchFilters {
  category: string
  author: string
  dateRange: string
  readTime: string
  featured: boolean
}

const categories = [
  { value: 'all', label: 'All Categories', icon: BookOpen },
  { value: 'predictions', label: 'Predictions', icon: Target },
  { value: 'strategy', label: 'Strategy', icon: BarChart3 },
  { value: 'analysis', label: 'Analysis', icon: TrendingUp },
  { value: 'technology', label: 'Technology', icon: Zap },
  { value: 'success-stories', label: 'Success Stories', icon: Star },
  { value: 'tips', label: 'Tips', icon: Sparkles }
]

const dateRanges = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' }
]

const readTimeOptions = [
  { value: 'all', label: 'Any Length' },
  { value: 'short', label: 'Short (< 5 min)' },
  { value: 'medium', label: 'Medium (5-10 min)' },
  { value: 'long', label: 'Long (> 10 min)' }
]

export function BlogSearch() {
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState<SearchFilters>({
    category: 'all',
    author: '',
    dateRange: 'all',
    readTime: 'all',
    featured: false
  })
  const [results, setResults] = useState<BlogPost[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [allPosts, setAllPosts] = useState<BlogPost[]>([])
  const searchRef = useRef<HTMLDivElement>(null)
  const debouncedQuery = useDebounce(searchQuery, 300)

  // Fetch all blog posts on component mount
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const response = await fetch('/api/blogs?limit=100')
        const data = await response.json()
        if (data.success) {
          setAllPosts(data.data)
        }
      } catch (error) {
        console.error('Error fetching blog posts:', error)
      }
    }
    fetchPosts()
  }, [])

  // Search and filter logic
  useEffect(() => {
    if (!debouncedQuery && filters.category === 'all' && !filters.featured) {
      setResults([])
      setShowResults(false)
      return
    }

    setIsLoading(true)
    
    // Simulate API delay
    const timeout = setTimeout(() => {
      const filteredResults = allPosts.filter(post => {
        // Text search
        const matchesSearch = !debouncedQuery || 
          post.title.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
          post.excerpt.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
          post.tags.some(tag => tag.toLowerCase().includes(debouncedQuery.toLowerCase()))

        // Category filter
        const matchesCategory = filters.category === 'all' || post.category === filters.category

        // Author filter
        const matchesAuthor = !filters.author || 
          post.author.toLowerCase().includes(filters.author.toLowerCase())

        // Date range filter
        const matchesDateRange = filterByDateRange(post.publishedAt, filters.dateRange)

        // Read time filter
        const matchesReadTime = filterByReadTime(post.readTime, filters.readTime)

        // Featured filter
        const matchesFeatured = !filters.featured || post.featured

        return matchesSearch && matchesCategory && matchesAuthor && 
               matchesDateRange && matchesReadTime && matchesFeatured
      })

      setResults(filteredResults)
      setShowResults(true)
      setIsLoading(false)
    }, 300)

    return () => clearTimeout(timeout)
  }, [debouncedQuery, filters, allPosts])

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filterByDateRange = (publishedAt: string, dateRange: string): boolean => {
    if (dateRange === 'all') return true
    
    const postDate = new Date(publishedAt)
    const now = new Date()
    
    switch (dateRange) {
      case 'today':
        return postDate.toDateString() === now.toDateString()
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        return postDate >= weekAgo
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        return postDate >= monthAgo
      case 'year':
        const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        return postDate >= yearAgo
      default:
        return true
    }
  }

  const filterByReadTime = (readTime: number, filter: string): boolean => {
    switch (filter) {
      case 'short':
        return readTime < 5
      case 'medium':
        return readTime >= 5 && readTime <= 10
      case 'long':
        return readTime > 10
      default:
        return true
    }
  }

  const clearSearch = () => {
    setSearchQuery('')
    setFilters({
      category: 'all',
      author: '',
      dateRange: 'all',
      readTime: 'all',
      featured: false
    })
    setShowResults(false)
  }

  const getCategoryIcon = (category: string) => {
    const cat = categories.find(c => c.value === category)
    return cat ? cat.icon : BookOpen
  }

  return (
    <div className="relative" ref={searchRef}>
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
        <Input
          placeholder="Search articles, predictions, strategies..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-12 pr-20 bg-slate-600 border-slate-500 text-white placeholder-slate-400 h-12 text-lg"
          onFocus={() => setShowResults(true)}
        />
        {searchQuery && (
          <Button
            size="sm"
            variant="ghost"
            onClick={clearSearch}
            className="absolute right-16 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
        <Button 
          size="sm" 
          className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-emerald-600 hover:bg-emerald-700"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
        </Button>
      </div>

      {/* Advanced Filters */}
      <div className="mt-4 bg-slate-700/50 rounded-lg p-4 border border-slate-600">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Category Filter */}
          <div>
            <label className="text-sm text-slate-300 mb-2 block">Category</label>
            <Select value={filters.category} onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}>
              <SelectTrigger className="bg-slate-600 border-slate-500 text-white">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                {categories.map(category => (
                  <SelectItem key={category.value} value={category.value} className="text-white hover:bg-slate-600">
                    <div className="flex items-center gap-2">
                      <category.icon className="w-4 h-4" />
                      {category.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Author Filter */}
          <div>
            <label className="text-sm text-slate-300 mb-2 block">Author</label>
            <Input
              placeholder="Search by author..."
              value={filters.author}
              onChange={(e) => setFilters(prev => ({ ...prev, author: e.target.value }))}
              className="bg-slate-600 border-slate-500 text-white"
            />
          </div>

          {/* Date Range Filter */}
          <div>
            <label className="text-sm text-slate-300 mb-2 block">Date Range</label>
            <Select value={filters.dateRange} onValueChange={(value) => setFilters(prev => ({ ...prev, dateRange: value }))}>
              <SelectTrigger className="bg-slate-600 border-slate-500 text-white">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                {dateRanges.map(range => (
                  <SelectItem key={range.value} value={range.value} className="text-white hover:bg-slate-600">
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Read Time Filter */}
          <div>
            <label className="text-sm text-slate-300 mb-2 block">Read Time</label>
            <Select value={filters.readTime} onValueChange={(value) => setFilters(prev => ({ ...prev, readTime: value }))}>
              <SelectTrigger className="bg-slate-600 border-slate-500 text-white">
                <SelectValue placeholder="Read Time" />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                {readTimeOptions.map(option => (
                  <SelectItem key={option.value} value={option.value} className="text-white hover:bg-slate-600">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Featured Filter */}
        <div className="mt-4">
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.featured}
              onChange={(e) => setFilters(prev => ({ ...prev, featured: e.target.checked }))}
              className="rounded border-slate-500 bg-slate-600 text-emerald-500 focus:ring-emerald-500"
            />
            Featured articles only
          </label>
        </div>
      </div>

      {/* Search Results */}
      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mx-auto mb-4" />
              <p className="text-slate-400">Searching...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">
                  {results.length} result{results.length !== 1 ? 's' : ''} found
                </h3>
                <Button variant="ghost" size="sm" onClick={clearSearch} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="space-y-3">
                {results.slice(0, 8).map((post) => {
                  const CategoryIcon = getCategoryIcon(post.category)
                  return (
                    <Link key={post.id} href={`/blog/${post.slug}`} onClick={() => setShowResults(false)}>
                      <Card className="bg-slate-700/50 border-slate-600 hover:border-emerald-500/50 transition-all duration-200 cursor-pointer">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0">
                              <div className="p-2 bg-emerald-500/20 rounded-lg">
                                <CategoryIcon className="w-4 h-4 text-emerald-400" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                                  {post.category}
                                </Badge>
                                {post.featured && (
                                  <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">
                                    Featured
                                  </Badge>
                                )}
                              </div>
                              <h4 className="text-white font-semibold mb-1 hover:text-emerald-400 transition-colors overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
                                {post.title}
                              </h4>
                              <p className="text-slate-300 text-sm mb-2 overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                {post.excerpt}
                              </p>
                              <div className="flex items-center gap-4 text-xs text-slate-400">
                                <span>{post.author}</span>
                                <span>•</span>
                                <span>{post.readTime} min read</span>
                                <span>•</span>
                                <span>{new Date(post.publishedAt).toLocaleDateString()}</span>
                                <span>•</span>
                                <div className="flex items-center gap-1">
                                  <Eye className="w-3 h-3" />
                                  {post.viewCount}
                                </div>
                              </div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  )
                })}
              </div>
              
              {results.length > 8 && (
                <div className="mt-4 text-center">
                  <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                    View all {results.length} results
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center">
              <Search className="w-8 h-8 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-400 mb-2">No results found</h3>
              <p className="text-slate-500">Try adjusting your search terms or filters</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
