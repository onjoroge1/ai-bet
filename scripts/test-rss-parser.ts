import { RSSParser } from '../lib/rss/rss-parser'

async function testRSSParser() {
  console.log('🧪 Testing RSS Parser...\n')

  const parser = new RSSParser()

  // Test with a simple, reliable RSS feed
  const testUrl = 'https://feeds.bbci.co.uk/sport/football/rss.xml'

  try {
    console.log(`📰 Testing RSS parser with: ${testUrl}`)
    
    const items = await parser.parseFeed(testUrl)
    
    console.log(`✅ RSS parser working! Found ${items.length} items`)
    
    if (items.length > 0) {
      console.log('\n📋 Sample items:')
      items.slice(0, 3).forEach((item, index) => {
        console.log(`\n${index + 1}. ${item.title}`)
        console.log(`   Link: ${item.link}`)
        console.log(`   Published: ${item.pubDate.toISOString()}`)
        console.log(`   Source: ${item.source}`)
        console.log(`   Category: ${item.category}`)
        if (item.description) {
          console.log(`   Description: ${item.description.substring(0, 100)}...`)
        }
      })
    }

    console.log('\n✅ RSS parser test completed successfully!')

  } catch (error) {
    console.error('❌ RSS parser test failed:', error)
  }
}

// Run the test
testRSSParser().catch(console.error) 