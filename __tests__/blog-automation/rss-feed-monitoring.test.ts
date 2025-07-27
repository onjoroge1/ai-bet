import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { FeedMonitor } from '@/lib/rss/feed-monitor'
import { RSSParser } from '@/lib/rss/rss-parser'
import { rssFeedManager } from '@/lib/rss/rss-feed-manager'

// Mock the RSS parser
vi.mock('@/lib/rss/rss-parser')
vi.mock('@/lib/rss/rss-feed-manager')

describe('RSS Feed Monitoring', () => {
  let feedMonitor: FeedMonitor

  beforeEach(() => {
    feedMonitor = new FeedMonitor()
    vi.clearAllMocks()
  })

  afterEach(() => {
    feedMonitor.stopMonitoring()
  })

  describe('Feed Processing', () => {
    it('should process a valid RSS feed and return items', async () => {
      const mockItems = [
        {
          title: 'Transfer News: Player X joins Team Y',
          description: 'Breaking transfer news from BBC Sport',
          link: 'https://bbc.com/sport/football/123',
          pubDate: new Date(),
          source: 'BBC Sport',
          category: 'transfer',
          keywords: ['transfer', 'football', 'player']
        }
      ]

      const mockParser = {
        parseFeed: vi.fn().mockResolvedValue(mockItems)
      }

      vi.mocked(RSSParser).mockImplementation(() => mockParser as any)

      const result = await feedMonitor.processFeed('https://feeds.bbci.co.uk/sport/rss.xml')

      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Transfer News: Player X joins Team Y')
      expect(mockParser.parseFeed).toHaveBeenCalledWith('https://feeds.bbci.co.uk/sport/rss.xml')
    })

    it('should handle RSS feed errors gracefully', async () => {
      const mockParser = {
        parseFeed: vi.fn().mockRejectedValue(new Error('Network error'))
      }

      vi.mocked(RSSParser).mockImplementation(() => mockParser as any)

      const result = await feedMonitor.processFeed('https://invalid-feed.com/rss')

      expect(result).toHaveLength(0)
    })
  })

  describe('Monitoring Controls', () => {
    it('should start and stop monitoring correctly', () => {
      expect(feedMonitor.isMonitoringActive()).toBe(false)

      feedMonitor.startMonitoring()
      expect(feedMonitor.isMonitoringActive()).toBe(true)

      feedMonitor.stopMonitoring()
      expect(feedMonitor.isMonitoringActive()).toBe(false)
    })

    it('should not start monitoring if already active', () => {
      feedMonitor.startMonitoring()
      expect(feedMonitor.isMonitoringActive()).toBe(true)

      // Should not throw error or change state
      feedMonitor.startMonitoring()
      expect(feedMonitor.isMonitoringActive()).toBe(true)
    })
  })

  describe('Relevance Filtering', () => {
    it('should filter relevant items based on keywords', async () => {
      const mockItems = [
        {
          title: 'Transfer News: Star Player Joins Big Club',
          description: 'Major transfer announcement',
          link: 'https://example.com/1',
          pubDate: new Date(),
          source: 'BBC Sport',
          category: 'transfer',
          keywords: ['transfer', 'player']
        },
        {
          title: 'Weather Update: Sunny Day Expected',
          description: 'Beautiful weather forecast',
          link: 'https://example.com/2',
          pubDate: new Date(),
          source: 'Weather Channel',
          category: 'weather',
          keywords: ['weather', 'sunny']
        }
      ]

      const relevantItems = await feedMonitor.filterRelevantItems(mockItems)

      expect(relevantItems).toHaveLength(1)
      expect(relevantItems[0].title).toContain('Transfer News')
    })

    it('should calculate relevance scores correctly', async () => {
      const item = {
        title: 'Transfer News: Star Player Joins Big Club',
        description: 'Major transfer announcement with betting implications',
        link: 'https://example.com/1',
        pubDate: new Date(),
        source: 'BBC Sport',
        category: 'transfer',
        keywords: ['transfer', 'player']
      }

      const relevantItems = await feedMonitor.filterRelevantItems([item])

      expect(relevantItems).toHaveLength(1)
      // Should have high relevance score due to transfer keyword and BBC source
      expect(relevantItems[0]).toBe(item)
    })
  })

  describe('Statistics', () => {
    it('should provide monitoring statistics', () => {
      const stats = feedMonitor.getMonitoringStats()

      expect(stats).toHaveProperty('isActive')
      expect(stats).toHaveProperty('processedItemsCount')
      expect(stats).toHaveProperty('lastProcessedDate')
      expect(stats).toHaveProperty('uptime')
      expect(typeof stats.isActive).toBe('boolean')
      expect(typeof stats.processedItemsCount).toBe('number')
    })
  })
}) 