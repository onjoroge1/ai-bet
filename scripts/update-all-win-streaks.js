const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function updateAllWinStreaks() {
  try {
    console.log('🔄 Starting win streak update for all users...')
    
    // Get all users
    const users = await prisma.user.findMany({
      select: { id: true, email: true }
    })
    
    console.log(`📊 Found ${users.length} users to update`)
    
    let updatedCount = 0
    let errorCount = 0
    
    for (const user of users) {
      try {
        // Get all user predictions ordered by most recent first
        const userPredictions = await prisma.userPrediction.findMany({
          where: {
            userId: user.id,
            status: {
              in: ['won', 'lost']
            }
          },
          orderBy: {
            placedAt: 'desc'
          },
          select: {
            status: true
          }
        })
        
        // Calculate current streak
        let currentStreak = 0
        for (const prediction of userPredictions) {
          if (prediction.status === 'won') {
            currentStreak++
          } else if (prediction.status === 'lost') {
            break
          }
        }
        
        // Update user's win streak
        await prisma.user.update({
          where: { id: user.id },
          data: { winStreak: currentStreak }
        })
        
        updatedCount++
        console.log(`✅ Updated ${user.email}: ${currentStreak} wins streak`)
        
      } catch (error) {
        errorCount++
        console.error(`❌ Error updating ${user.email}:`, error.message)
      }
    }
    
    console.log('\n📈 Update Summary:')
    console.log(`✅ Successfully updated: ${updatedCount} users`)
    console.log(`❌ Errors: ${errorCount} users`)
    console.log(`📊 Total processed: ${users.length} users`)
    
  } catch (error) {
    console.error('❌ Fatal error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the update
updateAllWinStreaks() 