/**
 * Test Twitter API Integration
 * 
 * This script tests the Twitter API integration by:
 * 1. Checking if credentials are configured
 * 2. Testing client initialization
 * 3. Testing API connection (read operation)
 * 4. Optionally testing tweet posting
 */

import { TwitterApi } from 'twitter-api-v2'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })
dotenv.config()

async function testTwitterAPI() {
  console.log('🧪 Testing Twitter API Integration\n')
  console.log('='.repeat(50))
  
  // Step 1: Check configuration
  console.log('\n1️⃣  Checking Twitter API Configuration...')
  const apiKey = process.env.TWITTER_API_KEY
  const apiSecret = process.env.TWITTER_API_SECRET
  const accessToken = process.env.TWITTER_ACCESS_TOKEN
  const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET
  
  const missing = []
  if (!apiKey) missing.push('TWITTER_API_KEY')
  if (!apiSecret) missing.push('TWITTER_API_SECRET')
  if (!accessToken) missing.push('TWITTER_ACCESS_TOKEN')
  if (!accessTokenSecret) missing.push('TWITTER_ACCESS_TOKEN_SECRET')
  
  if (missing.length > 0) {
    console.error('❌ Twitter API credentials are NOT configured')
    console.error('   Missing environment variables:')
    missing.forEach(key => console.error(`   - ${key}`))
    process.exit(1)
  }
  console.log('✅ Twitter API credentials are configured')
  console.log(`   API Key: ${apiKey?.substring(0, 8)}...`)
  console.log(`   Access Token: ${accessToken?.substring(0, 8)}...`)
  
  // Step 2: Test client initialization
  console.log('\n2️⃣  Testing Twitter API Client Initialization...')
  let client: TwitterApi
  try {
    client = new TwitterApi({
      appKey: apiKey!,
      appSecret: apiSecret!,
      accessToken: accessToken!,
      accessSecret: accessTokenSecret!,
    })
    console.log('✅ Twitter API client initialized successfully')
  } catch (error) {
    console.error('❌ Failed to initialize Twitter API client:')
    console.error('   ', error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
  
  // Step 3: Test API connection (read operation - get current user)
  console.log('\n3️⃣  Testing Twitter API Connection (Read Operation)...')
  try {
    const readWriteClient = client.readWrite
    
    // Get current user info (read operation, safe to test)
    const me = await readWriteClient.v2.me()
    console.log('✅ Twitter API connection successful!')
    console.log(`   Logged in as: @${me.data.username} (${me.data.name})`)
    console.log(`   User ID: ${me.data.id}`)
  } catch (error) {
    console.error('❌ Failed to connect to Twitter API:')
    console.error('   ', error instanceof Error ? error.message : String(error))
    
    if (error instanceof Error) {
      if (error.message.includes('401') || error.message.toLowerCase().includes('unauthorized')) {
        console.error('\n   💡 Tip: Check that your API credentials are correct and have proper permissions')
      }
      if (error.message.includes('403') || error.message.toLowerCase().includes('forbidden')) {
        console.error('\n   💡 Tip: Your account may be suspended or the app may lack required permissions')
      }
    }
    process.exit(1)
  }
  
  // Step 4: Test tweet posting (optional - check environment variable)
  console.log('\n4️⃣  Test Tweet Posting')
  const testPost = process.env.TEST_POST === 'true'
  
  if (testPost) {
    console.log('   🔵 TEST_POST=true detected, posting test tweet...')
    try {
      const readWriteClient = client.readWrite
      const testTweetText = `🧪 Twitter API Integration Test - ${new Date().toISOString()}`
      
      console.log(`   Tweet text: "${testTweetText}"`)
      const tweet = await readWriteClient.v2.tweet({
        text: testTweetText,
      })
      
      console.log('✅ Test tweet posted successfully!')
      console.log(`   Tweet ID: ${tweet.data.id}`)
      console.log(`   View tweet: https://twitter.com/i/web/status/${tweet.data.id}`)
    } catch (error) {
      console.error('❌ Failed to post test tweet:')
      console.error('   ', error instanceof Error ? error.message : String(error))
      
      if (error instanceof Error) {
        if (error.message.includes('429') || error.message.toLowerCase().includes('rate limit')) {
          console.error('\n   💡 Tip: Rate limit exceeded. Wait a few minutes and try again.')
        }
      }
      process.exit(1)
    }
  } else {
    console.log('   ⚠️  This would post an actual tweet to your Twitter account!')
    console.log('   ⏭️  Skipping tweet posting (set TEST_POST=true to enable)')
    console.log('\n   📝 To test posting:')
    console.log('      - Set TEST_POST=true and run again to post a test tweet')
    console.log('      - Or use the admin interface to create a scheduled post')
    console.log('      - Or manually trigger the /api/admin/social/twitter/post-scheduled endpoint')
  }
  
  console.log('\n' + '='.repeat(50))
  console.log('\n✅ All tests passed! Twitter API integration is working correctly.')
  console.log('\n📋 Next Steps:')
  console.log('   1. The system is ready to post tweets automatically')
  console.log('   2. Scheduled posts will be posted via the cron job')
  console.log('   3. Monitor logs for posting activity')
  console.log('\n')
}

// Run the test
testTwitterAPI().catch((error) => {
  console.error('\n❌ Test failed with unexpected error:')
  console.error(error)
  process.exit(1)
})
