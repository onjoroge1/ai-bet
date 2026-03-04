import prisma from '@/lib/db'
import { Prisma } from '@prisma/client'
import { getProductionBaseUrl, buildSocialUrl } from './url-utils'
import { generateMatchSlug } from '@/lib/match-slug'
import OpenAI from 'openai'
import { logger } from '@/lib/logger'

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
  explanation?: string
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
      content: `{LEAGUE} preview\n{TEAM_A} vs {TEAM_B}\n{EXPLANATION_SNIPPET}\n\nSee full AI breakdown 👉 {MATCH_URL}`,
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

    // Always use match URL with SEO slug (not blog URL)
    // The match page is the primary destination with all info
    const matchSlug = generateMatchSlug(matchData.homeTeam, matchData.awayTeam)
    const url = buildSocialUrl(`/match/${matchSlug}`)

    // Process explanation snippet for neutral-preview template
    let explanationSnippet = ''
    if (template.id === 'neutral-preview') {
      if (matchData.explanation && matchData.explanation.trim()) {
        // Truncate explanation to 110 characters, trying to break at word boundary
        const maxLength = 110
        const explanation = matchData.explanation.trim()
        
        if (explanation.length > maxLength) {
          // Try to break at word boundary
          const truncated = explanation.substring(0, maxLength)
          const lastSpace = truncated.lastIndexOf(' ')
          const lastPeriod = truncated.lastIndexOf('.')
          const lastBreak = Math.max(lastSpace, lastPeriod)
          
          if (lastBreak > maxLength * 0.7) {
            // Use word boundary if it's not too early
            explanationSnippet = explanation.substring(0, lastBreak) + '...'
          } else {
            // Just truncate at character limit
            explanationSnippet = truncated + '...'
          }
        } else {
          explanationSnippet = explanation
        }
      } else {
        // Fallback message if no explanation available
        explanationSnippet = 'AI-powered match analysis with detailed insights and betting intelligence.'
      }
    }

    // Replace template variables
    let content = template.content
      .replace(/{TEAM_A}/g, matchData.homeTeam)
      .replace(/{TEAM_B}/g, matchData.awayTeam)
      .replace(/{LEAGUE}/g, matchData.league)
      .replace(/{AI_CONF}/g, matchData.aiConf?.toString() || '')
      .replace(/{MATCH_URL}/g, url)
      .replace(/{LIVE_URL}/g, url)
      .replace(/{EXPLANATION_SNIPPET}/g, explanationSnippet || '')

    content = content.replace(/{MATCH_MINUTE}/g, '45')
    content = content.replace(/{MOMENTUM_SUMMARY}/g, 'Momentum shifts detected')
    content = content.replace(/{OBS_1}/g, 'Observation 1')
    content = content.replace(/{OBS_2}/g, 'Observation 2')

    // Strip URL from content — it's stored separately in draft.url and appended
    // at post time by the posting cron. This prevents:
    //  - LLM humanization replacing the URL with literal "[URL]"
    //  - Double URLs (one in content + one appended at post time)
    if (template.hasLink && url) {
      content = content
        .replace(/\s*👉\s*https?:\/\/[^\s]+/g, '')
        .replace(/\s*https?:\/\/[^\s]+$/g, '')
        .trim()
    }

    // Enforce Twitter character limit (280 chars total).
    // URL (if present) is appended at post time; Twitter shortens it to ~23 chars.
    const urlLength = (template.hasLink && url) ? 23 : 0
    const maxContentLength = 280 - urlLength - (urlLength > 0 ? 1 : 0)

    if (content.length > maxContentLength) {
      content = content.substring(0, maxContentLength - 3) + '...'
    }

    return {
      content: content.trim(),
      url: template.hasLink ? url : undefined,
      templateId: template.id,
      postType: 'match',
    }
  }

  /**
   * Humanize a Twitter post using OpenAI to make it sound more natural and engaging
   * Falls back to original content if OpenAI call fails
   */
  static async humanizePost(
    originalContent: string,
    matchData?: MatchData,
    options?: { useLLM?: boolean }
  ): Promise<string> {
    // If LLM is disabled, return original
    if (options?.useLLM === false) {
      return originalContent
    }

    // Check if OpenAI API key is available
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      logger.warn('OPENAI_API_KEY not set, skipping LLM rewrite', {
        tags: ['social', 'twitter', 'llm'],
      })
      return originalContent
    }

    try {
      const openai = new OpenAI({ apiKey })

      // Build context for the LLM (avoid AI-related terms)
      const contextParts: string[] = []
      if (matchData) {
        contextParts.push(`Match: ${matchData.homeTeam} vs ${matchData.awayTeam}`)
        contextParts.push(`League: ${matchData.league}`)
        if (matchData.aiConf !== undefined) {
          contextParts.push(`Win probability: ${matchData.aiConf}%`)
        }
        if (matchData.explanation) {
          contextParts.push(`Analysis: ${matchData.explanation.substring(0, 200)}...`)
        }
      }

      const systemPrompt = `You are a sharp sports betting analyst tweeting about upcoming matches. Rewrite this template tweet to sound natural, conversational, and engaging for Twitter/X.

Rules:
- Keep under 250 chars (leave room for URL which is ~23 chars)
- Use the match data provided (confidence, league, form) to add a specific insight
- Don't mention "SnapBet AI", "AI", "model", "algorithm", "machine learning", or any brand names — let the link do the branding
- Vary your tone: sometimes questioning, sometimes confident, sometimes contrarian
- No generic phrases like "flagged due to" or "based on form and matchup data"
- NO EMOJIS — write in plain text only
- End with a hook that makes people click the link
- Sound like a real person, not a marketing bot or AI assistant
- Be specific about what makes this match interesting
- Write like a human tipster would — casual, opinionated, direct
- Avoid any language that sounds automated or AI-generated`

      const userMessage = `Match Context:
${contextParts.join('\n')}

Template Output:
${originalContent}

Rewrite this for Twitter. Do NOT include any URLs, links, or placeholders like [URL] — the link is added separately.`

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 150,
        temperature: 0.8, // Higher temperature for more variation
      })

      const humanized = response.choices[0]?.message?.content?.trim()
      
      if (!humanized) {
        logger.warn('OpenAI returned empty response, using original', {
          tags: ['social', 'twitter', 'llm'],
        })
        return originalContent
      }

      // Remove emojis and any URL/placeholder artifacts from LLM output.
      // URLs are stored separately in the `url` field and appended at post time.
      const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu
      let cleaned = humanized.replace(emojiRegex, '').trim()

      // Strip any [URL], {URL}, [LINK] placeholders the LLM might generate,
      // as well as any literal URLs or trailing pointer emojis.
      cleaned = cleaned
        .replace(/\s*\[URL\]/gi, '')
        .replace(/\s*\{URL\}/gi, '')
        .replace(/\s*\(URL\)/gi, '')
        .replace(/\s*\[LINK\]/gi, '')
        .replace(/\s*\{LINK\}/gi, '')
        .replace(/\s*https?:\/\/[^\s]+/g, '')
        .replace(/\s*👉\s*$/g, '')
        .trim()

      // Ensure we're within Twitter's limit (280 chars)
      if (cleaned.length > 280) {
        logger.warn('Humanized tweet exceeds 280 chars, truncating', {
          tags: ['social', 'twitter', 'llm'],
          data: { length: cleaned.length },
        })
        return cleaned.substring(0, 277) + '...'
      }

      logger.info('Successfully humanized tweet with LLM', {
        tags: ['social', 'twitter', 'llm'],
        data: {
          originalLength: originalContent.length,
          humanizedLength: cleaned.length,
        },
      })

      return cleaned
    } catch (error) {
      logger.error('Failed to humanize tweet with LLM, using original', {
        tags: ['social', 'twitter', 'llm', 'error'],
        error: error instanceof Error ? error : undefined,
      })
      return originalContent
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
      .replace(/{PARLAY_URL}/g, parlayBuilderUrl)

    // Strip URL from content — stored separately in draft.url and appended at post time
    if (template.hasLink && parlayBuilderUrl) {
      content = content
        .replace(/\s*👉\s*https?:\/\/[^\s]+/g, '')
        .replace(/\s*https?:\/\/[^\s]+$/g, '')
        .trim()
    }

    const urlLength = template.hasLink ? 23 : 0
    const maxContentLength = 280 - urlLength - (urlLength > 0 ? 1 : 0)

    if (content.length > maxContentLength) {
      content = content.substring(0, maxContentLength - 3) + '...'
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
    earliestKickoff: Date | null
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
   * Uses centralized URL utility to ensure production URLs and prevent localhost in production
   */
  static getBaseUrl(): string {
    return getProductionBaseUrl()
  }
}

