import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCountryByCode } from '@/lib/countries'
import { logger } from '@/lib/logger'
import prisma from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { 
  ArrowLeft, 
  User, 
  Calendar, 
  Clock, 
  Eye, 
  BookOpen, 
  Zap, 
  Target, 
  TrendingUp 
} from 'lucide-react'

interface CountryBlogPostPageProps {
  params: Promise<{ country: string; slug: string }>
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
  viewCount: number
  shareCount: number
  readTime: number
  seoTitle?: string
  seoDescription?: string
  seoKeywords?: string[]
  isPublished: boolean
  isActive: boolean
}

export async function generateMetadata({ params }: CountryBlogPostPageProps): Promise<Metadata> {
  const { country, slug } = await params
  const countryCode = country.toUpperCase()
  const countryData = getCountryByCode(countryCode)
  
  if (!countryData || !countryData.isSupported) {
    return {
      title: 'Country Not Found | SnapBet AI',
      description: 'This country is not currently supported by SnapBet AI.'
    }
  }

  try {
    const blogPost = await prisma.blogPost.findFirst({
      where: {
        slug,
        isPublished: true,
        isActive: true,
        OR: [
          { geoTarget: { has: countryCode } },
          { geoTarget: { has: 'worldwide' } }, // Worldwide posts
          { geoTarget: { isEmpty: true } }, // Empty geoTarget (legacy)
        ],
      },
      select: {
        title: true,
        excerpt: true,
        seoTitle: true,
        seoDescription: true,
        seoKeywords: true,
        author: true,
        publishedAt: true,
        category: true,
        tags: true,
      },
    })

    if (!blogPost) {
      return {
        title: 'Blog Post Not Found | SnapBet AI',
        description: 'The requested blog post could not be found.'
      }
    }

    const title = blogPost.seoTitle || `${blogPost.title} - ${countryData.name} | SnapBet AI`
    const description = blogPost.seoDescription || blogPost.excerpt || `Read about ${blogPost.title} in ${countryData.name}. Get expert sports betting insights and AI predictions.`

    return {
      title,
      description,
      keywords: blogPost.seoKeywords || [
        'sports betting',
        'AI predictions',
        'football tips',
        countryData.name.toLowerCase(),
        blogPost.category?.toLowerCase(),
        ...(blogPost.tags || []),
      ].filter(Boolean),
      openGraph: {
        title,
        description,
        type: 'article',
        locale: countryData.code.toLowerCase(),
        siteName: 'SnapBet AI',
        publishedTime: blogPost.publishedAt?.toISOString(),
        authors: blogPost.author ? [blogPost.author] : undefined,
        tags: blogPost.tags || [],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
      },
    }
  } catch (error) {
    logger.error('Error generating blog post metadata', {
      tags: ['country-blog-post', 'metadata-error'],
      error,
      data: { countryCode, slug }
    })

    return {
      title: 'Blog Post | SnapBet AI',
      description: `Sports betting insights and AI predictions for ${countryData.name}.`
    }
  }
}

async function getBlogPost(slug: string, countryCode: string): Promise<BlogPost | null> {
  try {
    const blogPost = await prisma.blogPost.findFirst({
      where: {
        slug,
        isPublished: true,
        isActive: true,
        OR: [
          { geoTarget: { has: countryCode } },
          { geoTarget: { has: 'worldwide' } }, // Worldwide posts
          { geoTarget: { isEmpty: true } }, // Empty geoTarget (legacy)
        ],
      },
    })

    if (!blogPost) {
      return null
    }

    return {
      id: blogPost.id,
      title: blogPost.title,
      slug: blogPost.slug,
      excerpt: blogPost.excerpt,
      content: blogPost.content,
      author: blogPost.author,
      category: blogPost.category,
      tags: blogPost.tags,
      geoTarget: blogPost.geoTarget,
      featured: blogPost.featured,
      publishedAt: blogPost.publishedAt?.toISOString() || '',
      viewCount: blogPost.viewCount,
      shareCount: blogPost.shareCount,
      readTime: blogPost.readTime,
      seoTitle: blogPost.seoTitle,
      seoDescription: blogPost.seoDescription,
      seoKeywords: blogPost.seoKeywords,
      isPublished: blogPost.isPublished,
      isActive: blogPost.isActive,
    }
  } catch (error) {
    logger.error('Error fetching blog post', {
      tags: ['country-blog-post', 'fetch-error'],
      error,
      data: { slug, countryCode }
    })
    return null
  }
}

export default async function CountryBlogPostPage({ params }: CountryBlogPostPageProps) {
  const { country, slug } = await params
  const countryCode = country.toUpperCase()
  const countryData = getCountryByCode(countryCode)
  
  if (!countryData || !countryData.isSupported) {
    logger.warn('Invalid country blog post access attempt', {
      tags: ['country-blog-post', 'invalid-country'],
      data: { countryCode, requestedCountry: country, slug }
    })
    notFound()
  }

  const post = await getBlogPost(slug, countryCode)

  if (!post || !post.isPublished || !post.isActive) {
    logger.warn('Blog post not found for country', {
      tags: ['country-blog-post', 'not-found'],
      data: { countryCode, slug, countryName: countryData.name }
    })
    notFound()
  }

  // Update view count
  try {
    await prisma.blogPost.update({
      where: { id: post.id },
      data: { viewCount: { increment: 1 } },
    })
  } catch (error) {
    logger.error('Error updating view count', {
      tags: ['country-blog-post', 'view-count-error'],
      error,
      data: { postId: post.id }
    })
  }

  logger.info('Country blog post accessed', {
    tags: ['country-blog-post', 'access'],
    data: { 
      countryCode, 
      countryName: countryData.name,
      slug,
      title: post.title
    }
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Navigation */}
      <div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="mt-4">
            <Link 
              href={`/${country.toLowerCase()}/blog`}
              className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to {countryData.name} Blog
            </Link>
          </div>
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
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
              {countryData.name}
            </Badge>
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
            <h3 className="text-xl font-bold text-white mb-4">Ready to Start Winning in {countryData.name}?</h3>
            <p className="text-slate-300 mb-6">
              Join thousands of successful bettors in {countryData.name} who trust SnapBet AI for their predictions.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
                <Link href={`/${country.toLowerCase()}`}>
                  <Target className="w-4 h-4 mr-2" />
                  View Today's Predictions
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                <Link href={`/${country.toLowerCase()}/blog`}>
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