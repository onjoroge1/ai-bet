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
  Star,
  Play,
  ArrowRight,
  ChevronRight,
  RefreshCw,
  Search,
  Filter,
  Grid3X3,
  List
} from 'lucide-react'
import Link from 'next/link'
import { generateMetadata } from '@/lib/seo-helpers'
import { BlogSearch } from '@/components/blog-search'
import { NewsletterSignup } from '@/components/newsletter-signup'
import { TeamLogoGenerator } from '@/components/blog/team-logo-generator'

interface BlogMedia {
  id: string
  type: string
  url: string
  filename: string
  size: number
  alt?: string
  caption?: string
  uploadedAt: string
}

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
  media?: BlogMedia[]
}

/** Map raw prediction outcomes to human-readable labels, or return a title-based fallback. */
const RAW_PREDICTION_MAP: Record<string, string> = {
  h_win: 'Home Win', a_win: 'Away Win', draw: 'Draw',
  home_win: 'Home Win', away_win: 'Away Win',
  btts_yes: 'Both Teams to Score', btts_no: 'Clean Sheet Expected',
  over_2_5: 'Over 2.5 Goals', under_2_5: 'Under 2.5 Goals',
}

function formatExcerpt(excerpt: string, title: string): string {
  if (!excerpt) return `Read our AI-powered analysis and prediction for this match.`
  const trimmed = excerpt.trim()
  const mapped = RAW_PREDICTION_MAP[trimmed.toLowerCase()]
  if (mapped) {
    const vsMatch = title.match(/(.+?)\s+vs?\s+(.+?)\s+Prediction/i)
    if (vsMatch) {
      return `Our AI predicts ${mapped} for ${vsMatch[1].trim()} vs ${vsMatch[2].trim()}. Read the full analysis, key stats, and betting insights.`
    }
    return `AI Prediction: ${mapped}. Read our detailed match analysis and betting insights.`
  }
  if (trimmed.length < 20 && /^[a-z_]+$/i.test(trimmed)) {
    return `Read our AI-powered analysis and prediction for this match.`
  }
  return excerpt
}

export const metadata: Metadata = generateMetadata({
  title: 'All Blog Posts - Sports Betting Tips & AI Predictions Guide',
  description: 'Browse all our expert sports betting tips, AI prediction guides, and strategy articles. Find the content you need to improve your betting success.',
  url: '/blog/all',
  keywords: ['sports betting blog', 'betting tips', 'AI predictions guide', 'football betting strategy', 'sports analysis', 'blog archive'],
})

async function getAllBlogPosts(): Promise<BlogPost[]> {
  try {
    const url = `${process.env.NEXTAUTH_URL || 'https://snapbet.bet'}/api/blogs?limit=100`
    const response = await fetch(url, {
      next: { revalidate: 3600 } // Revalidate every hour
    })
    const text = await response.text()
    let data
    try {
      data = JSON.parse(text)
    } catch (e) {
      console.error('[BlogAllPage] Failed to parse JSON:', e)
      return []
    }
    if (Array.isArray(data)) {
      return data
    }
    return data.success ? data.data : []
  } catch (error) {
    console.error('[BlogAllPage] Error fetching blog posts:', error)
    return []
  }
}

