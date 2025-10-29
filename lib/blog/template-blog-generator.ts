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

/**
 * Template-only blog generator for QuickPurchase predictions
 * Creates simple HTML previews without AI generation
 */
export class TemplateBlogGenerator {
  /**
   * Get eligible QuickPurchase matches for blog generation
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
   * Generate a template-only blog draft from QuickPurchase
   */
  static generateTemplateOnlyDraft(qp: QuickPurchaseLite): GeneratedBlogDraft {
    // Extract team names from matchData or name
    const teamNames = this.extractTeamNames(qp)
    const title = this.generateTitle(qp, teamNames)
    const excerpt = this.generateExcerpt(qp, teamNames)
    const contentHtml = this.generateContentHtml(qp, teamNames)
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
   * Generate blog title
   */
  private static generateTitle(qp: QuickPurchaseLite, teams: { homeTeam: string; awayTeam: string }): string {
    return `${teams.homeTeam} vs ${teams.awayTeam} – AI Match Preview`
  }

  /**
   * Generate excerpt
   */
  private static generateExcerpt(qp: QuickPurchaseLite, teams: { homeTeam: string; awayTeam: string }): string {
    if (qp.analysisSummary) {
      return this.sanitize(qp.analysisSummary)
    }
    
    const confidence = qp.confidenceScore || 0
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
   * Generate HTML content following the exact template structure provided
   */
  private static generateContentHtml(qp: QuickPurchaseLite, teams: { homeTeam: string; awayTeam: string }): string {
    console.log(`[TemplateBlog] Generating content for: ${qp.name}`)
    console.log(`[TemplateBlog] Teams:`, teams)
    console.log(`[TemplateBlog] Has predictionData:`, !!qp.predictionData)
    
    const confidence = qp.confidenceScore || 0
    const predictionData = qp.predictionData as any
    
    if (!predictionData) {
      console.warn(`[TemplateBlog] No predictionData for ${qp.name}`)
      return `<p>Match preview for ${teams.homeTeam} vs ${teams.awayTeam}. No detailed prediction data available.</p>`
    }

    // Helper functions
    const truncate = (text: string, length: number) => text.length > length ? text.substring(0, length) + '...' : text
    const stripHtml = (html: string) => html.replace(/<[^>]*>?/gm, '')
    const join = (arr: string[] | undefined, separator: string) => arr ? arr.join(separator) : 'N/A'

    // Extract data with fallbacks - using the correct nested structure
    const analysis = predictionData.analysis || {}
    const matchInfo = predictionData.match_info || {}
    const homeTeamAnalysis = analysis.team_analysis?.home_team || {}
    const awayTeamAnalysis = analysis.team_analysis?.away_team || {}
    const confidenceFactors = analysis.confidence_factors || []
    const riskFactors = predictionData.prediction_analysis?.risk_factors || []
    
    // SEO data
    const seoTitle = `${qp.name} – Match Preview`
    const seoDescription = truncate(stripHtml(qp.description || ''), 150)
    const socialImage = 'https://yourdomain.com/og-default.jpg'
    const canonicalUrl = `https://yourdomain.com/matches/${qp.id || ''}`

    // Generate slug from title if not provided
    const slug = qp.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

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
    "name":"${qp.name}",
    "sport":"Soccer",
    "startDate":"${matchInfo.date || ''}",
    "location":{
      "@type":"Place",
      "name":"${matchInfo.venue || ''}"
    },
    "competitor":[
      {"@type":"SportsTeam","name":"${teams.homeTeam}"},
      {"@type":"SportsTeam","name":"${teams.awayTeam}"}
    ],
    "eventAttendanceMode":"https://schema.org/OfflineEventAttendanceMode",
    "description":"${truncate(stripHtml(qp.description || ''), 180)}"
  }
  </script>
</head>
<body>

  <article class="match-preview">
    <header>
      <h1 class="title">${qp.name}</h1>
      <ul class="meta">
        <li><strong>League:</strong> ${matchInfo.league || 'N/A'}</li>
        <li><strong>Venue:</strong> ${matchInfo.venue || 'N/A'}</li>
        <li><strong>Date:</strong> ${matchInfo.date || 'N/A'}</li>
      </ul>
    </header>

    <section>
      <h2>Match Overview</h2>
      <p>${this.sanitize(qp.description || 'A detailed match preview will be available soon.')}</p>
    </section>

    <section>
      <h3>AI Analysis Overview</h3>
      <p>Our model indicates a <strong>${confidence}% confidence</strong> leaning toward <strong>Analysis</strong> based on recent form and matchup context.</p>

      <h4>Analysis Summary</h4>
      <p>${this.sanitize(qp.analysisSummary || analysis.ai_summary_clean || analysis.explanation || 'Detailed analysis will be available soon.')}</p>
    </section>

    <section>
      <h3>Key Factors</h3>
      <ul>
        ${confidenceFactors.map((factor: string) => `<li>${this.sanitize(factor)}</li>`).join('')}
      </ul>
    </section>

    <section>
      <h3>Team Snapshots</h3>

      <h4>${teams.homeTeam}</h4>
      <p>${this.sanitize(homeTeamAnalysis.form_assessment || 'Form assessment will be available soon.')}</p>
      <ul>
        <li><strong>Strengths:</strong> ${this.sanitize(join(homeTeamAnalysis.strengths, "; "))}</li>
        <li><strong>Weaknesses:</strong> ${this.sanitize(join(homeTeamAnalysis.weaknesses, "; "))}</li>
        <li><strong>Injuries/Availability:</strong> ${this.sanitize(homeTeamAnalysis.injury_impact || 'No significant injury impact reported.')}</li>
      </ul>

      <h4>${teams.awayTeam}</h4>
      <p>${this.sanitize(awayTeamAnalysis.form_assessment || 'Form assessment will be available soon.')}</p>
      <ul>
        <li><strong>Strengths:</strong> ${this.sanitize(join(awayTeamAnalysis.strengths, "; "))}</li>
        <li><strong>Weaknesses:</strong> ${this.sanitize(join(awayTeamAnalysis.weaknesses, "; "))}</li>
        <li><strong>Injuries/Availability:</strong> ${this.sanitize(awayTeamAnalysis.injury_impact || 'No significant injury impact reported.')}</li>
      </ul>
    </section>

    <section>
      <h3>Risk & Uncertainty</h3>
      <p><strong>Model risk:</strong> ${this.sanitize(analysis.risk_assessment || predictionData.risk_assessment || 'Moderate risk due to inherent unpredictability in sports.')}</p>
      <ul>
        ${riskFactors.map((rf: string) => `<li>${this.sanitize(rf)}</li>`).join('')}
      </ul>
    </section>

    <section class="cta">
      <h3>Get the Full Analysis</h3>
      <p>See in-depth charts, historical trends, and model drivers in the app.</p>
      <a class="btn" href="/matches">/matches</a>
    </section>

    <section class="faq">
      <h3>FAQs</h3>
      <details>
        <summary>How do you calculate the model's confidence?</summary>
        <p>Confidence is derived from team form, matchup context, and historical performance. It's not a guarantee—just a signal.</p>
      </details>
      <details>
        <summary>Is this wagering advice?</summary>
        <p>No. This preview is informational only and does not provide betting recommendations.</p>
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
