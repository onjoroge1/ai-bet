import prisma from '@/lib/db'
import { Prisma } from '@prisma/client'

export interface TwitterPostDraft {
  content: string
  url?: string
  templateId: string
  postType: 'match' | 'parlay' | 'brand' | 'educational'
}

export interface MatchData {
  homeTeam: string
  awayTeam: string
  league: string
  matchId: string
  aiConf?: number
  matchUrl: string
  blogUrl?: string
}

export interface ParlayData {
  parlayId: string
  parlayUrl: string
  firstLeg?: {
    homeTeam: string
    awayTeam: string
  }
  legCount: number
}

/**
 * Twitter/X post generator for matches and parlays
 * Generates posts using predefined templates
 */
export interface TwitterTemplate {
  id: string
  name: string
  category: string
  content: string
  requiresConfidence?: boolean
  requiresLive?: boolean
  requiresMomentum?: boolean
  postType: 'match' | 'parlay' | 'brand' | 'upcoming'
  hasLink: boolean
}

export class TwitterGenerator {
  // All templates organized by category
  static readonly templates: TwitterTemplate[] = [
    // Blog Summary Templates
    {
      id: 'ai-confidence',
      name: 'AI Confidence',
      category: 'Blog Summary',
      content: `{TEAM_A} vs {TEAM_B} ⚽\nSnapBet AI gives {TEAM_A} a {AI_CONF}% win probability based on form and matchup data.\n\nFull AI breakdown 👉 {MATCH_URL}`,
      requiresConfidence: true,
      postType: 'match',
      hasLink: true,
    },
    {
      id: 'ai-vs-market',
      name: 'AI vs Market',
      category: 'Blog Summary',
      content: `AI vs market 📊\n{TEAM_A} vs {TEAM_B} shows a gap between model probability and market odds.\n\nSee the analysis 👉 {MATCH_URL}`,
      postType: 'match',
      hasLink: true,
    },
    {
      id: 'neutral-preview',
      name: 'Neutral Preview',
      category: 'Blog Summary',
      content: `{LEAGUE} preview\n{TEAM_A} vs {TEAM_B} — AI match analysis now live on SnapBet.\n\nRead more 👉 {MATCH_URL}`,
      postType: 'match',
      hasLink: true,
    },
    {
      id: 'value-signal',
      name: 'Value Signal',
      category: 'Blog Summary',
      content: `This match stood out in our AI scan 👀\n{TEAM_A} vs {TEAM_B} flagged due to form and matchup signals.\n\nFull breakdown 👉 {MATCH_URL}`,
      postType: 'match',
      hasLink: true,
    },
    {
      id: 'minimal',
      name: 'Minimal',
      category: 'Blog Summary',
      content: `AI match analysis ⚽\n{TEAM_A} vs {TEAM_B} — confidence, context, and key factors.\n\nDetails 👉 {MATCH_URL}`,
      postType: 'match',
      hasLink: true,
    },
    // Upcoming Match Templates
    {
      id: 'fixture-alert',
      name: 'Fixture Alert',
      category: 'Upcoming Match',
      content: `Upcoming match ⚽\n{TEAM_A} vs {TEAM_B}\nAI analysis dropping soon on SnapBet.`,
      postType: 'upcoming',
      hasLink: false,
    },
    {
      id: 'league-focus',
      name: 'League Focus',
      category: 'Upcoming Match',
      content: `{LEAGUE} this week 👀\n{TEAM_A} vs {TEAM_B} is on our radar.\nAI preview coming shortly.`,
      postType: 'upcoming',
      hasLink: false,
    },
    // Live Analysis Templates
    {
      id: 'live-momentum',
      name: 'Momentum',
      category: 'Live Analysis',
      content: `AI Live Analysis ⚽\n{TEAM_A} vs {TEAM_B} — {MATCH_MINUTE}'\n{MOMENTUM_SUMMARY}\n\nLive match view 👉 {LIVE_URL}`,
      requiresLive: true,
      requiresMomentum: true,
      postType: 'match',
      hasLink: true,
    },
    {
      id: 'live-observations',
      name: 'Observations',
      category: 'Live Analysis',
      content: `Live AI Update ⏱\n{TEAM_A} vs {TEAM_B} — {MATCH_MINUTE}'\nKey observations:\n• {OBS_1}\n• {OBS_2}\n\nFull live view 👉 {LIVE_URL}`,
      requiresLive: true,
      postType: 'match',
      hasLink: true,
    },
    // Parlay Templates
    {
      id: 'daily-parlay',
      name: 'Daily Parlay',
      category: 'Parlay',
      content: `Daily AI Parlay ⚽\nOne multi-match parlay generated from today's fixtures using correlation-aware signals.\n\nView today's parlay 👉 {PARLAY_BUILDER_URL}`,
      postType: 'parlay',
      hasLink: true,
    },
    // Brand Templates
    {
      id: 'brand-authority',
      name: 'Authority',
      category: 'Brand',
      content: `SnapBet AI analyzes matches using form, odds, and historical context.\nNo hype — just data.`,
      postType: 'brand',
      hasLink: false,
    },
    {
      id: 'brand-educational',
      name: 'Educational',
      category: 'Brand',
      content: `AI confidence reflects probability, not certainty.\nEvery match carries risk.`,
      postType: 'brand',
      hasLink: false,
    },
  ]

