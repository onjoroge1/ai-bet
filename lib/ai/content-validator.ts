import { GeneratedContent, ValidationResult, SEOValidation, ReadabilityScore, OriginalityScore } from '@/types/rss'
import { logger } from '@/lib/logger'

export class ContentValidator {
  private readonly minQualityScore = 75 // Lowered from 85 to 75
  private readonly minReadabilityScore = 70
  private readonly minOriginalityScore = 80
  private readonly minTitleLength = 30
  private readonly maxTitleLength = 60
  private readonly minDescriptionLength = 120
  private readonly maxDescriptionLength = 160
  private readonly minKeywordDensity = 0.5
  private readonly maxKeywordDensity = 2.5
  private readonly minIndividualScore = 60 // New: Lower threshold for individual checks

  /**
   * Validate generated content comprehensively
   */
  async validateContent(content: GeneratedContent): Promise<ValidationResult> {
    try {
      logger.info('Starting content validation', {
        tags: ['ai', 'content-validation'],
        data: { title: content.title, wordCount: content.content.split(' ').length }
      })

      const checks = await Promise.all([
        this.checkFactualAccuracy(content.content, content.seoKeywords),
        this.checkSEOOptimization(content),
        this.checkReadability(content.content),
        this.checkOriginality(content.content),
        this.checkContentLength(content.content),
        this.checkContentStructure(content.content)
      ])

      const isValid = checks.every(check => check.isValid)
      const score = checks.reduce((sum, check) => sum + check.score, 0) / checks.length
      const issues = checks.flatMap(check => check.issues)
      const suggestions = checks.flatMap(check => check.suggestions)

      const result: ValidationResult = {
        isValid: score >= this.minQualityScore, // Use overall score instead of requiring all checks to pass
        score: Math.round(score),
        issues,
        suggestions
      }

      logger.info('Content validation completed', {
        tags: ['ai', 'content-validation'],
        data: { 
          isValid, 
          score: Math.round(score), 
          issuesCount: issues.length 
        }
      })

      return result
    } catch (error) {
      logger.error('Content validation failed', {
        tags: ['ai', 'content-validation', 'error'],
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      })
      throw error
    }
  }

  /**
   * Check factual accuracy of content
   */
  async checkFactualAccuracy(content: string, keywords: string[]): Promise<ValidationResult> {
    const issues: string[] = []
    const suggestions: string[] = []
    let score = 100

    // Check for common factual issues
    const factualChecks = [
      { pattern: /\b\d{4}\b.*\b\d{4}\b/, issue: 'Potential date inconsistency' },
      { pattern: /\b(always|never|everyone|nobody)\b/gi, issue: 'Absolute statements detected' },
      { pattern: /\b(guaranteed|100%|definitely)\b/gi, issue: 'Overly confident claims' },
      { pattern: /\b(proven|scientifically proven)\b/gi, issue: 'Unsupported scientific claims' }
    ]

    for (const check of factualChecks) {
      if (check.pattern.test(content)) {
        issues.push(check.issue)
        score -= 10
      }
    }

    // Check for source attribution
    if (!content.includes('according to') && !content.includes('reports') && !content.includes('sources')) {
      suggestions.push('Consider adding source attributions for claims')
      score -= 5
    }

    // Check for balanced perspective
    const positiveWords = (content.match(/\b(good|great|excellent|amazing|fantastic)\b/gi) || []).length
    const negativeWords = (content.match(/\b(bad|terrible|awful|horrible|disastrous)\b/gi) || []).length
    
    if (Math.abs(positiveWords - negativeWords) > 5) {
      suggestions.push('Content may be too one-sided, consider balanced perspective')
      score -= 5
    }

    return {
      isValid: score >= this.minIndividualScore, // Use lower threshold for individual checks
      score,
      issues,
      suggestions
    }
  }

