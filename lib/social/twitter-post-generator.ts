import { TWITTER_TEMPLATES, TwitterTemplate, getTemplateById } from './twitter-templates'

export interface TwitterPostDraft {
  content: string
  url?: string
  templateId: string
  templateName: string
  postType: 'match' | 'parlay' | 'brand' | 'live'
}

export interface MatchData {
  homeTeam: string
  awayTeam: string
  league: string
  matchId: string
  aiConf?: number
  matchUrl: string
  blogUrl?: string
  // Live data (optional)
  matchMinute?: number
  momentumSummary?: string
  observations?: string[]
}

export interface ParlayData {
  parlayId: string
  parlayBuilderUrl: string
}

/**
 * Generate Twitter post from selected template
 */
export class TwitterPostGenerator {
  /**
   * Generate Twitter post for a match using selected template
   */
  static generateMatchPost(matchData: MatchData, templateId: string): TwitterPostDraft {
    const template = getTemplateById(templateId)
    if (!template) {
      throw new Error(`Template ${templateId} not found`)
    }

    // Prefer blog URL if available and template has URL
    const url = template.hasUrl ? (matchData.blogUrl || matchData.matchUrl) : undefined

    // Replace template variables
    let content = template.content
      .replace(/{TEAM_A}/g, matchData.homeTeam)
      .replace(/{TEAM_B}/g, matchData.awayTeam)
      .replace(/{LEAGUE}/g, matchData.league)
      .replace(/{AI_CONF}/g, matchData.aiConf?.toString() || '')
      .replace(/{MATCH_URL}/g, url || '')
      .replace(/{LIVE_URL}/g, url || '')
      .replace(/{MATCH_MINUTE}/g, matchData.matchMinute?.toString() || '')
      .replace(/{MOMENTUM_SUMMARY}/g, matchData.momentumSummary || '')
      
    // Handle observations (replace {OBS_1}, {OBS_2}, etc.)
    if (matchData.observations && matchData.observations.length > 0) {
      content = content.replace(/{OBS_1}/g, matchData.observations[0] || '')
      content = content.replace(/{OBS_2}/g, matchData.observations[1] || matchData.observations[0] || '')
    }

    // Ensure content is within Twitter character limit (280 chars)
    // URLs are automatically shortened by Twitter, so we count them as ~23 chars
    const urlLength = url ? 23 : 0
    const maxContentLength = 280 - urlLength - (url ? 1 : 0) // -1 for space before URL
    
    if (content.length > maxContentLength) {
      // Truncate content but keep URL if present
      if (url) {
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
      url: url,
      templateId: template.id,
      templateName: template.name,
      postType: 'match',
    }
  }

  /**
   * Generate Twitter post for a parlay using selected template
   */
  static generateParlayPost(parlayData: ParlayData, templateId: string): TwitterPostDraft {
    const template = getTemplateById(templateId)
    if (!template) {
      throw new Error(`Template ${templateId} not found`)
    }

    let content = template.content
      .replace(/{PARLAY_BUILDER_URL}/g, parlayData.parlayBuilderUrl)

    // Ensure content is within character limit
    const urlLength = parlayData.parlayBuilderUrl ? 23 : 0
    const maxContentLength = 280 - urlLength - (parlayData.parlayBuilderUrl ? 1 : 0)
    
    if (content.length > maxContentLength) {
      if (parlayData.parlayBuilderUrl) {
        const urlPattern = new RegExp(`\\s*👉\\s*${parlayData.parlayBuilderUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'g')
        const contentWithoutUrl = content.replace(urlPattern, '').trim()
        const truncated = contentWithoutUrl.substring(0, maxContentLength - 3) + '...'
        content = `${truncated} 👉 ${parlayData.parlayBuilderUrl}`
      } else {
        content = content.substring(0, maxContentLength - 3) + '...'
      }
    }

    return {
      content: content.trim(),
      url: parlayData.parlayBuilderUrl,
      templateId: template.id,
      templateName: template.name,
      postType: 'parlay',
    }
  }

  /**
   * Generate brand post using selected template
   */
  static generateBrandPost(templateId: string): TwitterPostDraft {
    const template = getTemplateById(templateId)
    if (!template) {
      throw new Error(`Template ${templateId} not found`)
    }

    return {
      content: template.content.trim(),
      url: undefined,
      templateId: template.id,
      templateName: template.name,
      postType: 'brand',
    }
  }

  /**
   * Get base URL for generating match/parlay URLs
   */
  static getBaseUrl(): string {
    return process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://snapbet.ai'
  }
}

