import prisma from '@/lib/db'
import { Prisma } from '@prisma/client'
import { apiFootballService } from '@/lib/services/api-football.service'

export interface QuickPurchaseLite {
  id: string
  name: string
  description: string | null
  matchId: string | null
  confidenceScore: number | null
  valueRating: string | null
  analysisSummary: string | null
  createdAt: Date
  matchData: any
  predictionData: any
}

export interface GeneratedBlogDraft {
  title: string
  excerpt: string
  contentHtml: string
  tags: string[]
  readTimeMinutes: number
}

export interface MarketMatchWithQP {
  id: string
  matchId: string
  status: string
  homeTeam: string
  awayTeam: string
  league: string
  kickoffDate: Date
  consensusOdds?: { home: number; draw: number; away: number } | null
  quickPurchases: QuickPurchaseLite[]
  blogPosts?: {
    id: string
    title: string
    isPublished: boolean
  }[]
}

/**
 * Template-only blog generator for QuickPurchase predictions
 * Creates simple HTML previews without AI generation
 */
export class TemplateBlogGenerator {
  /**
   * Get eligible MarketMatch records for blog generation
   * Sources from MarketMatch table and uses QuickPurchase data for content
   * Includes matches without blogs (for generation) but also returns blog status
   */
  static async getEligibleMarketMatches(includeWithBlogs: boolean = false): Promise<MarketMatchWithQP[]> {
    console.log('[TemplateBlog] Fetching eligible MarketMatches...')
    
    const whereClause: any = {
      status: 'UPCOMING',
      isActive: true,
    }
    
    // Only exclude matches with blogs if we don't want to include them
    if (!includeWithBlogs) {
      whereClause.blogPosts = {
        none: {
          isActive: true
        }
      }
    }
    
    console.log('[TemplateBlog] Query where clause:', JSON.stringify(whereClause, null, 2))
    
    // First, let's check basic counts for debugging
    const totalMarketMatches = await prisma.marketMatch.count({
      where: {
        status: 'UPCOMING',
        isActive: true,
      }
    })
    console.log(`[TemplateBlog] Total UPCOMING MarketMatches: ${totalMarketMatches}`)
    
    // Fetch MarketMatch records first (including odds data)
    const matches = await prisma.marketMatch.findMany({
      where: whereClause,
      select: {
        id: true,
        matchId: true,
        status: true,
        homeTeam: true,
        awayTeam: true,
        league: true,
        kickoffDate: true,
        consensusOdds: true,
        blogPosts: {
          where: { isActive: true },
          select: {
            id: true,
            title: true,
            isPublished: true,
          },
          take: 1
        }
      },
      orderBy: { kickoffDate: 'asc' },
      take: 50 // Limit results
    })

    console.log(`[TemplateBlog] Found ${matches.length} MarketMatch records`)
    
    if (matches.length === 0) {
      console.log('[TemplateBlog] No MarketMatch records found, returning empty array')
      return []
    }

    // Extract matchIds from MarketMatch records
    const matchIds = matches.map(m => m.matchId).filter(Boolean) as string[]
    console.log(`[TemplateBlog] Looking for QuickPurchases with matchIds: ${matchIds.length} matchIds`)
    console.log(`[TemplateBlog] Sample matchIds: ${matchIds.slice(0, 5).join(', ')}`)
    
    if (matchIds.length === 0) {
      console.warn('[TemplateBlog] WARNING: No matchIds extracted from MarketMatch records!')
      console.log('[TemplateBlog] Sample MarketMatch records:', matches.slice(0, 3).map(m => ({
        id: m.id,
        matchId: m.matchId,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam
      })))
      return []
    }
    
    // Fetch QuickPurchase records by matching matchId (external API ID)
    // Since marketMatchId relation might not be populated, we match by matchId string
    // No confidence threshold - create blogs for all matches with data
    const quickPurchases = await prisma.quickPurchase.findMany({
      where: {
        matchId: { in: matchIds },
        isActive: true,
        isPredictionActive: true,
        predictionData: { not: Prisma.JsonNull }
      },
      select: {
        id: true,
        name: true,
        description: true,
        matchId: true,
        confidenceScore: true,
        valueRating: true,
        analysisSummary: true,
        createdAt: true,
        matchData: true,
        predictionData: true,
      },
      orderBy: { confidenceScore: 'desc' }
    })

    console.log(`[TemplateBlog] Found ${quickPurchases.length} eligible QuickPurchase records`)
    
    if (quickPurchases.length === 0) {
      console.warn('[TemplateBlog] WARNING: No QuickPurchase records found!')
      console.log('[TemplateBlog] Checking QuickPurchase counts with different filters...')
      
      // Debug: Check QuickPurchase records without strict filters
      const allQPs = await prisma.quickPurchase.count({
        where: { matchId: { in: matchIds }, isActive: true }
      })
      console.log(`[TemplateBlog] QuickPurchases with matchId match and isActive: ${allQPs}`)
      
      const withPredictionActive = await prisma.quickPurchase.count({
        where: { 
          matchId: { in: matchIds }, 
          isActive: true,
          isPredictionActive: true
        }
      })
      console.log(`[TemplateBlog] QuickPurchases + isPredictionActive: ${withPredictionActive}`)
      
      const withPredictionData = await prisma.quickPurchase.count({
        where: { 
          matchId: { in: matchIds }, 
          isActive: true,
          isPredictionActive: true,
          predictionData: { not: Prisma.JsonNull }
        }
      })
      console.log(`[TemplateBlog] QuickPurchases + predictionData not null: ${withPredictionData}`)
      
      return []
    }
    
    console.log(`[TemplateBlog] Sample QuickPurchase matchIds: ${quickPurchases.slice(0, 5).map(qp => qp.matchId).join(', ')}`)
    
    // Group QuickPurchases by matchId
    const quickPurchasesByMatchId = new Map<string, typeof quickPurchases>()
    for (const qp of quickPurchases) {
      if (qp.matchId) {
        if (!quickPurchasesByMatchId.has(qp.matchId)) {
          quickPurchasesByMatchId.set(qp.matchId, [])
        }
        quickPurchasesByMatchId.get(qp.matchId)!.push(qp)
      }
    }
    
    console.log(`[TemplateBlog] Grouped QuickPurchases by matchId: ${quickPurchasesByMatchId.size} unique matchIds`)
    console.log(`[TemplateBlog] MatchIds with QuickPurchases: ${Array.from(quickPurchasesByMatchId.keys()).slice(0, 5).join(', ')}`)

    // Combine MarketMatch with QuickPurchases
    const filtered = matches
      .filter(m => {
        const qps = quickPurchasesByMatchId.get(m.matchId)
        const hasQP = qps && qps.length > 0
        if (!hasQP) {
          console.log(`[TemplateBlog] Filtering out match ${m.matchId} (${m.homeTeam} vs ${m.awayTeam}) - no QuickPurchase found`)
        }
        return hasQP
      })
      .map(m => {
        const qps = quickPurchasesByMatchId.get(m.matchId) || []
        // Get the first (highest confidence) QuickPurchase
        const qp = qps[0]
        
        return {
          id: m.id,
          matchId: m.matchId,
          status: m.status,
          homeTeam: m.homeTeam,
          awayTeam: m.awayTeam,
          league: m.league,
          kickoffDate: m.kickoffDate,
          consensusOdds: m.consensusOdds as { home: number; draw: number; away: number } | null,
          quickPurchases: [qp].map(q => ({
            id: q.id,
            name: q.name,
            description: q.description,
            matchId: q.matchId,
            confidenceScore: q.confidenceScore,
            valueRating: q.valueRating,
            analysisSummary: q.analysisSummary,
            createdAt: q.createdAt,
            matchData: q.matchData,
            predictionData: q.predictionData,
          })),
          blogPosts: m.blogPosts.map(bp => ({
            id: bp.id,
            title: bp.title,
            isPublished: bp.isPublished,
          }))
        }
      })
    
    console.log(`[TemplateBlog] After filtering: ${matches.length} MarketMatches -> ${filtered.length} with QuickPurchase data`)
    
    if (filtered.length === 0 && matches.length > 0) {
      console.warn('[TemplateBlog] WARNING: All MarketMatches filtered out!')
      console.log('[TemplateBlog] MarketMatch matchIds:', matches.map(m => m.matchId).join(', '))
      console.log('[TemplateBlog] QuickPurchase matchIds:', Array.from(quickPurchasesByMatchId.keys()).join(', '))
    }
    
    console.log(`[TemplateBlog] Returning ${filtered.length} eligible matches`)
    return filtered
  }

