/**
 * Check Scheduled Twitter Posts
 * 
 * This script checks scheduled posts and identifies issues
 */

import prisma from '../lib/db'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })
dotenv.config()

async function checkScheduledPosts() {
  console.log('🔍 Checking Scheduled Twitter Posts\n')
  console.log('='.repeat(60))
  
  const now = new Date()
  
  // 1. Get all posts
  console.log('\n1️⃣  All Twitter Posts:')
  const allPosts = await prisma.socialMediaPost.findMany({
    where: {
      platform: 'twitter',
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  console.log(`   Total posts in database: ${allPosts.length}`)
  
  // Group by status
  const byStatus = allPosts.reduce((acc, post) => {
    acc[post.status] = (acc[post.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  console.log(`   Status breakdown:`)
  Object.entries(byStatus).forEach(([status, count]) => {
    console.log(`   - ${status}: ${count}`)
  })
  
  // 2. Check scheduled posts
  console.log('\n2️⃣  Scheduled Posts (Ready to Post):')
  const scheduledPosts = await prisma.socialMediaPost.findMany({
    where: {
      platform: 'twitter',
      status: 'scheduled',
      scheduledAt: { lte: now }, // Past scheduled time
    },
    orderBy: { scheduledAt: 'asc' },
  })
  
  console.log(`   Found ${scheduledPosts.length} scheduled posts ready to post`)
  
  if (scheduledPosts.length > 0) {
    console.log(`\n   Posts ready to post:`)
    scheduledPosts.forEach((post, idx) => {
      const hoursAgo = Math.round((now.getTime() - post.scheduledAt.getTime()) / (1000 * 60 * 60))
      console.log(`\n   ${idx + 1}. Post ID: ${post.id}`)
      console.log(`      Match ID: ${post.matchId || 'N/A'}`)
      console.log(`      Template: ${post.templateId}`)
      console.log(`      Scheduled: ${post.scheduledAt.toISOString()} (${hoursAgo}h ago)`)
      console.log(`      Content: ${post.content.substring(0, 80)}...`)
    })
  }
  
  // 3. Check posts marked as "posted"
  console.log('\n3️⃣  Posts Marked as "Posted":')
  const postedPosts = await prisma.socialMediaPost.findMany({
    where: {
      platform: 'twitter',
      status: 'posted',
    },
    orderBy: { postedAt: 'desc' },
    take: 20,
  })
  
  console.log(`   Found ${postedPosts.length} posts marked as "posted"`)
  
  // Check for posts without tweet IDs (simulated posts)
  const postsWithoutTweetId = postedPosts.filter(p => !p.postId || p.postId.startsWith('sim_'))
  const postsWithRealTweetId = postedPosts.filter(p => p.postId && !p.postId.startsWith('sim_'))
  
  console.log(`   - With real tweet IDs: ${postsWithRealTweetId.length}`)
  console.log(`   - Without tweet IDs or simulated: ${postsWithoutTweetId.length} ⚠️`)
  
  if (postsWithoutTweetId.length > 0) {
    console.log(`\n   ⚠️  Posts marked as "posted" but missing real tweet IDs:`)
    postsWithoutTweetId.forEach((post, idx) => {
      const postedHoursAgo = post.postedAt ? Math.round((now.getTime() - post.postedAt.getTime()) / (1000 * 60 * 60)) : 0
      console.log(`\n   ${idx + 1}. Post ID: ${post.id}`)
      console.log(`      Tweet ID: ${post.postId || 'MISSING'}`)
      console.log(`      Match ID: ${post.matchId || 'N/A'}`)
      console.log(`      Posted At: ${post.postedAt?.toISOString() || 'N/A'} (${postedHoursAgo}h ago)`)
      console.log(`      Content: ${post.content.substring(0, 80)}...`)
      if (post.postId?.startsWith('sim_')) {
        console.log(`      ⚠️  This appears to be a simulated post (created before Twitter API integration)`)
      }
    })
  }
  
  // 4. Check posts from today
  console.log('\n4️⃣  Posts from Today:')
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  
  const todayPosts = await prisma.socialMediaPost.findMany({
    where: {
      platform: 'twitter',
      status: 'posted',
      postedAt: { gte: todayStart },
    },
    orderBy: { postedAt: 'desc' },
  })
  
  console.log(`   Posts marked as "posted" today: ${todayPosts.length}`)
  
  const todayWithRealTweetId = todayPosts.filter(p => p.postId && !p.postId.startsWith('sim_'))
  const todaySimulated = todayPosts.filter(p => !p.postId || p.postId.startsWith('sim_'))
  
  console.log(`   - With real tweet IDs: ${todayWithRealTweetId.length}`)
  console.log(`   - Simulated or missing IDs: ${todaySimulated.length} ⚠️`)
  
  if (todaySimulated.length > 0) {
    console.log(`\n   ⚠️  Today's posts that appear to be simulated:`)
    todaySimulated.forEach((post, idx) => {
      console.log(`   ${idx + 1}. Post ID: ${post.id}, Tweet ID: ${post.postId || 'MISSING'}, Posted: ${post.postedAt?.toISOString()}`)
    })
  }
  
  // 5. Check failed posts
  console.log('\n5️⃣  Failed Posts:')
  const failedPosts = await prisma.socialMediaPost.findMany({
    where: {
      platform: 'twitter',
      status: 'failed',
    },
    orderBy: { updatedAt: 'desc' },
    take: 10,
  })
  
  console.log(`   Found ${failedPosts.length} failed posts`)
  if (failedPosts.length > 0) {
    failedPosts.forEach((post, idx) => {
      console.log(`\n   ${idx + 1}. Post ID: ${post.id}`)
      console.log(`      Error: ${post.errorMessage || 'No error message'}`)
      console.log(`      Created: ${post.createdAt.toISOString()}`)
    })
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('\n📊 Summary:')
  console.log(`   Total posts: ${allPosts.length}`)
  console.log(`   Scheduled (ready): ${scheduledPosts.length}`)
  console.log(`   Posted (total): ${postedPosts.length}`)
  console.log(`   Posted (real): ${postsWithRealTweetId.length}`)
  console.log(`   Posted (simulated): ${postsWithoutTweetId.length} ⚠️`)
  console.log(`   Failed: ${failedPosts.length}`)
  
  if (postsWithoutTweetId.length > 0 || todaySimulated.length > 0) {
    console.log(`\n   ⚠️  WARNING: Found posts marked as "posted" but they appear to be simulated`)
    console.log(`   These were likely created before Twitter API integration was complete.`)
    console.log(`   They were not actually posted to Twitter.`)
  }
  
  console.log('\n')
}

checkScheduledPosts()
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

