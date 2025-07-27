import { FeedMonitor } from '@/lib/rss/feed-monitor'
import { BlogAutomationService } from '@/lib/blog/blog-automation-service'
import { RSSItem } from '@/types/rss'
import { rssFeedManager } from '@/lib/rss/rss-feed-manager'

export class AutomationWorkflowManager {
  private feedMonitor: FeedMonitor
  private blogAutomationService: BlogAutomationService
  private isRunning: boolean = false
  private dailyLimit: number = 3
  private processedToday: number = 0
  private lastResetDate: string = ''

  constructor() {
    this.feedMonitor = new FeedMonitor()
    this.blogAutomationService = new BlogAutomationService()
  }

  /**
   * Start the automation workflow
   */
  async startAutomation(): Promise<void> {
    if (this.isRunning) {
      console.log('Automation workflow is already running')
      return
    }

    this.isRunning = true
    console.log('🚀 Starting blog automation workflow')

    // Reset daily counter if it's a new day
    this.resetDailyCounter()

    // Start monitoring RSS feeds
    this.feedMonitor.startMonitoring()

    // Set up interval for processing
    setInterval(async () => {
      await this.processNewItems()
    }, 30 * 60 * 1000) // Check every 30 minutes

    console.log('✅ Blog automation workflow started successfully')
  }

  /**
   * Stop the automation workflow
   */
  async stopAutomation(): Promise<void> {
    this.isRunning = false
    this.feedMonitor.stopMonitoring()
    console.log('🛑 Blog automation workflow stopped')
  }

  /**
   * Process new RSS items
   */
  private async processNewItems(): Promise<void> {
    if (!this.isRunning) return

    try {
      console.log('📰 Checking for new RSS items...')

      // Get all feeds and process them
      const feeds = await rssFeedManager.getFeeds()
      const newItems: RSSItem[] = []
      
      for (const feed of feeds) {
        if (feed.isActive) {
          const items = await this.feedMonitor.processFeed(feed.url)
          newItems.push(...items)
        }
      }
      
      if (newItems.length === 0) {
        console.log('No new items found')
        return
      }

      console.log(`Found ${newItems.length} new items`)

      // Filter relevant items
      const relevantItems = await this.filterRelevantItems(newItems)
      
      if (relevantItems.length === 0) {
        console.log('No relevant items found')
        return
      }

      console.log(`Processing ${relevantItems.length} relevant items`)

      // Process items within daily limit
      for (const item of relevantItems) {
        if (this.processedToday >= this.dailyLimit) {
          console.log(`Daily limit reached (${this.dailyLimit} articles)`)
          break
        }

        const result = await this.blogAutomationService.processNewsItem(item)
        if (result) {
          this.processedToday++
          console.log(`✅ Generated blog post: ${result.title}`)
        }
      }

    } catch (error) {
      console.error('Error processing new items:', error)
    }
  }

  /**
   * Filter relevant items for content generation
   */
  private async filterRelevantItems(items: RSSItem[]): Promise<RSSItem[]> {
    const relevantItems: RSSItem[] = []
    const triggerKeywords = [
      'transfer', 'injury', 'match', 'prediction', 'odds',
      'betting', 'analysis', 'preview', 'review', 'standings',
      'league', 'team', 'player', 'coach', 'manager'
    ]

    for (const item of items) {
      const title = item.title.toLowerCase()
      const description = item.description.toLowerCase()
      const content = title + ' ' + description

      // Check for trigger keywords
      const hasTriggerKeywords = triggerKeywords.some(keyword => 
        content.includes(keyword)
      )

      if (hasTriggerKeywords) {
        // Calculate relevance score
        const relevanceScore = this.calculateRelevanceScore(item)
        
        if (relevanceScore >= 70) {
          relevantItems.push(item)
        }
      }
    }

    // Sort by relevance score (highest first)
    return relevantItems.sort((a, b) => 
      this.calculateRelevanceScore(b) - this.calculateRelevanceScore(a)
    )
  }

  /**
   * Calculate relevance score for an item
   */
  private calculateRelevanceScore(item: RSSItem): number {
    let score = 0
    const title = item.title.toLowerCase()
    const description = item.description.toLowerCase()

    // High-priority keywords
    const highPriorityKeywords = ['transfer', 'injury', 'match', 'prediction']
    highPriorityKeywords.forEach(keyword => {
      if (title.includes(keyword)) score += 20
      if (description.includes(keyword)) score += 10
    })

    // Medium-priority keywords
    const mediumPriorityKeywords = ['betting', 'odds', 'analysis', 'preview']
    mediumPriorityKeywords.forEach(keyword => {
      if (title.includes(keyword)) score += 15
      if (description.includes(keyword)) score += 8
    })

    // Source priority
    const highPrioritySources = ['bbc', 'sky sports', 'espn']
    if (highPrioritySources.some(source => item.source.toLowerCase().includes(source))) {
      score += 10
    }

    // Recency bonus (items from last 24 hours get bonus)
    const hoursSincePublished = (Date.now() - new Date(item.pubDate).getTime()) / (1000 * 60 * 60)
    if (hoursSincePublished <= 24) {
      score += 10
    }

    return Math.min(score, 100)
  }

  /**
   * Reset daily counter if it's a new day
   */
  private resetDailyCounter(): void {
    const today = new Date().toDateString()
    
    if (this.lastResetDate !== today) {
      this.processedToday = 0
      this.lastResetDate = today
      console.log('🔄 Daily counter reset')
    }
  }

  /**
   * Get automation statistics
   */
  async getStatistics(): Promise<{
    isRunning: boolean
    processedToday: number
    dailyLimit: number
    lastResetDate: string
    feedStatus: any
  }> {
    return {
      isRunning: this.isRunning,
      processedToday: this.processedToday,
      dailyLimit: this.dailyLimit,
      lastResetDate: this.lastResetDate,
      feedStatus: this.feedMonitor.getMonitoringStats()
    }
  }

  /**
   * Set daily limit
   */
  setDailyLimit(limit: number): void {
    this.dailyLimit = limit
    console.log(`Daily limit set to ${limit} articles`)
  }

  /**
   * Manually trigger processing
   */
  async triggerProcessing(): Promise<void> {
    console.log('🔄 Manually triggering processing...')
    await this.processNewItems()
  }

  /**
   * Reset daily counter (for testing/admin purposes)
   */
  resetDailyCounterManually(): void {
    this.processedToday = 0
    this.lastResetDate = new Date().toDateString()
    console.log('🔄 Daily counter manually reset')
  }
}

// Export singleton instance
export const automationWorkflowManager = new AutomationWorkflowManager() 