  /**
   * Get eligible QuickPurchase matches for blog generation
   * @deprecated Use getEligibleMarketMatches() instead
   */
  static async getEligibleQuickPurchases(): Promise<QuickPurchaseLite[]> {
    const rows = await prisma.quickPurchase.findMany({
      where: {
        isActive: true,
        isPredictionActive: true,
        confidenceScore: { gte: 60 },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        matchId: true,
        confidenceScore: true,
        valueRating: true,
        analysisSummary: true,
        createdAt: true,
        matchData: true,
        predictionData: true,
      },
    })
    
    // Filter out rows where predictionData is null
    return rows.filter(row => row.predictionData !== null) as QuickPurchaseLite[]
  }

  /**
   * Generate a template-only blog draft from QuickPurchase and MarketMatch
   */
  static generateTemplateOnlyDraft(qp: QuickPurchaseLite, marketMatch?: MarketMatchWithQP): GeneratedBlogDraft {
    // Extract team names from matchData or name
    const teamNames = this.extractTeamNames(qp)
    const title = this.generateTitle(qp, teamNames)
    const excerpt = this.generateExcerpt(qp, teamNames)
    const contentHtml = this.generateContentHtml(qp, teamNames, marketMatch)
    const tags = this.generateTags(qp)
    const readTimeMinutes = Math.max(1, Math.ceil(contentHtml.length / 900))

    return {
      title,
      excerpt,
      contentHtml,
      tags,
      readTimeMinutes,
    }
  }

