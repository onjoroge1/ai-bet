/**
 * Test Twitter Automated Posting
 * 
 * This script tests the automated Twitter posting functionality
 */

import prisma from '../lib/db'
import { postTweet, isTwitterConfigured } from '../lib/social/twitter-client'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })
dotenv.config()

async function testTwitterPosting() {
  console.log('🧪 Testing Twitter Automated Posting\n')
  console.log('='.repeat(60))
  
  // Step 1: Check configuration
  console.log('\n1️⃣  Checking Twitter API Configuration...')
  if (!isTwitterConfigured()) {
    console.error('❌ Twitter API credentials are NOT configured')
    process.exit(1)
  }
  console.log('✅ Twitter API credentials are configured')
  
  // Step 2: Get scheduled posts ready to post
  console.log('\n2️⃣  Fetching scheduled posts...')
  const now = new Date()
  
  const scheduledPosts = await prisma.socialMediaPost.findMany({
    where: {
      platform: 'twitter',
      status: { in: ['scheduled', 'posted'] }, // Check both scheduled and posted
      scheduledAt: { lte: now }, // Past scheduled time
    },
    orderBy: { scheduledAt: 'asc' },
    take: 20,
  })
  
  console.log(`   Found ${scheduledPosts.length} posts (scheduled or posted with past scheduledAt)`)
  
  // Group by status
  const scheduled = scheduledPosts.filter(p => p.status === 'scheduled')
  const posted = scheduledPosts.filter(p => p.status === 'posted')
  
  console.log(`   - Scheduled (not posted): ${scheduled.length}`)
  console.log(`   - Posted: ${posted.length}`)
  
  // Step 3: Show scheduled posts
  if (scheduled.length > 0) {
    console.log('\n3️⃣  Scheduled Posts (Ready to Post):')
    scheduled.forEach((post, idx) => {
      const hoursAgo = Math.round((now.getTime() - post.scheduledAt.getTime()) / (1000 * 60 * 60))
      console.log(`\n   ${idx + 1}. Post ID: ${post.id}`)
      console.log(`      Match ID: ${post.matchId || 'N/A'}`)
      console.log(`      Template: ${post.templateId}`)
      console.log(`      Scheduled: ${post.scheduledAt.toISOString()} (${hoursAgo}h ago)`)
      console.log(`      Content: ${post.content.substring(0, 100)}...`)
      console.log(`      URL: ${post.url || 'N/A'}`)
    })
  }
  
  // Step 4: Show posts marked as "posted"
  if (posted.length > 0) {
    console.log('\n4️⃣  Posts Marked as "Posted" (Verify on Twitter):')
    posted.forEach((post, idx) => {
      const postedHoursAgo = post.postedAt ? Math.round((now.getTime() - post.postedAt.getTime()) / (1000 * 60 * 60)) : 0
      console.log(`\n   ${idx + 1}. Post ID: ${post.id}`)
      console.log(`      Tweet ID: ${post.postId || 'MISSING'} ${!post.postId ? '⚠️' : ''}`)
      console.log(`      Match ID: ${post.matchId || 'N/A'}`)
      console.log(`      Template: ${post.templateId}`)
      console.log(`      Posted At: ${post.postedAt?.toISOString() || 'N/A'} (${postedHoursAgo}h ago)`)
      console.log(`      Content: ${post.content.substring(0, 100)}...`)
      if (post.postId) {
        console.log(`      Twitter URL: https://twitter.com/i/web/status/${post.postId}`)
      }
    })
  }
  
  // Step 5: Test posting (if there are scheduled posts)
  if (scheduled.length > 0) {
    console.log('\n5️⃣  Testing Posting...')
    console.log(`   Found ${scheduled.length} scheduled posts ready to post`)
    
    // Check rate limits first
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    
    const hourPosts = await prisma.socialMediaPost.count({
      where: {
        platform: 'twitter',
        status: 'posted',
        postedAt: { gte: oneHourAgo },
      },
    })
    
    const dayPosts = await prisma.socialMediaPost.count({
      where: {
        platform: 'twitter',
        status: 'posted',
        postedAt: { gte: oneDayAgo },
      },
    })
    
    console.log(`   Rate limit status:`)
    console.log(`   - Posts in last hour: ${hourPosts}/5`)
    console.log(`   - Posts in last day: ${dayPosts}/30`)
    
    if (hourPosts >= 5) {
      console.log('   ⚠️  Hourly rate limit reached (5 posts/hour)')
      return
    }
    
    if (dayPosts >= 30) {
      console.log('   ⚠️  Daily rate limit reached (30 posts/day)')
      return
    }
    
    // Ask which post to test (or test first one)
    const postToTest = scheduled[0]
    console.log(`\n   Testing with first scheduled post (ID: ${postToTest.id})`)
    
    try {
      // Build tweet text
      const tweetText = postToTest.content + (postToTest.url ? ` ${postToTest.url}` : '')
      console.log(`   Tweet text length: ${tweetText.length} characters`)
      
      // Post to Twitter
      console.log(`   Posting to Twitter...`)
      const tweetId = await postTweet(tweetText)
      
      console.log(`   ✅ Successfully posted!`)
      console.log(`   Tweet ID: ${tweetId}`)
      console.log(`   Twitter URL: https://twitter.com/i/web/status/${tweetId}`)
      
      // Update post status
      await prisma.socialMediaPost.update({
        where: { id: postToTest.id },
        data: {
          status: 'posted',
          postedAt: new Date(),
          postId: tweetId,
        },
      })
      
      console.log(`   ✅ Updated database record`)
      
    } catch (error) {
      console.error(`   ❌ Failed to post:`)
      console.error(`   ${error instanceof Error ? error.message : String(error)}`)
      
      // Update with error
      await prisma.socialMediaPost.update({
        where: { id: postToTest.id },
        data: {
          status: 'failed',
          errorMessage: (error instanceof Error ? error.message : String(error)).substring(0, 500),
        },
      })
    }
  } else {
    console.log('\n5️⃣  No scheduled posts ready to post')
  }
  
  // Step 6: Check posts with missing tweet IDs
  console.log('\n6️⃣  Checking posts marked as "posted" but missing tweet IDs...')
  const postsWithoutTweetId = await prisma.socialMediaPost.findMany({
    where: {
      platform: 'twitter',
      status: 'posted',
      postId: null,
    },
    take: 10,
  })
  
  if (postsWithoutTweetId.length > 0) {
    console.log(`   ⚠️  Found ${postsWithoutTweetId.length} posts marked as "posted" but missing tweet IDs:`)
    postsWithoutTweetId.forEach((post, idx) => {
      console.log(`   ${idx + 1}. Post ID: ${post.id}, Match ID: ${post.matchId}, Posted At: ${post.postedAt?.toISOString() || 'N/A'}`)
    })
    console.log(`   💡 These posts were likely created during the simulation phase (before Twitter API integration)`)
  } else {
    console.log(`   ✅ All posted records have tweet IDs`)
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('\n✅ Test complete!\n')
}

testTwitterPosting()
  .catch((error) => {
    console.error('\n❌ Test failed with error:')
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

