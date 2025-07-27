import { RSSFeed, RSSItem } from '@/types/rss'
import { logger } from '@/lib/logger'
import { RSSParser } from '@/lib/rss/rss-parser'

export class RSSFeedManager {
  private feeds: RSSFeed[] = []
  private parser: RSSParser
  private isMonitoring: boolean = false
  private monitoringInterval: NodeJS.Timeout | null = null

  constructor() {
    this.parser = new RSSParser()
    this.loadDefaultFeeds()
  }

  /**
   * Add a new RSS feed to the manager
   */
  async addFeed(feed: RSSFeed): Promise<void> {
    try {
      // Validate feed URL
      const isValid = await this.validateFeedUrl(feed.url)
      if (!isValid) {
        throw new Error(`Invalid RSS feed URL: ${feed.url}`)
      }

      // Check if feed already exists
      const existingFeed = this.feeds.find(f => f.id === feed.id || f.url === feed.url)
      if (existingFeed) {
        throw new Error(`Feed already exists: ${feed.id}`)
      }

      // Set default values
      const newFeed: RSSFeed = {
        ...feed,
        isActive: feed.isActive ?? true,
        lastChecked: new Date(),
        checkInterval: feed.checkInterval ?? 30
      }

      this.feeds.push(newFeed)
      
      logger.info('RSS feed added successfully', {
        tags: ['rss', 'feed-manager'],
        data: { feedId: feed.id, feedName: feed.name, feedUrl: feed.url }
      })
    } catch (error) {
      logger.error('Failed to add RSS feed', {
        tags: ['rss', 'feed-manager', 'error'],
        data: { feed, error: error instanceof Error ? error.message : 'Unknown error' }
      })
      throw error
    }
  }

  /**
   * Remove an RSS feed from the manager
   */
  async removeFeed(feedId: string): Promise<void> {
    try {
      const feedIndex = this.feeds.findIndex(f => f.id === feedId)
      if (feedIndex === -1) {
        throw new Error(`Feed not found: ${feedId}`)
      }

      const removedFeed = this.feeds.splice(feedIndex, 1)[0]
      
      logger.info('RSS feed removed successfully', {
        tags: ['rss', 'feed-manager'],
        data: { feedId, feedName: removedFeed.name }
      })
    } catch (error) {
      logger.error('Failed to remove RSS feed', {
        tags: ['rss', 'feed-manager', 'error'],
        data: { feedId, error: error instanceof Error ? error.message : 'Unknown error' }
      })
      throw error
    }
  }

  /**
   * Update an existing RSS feed
   */
  async updateFeed(feed: RSSFeed): Promise<void> {
    try {
      const feedIndex = this.feeds.findIndex(f => f.id === feed.id)
      if (feedIndex === -1) {
        throw new Error(`Feed not found: ${feed.id}`)
      }

      // Validate feed URL if it's being changed
      if (feed.url !== this.feeds[feedIndex].url) {
        const isValid = await this.validateFeedUrl(feed.url)
        if (!isValid) {
          throw new Error(`Invalid RSS feed URL: ${feed.url}`)
        }
      }

      // Preserve lastChecked if not provided
      const updatedFeed: RSSFeed = {
        ...feed,
        lastChecked: feed.lastChecked ?? this.feeds[feedIndex].lastChecked
      }

      this.feeds[feedIndex] = updatedFeed
      
      logger.info('RSS feed updated successfully', {
        tags: ['rss', 'feed-manager'],
        data: { feedId: feed.id, feedName: feed.name }
      })
    } catch (error) {
      logger.error('Failed to update RSS feed', {
        tags: ['rss', 'feed-manager', 'error'],
        data: { feed, error: error instanceof Error ? error.message : 'Unknown error' }
      })
      throw error
    }
  }

  /**
   * Get all RSS feeds
   */
  async getFeeds(): Promise<RSSFeed[]> {
    return [...this.feeds]
  }

