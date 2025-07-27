import { FeedMonitor } from '../lib/rss/feed-monitor'
import { rssFeedManager } from '../lib/rss/rss-feed-manager'

async function testRSSFeedMonitoring() {
  console.log('🧪 Testing RSS Feed Monitoring System...\n')

  const feedMonitor = new FeedMonitor()

  try {
    // Test 1: Check if we can get feeds from the manager
    console.log('📋 Test 1: Fetching RSS feeds from manager...')
    const feeds = await rssFeedManager.getFeeds()
    console.log(`✅ Found ${feeds.length} RSS feeds configured`)
    
    feeds.forEach(feed => {
      console.log(`   - ${feed.name}: ${feed.url} (${feed.isActive ? 'Active' : 'Inactive'})`)
    })

    // Test 2: Test processing a single feed
    if (feeds.length > 0) {
      const testFeed = feeds[0]
      console.log(`\n📰 Test 2: Processing feed "${testFeed.name}"...`)
      
      const items = await feedMonitor.processFeed(testFeed.url)
      console.log(`✅ Processed ${items.length} items from ${testFeed.name}`)
      
      if (items.length > 0) {
        console.log('   Sample items:')
        items.slice(0, 3).forEach((item, index) => {
          console.log(`   ${index + 1}. ${item.title}`)
          console.log(`      Source: ${item.source}`)
          console.log(`      Published: ${item.pubDate.toISOString()}`)
        })
      }
    }

    // Test 3: Test relevance filtering
    console.log('\n🎯 Test 3: Testing relevance filtering...')
    const mockItems = [
      {
        title: 'Transfer News: Star Player Joins Big Club',
        description: 'Major transfer announcement with betting implications',
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
    console.log(`✅ Filtered ${relevantItems.length} relevant items from ${mockItems.length} total`)
    
    relevantItems.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.title} (Relevant: ✅)`)
    })

    // Test 4: Test monitoring controls
    console.log('\n🔄 Test 4: Testing monitoring controls...')
    console.log(`   Initial state: ${feedMonitor.isMonitoringActive() ? 'Active' : 'Inactive'}`)
    
    feedMonitor.startMonitoring()
    console.log(`   After start: ${feedMonitor.isMonitoringActive() ? 'Active' : 'Inactive'}`)
    
    const stats = feedMonitor.getMonitoringStats()
    console.log(`   Monitoring stats:`, stats)
    
    feedMonitor.stopMonitoring()
    console.log(`   After stop: ${feedMonitor.isMonitoringActive() ? 'Active' : 'Inactive'}`)

    // Test 5: Test processing all feeds
    console.log('\n🌐 Test 5: Processing all active feeds...')
    const allItems: any[] = []
    
    for (const feed of feeds) {
      if (feed.isActive) {
        try {
          const items = await feedMonitor.processFeed(feed.url)
          console.log(`   ${feed.name}: ${items.length} items`)
          allItems.push(...items)
        } catch (error) {
          console.log(`   ${feed.name}: Error - ${error}`)
        }
      }
    }
    
    console.log(`✅ Total items processed: ${allItems.length}`)

    // Test 6: Test relevance filtering on real data
    if (allItems.length > 0) {
      console.log('\n🎯 Test 6: Testing relevance filtering on real data...')
      const relevantRealItems = await feedMonitor.filterRelevantItems(allItems)
      console.log(`✅ Found ${relevantRealItems.length} relevant items from ${allItems.length} total`)
      
      if (relevantRealItems.length > 0) {
        console.log('   Top relevant items:')
        relevantRealItems.slice(0, 5).forEach((item, index) => {
          console.log(`   ${index + 1}. ${item.title}`)
          console.log(`      Source: ${item.source}`)
          console.log(`      Category: ${item.category}`)
        })
      }
    }

    console.log('\n✅ All RSS feed monitoring tests completed successfully!')

  } catch (error) {
    console.error('❌ Test failed:', error)
  } finally {
    feedMonitor.stopMonitoring()
  }
}

// Run the test
testRSSFeedMonitoring().catch(console.error) 