import OpenAI from 'openai'
import { RSSItem, ContentGenerationRequest, GeneratedContent } from '@/types/rss'
import { logger } from '@/lib/logger'

export class OpenAIService {
  private client: OpenAI
  private readonly model = 'gpt-4-turbo-preview'
  private readonly maxTokens = 4000
  private readonly temperature = 0.7

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required')
    }
    
    this.client = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: false
    })
  }

  /**
   * Generate a complete blog post from a news item
   */
  async generateBlogPost(request: ContentGenerationRequest): Promise<GeneratedContent> {
    try {
      logger.info('Starting blog post generation', {
        tags: ['ai', 'openai', 'content-generation'],
        data: { 
          newsTitle: request.newsItem.title,
          targetCategory: request.targetCategory,
          targetLength: request.targetLength
        }
      })

      // 1. Generate the main content
      const content = await this.generateMainContent(request)
      
      // 2. Generate SEO-optimized title
      const seoTitle = await this.generateSEOTitle(request.newsItem.title, request.targetKeywords)
      
      // 3. Generate excerpt
      const excerpt = await this.generateExcerpt(content)
      
      // 4. Extract keywords from content
      const keywords = await this.extractKeywords(content)
      
      // 5. Generate SEO description
      const seoDescription = await this.generateSEODescription(content)
      
      // 6. Calculate read time
      const readTime = this.calculateReadTime(content)

      const generatedContent: GeneratedContent = {
        title: seoTitle,
        excerpt,
        content,
        keywords,
        readTime,
        seoTitle,
        seoDescription,
        seoKeywords: keywords
      }

      logger.info('Blog post generation completed', {
        tags: ['ai', 'openai', 'content-generation'],
        data: { 
          title: seoTitle,
          wordCount: content.split(' ').length,
          readTime
        }
      })

      return generatedContent
    } catch (error) {
      logger.error('Failed to generate blog post', {
        tags: ['ai', 'openai', 'content-generation', 'error'],
        data: { 
          newsItem: request.newsItem.title,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      })
      throw error
    }
  }

  /**
   * Generate the main blog content
   */
  private async generateMainContent(request: ContentGenerationRequest): Promise<string> {
    const template = this.getTemplateForCategory(request.targetCategory)
    const prompt = this.buildContentPrompt(request, template)

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: this.getSystemPrompt(request.targetCategory)
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: this.maxTokens,
      temperature: this.temperature
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No content generated from OpenAI')
    }

    return this.cleanGeneratedContent(content)
  }

  /**
   * Generate SEO-optimized title
   */
  async generateSEOTitle(originalTitle: string, keywords: string[]): Promise<string> {
    const prompt = `
      Create an SEO-optimized blog post title based on this news headline:
      "${originalTitle}"
      
      Target keywords: ${keywords.join(', ')}
      
      Requirements:
      - Length: 30-60 characters
      - Include primary keyword naturally
      - Engaging and click-worthy
      - Professional tone
      - No clickbait
      
      Return only the title, nothing else.
    `

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are an SEO expert. Generate optimized titles for sports betting content.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 100,
      temperature: 0.5
    })

    const title = response.choices[0]?.message?.content?.trim()
    return title || originalTitle
  }

  /**
   * Generate excerpt from content
   */
  async generateExcerpt(content: string): Promise<string> {
    const prompt = `
      Create a compelling excerpt from this blog post content:
      
      ${content.substring(0, 1000)}...
      
      Requirements:
      - Length: 120-160 characters
      - Engaging and informative
      - Include key points
      - Professional tone
      
      Return only the excerpt, nothing else.
    `

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are a content editor. Create compelling excerpts for blog posts.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 200,
      temperature: 0.5
    })

    const excerpt = response.choices[0]?.message?.content?.trim()
    return excerpt || content.substring(0, 150) + '...'
  }

  /**
   * Extract keywords from content
   */
  async extractKeywords(content: string): Promise<string[]> {
    const prompt = `
      Extract relevant keywords from this blog post content:
      
      ${content.substring(0, 2000)}
      
      Requirements:
      - Extract 5-10 relevant keywords
      - Focus on sports betting, teams, players, leagues
      - Include both broad and specific terms
      - Return as comma-separated list
      
      Return only the keywords, nothing else.
    `

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are an SEO expert. Extract relevant keywords from content.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 200,
      temperature: 0.3
    })

    const keywordsText = response.choices[0]?.message?.content?.trim()
    if (!keywordsText) return []

    return keywordsText
      .split(',')
      .map((k: string) => k.trim())
      .filter((k: string) => k.length > 0)
      .slice(0, 10)
  }

  /**
   * Generate SEO description
   */
  async generateSEODescription(content: string): Promise<string> {
    const prompt = `
      Create an SEO-optimized meta description from this blog post:
      
      ${content.substring(0, 1000)}...
      
      Requirements:
      - Length: 120-160 characters
      - Include primary keyword
      - Compelling call-to-action
      - Professional tone
      
      Return only the description, nothing else.
    `

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are an SEO expert. Create optimized meta descriptions.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 200,
      temperature: 0.5
    })

    const description = response.choices[0]?.message?.content?.trim()
    return description || content.substring(0, 150) + '...'
  }

  /**
   * Get content template for category
   */
  private getTemplateForCategory(category: string): string {
    const templates = {
      matchAnalysis: `
        Write a comprehensive match analysis blog post based on this news:
        TITLE: {title}
        DESCRIPTION: {description}
        SOURCE: {source}
        
        Requirements:
        - Focus on betting implications and predictions
        - Include AI analysis perspective
        - Target length: {targetLength} words
        - Tone: Professional but engaging
        - Include relevant statistics and data
        - Add call-to-action for SnapBet AI predictions
        - SEO optimized with keywords: {keywords}
        - Structure: Introduction, Analysis, Betting Implications, Conclusion
      `,
      
      transferNews: `
        Write a transfer news analysis blog post:
        TITLE: {title}
        DESCRIPTION: {description}
        SOURCE: {source}
        
        Requirements:
        - Analyze betting market impact
        - Include team performance predictions
        - Target length: {targetLength} words
        - Tone: Analytical and informative
        - Include historical context
        - SEO optimized with keywords: {keywords}
        - Structure: Introduction, Transfer Analysis, Market Impact, Conclusion
      `,
      
      leagueAnalysis: `
        Write a league analysis blog post:
        TITLE: {title}
        DESCRIPTION: {description}
        SOURCE: {source}
        
        Requirements:
        - Focus on betting opportunities
        - Include AI prediction insights
        - Target length: {targetLength} words
        - Tone: Expert analysis
        - Include multiple betting angles
        - SEO optimized with keywords: {keywords}
        - Structure: Introduction, League Analysis, Betting Opportunities, Conclusion
      `,
      
      bettingTrends: `
        Write a betting trends analysis blog post:
        TITLE: {title}
        DESCRIPTION: {description}
        SOURCE: {source}
        
        Requirements:
        - Analyze market trends and patterns
        - Include value betting opportunities
        - Target length: {targetLength} words
        - Tone: Professional and analytical
        - Include data-driven insights
        - SEO optimized with keywords: {keywords}
        - Structure: Introduction, Trend Analysis, Opportunities, Conclusion
      `,
      
      general: `
        Write a sports news blog post:
        TITLE: {title}
        DESCRIPTION: {description}
        SOURCE: {source}
        
        Requirements:
        - Engaging and informative content
        - Include betting implications where relevant
        - Target length: {targetLength} words
        - Tone: Professional and engaging
        - SEO optimized with keywords: {keywords}
        - Structure: Introduction, Main Content, Conclusion
      `
    }

    return templates[category as keyof typeof templates] || templates.general
  }

  /**
   * Get system prompt for category
   */
  private getSystemPrompt(category: string): string {
    const prompts = {
      matchAnalysis: 'You are a professional sports betting analyst and AI expert. Write comprehensive match analysis blog posts that combine sports knowledge with AI insights. Focus on betting implications and provide valuable predictions.',
      transferNews: 'You are a football transfer market expert and betting analyst. Write insightful transfer news analysis that considers both sporting and betting implications.',
      leagueAnalysis: 'You are a league analysis expert and betting strategist. Write comprehensive league analysis posts that identify betting opportunities and trends.',
      bettingTrends: 'You are a betting market analyst and trend expert. Write data-driven analysis of betting trends and market movements.',
      general: 'You are a sports journalist and betting analyst. Write engaging, informative blog posts about sports news with betting insights where relevant.'
    }

    return prompts[category as keyof typeof prompts] || prompts.general
  }

  /**
   * Build content prompt
   */
  private buildContentPrompt(request: ContentGenerationRequest, template: string): string {
    return template
      .replace('{title}', request.newsItem.title)
      .replace('{description}', request.newsItem.description)
      .replace('{source}', request.newsItem.source)
      .replace('{targetLength}', request.targetLength.toString())
      .replace('{keywords}', request.targetKeywords.join(', '))
  }

  /**
   * Clean generated content
   */
  private cleanGeneratedContent(content: string): string {
    return content
      .replace(/^```\w*\n?/g, '') // Remove markdown code blocks
      .replace(/```\n?$/g, '')
      .replace(/^#+\s*/gm, '') // Remove markdown headers
      .trim()
  }

  /**
   * Calculate read time in minutes
   */
  private calculateReadTime(content: string): number {
    const wordsPerMinute = 200
    const wordCount = content.split(/\s+/).length
    return Math.max(1, Math.ceil(wordCount / wordsPerMinute))
  }

  /**
   * Validate factual accuracy against source
   */
  async validateFactualAccuracy(content: string, sourceUrl: string): Promise<boolean> {
    const prompt = `
      Review this blog post content for factual accuracy based on the source:
      
      CONTENT: ${content.substring(0, 2000)}
      SOURCE: ${sourceUrl}
      
      Check for:
      - Factual errors
      - Misleading information
      - Inconsistent data
      - Unsupported claims
      
      Return only "VALID" or "INVALID" with a brief reason.
    `

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are a fact-checker. Validate content accuracy against sources.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 100,
      temperature: 0.1
    })

    const result = response.choices[0]?.message?.content?.trim() || ''
    return result.startsWith('VALID')
  }
}

// Export singleton instance
export const openaiService = new OpenAIService() 