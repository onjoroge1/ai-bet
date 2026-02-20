import { Metadata } from 'next'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  Star,
  Play,
  ArrowRight,
  Sparkles,
  ChevronRight,
  RefreshCw,
  Trophy,
  Flame,
} from 'lucide-react'
import Link from 'next/link'
import prisma from '@/lib/db'
import { generateMetadata } from '@/lib/seo-helpers'
import { BlogSearch } from '@/components/blog-search'
import { BlogPredictions } from '@/components/blog/blog-predictions'
import { BlogMatchPredictions } from '@/components/blog/blog-match-predictions'
import { MarqueeTicker } from '@/components/marquee-ticker'
import { NewsletterSignup } from '@/components/newsletter-signup'

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

/** Team logo data resolved from MarketMatch. */
interface TeamLogoInfo {
  homeTeam: string
  awayTeam: string
  homeLogoUrl: string | null
  awayLogoUrl: string | null
  league: string | null
}

/** Map raw prediction outcomes to human-readable labels, or return a title-based fallback. */
const RAW_PREDICTION_MAP: Record<string, string> = {
  h_win: 'Home Win',
  a_win: 'Away Win',
  draw: 'Draw',
  home_win: 'Home Win',
  away_win: 'Away Win',
  btts_yes: 'Both Teams to Score',
  btts_no: 'Clean Sheet Expected',
  over_2_5: 'Over 2.5 Goals',
  under_2_5: 'Under 2.5 Goals',
}

function formatExcerpt(excerpt: string, title: string): string {
  if (!excerpt) return `Read our AI-powered analysis and prediction for this match.`
  const trimmed = excerpt.trim()
  // If the excerpt is just a raw prediction code, replace it
  const mapped = RAW_PREDICTION_MAP[trimmed.toLowerCase()]
  if (mapped) {
    // Build a nicer excerpt from the title + mapped prediction
    const vsMatch = title.match(/(.+?)\s+vs?\s+(.+?)\s+Prediction/i)
    if (vsMatch) {
      return `Our AI predicts ${mapped} for ${vsMatch[1].trim()} vs ${vsMatch[2].trim()}. Read the full analysis, key stats, and betting insights.`
    }
    return `AI Prediction: ${mapped}. Read our detailed match analysis and betting insights.`
  }
  // If excerpt is very short (< 20 chars) and looks like a code, generate fallback
  if (trimmed.length < 20 && /^[a-z_]+$/i.test(trimmed)) {
    return `Read our AI-powered analysis and prediction for this match.`
  }
  return excerpt
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
      next: { revalidate: 3600 }
    })
    const text = await response.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      console.error('[BlogPage] Failed to parse JSON')
      return []
    }
    if (Array.isArray(data)) {
      return data
    }
    return data.success ? data.data : []
  } catch (error) {
    console.error('[BlogPage] Error fetching blog posts:', error)
    return []
  }
}

/**
 * Look up team logos from MarketMatch table by matching team names found in blog titles.
 * Returns a map of blogPostId → TeamLogoInfo.
 */
