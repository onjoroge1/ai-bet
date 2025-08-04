#!/usr/bin/env node

/**
 * Fix Script: Quiz Credits Data Correction
 * 
 * This script fixes the quiz credits data by recalculating points
 * based on original quiz scores instead of calculated credits.
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function fixQuizCredits() {
  console.log('🔧 Fixing Quiz Credits Data...\n')
  
  try {
    // Get all users with quiz points
    const usersWithPoints = await prisma.userPoints.findMany({
      include: {
        user: {
          include: {
            quizParticipations: {
              where: { 
                isCompleted: true,
                creditsClaimed: true
              }
            }
          }
        }
      }
    })
    
    console.log(`Found ${usersWithPoints.length} users with quiz points\n`)
    
    for (const userPoints of usersWithPoints) {
      const userId = userPoints.userId
      const currentPoints = userPoints.points
      
      console.log(`User ${userId}:`)
      console.log(`  Current points: ${currentPoints}`)
      
      // Calculate what the points should be based on quiz participations
      const totalQuizPoints = userPoints.user.quizParticipations.reduce((sum, participation) => {
        return sum + participation.totalScore
      }, 0)
      
      const calculatedCredits = Math.floor(totalQuizPoints / 50)
      const currentCredits = Math.floor(currentPoints / 50)
      
      console.log(`  Quiz participations: ${userPoints.user.quizParticipations.length}`)
      console.log(`  Total quiz points earned: ${totalQuizPoints}`)
      console.log(`  Should have credits: ${calculatedCredits}`)
      console.log(`  Currently has credits: ${currentCredits}`)
      
      if (totalQuizPoints !== currentPoints) {
        console.log(`  ❌ Points mismatch! Fixing...`)
        
        // Update the points to the correct value
        await prisma.userPoints.update({
          where: { userId },
          data: { points: totalQuizPoints }
        })
        
        // Clear the credit balance cache for this user
        try {
          const { cacheManager } = require('@/lib/cache-manager')
          await cacheManager.delete(`credit-balance:${userId}`, { prefix: 'credits' })
          console.log(`  🗑️  Cleared credit balance cache`)
        } catch (error) {
          console.log(`  ⚠️  Could not clear cache: ${error.message}`)
        }
        
        console.log(`  ✅ Fixed: ${currentPoints} → ${totalQuizPoints}`)
      } else {
        console.log(`  ✅ Points are correct`)
      }
      
      console.log('')
    }
    
    console.log('🎉 Quiz credits data fix completed!')
    
  } catch (error) {
    console.error('❌ Fix failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the fix
fixQuizCredits()
  .then(() => {
    console.log('\n✅ Fix script completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Fix script failed:', error)
    process.exit(1)
  }) 