  /**
   * Get a specific RSS feed by ID
   */
  async getFeed(feedId: string): Promise<RSSFeed | null> {
    return this.feeds.find(f => f.id === feedId) || null
  }

  /**
   * Check a specific RSS feed for new items
   */
  async checkFeed(feedId: string): Promise<RSSItem[]> {
    try {
      const feed = this.feeds.find(f => f.id === feedId)
      if (!feed) {
        throw new Error(`Feed not found: ${feedId}`)
      }

      if (!feed.isActive) {
        logger.info('Skipping inactive feed', {
          tags: ['rss', 'feed-manager'],
          data: { feedId, feedName: feed.name }
        })
        return []
      }

      const items = await this.parser.parseFeed(feed.url)
      
      // Update last checked time
      const feedIndex = this.feeds.findIndex(f => f.id === feedId)
      if (feedIndex !== -1) {
        this.feeds[feedIndex].lastChecked = new Date()
      }

      logger.info('RSS feed checked successfully', {
        tags: ['rss', 'feed-manager'],
        data: { 
          feedId, 
          feedName: feed.name, 
          itemsFound: items.length,
          lastChecked: new Date()
        }
      })

      return items
    } catch (error) {
      logger.error('Failed to check RSS feed', {
        tags: ['rss', 'feed-manager', 'error'],
        data: { 
          feedId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }
      })
      throw error
    }
  }

  /**
   * Check all active RSS feeds for new items
   */
  async checkAllFeeds(): Promise<RSSItem[]> {
    try {
      const activeFeeds = this.feeds.filter(f => f.isActive)
      const allItems: RSSItem[] = []

      logger.info('Starting check of all RSS feeds', {
        tags: ['rss', 'feed-manager'],
        data: { totalFeeds: this.feeds.length, activeFeeds: activeFeeds.length }
      })

      for (const feed of activeFeeds) {
        try {
          const items = await this.checkFeed(feed.id)
          allItems.push(...items)
        } catch (error) {
          logger.error('Failed to check individual feed', {
            tags: ['rss', 'feed-manager', 'error'],
            data: { 
              feedId: feed.id, 
              feedName: feed.name,
              error: error instanceof Error ? error.message : 'Unknown error' 
            }
          })
          // Continue with other feeds even if one fails
        }
      }

      logger.info('Completed check of all RSS feeds', {
        tags: ['rss', 'feed-manager'],
        data: { 
          totalFeeds: activeFeeds.length, 
          totalItems: allItems.length 
        }
      })

      return allItems
    } catch (error) {
      logger.error('Failed to check all RSS feeds', {
        tags: ['rss', 'feed-manager', 'error'],
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      })
      throw error
    }
  }

  /**
   * Start monitoring all feeds at their specified intervals
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      logger.warn('RSS monitoring is already active', {
        tags: ['rss', 'feed-manager']
      })
      return
    }

    this.isMonitoring = true
    
    // Check feeds every minute and process those that need checking
    this.monitoringInterval = setInterval(async () => {
      await this.processFeedsDueForCheck()
    }, 60 * 1000) // Check every minute

    logger.info('RSS feed monitoring started', {
      tags: ['rss', 'feed-manager'],
      data: { activeFeeds: this.feeds.filter(f => f.isActive).length }
    })
  }

  /**
   * Stop monitoring RSS feeds
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }

    this.isMonitoring = false
    
    logger.info('RSS feed monitoring stopped', {
      tags: ['rss', 'feed-manager']
    })
  }

  /**
   * Get monitoring status
   */
  isMonitoringActive(): boolean {
    return this.isMonitoring
  }

  /**
   * Get feeds that are due for checking
   */
  private getFeedsDueForCheck(): RSSFeed[] {
    const now = new Date()
    return this.feeds.filter(feed => {
      if (!feed.isActive) return false
      
      const timeSinceLastCheck = now.getTime() - feed.lastChecked.getTime()
      const checkIntervalMs = feed.checkInterval * 60 * 1000 // Convert minutes to milliseconds
      
      return timeSinceLastCheck >= checkIntervalMs
    })
  }

