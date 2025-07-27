import { RSSItem } from '@/types/rss'
import { logger } from '@/lib/logger'
import { rssFeedManager } from './rss-feed-manager'
import { RSSParser } from './rss-parser'

export class FeedMonitor {
  private interval: NodeJS.Timeout | null = null
  private isMonitoring: boolean = false
  private processedItems: Set<string> = new Set()
  private lastProcessedDate: Date = new Date()
  private parser: RSSParser

  constructor() {
    this.parser = new RSSParser()
  }

  /**
   * Process a specific feed URL and return RSS items
   */
  async processFeed(feedUrl: string): Promise<RSSItem[]> {
    try {
      logger.info('Processing feed', {
        tags: ['rss', 'feed-monitor'],
        data: { feedUrl }
      })

      const items = await this.parser.parseFeed(feedUrl)
      
      logger.info('Feed processed successfully', {
        tags: ['rss', 'feed-monitor'],
        data: { feedUrl, itemsCount: items.length }
      })

      return items
    } catch (error) {
      logger.error('Failed to process feed', {
        tags: ['rss', 'feed-monitor', 'error'],
        data: { 
          feedUrl,
          error: error instanceof Error ? error.message : 'Unknown error' 
        }
      })
      return []
    }
  }

  /**
   * Start monitoring RSS feeds
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      logger.warn('Feed monitoring is already active', {
        tags: ['rss', 'feed-monitor']
      })
      return
    }

    this.isMonitoring = true
    
    // Start the monitoring interval
    this.interval = setInterval(async () => {
      await this.processFeedsDueForCheck()
    }, 60 * 1000) // Check every minute

    logger.info('RSS feed monitoring started', {
      tags: ['rss', 'feed-monitor']
    })
  }

  /**
   * Stop monitoring RSS feeds
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return
    }

    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }

    this.isMonitoring = false
    
    logger.info('RSS feed monitoring stopped', {
      tags: ['rss', 'feed-monitor']
    })
  }

  /**
   * Get monitoring status
   */
  isMonitoringActive(): boolean {
    return this.isMonitoring
  }

  /**
   * Process feeds that are due for checking
   */
  private async processFeedsDueForCheck(): Promise<void> {
    try {
      const feeds = await rssFeedManager.getFeeds()
      const activeFeeds = feeds.filter(feed => feed.isActive)
      
      if (activeFeeds.length === 0) {
        return
      }

      const now = new Date()
      const feedsToCheck = activeFeeds.filter(feed => {
        const timeSinceLastCheck = now.getTime() - feed.lastChecked.getTime()
        const checkIntervalMs = feed.checkInterval * 60 * 1000 // Convert minutes to milliseconds
        return timeSinceLastCheck >= checkIntervalMs
      })

      if (feedsToCheck.length === 0) {
        return
      }

      logger.info('Processing feeds due for check', {
        tags: ['rss', 'feed-monitor'],
        data: { feedsToCheck: feedsToCheck.length, totalFeeds: activeFeeds.length }
      })

      for (const feed of feedsToCheck) {
        try {
          const items = await rssFeedManager.checkFeed(feed.id)
          await this.processNewItems(items)
        } catch (error) {
          logger.error('Failed to process feed during monitoring', {
            tags: ['rss', 'feed-monitor', 'error'],
            data: { 
              feedId: feed.id, 
              feedName: feed.name,
              error: error instanceof Error ? error.message : 'Unknown error' 
            }
          })
        }
      }
    } catch (error) {
      logger.error('Failed to process feeds due for check', {
        tags: ['rss', 'feed-monitor', 'error'],
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      })
    }
  }

  /**
   * Process new RSS items
   */
  async processNewItems(items: RSSItem[]): Promise<void> {
    try {
      if (items.length === 0) {
        return
      }

      logger.info('Processing new RSS items', {
        tags: ['rss', 'feed-monitor'],
        data: { itemsCount: items.length }
      })

      // Filter relevant items
      const relevantItems = await this.filterRelevantItems(items)
      
      if (relevantItems.length === 0) {
        logger.info('No relevant items found', {
          tags: ['rss', 'feed-monitor'],
          data: { totalItems: items.length, relevantItems: 0 }
        })
        return
      }

      // Process each relevant item
      for (const item of relevantItems) {
        try {
          await this.processItem(item)
        } catch (error) {
          logger.error('Failed to process individual item', {
            tags: ['rss', 'feed-monitor', 'error'],
            data: { 
              itemTitle: item.title,
              itemLink: item.link,
              error: error instanceof Error ? error.message : 'Unknown error' 
            }
          })
        }
      }

      logger.info('Completed processing RSS items', {
        tags: ['rss', 'feed-monitor'],
        data: { 
          totalItems: items.length, 
          relevantItems: relevantItems.length,
          processedItems: relevantItems.length
        }
      })
    } catch (error) {
      logger.error('Failed to process new RSS items', {
        tags: ['rss', 'feed-monitor', 'error'],
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      })
    }
  }

