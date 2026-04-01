import prisma from '@/lib/db'
import { Prisma } from '@prisma/client'
import OpenAI from 'openai'
import { logger } from '@/lib/logger'

// ─── Types ──────────────────────────────────────────────────────────────────

interface MultisportMatchForBlog {
  id: string
  eventId: string
  sport: string
  status: string
  homeTeam: string
  awayTeam: string
  league: string
  commenceTime: Date
  odds: any
  model: any
  predictionData: any
  teamContext: any
  modelInfo: any
}

interface MultisportBlogDraft {
  title: string
  slug: string
  excerpt: string
  contentHtml: string
  tags: string[]
  readTimeMinutes: number
  sport: string
  eventId: string
}

const SPORT_CONFIG: Record<string, { name: string; emoji: string; type: string }> = {
  basketball_nba: { name: 'NBA', emoji: '🏀', type: 'Basketball' },
  icehockey_nhl: { name: 'NHL', emoji: '🏒', type: 'Ice Hockey' },
  basketball_ncaab: { name: 'NCAAB', emoji: '🏀', type: 'College Basketball' },
}

// ─── Main Generator ─────────────────────────────────────────────────────────

export class MultisportBlogGenerator {

  /**
   * Get eligible multisport matches for blog generation
   */
  static async getEligibleMatches(sportKey?: string): Promise<MultisportMatchForBlog[]> {
    const where: any = {
      status: 'upcoming',
      commenceTime: { gte: new Date() },
      model: { not: Prisma.JsonNull },
    }
    if (sportKey) where.sport = sportKey

    const matches = await prisma.multisportMatch.findMany({
      where,
      orderBy: { commenceTime: 'asc' },
      take: 50,
    })

    // Check which already have blogs (by eventId in sourceUrl)
    const eventIds = matches.map(m => m.eventId)
    const existingBlogs = await prisma.blogPost.findMany({
      where: {
        sourceUrl: { in: eventIds },
        isActive: true,
      },
      select: { sourceUrl: true },
    })
    const bloggedIds = new Set(existingBlogs.map(b => b.sourceUrl))

    return matches
      .filter(m => !bloggedIds.has(m.eventId))
      .map(m => ({
        id: m.id,
        eventId: m.eventId,
        sport: m.sport,
        status: m.status,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        league: m.league,
        commenceTime: m.commenceTime,
        odds: m.odds,
        model: m.model,
        predictionData: m.predictionData,
        teamContext: m.teamContext,
        modelInfo: m.modelInfo,
      }))
  }

  /**
   * Generate a blog draft for a multisport match
   */
  static async generateDraft(match: MultisportMatchForBlog, options?: { useLLM?: boolean }): Promise<MultisportBlogDraft> {
    const config = SPORT_CONFIG[match.sport] || SPORT_CONFIG.basketball_nba
    const model = match.model as any || {}
    const preds = model.predictions || model
    const odds = match.odds as any || {}
    const consensus = odds.consensus || odds
    const teamCtx = match.teamContext as any || {}

    const pick = preds.pick === 'H' ? match.homeTeam : match.awayTeam
    const confidence = preds.confidence ? Math.round(preds.confidence * 100) : null
    const homeProb = preds.home_win ? Math.round(preds.home_win * 100) : null
    const awayProb = preds.away_win ? Math.round(preds.away_win * 100) : null
    const spread = consensus.home_spread
    const totalLine = consensus.total_line

    // Generate title and slug
    const title = `${match.homeTeam} vs ${match.awayTeam} Prediction, Odds & ${config.name} Analysis`
    const slug = `${match.homeTeam}-vs-${match.awayTeam}-${match.sport.replace('basketball_', '').replace('icehockey_', '')}-prediction`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    const excerpt = `${match.homeTeam} vs ${match.awayTeam} – ${config.name} AI prediction${confidence ? ` with ${confidence}% confidence` : ''}. Spread, O/U, and full analysis.`

    // Build content HTML
    let contentHtml = this.buildContentHtml(match, config, {
      pick, confidence, homeProb, awayProb, spread, totalLine, teamCtx, preds,
    })

    // LLM humanization
    if (options?.useLLM !== false) {
      contentHtml = await this.humanizeContent(contentHtml, {
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        league: match.league || config.name,
        sport: config.name,
        confidence,
      })
    }

    const tags = [
      match.sport.replace('basketball_', '').replace('icehockey_', ''),
      config.type.toLowerCase(),
      'ai-analysis',
      'predictions',
      confidence && confidence >= 80 ? 'high-confidence' : 'medium',
    ].filter(Boolean) as string[]

    const readTimeMinutes = Math.max(3, Math.ceil(contentHtml.length / 900))

    return {
      title,
      slug,
      excerpt,
      contentHtml,
      tags,
      readTimeMinutes,
      sport: match.sport,
      eventId: match.eventId,
    }
  }