  /**
   * Extract team names from match data
   */
  private static extractTeamNames(qp: QuickPurchaseLite): { homeTeam: string; awayTeam: string } {
    // Try to extract from predictionData first
    const predictionInfo = qp.predictionData?.prediction?.match_info || {}
    const matchInfo = qp.matchData || {}
    
    let homeTeam = 'Home Team'
    let awayTeam = 'Away Team'

    // Try various data paths
    if (predictionInfo.homeTeamName) {
      homeTeam = predictionInfo.homeTeamName
    } else if (matchInfo.homeTeam) {
      homeTeam = typeof matchInfo.homeTeam === 'string' ? matchInfo.homeTeam : matchInfo.homeTeam.name
    }

    if (predictionInfo.awayTeamName) {
      awayTeam = predictionInfo.awayTeamName
    } else if (matchInfo.awayTeam) {
      awayTeam = typeof matchInfo.awayTeam === 'string' ? matchInfo.awayTeam : matchInfo.awayTeam.name
    }

    // Fallback to parsing the name field
    if (homeTeam === 'Home Team' && qp.name) {
      const nameParts = qp.name.split(' vs ')
      if (nameParts.length === 2) {
        homeTeam = nameParts[0].trim()
        awayTeam = nameParts[1].trim()
      }
    }

    return { homeTeam, awayTeam }
  }

  /**
   * Generate SEO-optimized blog title
   * Format: "Team1 vs Team2 Prediction, Odds & AI Match Analysis"
   */
  private static generateTitle(qp: QuickPurchaseLite, teams: { homeTeam: string; awayTeam: string }): string {
    return `${teams.homeTeam} vs ${teams.awayTeam} Prediction, Odds & AI Match Analysis`
  }

  /**
   * Generate excerpt
   */
  private static generateExcerpt(qp: QuickPurchaseLite, teams: { homeTeam: string; awayTeam: string }): string {
    if (qp.analysisSummary) {
      return this.sanitize(qp.analysisSummary)
    }
    
    // Extract confidence from predictionData.predictions.confidence (same as main content)
    let confidence = 0
    const predictionData = qp.predictionData as any
    const rawConfidence = predictionData?.predictions?.confidence
    
    if (rawConfidence !== undefined && rawConfidence !== null) {
      // If it's a decimal (0-1 range), convert to percentage
      if (typeof rawConfidence === 'number' && rawConfidence <= 1 && rawConfidence >= 0) {
        confidence = Math.round(rawConfidence * 100)
      } else if (typeof rawConfidence === 'number') {
        // Already a percentage
        confidence = Math.round(rawConfidence)
      } else if (typeof rawConfidence === 'string') {
        // Try to parse if it's a string
        const parsed = parseFloat(rawConfidence)
        if (!isNaN(parsed)) {
          confidence = parsed <= 1 ? Math.round(parsed * 100) : Math.round(parsed)
        }
      }
    } else {
      // Fallback to confidenceScore if predictions.confidence is not available
      confidence = qp.confidenceScore || 0
    }
    
    // Ensure confidence is within valid range (0-100)
    confidence = Math.max(0, Math.min(100, confidence))
    
    return `${teams.homeTeam} vs ${teams.awayTeam} – AI confidence ${confidence}%. Get the full analysis and prediction now.`
  }

