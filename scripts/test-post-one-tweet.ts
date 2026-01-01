/**
 * Test Posting One Tweet
 * 
 * Tests posting a single scheduled tweet to verify Twitter API integration works
 */

import prisma from '../lib/db'
import { TwitterApi } from 'twitter-api-v2'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config()

async function testPostOneTweet() {
  console.log('🧪 Testing Posting One Tweet\n')
  console.log('='.repeat(60))
  
  // Check configuration
  const apiKey = process.env.TWITTER_API_KEY
  const apiSecret = process.env.TWITTER_API_SECRET
  const accessToken = process.env.TWITTER_ACCESS_TOKEN
  const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET
  
  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    console.error('❌ Twitter API credentials are NOT configured')
    process.exit(1)
  }
  console.log('✅ Twitter API credentials are configured\n')
  
  // Initialize Twitter client
  const client = new TwitterApi({
    appKey: apiKey,
    appSecret: apiSecret,
    accessToken: accessToken,
    accessSecret: accessTokenSecret,
  })
  const readWriteClient = client.readWrite
  
  // Get the first scheduled post
  const now = new Date()
  const scheduledPost = await prisma.socialMediaPost.findFirst({
    where: {
      platform: 'twitter',
      status: 'scheduled',
      scheduledAt: { lte: now },
    },
    orderBy: { scheduledAt: 'asc' },
  })
  
  if (!scheduledPost) {
    console.log('❌ No scheduled posts found')
    process.exit(1)
  }
  
  console.log(`📋 Found scheduled post:`)
  console.log(`   Post ID: ${scheduledPost.id}`)
  console.log(`   Match ID: ${scheduledPost.matchId || 'N/A'}`)
  console.log(`   Template: ${scheduledPost.templateId}`)
  console.log(`   Content: ${scheduledPost.content.substring(0, 100)}...`)
  console.log(`   URL: ${scheduledPost.url || 'N/A'}`)
  console.log(`\n🚀 Posting to Twitter...\n`)
  
  try {
    // Build tweet text
    const tweetText = scheduledPost.content + (scheduledPost.url ? ` ${scheduledPost.url}` : '')
    console.log(`   Tweet text length: ${tweetText.length} characters\n`)
    
    // Post to Twitter
    const tweet = await readWriteClient.v2.tweet({
      text: tweetText.trim(),
    })
    
    const tweetId = tweet.data.id
    
    console.log(`✅ Successfully posted to Twitter!`)
    console.log(`   Tweet ID: ${tweetId}`)
    console.log(`   Twitter URL: https://twitter.com/i/web/status/${tweetId}`)
    
    // Update post status
    await prisma.socialMediaPost.update({
      where: { id: scheduledPost.id },
      data: {
        status: 'posted',
        postedAt: new Date(),
        postId: tweetId,
      },
    })
    
    console.log(`\n✅ Updated database record`)
    
    const remainingCount = await prisma.socialMediaPost.count({
      where: { platform: 'twitter', status: 'scheduled' },
    })
    
    console.log(`\n📋 Remaining scheduled posts: ${remainingCount}`)
    console.log(`   These will be posted by the cron job automatically.\n`)
    
  } catch (error) {
    console.error(`❌ Failed to post:`)
    console.error(`   ${error instanceof Error ? error.message : String(error)}`)
    
    if (error instanceof Error) {
      if (error.message.includes('429') || error.message.toLowerCase().includes('rate limit')) {
        console.error(`\n   💡 Rate limit exceeded. Wait a few minutes and try again.`)
      }
      if (error.message.includes('401') || error.message.toLowerCase().includes('unauthorized')) {
        console.error(`\n   💡 Authentication failed. Check your Twitter API credentials.`)
      }
    }
    
    // Update with error
    await prisma.socialMediaPost.update({
      where: { id: scheduledPost.id },
      data: {
        status: 'failed',
        errorMessage: (error instanceof Error ? error.message : String(error)).substring(0, 500),
      },
    })
    
    process.exit(1)
  }
}

testPostOneTweet()
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
