import prisma from '@/lib/db'
import { OpenAIService } from '@/lib/ai/openai-service'
import { ContentValidator } from '@/lib/ai/content-validator'
import { SEOOptimizer } from '@/lib/ai/seo-optimizer'
import { RSSItem } from '@/types/rss'
import { BlogPostData, GeneratedContent } from '@/types/rss'

export class BlogAutomationService {
  private openaiService: OpenAIService
  private contentValidator: ContentValidator
  private seoOptimizer: SEOOptimizer

  constructor() {
    this.openaiService = new OpenAIService()
    this.contentValidator = new ContentValidator()
    this.seoOptimizer = new SEOOptimizer()
  }

  /**
   * Process a news item and generate a blog post
   */
  async processNewsItem(newsItem: RSSItem): Promise<BlogPostData | null> {
    try {
      console.log(`Processing news item: ${newsItem.title}`)

      // Check if we've already processed this item
      const existingPost = await this.checkExistingContent(newsItem.link)
      if (existingPost) {
        console.log(`News item already processed: ${newsItem.title}`)
        return null
      }

      // Generate blog content
      const blogData = await this.generateBlogPost(newsItem)
      
      // Create GeneratedContent object for validation
      const generatedContent: GeneratedContent = {
        title: blogData.title,
        excerpt: blogData.excerpt,
        content: blogData.content,
        keywords: blogData.tags,
        readTime: blogData.readTime,
        seoTitle: blogData.seoTitle,
        seoDescription: blogData.seoDescription,
        seoKeywords: blogData.seoKeywords
      }
      
      // Validate content quality
      const validation = await this.contentValidator.validateContent(generatedContent)
      if (!validation.isValid) {
        console.log(`Content validation failed for: ${newsItem.title}`)
        return null
      }

      // Save to database
      const blogId = await this.saveBlogPost(blogData)
      console.log(`Blog post saved with ID: ${blogId}`)

      return blogData
    } catch (error) {
      console.error(`Error processing news item: ${error}`)
      return null
    }
  }

  /**
   * Generate blog post content from news item
   */
  async generateBlogPost(newsItem: RSSItem): Promise<BlogPostData> {
    // Determine content category
    const category = await this.categorizeNewsItem(newsItem)
    
    // Generate content using OpenAI
    const generatedContent = await this.openaiService.generateBlogPost({
      newsItem,
      targetCategory: category,
      targetKeywords: this.extractKeywords(newsItem.title + ' ' + newsItem.description),
      targetLength: 800,
      tone: 'professional',
      includePredictions: category === 'matchAnalysis'
    })

    // Optimize SEO
    const seoOptimized = await this.seoOptimizer.optimizeContent(generatedContent)

    // Create blog post data
    return {
      title: seoOptimized.title,
      slug: this.generateSlug(seoOptimized.title),
      excerpt: seoOptimized.excerpt,
      content: seoOptimized.content,
      author: 'SnapBet AI Team',
      category,
      tags: seoOptimized.keywords,
      geoTarget: ['worldwide'],
      featured: false,
      readTime: seoOptimized.readTime,
      seoTitle: seoOptimized.seoTitle,
      seoDescription: seoOptimized.seoDescription,
      seoKeywords: seoOptimized.seoKeywords,
      isPublished: false,
      sourceUrl: newsItem.link,
      aiGenerated: true
    }
  }

  /**
   * Save blog post to database
   */
  async saveBlogPost(blogData: BlogPostData): Promise<string> {
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

    return blogPost.id
  }

  /**
   * Publish a blog post
   */
  async publishBlogPost(blogId: string): Promise<void> {
    await prisma.blogPost.update({
      where: { id: blogId },
      data: { 
        isPublished: true,
        publishedAt: new Date()
      }
    })
  }

  /**
   * Schedule a blog post for publishing
   */
  async scheduleBlogPost(blogData: BlogPostData, publishDate: Date): Promise<void> {
    const blogId = await this.saveBlogPost(blogData)
    
    // Schedule for publishing
    await prisma.blogPost.update({
      where: { id: blogId },
      data: { 
        scheduledPublishAt: publishDate
      }
    })
  }

  /**
   * Check if content already exists
   */
  private async checkExistingContent(sourceUrl: string): Promise<boolean> {
    const existing = await prisma.blogPost.findFirst({
      where: { sourceUrl }
    })
    return !!existing
  }

  /**
   * Categorize news item
   */
  private async categorizeNewsItem(newsItem: RSSItem): Promise<string> {
    const title = newsItem.title.toLowerCase()
    const description = newsItem.description.toLowerCase()

    if (title.includes('transfer') || description.includes('transfer')) {
      return 'transferNews'
    }
    
    if (title.includes('match') || title.includes('vs') || title.includes('preview')) {
      return 'matchAnalysis'
    }
    
    if (title.includes('league') || title.includes('standings') || title.includes('table')) {
      return 'leagueAnalysis'
    }
    
    if (title.includes('odds') || title.includes('betting') || title.includes('market')) {
      return 'bettingTrends'
    }
    
    return 'general'
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3)
    
    // Simple keyword extraction (can be enhanced with NLP)
    const keywords = words.filter(word => 
      ['football', 'soccer', 'match', 'team', 'player', 'transfer', 'league', 'betting', 'odds', 'prediction'].includes(word)
    )
    
    return [...new Set(keywords)].slice(0, 5)
  }

  /**
   * Generate URL slug from title
   */
  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
  }
} 