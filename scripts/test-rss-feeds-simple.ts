import { rssFeedManager } from '../lib/rss/rss-feed-manager'

async function testRSSFeedsSimple() {
  console.log('🧪 Testing RSS Feeds (Simple)...\n')

  try {
    // Test 1: Get feeds
    console.log('📋 Test 1: Getting RSS feeds...')
    const feeds = await rssFeedManager.getFeeds()
    console.log(`✅ Found ${feeds.length} RSS feeds`)
    
    feeds.forEach(feed => {
      console.log(`   - ${feed.name}: ${feed.url}`)
    })

    // Test 2: Test individual feeds
    console.log('\n📰 Test 2: Testing individual feeds...')
    
    for (const feed of feeds.slice(0, 2)) { // Test first 2 feeds
      try {
        console.log(`\n   Testing: ${feed.name}`)
        const items = await rssFeedManager.checkFeed(feed.id)
        console.log(`   ✅ Found ${items.length} items`)
        
        if (items.length > 0) {
          console.log('   Sample items:')
          items.slice(0, 3).forEach((item, index) => {
            console.log(`   ${index + 1}. ${item.title}`)
            console.log(`      Published: ${item.pubDate.toISOString()}`)
          })
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error}`)
      }
    }

    // Test 3: Test all feeds
    console.log('\n🌐 Test 3: Testing all feeds...')
    try {
      const allItems = await rssFeedManager.checkAllFeeds()
      console.log(`✅ Total items found: ${allItems.length}`)
      
      if (allItems.length > 0) {
        console.log('   Sample items from all feeds:')
        allItems.slice(0, 5).forEach((item, index) => {
          console.log(`   ${index + 1}. ${item.title}`)
          console.log(`      Source: ${item.source}`)
        })
      }
    } catch (error) {
      console.log(`❌ Error testing all feeds: ${error}`)
    }

    console.log('\n✅ RSS feed testing completed!')

  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

// Run the test
testRSSFeedsSimple().catch(console.error) 