async function getTeamLogosFromDatabase(posts: BlogPost[]): Promise<Map<string, TeamLogoInfo>> {
  const logoMap = new Map<string, TeamLogoInfo>()

  // Extract team pairs from titles
  const teamPairs: { postId: string; homeTeam: string; awayTeam: string }[] = []
  for (const post of posts) {
    const vsMatch = post.title.match(/(.+?)\s+vs\s+(.+?)(?:\s+Prediction|\s+Match|\s+-|\s+Odds|$)/i)
    if (vsMatch) {
      teamPairs.push({
        postId: post.id,
        homeTeam: vsMatch[1].trim(),
        awayTeam: vsMatch[2].trim(),
      })
    }
  }

  if (teamPairs.length === 0) return logoMap

  // Collect unique team names
  const allTeamNames = new Set<string>()
  for (const pair of teamPairs) {
    allTeamNames.add(pair.homeTeam.toLowerCase())
    allTeamNames.add(pair.awayTeam.toLowerCase())
  }

  try {
    // Query MarketMatch for matches containing any of these teams to get logos
    const matches = await prisma.marketMatch.findMany({
      where: {
        OR: [
          ...Array.from(allTeamNames).flatMap(name => [
            { homeTeam: { contains: name, mode: 'insensitive' as const } },
            { awayTeam: { contains: name, mode: 'insensitive' as const } },
          ]),
        ],
      },
      select: {
        homeTeam: true,
        homeTeamLogo: true,
        awayTeam: true,
        awayTeamLogo: true,
        league: true,
      },
      take: 100,
      orderBy: { kickoffDate: 'desc' },
    })

    // Build a map of team name (lower) → logo URL
    const teamLogoLookup = new Map<string, string>()
    const teamLeagueLookup = new Map<string, string>()
    for (const match of matches) {
      const homeLower = match.homeTeam.toLowerCase()
      const awayLower = match.awayTeam.toLowerCase()
      if (match.homeTeamLogo && !teamLogoLookup.has(homeLower)) {
        teamLogoLookup.set(homeLower, match.homeTeamLogo)
      }
      if (match.awayTeamLogo && !teamLogoLookup.has(awayLower)) {
        teamLogoLookup.set(awayLower, match.awayTeamLogo)
      }
      if (match.league) {
        if (!teamLeagueLookup.has(homeLower)) teamLeagueLookup.set(homeLower, match.league)
        if (!teamLeagueLookup.has(awayLower)) teamLeagueLookup.set(awayLower, match.league)
      }
    }

    // Map blog posts to their logos
    for (const pair of teamPairs) {
      const homeLower = pair.homeTeam.toLowerCase()
      const awayLower = pair.awayTeam.toLowerCase()

      // Find logo by fuzzy match (contains)
      const findLogo = (name: string): string | null => {
        if (teamLogoLookup.has(name)) return teamLogoLookup.get(name)!
        // Try partial matching
        for (const [key, logo] of teamLogoLookup) {
          if (key.includes(name) || name.includes(key)) return logo
        }
        return null
      }

      logoMap.set(pair.postId, {
        homeTeam: pair.homeTeam,
        awayTeam: pair.awayTeam,
        homeLogoUrl: findLogo(homeLower),
        awayLogoUrl: findLogo(awayLower),
        league: teamLeagueLookup.get(homeLower) || teamLeagueLookup.get(awayLower) || null,
      })
    }
  } catch (error) {
    console.error('[BlogPage] Error fetching team logos from DB:', error)
  }

  return logoMap
}

/** Fetch a collection of unique team logos for the hero collage. */
async function getHeroTeamLogos(limit: number = 20): Promise<{ name: string; logoUrl: string }[]> {
  try {
    const matches = await prisma.marketMatch.findMany({
      where: {
        isActive: true,
        homeTeamLogo: { not: '' },
      },
      select: {
        homeTeam: true,
        homeTeamLogo: true,
        awayTeam: true,
        awayTeamLogo: true,
      },
      orderBy: { kickoffDate: 'desc' },
      take: 60,
    })

    const seen = new Set<string>()
    const logos: { name: string; logoUrl: string }[] = []

    for (const m of matches) {
      if (m.homeTeamLogo && !seen.has(m.homeTeam.toLowerCase())) {
        seen.add(m.homeTeam.toLowerCase())
        logos.push({ name: m.homeTeam, logoUrl: m.homeTeamLogo })
      }
      if (m.awayTeamLogo && !seen.has(m.awayTeam.toLowerCase())) {
        seen.add(m.awayTeam.toLowerCase())
        logos.push({ name: m.awayTeam, logoUrl: m.awayTeamLogo })
      }
      if (logos.length >= limit) break
    }

    return logos.slice(0, limit)
  } catch (error) {
    console.error('[BlogPage] Error fetching hero logos:', error)
    return []
  }
}

/** Generate initials from a team name (e.g., "Manchester United" → "MU"). */
function getTeamInitials(teamName: string): string {
  return teamName
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .join('')
    .slice(0, 3)
}