  /**
   * Get available templates for a post type
   */
  static getAvailableTemplates(postType: 'match' | 'parlay' | 'brand' | 'upcoming', matchData?: MatchData): TwitterTemplate[] {
    return this.templates.filter(template => {
      // Filter by post type
      if (template.postType !== postType) return false
      
      // Filter by requirements
      if (template.requiresConfidence && (!matchData || matchData.aiConf === undefined)) return false
      // Note: Live templates are filtered out in the API route for UPCOMING matches
      // We don't check requiresLive here since MatchData doesn't include status
      
      return true
    })
  }

  /**
   * Get template by ID
   */
  static getTemplateById(templateId: string): TwitterTemplate | undefined {
    return this.templates.find(t => t.id === templateId)
  }

  /**
   * Generate Twitter post for a match using a specific template
   */
  static generateMatchPost(matchData: MatchData, templateId?: string): TwitterPostDraft {
    // Get template (either specified or use first available)
    let template: TwitterTemplate
    if (templateId) {
      const found = this.getTemplateById(templateId)
      if (!found || (found.postType !== 'match' && found.postType !== 'upcoming')) {
        throw new Error(`Template ${templateId} not found or not valid for matches`)
      }
      template = found
    } else {
      // Fallback: get first available template (for backwards compatibility)
      const available = this.getAvailableTemplates('match', matchData)
      if (available.length === 0) {
        throw new Error('No templates available for this match')
      }
      template = available[0]
    }

    // Validate requirements
    if (template.requiresConfidence && matchData.aiConf === undefined) {
      throw new Error(`Template ${template.name} requires confidence score`)
    }

    // Prefer blog URL if available, otherwise use match URL
    const url = matchData.blogUrl || matchData.matchUrl

    // Replace template variables
    let content = template.content
      .replace(/{TEAM_A}/g, matchData.homeTeam)
      .replace(/{TEAM_B}/g, matchData.awayTeam)
      .replace(/{LEAGUE}/g, matchData.league)
      .replace(/{AI_CONF}/g, matchData.aiConf?.toString() || '')
      .replace(/{MATCH_URL}/g, url)
      .replace(/{LIVE_URL}/g, url) // For live templates, use same URL structure

    // For live templates, replace live-specific variables (if available)
    // TODO: Add support for {MATCH_MINUTE}, {MOMENTUM_SUMMARY}, {OBS_1}, {OBS_2} when live data is available
    content = content.replace(/{MATCH_MINUTE}/g, '45') // Placeholder
    content = content.replace(/{MOMENTUM_SUMMARY}/g, 'Momentum shifts detected') // Placeholder
    content = content.replace(/{OBS_1}/g, 'Observation 1') // Placeholder
    content = content.replace(/{OBS_2}/g, 'Observation 2') // Placeholder

    // Ensure content is within Twitter character limit (280 chars)
    // URLs are automatically shortened by Twitter, so we count them as ~23 chars
    const urlLength = (template.hasLink && url) ? 23 : 0
    const maxContentLength = 280 - urlLength - (urlLength > 0 ? 1 : 0) // -1 for space before URL if URL exists
    
    if (content.length > maxContentLength) {
      // Truncate content but keep URL
      if (template.hasLink && url) {
        const urlPattern = new RegExp(`\\s*👉\\s*${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'g')
        const contentWithoutUrl = content.replace(urlPattern, '').trim()
        const truncated = contentWithoutUrl.substring(0, maxContentLength - 3) + '...'
        content = `${truncated} 👉 ${url}`
      } else {
        content = content.substring(0, maxContentLength - 3) + '...'
      }
    }

    return {
      content: content.trim(),
      url: template.hasLink ? url : undefined,
      templateId: template.id,
      postType: 'match',
    }
  }

  /**
   * Generate Twitter post for a parlay using a specific template
   */
  static generateParlayPost(parlayData: ParlayData, templateId?: string): TwitterPostDraft {
    // Get template (default to daily-parlay)
    const templateIdToUse = templateId || 'daily-parlay'
    const template = this.getTemplateById(templateIdToUse)
    
    if (!template || template.postType !== 'parlay') {
      throw new Error(`Template ${templateIdToUse} not found or not valid for parlays`)
    }

    // Get parlay builder URL (you may want to customize this)
    const parlayBuilderUrl = parlayData.parlayUrl // Or use a builder URL

    let content = template.content
      .replace(/{PARLAY_BUILDER_URL}/g, parlayBuilderUrl)
      .replace(/{PARLAY_URL}/g, parlayBuilderUrl) // Fallback support

    // Ensure content is within character limit
    const urlLength = template.hasLink ? 23 : 0 // Twitter shortens URLs
    const maxContentLength = 280 - urlLength - (urlLength > 0 ? 1 : 0)
    
    if (content.length > maxContentLength) {
      if (template.hasLink && parlayBuilderUrl) {
        const urlPattern = new RegExp(`\\s*👉\\s*${parlayBuilderUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'g')
        const contentWithoutUrl = content.replace(urlPattern, '').trim()
        const truncated = contentWithoutUrl.substring(0, maxContentLength - 3) + '...'
        content = `${truncated} 👉 ${parlayBuilderUrl}`
      } else {
        content = content.substring(0, maxContentLength - 3) + '...'
      }
    }

    return {
      content: content.trim(),
      url: template.hasLink ? parlayBuilderUrl : undefined,
      templateId: template.id,
      postType: 'parlay',
    }
  }

  /**
   * Generate brand or educational post using a specific template
   */
  static generateBrandPost(templateId: 'brand-authority' | 'brand-educational' = 'brand-authority'): TwitterPostDraft {
    const template = this.getTemplateById(templateId)
    
    if (!template || template.postType !== 'brand') {
      throw new Error(`Template ${templateId} not found or not valid for brand posts`)
    }

    return {
      content: template.content,
      url: undefined,
      templateId: template.id,
      postType: 'brand',
    }
  }

  /**
   * Get eligible matches for Twitter posting
   * Same criteria as blog generation: matches with predictionData
   */
  static async getEligibleMatches(limit: number = 50): Promise<Array<{
    id: string
    matchId: string
    homeTeam: string
    awayTeam: string
    league: string
    kickoffDate: Date
    quickPurchases: Array<{
      id: string
      confidenceScore: number | null
      matchId: string | null
    }>
    blogPosts: Array<{
      id: string
      slug: string
    }>
  }>> {
    const matches = await prisma.marketMatch.findMany({
      where: {
        status: 'UPCOMING',
        isActive: true,
        quickPurchases: {
          some: {
            isActive: true,
            isPredictionActive: true,
            predictionData: { not: Prisma.JsonNull },
          },
        },
      },
      select: {
        id: true,
        matchId: true,
        homeTeam: true,
        awayTeam: true,
        league: true,
        kickoffDate: true,
        quickPurchases: {
          where: {
            isActive: true,
            isPredictionActive: true,
            predictionData: { not: Prisma.JsonNull },
          },
          select: {
            id: true,
            confidenceScore: true,
            matchId: true,
          },
          take: 1,
        },
        blogPosts: {
          where: {
            isPublished: true,
            isActive: true,
          },
          select: {
            id: true,
            slug: true,
          },
          take: 1,
        },
      },
      orderBy: { kickoffDate: 'asc' },
      take: limit,
    })

    return matches
  }

  /**
   * Get eligible parlays for Twitter posting
   */
  static async getEligibleParlays(limit: number = 20): Promise<Array<{
    id: string
    parlayId: string
    legCount: number
    earliestKickoff: Date
    legs: Array<{
      homeTeam: string
      awayTeam: string
      legOrder: number
    }>
  }>> {
    const now = new Date()
    
    const parlays = await prisma.parlayConsensus.findMany({
      where: {
        status: 'active',
        earliestKickoff: { gt: now }, // Only upcoming parlays
      },
      select: {
        id: true,
        parlayId: true,
        legCount: true,
        earliestKickoff: true,
        legs: {
          select: {
            homeTeam: true,
            awayTeam: true,
            legOrder: true,
          },
          orderBy: { legOrder: 'asc' },
          take: 1, // Get first leg for template
        },
      },
      orderBy: { earliestKickoff: 'asc' },
      take: limit,
    })

    return parlays
  }

  /**
   * Check if match already has Twitter posts
   */
  static async hasExistingPostForMatch(matchId: string, platform: string = 'twitter'): Promise<boolean> {
    const count = await prisma.socialMediaPost.count({
      where: {
        matchId,
        platform,
        status: { in: ['posted', 'scheduled'] },
      },
    })
    return count > 0
  }

  /**
   * Check if parlay already has Twitter posts
   */
  static async hasExistingPostForParlay(parlayId: string, platform: string = 'twitter'): Promise<boolean> {
    const count = await prisma.socialMediaPost.count({
      where: {
        parlayId,
        platform,
        status: { in: ['posted', 'scheduled'] },
      },
    })
    return count > 0
  }

  /**
   * Get base URL for generating match/parlay URLs
   */
  static getBaseUrl(): string {
    return process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://snapbet.ai'
  }
}