// Media Display Component for Blog Cards (with team logo support)
function BlogCardMedia({ media, title }: { media?: BlogMedia[], title: string }) {
  // Try to extract team names for sports posts
  const isSportsPost = title.toLowerCase().includes('vs') ||
    title.toLowerCase().includes('prediction') ||
    title.toLowerCase().includes('match')

  if (!media || media.length === 0) {
    if (isSportsPost) {
      const vsMatch = title.match(/(.+?)\s+vs?\s+(.+?)\s+Prediction/i)
      if (vsMatch) {
        return (
          <div className="h-48 bg-gradient-to-br from-slate-800 to-slate-700 relative overflow-hidden rounded-t-lg">
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <TeamLogoGenerator
                homeTeam={vsMatch[1].trim()}
                awayTeam={vsMatch[2].trim()}
                className="w-full h-full"
              />
            </div>
          </div>
        )
      }
    }

    return (
      <div className="h-48 bg-gradient-to-br from-emerald-600/20 via-blue-600/20 to-purple-600/20 relative overflow-hidden rounded-t-lg">
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/40 to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="p-4 bg-slate-800/50 rounded-full mb-3 backdrop-blur-sm">
              <BookOpen className="w-12 h-12 text-emerald-400" />
            </div>
            <p className="text-slate-300 text-sm font-medium">Featured Article</p>
          </div>
        </div>
      </div>
    )
  }

  const firstMedia = media.find(item => item.type === 'image') || media[0]

  if (firstMedia.type === 'image') {
    return (
      <div className="h-48 relative overflow-hidden rounded-t-lg">
        <img
          src={firstMedia.url}
          alt={firstMedia.alt || title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />
      </div>
    )
  } else {
    return (
      <div className="h-48 relative overflow-hidden rounded-t-lg">
        <video
          src={firstMedia.url}
          className="w-full h-full object-cover"
          preload="metadata"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="p-3 bg-black/50 rounded-full">
            <Play className="w-8 h-8 text-white" />
          </div>
        </div>
      </div>
    )
  }
}

export default async function BlogAllPage() {
  const allBlogPosts = await getAllBlogPosts()

  // Get unique categories for filtering
  const categories = [...new Set(allBlogPosts.map(post => post.category))].sort()
  
  // Get unique tags for filtering
  const allTags = allBlogPosts.flatMap(post => post.tags)
  const uniqueTags = [...new Set(allTags)].sort()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Breadcrumb Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <AdvancedBreadcrumb />
      </div>

      {/* Header Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="p-3 bg-emerald-500/20 rounded-full">
              <BookOpen className="w-8 h-8 text-emerald-400" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white">
              All Blog Posts
            </h1>
          </div>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
            Browse our complete collection of sports betting tips, AI prediction guides, and strategy articles. 
            Find the insights you need to improve your betting success.
          </p>
          <div className="mt-6 text-slate-400">
            <span className="bg-slate-700/50 px-4 py-2 rounded-full text-sm">
              {allBlogPosts.length} Articles Available
            </span>
          </div>
        </div>

        {/* Search and Filters */}
        <BlogSearch />
      </div>

      {/* Category and Tag Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Categories */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Filter className="w-5 h-5 text-emerald-400" />
                Categories
              </h3>
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <Badge 
                    key={category}
                    className="bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30 cursor-pointer transition-colors"
                  >
                    {category}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Popular Tags */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-orange-400" />
                Popular Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {uniqueTags.slice(0, 10).map((tag) => (
                  <Badge 
                    key={tag}
                    className="bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30 cursor-pointer transition-colors"
                  >
                    #{tag}
                  </Badge>
                ))}
                {uniqueTags.length > 10 && (
                  <Badge className="bg-slate-600/50 text-slate-400 border-slate-500/30">
                    +{uniqueTags.length - 10} more
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Blog Posts Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <BookOpen className="w-6 h-6 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">All Articles</h2>
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
              {allBlogPosts.length} Posts
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-700">
              <Grid3X3 className="w-4 h-4 mr-2" />
              Grid
            </Button>
            <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-700">
              <List className="w-4 h-4 mr-2" />
              List
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {allBlogPosts.map((post) => (
            <Card key={post.id} className="bg-slate-800/50 border-slate-700 hover:border-emerald-500/50 transition-all duration-300 group overflow-hidden">
              {/* Article Media */}
              <BlogCardMedia media={post.media} title={post.title} />
              
              <CardContent className="p-6">
                {post.featured && (
                  <div className="mb-3">
                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                      <Star className="w-3 h-3 mr-1" />
                      Featured
                    </Badge>
                  </div>
                )}
                
                <h3 className="text-xl font-bold text-white mb-3 group-hover:text-emerald-400 transition-colors overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  <Link href={`/blog/${post.slug}`}>
                    {post.title}
                  </Link>
                </h3>
                
                <p className="text-slate-300 mb-4 leading-relaxed overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                  {formatExcerpt(post.excerpt, post.title)}
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

                <div className="flex items-center justify-between mb-4">
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                    {post.category}
                  </Badge>
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Eye className="w-3 h-3" />
                    {post.viewCount}
                  </div>
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
        
        {allBlogPosts.length === 0 && (
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

      {/* Newsletter Signup */}
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
