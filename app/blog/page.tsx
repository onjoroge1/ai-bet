import { Metadata } from 'next'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AdvancedBreadcrumb } from '@/components/advanced-breadcrumb'
import { 
  Calendar, 
  Clock, 
  User, 
  Eye,
  TrendingUp,
  BookOpen,
  Zap,
  Target,
  BarChart3,
  Star,
  Play,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  ChevronRight,
  RefreshCw
} from 'lucide-react'
import Link from 'next/link'
import prisma from '@/lib/db'
import { generateMetadata } from '@/lib/seo-helpers'
import { BlogSearch } from '@/components/blog-search'
import { LivePredictionsTicker } from '@/components/live-predictions-ticker'
import { TrendingTopics } from '@/components/trending-topics'
import { BreakingNewsTicker } from '@/components/breaking-news-ticker'
import { NewsletterSignup } from '@/components/newsletter-signup'

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

export const metadata: Metadata = generateMetadata({
  title: 'Blog - Sports Betting Tips & AI Predictions Guide',
  description: 'Expert sports betting tips, AI prediction guides, and strategy articles. Learn how to improve your betting success with our comprehensive blog.',
  url: '/blog',
  keywords: ['sports betting blog', 'betting tips', 'AI predictions guide', 'football betting strategy', 'sports analysis'],
})

async function getBlogPosts(): Promise<BlogPost[]> {
  try {
    const url = `${process.env.NEXTAUTH_URL || 'https://snapbet.bet'}/api/blogs?limit=20`
    const response = await fetch(url, {
      next: { revalidate: 3600 } // Revalidate every hour
    })
    const text = await response.text()
    let data
    try {
      data = JSON.parse(text)
    } catch (e) {
      console.error('[BlogPage] Failed to parse JSON:', e)
      return []
    }
    console.log('[BlogPage] Parsed data:', data)
    if (Array.isArray(data)) {
      return data
    }
    return data.success ? data.data : []
  } catch (error) {
    console.error('[BlogPage] Error fetching blog posts:', error)
    return []
  }
}

