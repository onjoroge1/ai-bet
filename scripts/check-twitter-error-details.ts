/**
 * Check Twitter API Error Details
 * 
 * Gets more detailed error information from Twitter API
 */

import { TwitterApi } from 'twitter-api-v2'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config()

async function checkTwitterErrorDetails() {
  console.log('🔍 Checking Twitter API Error Details\n')
  console.log('='.repeat(60))
  
  const apiKey = process.env.TWITTER_API_KEY
  const apiSecret = process.env.TWITTER_API_SECRET
  const accessToken = process.env.TWITTER_ACCESS_TOKEN
  const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET
  
  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    console.error('❌ Twitter API credentials are NOT configured')
    process.exit(1)
  }
  
  const client = new TwitterApi({
    appKey: apiKey,
    appSecret: apiSecret,
    accessToken: accessToken,
    accessSecret: accessTokenSecret,
  })
  
  const readWriteClient = client.readWrite
  
  // Test with a simple tweet
  const testText = `🧪 Twitter API Test - ${new Date().toISOString()}`
  console.log(`Testing with tweet: "${testText}"\n`)
  
  try {
    const tweet = await readWriteClient.v2.tweet({
      text: testText,
    })
    
    console.log('✅ Successfully posted!')
    console.log(`Tweet ID: ${tweet.data.id}`)
    console.log(`URL: https://twitter.com/i/web/status/${tweet.data.id}\n`)
    
  } catch (error: any) {
    console.error('❌ Error occurred:\n')
    console.error(`Status Code: ${error.code || 'N/A'}`)
    console.error(`Message: ${error.message || 'N/A'}`)
    
    if (error.data) {
      console.error(`\nError Data:`)
      console.error(JSON.stringify(error.data, null, 2))
    }
    
    if (error.rateLimit) {
      console.error(`\nRate Limit Info:`)
      console.error(JSON.stringify(error.rateLimit, null, 2))
    }
    
    if (error.code === 403) {
      console.error(`\n💡 403 Forbidden typically means:`)
      console.error(`   1. App doesn't have write permissions enabled`)
      console.error(`   2. Account/app may be suspended`)
      console.error(`   3. Need to enable "Read and Write" permissions in Twitter Developer Portal`)
      console.error(`   4. Need to regenerate Access Token and Access Token Secret after enabling write permissions`)
    }
    
    if (error.code === 401) {
      console.error(`\n💡 401 Unauthorized typically means:`)
      console.error(`   1. Invalid API credentials`)
      console.error(`   2. Expired access tokens`)
      console.error(`   3. Wrong credentials`)
    }
  }
}

checkTwitterErrorDetails()
  .catch((error) => {
    console.error('Unexpected error:', error)
    process.exit(1)
  })

