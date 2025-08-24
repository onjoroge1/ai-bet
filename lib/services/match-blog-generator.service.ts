import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

export interface MatchBlogData {
  title: string
  slug: string
  excerpt: string
  content: string
  author: string
  category: string
  tags: string[]
  geoTarget: string[]
  featured: boolean
  readTime: number
  seoTitle: string
  seoDescription: string
  seoKeywords: string[]
  isPublished: boolean
  sourceUrl?: string
  aiGenerated: boolean
  matchId?: string
  odds?: number
  league?: string
  matchDate?: Date
}

export interface QuickPurchaseMatch {
  id: string
  name: string
  description: string
  matchId: string | null
  matchData: any
  predictionData: any
  odds: any // Changed from number | null to handle Decimal type
  confidenceScore: number | null
  valueRating: string | null
  analysisSummary: string | null
  type: string
  isPredictionActive: boolean
  createdAt: Date
  updatedAt: Date
}

export class MatchBlogGeneratorService {
  private rapidApiKey: string
  private oddsApiKey: string
  private openaiApiKey: string

  constructor() {
    this.rapidApiKey = process.env.RAPIDAPI_KEY || ''
    this.oddsApiKey = process.env.ODDS_API_KEY || ''
    this.openaiApiKey = process.env.OPENAI_API_KEY || ''
  }