/** Choose a deterministic gradient based on team name hash. */
function getTeamGradient(teamName: string): string {
  const hash = teamName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
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

// ─── Blog Card Media Component ──────────────────────────────────────────────

function BlogCardMedia({
  media,
  title,
  logos,
}: {
  media?: BlogMedia[]
  title: string
  logos?: TeamLogoInfo | null
}) {
  // If we have actual image media, use it
  if (media && media.length > 0) {
    const firstMedia = media.find(item => item.type === 'image') || media[0]
    if (firstMedia.type === 'image') {
      return (
        <div className="h-52 relative overflow-hidden">
          <img
            src={firstMedia.url}
            alt={firstMedia.alt || title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent" />
        </div>
      )
    }
    return (
      <div className="h-52 relative overflow-hidden">
        <video src={firstMedia.url} className="w-full h-full object-cover" preload="metadata" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="p-3 bg-black/50 rounded-full backdrop-blur-sm">
            <Play className="w-8 h-8 text-white" />
          </div>
        </div>
      </div>
    )
  }

  // Match card with team logos
  if (logos) {
    const homeGrad = getTeamGradient(logos.homeTeam)
    const awayGrad = getTeamGradient(logos.awayTeam)

    return (
      <div className="h-52 relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {/* Diagonal split background */}
        <div className="absolute inset-0">
          <div className={`absolute top-0 left-0 w-1/2 h-full bg-gradient-to-br ${homeGrad}`} />
          <div className={`absolute top-0 right-0 w-1/2 h-full bg-gradient-to-bl ${awayGrad}`} />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-slate-900/30" />
        </div>

        {/* Team logos / initials */}
        <div className="relative h-full flex items-center justify-between px-6">
          {/* Home team */}
          <div className="flex flex-col items-center gap-2 z-10">
            {logos.homeLogoUrl ? (
              <div className="w-16 h-16 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 p-2 shadow-lg">
                <img
                  src={logos.homeLogoUrl}
                  alt={logos.homeTeam}
                  className="w-full h-full object-contain drop-shadow-lg"
                />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-lg">
                <span className="text-xl font-bold text-white">{getTeamInitials(logos.homeTeam)}</span>
              </div>
            )}
            <span className="text-xs font-semibold text-white/90 text-center max-w-[80px] truncate">
              {logos.homeTeam}
            </span>
          </div>

          {/* VS badge */}
          <div className="flex flex-col items-center gap-1 z-10">
            {logos.league && (
              <span className="text-[10px] font-medium text-slate-300/70 tracking-wider uppercase mb-1 max-w-[120px] truncate text-center">
                {logos.league}
              </span>
            )}
            <div className="w-10 h-10 rounded-full bg-slate-900/80 border border-slate-600/50 flex items-center justify-center shadow-xl backdrop-blur-sm">
              <span className="text-sm font-extrabold text-white">VS</span>
            </div>
          </div>

          {/* Away team */}
          <div className="flex flex-col items-center gap-2 z-10">
            {logos.awayLogoUrl ? (
              <div className="w-16 h-16 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 p-2 shadow-lg">
                <img
                  src={logos.awayLogoUrl}
                  alt={logos.awayTeam}
                  className="w-full h-full object-contain drop-shadow-lg"
                />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-lg">
                <span className="text-xl font-bold text-white">{getTeamInitials(logos.awayTeam)}</span>
              </div>
            )}
            <span className="text-xs font-semibold text-white/90 text-center max-w-[80px] truncate">
              {logos.awayTeam}
            </span>
          </div>
        </div>

        {/* Corner glow accents */}
        <div className="absolute top-0 left-0 w-24 h-24 bg-white/5 rounded-full blur-xl -translate-x-8 -translate-y-8" />
        <div className="absolute bottom-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl translate-x-8 translate-y-8" />
      </div>
    )
  }

  // Fallback for non-sports posts
  return (
    <div className="h-52 bg-gradient-to-br from-emerald-600/20 via-blue-600/15 to-purple-600/20 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/30 to-transparent" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="p-4 bg-slate-800/50 rounded-2xl mb-3 backdrop-blur-sm border border-slate-700/50">
            <BookOpen className="w-10 h-10 text-emerald-400" />
          </div>
          <p className="text-slate-300 text-sm font-medium">Featured Article</p>
        </div>
      </div>
      {/* Decorative */}
      <div className="absolute top-4 right-4 w-8 h-8 bg-emerald-400/15 rounded-full" />
      <div className="absolute bottom-4 left-4 w-6 h-6 bg-blue-400/15 rounded-full" />
    </div>
  )
}

// ─── Featured Article Media ──────────────────────────────────────────────────

function FeaturedArticleMedia({
  media,
  title,
  logos,
}: {
  media?: BlogMedia[]
  title: string
  logos?: TeamLogoInfo | null
}) {
  if (media && media.length > 0) {
    const firstMedia = media.find(item => item.type === 'image') || media[0]
    if (firstMedia.type === 'image') {
      return (
        <div className="h-full min-h-[280px] relative overflow-hidden">
          <img
            src={firstMedia.url}
            alt={firstMedia.alt || title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/40 to-transparent" />
        </div>
      )
    }
  }

  if (logos) {
    const homeGrad = getTeamGradient(logos.homeTeam)
    const awayGrad = getTeamGradient(logos.awayTeam)

    return (
      <div className="h-full min-h-[280px] relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="absolute inset-0">
          <div className={`absolute top-0 left-0 w-1/2 h-full bg-gradient-to-br ${homeGrad}`} />
          <div className={`absolute top-0 right-0 w-1/2 h-full bg-gradient-to-bl ${awayGrad}`} />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-900/30 to-slate-900/50" />
        </div>

        <div className="relative h-full flex items-center justify-center gap-8 px-8">
          {/* Home */}
          <div className="flex flex-col items-center gap-3 z-10">
            {logos.homeLogoUrl ? (
              <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 p-3 shadow-xl">
                <img src={logos.homeLogoUrl} alt={logos.homeTeam} className="w-full h-full object-contain drop-shadow-lg" />
              </div>
            ) : (
              <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-xl">
                <span className="text-2xl font-bold text-white">{getTeamInitials(logos.homeTeam)}</span>
              </div>
            )}
            <span className="text-sm font-semibold text-white text-center max-w-[100px]">{logos.homeTeam}</span>
          </div>

          {/* VS */}
          <div className="flex flex-col items-center gap-2 z-10">
            {logos.league && (
              <span className="text-[11px] font-medium text-slate-400 tracking-wider uppercase">{logos.league}</span>
            )}
            <div className="w-14 h-14 rounded-full bg-slate-900/80 border-2 border-emerald-500/40 flex items-center justify-center shadow-xl">
              <span className="text-lg font-extrabold text-emerald-400">VS</span>
            </div>
          </div>

          {/* Away */}
          <div className="flex flex-col items-center gap-3 z-10">
            {logos.awayLogoUrl ? (
              <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 p-3 shadow-xl">
                <img src={logos.awayLogoUrl} alt={logos.awayTeam} className="w-full h-full object-contain drop-shadow-lg" />
              </div>
            ) : (
              <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-xl">
                <span className="text-2xl font-bold text-white">{getTeamInitials(logos.awayTeam)}</span>
              </div>
            )}
            <span className="text-sm font-semibold text-white text-center max-w-[100px]">{logos.awayTeam}</span>
          </div>
        </div>

        {/* Corner glows */}
        <div className="absolute top-0 left-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-x-12 -translate-y-12" />
        <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl translate-x-12 translate-y-12" />
      </div>
    )
  }

  // Fallback
  return (
    <div className="h-full min-h-[280px] bg-gradient-to-br from-emerald-600/20 to-blue-600/20 relative">
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
          <p className="text-slate-300">Featured Content</p>
        </div>
      </div>
    </div>
  )
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default async function BlogPage() {
  const [blogPosts, heroLogos] = await Promise.all([
    getBlogPosts(),
    getHeroTeamLogos(20),
  ])
  const logoMap = await getTeamLogosFromDatabase(blogPosts)

  const featuredPost = blogPosts.find(post => post.featured) || blogPosts[0]
  const regularPosts = blogPosts.filter(post => post.id !== featuredPost?.id)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* ── Background depth ─────────────────────────────────────────────── */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-emerald-500/[0.03] rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-500/[0.03] rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-purple-500/[0.02] rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* ── Hero Header with Logo Collage ──────────────────────────────── */}
        <section className="relative overflow-hidden border-b border-slate-800/50">
          {/* Base gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/30" />

          {/* Floating logo collage background */}
          {heroLogos.length > 0 && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {/* Scatter logos across the hero in a grid-like pattern with staggered animation */}
              {heroLogos.map((logo, i) => {
                // Deterministic positioning based on index
                const cols = 5
                const rows = Math.ceil(heroLogos.length / cols)
                const col = i % cols
                const row = Math.floor(i / cols)
                const leftPct = 8 + (col / cols) * 84
                const topPct = 10 + (row / rows) * 80
                // Slight random offset based on name hash
                const hash = logo.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
                const offsetX = ((hash % 30) - 15)
                const offsetY = ((hash * 7 % 30) - 15)
                const size = 36 + (hash % 20) // 36-56px
                const delay = (i * 0.4) % 8
                const opacity = 0.06 + (hash % 4) * 0.015

                return (
                  <div
                    key={`hero-logo-${i}`}
                    className="absolute animate-float"
                    style={{
                      left: `calc(${leftPct}% + ${offsetX}px)`,
                      top: `calc(${topPct}% + ${offsetY}px)`,
                      width: size,
                      height: size,
                      opacity,
                      animationDelay: `${delay}s`,
                      animationDuration: `${6 + (hash % 4)}s`,
                    }}
                  >
                    <img
                      src={logo.logoUrl}
                      alt=""
                      className="w-full h-full object-contain drop-shadow-lg"
                      loading="lazy"
                    />
                  </div>
                )
              })}
            </div>
          )}

          {/* Gradient overlay to ensure text readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/40 to-slate-950/70" />

          {/* Glow accents */}
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-emerald-500/10 rounded-full filter blur-3xl animate-float" />
            <div className="absolute top-1/3 right-1/4 w-48 h-48 bg-blue-500/10 rounded-full filter blur-3xl animate-float" style={{ animationDelay: '2s' }} />
            <div className="absolute bottom-1/4 left-1/3 w-56 h-56 bg-purple-500/10 rounded-full filter blur-3xl animate-float" style={{ animationDelay: '4s' }} />
          </div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-14 sm:pb-20 z-10">
            {/* Breadcrumb */}
            <div className="mb-8">
              <AdvancedBreadcrumb />
            </div>

            <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs px-3 py-1 mb-5 backdrop-blur-sm">
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                AI-Powered Insights
              </Badge>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mb-5 leading-tight drop-shadow-lg">
                SnapBet{' '}
                <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-blue-400 bg-clip-text text-transparent">
                  Blog
                </span>
              </h1>

              <p className="text-lg sm:text-xl text-slate-300 max-w-2xl leading-relaxed mb-8 drop-shadow-sm">
                Expert match predictions, AI betting guides, and strategy articles.
                Stay ahead of the game with data-driven insights.
              </p>

              {/* Quick stats strip */}
              <div className="flex items-center gap-6 sm:gap-8 text-sm">
                <div className="flex items-center gap-2 bg-slate-800/40 backdrop-blur-sm rounded-full px-3 py-1.5 border border-slate-700/40">
                  <BookOpen className="w-4 h-4 text-emerald-400" />
                  <span className="text-slate-300">
                    <span className="font-bold text-white">{blogPosts.length}</span> Articles
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-slate-800/40 backdrop-blur-sm rounded-full px-3 py-1.5 border border-slate-700/40">
                  <Target className="w-4 h-4 text-blue-400" />
                  <span className="text-slate-300">
                    <span className="font-bold text-white">AI</span> Predictions
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-slate-800/40 backdrop-blur-sm rounded-full px-3 py-1.5 border border-slate-700/40">
                  <Flame className="w-4 h-4 text-purple-400" />
                  <span className="text-slate-300">
                    <span className="font-bold text-white">Daily</span> Updates
                  </span>
                </div>
              </div>

              {/* Mini logo strip - a curated row of top team logos */}
              {heroLogos.length >= 6 && (
                <div className="mt-8 flex items-center gap-1">
                  <span className="text-xs text-slate-500 mr-2">Covering</span>
                  <div className="flex items-center -space-x-2">
                    {heroLogos.slice(0, 8).map((logo, i) => (
                      <div
                        key={`strip-${i}`}
                        className="w-8 h-8 rounded-full bg-slate-800/80 border-2 border-slate-700/60 p-1 backdrop-blur-sm hover:scale-125 hover:z-10 transition-transform"
                        title={logo.name}
                      >
                        <img src={logo.logoUrl} alt={logo.name} className="w-full h-full object-contain" loading="lazy" />
                      </div>
                    ))}
                  </div>
                  <span className="text-xs text-slate-500 ml-2">
                    & {heroLogos.length - 8}+ more teams
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Live Marquee Ticker ─────────────────────────────────────────── */}
        <MarqueeTicker />

        {/* ── Search & Filters ────────────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <BlogSearch />
        </div>

        {/* ── Featured Article ────────────────────────────────────────────── */}
        {featuredPost && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <Star className="w-5 h-5 text-yellow-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Featured Article</h2>
              <div className="flex-1 h-px bg-slate-800" />
            </div>

            <Link href={`/blog/${featuredPost.slug}`} className="group block">
              <Card className="bg-slate-900/60 border-slate-800 overflow-hidden hover:border-emerald-500/40 transition-all duration-300 shadow-xl hover:shadow-emerald-900/20">
                <div className="grid lg:grid-cols-2 gap-0">
                  {/* Media */}
                  <div className="relative overflow-hidden">
                    <FeaturedArticleMedia
                      media={featuredPost.media}
                      title={featuredPost.title}
                      logos={logoMap.get(featuredPost.id)}
                    />
                    <div className="absolute top-4 left-4 z-10">
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 backdrop-blur-sm">
                        <Star className="w-3 h-3 mr-1" /> Featured
                      </Badge>
                    </div>
                  </div>

                  {/* Content */}
                  <CardContent className="p-6 lg:p-8 flex flex-col justify-center">
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs w-fit mb-4">
                      AI Generated
                    </Badge>

                    <h3 className="text-2xl lg:text-3xl font-bold text-white mb-4 leading-tight group-hover:text-emerald-400 transition-colors">
                      {featuredPost.title}
                    </h3>

                    <p
                      className="text-slate-400 mb-6 text-base leading-relaxed overflow-hidden"
                      style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}
                    >
                      {formatExcerpt(featuredPost.excerpt, featuredPost.title)}
                    </p>

                    <div className="flex items-center gap-4 text-sm text-slate-500 mb-6">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" />
                        {featuredPost.author}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(featuredPost.publishedAt).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {featuredPost.readTime} min read
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5" />
                        {featuredPost.viewCount}
                      </div>
                    </div>

                    <div className="flex items-center text-emerald-400 font-semibold group-hover:gap-3 gap-2 transition-all">
                      Read Full Article
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </CardContent>
                </div>
              </Card>
            </Link>
          </div>
        )}

        {/* ── Latest Articles Grid ────────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <TrendingUp className="w-5 h-5 text-blue-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Latest Articles</h2>
              <div className="flex-1 h-px bg-slate-800 ml-2" />
            </div>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <Link href="/blog/all">
                View All
                <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {regularPosts.map((post) => {
              const postLogos = logoMap.get(post.id) || null
              return (
                <Link key={post.id} href={`/blog/${post.slug}`} className="group block">
                  <Card className="bg-slate-900/50 border-slate-800 hover:border-emerald-500/40 transition-all duration-300 overflow-hidden h-full shadow-md hover:shadow-emerald-900/20 hover:translate-y-[-2px]">
                    {/* Card Image */}
                    <BlogCardMedia media={post.media} title={post.title} logos={postLogos} />

                    <CardContent className="p-5">
                      {/* Category badge */}
                      {post.category && (
                        <Badge className="bg-slate-800 text-slate-300 border-slate-700 text-[10px] mb-3">
                          {post.category}
                        </Badge>
                      )}

                      <h3
                        className="text-lg font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors overflow-hidden leading-snug"
                        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
                      >
                        {post.title}
                      </h3>

                      <p
                        className="text-slate-400 text-sm mb-4 leading-relaxed overflow-hidden"
                        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
                      >
                        {formatExcerpt(post.excerpt, post.title)}
                      </p>

                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {post.author}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {post.readTime} min
                          </div>
                        </div>
                        <span>{new Date(post.publishedAt).toLocaleDateString()}</span>
                      </div>

                      {/* Read More indicator */}
                      <div className="mt-4 pt-3 border-t border-slate-800/50 flex items-center justify-between">
                        <span className="text-sm font-medium text-emerald-400 group-hover:text-emerald-300 transition-colors">
                          Read More
                        </span>
                        <ArrowRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>

          {blogPosts.length === 0 && (
            <div className="text-center py-16">
              <div className="p-4 bg-slate-800/50 rounded-2xl w-fit mx-auto mb-6">
                <BookOpen className="w-16 h-16 text-slate-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-400 mb-3">No articles found</h3>
              <p className="text-slate-500 mb-6">Check back soon for new content!</p>
              <Button className="bg-emerald-600 hover:bg-emerald-500">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          )}
        </div>

        {/* ── Blog Predictions ────────────────────────────────────────────── */}
        <BlogPredictions />

        {/* ── Newsletter Signup ───────────────────────────────────────────── */}
        <div className="border-t border-slate-800/50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="text-center">
              <div className="flex items-center justify-center gap-3 mb-5">
                <div className="p-3 bg-emerald-500/20 rounded-xl">
                  <Zap className="w-7 h-7 text-emerald-400" />
                </div>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                Stay Updated with Latest Tips
              </h2>
              <p className="text-slate-400 mb-8 text-base max-w-xl mx-auto">
                Get AI predictions, betting strategies, and expert insights delivered to your inbox.
              </p>
              <NewsletterSignup />
              <p className="text-slate-500 text-xs mt-4">
                🔒 We respect your privacy. Unsubscribe at any time.
              </p>
            </div>
          </div>
        </div>

        {/* ── Blog Match Predictions ──────────────────────────────────────── */}
        <BlogMatchPredictions />
      </div>
    </div>
  )
}
