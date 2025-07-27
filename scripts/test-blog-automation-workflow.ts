import { rssFeedManager } from '../lib/rss/rss-feed-manager'
import { BlogAutomationService } from '../lib/blog/blog-automation-service'

async function testBlogAutomationWorkflow() {
  console.log('🧪 Testing Complete Blog Automation Workflow...\n')

  try {
    // Test 1: Check RSS feeds
    console.log('📰 Step 1: Checking RSS feeds...')
    const rssItems = await rssFeedManager.checkAllFeeds()
    console.log(`✅ Found ${rssItems.length} RSS items`)
    
    if (rssItems.length === 0) {
      console.log('❌ No RSS items found. Cannot test blog automation.')
      return
    }

    // Test 2: Initialize blog automation service
    console.log('\n🤖 Step 2: Initializing blog automation service...')
    const blogAutomationService = new BlogAutomationService()
    console.log('✅ Blog automation service initialized')

    // Test 3: Process RSS items through blog automation
    console.log('\n📝 Step 3: Processing RSS items through blog automation...')
    let processedCount = 0
    let errorCount = 0

    // Process first 3 items for testing
    const testItems = rssItems.slice(0, 3)
    
    for (const item of testItems) {
      try {
        console.log(`\n   Processing: ${item.title}`)
        console.log(`   Source: ${item.source}`)
        console.log(`   Link: ${item.link}`)
        
        const result = await blogAutomationService.processNewsItem(item)
        
        if (result) {
          processedCount++
          console.log(`   ✅ Generated blog post: ${result.title}`)
          console.log(`   Category: ${result.category}`)
          console.log(`   Tags: ${result.tags.join(', ')}`)
          console.log(`   Read time: ${result.readTime} minutes`)
        } else {
          console.log(`   ⚠️ Skipped (likely duplicate or validation failed)`)
        }
      } catch (error) {
        errorCount++
        console.log(`   ❌ Error: ${error}`)
      }
    }

    // Test 4: Summary
    console.log('\n📊 Step 4: Workflow Summary')
    console.log(`   Total RSS items: ${rssItems.length}`)
    console.log(`   Items tested: ${testItems.length}`)
    console.log(`   Successfully processed: ${processedCount}`)
    console.log(`   Errors: ${errorCount}`)

    if (processedCount > 0) {
      console.log('\n✅ Blog automation workflow is working!')
      console.log('   You can now check the admin interface to see the generated blog posts.')
    } else {
      console.log('\n⚠️ No blog posts were generated.')
      console.log('   This could be due to:')
      console.log('   - Duplicate content detection')
      console.log('   - Content validation failures')
      console.log('   - AI service issues')
    }

  } catch (error) {
    console.error('❌ Blog automation workflow test failed:', error)
  }
}

// Run the test
testBlogAutomationWorkflow().catch(console.error) 