  /**
   * Get upcoming matches from QuickPurchase table
   */
  async getUpcomingMatches(): Promise<QuickPurchaseMatch[]> {
    try {
      const matches = await prisma.quickPurchase.findMany({
        where: {
          isActive: true,
          isPredictionActive: true,
          type: { in: ['prediction', 'tip'] },
          matchId: { not: null }
        },
        select: {
          id: true,
          name: true,
          description: true,
          matchId: true,
          matchData: true,
          predictionData: true,
          odds: true,
          confidenceScore: true,
          valueRating: true,
          analysisSummary: true,
          type: true,
          isPredictionActive: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 10 // Limit to 10 most recent matches
      })

      logger.info('Retrieved upcoming matches for blog generation', {
        tags: ['match-blog-generator', 'upcoming-matches'],
        data: { count: matches.length }
      })

      return matches
    } catch (error) {
      logger.error('Failed to get upcoming matches', {
        tags: ['match-blog-generator', 'error'],
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      })
      throw error
    }
  }

  /**
   * Enrich match data with external APIs
   */
  async enrichMatchData(match: QuickPurchaseMatch): Promise<any> {
    try {
      let enrichedData: any = { ...match }

      // Parse prediction data to get match info
      let predictionData = null
      if (match.predictionData) {
        try {
          predictionData = typeof match.predictionData === 'string' 
            ? JSON.parse(match.predictionData) 
            : match.predictionData
        } catch (e) {
          logger.warn('Failed to parse prediction data', {
            tags: ['match-blog-generator', 'enrichment'],
            data: { matchId: match.id, error: e instanceof Error ? e.message : 'Unknown error' }
          })
        }
      }

      // Extract match ID from prediction data or use fallback
      const matchId = predictionData?.prediction?.match_info?.match_id || match.matchId || ''

      // Try to get additional data from RapidAPI if we have a matchId
      if (matchId && this.rapidApiKey) {
        try {
          const rapidApiData = await this.fetchRapidApiData(matchId)
          enrichedData.rapidApi = rapidApiData
        } catch (error) {
          logger.warn('Failed to fetch RapidAPI data', {
            tags: ['match-blog-generator', 'rapid-api'],
            data: { matchId, error: error instanceof Error ? error.message : 'Unknown error' }
          })
        }
      }

      // Try to get odds data if we have a matchId
      if (matchId && this.oddsApiKey) {
        try {
          const oddsData = await this.fetchOddsData(matchId)
          enrichedData.oddsApi = oddsData
        } catch (error) {
          logger.warn('Failed to fetch Odds API data', {
            tags: ['match-blog-generator', 'odds-api'],
            data: { matchId, error: error instanceof Error ? error.message : 'Unknown error' }
          })
        }
      }

      // Add parsed prediction data
      enrichedData.predictionData = predictionData

      return enrichedData
    } catch (error) {
      logger.error('Failed to enrich match data', {
        tags: ['match-blog-generator', 'enrichment', 'error'],
        data: { matchId: match.id, error: error instanceof Error ? error.message : 'Unknown error' }
      })
      return match // Return original data if enrichment fails
    }
  }

  /**
   * Fetch comprehensive match data from RapidAPI
   */
  private async fetchRapidApiData(matchId: string): Promise<any> {
    try {
      if (!this.rapidApiKey) {
        logger.warn('RapidAPI key not configured', {
          tags: ['match-blog-generator', 'rapid-api'],
          data: { matchId }
        })
        return null
      }

      // Fetch fixture details
      const fixtureResponse = await fetch(`https://api-football-v1.p.rapidapi.com/v3/fixtures?id=${matchId}`, {
        headers: {
          'X-RapidAPI-Key': this.rapidApiKey,
          'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
        }
      })

      if (!fixtureResponse.ok) {
        throw new Error(`RapidAPI fixture request failed: ${fixtureResponse.status}`)
      }

      const fixtureData = await fixtureResponse.json() as any
      
      if (!fixtureData.response || fixtureData.response.length === 0) {
        return null
      }

      const fixture = fixtureData.response[0]
      const homeTeamId = fixture.teams?.home?.id
      const awayTeamId = fixture.teams?.away?.id

      // Fetch team statistics and form
      const [homeTeamStats, awayTeamStats] = await Promise.all([
        this.fetchTeamStats(homeTeamId),
        this.fetchTeamStats(awayTeamId)
      ])

      // Fetch head-to-head data
      const h2hData = await this.fetchHeadToHead(homeTeamId, awayTeamId)

      // Fetch recent form for both teams
      const [homeTeamForm, awayTeamForm] = await Promise.all([
        this.fetchTeamForm(homeTeamId),
        this.fetchTeamForm(awayTeamId)
      ])

      return {
        fixture: {
          homeTeam: fixture.teams?.home?.name,
          awayTeam: fixture.teams?.away?.name,
          league: fixture.league?.name,
          venue: fixture.fixture?.venue?.name,
          date: fixture.fixture?.date,
          status: fixture.fixture?.status?.short,
          referee: fixture.fixture?.referee,
          attendance: fixture.fixture?.attendance
        },
        teams: {
          home: {
            ...homeTeamStats,
            form: homeTeamForm
          },
          away: {
            ...awayTeamStats,
            form: awayTeamForm
          }
        },
        headToHead: h2hData,
        odds: null // Will be populated by Odds API
      }
    } catch (error) {
      logger.warn('Failed to fetch RapidAPI data', {
        tags: ['match-blog-generator', 'rapid-api'],
        data: { matchId, error: error instanceof Error ? error.message : 'Unknown error' }
      })
      return null
    }
  }

  /**
   * Fetch team statistics
   */
  private async fetchTeamStats(teamId: number): Promise<any> {
    try {
      const response = await fetch(`https://api-football-v1.p.rapidapi.com/v3/teams/statistics?team=${teamId}&league=39&season=2024`, {
        headers: {
          'X-RapidAPI-Key': this.rapidApiKey,
          'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
        }
      })

      if (!response.ok) return null
      const data = await response.json() as any
      return data.response?.[0]?.statistics || null
    } catch (error) {
      return null
    }
  }

  /**
   * Fetch head-to-head data
   */
  private async fetchHeadToHead(team1Id: number, team2Id: number): Promise<any> {
    try {
      const response = await fetch(`https://api-football-v1.p.rapidapi.com/v3/fixtures/headtohead?h2h=${team1Id}-${team2Id}&last=5`, {
        headers: {
          'X-RapidAPI-Key': this.rapidApiKey,
          'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
        }
      })

      if (!response.ok) return null
      const data = await response.json() as any
      return data.response || []
    } catch (error) {
      return null
    }
  }

  /**
   * Fetch team recent form
   */
  private async fetchTeamForm(teamId: number): Promise<any> {
    try {
      const response = await fetch(`https://api-football-v1.p.rapidapi.com/v3/fixtures?team=${teamId}&last=5`, {
        headers: {
          'X-RapidAPI-Key': this.rapidApiKey,
          'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
        }
      })

      if (!response.ok) return null
      const data = await response.json() as any
      return data.response || []
    } catch (error) {
      return null
    }
  }

  /**
   * Fetch odds data from Odds API
   */
  private async fetchOddsData(matchId: string): Promise<any> {
    try {
      if (!this.oddsApiKey) {
        logger.warn('Odds API key not configured', {
          tags: ['match-blog-generator', 'odds-api'],
          data: { matchId }
        })
        return null
      }

      // The Odds API doesn't support matchId directly, we need to search by teams
      // For now, we'll return null and handle this differently
      // You might want to implement team name search instead
      logger.info('Odds API matchId search not supported, skipping', {
        tags: ['match-blog-generator', 'odds-api'],
        data: { matchId }
      })
      
      return null
    } catch (error) {
      logger.warn('Failed to fetch Odds API data', {
        tags: ['match-blog-generator', 'odds-api'],
        data: { matchId, error: error instanceof Error ? error.message : 'Unknown error' }
      })
      return null
    }
  }

  /**
   * Generate blog post content for a match
   */
  async generateMatchBlog(match: QuickPurchaseMatch): Promise<MatchBlogData> {
    try {
      const enrichedMatch = await this.enrichMatchData(match)
      
      // Extract match information
      const matchData = enrichedMatch.matchData || {}
      const predictionData = enrichedMatch.predictionData || {}
      
      // Generate title using OpenAI if available
      const title = this.openaiApiKey 
        ? await this.generateTitleWithOpenAI(match, predictionData)
        : this.generateTitle(match, predictionData)
      
      // Generate excerpt using OpenAI if available
      const excerpt = this.openaiApiKey
        ? await this.generateExcerptWithOpenAI(match, predictionData)
        : this.generateExcerpt(match, predictionData)
      
      // Generate content using OpenAI if available
      const content = this.openaiApiKey
        ? await this.generateContentWithOpenAI(match, enrichedMatch)
        : this.generateContent(match, enrichedMatch)
      
      // Generate SEO data
      const seoData = this.generateSEOData(match, predictionData)
      
      // Generate slug
      const slug = this.generateSlug(title)
      
      // Extract match info from prediction data
      const matchInfo = predictionData?.prediction?.match_info || {}
      const rapidApiData = enrichedMatch.rapidApi || {}

      const blogData: MatchBlogData = {
        title,
        slug,
        excerpt,
        content,
        author: 'SnapBet AI Team',
        category: 'upcoming-matches',
        tags: this.generateTags(match, predictionData),
        geoTarget: ['worldwide'],
        featured: false,
        readTime: this.calculateReadTime(content),
        seoTitle: seoData.seoTitle,
        seoDescription: seoData.seoDescription,
        seoKeywords: seoData.seoKeywords,
        isPublished: true,
        sourceUrl: undefined,
        aiGenerated: true,
        matchId: matchInfo.match_id || match.matchId || undefined,
        odds: match.odds ? Number(match.odds) : undefined,
        league: rapidApiData.fixture?.league || predictionData?.league || predictionData?.competition,
        matchDate: matchInfo.date ? new Date(matchInfo.date) : undefined
      }

      logger.info('Generated match blog data', {
        tags: ['match-blog-generator', 'blog-generation'],
        data: { 
          matchId: match.id, 
          title: blogData.title,
          readTime: blogData.readTime 
        }
      })

      return blogData
    } catch (error) {
      logger.error('Failed to generate match blog', {
        tags: ['match-blog-generator', 'blog-generation', 'error'],
        data: { matchId: match.id, error: error instanceof Error ? error.message : 'Unknown error' }
      })
      throw error
    }
  }

  /**
   * Generate an engaging title for the match
   */
  private generateTitle(match: QuickPurchaseMatch, predictionData: any): string {
    // Extract team names from the match name (e.g., "Operario-PR vs Coritiba")
    const teamNames = this.extractTeamNames(match.name)
    const homeTeam = teamNames.homeTeam
    const awayTeam = teamNames.awayTeam
    const league = predictionData?.league || predictionData?.competition || 'Football'
    
    // Create an exciting title without revealing predictions
    const titleTemplates = [
      `${homeTeam} vs ${awayTeam}: ${league} Showdown Preview`,
      `${league} Clash: ${homeTeam} Hosts ${awayTeam}`,
      `${homeTeam} vs ${awayTeam}: What to Expect`,
      `${league} Preview: ${homeTeam} vs ${awayTeam}`,
      `${homeTeam} vs ${awayTeam}: Match Analysis & Insights`
    ]
    
    return titleTemplates[Math.floor(Math.random() * titleTemplates.length)]
  }

  /**
   * Extract team names from match name (e.g., "Operario-PR vs Coritiba")
   */
  private extractTeamNames(matchName: string): { homeTeam: string; awayTeam: string } {
    const vsPattern = /\s+vs\s+/i
    const dashPattern = /\s*-\s*/
    
    if (vsPattern.test(matchName)) {
      const [homeTeam, awayTeam] = matchName.split(/\s+vs\s+/i)
      return { homeTeam: homeTeam.trim(), awayTeam: awayTeam.trim() }
    } else if (dashPattern.test(matchName)) {
      const [homeTeam, awayTeam] = matchName.split(/\s*-\s*/)
      return { homeTeam: homeTeam.trim(), awayTeam: awayTeam.trim() }
    }
    
    // Fallback: try to extract from description
    const description = matchName.toLowerCase()
    if (description.includes('vs')) {
      const [homeTeam, awayTeam] = description.split('vs')
      return { homeTeam: homeTeam.trim(), awayTeam: awayTeam.trim() }
    }
    
    return { homeTeam: 'Home Team', awayTeam: 'Away Team' }
  }

  /**
   * Generate title using OpenAI
   */
  private async generateTitleWithOpenAI(match: QuickPurchaseMatch, predictionData: any): Promise<string> {
    try {
      // Extract team names from the match name
      const teamNames = this.extractTeamNames(match.name)
      const homeTeam = teamNames.homeTeam
      const awayTeam = teamNames.awayTeam
      const league = predictionData?.league || predictionData?.competition || 'Football'
      
      const prompt = `Generate an engaging, SEO-optimized title for a football match preview blog post. 
      
      Match: ${homeTeam} vs ${awayTeam}
      League: ${league}
      
      Requirements:
      - Must be exciting and engaging
      - Should NOT reveal any predictions or betting advice
      - Should tease the match to encourage readers to learn more
      - Include team names and league
      - Keep it under 60 characters
      - Make it sound professional and sports-focused
      
      Generate only the title, nothing else:`

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 50,
          temperature: 0.7
        })
      })

      if (!response.ok) {
        throw new Error(`OpenAI API request failed: ${response.status}`)
      }

      const data = await response.json() as any
      const generatedTitle = data.choices[0]?.message?.content?.trim()
      
      if (generatedTitle) {
        return generatedTitle
      }
      
      // Fallback to template if OpenAI fails
      return this.generateTitle(match, predictionData)
    } catch (error) {
      logger.warn('Failed to generate title with OpenAI, falling back to template', {
        tags: ['match-blog-generator', 'openai', 'title'],
        data: { matchId: match.id, error: error instanceof Error ? error.message : 'Unknown error' }
      })
      return this.generateTitle(match, predictionData)
    }
  }

  /**
   * Generate an excerpt for the match
   */
  private generateExcerpt(match: QuickPurchaseMatch, predictionData: any): string {
    // Extract team names from the match name
    const teamNames = this.extractTeamNames(match.name)
    const homeTeam = teamNames.homeTeam
    const awayTeam = teamNames.awayTeam
    const league = predictionData?.league || predictionData?.competition || 'Football'
    
    return `Get ready for an exciting ${league} clash as ${homeTeam} takes on ${awayTeam}. Discover the latest team news, form analysis, and what makes this match worth watching. Don't miss out on the action!`
  }

  /**
   * Generate excerpt using OpenAI
   */
  private async generateExcerptWithOpenAI(match: QuickPurchaseMatch, predictionData: any): Promise<string> {
    try {
      // Extract team names from the match name
      const teamNames = this.extractTeamNames(match.name)
      const homeTeam = teamNames.homeTeam
      const awayTeam = teamNames.awayTeam
      const league = predictionData?.league || predictionData?.competition || 'Football'
      
      const prompt = `Generate an engaging excerpt for a football match preview blog post.
      
      Match: ${homeTeam} vs ${awayTeam}
      League: ${league}
      
      Requirements:
      - Must be exciting and engaging
      - Should NOT reveal any predictions or betting advice
      - Should tease the match to encourage readers to learn more
      - Keep it under 200 characters
      - Make it sound professional and sports-focused
      - Include team names and league
      
      Generate only the excerpt, nothing else:`

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 100,
          temperature: 0.7
        })
      })

      if (!response.ok) {
        throw new Error(`OpenAI API request failed: ${response.status}`)
      }

      const data = await response.json() as any
      const generatedExcerpt = data.choices[0]?.message?.content?.trim()
      
      if (generatedExcerpt) {
        return generatedExcerpt
      }
      
      // Fallback to template if OpenAI fails
      return this.generateExcerpt(match, predictionData)
    } catch (error) {
      logger.warn('Failed to generate excerpt with OpenAI, falling back to template', {
        tags: ['match-blog-generator', 'openai', 'excerpt'],
        data: { matchId: match.id, error: error instanceof Error ? error.message : 'Unknown error' }
      })
      return this.generateExcerpt(match, predictionData)
    }
  }

  /**
   * Generate the main content for the blog post
   */
  private generateContent(match: QuickPurchaseMatch, enrichedMatch: any): string {
    const predictionData = enrichedMatch.predictionData || {}
    const rapidApiData = enrichedMatch.rapidApi || {}
    
    // Extract team names from the match name
    const teamNames = this.extractTeamNames(match.name)
    const homeTeam = teamNames.homeTeam
    const awayTeam = teamNames.awayTeam
    
    // Get match details from prediction data
    const matchInfo = predictionData?.prediction?.match_info || {}
    const venue = matchInfo.venue || rapidApiData.fixture?.venue || 'TBD'
    const date = matchInfo.date ? new Date(matchInfo.date).toLocaleDateString() : 'TBD'
    const league = rapidApiData.fixture?.league || 'Football'
    
    let content = `<h2>Match Overview</h2>`
    content += `<p>Welcome to our comprehensive preview of the upcoming ${league} clash between ${homeTeam} and ${awayTeam}. This highly anticipated match promises to deliver excitement and drama for football fans worldwide.</p>`
    
    content += `<h3>Match Details</h3>`
    content += `<ul>`
    content += `<li><strong>Home Team:</strong> ${homeTeam}</li>`
    content += `<li><strong>Away Team:</strong> ${awayTeam}</li>`
    content += `<li><strong>League:</strong> ${league}</li>`
    content += `<li><strong>Venue:</strong> ${venue}</li>`
    content += `<li><strong>Date:</strong> ${date}</li>`
    content += `</ul>`
    
    // Add team analysis if available
    if (rapidApiData.teams) {
      content += this.generateTeamAnalysis(rapidApiData)
    }
    
    // Add head-to-head analysis if available
    if (rapidApiData.headToHead && rapidApiData.headToHead.length > 0) {
      content += this.generateHeadToHeadAnalysis(rapidApiData.headToHead, homeTeam, awayTeam)
    }
    
    // Add odds information if available (without revealing predictions)
    if (enrichedMatch.oddsApi || match.odds) {
      content += this.generateOddsSection(enrichedMatch.oddsApi, match.odds)
    }
    
    // Add match significance
    content += `<h3>Match Significance</h3>`
    content += `<p>This fixture represents more than just another game - it's a battle of tactics, skill, and determination. Both teams will be looking to secure crucial points and make their mark in the ${league}.</p>`
    
    content += `<h3>Conclusion</h3>`
    content += `<p>As we approach kickoff, this match promises to be a fascinating encounter between two competitive sides. Stay tuned for more updates and analysis as we get closer to the action.</p>`
    
    return content
  }

    /**
   * Generate content using OpenAI
   */
  private async generateContentWithOpenAI(match: QuickPurchaseMatch, enrichedMatch: any): Promise<string> {
    try {
      const predictionData = enrichedMatch.predictionData || {}
      const rapidApiData = enrichedMatch.rapidApi || {}
      
      // Extract team names from the match name
      const teamNames = this.extractTeamNames(match.name)
      const homeTeam = teamNames.homeTeam
      const awayTeam = teamNames.awayTeam
      
      // Get match details from prediction data
      const matchInfo = predictionData?.prediction?.match_info || {}
      const venue = matchInfo.venue || rapidApiData.fixture?.venue || 'TBD'
      const date = matchInfo.date ? new Date(matchInfo.date).toLocaleDateString() : 'TBD'
      const league = rapidApiData.fixture?.league || 'Football'
      
      // Get team statistics and form
      const homeTeamStats = rapidApiData.teams?.home || {}
      const awayTeamStats = rapidApiData.teams?.away || {}
      const h2hData = rapidApiData.headToHead || []
      
      const prompt = `Write a comprehensive football match preview blog post for ${homeTeam} vs ${awayTeam} in ${league}.
      
      Match Details:
      - Home Team: ${homeTeam}
      - Away Team: ${awayTeam}
      - League: ${league}
      - Venue: ${venue}
      - Date: ${date}
      
      Team Statistics Available:
      - Home Team Stats: ${JSON.stringify(homeTeamStats)}
      - Away Team Stats: ${JSON.stringify(awayTeamStats)}
      - Head-to-Head: ${h2hData.length} recent meetings
      
      Requirements:
      - Write in HTML format with proper h2, h3, p, ul, li tags
      - Create a professional sports journalism article
      - Include sections: Match Overview, Team Analysis, Head-to-Head Record, Key Factors, Match Prediction
      - Use the team statistics and form data to provide insights
      - Analyze recent performance and form
      - Discuss tactical considerations and key players
      - Keep it around 500-600 words
      - Make it informative and engaging for football fans
      - Do NOT include betting advice or predictions
      - End with a professional conclusion about the match's significance
      
      Generate only the HTML content, nothing else:`
    
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1000,
          temperature: 0.7
        })
      })
    
      if (!response.ok) {
        throw new Error(`OpenAI API request failed: ${response.status}`)
      }
    
      const data = await response.json() as any
      const generatedContent = data.choices[0]?.message?.content?.trim()
      
      if (generatedContent) {
        return generatedContent
      }
      
      // Fallback to template if OpenAI fails
      return this.generateContent(match, enrichedMatch)
    } catch (error) {
      logger.warn('Failed to generate content with OpenAI, falling back to template', {
        tags: ['match-blog-generator', 'openai', 'content'],
        data: { matchId: match.id, error: error instanceof Error ? error.message : 'Unknown error' }
      })
      return this.generateContent(match, enrichedMatch)
    }
  }

  /**
   * Generate team analysis section
   */
  private generateTeamAnalysis(rapidApiData: any): string {
    let content = `<h3>Team Analysis</h3>`
    
    if (rapidApiData.teams?.home) {
      const homeTeam = rapidApiData.teams.home
      content += `<h4>${rapidApiData.fixture?.homeTeam || 'Home Team'}</h4>`
      if (homeTeam.form && homeTeam.form.length > 0) {
        content += `<p><strong>Recent Form:</strong> `
        const formResults = homeTeam.form.slice(0, 5).map((match: any) => {
          const isHome = match.teams?.home?.id === match.fixture?.venue?.id
          const teamScore = isHome ? match.goals?.home : match.goals?.away
          const opponentScore = isHome ? match.goals?.away : match.goals?.home
          if (teamScore > opponentScore) return 'W'
          if (teamScore < opponentScore) return 'L'
          return 'D'
        }).join(' ')
        content += `${formResults}</p>`
      }
      if (homeTeam.statistics) {
        content += `<p><strong>Season Performance:</strong> Strong showing with solid defensive record and attacking prowess.</p>`
      }
    }
    
    if (rapidApiData.teams?.away) {
      const awayTeam = rapidApiData.teams.away
      content += `<h4>${rapidApiData.fixture?.awayTeam || 'Away Team'}</h4>`
      if (awayTeam.form && awayTeam.form.length > 0) {
        content += `<p><strong>Recent Form:</strong> `
        const formResults = awayTeam.form.slice(0, 5).map((match: any) => {
          const isHome = match.teams?.home?.id === match.fixture?.venue?.id
          const teamScore = isHome ? match.goals?.home : match.goals?.away
          const opponentScore = isHome ? match.goals?.away : match.goals?.home
          if (teamScore > opponentScore) return 'W'
          if (teamScore < opponentScore) return 'L'
          return 'D'
        }).join(' ')
        content += `${formResults}</p>`
      }
      if (awayTeam.statistics) {
        content += `<p><strong>Season Performance:</strong> Competitive away form with tactical flexibility.</p>`
      }
    }
    
    return content
  }

  /**
   * Generate head-to-head analysis section
   */
  private generateHeadToHeadAnalysis(h2hData: any[], homeTeam: string, awayTeam: string): string {
    let content = `<h3>Head-to-Head Record</h3>`
    
    if (h2hData.length > 0) {
      content += `<p>Recent meetings between ${homeTeam} and ${awayTeam} have provided some memorable encounters:</p>`
      content += `<ul>`
      
      // Show last 3 meetings
      h2hData.slice(0, 3).forEach((match: any) => {
        const homeTeamName = match.teams?.home?.name || 'Home Team'
        const awayTeamName = match.teams?.away?.name || 'Away Team'
        const homeScore = match.goals?.home || 0
        const awayScore = match.goals?.away || 0
        const date = match.fixture?.date ? new Date(match.fixture.date).toLocaleDateString() : 'Unknown Date'
        
        content += `<li><strong>${date}:</strong> ${homeTeamName} ${homeScore} - ${awayScore} ${awayTeamName}</li>`
      })
      
      content += `</ul>`
      content += `<p>These results suggest a competitive rivalry with both teams capable of securing victories.</p>`
    } else {
      content += `<p>Limited head-to-head data available, but both teams are known for their competitive spirit.</p>`
    }
    
    return content
  }

  /**
   * Generate odds section (without revealing predictions)
   */
  private generateOddsSection(oddsApiData: any, matchOdds: number | null): string {
    let content = `<h3>Match Odds & Markets</h3>`
    content += `<p>This match offers exciting betting opportunities across various markets. Our odds analysis team monitors the latest movements and identifies the best value bets for football enthusiasts.</p>`
    
    if (oddsApiData) {
      content += `<p><em>Current odds are being updated in real-time. Check our platform for the latest market movements and expert analysis.</em></p>`
    }
    
    content += `<p><strong>Remember:</strong> Betting should always be done responsibly and within your means. Our platform provides tools and resources to help you make informed decisions.</p>`
    
    return content
  }

  /**
   * Generate SEO data
   */
  private generateSEOData(match: QuickPurchaseMatch, predictionData: any): { seoTitle: string; seoDescription: string; seoKeywords: string[] } {
    // Extract team names from the match name
    const teamNames = this.extractTeamNames(match.name)
    const homeTeam = teamNames.homeTeam
    const awayTeam = teamNames.awayTeam
    const league = predictionData?.league || predictionData?.competition || 'Football'
    
    const seoTitle = `${homeTeam} vs ${awayTeam} - ${league} Match Preview & Analysis | SnapBet AI`
    const seoDescription = `Get the latest ${homeTeam} vs ${awayTeam} match preview, team analysis, and expert insights. Don't miss this exciting ${league} clash!`
    const seoKeywords = [
      `${homeTeam}`,
      `${awayTeam}`,
      `${league}`,
      'football',
      'match preview',
      'team analysis',
      'sports betting',
      'football predictions',
      'match odds',
      'soccer analysis'
    ]
    
    return { seoTitle, seoDescription, seoKeywords }
  }

  /**
   * Generate tags for the blog post
   */
  private generateTags(match: QuickPurchaseMatch, predictionData: any): string[] {
    const tags = ['upcoming-matches', 'football', 'sports']
    
    // Extract team names from the match name
    const teamNames = this.extractTeamNames(match.name)
    
    if (predictionData?.league) tags.push(predictionData.league.toLowerCase())
    if (teamNames.homeTeam) tags.push(teamNames.homeTeam.toLowerCase())
    if (teamNames.awayTeam) tags.push(teamNames.awayTeam.toLowerCase())
    if (match.type) tags.push(match.type)
    
    return tags
  }

  /**
   * Generate URL slug from title
   */
  private generateSlug(title: string): string {
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/\-+/g, '-')
      .trim()
    
    // Add timestamp to ensure uniqueness
    const timestamp = Date.now().toString(36) // Convert to base36 for shorter string
    return `${baseSlug}-${timestamp}`
  }

  /**
   * Calculate estimated read time
   */
  private calculateReadTime(content: string): number {
    const wordsPerMinute = 200
    const wordCount = content.split(/\s+/).length
    return Math.ceil(wordCount / wordsPerMinute)
  }

  /**
   * Save generated blog post to database
   */
  async saveBlogPost(blogData: MatchBlogData): Promise<string> {
    try {
      const blogPost = await prisma.blogPost.create({
        data: {
          title: blogData.title,
          slug: blogData.slug,
          excerpt: blogData.excerpt,
          content: blogData.content,
          author: blogData.author,
          category: blogData.category,
          tags: blogData.tags,
          geoTarget: blogData.geoTarget,
          featured: blogData.featured,
          readTime: blogData.readTime,
          seoTitle: blogData.seoTitle,
          seoDescription: blogData.seoDescription,
          seoKeywords: blogData.seoKeywords,
          isPublished: blogData.isPublished,
          sourceUrl: blogData.sourceUrl,
          aiGenerated: blogData.aiGenerated
        }
      })

      logger.info('Blog post saved successfully', {
        tags: ['match-blog-generator', 'blog-save'],
        data: { 
          blogId: blogPost.id, 
          title: blogData.title,
          slug: blogData.slug 
        }
      })

      return blogPost.id
    } catch (error) {
      logger.error('Failed to save blog post', {
        tags: ['match-blog-generator', 'blog-save', 'error'],
        data: { 
          title: blogData.title, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }
      })
      throw error
    }
  }

  /**
   * Generate and save blog posts for multiple matches
   */
  async generateAndSaveMatchBlogs(): Promise<{ success: number; failed: number; total: number }> {
    try {
      const matches = await this.getUpcomingMatches()
      let success = 0
      let failed = 0

      logger.info('Starting batch blog generation for matches', {
        tags: ['match-blog-generator', 'batch-generation'],
        data: { totalMatches: matches.length }
      })

      for (const match of matches) {
        try {
          const blogData = await this.generateMatchBlog(match)
          await this.saveBlogPost(blogData)
          success++
          
          logger.info('Successfully generated blog for match', {
            tags: ['match-blog-generator', 'blog-generation'],
            data: { matchId: match.id, blogTitle: blogData.title }
          })
        } catch (error) {
          failed++
          logger.error('Failed to generate blog for match', {
            tags: ['match-blog-generator', 'blog-generation', 'error'],
            data: { 
              matchId: match.id, 
              error: error instanceof Error ? error.message : 'Unknown error' 
            }
          })
        }
      }

      const result = { success, failed, total: matches.length }
      
      logger.info('Batch blog generation completed', {
        tags: ['match-blog-generator', 'batch-generation', 'completion'],
        data: result
      })

      return result
    } catch (error) {
      logger.error('Failed to complete batch blog generation', {
        tags: ['match-blog-generator', 'batch-generation', 'error'],
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      })
      throw error
    }
  }
}

export const matchBlogGeneratorService = new MatchBlogGeneratorService()
