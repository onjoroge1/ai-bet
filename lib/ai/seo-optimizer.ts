import { GeneratedContent } from '@/types/rss'
import { logger } from '@/lib/logger'

export class SEOOptimizer {
  private readonly minTitleLength = 30
  private readonly maxTitleLength = 60
  private readonly minDescriptionLength = 120
  private readonly maxDescriptionLength = 160
  private readonly optimalKeywordDensity = 1.5
  private readonly maxKeywordDensity = 2.5

  /**
   * Optimize content for SEO
   */
  async optimizeContent(content: GeneratedContent): Promise<GeneratedContent> {
    try {
      logger.info('Starting SEO optimization', {
        tags: ['ai', 'seo-optimization'],
        data: { title: content.title, wordCount: content.content.split(' ').length }
      })

      // 1. Optimize title
      const optimizedTitle = await this.optimizeTitle(content.title, content.keywords)
      
      // 2. Optimize description
      const optimizedDescription = await this.optimizeDescription(content.content, content.keywords)
      
      // 3. Optimize content structure
      const optimizedContent = await this.optimizeContentStructure(content.content, content.keywords)
      
      // 4. Extract and optimize keywords
      const optimizedKeywords = await this.extractOptimizedKeywords(optimizedContent)
      
      // 5. Generate meta keywords
      const metaKeywords = await this.generateMetaKeywords(optimizedKeywords)

      const optimized: GeneratedContent = {
        ...content,
        title: optimizedTitle,
        seoTitle: optimizedTitle,
        seoDescription: optimizedDescription,
        content: optimizedContent,
        keywords: optimizedKeywords,
        seoKeywords: metaKeywords
      }

      logger.info('SEO optimization completed', {
        tags: ['ai', 'seo-optimization'],
        data: { 
          titleLength: optimizedTitle.length,
          descriptionLength: optimizedDescription.length,
          keywordCount: optimizedKeywords.length
        }
      })

      return optimized
    } catch (error) {
      logger.error('SEO optimization failed', {
        tags: ['ai', 'seo-optimization', 'error'],
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      })
      throw error
    }
  }

  /**
   * Optimize title for SEO
   */
  private async optimizeTitle(title: string, keywords: string[]): Promise<string> {
    let optimizedTitle = title

    // Ensure title is within length limits
    if (optimizedTitle.length < this.minTitleLength) {
      // Add primary keyword if not present
      const primaryKeyword = keywords[0]
      if (primaryKeyword && !optimizedTitle.toLowerCase().includes(primaryKeyword.toLowerCase())) {
        optimizedTitle = `${optimizedTitle} - ${primaryKeyword}`
      }
    }

    if (optimizedTitle.length > this.maxTitleLength) {
      optimizedTitle = optimizedTitle.substring(0, this.maxTitleLength - 3) + '...'
    }

    // Ensure title starts with primary keyword if possible
    const primaryKeyword = keywords[0]
    if (primaryKeyword && !optimizedTitle.toLowerCase().startsWith(primaryKeyword.toLowerCase())) {
      // Check if we can restructure without making it too long
      const restructured = `${primaryKeyword}: ${optimizedTitle}`
      if (restructured.length <= this.maxTitleLength) {
        optimizedTitle = restructured
      }
    }

    return optimizedTitle
  }

  /**
   * Optimize meta description
   */
  private async optimizeDescription(content: string, keywords: string[]): Promise<string> {
    // Extract first few sentences for description
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0)
    let description = sentences.slice(0, 2).join('. ') + '.'
    
    // Ensure it includes primary keyword
    const primaryKeyword = keywords[0]
    if (primaryKeyword && !description.toLowerCase().includes(primaryKeyword.toLowerCase())) {
      description = `${primaryKeyword}: ${description}`
    }

    // Add call-to-action if space allows
    if (description.length < this.maxDescriptionLength - 20) {
      description += ' Learn more about sports betting predictions.'
    }

    // Truncate if too long
    if (description.length > this.maxDescriptionLength) {
      description = description.substring(0, this.maxDescriptionLength - 3) + '...'
    }