  /**
   * Filter relevant RSS items
   */
  async filterRelevantItems(items: RSSItem[]): Promise<RSSItem[]> {
    const relevantItems: RSSItem[] = []

    for (const item of items) {
      // Check if item has already been processed
      if (this.processedItems.has(item.link)) {
        continue
      }

      // Check if item is recent (within last 24 hours)
      const oneDayAgo = new Date()
      oneDayAgo.setDate(oneDayAgo.getDate() - 1)
      
      if (item.pubDate < oneDayAgo) {
        continue
      }

      // Check relevance score
      const relevanceScore = await this.calculateRelevanceScore(item)
      if (relevanceScore >= 70) { // Minimum relevance score
        relevantItems.push(item)
      }
    }

    return relevantItems
  }

  /**
   * Calculate relevance score for an RSS item
   */
  private async calculateRelevanceScore(item: RSSItem): Promise<number> {
    let score = 0
    const text = (item.title + ' ' + item.description).toLowerCase()

    // Define relevance keywords and their weights
    const relevanceKeywords = {
      high: ['transfer', 'injury', 'match', 'prediction', 'odds', 'betting', 'analysis'],
      medium: ['team', 'player', 'league', 'season', 'championship', 'cup'],
      low: ['news', 'update', 'report', 'announcement']
    }

    // Check for high-priority keywords
    relevanceKeywords.high.forEach(keyword => {
      if (text.includes(keyword)) {
        score += 20
      }
    })

    // Check for medium-priority keywords
    relevanceKeywords.medium.forEach(keyword => {
      if (text.includes(keyword)) {
        score += 10
      }
    })

    // Check for low-priority keywords
    relevanceKeywords.low.forEach(keyword => {
      if (text.includes(keyword)) {
        score += 5
      }
    })

    // Bonus for recent items
    const hoursSincePublished = (Date.now() - item.pubDate.getTime()) / (1000 * 60 * 60)
    if (hoursSincePublished < 1) {
      score += 15 // Very recent
    } else if (hoursSincePublished < 6) {
      score += 10 // Recent
    } else if (hoursSincePublished < 24) {
      score += 5 // Within a day
    }

    // Bonus for high-priority sources
    const highPrioritySources = ['bbc', 'sky', 'espn', 'goal']
    if (highPrioritySources.some(source => item.source.toLowerCase().includes(source))) {
      score += 10
    }

    return Math.min(score, 100) // Cap at 100
  }

  /**
   * Process individual RSS item
   */
  private async processItem(item: RSSItem): Promise<void> {
    try {
      // Check if we should generate content for this item
      if (await this.shouldGenerateContent(item)) {
        // TODO: Integrate with OpenAI content generation
        logger.info('Item selected for content generation', {
          tags: ['rss', 'feed-monitor', 'content-generation'],
          data: { 
            title: item.title,
            category: item.category,
            relevanceScore: await this.calculateRelevanceScore(item)
          }
        })

        // For now, just mark as processed
        this.processedItems.add(item.link)
      } else {
        // Mark as processed even if not generating content
        this.processedItems.add(item.link)
      }
    } catch (error) {
      logger.error('Failed to process item', {
        tags: ['rss', 'feed-monitor', 'error'],
        data: { 
          itemTitle: item.title,
          error: error instanceof Error ? error.message : 'Unknown error' 
        }
      })
    }
  }

  /**
   * Check if content should be generated for an item
   */
  private async shouldGenerateContent(item: RSSItem): Promise<boolean> {
    // Check if we've already processed this item
    if (this.processedItems.has(item.link)) {
      return false
    }

    // Check relevance score
    const relevanceScore = await this.calculateRelevanceScore(item)
    if (relevanceScore < 70) {
      return false
    }

    // Check daily limit (max 3 articles per day)
    const today = new Date().toDateString()
    const todayProcessed = Array.from(this.processedItems).filter(link => {
      // This is a simplified check - in a real implementation, you'd track dates
      return true // For now, assume we haven't hit the limit
    }).length

    if (todayProcessed >= 3) {
      return false
    }

    // Check for similar recent content
    const hasSimilarContent = await this.checkSimilarContent(item)
    if (hasSimilarContent) {
      return false
    }

    return true
  }

  /**
   * Check for similar recent content
   */
  private async checkSimilarContent(item: RSSItem): Promise<boolean> {
    // This is a simplified implementation
    // In a real system, you'd compare with recently generated content
    const similarKeywords = ['transfer', 'injury', 'match', 'prediction']
    const itemText = (item.title + ' ' + item.description).toLowerCase()
    
    // Check if this item is too similar to recently processed items
    // For now, return false (no similar content found)
    return false
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStats(): {
    isActive: boolean
    processedItemsCount: number
    lastProcessedDate: Date
    uptime: number
  } {
    return {
      isActive: this.isMonitoring,
      processedItemsCount: this.processedItems.size,
      lastProcessedDate: this.lastProcessedDate,
      uptime: this.isMonitoring ? Date.now() - this.lastProcessedDate.getTime() : 0
    }
  }

  /**
   * Clear processed items cache
   */
  clearProcessedItems(): void {
    this.processedItems.clear()
    this.lastProcessedDate = new Date()
    
    logger.info('Cleared processed items cache', {
      tags: ['rss', 'feed-monitor']
    })
  }

  /**
   * Get processed items count
   */
  getProcessedItemsCount(): number {
    return this.processedItems.size
  }
}

// Export singleton instance
export const feedMonitor = new FeedMonitor() 