import { RSSItem } from '@/types/rss'
import { logger } from '@/lib/logger'
import * as cheerio from 'cheerio'

export class RSSParser {
  private readonly timeout = 10000
  private readonly maxItems = 50

  /**
   * Parse RSS feed from URL
   */
  async parseFeed(url: string): Promise<RSSItem[]> {
    try {
      logger.info('Starting RSS feed parsing', {
        tags: ['rss', 'parser'],
        data: { sourceUrl: url }
      })

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'SnapBet AI RSS Parser/1.0'
        },
        signal: AbortSignal.timeout(this.timeout)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const xmlContent = await response.text()
      const items = await this.parseXMLContent(xmlContent, url)

      logger.info('RSS feed parsing completed', {
        tags: ['rss', 'parser'],
        data: { 
          sourceUrl: url, 
          itemsFound: items.length 
        }
      })

      return items
    } catch (error) {
      logger.error('Failed to parse RSS feed', {
        tags: ['rss', 'parser', 'error'],
        data: { 
          sourceUrl: url, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }
      })
      throw error
    }
  }

  /**
   * Parse XML content using Cheerio (Node.js compatible)
   */
  private async parseXMLContent(xmlContent: string, sourceUrl: string): Promise<RSSItem[]> {
    try {
      const $ = cheerio.load(xmlContent, { xmlMode: true })
      const items: RSSItem[] = []

      // Handle RSS 2.0 format
      $('item').each((index, element) => {
        if (index >= this.maxItems) return false

        const $item = $(element)
        const item = this.parseRSSItem($item, sourceUrl)
        
        if (item) {
          items.push(item)
        }
      })

      // Handle Atom format if no RSS items found
      if (items.length === 0) {
        $('entry').each((index, element) => {
          if (index >= this.maxItems) return false

          const $entry = $(element)
          const item = this.parseAtomEntry($entry, sourceUrl)
          
          if (item) {
            items.push(item)
          }
        })
      }

      // Filter and validate items
      const validItems = await this.filterValidItems(items)
      
      return validItems
    } catch (error) {
      logger.error('Failed to parse XML content', {
        tags: ['rss', 'parser', 'xml', 'error'],
        data: { 
          sourceUrl, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }
      })
      throw error
    }
  }

  /**
   * Parse RSS 2.0 item
   */
  private parseRSSItem($item: cheerio.Cheerio<any>, sourceUrl: string): RSSItem | null {
    try {
      const title = $item.find('title').text().trim()
      const description = $item.find('description').text().trim()
      const link = $item.find('link').text().trim()
      const pubDateStr = $item.find('pubDate').text().trim()
      const guid = $item.find('guid').text().trim()
      const author = $item.find('author').text().trim()

      if (!title || !link) {
        return null
      }

      const pubDate = pubDateStr ? new Date(pubDateStr) : new Date()
      const source = this.extractSourceFromUrl(sourceUrl)

      // Extract content from CDATA or description - using safer approach
      let content = description
      
      // Try to find content:encoded using a safer method
      try {
        const contentEncoded = $item.find('content\\:encoded').text()
        if (contentEncoded) {
          content = contentEncoded
        }
      } catch (error) {
        // If content:encoded fails, try alternative methods
        try {
          const contentElement = $item.find('content')
          if (contentElement.length > 0) {
            const contentText = contentElement.text().trim()
            if (contentText) {
              content = contentText
            }
          }
        } catch (innerError) {
          // Fall back to description
          logger.debug('Using description as content fallback', {
            tags: ['rss', 'parser'],
            data: { sourceUrl }
          })
        }
      }

      // Extract keywords from tags
      const keywords: string[] = []
      $item.find('category').each((index, element) => {
        const keyword = $item.find(element).text().trim()
        if (keyword) {
          keywords.push(keyword)
        }
      })

      // Extract image URL using safer selectors
      let imageUrl: string | undefined
      try {
        const enclosureUrl = $item.find('enclosure[type^="image"]').attr('url')
        const mediaContentUrl = $item.find('media\\:content[type^="image"]').attr('url')
        const mediaThumbnailUrl = $item.find('media\\:thumbnail').attr('url')
        const extractedImageUrl = this.extractImageFromContent(content)
        
        imageUrl = enclosureUrl || mediaContentUrl || mediaThumbnailUrl || extractedImageUrl || undefined
      } catch (error) {
        // If image extraction fails, try to extract from content
        imageUrl = this.extractImageFromContent(content) || undefined
      }

      // Handle null values from attr() calls
      if (imageUrl === null) {
        imageUrl = undefined
      }

      return {
        title,
        description,
        link,
        pubDate,
        source,
        category: this.determineCategory(title, description),
        keywords,
        guid,
        author: author || undefined,
        content: content || undefined,
        imageUrl: imageUrl || undefined
      }
    } catch (error) {
      logger.error('Failed to parse RSS item', {
        tags: ['rss', 'parser', 'error'],
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      })
      return null
    }
  }

  /**
   * Parse Atom entry
   */
  private parseAtomEntry($entry: cheerio.Cheerio<any>, sourceUrl: string): RSSItem | null {
    try {
      const title = $entry.find('title').text().trim()
      const summary = $entry.find('summary').text().trim()
      const link = $entry.find('link').attr('href') || $entry.find('link').text().trim()
      const publishedStr = $entry.find('published').text().trim()
      const updatedStr = $entry.find('updated').text().trim()
      const id = $entry.find('id').text().trim()

      if (!title || !link) {
        return null
      }

      const pubDate = publishedStr ? new Date(publishedStr) : 
                     updatedStr ? new Date(updatedStr) : new Date()
      const source = this.extractSourceFromUrl(sourceUrl)

      // Extract content
      let content = summary
      const contentElement = $entry.find('content')
      if (contentElement.length > 0) {
        const contentText = contentElement.text().trim()
        if (contentText) {
          content = contentText
        }
      }

      // Extract keywords from categories
      const keywords: string[] = []
      $entry.find('category').each((index, element) => {
        const keyword = $entry.find(element).attr('term') || $entry.find(element).text().trim()
        if (keyword) {
          keywords.push(keyword)
        }
      })

      return {
        title,
        description: summary,
        link,
        pubDate,
        source,
        category: this.determineCategory(title, summary),
        keywords,
        guid: id,
        content: content || undefined
      }
    } catch (error) {
      logger.error('Failed to parse Atom entry', {
        tags: ['rss', 'parser', 'error'],
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      })
      return null
    }
  }

  /**
   * Filter and validate items
   */
  private async filterValidItems(items: RSSItem[]): Promise<RSSItem[]> {
    const validItems: RSSItem[] = []

    for (const item of items) {
      const isValid = await this.validateItem(item)
      if (isValid) {
        validItems.push(item)
      }
    }

    return validItems
  }

  /**
   * Validate RSS item
   */
  private async validateItem(item: RSSItem): Promise<boolean> {
    // Basic validation
    if (!item.title || item.title.length < 10) return false
    if (!item.description || item.description.length < 20) return false
    if (!item.link || !item.link.startsWith('http')) return false

    // Check for spam indicators
    const spamKeywords = ['casino', 'bonus', 'free money', 'click here', 'limited time']
    const content = (item.title + ' ' + item.description).toLowerCase()
    
    if (spamKeywords.some(keyword => content.includes(keyword))) {
      return false
    }

    return true
  }

  /**
   * Parse date string
   */
  private parseDate(dateString: string): Date {
    try {
      // Try parsing various date formats
      const date = new Date(dateString)
      if (!isNaN(date.getTime())) {
        return date
      }

      // Fallback to current date
      return new Date()
    } catch (error) {
      return new Date()
    }
  }

  /**
   * Extract source name from URL
   */
  private extractSourceName(url: string): string {
    try {
      const urlObj = new URL(url)
      const hostname = urlObj.hostname.replace('www.', '')
      
      // Map common domains to readable names
      const sourceMap: { [key: string]: string } = {
        'bbci.co.uk': 'BBC Sport',
        'skysports.com': 'Sky Sports',
        'espn.com': 'ESPN',
        'goal.com': 'Goal.com',
        'transfermarkt.com': 'Transfermarkt',
        'theguardian.com': 'The Guardian',
        'telegraph.co.uk': 'The Telegraph',
        'independent.co.uk': 'The Independent'
      }

      return sourceMap[hostname] || hostname
    } catch (error) {
      return 'Unknown Source'
    }
  }

  /**
   * Extract source from URL (alias for extractSourceName)
   */
  private extractSourceFromUrl(url: string): string {
    return this.extractSourceName(url)
  }

  /**
   * Determine category based on title and description
   */
  private determineCategory(title: string, description: string): string {
    const content = (title + ' ' + description).toLowerCase()
    
    if (content.includes('transfer') || content.includes('signing')) {
      return 'transfer-news'
    } else if (content.includes('match') || content.includes('vs') || content.includes('v ')) {
      return 'match-analysis'
    } else if (content.includes('league') || content.includes('table') || content.includes('standings')) {
      return 'league-analysis'
    } else if (content.includes('bet') || content.includes('odds') || content.includes('prediction')) {
      return 'betting-trends'
    } else {
      return 'general'
    }
  }

  /**
   * Extract image URL from content
   */
  private extractImageFromContent(content: string): string | null {
    const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i)
    return imgMatch ? imgMatch[1] : null
  }

  /**
   * Extract keywords from content
   */
  private extractKeywords(content: string): string[] {
    // Simple keyword extraction - in a real implementation, you might use NLP
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !this.isStopWord(word))

    // Count word frequency
    const wordCount: { [key: string]: number } = {}
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1
    })

    // Return top 5 most frequent words
    return Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word)
  }

  /**
   * Check if word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = [
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
      'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before',
      'after', 'above', 'below', 'between', 'among', 'within', 'without',
      'this', 'that', 'these', 'those', 'is', 'are', 'was', 'were', 'be',
      'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'could', 'should', 'may', 'might', 'must', 'can', 'shall'
    ]
    return stopWords.includes(word)
  }

  /**
   * Categorize RSS item
   */
  private categorizeItem(item: RSSItem): string {
    return this.determineCategory(item.title, item.description)
  }
}

// Export singleton instance
export const rssParser = new RSSParser() 