    return description
  }

  /**
   * Optimize content structure for SEO
   */
  private async optimizeContentStructure(content: string, keywords: string[]): Promise<string> {
    let optimizedContent = content

    // 1. Add H2 headings for better structure
    optimizedContent = this.addStructuredHeadings(optimizedContent, keywords)

    // 2. Optimize keyword placement
    optimizedContent = this.optimizeKeywordPlacement(optimizedContent, keywords)

    // 3. Add internal linking suggestions
    optimizedContent = this.addInternalLinkingSuggestions(optimizedContent)

    // 4. Optimize paragraph structure
    optimizedContent = this.optimizeParagraphStructure(optimizedContent)

    return optimizedContent
  }

  /**
   * Add structured headings to content
   */
  private addStructuredHeadings(content: string, keywords: string[]): string {
    const paragraphs = content.split('\n\n')
    const optimizedParagraphs: string[] = []
    
    // Add introduction heading if not present
    if (!content.toLowerCase().includes('introduction')) {
      optimizedParagraphs.push('## Introduction')
    }

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i]
      
      // Add relevant headings based on content and keywords
      if (i === 0 && !paragraph.toLowerCase().includes('introduction')) {
        optimizedParagraphs.push('## Introduction')
      } else if (paragraph.toLowerCase().includes('analysis') || paragraph.toLowerCase().includes('review')) {
        optimizedParagraphs.push('## Analysis')
      } else if (paragraph.toLowerCase().includes('prediction') || paragraph.toLowerCase().includes('forecast')) {
        optimizedParagraphs.push('## Predictions')
      } else if (paragraph.toLowerCase().includes('betting') || paragraph.toLowerCase().includes('odds')) {
        optimizedParagraphs.push('## Betting Implications')
      } else if (paragraph.toLowerCase().includes('conclusion') || i === paragraphs.length - 1) {
        optimizedParagraphs.push('## Conclusion')
      }
      
      optimizedParagraphs.push(paragraph)
    }

    return optimizedParagraphs.join('\n\n')
  }

  /**
   * Optimize keyword placement in content
   */
  private optimizeKeywordPlacement(content: string, keywords: string[]): string {
    let optimizedContent = content

    // Ensure primary keyword appears in first paragraph
    const primaryKeyword = keywords[0]
    if (primaryKeyword) {
      const firstParagraph = optimizedContent.split('\n\n')[0]
      if (firstParagraph && !firstParagraph.toLowerCase().includes(primaryKeyword.toLowerCase())) {
        const enhancedFirstParagraph = `${primaryKeyword} is a key topic in today's sports betting landscape. ${firstParagraph}`
        const paragraphs = optimizedContent.split('\n\n')
        paragraphs[0] = enhancedFirstParagraph
        optimizedContent = paragraphs.join('\n\n')
      }
    }

    // Ensure keywords appear naturally throughout content
    for (const keyword of keywords.slice(1, 3)) { // Focus on top 3 keywords
      const keywordCount = (optimizedContent.toLowerCase().match(new RegExp(keyword.toLowerCase(), 'g')) || []).length
      if (keywordCount < 2) {
        // Add keyword naturally in a relevant section
        const sections = optimizedContent.split('\n\n')
        for (let i = 1; i < sections.length - 1; i++) {
          if (!sections[i].toLowerCase().includes(keyword.toLowerCase())) {
            const enhancedSection = `${sections[i]} This analysis also considers ${keyword.toLowerCase()} factors.`
            sections[i] = enhancedSection
            break
          }
        }
        optimizedContent = sections.join('\n\n')
      }
    }

    return optimizedContent
  }

  /**
   * Add internal linking suggestions
   */
  private addInternalLinkingSuggestions(content: string): string {
    const linkingPhrases = [
      'For more detailed predictions, check out our AI-powered betting tips.',
      'Explore our comprehensive sports analysis for better betting decisions.',
      'Get the latest predictions and insights from our expert analysis.',
      'Discover how AI can improve your sports betting strategy.'
    ]

    // Add linking phrase near the end if not already present
    if (!content.toLowerCase().includes('check out') && !content.toLowerCase().includes('explore')) {
      const paragraphs = content.split('\n\n')
      const lastParagraph = paragraphs[paragraphs.length - 1]
      const randomPhrase = linkingPhrases[Math.floor(Math.random() * linkingPhrases.length)]
      
      paragraphs[paragraphs.length - 1] = `${lastParagraph} ${randomPhrase}`
      return paragraphs.join('\n\n')
    }

    return content
  }

  /**
   * Optimize paragraph structure
   */
  private optimizeParagraphStructure(content: string): string {
    const paragraphs = content.split('\n\n')
    const optimizedParagraphs: string[] = []

    for (const paragraph of paragraphs) {
      // Break long paragraphs
      if (paragraph.split(' ').length > 150) {
        const sentences = paragraph.split(/[.!?]+/).filter(s => s.trim().length > 0)
        const midPoint = Math.ceil(sentences.length / 2)
        
        const firstHalf = sentences.slice(0, midPoint).join('. ') + '.'
        const secondHalf = sentences.slice(midPoint).join('. ') + '.'
        
        optimizedParagraphs.push(firstHalf)
        optimizedParagraphs.push(secondHalf)
      } else {
        optimizedParagraphs.push(paragraph)
      }
    }

    return optimizedParagraphs.join('\n\n')
  }

  /**
   * Extract optimized keywords from content
   */
  private async extractOptimizedKeywords(content: string): Promise<string[]> {
    const words = content.toLowerCase().split(/\s+/)
    const wordFrequency: { [key: string]: number } = {}
    
    // Count word frequency (excluding common words)
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'
    ])

    for (const word of words) {
      const cleanWord = word.replace(/[^a-z]/g, '')
      if (cleanWord.length > 3 && !stopWords.has(cleanWord)) {
        wordFrequency[cleanWord] = (wordFrequency[cleanWord] || 0) + 1
      }
    }

    // Get top keywords by frequency
    const sortedKeywords = Object.entries(wordFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word, _]) => word)

    return sortedKeywords
  }

  /**
   * Generate meta keywords
   */
  private async generateMetaKeywords(keywords: string[]): Promise<string[]> {
    const metaKeywords = [...keywords]

    // Add related terms
    const relatedTerms = [
      'sports betting', 'football predictions', 'AI predictions', 'betting tips',
      'sports analysis', 'match predictions', 'odds analysis', 'betting strategy'
    ]

    // Add relevant related terms
    for (const term of relatedTerms) {
      if (!metaKeywords.some(k => k.toLowerCase().includes(term.toLowerCase()))) {
        metaKeywords.push(term)
      }
    }

    return metaKeywords.slice(0, 15) // Limit to 15 keywords
  }

  /**
   * Calculate keyword density
   */
  calculateKeywordDensity(content: string, keywords: string[]): number {
    const words = content.toLowerCase().split(/\s+/)
    const totalWords = words.length
    
    if (totalWords === 0) return 0

    let keywordCount = 0
    for (const keyword of keywords) {
      const keywordWords = keyword.toLowerCase().split(/\s+/)
      for (let i = 0; i <= words.length - keywordWords.length; i++) {
        if (keywordWords.every((kw, j) => words[i + j] === kw)) {
          keywordCount++
        }
      }
    }

    return (keywordCount / totalWords) * 100
  }

  /**
   * Check if content meets SEO requirements
   */
  checkSEORequirements(content: GeneratedContent): {
    isValid: boolean
    issues: string[]
    suggestions: string[]
  } {
    const issues: string[] = []
    const suggestions: string[] = []

    // Check title length
    if (content.seoTitle.length < this.minTitleLength) {
      issues.push(`Title too short (${content.seoTitle.length} chars, min ${this.minTitleLength})`)
    } else if (content.seoTitle.length > this.maxTitleLength) {
      issues.push(`Title too long (${content.seoTitle.length} chars, max ${this.maxTitleLength})`)
    }

    // Check description length
    if (content.seoDescription.length < this.minDescriptionLength) {
      issues.push(`Description too short (${content.seoDescription.length} chars, min ${this.minDescriptionLength})`)
    } else if (content.seoDescription.length > this.maxDescriptionLength) {
      issues.push(`Description too long (${content.seoDescription.length} chars, max ${this.maxDescriptionLength})`)
    }

    // Check keyword density
    const keywordDensity = this.calculateKeywordDensity(content.content, content.seoKeywords)
    if (keywordDensity < this.optimalKeywordDensity) {
      suggestions.push(`Consider increasing keyword density (current: ${keywordDensity.toFixed(2)}%, optimal: ${this.optimalKeywordDensity}%)`)
    } else if (keywordDensity > this.maxKeywordDensity) {
      issues.push(`Keyword density too high (${keywordDensity.toFixed(2)}%, max ${this.maxKeywordDensity}%)`)
    }

    // Check for keyword in title
    const primaryKeyword = content.seoKeywords[0]
    if (primaryKeyword && !content.seoTitle.toLowerCase().includes(primaryKeyword.toLowerCase())) {
      suggestions.push('Consider including primary keyword in title')
    }

    // Check for keyword in first paragraph
    const firstParagraph = content.content.split('\n\n')[0]
    if (primaryKeyword && firstParagraph && !firstParagraph.toLowerCase().includes(primaryKeyword.toLowerCase())) {
      suggestions.push('Consider including primary keyword in first paragraph')
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions
    }
  }

  /**
   * Generate schema markup for blog post
   */
  generateSchemaMarkup(content: GeneratedContent): object {
    return {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": content.seoTitle,
      "description": content.seoDescription,
      "author": {
        "@type": "Organization",
        "name": "SnapBet AI Team"
      },
      "publisher": {
        "@type": "Organization",
        "name": "SnapBet AI",
        "logo": {
          "@type": "ImageObject",
          "url": "https://snapbet.ai/logo.png"
        }
      },
      "datePublished": new Date().toISOString(),
      "dateModified": new Date().toISOString(),
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": `https://snapbet.ai/blog/${content.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
      },
      "keywords": content.seoKeywords.join(', '),
      "wordCount": content.content.split(/\s+/).length,
      "timeRequired": `PT${content.readTime}M`,
      "articleSection": "Sports Betting",
      "genre": "Sports Analysis"
    }
  }
}

// Export singleton instance
export const seoOptimizer = new SEOOptimizer() 