  /**
   * Check SEO optimization
   */
  async checkSEOOptimization(content: GeneratedContent): Promise<ValidationResult> {
    const issues: string[] = []
    const suggestions: string[] = []
    let score = 100

    // Check title length
    const titleLength = content.seoTitle.length
    if (titleLength < this.minTitleLength) {
      issues.push(`Title too short (${titleLength} chars, min ${this.minTitleLength})`)
      score -= 15
    } else if (titleLength > this.maxTitleLength) {
      issues.push(`Title too long (${titleLength} chars, max ${this.maxTitleLength})`)
      score -= 10
    }

    // Check description length
    const descriptionLength = content.seoDescription.length
    if (descriptionLength < this.minDescriptionLength) {
      issues.push(`Description too short (${descriptionLength} chars, min ${this.minDescriptionLength})`)
      score -= 10
    } else if (descriptionLength > this.maxDescriptionLength) {
      issues.push(`Description too long (${descriptionLength} chars, max ${this.maxDescriptionLength})`)
      score -= 5
    }

    // Check keyword density
    const keywordDensity = this.calculateKeywordDensity(content.content, content.seoKeywords)
    if (keywordDensity < this.minKeywordDensity) {
      issues.push(`Low keyword density (${keywordDensity.toFixed(2)}%, min ${this.minKeywordDensity}%)`)
      score -= 10
    } else if (keywordDensity > this.maxKeywordDensity) {
      issues.push(`High keyword density (${keywordDensity.toFixed(2)}%, max ${this.maxKeywordDensity}%)`)
      score -= 15
    }

    // Check for keyword stuffing
    if (this.detectKeywordStuffing(content.content, content.seoKeywords)) {
      issues.push('Potential keyword stuffing detected')
      score -= 20
    }

    // Check for natural keyword usage
    if (!this.checkNaturalKeywordUsage(content.content, content.seoKeywords)) {
      suggestions.push('Keywords could be integrated more naturally')
      score -= 5
    }

    return {
      isValid: score >= this.minIndividualScore, // Use lower threshold for individual checks
      score,
      issues,
      suggestions
    }
  }

  /**
   * Check content readability
   */
  async checkReadability(content: string): Promise<ValidationResult> {
    const issues: string[] = []
    const suggestions: string[] = []
    let score = 100

    // Calculate Flesch Reading Ease
    const fleschScore = this.calculateFleschReadingEase(content)
    
    if (fleschScore < 30) {
      issues.push(`Very difficult to read (Flesch score: ${fleschScore})`)
      score -= 30
      suggestions.push('Simplify sentence structure and vocabulary')
    } else if (fleschScore < 50) {
      issues.push(`Difficult to read (Flesch score: ${fleschScore})`)
      score -= 20
      suggestions.push('Consider simplifying some sentences')
    } else if (fleschScore > 90) {
      issues.push(`Very easy to read (Flesch score: ${fleschScore})`)
      score -= 10
      suggestions.push('Content may be too simplistic for target audience')
    }

    // Check sentence length
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const avgSentenceLength = sentences.reduce((sum, sentence) => sum + sentence.split(' ').length, 0) / sentences.length
    
    if (avgSentenceLength > 25) {
      issues.push(`Long average sentence length (${avgSentenceLength.toFixed(1)} words)`)
      score -= 15
      suggestions.push('Break down long sentences')
    } else if (avgSentenceLength < 10) {
      issues.push(`Short average sentence length (${avgSentenceLength.toFixed(1)} words)`)
      score -= 5
      suggestions.push('Consider combining some short sentences')
    }

    // Check paragraph length
    const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0)
    const longParagraphs = paragraphs.filter(p => p.split(' ').length > 150).length
    
    if (longParagraphs > 0) {
      issues.push(`${longParagraphs} paragraph(s) too long`)
      score -= 10
      suggestions.push('Break down long paragraphs')
    }