  /**
   * Generate and save a blog post for a multisport match
   */
  static async generateAndSave(match: MultisportMatchForBlog, options?: { useLLM?: boolean }): Promise<{ created: boolean; blogId?: string; error?: string }> {
    try {
      const draft = await this.generateDraft(match, options)

      // Check if blog already exists
      const existing = await prisma.blogPost.findFirst({
        where: { sourceUrl: match.eventId, isActive: true },
      })
      if (existing) {
        return { created: false, error: 'Blog already exists' }
      }

      const blog = await prisma.blogPost.create({
        data: {
          title: draft.title,
          slug: draft.slug,
          excerpt: draft.excerpt,
          content: draft.contentHtml,
          author: 'AI System',
          category: 'Predictions',
          tags: draft.tags,
          geoTarget: ['worldwide'],
          isPublished: true,
          isActive: true,
          publishedAt: new Date(),
          readTime: draft.readTimeMinutes,
          seoTitle: draft.title,
          seoDescription: draft.excerpt,
          sourceUrl: match.eventId,
        },
      })

      logger.info(`[MultisportBlog] Created blog for ${match.homeTeam} vs ${match.awayTeam}`, {
        tags: ['blog', 'multisport', match.sport],
        data: { blogId: blog.id, eventId: match.eventId },
      })

      return { created: true, blogId: blog.id }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      logger.error(`[MultisportBlog] Failed for ${match.homeTeam} vs ${match.awayTeam}: ${msg}`, {
        tags: ['blog', 'multisport', 'error'],
      })
      return { created: false, error: msg }
    }
  }

  // ─── Content Builder ────────────────────────────────────────────────────

  private static buildContentHtml(
    match: MultisportMatchForBlog,
    config: { name: string; type: string },
    data: {
      pick: string; confidence: number | null; homeProb: number | null; awayProb: number | null;
      spread: number | undefined; totalLine: number | undefined;
      teamCtx: any; preds: any;
    }
  ): string {
    const { pick, confidence, homeProb, awayProb, spread, totalLine, teamCtx, preds } = data
    const kickoff = match.commenceTime.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
    const kickoffTime = match.commenceTime.toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York',
    })

    const sections: string[] = []

    // Header
    sections.push(`
      <h1>${match.homeTeam} vs ${match.awayTeam} Prediction & ${config.name} Analysis</h1>
      <p><strong>League:</strong> ${match.league || config.name}</p>
      <p><strong>Kickoff:</strong> ${kickoff} at ${kickoffTime} ET</p>
    `)

    // Match Analysis
    sections.push(`
      <h2>Match Analysis</h2>
      <p>Our ${config.name} prediction model${confidence ? ` gives this matchup a ${confidence}% confidence rating` : ' has analyzed this matchup'}.
      ${homeProb && awayProb ? `The model sees ${match.homeTeam} at ${homeProb}% and ${match.awayTeam} at ${awayProb}%` : ''}.
      ${pick ? `The analysis leans toward <strong>${pick}</strong> for this game.` : ''}</p>
    `)

    // Key Betting Lines
    if (spread != null || totalLine != null) {
      sections.push(`
        <h2>Key Betting Lines</h2>
        <ul>
          ${spread != null ? `<li><strong>Spread:</strong> ${match.homeTeam} ${spread > 0 ? '+' : ''}${spread}</li>` : ''}
          ${totalLine != null ? `<li><strong>Over/Under:</strong> ${totalLine} points</li>` : ''}
          ${homeProb && awayProb ? `<li><strong>Moneyline:</strong> ${match.homeTeam} ${homeProb}% | ${match.awayTeam} ${awayProb}%</li>` : ''}
          ${preds.conviction_tier ? `<li><strong>Conviction:</strong> ${preds.conviction_tier}</li>` : ''}
          ${preds.edge_vs_market ? `<li><strong>Edge vs Market:</strong> ${Math.round(Math.abs(preds.edge_vs_market) * 100)}%</li>` : ''}
        </ul>
      `)
    }

    // Team Context (if available from prediction data)
    const homeCtx = teamCtx?.home
    const awayCtx = teamCtx?.away

    if (homeCtx || awayCtx) {
      sections.push(`<h2>Team Snapshots</h2>`)

      if (homeCtx) {
        const form = Array.isArray(homeCtx.recent_form) ? homeCtx.recent_form.join('') : ''
        const record = homeCtx.season_stats ? `${homeCtx.season_stats.wins}W-${homeCtx.season_stats.losses}L` : ''
        sections.push(`
          <h3>${match.homeTeam}</h3>
          <ul>
            ${record ? `<li><strong>Season Record:</strong> ${record}</li>` : ''}
            ${homeCtx.season_stats?.home_record ? `<li><strong>Home Record:</strong> ${homeCtx.season_stats.home_record}</li>` : ''}
            ${form ? `<li><strong>Recent Form:</strong> ${form}</li>` : ''}
          </ul>
        `)
      }

      if (awayCtx) {
        const form = Array.isArray(awayCtx.recent_form) ? awayCtx.recent_form.join('') : ''
        const record = awayCtx.season_stats ? `${awayCtx.season_stats.wins}W-${awayCtx.season_stats.losses}L` : ''
        sections.push(`
          <h3>${match.awayTeam}</h3>
          <ul>
            ${record ? `<li><strong>Season Record:</strong> ${record}</li>` : ''}
            ${awayCtx.season_stats?.away_record ? `<li><strong>Away Record:</strong> ${awayCtx.season_stats.away_record}</li>` : ''}
            ${form ? `<li><strong>Recent Form:</strong> ${form}</li>` : ''}
          </ul>
        `)
      }
    } else {
      // Generic team section when no context available
      sections.push(`
        <h2>Team Snapshots</h2>
        <h3>${match.homeTeam}</h3>
        <p>${match.homeTeam} will look to leverage their home court advantage in this matchup. Playing at home in ${config.name} is often a significant factor.</p>
        <h3>${match.awayTeam}</h3>
        <p>${match.awayTeam} comes into this game looking to prove themselves on the road. Their ability to perform away from home will be crucial.</p>
      `)
    }

    // Model Info
    const modelInfo = match.modelInfo as any
    if (modelInfo) {
      sections.push(`
        <h2>Model Insights</h2>
        <p>This prediction is powered by our ${config.name} V3 model${modelInfo.accuracy ? ` with ${Math.round(modelInfo.accuracy * 100)}% historical accuracy` : ''}.
        ${modelInfo.features_used ? ` The model evaluates ${modelInfo.features_used} features` : ''}
        ${modelInfo.n_training_samples ? ` across ${modelInfo.n_training_samples.toLocaleString()} training samples` : ''}.</p>
      `)
    }

    // Risk & FAQ
    sections.push(`
      <h2>Risk & Uncertainty</h2>
      <p>While our analysis provides data-driven insights, ${config.type.toLowerCase()} carries inherent unpredictability. Multiple factors including player form, injuries, and game-day conditions can influence the outcome. Exercise caution when interpreting these projections.</p>

      <h2>Frequently Asked Questions</h2>
      <h3>How is the confidence calculated?</h3>
      <p>Confidence is derived from analyzing team performance, matchup history, and market data. It serves as an informed signal, not a guarantee.</p>
      <h3>Is this wagering advice?</h3>
      <p>This analysis is informational and model-driven. It does not constitute wagering advice.</p>
    `)

    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${match.homeTeam} vs ${match.awayTeam} ${config.name} Prediction</title></head>