  /**
   * Process feeds that are due for checking
   */
  private async processFeedsDueForCheck(): Promise<void> {
    const feedsToCheck = this.getFeedsDueForCheck()
    
    if (feedsToCheck.length === 0) {
      return
    }

    logger.info('Processing feeds due for check', {
      tags: ['rss', 'feed-manager'],
      data: { feedsToCheck: feedsToCheck.length }
    })

    for (const feed of feedsToCheck) {
      try {
        await this.checkFeed(feed.id)
      } catch (error) {
        logger.error('Failed to process feed during monitoring', {
          tags: ['rss', 'feed-manager', 'error'],
          data: { 
            feedId: feed.id, 
            feedName: feed.name,
            error: error instanceof Error ? error.message : 'Unknown error' 
          }
        })
      }
    }
  }

  /**
   * Validate RSS feed URL
   */
  private async validateFeedUrl(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'SnapBet AI RSS Feed Manager/1.0'
        }
      })
      
      const contentType = response.headers.get('content-type')
      return response.ok && (contentType?.includes('xml') ?? false)
    } catch (error) {
      logger.error('Failed to validate RSS feed URL', {
        tags: ['rss', 'feed-manager', 'validation'],
        data: { url, error: error instanceof Error ? error.message : 'Unknown error' }
      })
      return false
    }
  }

  /**
   * Load default RSS feeds
   */
  private loadDefaultFeeds(): void {
    this.feeds = [
      {
        id: 'bbc-sports',
        name: 'BBC Sport',
        url: 'https://feeds.bbci.co.uk/sport/football/rss.xml',
        category: 'sports',
        priority: 'high',
        isActive: true,
        lastChecked: new Date(),
        checkInterval: 30
      },
      {
        id: 'sky-sports',
        name: 'Sky Sports',
        url: 'https://feeds.sky.com/sky-news-sports.xml',
        category: 'sports',
        priority: 'high',
        isActive: true,
        lastChecked: new Date(),
        checkInterval: 30
      },
      {
        id: 'goal-com',
        name: 'Goal.com',
        url: 'https://www.goal.com/en/feeds/news',
        category: 'football',
        priority: 'medium',
        isActive: true,
        lastChecked: new Date(),
        checkInterval: 60
      },
      {
        id: 'football365',
        name: 'Football365',
        url: 'https://www.football365.com/feed/',
        category: 'football',
        priority: 'medium',
        isActive: true,
        lastChecked: new Date(),
        checkInterval: 60
      },
      {
        id: 'espn-soccer',
        name: 'ESPN Soccer',
        url: 'https://www.espn.com/espn/rss/soccer/news',
        category: 'football',
        priority: 'high',
        isActive: true,
        lastChecked: new Date(),
        checkInterval: 30
      }
    ]

    logger.info('Default RSS feeds loaded', {
      tags: ['rss', 'feed-manager'],
      data: { feedsCount: this.feeds.length }
    })
  }

  /**
   * Get feed health statistics
   */
  async getFeedHealth(): Promise<{
    totalFeeds: number
    activeFeeds: number
    lastChecked: Date | null
    averageCheckInterval: number
  }> {
    const activeFeeds = this.feeds.filter(f => f.isActive)
    const lastChecked = activeFeeds.length > 0 
      ? new Date(Math.max(...activeFeeds.map(f => f.lastChecked.getTime())))
      : null
    
    const averageCheckInterval = activeFeeds.length > 0
      ? activeFeeds.reduce((sum, feed) => sum + feed.checkInterval, 0) / activeFeeds.length
      : 0

    return {
      totalFeeds: this.feeds.length,
      activeFeeds: activeFeeds.length,
      lastChecked,
      averageCheckInterval
    }
  }
}

// Export singleton instance
export const rssFeedManager = new RSSFeedManager() 