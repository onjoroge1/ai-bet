import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Calendar,
  Clock,
  User,
  Eye,
  Share2,
  ArrowLeft,
  Sparkles,
  ArrowRight,
  Heart,
  MessageCircle,
  Bookmark,
  Target,
  TrendingUp,
  BookOpen,
  ChevronRight,
} from 'lucide-react'
import Link from 'next/link'
import prisma from '@/lib/db'
import { generateBlogMetadata } from '@/lib/seo-helpers'
import { NewsArticleSchema } from '@/components/schema-markup'
import { MarqueeTicker } from '@/components/marquee-ticker'
import { UpcomingMatchesSpotlight } from '@/components/trending-topics'
import { NewsletterSignup } from '@/components/newsletter-signup'
import { BlogMediaDisplay } from '@/components/blog-media-display'
import { BlogComments } from '@/components/blog-comments'
import { BlogMatchSalesSidebar } from '@/components/blog-match-sales-sidebar'

// ─── Types ──────────────────────────────────────────────────────────────────────

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
  matchId?: string | null
}

interface TeamLogoInfo {
  homeTeam: string
  awayTeam: string
  homeLogoUrl: string | null
  awayLogoUrl: string | null
  league: string | null
}

interface RelatedPost {
  id: string
  title: string
  slug: string
  excerpt: string
  category: string
  publishedAt: string
  readTime: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Format raw excerpts like "a_win" / "h_win" into readable text. */
function formatExcerpt(excerpt: string, title: string): string {
  if (!excerpt) return ''
  const raw = excerpt.trim().toLowerCase()
  const vsMatch = title.match(/(.+?)\s+vs\s+(.+?)(?:\s+Prediction|\s+Match|\s+-|\s+Odds|$)/i)
  const homeTeam = vsMatch?.[1]?.trim()
  const awayTeam = vsMatch?.[2]?.trim()

  if (raw === 'a_win' && awayTeam) return `Our AI predicts Away Win for ${homeTeam} vs ${awayTeam}.`
  if (raw === 'h_win' && homeTeam) return `Our AI predicts Home Win for ${homeTeam} vs ${awayTeam}.`
  if (raw === 'draw') return `Our AI predicts a Draw for ${homeTeam} vs ${awayTeam}.`
  if (raw === 'a_win') return 'Our AI predicts an Away Win for this match.'
  if (raw === 'h_win') return 'Our AI predicts a Home Win for this match.'

  if (excerpt.length < 20 && /^[a-z_]+$/.test(raw)) {
    return `Read our AI-powered analysis and prediction for this match.`
  }
  return excerpt
}

/** Get team initials from name. */
function getTeamInitials(teamName: string): string {
  return teamName
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .join('')
    .slice(0, 3)
}

/** Deterministic gradient per team. */
function getTeamGradient(teamName: string): string {
  const hash = teamName.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const gradients = [
    'from-blue-600/30 to-blue-900/60',
    'from-red-600/30 to-red-900/60',
    'from-emerald-600/30 to-emerald-900/60',
    'from-purple-600/30 to-purple-900/60',
    'from-amber-600/30 to-amber-900/60',
    'from-cyan-600/30 to-cyan-900/60',
    'from-rose-600/30 to-rose-900/60',
    'from-indigo-600/30 to-indigo-900/60',
  ]
  return gradients[hash % gradients.length]
}

// ─── Data Fetching ──────────────────────────────────────────────────────────────

/** Generate metadata for each blog post. */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params

  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'https://www.snapbet.bet'}/api/blogs?slug=${slug}`, {
      next: { revalidate: 3600 },
    })

    if (!response.ok) {
      return { title: 'Blog Post Not Found', description: 'The requested blog post could not be found.' }
    }

    const data = await response.json()
    const post = data.success ? data.data : null

    if (!post) {
      return { title: 'Blog Post Not Found', description: 'The requested blog post could not be found.' }
    }

    const metadata = generateBlogMetadata(
      post.seoTitle || post.title,
      post.seoDescription || post.excerpt,
      post.slug,
      post.publishedAt,
      post.updatedAt,
      post.author,
      post.tags || []
    )

    return {
      ...metadata,
      other: {
        ...metadata.other,
        news_keywords: post.tags?.join(', ') || 'sports betting, AI predictions, football tips',
        'article:tag': post.tags?.join(', ') || '',
        'article:published_time': post.publishedAt,
        'article:modified_time': post.updatedAt || post.publishedAt,
        'article:author': post.author,
        'article:publisher': 'SnapBet AI',
        'article:section': post.category,
        robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
      } as unknown as Record<string, string | number | (string | number)[]>,
    }
  } catch {
    return { title: 'Blog Post Not Found', description: 'The requested blog post could not be found.' }
  }
}

/** Generate static params for all blog posts. */
export async function generateStaticParams() {
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'https://www.snapbet.bet'}/api/blogs?limit=100`, {
      next: { revalidate: 3600 },
    })
    if (!response.ok) return []
    const data = await response.json()
    const posts = data.success ? data.data : []
    return posts.map((post: BlogPost) => ({ slug: post.slug }))
  } catch {
    return []
  }
}