export default async function BlogPage() {
  const blogPosts = await getBlogPosts()
  console.log('[BlogPage] blogPosts array:', blogPosts)



  const featuredPost = blogPosts.find(post => post.featured) || blogPosts[0]
  const regularPosts = blogPosts.filter(post => post.id !== featuredPost?.id)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Breadcrumb Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <AdvancedBreadcrumb />
      </div>

             {/* Breaking News Ticker */}
       <BreakingNewsTicker />

      {/* Enhanced Header */}
      <div className="bg-slate-800/50 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="p-3 bg-emerald-500/20 rounded-full">
                <BookOpen className="w-8 h-8 text-emerald-400" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-white">
                SnapBet AI Blog
              </h1>
            </div>
            <p className="text-xl text-slate-300 mb-8 max-w-3xl mx-auto">
              Expert insights, AI prediction guides, and proven betting strategies to help you make informed decisions and maximize your success.
            </p>
          </div>
          
          {/* Enhanced Search and Filter */}
          <div className="max-w-4xl mx-auto">
            <BlogSearch />
          </div>
        </div>
      </div>

      {/* Category Navigation */}
      <div className="bg-slate-800/30 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            <Button
              variant="ghost"
              className="flex items-center gap-2 text-slate-300 hover:text-white hover:bg-slate-700 whitespace-nowrap px-4 py-2 rounded-lg"
            >
              <BookOpen className="w-4 h-4" />
              All Categories
            </Button>
            <Button
              variant="ghost"
              className="flex items-center gap-2 text-slate-300 hover:text-white hover:bg-slate-700 whitespace-nowrap px-4 py-2 rounded-lg"
            >
              <Target className="w-4 h-4" />
              Predictions
            </Button>
            <Button
              variant="ghost"
              className="flex items-center gap-2 text-slate-300 hover:text-white hover:bg-slate-700 whitespace-nowrap px-4 py-2 rounded-lg"
            >
              <BarChart3 className="w-4 h-4" />
              Strategy
            </Button>
            <Button
              variant="ghost"
              className="flex items-center gap-2 text-slate-300 hover:text-white hover:bg-slate-700 whitespace-nowrap px-4 py-2 rounded-lg"
            >
              <TrendingUp className="w-4 h-4" />
              Analysis
            </Button>
            <Button
              variant="ghost"
              className="flex items-center gap-2 text-slate-300 hover:text-white hover:bg-slate-700 whitespace-nowrap px-4 py-2 rounded-lg"
            >
              <Zap className="w-4 h-4" />
              Technology
            </Button>
            <Button
              variant="ghost"
              className="flex items-center gap-2 text-slate-300 hover:text-white hover:bg-slate-700 whitespace-nowrap px-4 py-2 rounded-lg"
            >
              <Star className="w-4 h-4" />
              Success Stories
            </Button>
            <Button
              variant="ghost"
              className="flex items-center gap-2 text-slate-300 hover:text-white hover:bg-slate-700 whitespace-nowrap px-4 py-2 rounded-lg"
            >
              <Sparkles className="w-4 h-4" />
              Tips
            </Button>
          </div>
        </div>
      </div>

      {/* Live Predictions Ticker */}
      <LivePredictionsTicker />

             {/* Trending Topics */}
       <TrendingTopics />

      {/* Hero Featured Article */}
      {featuredPost && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <Star className="w-6 h-6 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">Featured Article</h2>
          </div>
          
          <Card className="bg-gradient-to-br from-slate-800/80 to-slate-700/80 border-slate-600 overflow-hidden hover:border-emerald-500/50 transition-all duration-300">
            <div className="grid lg:grid-cols-2 gap-0">
              {/* Image Section */}
              <div className="relative h-64 lg:h-full bg-gradient-to-br from-emerald-600/20 to-blue-600/20">
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <Play className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                    <p className="text-slate-300">Featured Content</p>
                  </div>
                </div>
                <div className="absolute top-4 left-4">
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    Featured
                  </Badge>
                </div>
              </div>
              
              {/* Content Section */}
              <CardContent className="p-8 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-4">
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                    {featuredPost.category}
                  </Badge>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    AI Generated
                  </Badge>
                </div>
                
                <h3 className="text-2xl lg:text-3xl font-bold text-white mb-4 leading-tight">
                  <Link href={`/blog/${featuredPost.slug}`} className="hover:text-emerald-400 transition-colors">
                    {featuredPost.title}
                  </Link>
                </h3>
                
                <p className="text-slate-300 mb-6 text-lg leading-relaxed overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                  {featuredPost.excerpt}
                </p>
                
                <div className="flex items-center justify-between text-sm text-slate-400 mb-6">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {featuredPost.author}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(featuredPost.publishedAt).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {featuredPost.readTime} min read
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    {featuredPost.viewCount}
                  </div>
                </div>
                
                <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-lg px-8 py-3 w-fit">
                  <Link href={`/blog/${featuredPost.slug}`}>
                    Read Full Article
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Link>
                </Button>
              </CardContent>
            </div>
          </Card>
        </div>
      )}

      {/* Latest Articles Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <TrendingUp className="w-6 h-6 text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">Latest Articles</h2>
          </div>
          <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
            View All
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {regularPosts.map((post) => (
            <Card key={post.id} className="bg-slate-800/50 border-slate-700 hover:border-emerald-500/50 transition-all duration-300 group overflow-hidden">
              {/* Article Image Placeholder */}
              <div className="h-48 bg-gradient-to-br from-slate-700 to-slate-600 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />
                <div className="absolute top-4 left-4">
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    {post.category}
                  </Badge>
                </div>
                <div className="absolute bottom-4 right-4">
                  <div className="flex items-center gap-1 text-emerald-400">
                    <Eye className="w-4 h-4" />
                    <span className="text-sm font-semibold">{post.viewCount}</span>
                  </div>
                </div>
              </div>
              
              <CardContent className="p-6">
                <h3 className="text-xl font-bold text-white mb-3 group-hover:text-emerald-400 transition-colors overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  <Link href={`/blog/${post.slug}`}>
                    {post.title}
                  </Link>
                </h3>
                
                <p className="text-slate-300 mb-4 leading-relaxed overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
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
                  <span className="text-xs text-slate-500">
                    {new Date(post.publishedAt).toLocaleDateString()}
                  </span>
                </div>
                
                <Button 
                  asChild
                  variant="ghost" 
                  size="sm"
                  className="text-emerald-400 hover:text-emerald-300 w-full justify-between group"
                >
                  <Link href={`/blog/${post.slug}`}>
                    Read More
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        
        {blogPosts.length === 0 && (
          <div className="text-center py-16">
            <BookOpen className="w-20 h-20 text-slate-600 mx-auto mb-6" />
            <h3 className="text-2xl font-semibold text-slate-400 mb-3">No articles found</h3>
            <p className="text-slate-500 mb-6">Check back soon for new content!</p>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        )}
      </div>

      {/* Newsletter Signup - Enhanced */}
      <div className="bg-gradient-to-r from-slate-800/80 via-slate-700/80 to-slate-800/80 border-t border-slate-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="p-3 bg-emerald-500/20 rounded-full">
                <Zap className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-3xl font-bold text-white">
                Stay Updated with Latest Tips
              </h2>
            </div>
            <p className="text-slate-300 mb-8 text-lg max-w-2xl mx-auto">
              Get the latest AI predictions, betting strategies, and expert insights delivered to your inbox. Never miss a winning opportunity!
            </p>
                         <NewsletterSignup />
            <p className="text-slate-400 text-sm mt-4">
              🔒 We respect your privacy. Unsubscribe at any time.
            </p>
          </div>
        </div>
      </div>

      
    </div>
  )
} 