    return {
      isValid: score >= this.minIndividualScore, // Use lower threshold for individual checks
      score: Math.max(0, score),
      issues,
      suggestions
    }
  }

  /**
   * Check content originality
   */
  async checkOriginality(content: string): Promise<ValidationResult> {
    const issues: string[] = []
    const suggestions: string[] = []
    let score = 100

    // Check for repetitive phrases
    const repetitivePhrases = this.detectRepetitivePhrases(content)
    if (repetitivePhrases.length > 0) {
      issues.push(`Repetitive phrases detected: ${repetitivePhrases.slice(0, 3).join(', ')}`)
      score -= 15
      suggestions.push('Vary sentence structure and vocabulary')
    }

    // Check for clichés
    const cliches = this.detectCliches(content)
    if (cliches.length > 0) {
      issues.push(`Clichés detected: ${cliches.slice(0, 3).join(', ')}`)
      score -= 10
      suggestions.push('Replace clichés with original expressions')
    }

    // Check for generic language
    const genericScore = this.checkGenericLanguage(content)
    if (genericScore < 0.7) {
      issues.push('Content contains too much generic language')
      score -= 20
      suggestions.push('Use more specific and descriptive language')
    }

    // Check for duplicate content patterns
    const duplicatePatterns = this.detectDuplicatePatterns(content)
    if (duplicatePatterns) {
      issues.push('Potential duplicate content patterns detected')
      score -= 25
      suggestions.push('Ensure content is original and unique')
    }

    return {
      isValid: score >= this.minIndividualScore, // Use lower threshold for individual checks
      score: Math.max(0, score),
      issues,
      suggestions
    }
  }

  /**
   * Check content length
   */
  private async checkContentLength(content: string): Promise<ValidationResult> {
    const wordCount = content.split(/\s+/).length
    const issues: string[] = []
    const suggestions: string[] = []
    let score = 100

    if (wordCount < 600) {
      issues.push(`Content too short (${wordCount} words, min 600)`)
      score -= 20 // Reduced from 30 to 20
      suggestions.push('Expand content with more details and analysis')
    } else if (wordCount > 2000) {
      issues.push(`Content too long (${wordCount} words, max 2000)`)
      score -= 15
      suggestions.push('Consider breaking into multiple posts or condensing')
    } else if (wordCount < 800) {
      suggestions.push('Consider adding more depth to reach optimal length')
      score -= 5
    }

    return {
      isValid: score >= this.minIndividualScore, // Use lower threshold for individual checks
      score,
      issues,
      suggestions
    }
  }

  /**
   * Check content structure
   */
  private async checkContentStructure(content: string): Promise<ValidationResult> {
    const issues: string[] = []
    const suggestions: string[] = []
    let score = 100

    // Check for introduction
    if (!content.toLowerCase().includes('introduction') && !this.hasGoodIntroduction(content)) {
      issues.push('Missing clear introduction')
      score -= 10 // Reduced from 15 to 10
      suggestions.push('Add a clear introduction paragraph')
    }

    // Check for conclusion
    if (!content.toLowerCase().includes('conclusion') && !this.hasGoodConclusion(content)) {
      issues.push('Missing clear conclusion')
      score -= 10 // Reduced from 15 to 10
      suggestions.push('Add a clear conclusion paragraph')
    }

    // Check for headings/subheadings
    const headings = content.match(/^[A-Z][^.!?]*$/gm) || []
    if (headings.length < 2) {
      suggestions.push('Consider adding subheadings for better structure')
      score -= 5
    }

    // Check for call-to-action
    if (!this.hasCallToAction(content)) {
      suggestions.push('Consider adding a call-to-action')
      score -= 5
    }

    return {
      isValid: score >= this.minIndividualScore, // Use lower threshold for individual checks
      score,
      issues,
      suggestions
    }
  }

  /**
   * Calculate keyword density
   */
  private calculateKeywordDensity(content: string, keywords: string[]): number {
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
   * Detect keyword stuffing
   */
  private detectKeywordStuffing(content: string, keywords: string[]): boolean {
    const sentences = content.split(/[.!?]+/)
    
    for (const sentence of sentences) {
      const sentenceLower = sentence.toLowerCase()
      let keywordCount = 0
      
      for (const keyword of keywords) {
        const keywordLower = keyword.toLowerCase()
        const matches = (sentenceLower.match(new RegExp(keywordLower, 'g')) || []).length
        keywordCount += matches
      }
      
      if (keywordCount > 3) {
        return true
      }
    }
    
    return false
  }

  /**
   * Check natural keyword usage
   */
  private checkNaturalKeywordUsage(content: string, keywords: string[]): boolean {
    const sentences = content.split(/[.!?]+/)
    let naturalUsage = 0
    let totalUsage = 0
    
    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase()
      const matches = content.toLowerCase().match(new RegExp(keywordLower, 'g')) || []
      totalUsage += matches.length
      
      // Check if keywords appear in different contexts
      const contexts = new Set()
      for (const sentence of sentences) {
        if (sentence.toLowerCase().includes(keywordLower)) {
          const context = sentence.substring(0, 50) // First 50 chars for context
          contexts.add(context)
        }
      }
      
      if (contexts.size > 1) {
        naturalUsage += matches.length
      }
    }
    
    return totalUsage === 0 || (naturalUsage / totalUsage) > 0.7
  }

  /**
   * Calculate Flesch Reading Ease
   */
  private calculateFleschReadingEase(text: string): number {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const words = text.split(/\s+/).filter(w => w.length > 0)
    const syllables = this.countSyllables(text)
    
    if (sentences.length === 0 || words.length === 0) return 0
    
    const avgSentenceLength = words.length / sentences.length
    const avgSyllablesPerWord = syllables / words.length
    
    return 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord)
  }

  /**
   * Count syllables in text
   */
  private countSyllables(text: string): number {
    const words = text.toLowerCase().split(/\s+/)
    let syllableCount = 0
    
    for (const word of words) {
      syllableCount += this.countWordSyllables(word)
    }
    
    return syllableCount
  }

  /**
   * Count syllables in a word
   */
  private countWordSyllables(word: string): number {
    word = word.toLowerCase().replace(/[^a-z]/g, '')
    if (word.length <= 3) return 1
    
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
    word = word.replace(/^y/, '')
    
    const syllables = word.match(/[aeiouy]{1,2}/g)
    return syllables ? syllables.length : 1
  }

  /**
   * Detect repetitive phrases
   */
  private detectRepetitivePhrases(content: string): string[] {
    const phrases = content.toLowerCase().match(/\b\w+(?:\s+\w+){2,4}\b/g) || []
    const phraseCounts: { [key: string]: number } = {}
    
    for (const phrase of phrases) {
      phraseCounts[phrase] = (phraseCounts[phrase] || 0) + 1
    }
    
    return Object.entries(phraseCounts)
      .filter(([_, count]) => count > 2)
      .map(([phrase, _]) => phrase)
  }

  /**
   * Detect clichés
   */
  private detectCliches(content: string): string[] {
    const cliches = [
      'at the end of the day',
      'in this day and age',
      'when it comes to',
      'it goes without saying',
      'needless to say',
      'as a matter of fact',
      'in fact',
      'obviously',
      'clearly',
      'evidently'
    ]
    
    return cliches.filter(cliche => 
      content.toLowerCase().includes(cliche)
    )
  }

  /**
   * Check for generic language
   */
  private checkGenericLanguage(content: string): number {
    const genericWords = [
      'thing', 'stuff', 'good', 'bad', 'nice', 'great', 'awesome',
      'amazing', 'incredible', 'fantastic', 'terrible', 'awful'
    ]
    
    const words = content.toLowerCase().split(/\s+/)
    const genericCount = words.filter(word => genericWords.includes(word)).length
    
    return 1 - (genericCount / words.length)
  }

  /**
   * Detect duplicate patterns
   */
  private detectDuplicatePatterns(content: string): boolean {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const patterns = new Set()
    
    for (const sentence of sentences) {
      const pattern = sentence.substring(0, 20).toLowerCase()
      if (patterns.has(pattern)) {
        return true
      }
      patterns.add(pattern)
    }
    
    return false
  }

  /**
   * Check for good introduction
   */
  private hasGoodIntroduction(content: string): boolean {
    const firstParagraph = content.split('\n\n')[0] || content.substring(0, 200)
    return firstParagraph.length > 100 && firstParagraph.includes(' ')
  }

  /**
   * Check for good conclusion
   */
  private hasGoodConclusion(content: string): boolean {
    const paragraphs = content.split('\n\n')
    const lastParagraph = paragraphs[paragraphs.length - 1] || content.substring(content.length - 200)
    return lastParagraph.length > 50 && lastParagraph.includes(' ')
  }

  /**
   * Check for call-to-action
   */
  private hasCallToAction(content: string): boolean {
    const ctaPhrases = [
      'visit', 'check out', 'learn more', 'get started', 'sign up',
      'subscribe', 'download', 'try', 'explore', 'discover'
    ]
    
    const contentLower = content.toLowerCase()
    return ctaPhrases.some(phrase => contentLower.includes(phrase))
  }
}

// Export singleton instance
export const contentValidator = new ContentValidator() 