/** Fetch a single blog post by slug. */
async function getBlogPost(slug: string): Promise<BlogPost | null> {
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'https://www.snapbet.bet'}/api/blogs?slug=${slug}`, {
      next: { revalidate: 3600 },
    })
    if (!response.ok) return null
    const data = await response.json()
    return data.success ? data.data : null
  } catch {
    return null
  }
}

/** Fetch team logos from MarketMatch for the hero banner. */
async function getTeamLogos(title: string): Promise<TeamLogoInfo | null> {
  const vsMatch = title.match(/(.+?)\s+vs\s+(.+?)(?:\s+Prediction|\s+Match|\s+-|\s+Odds|$)/i)
  if (!vsMatch) return null

  const homeTeam = vsMatch[1].trim()
  const awayTeam = vsMatch[2].trim()

  try {
    const matches = await prisma.marketMatch.findMany({
      where: {
        OR: [
          { homeTeam: { contains: homeTeam, mode: 'insensitive' } },
          { awayTeam: { contains: homeTeam, mode: 'insensitive' } },
          { homeTeam: { contains: awayTeam, mode: 'insensitive' } },
          { awayTeam: { contains: awayTeam, mode: 'insensitive' } },
        ],
      },
      select: {
        homeTeam: true,
        homeTeamLogo: true,
        awayTeam: true,
        awayTeamLogo: true,
        league: true,
      },
      take: 10,
      orderBy: { kickoffDate: 'desc' },
    })

    const teamLogoLookup = new Map<string, string>()
    let league: string | null = null

    for (const m of matches) {
      const hLower = m.homeTeam.toLowerCase()
      const aLower = m.awayTeam.toLowerCase()
      if (m.homeTeamLogo && !teamLogoLookup.has(hLower)) teamLogoLookup.set(hLower, m.homeTeamLogo)
      if (m.awayTeamLogo && !teamLogoLookup.has(aLower)) teamLogoLookup.set(aLower, m.awayTeamLogo)
      if (m.league && !league) league = m.league
    }

    const findLogo = (name: string): string | null => {
      const lower = name.toLowerCase()
      if (teamLogoLookup.has(lower)) return teamLogoLookup.get(lower)!
      for (const [key, logo] of teamLogoLookup) {
        if (key.includes(lower) || lower.includes(key)) return logo
      }
      return null
    }

    return {
      homeTeam,
      awayTeam,
      homeLogoUrl: findLogo(homeTeam),
      awayLogoUrl: findLogo(awayTeam),
      league,
    }
  } catch (error) {
    console.error('[BlogPostPage] Error fetching team logos:', error)
    return null
  }
}

/** Fetch a few related posts by category. */
async function getRelatedPosts(currentSlug: string, category: string): Promise<RelatedPost[]> {
  try {
    const response = await fetch(
      `${process.env.NEXTAUTH_URL || 'https://www.snapbet.bet'}/api/blogs?limit=4&category=${encodeURIComponent(category)}`,
      { next: { revalidate: 3600 } }
    )
    if (!response.ok) return []
    const data = await response.json()
    const posts: BlogPost[] = Array.isArray(data) ? data : data.success ? data.data : []
    return posts
      .filter(p => p.slug !== currentSlug && p.isPublished)
      .slice(0, 3)
      .map(p => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        excerpt: p.excerpt,
        category: p.category,
        publishedAt: p.publishedAt,
        readTime: p.readTime,
      }))
  } catch {
    return []
  }
}

// ─── Page Component ─────────────────────────────────────────────────────────────

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getBlogPost(slug)

  if (!post || !post.isPublished || !post.isActive) {
    notFound()
  }

  const [logos, relatedPosts] = await Promise.all([
    getTeamLogos(post.title),
    getRelatedPosts(slug, post.category),
  ])

  const sanitizedContent = post.content
    .replace(/<meta[^>]*>/gi, '')
    .replace(/<title[^>]*>.*?<\/title>/gi, '')
    .replace(/<h1(\s[^>]*)?>/gi, '<h2$1>')
    .replace(/<\/h1>/gi, '</h2>')

  const formattedExcerpt = formatExcerpt(post.excerpt, post.title)
  const isMatchPost = !!logos
  const publishedDate = new Date(post.publishedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Schema */}
      <NewsArticleSchema
        headline={post.title}
        description={post.excerpt}
        datePublished={post.publishedAt}
        dateModified={post.updatedAt}
        author={post.author}
        publisher="SnapBet AI"
        articleSection={post.category}
        articleBody={post.content.replace(/<[^>]*>/g, '')}
      />

      {/* ── Background depth ────────────────────────────────────────────── */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-emerald-500/[0.03] rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-500/[0.03] rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-purple-500/[0.02] rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* ── Hero Banner ─────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-b border-slate-800/50">
          {/* Background — team match or gradient */}
          {isMatchPost ? (
            <>
              <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
              <div className="absolute inset-0">
                <div className={`absolute top-0 left-0 w-1/2 h-full bg-gradient-to-br ${getTeamGradient(logos!.homeTeam)} opacity-60`} />
                <div className={`absolute top-0 right-0 w-1/2 h-full bg-gradient-to-bl ${getTeamGradient(logos!.awayTeam)} opacity-60`} />
              </div>
              <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-slate-950/60 to-slate-950/90" />
            </>
          ) : (
            <>
              <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/30" />
              <div className="absolute inset-0 opacity-20">
                <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-emerald-500/10 rounded-full filter blur-xl animate-float" />
                <div className="absolute top-1/3 right-1/4 w-48 h-48 bg-blue-500/10 rounded-full filter blur-xl animate-float" style={{ animationDelay: '2s' }} />
              </div>
            </>
          )}

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10 sm:pb-14 z-10">
            {/* Breadcrumb */}
            <nav className="mb-6" aria-label="Breadcrumb">
              <ol className="flex items-center text-sm">
                <li>
                  <Link href="/" className="text-slate-400 hover:text-emerald-400 transition-colors flex items-center">
                    Home
                  </Link>
                </li>
                <ChevronRight className="w-4 h-4 text-slate-600 mx-2" />
                <li>
                  <Link href="/blog" className="text-slate-400 hover:text-emerald-400 transition-colors flex items-center">
                    <BookOpen className="w-3.5 h-3.5 mr-1" />
                    Blog
                  </Link>
                </li>
                <ChevronRight className="w-4 h-4 text-slate-600 mx-2" />
                <li>
                  <span className="text-emerald-400 font-medium truncate max-w-[200px] inline-block align-bottom">
                    {post.title.length > 40 ? `${post.title.slice(0, 40)}…` : post.title}
                  </span>
                </li>
              </ol>
            </nav>

            {/* Team logos + title layout */}
            {isMatchPost ? (
              <div className="flex flex-col items-center text-center">
                {/* Team logos row */}
                <div className="flex items-center justify-center gap-6 sm:gap-10 mb-6">
                  {/* Home team */}
                  <div className="flex flex-col items-center gap-2">
                    {logos!.homeLogoUrl ? (
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 p-2.5 shadow-xl">
                        <img src={logos!.homeLogoUrl} alt={logos!.homeTeam} className="w-full h-full object-contain drop-shadow-lg" />
                      </div>
                    ) : (
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-xl">
                        <span className="text-xl sm:text-2xl font-bold text-white">{getTeamInitials(logos!.homeTeam)}</span>
                      </div>
                    )}
                    <span className="text-xs sm:text-sm font-semibold text-white/90 max-w-[100px] truncate text-center">
                      {logos!.homeTeam}
                    </span>
                  </div>

                  {/* VS badge */}
                  <div className="flex flex-col items-center gap-1">
                    {logos!.league && (
                      <span className="text-[10px] font-medium text-slate-300/70 tracking-wider uppercase mb-1 max-w-[120px] truncate text-center">
                        {logos!.league}
                      </span>
                    )}
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-slate-900/80 border-2 border-emerald-500/40 flex items-center justify-center shadow-xl backdrop-blur-sm">
                      <span className="text-sm sm:text-lg font-extrabold text-emerald-400">VS</span>
                    </div>
                  </div>

                  {/* Away team */}
                  <div className="flex flex-col items-center gap-2">
                    {logos!.awayLogoUrl ? (
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 p-2.5 shadow-xl">
                        <img src={logos!.awayLogoUrl} alt={logos!.awayTeam} className="w-full h-full object-contain drop-shadow-lg" />
                      </div>
                    ) : (
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-xl">
                        <span className="text-xl sm:text-2xl font-bold text-white">{getTeamInitials(logos!.awayTeam)}</span>
                      </div>
                    )}
                    <span className="text-xs sm:text-sm font-semibold text-white/90 max-w-[100px] truncate text-center">
                      {logos!.awayTeam}
                    </span>
                  </div>
                </div>

                {/* Category + featured badges */}
                <div className="flex items-center gap-3 mb-4">
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs px-3 py-1">
                    {post.category}
                  </Badge>
                  {post.featured && (
                    <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30 text-xs px-3 py-1">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Featured
                    </Badge>
                  )}
                  <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs px-3 py-1">
                    <Sparkles className="w-3 h-3 mr-1" />
                    AI Generated
                  </Badge>
                </div>

                {/* Title */}
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-4 leading-tight max-w-4xl drop-shadow-lg">
                  {post.title}
                </h1>

                {/* Excerpt */}
                <p className="text-base sm:text-lg text-slate-300 max-w-3xl leading-relaxed mb-6">
                  {formattedExcerpt}
                </p>
              </div>
            ) : (
              /* Non-match article hero */
              <div className="max-w-4xl">
                <div className="flex items-center gap-3 mb-4">
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs px-3 py-1">
                    {post.category}
                  </Badge>
                  {post.featured && (
                    <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30 text-xs px-3 py-1">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Featured
                    </Badge>
                  )}
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-4 leading-tight drop-shadow-lg">
                  {post.title}
                </h1>

                <p className="text-base sm:text-lg text-slate-300 max-w-3xl leading-relaxed">
                  {formattedExcerpt}
                </p>
              </div>
            )}

            {/* ── Meta bar ────────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-6 text-sm">
              <div className="flex items-center gap-1.5 bg-slate-800/40 backdrop-blur-sm rounded-full px-3 py-1.5 border border-slate-700/40">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-300 font-medium">{post.author}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-800/40 backdrop-blur-sm rounded-full px-3 py-1.5 border border-slate-700/40">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-300">{publishedDate}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-800/40 backdrop-blur-sm rounded-full px-3 py-1.5 border border-slate-700/40">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-300">{post.readTime} min read</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-800/40 backdrop-blur-sm rounded-full px-3 py-1.5 border border-slate-700/40">
                <Eye className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-300">{post.viewCount.toLocaleString()} views</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Live Marquee Ticker ─────────────────────────────────────────── */}
        <MarqueeTicker />

        {/* ── Social Actions Bar ──────────────────────────────────────────── */}
        <div className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-2.5">
              <Link
                href="/blog"
                className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-emerald-400 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back to Blog</span>
              </Link>

              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-red-400 hover:bg-red-500/10 h-8 px-2.5 text-xs">
                  <Heart className="w-3.5 h-3.5 mr-1" />
                  <span className="hidden sm:inline">Like</span>
                </Button>
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 h-8 px-2.5 text-xs">
                  <MessageCircle className="w-3.5 h-3.5 mr-1" />
                  <span className="hidden sm:inline">Comment</span>
                </Button>
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 h-8 px-2.5 text-xs">
                  <Bookmark className="w-3.5 h-3.5 mr-1" />
                  <span className="hidden sm:inline">Save</span>
                </Button>
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 h-8 px-2.5 text-xs">
                  <Share2 className="w-3.5 h-3.5 mr-1" />
                  <span className="hidden sm:inline">Share</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Article Content Grid ────────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-3 space-y-8">
              <Card className="bg-slate-900/60 border-slate-800/60 backdrop-blur-sm overflow-hidden">
                {/* Media Display */}
                {post.media && post.media.length > 0 && (
                  <div className="border-b border-slate-800/50">
                    <BlogMediaDisplay media={post.media} />
                  </div>
                )}

                <div className="p-6 sm:p-8 lg:p-10">
                  <div
                    className="prose prose-invert max-w-none
                      prose-headings:text-white prose-headings:font-semibold prose-headings:tracking-tight
                      prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-slate-800/60
                      prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3 prose-h3:text-emerald-400
                      prose-h4:text-lg prose-h4:mt-4 prose-h4:mb-2 prose-h4:text-slate-200
                      prose-p:text-slate-300 prose-p:leading-relaxed prose-p:mb-4 prose-p:text-[15px]
                      prose-ul:text-slate-300 prose-ol:text-slate-300 prose-ul:mb-4 prose-ol:mb-4
                      prose-li:mb-1.5 prose-li:leading-relaxed prose-li:text-[15px]
                      prose-strong:text-emerald-400 prose-strong:font-semibold
                      prose-blockquote:border-l-emerald-500 prose-blockquote:bg-slate-800/30 prose-blockquote:px-5 prose-blockquote:py-4 prose-blockquote:rounded-r-xl prose-blockquote:my-6 prose-blockquote:not-italic
                      prose-code:bg-slate-800 prose-code:text-emerald-400 prose-code:px-2 prose-code:py-0.5 prose-code:rounded-md prose-code:text-sm prose-code:font-normal
                      prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-800
                      prose-a:text-emerald-400 prose-a:no-underline hover:prose-a:text-emerald-300 hover:prose-a:underline
                      prose-img:rounded-xl prose-img:border prose-img:border-slate-800
                      prose-table:border-collapse prose-th:bg-slate-800/50 prose-th:text-slate-200 prose-td:border-slate-800"
                    dangerouslySetInnerHTML={{ __html: sanitizedContent }}
                  />
                </div>
              </Card>

              {/* Tags */}
              {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium uppercase tracking-wider mr-1">Tags:</span>
                  {post.tags.map(tag => (
                    <Badge
                      key={tag}
                      className="bg-slate-800/60 text-slate-300 border-slate-700/50 text-xs px-2.5 py-0.5 hover:bg-slate-700/60 transition-colors cursor-default"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Enhanced CTA */}
              <Card className="bg-gradient-to-r from-emerald-600/10 via-blue-600/10 to-purple-600/10 border-emerald-500/20 overflow-hidden">
                <div className="p-8 text-center">
                  <div className="flex items-center justify-center mb-3">
                    <Sparkles className="w-5 h-5 text-emerald-400 mr-2" />
                    <h3 className="text-xl sm:text-2xl font-bold text-white">Ready to Start Winning?</h3>
                    <Sparkles className="w-5 h-5 text-emerald-400 ml-2" />
                  </div>
                  <p className="text-slate-300 mb-6 text-base max-w-xl mx-auto">
                    Join thousands of successful bettors who trust SnapBet AI for their predictions.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button asChild className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 shadow-lg shadow-emerald-900/30 hover:shadow-emerald-800/40 hover:scale-[1.02] transition-all">
                      <Link href="/matches">
                        <Target className="w-4 h-4 mr-2" />
                        View Today's Predictions
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800/60 hover:border-slate-600 px-6 py-2.5 transition-all">
                      <Link href="/blog">
                        <TrendingUp className="w-4 h-4 mr-2" />
                        More Articles
                      </Link>
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Related Articles */}
              {relatedPosts.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-emerald-400" />
                    Related Articles
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {relatedPosts.map(rp => (
                      <Link
                        key={rp.id}
                        href={`/blog/${rp.slug}`}
                        className="group"
                      >
                        <Card className="bg-slate-900/60 border-slate-800/60 hover:border-emerald-500/40 transition-all duration-200 h-full">
                          <div className="p-4">
                            <Badge className="bg-slate-800/60 text-slate-400 border-slate-700/50 text-[10px] px-2 py-0.5 mb-2">
                              {rp.category}
                            </Badge>
                            <h4 className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors line-clamp-2 mb-2">
                              {rp.title}
                            </h4>
                            <div className="flex items-center gap-3 text-xs text-slate-500">
                              <span>{new Date(rp.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                              <span>{rp.readTime} min</span>
                            </div>
                          </div>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="sticky top-14">
                <BlogMatchSalesSidebar
                  title={post.title}
                  tags={post.tags}
                  matchId={post.matchId}
                  excerpt={post.excerpt}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Comments Section ────────────────────────────────────────────── */}
        <div className="border-t border-slate-800/50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <BlogComments blogPostId={post.id} blogPostSlug={post.slug} />
          </div>
        </div>

        {/* ── Newsletter ──────────────────────────────────────────────────── */}
        <NewsletterSignup />

        {/* ── Trending / Upcoming Matches ─────────────────────────────────── */}
        <UpcomingMatchesSpotlight />
      </div>
    </div>
  )
}
