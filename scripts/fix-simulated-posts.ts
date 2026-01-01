/**
 * Fix Simulated Posts
 * 
 * Resets posts with simulated tweet IDs back to "scheduled" status
 * so they can be reposted with the real Twitter API
 */

import prisma from '../lib/db'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config()

async function fixSimulatedPosts() {
  console.log('🔧 Fixing Simulated Posts\n')
  console.log('='.repeat(60))
  
  // Find all posts with simulated tweet IDs
  const simulatedPosts = await prisma.socialMediaPost.findMany({
    where: {
      platform: 'twitter',
      status: 'posted',
      OR: [
        { postId: { startsWith: 'sim_' } },
        { postId: null },
      ],
    },
  })
  
  console.log(`Found ${simulatedPosts.length} posts with simulated tweet IDs\n`)
  
  if (simulatedPosts.length === 0) {
    console.log('✅ No simulated posts found. All posts are already using real tweet IDs.')
    return
  }
  
  console.log('Posts to reset:')
  simulatedPosts.forEach((post, idx) => {
    console.log(`\n${idx + 1}. Post ID: ${post.id}`)
    console.log(`   Tweet ID: ${post.postId || 'MISSING'}`)
    console.log(`   Match ID: ${post.matchId || 'N/A'}`)
    console.log(`   Posted At: ${post.postedAt?.toISOString() || 'N/A'}`)
    console.log(`   Content: ${post.content.substring(0, 60)}...`)
  })
  
  console.log(`\n⚠️  These posts will be reset to "scheduled" status`)
  console.log(`   They will then be reposted by the cron job with real Twitter API\n`)
  
  // Reset posts to scheduled status
  // Note: Prisma doesn't support startsWith in updateMany, so we update them individually
  let updated = 0
  for (const post of simulatedPosts) {
    await prisma.socialMediaPost.update({
      where: { id: post.id },
      data: {
        status: 'scheduled',
        postId: null,
        postedAt: null,
        errorMessage: null,
        scheduledAt: new Date(), // Reset to now so they're ready to post
      },
    })
    updated++
  }
  
  const result = { count: updated }
  
  console.log(`✅ Reset ${result.count} posts back to "scheduled" status`)
  console.log(`\n📋 Next Steps:`)
  console.log(`   1. These posts will be picked up by the cron job (/api/admin/social/twitter/post-scheduled)`)
  console.log(`   2. They will be posted using the real Twitter API`)
  console.log(`   3. Real tweet IDs will be stored in the database`)
  console.log(`\n   You can also manually trigger the posting endpoint to test immediately.\n`)
}

fixSimulatedPosts()
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

