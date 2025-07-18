import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
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
  CheckCircle
} from 'lucide-react'
import Link from 'next/link'
import { generateBlogMetadata } from '@/lib/seo-helpers'
import { HreflangTags } from '@/components/hreflang-tags'
import { NewsArticleSchema } from '@/components/schema-markup'

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
        'news_keywords': (post.tags?.join(', ') || 'sports betting, AI predictions, football tips') as string,
        'article:tag': (post.tags?.join(', ') || '') as string,
        'article:published_time': post.publishedAt as string,
        'article:modified_time': (post.updatedAt || post.publishedAt) as string,
        'article:author': post.author as string,
        'article:publisher': 'SnapBet AI',
        'article:section': post.category as string,
        'robots': 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
      }
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
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'https://snapbet.bet'}/api/blogs?limit=50`, {
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
    console.error('Error fetching blog post:', error)
    return null
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getBlogPost(slug)

  if (!post || !post.isPublished || !post.isActive) {
    notFound()
  }

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
      
      {/* Navigation */}
      <div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="mb-8">
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 mb-6">
            {post.category}
          </Badge>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
            {post.title}
          </h1>
          <p className="text-xl text-slate-300 mb-8 leading-relaxed max-w-3xl">
            {post.excerpt}
          </p>
          
          {/* Article Meta */}
          <div className="flex flex-wrap items-center gap-6 text-sm text-slate-400 mb-8 p-4 bg-slate-800/30 rounded-lg border border-slate-700">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              {post.author}
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {new Date(post.publishedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {post.readTime} min read
            </div>
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              {post.viewCount.toLocaleString()} views
            </div>
            {post.featured && (
              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                Featured
              </Badge>
            )}
          </div>
        </div>

        {/* Article Content */}
        <Card className="bg-slate-800/50 border-slate-700 p-8 mb-8">
          {/* Table of Contents */}
          <div className="mb-8 p-6 bg-slate-700/30 rounded-lg border border-slate-600">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <BookOpen className="w-5 h-5 mr-2 text-emerald-400" />
              Table of Contents
            </h3>
            <div className="grid md:grid-cols-2 gap-2 text-sm">
              <div className="space-y-1">
                <a href="#confidence-scores" className="text-emerald-400 hover:text-emerald-300 transition-colors block">What Are Confidence Scores?</a>
                <a href="#confidence-ranges" className="text-emerald-400 hover:text-emerald-300 transition-colors block">Confidence Score Ranges</a>
                <a href="#calculation" className="text-emerald-400 hover:text-emerald-300 transition-colors block">How Scores Are Calculated</a>
              </div>
              <div className="space-y-1">
                <a href="#effective-use" className="text-emerald-400 hover:text-emerald-300 transition-colors block">Using Scores Effectively</a>
                <a href="#vs-odds" className="text-emerald-400 hover:text-emerald-300 transition-colors block">Scores vs. Odds</a>
                <a href="#strategy" className="text-emerald-400 hover:text-emerald-300 transition-colors block">Building Your Strategy</a>
              </div>
            </div>
          </div>

          <div 
            className="prose prose-invert prose-lg max-w-none
              prose-headings:text-white prose-headings:font-bold prose-headings:tracking-tight
              prose-h2:text-3xl prose-h2:mt-12 prose-h2:mb-6 prose-h2:border-b prose-h2:border-slate-700 prose-h2:pb-2
              prose-h3:text-2xl prose-h3:mt-10 prose-h3:mb-4 prose-h3:text-emerald-400
              prose-h4:text-xl prose-h4:mt-8 prose-h4:mb-3 prose-h4:text-slate-200
              prose-p:text-slate-300 prose-p:leading-relaxed prose-p:mb-6 prose-p:text-lg
              prose-ul:text-slate-300 prose-ol:text-slate-300 prose-ul:mb-6 prose-ol:mb-6
              prose-li:mb-2 prose-li:leading-relaxed prose-li:text-lg
              prose-strong:text-emerald-400 prose-strong:font-semibold
              prose-blockquote:border-l-emerald-500 prose-blockquote:bg-slate-700/30 prose-blockquote:p-4 prose-blockquote:rounded-r-lg
              prose-code:bg-slate-700 prose-code:text-emerald-400 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-sm
              prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-700
              prose-a:text-emerald-400 prose-a:no-underline hover:prose-a:text-emerald-300
              prose-img:rounded-lg prose-img:border prose-img:border-slate-700"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          {/* Key Takeaways */}
          <div className="mt-12 p-6 bg-gradient-to-r from-emerald-600/20 to-blue-600/20 border border-emerald-500/30 rounded-lg">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center">
              <Zap className="w-5 h-5 mr-2 text-emerald-400" />
              Key Takeaways
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-slate-300 text-sm">Confidence scores range from 0-100% and indicate AI certainty</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-slate-300 text-sm">Higher confidence doesn't guarantee wins, but indicates stronger historical support</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-slate-300 text-sm">Use confidence scores to adjust bet sizes and manage risk</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-slate-300 text-sm">Combine AI insights with proper bankroll management</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-slate-300 text-sm">Track performance across different confidence levels</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-slate-300 text-sm">Start with high-confidence predictions and expand gradually</p>
                </div>
              </div>
            </div>
          </div>

          {/* Call to Action */}
          <div className="mt-12 p-6 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-lg text-center">
            <h3 className="text-xl font-bold text-white mb-4">Ready to Start Winning?</h3>
            <p className="text-slate-300 mb-6">
              Join thousands of successful bettors who trust SnapBet AI for their predictions.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
                <Link href="/">
                  <Target className="w-4 h-4 mr-2" />
                  View Today's Predictions
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                <Link href="/blog">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  More Articles
                </Link>
              </Button>
            </div>
          </div>
        </Card>

        {/* Reading Progress Bar */}
        <div className="fixed bottom-0 left-0 w-full h-1 bg-slate-800 z-50">
          <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: '0%' }}></div>
        </div>
      </div>
    </div>
  )
} 