  /**
   * Sanitize content to remove betting terms
   */
  private static sanitize(str: string = ''): string {
    const bannedTerms = /\b(bet|odds?|stake|under\s*\d+(\.\d+)?|over\s*\d+(\.\d+)?|accumulator|parlay|wager|bookmaker)\b/gi
    return str.replace(bannedTerms, '').replace(/\s{2,}/g, ' ').trim()
  }

  /**
   * Generate HTML content following the improved SnapBet template structure
   * Based on comprehensive SEO, credibility, conversion, and automation-readiness requirements
   */
  private static generateContentHtml(qp: QuickPurchaseLite, teams: { homeTeam: string; awayTeam: string }, marketMatch?: MarketMatchWithQP): string {
    console.log(`[TemplateBlog] Generating content for: ${qp.name}`)
    console.log(`[TemplateBlog] Teams:`, teams)
    console.log(`[TemplateBlog] Has predictionData:`, !!qp.predictionData)
    
    const predictionData = qp.predictionData as any
    
    if (!predictionData) {
      console.warn(`[TemplateBlog] No predictionData for ${qp.name}`)
      return `<p>Match preview for ${teams.homeTeam} vs ${teams.awayTeam}. No detailed prediction data available.</p>`
    }

    // Extract confidence from predictionData.predictions.confidence (same as match detail page)
    // This is the most accurate source according to user preference
    let confidence = 0
    const rawConfidence = predictionData.predictions?.confidence
    
    if (rawConfidence !== undefined && rawConfidence !== null) {
      // If it's a decimal (0-1 range), convert to percentage (same as match detail page)
      if (typeof rawConfidence === 'number' && rawConfidence <= 1 && rawConfidence >= 0) {
        confidence = Math.round(rawConfidence * 100)
      } else if (typeof rawConfidence === 'number') {
        // Already a percentage
        confidence = Math.round(rawConfidence)
      } else if (typeof rawConfidence === 'string') {
        // Try to parse if it's a string
        const parsed = parseFloat(rawConfidence)
        if (!isNaN(parsed)) {
          confidence = parsed <= 1 ? Math.round(parsed * 100) : Math.round(parsed)
        }
      }
    } else {
      // Fallback to confidenceScore if predictions.confidence is not available
      confidence = qp.confidenceScore || 0
      console.log(`[TemplateBlog] Using confidenceScore fallback: ${confidence}%`)
    }
    
    // Ensure confidence is within valid range (0-100)
    confidence = Math.max(0, Math.min(100, confidence))
    
    console.log(`[TemplateBlog] Confidence extracted: ${confidence}% (from predictions.confidence: ${rawConfidence})`)

    // Helper functions
    const truncate = (text: string, length: number) => text.length > length ? text.substring(0, length) + '...' : text
    const stripHtml = (html: string) => html.replace(/<[^>]*>?/gm, '')
    const join = (arr: string[] | undefined, separator: string) => arr ? arr.join(separator) : 'N/A'
    const formatDate = (date: Date | string) => {
      try {
        const d = typeof date === 'string' ? new Date(date) : date
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      } catch {
        return typeof date === 'string' ? date : 'TBD'
      }
    }
    const formatTime = (date: Date | string) => {
      try {
        const d = typeof date === 'string' ? new Date(date) : date
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false }) + ' UTC'
      } catch {
        return 'TBD'
      }
    }

    // Extract data with fallbacks - using the correct nested structure
    const analysis = predictionData.analysis || {}
    const comprehensiveAnalysis = predictionData.comprehensive_analysis || predictionData.prediction?.comprehensive_analysis || {}
    const aiVerdict = comprehensiveAnalysis.ai_verdict || {}
    const matchInfo = predictionData.match_info || predictionData.prediction?.match_info || {}
    const homeTeamAnalysis = analysis.team_analysis?.home_team || {}
    const awayTeamAnalysis = analysis.team_analysis?.away_team || {}
    const confidenceFactors = analysis.confidence_factors || []
    const riskFactors = predictionData.prediction_analysis?.risk_factors || analysis.risk_factors || []
    
    // Extract recommended outcome - try multiple paths
    let recommendedOutcome = aiVerdict.recommended_outcome || ''
    // Normalize outcome format (e.g., "home_win" -> "Home Win", "home win" -> "Home Win")
    if (recommendedOutcome) {
      recommendedOutcome = recommendedOutcome
        .split(/[_\s]/)
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
    }
    
    // Determine the team name for the recommended outcome
    let outcomeTeam = ''
    if (recommendedOutcome?.toLowerCase().includes('home')) {
      outcomeTeam = teams.homeTeam
    } else if (recommendedOutcome?.toLowerCase().includes('away')) {
      outcomeTeam = teams.awayTeam
    }
    
    // Get match date from MarketMatch or predictionData
    const kickoffDate = marketMatch?.kickoffDate || matchInfo.date || matchInfo.kickoff_at
    const formattedDate = kickoffDate ? formatDate(kickoffDate) : 'TBD'
    const formattedTime = kickoffDate ? formatTime(kickoffDate) : ''
    const dateDisplay = formattedTime !== 'TBD' ? `${formattedDate} • ${formattedTime}` : formattedDate
    
    // Extract odds data from MarketMatch
    const consensusOdds = marketMatch?.consensusOdds
    const modelProbability = confidence / 100 // Convert confidence % to probability (0-1)
    
    // Calculate implied probability from odds (if available)
    // NOTE: consensusOdds may be stored as either:
    // 1. Probabilities (0-1 range) - from novig_current API
    // 2. Decimal odds (>= 1.0) - converted probabilities
    // We detect the format and convert accordingly
    let impliedProbability: number | null = null
    if (consensusOdds && outcomeTeam === teams.homeTeam && consensusOdds.home) {
      const oddsValue = consensusOdds.home
      // If < 1.0, it's already a probability; if >= 1.0, it's decimal odds
      impliedProbability = oddsValue < 1.0 ? oddsValue : 1 / oddsValue
    } else if (consensusOdds && outcomeTeam === teams.awayTeam && consensusOdds.away) {
      const oddsValue = consensusOdds.away
      // If < 1.0, it's already a probability; if >= 1.0, it's decimal odds
      impliedProbability = oddsValue < 1.0 ? oddsValue : 1 / oddsValue
    }
    
    // Validate probability is within valid range (0-1)
    if (impliedProbability !== null && (impliedProbability <= 0 || impliedProbability >= 1)) {
      console.warn(`[TemplateBlog] Invalid implied probability: ${impliedProbability}, skipping market context`)
      impliedProbability = null
    }
    
    // SEO data - Updated to SEO-optimized format
    const seoTitle = `${teams.homeTeam} vs ${teams.awayTeam} Prediction, Odds & AI Match Analysis`
    const seoDescription = truncate(stripHtml(qp.description || qp.analysisSummary || ''), 150)
    const socialImage = 'https://yourdomain.com/og-default.jpg'
    const canonicalUrl = `https://yourdomain.com/matches/${qp.id || ''}`

    // Get one strong AI summary (avoid redundancy)
    const aiSummary = this.sanitize(qp.analysisSummary || analysis.ai_summary_clean || analysis.explanation || '')
    
    // Format confidence statement tied to specific outcome
    const confidenceStatement = outcomeTeam && recommendedOutcome
      ? `SnapBet AI assigns a <strong>${confidence}% win probability to ${outcomeTeam}</strong>, based on recent form, home dominance, and matchup context.`
      : `SnapBet AI assigns a <strong>${confidence}% confidence</strong> to this match analysis, based on recent form, matchup context, and historical data.`

    // Determine risk level and reasoning
    const riskLevel = confidence >= 75 ? 'Low' : confidence >= 60 ? 'Moderate' : 'High'
    const riskReasoning = riskLevel === 'Low' 
      ? 'historical matchup data and current form trends align strongly with the model\'s projection.'
      : riskLevel === 'Moderate'
      ? 'while historical data and form trends support the projection, some variability factors remain.'
      : 'multiple factors introduce variability, and the model suggests caution in interpreting this projection.'

    // Market context (compare model probability vs odds implied probability)
    // This section communicates: How does the market's implied probability (from odds) compare to our model's projection?
    // - If market probability < model: Market is less optimistic, suggesting our model sees value
    // - If market probability > model: Market is more optimistic, suggesting our model is more conservative
    // - This helps users understand where our model differs from market consensus
    let marketContextSection = ''
    if (impliedProbability !== null && outcomeTeam) {
      const marketProbabilityPercent = Math.round(impliedProbability * 100)
      const differencePercent = Math.abs(confidence - marketProbabilityPercent)
      
      // Only show market context if there's a meaningful difference (>5%)
      if (differencePercent >= 5) {
        const modelVsMarket = modelProbability > impliedProbability 
          ? `Market odds imply a ${marketProbabilityPercent}% probability for ${outcomeTeam}, which is lower than our model's ${confidence}% projection. This suggests our AI analysis sees stronger potential in this outcome compared to market consensus.`
          : `Market odds imply a ${marketProbabilityPercent}% probability for ${outcomeTeam}, which is higher than our model's ${confidence}% projection. This indicates the market is more optimistic than our conservative AI assessment.`
        
        marketContextSection = `
    <section>
      <h2>Market Context</h2>
      <p>${modelVsMarket}</p>
    </section>`
      }
    }

    const content = `<!doctype html>
<html lang="en">
<head>
  <title>${seoTitle}</title>
  <meta name="description" content="${seoDescription}" />
  <link rel="canonical" href="${canonicalUrl}" />

  <!-- Open Graph -->
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${seoTitle}" />
  <meta property="og:description" content="${seoDescription}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:image" content="${socialImage}" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${seoTitle}" />
  <meta name="twitter:description" content="${seoDescription}" />
  <meta name="twitter:image" content="${socialImage}" />

  <!-- SportsEvent JSON-LD -->
  <script type="application/ld+json">
  {
    "@context":"https://schema.org",
    "@type":"SportsEvent",
    "name":"${teams.homeTeam} vs ${teams.awayTeam}",
    "sport":"Soccer",
    "startDate":"${kickoffDate || ''}",
    "location":{
      "@type":"Place",
      "name":"${matchInfo.venue || 'TBD'}"
    },
    "competitor":[
      {"@type":"SportsTeam","name":"${teams.homeTeam}"},
      {"@type":"SportsTeam","name":"${teams.awayTeam}"}
    ],
    "eventAttendanceMode":"https://schema.org/OfflineEventAttendanceMode",
    "description":"${truncate(stripHtml(qp.description || qp.analysisSummary || ''), 180)}"
  }
  </script>
</head>
<body>

  <article class="match-preview">
    <header>
      <h1>${teams.homeTeam} vs ${teams.awayTeam} Prediction, Odds & AI Match Analysis</h1>
      
      <div class="match-metadata">
        <p><strong>League:</strong> ${matchInfo.league || marketMatch?.league || 'N/A'}</p>
        <p><strong>Venue:</strong> ${matchInfo.venue || 'TBD'}</p>
        <p><strong>Kickoff:</strong> ${dateDisplay}</p>
      </div>
    </header>

    <section>
      <h2>AI Match Analysis</h2>
      <p>${confidenceStatement}</p>
      ${aiSummary ? `<p>${aiSummary}</p>` : ''}
    </section>

    <section>
      <h2>Key Factors Driving the Prediction</h2>
      <ul>
        ${confidenceFactors.length > 0 
          ? confidenceFactors.map((factor: string) => `<li>${this.sanitize(factor)}</li>`).join('')
          : `<li>${teams.homeTeam} form and home advantage factors</li>
        <li>Recent head-to-head performance between the teams</li>
        <li>Team depth and injury impact on squad availability</li>
        <li>Current league position and motivation levels</li>`
        }
      </ul>
    </section>

    <section>
      <h2>Team Snapshots</h2>

      <h3>${teams.homeTeam}</h3>
      <p>${this.sanitize(homeTeamAnalysis.form_assessment || 'Excellent home form and strong recent performances.')}</p>
      <ul>
        ${homeTeamAnalysis.strengths && homeTeamAnalysis.strengths.length > 0 
          ? `<li><strong>Strengths:</strong> ${this.sanitize(join(homeTeamAnalysis.strengths, ", "))}</li>`
          : ''
        }
        ${homeTeamAnalysis.weaknesses && homeTeamAnalysis.weaknesses.length > 0
          ? `<li><strong>Weaknesses:</strong> ${this.sanitize(join(homeTeamAnalysis.weaknesses, ", "))}</li>`
          : ''
        }
        <li><strong>Injuries/Availability:</strong> ${this.sanitize(homeTeamAnalysis.injury_impact || 'No major injuries reported, squad depth favors strong selection options.')}</li>
      </ul>

      <h3>${teams.awayTeam}</h3>
      <p>${this.sanitize(awayTeamAnalysis.form_assessment || 'Solid recent form with key performances against strong opposition.')}</p>
      <ul>
        ${awayTeamAnalysis.strengths && awayTeamAnalysis.strengths.length > 0
          ? `<li><strong>Strengths:</strong> ${this.sanitize(join(awayTeamAnalysis.strengths, ", "))}</li>`
          : ''
        }
        ${awayTeamAnalysis.weaknesses && awayTeamAnalysis.weaknesses.length > 0
          ? `<li><strong>Weaknesses:</strong> ${this.sanitize(join(awayTeamAnalysis.weaknesses, ", "))}</li>`
          : ''
        }
        <li><strong>Injuries/Availability:</strong> ${this.sanitize(awayTeamAnalysis.injury_impact || 'No significant injury concerns reported, full squad available.')}</li>
      </ul>
    </section>
    ${marketContextSection}
    <section>
      <h2>Risk & Uncertainty</h2>
      <p><strong>Model Risk:</strong> ${riskLevel} — ${riskReasoning}</p>
      ${riskFactors.length > 0 
        ? `<ul>
          ${riskFactors.map((rf: string) => `<li>${this.sanitize(rf)}</li>`).join('')}
        </ul>`
        : ''
      }
    </section>

    <section class="cta" style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.05) 100%); border: 2px solid rgba(16, 185, 129, 0.3); border-radius: 12px; padding: 32px; margin: 40px 0; text-align: center;">
      <div style="margin-bottom: 24px;">
        <h2 style="color: #10b981; font-size: 28px; margin-bottom: 12px; font-weight: 700;">🚀 Get the Complete AI Edge</h2>
        <p style="font-size: 18px; color: #cbd5e1; margin-bottom: 20px; line-height: 1.6;">
          Unlock advanced model insights, CLV analysis, and value bet recommendations
        </p>
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin: 24px 0; text-align: left; max-width: 600px; margin-left: auto; margin-right: auto;">
        <div style="padding: 12px; background: rgba(16, 185, 129, 0.1); border-radius: 8px;">
          <div style="font-weight: 600; color: #10b981; margin-bottom: 4px;">🧠 V2 AI Model</div>
          <div style="font-size: 13px; color: #94a3b8;">Enhanced predictions</div>
        </div>
        <div style="padding: 12px; background: rgba(16, 185, 129, 0.1); border-radius: 8px;">
          <div style="font-weight: 600; color: #10b981; margin-bottom: 4px;">📊 CLV Tracker</div>
          <div style="font-size: 13px; color: #94a3b8;">Optimal timing</div>
        </div>
        <div style="padding: 12px; background: rgba(16, 185, 129, 0.1); border-radius: 8px;">
          <div style="font-weight: 600; color: #10b981; margin-bottom: 4px;">🎯 Value Bets</div>
          <div style="font-size: 13px; color: #94a3b8;">Edge identification</div>
        </div>
      </div>
      
      <a href="/match/${marketMatch?.matchId || qp.matchId || ''}" 
         style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #0f172a; font-weight: 700; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; box-shadow: 0 8px 24px rgba(16, 185, 129, 0.4); transition: transform 0.2s, box-shadow 0.2s; margin-top: 20px;"
         onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 12px 32px rgba(16, 185, 129, 0.5)';"
         onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 8px 24px rgba(16, 185, 129, 0.4)';">
        🔓 View Full Match Analysis →
      </a>
      
      <p style="margin-top: 16px; font-size: 13px; color: #64748b; font-style: italic;">
        Instant access • Premium insights • No subscription required
      </p>
    </section>

    <section class="faq">
      <h2>Frequently Asked Questions</h2>
      <details>
        <summary>How do you calculate the model's confidence?</summary>
        <p>Confidence is derived from team form, matchup context, and historical performance. It's not a guarantee—just a signal based on data-driven analysis.</p>
      </details>
      <details>
        <summary>Is this wagering advice?</summary>
        <p>This analysis is informational and model-driven. SnapBet does not provide wagering advice.</p>
      </details>
    </section>

  </article>

</body>
</html>`

    return content
  }

  /**
   * Generate tags
   */
  private static generateTags(qp: QuickPurchaseLite): string[] {
    const tags = ['football', 'ai-analysis', 'preview', 'predictions']
    
    if (qp.valueRating) {
      tags.push(qp.valueRating.toLowerCase())
    }

    return tags
  }
}
