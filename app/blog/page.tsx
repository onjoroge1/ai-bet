import { Metadata } from 'next'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AdvancedBreadcrumb } from '@/components/advanced-breadcrumb'
import { 
  Search, 
  Filter, 
  Calendar, 
  Clock, 
  User, 
  Eye,
  TrendingUp,
  BookOpen
} from 'lucide-react'
import Link from 'next/link'
import prisma from '@/lib/db'
import { generateMetadata } from '@/lib/seo-helpers'

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
}

export const metadata: Metadata = generateMetadata({
  title: 'Blog - Sports Betting Tips & AI Predictions Guide',
  description: 'Expert sports betting tips, AI prediction guides, and strategy articles. Learn how to improve your betting success with our comprehensive blog.',
  url: '/blog',
  keywords: ['sports betting blog', 'betting tips', 'AI predictions guide', 'football betting strategy', 'sports analysis'],
})

async function getBlogPosts(): Promise<BlogPost[]> {
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'https://snapbet.bet'}/api/blogs?limit=20`, {
      next: { revalidate: 3600 } // Revalidate every hour
    })
    
    if (!response.ok) {
      throw new Error('Failed to fetch blog posts')
    }
    
    const data = await response.json()
    return data.success ? data.data : []
  } catch (error) {
    console.error('Error fetching blog posts:', error)
    return []
  }
}

export default async function BlogPage() {
  const blogPosts = await getBlogPosts()

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'predictions', label: 'Predictions' },
    { value: 'strategy', label: 'Strategy' },
    { value: 'analysis', label: 'Analysis' },
    { value: 'technology', label: 'Technology' },
    { value: 'success-stories', label: 'Success Stories' },
    { value: 'tips', label: 'Tips' }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Breadcrumb Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <AdvancedBreadcrumb />
      </div>

      {/* Header */}
      <div className="bg-slate-800/50 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              SnapBet AI Blog
            </h1>
            <p className="text-xl text-slate-300 mb-8 max-w-3xl mx-auto">
              Expert insights, AI prediction guides, and proven betting strategies to help you make informed decisions and maximize your success.
            </p>
            
            {/* Search and Filter */}
            <div className="flex flex-col md:flex-row gap-4 max-w-2xl mx-auto">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <Input
                  placeholder="Search articles..."
                  className="pl-10 bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                />
              </div>
              <Select defaultValue="all">
                <SelectTrigger className="w-full md:w-48 bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(category => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Featured Posts */}
      {blogPosts.filter(post => post.featured).length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center gap-3 mb-8">
            <TrendingUp className="w-6 h-6 text-emerald-400" />
            <h2 className="text-2xl font-bold text-white">Featured Articles</h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {blogPosts.filter(post => post.featured).slice(0, 2).map((post) => (
              <Card key={post.id} className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-colors">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                      Featured
                    </Badge>
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                      {post.category}
                    </Badge>
                  </div>
                  
                  <h3 className="text-xl font-bold text-white mb-3">
                    <Link href={`/blog/${post.slug}`} className="hover:text-emerald-400 transition-colors">
                      {post.title}
                    </Link>
                  </h3>
                  
                  <p className="text-slate-300 mb-4 line-clamp-3">
                    {post.excerpt}
                  </p>
                  
                  <div className="flex items-center justify-between text-sm text-slate-400">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {post.author}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(post.publishedAt).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {post.readTime} min read
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      {post.viewCount}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* All Posts */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center gap-3 mb-8">
          <BookOpen className="w-6 h-6 text-emerald-400" />
          <h2 className="text-2xl font-bold text-white">Latest Articles</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {blogPosts.map((post) => (
            <Card key={post.id} className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                    {post.category}
                  </Badge>
                  {post.featured && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                      Featured
                    </Badge>
                  )}
                </div>
                
                <h3 className="text-lg font-bold text-white mb-3">
                  <Link href={`/blog/${post.slug}`} className="hover:text-emerald-400 transition-colors">
                    {post.title}
                  </Link>
                </h3>
                
                <p className="text-slate-300 mb-4 line-clamp-2">
                  {post.excerpt}
                </p>
                
                <div className="flex items-center justify-between text-sm text-slate-400 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {post.author}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {post.readTime} min
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    {post.viewCount}
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {new Date(post.publishedAt).toLocaleDateString()}
                  </span>
                  <Button 
                    asChild
                    variant="ghost" 
                    size="sm"
                    className="text-emerald-400 hover:text-emerald-300"
                  >
                    <Link href={`/blog/${post.slug}`}>
                      Read More →
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        {blogPosts.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-400 mb-2">No articles found</h3>
            <p className="text-slate-500">Check back soon for new content!</p>
          </div>
        )}
      </div>

      {/* Newsletter Signup */}
      <div className="bg-slate-800/50 border-t border-slate-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-4">
              Stay Updated with Latest Tips
            </h2>
            <p className="text-slate-300 mb-6">
              Get the latest AI predictions, betting strategies, and expert insights delivered to your inbox.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
              <Input
                placeholder="Enter your email"
                className="bg-slate-700 border-slate-600 text-white"
              />
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                Subscribe
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 