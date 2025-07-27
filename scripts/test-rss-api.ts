async function testRSSAPI() {
  console.log('🧪 Testing RSS API Endpoints...\n')

  const baseUrl = 'http://localhost:3000'

  try {
    // Test 1: Get RSS feeds
    console.log('📋 Test 1: Testing /api/rss/feeds endpoint...')
    try {
      const response = await fetch(`${baseUrl}/api/rss/feeds`)
      if (response.ok) {
        const data = await response.json()
        console.log(`✅ RSS feeds endpoint working. Found ${data.feeds?.length || 0} feeds`)
        
        if (data.feeds && data.feeds.length > 0) {
          console.log('   Available feeds:')
          data.feeds.forEach((feed: any) => {
            console.log(`   - ${feed.name}: ${feed.url}`)
          })
        }
      } else {
        console.log(`❌ RSS feeds endpoint returned status: ${response.status}`)
      }
    } catch (error) {
      console.log(`❌ RSS feeds endpoint error: ${error}`)
    }

    // Test 2: Test RSS monitoring status
    console.log('\n📊 Test 2: Testing /api/rss/monitoring endpoint...')
    try {
      const response = await fetch(`${baseUrl}/api/rss/monitoring`)
      if (response.ok) {
        const data = await response.json()
        console.log(`✅ RSS monitoring endpoint working.`)
        console.log(`   Is Active: ${data.isActive}`)
        console.log(`   Processed Items: ${data.processedItems}`)
        console.log(`   Active Feeds: ${data.activeFeeds}`)
      } else {
        console.log(`❌ RSS monitoring endpoint returned status: ${response.status}`)
      }
    } catch (error) {
      console.log(`❌ RSS monitoring endpoint error: ${error}`)
    }

    // Test 3: Test RSS feed check
    console.log('\n🔄 Test 3: Testing RSS feed check...')
    try {
      const response = await fetch(`${baseUrl}/api/rss/monitoring`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'check' })
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log(`✅ RSS feed check completed.`)
        console.log(`   Items Found: ${data.itemsFound || 0}`)
        console.log(`   Feeds Checked: ${data.feedsChecked || 0}`)
        
        if (data.items && data.items.length > 0) {
          console.log('   Sample items:')
          data.items.slice(0, 3).forEach((item: any, index: number) => {
            console.log(`   ${index + 1}. ${item.title}`)
            console.log(`      Source: ${item.source}`)
            console.log(`      Published: ${item.pubDate}`)
          })
        }
      } else {
        console.log(`❌ RSS feed check returned status: ${response.status}`)
      }
    } catch (error) {
      console.log(`❌ RSS feed check error: ${error}`)
    }

    // Test 4: Test individual feed check
    console.log('\n📰 Test 4: Testing individual feed check...')
    try {
      const response = await fetch(`${baseUrl}/api/rss/feeds/bbc-sports/check`)
      if (response.ok) {
        const data = await response.json()
        console.log(`✅ BBC Sports feed check completed.`)
        console.log(`   Items Found: ${data.items?.length || 0}`)
        
        if (data.items && data.items.length > 0) {
          console.log('   Sample BBC items:')
          data.items.slice(0, 3).forEach((item: any, index: number) => {
            console.log(`   ${index + 1}. ${item.title}`)
          })
        }
      } else {
        console.log(`❌ BBC Sports feed check returned status: ${response.status}`)
      }
    } catch (error) {
      console.log(`❌ BBC Sports feed check error: ${error}`)
    }

    console.log('\n✅ RSS API testing completed!')

  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

// Run the test
testRSSAPI().catch(console.error) 