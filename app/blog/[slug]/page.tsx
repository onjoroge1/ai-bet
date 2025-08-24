import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Calendar, 
  Clock, 
  User, 
  Eye, 
  Share2, 
  ArrowLeft,
  BookOpen,
  Zap,
  Target,
  TrendingUp,
  CheckCircle,
  BarChart3,
  Sparkles,
  ArrowRight,
  Heart,
  MessageCircle,
  Bookmark
} from 'lucide-react'
import Link from 'next/link'
import { generateBlogMetadata } from '@/lib/seo-helpers'
import { HreflangTags } from '@/components/hreflang-tags'
import { NewsArticleSchema } from '@/components/schema-markup'
import { BreakingNewsTicker } from '@/components/breaking-news-ticker'
import { LivePredictionsTicker } from '@/components/live-predictions-ticker'
import { TrendingTopics } from '@/components/trending-topics'
import { NewsletterSignup } from '@/components/newsletter-signup'
import { BlogMediaDisplay } from '@/components/blog-media-display'
import { BlogComments } from '@/components/blog-comments'

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
  content: string
  author: string
  category: string
  tags: string[]
  geoTarget: string[]
  featured: boolean
  publishedAt: string
  updatedAt?: string
  viewCount: number
  shareCount: number
  readTime: number
  seoTitle?: string
  seoDescription?: string
  seoKeywords?: string[]
  isPublished: boolean
  isActive: boolean
  media?: BlogMedia[]
}

interface Prediction {
  id: string
  homeTeam: string
  awayTeam: string
  league: string
  prediction: string
  confidence: number
  odds: number
  matchTime: string
  status: string
}

// Generate metadata for each blog post
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'https://snapbet.bet'}/api/blogs?slug=${slug}`, {
      next: { revalidate: 3600 }
    })
    
    if (!response.ok) {
      return {
        title: 'Blog Post Not Found',
        description: 'The requested blog post could not be found.'
      }
    }
    
    const data = await response.json()
    const post = data.success ? data.data : null
    
    if (!post) {
      return {
        title: 'Blog Post Not Found',
        description: 'The requested blog post could not be found.'
      }
    }

    // Use the new dynamic metadata helper
    const metadata = generateBlogMetadata(
      post.seoTitle || post.title,
      post.seoDescription || post.excerpt,
      post.slug,
      post.publishedAt,
      post.updatedAt,
      post.author,
      post.tags || []
    )

    // Add Google News specific meta tags
    return {
      ...metadata,
      other: {
        ...metadata.other,
        'news_keywords': (post.tags?.join(', ') || 'sports betting, AI predictions, football tips'),
        'article:tag': (post.tags?.join(', ') || ''),
        'article:published_time': post.publishedAt,
        'article:modified_time': (post.updatedAt || post.publishedAt),
        'article:author': post.author,
        'article:publisher': 'SnapBet AI',
        'article:section': post.category,
        'robots': 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
      } as unknown as Record<string, string | number | (string | number)[]>
    }
  } catch (error) {
    return {
      title: 'Blog Post Not Found',
      description: 'The requested blog post could not be found.'
    }
  }
}

// Generate static params for all blog posts
export async function generateStaticParams() {
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'https://snapbet.bet'}/api/blogs?limit=100`, {
      next: { revalidate: 3600 }
    })
    
    if (!response.ok) {
      return []
    }
    
    const data = await response.json()
    const posts = data.success ? data.data : []
    
    return posts.map((post: BlogPost) => ({
      slug: post.slug,
    }))
  } catch (error) {
    return []
  }
}

async function getBlogPost(slug: string): Promise<BlogPost | null> {
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'https://snapbet.bet'}/api/blogs?slug=${slug}`, {
      next: { revalidate: 3600 }
    })
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    return data.success ? data.data : null
  } catch (error) {
    return null
  }
}

async function getUpcomingPredictions(): Promise<Prediction[]> {
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'https://snapbet.bet'}/api/predictions/upcoming?limit=6`, {
      next: { revalidate: 300 } // 5 minutes cache
    })
    
    if (!response.ok) {
      return []
    }
    
    const data = await response.json()
    return data.success ? data.data : []
  } catch (error) {
    return []
  }
}