<body>
${sections.join('\n')}
</body>
</html>`
  }

  // ─── LLM Humanization ──────────────────────────────────────────────────

  private static async humanizeContent(
    htmlContent: string,
    matchData: { homeTeam: string; awayTeam: string; league: string; sport: string; confidence: number | null }
  ): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return htmlContent

    try {
      const openai = new OpenAI({ apiKey })
      const textContent = htmlContent
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a professional ${matchData.sport} analyst writing match preview articles. Rewrite this ${matchData.sport} blog content to sound natural, engaging, and human-written.

Rules:
- Remove AI/model/algorithm mentions — use "our analysis" instead
- Write like a real sports analyst, not a bot
- Keep all data (percentages, records, spreads) accurate
- Maintain HTML structure and sections
- Focus on ${matchData.sport}-specific insights (${matchData.sport === 'NBA' || matchData.sport === 'NCAAB' ? 'matchups, pace, shooting, rebounding' : 'special teams, goaltending, power play'})
- Keep 600-900 words
- Sound confident and opinionated
- No emojis in content`
          },
          {
            role: 'user',
            content: `Match: ${matchData.homeTeam} vs ${matchData.awayTeam}\nLeague: ${matchData.league}\n${matchData.confidence ? `Confidence: ${matchData.confidence}%` : ''}\n\nOriginal:\n${textContent.substring(0, 5000)}\n\nRewrite naturally with HTML structure.`
          },
        ],
        temperature: 0.8,
        max_tokens: 2500,
      })

      const result = response.choices[0]?.message?.content
      if (result && result.length > 200) {
        // Ensure it's wrapped in HTML
        if (!result.includes('<html')) {
          return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${matchData.homeTeam} vs ${matchData.awayTeam}</title></head><body>${result}</body></html>`
        }
        return result
      }
      return htmlContent
    } catch (error) {
      logger.warn(`[MultisportBlog] LLM humanization failed, using template`, {
        tags: ['blog', 'llm', 'error'],
      })
      return htmlContent
    }
  }
}