async function getRelatedArticles(category: string, currentSlug: string): Promise<BlogPost[]> {
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'https://snapbet.bet'}/api/blogs?limit=3`, {
      next: { revalidate: 3600 }
    })
    
    if (!response.ok) {
      return []
    }
    
    const data = await response.json()
    const posts = data.success ? data.data : []
    
    // Filter out current post and get related by category
    return posts
      .filter((post: BlogPost) => post.slug !== currentSlug && post.isPublished)
      .slice(0, 3)
  } catch (error) {
    return []
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getBlogPost(slug)

  if (!post || !post.isPublished || !post.isActive) {
    notFound()
  }

  // Fetch additional data
  const [upcomingPredictions, relatedArticles] = await Promise.all([
    getUpcomingPredictions(),
    getRelatedArticles(post.category, slug)
  ])

  const baseUrl = process.env.NEXTAUTH_URL || 'https://snapbet.ai'
  const currentUrl = `${baseUrl}/blog/${slug}`

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Hreflang Tags for SEO */}
      <HreflangTags 
        currentUrl={currentUrl}
        slug={slug}
        isBlogPost={true}
      />
      
      {/* News Article Schema for Google News */}
      <NewsArticleSchema 
        headline={post.title}
        description={post.excerpt}
        datePublished={post.publishedAt}
        dateModified={post.updatedAt}
        author={post.author}
        publisher="SnapBet AI"
        articleSection={post.category}
        articleBody={post.content.replace(/<[^>]*>/g, '')} // Strip HTML tags for schema
      />
      
      {/* Breaking News Ticker */}
      <BreakingNewsTicker />
      
      {/* Navigation */}
      <div className="border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link 
            href="/blog"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Blog
          </Link>
        </div>
      </div>

      {/* Article Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          {/* Category and Featured Badge */}
          <div className="flex items-center gap-4 mb-6">
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-sm px-4 py-2">
              {post.category}
            </Badge>
            {post.featured && (
              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-sm px-4 py-2">
                <Sparkles className="w-3 h-3 mr-1" />
                Featured
              </Badge>
            )}
          </div>
          
          {/* Article Title */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight max-w-4xl">
            {post.title}
          </h1>
          
          {/* Article Excerpt */}
          <p className="text-xl text-slate-300 mb-8 leading-relaxed max-w-4xl">
            {post.excerpt}
          </p>
          
          {/* Article Meta */}
          <div className="flex flex-wrap items-center gap-6 text-sm text-slate-400 mb-8 p-6 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span className="font-medium">{post.author}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span className="font-medium">
                {new Date(post.publishedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span className="font-medium">{post.readTime} min read</span>
            </div>
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              <span className="font-medium">{post.viewCount.toLocaleString()} views</span>
            </div>
            
            {/* Social Actions */}
            <div className="flex items-center gap-3 ml-auto">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-emerald-400">
                <Heart className="w-4 h-4 mr-2" />
                Like
              </Button>
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-emerald-400">
                <MessageCircle className="w-4 h-4 mr-2" />
                Comment
              </Button>
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-emerald-400">
                <Bookmark className="w-4 h-4 mr-2" />
                Save
              </Button>
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-emerald-400">
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
        </div>

        {/* Article Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3">
            <Card className="bg-slate-800/50 border-slate-700 p-8 mb-8">
              {/* Media Display */}
              {post.media && post.media.length > 0 && (
                <BlogMediaDisplay media={post.media} />
              )}
              
              <div 
                className="prose prose-invert max-w-none
                  prose-headings:text-white prose-headings:font-semibold prose-headings:tracking-tight
                  prose-h1:text-3xl prose-h1:mt-6 prose-h1:mb-3 prose-h1:border-b prose-h1:border-slate-700 prose-h1:pb-2
                  prose-h2:text-2xl prose-h2:mt-5 prose-h2:mb-3 prose-h2:border-b prose-h2:border-slate-700 prose-h2:pb-1
                  prose-h3:text-xl prose-h3:mt-4 prose-h3:mb-2 prose-h3:text-emerald-400
                  prose-h4:text-lg prose-h4:mt-3 prose-h4:mb-2 prose-h4:text-slate-200
                  prose-p:text-slate-300 prose-p:leading-relaxed prose-p:mb-3 prose-p:mt-3 prose-p:text-base
                  prose-ul:text-slate-300 prose-ol:text-slate-300 prose-ul:mb-3 prose-ol:mb-3
                  prose-li:mb-1 prose-li:leading-relaxed prose-li:text-base
                  prose-strong:text-emerald-400 prose-strong:font-semibold
                  prose-blockquote:border-l-emerald-500 prose-blockquote:bg-slate-700/30 prose-blockquote:p-3 prose-blockquote:rounded-r-lg prose-blockquote:my-4
                  prose-code:bg-slate-700 prose-code:text-emerald-400 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-sm
                  prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-700
                  prose-a:text-emerald-400 prose-a:no-underline hover:prose-a:text-emerald-300
                  prose-img:rounded-lg prose-img:border prose-img:border-slate-700"
                dangerouslySetInnerHTML={{ __html: post.content }}
              />

              {/* Enhanced Call to Action */}
              <div className="mt-12 p-8 bg-gradient-to-r from-emerald-600/20 via-blue-600/20 to-purple-600/20 border border-emerald-500/30 rounded-xl text-center">
                <div className="flex items-center justify-center mb-4">
                  <Sparkles className="w-6 h-6 text-emerald-400 mr-2" />
                  <h3 className="text-2xl font-bold text-white">Ready to Start Winning?</h3>
                  <Sparkles className="w-6 h-6 text-emerald-400 ml-2" />
                </div>
                <p className="text-slate-300 mb-6 text-lg">
                  Join thousands of successful bettors who trust SnapBet AI for their predictions.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-lg px-8 py-3">
                    <Link href="/">
                      <Target className="w-5 h-5 mr-2" />
                      View Today's Predictions
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700 text-lg px-8 py-3">
                    <Link href="/blog">
                      <TrendingUp className="w-5 h-5 mr-2" />
                      More Articles
                    </Link>
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Author Info */}
            <Card className="bg-slate-800/50 border-slate-700 p-6 mb-6">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg text-white">About the Author</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <User className="w-8 h-8 text-emerald-400" />
                  </div>
                  <h4 className="text-white font-semibold mb-2">{post.author}</h4>
                  <p className="text-slate-400 text-sm mb-4">
                    Sports betting expert and AI prediction specialist
                  </p>
                  <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                    <BookOpen className="w-3 h-3" />
                    <span>Expert Writer</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <Card className="bg-slate-800/50 border-slate-700 p-6 mb-6">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg text-white">Tags</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {post.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="bg-slate-700 text-slate-300 border-slate-600">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Upcoming Predictions */}
            {upcomingPredictions.length > 0 && (
              <Card className="bg-slate-800/50 border-slate-700 p-6 mb-6">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg text-white flex items-center gap-2">
                    <Zap className="w-5 h-5 text-emerald-400" />
                    Upcoming Matches
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {upcomingPredictions.slice(0, 3).map((prediction) => (
                      <div key={prediction.id} className="p-3 bg-slate-700/30 rounded-lg border border-slate-600">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-slate-400 uppercase tracking-wide">
                            {prediction.league}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {prediction.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-white mb-2">
                          <div className="font-medium">{prediction.homeTeam}</div>
                          <div className="text-slate-400">vs</div>
                          <div className="font-medium">{prediction.awayTeam}</div>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">
                            {new Date(prediction.matchTime).toLocaleDateString()}
                          </span>
                          <span className="text-emerald-400 font-medium">
                            {prediction.confidence}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button asChild className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700">
                    <Link href="/live-predictions">
                      <ArrowRight className="w-4 h-4 mr-2" />
                      View All
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Related Articles */}
            {relatedArticles.length > 0 && (
              <Card className="bg-slate-800/50 border-slate-700 p-6">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg text-white">Related Articles</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {relatedArticles.map((article) => (
                      <Link 
                        key={article.id} 
                        href={`/blog/${article.slug}`}
                        className="block p-3 bg-slate-700/30 rounded-lg border border-slate-600 hover:bg-slate-700/50 transition-colors"
                      >
                        <h4 className="text-white font-medium mb-2 line-clamp-2">
                          {article.title}
                        </h4>
                        <p className="text-slate-400 text-sm line-clamp-2 mb-2">
                          {article.excerpt}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Calendar className="w-3 h-3" />
                          <span>
                            {new Date(article.publishedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Comments Section */}
      <div className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <BlogComments blogPostId={post.id} blogPostSlug={post.slug} />
        </div>
      </div>

      {/* Newsletter Signup */}
      <NewsletterSignup />

      {/* Trending Topics */}
      <TrendingTopics />
    </div>
  )
} 