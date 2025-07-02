import prisma from "@/lib/db"

/**
 * Calculates the current win streak for a user based on their prediction history
 * @param userId - The user's ID
 * @returns The current win streak count
 */
export async function calculateCurrentWinStreak(userId: string): Promise<number> {
  try {
    // Get all user predictions ordered by most recent first
    const userPredictions = await prisma.userPrediction.findMany({
      where: {
        userId: userId,
        status: {
          in: ['won', 'lost'] // Only count completed predictions
        }
      },
      orderBy: {
        placedAt: 'desc' // Most recent first
      },
      select: {
        status: true,
        placedAt: true
      }
    })

    if (userPredictions.length === 0) {
      return 0 // No predictions yet
    }

    let currentStreak = 0

    // Count consecutive wins from the most recent prediction backwards
    for (const prediction of userPredictions) {
      if (prediction.status === 'won') {
        currentStreak++
      } else if (prediction.status === 'lost') {
        // Stop counting when we hit a loss
        break
      }
    }

    return currentStreak
  } catch (error) {
    console.error('Error calculating win streak:', error)
    return 0
  }
}

/**
 * Updates a user's win streak in the database
 * @param userId - The user's ID
 * @returns The updated win streak count
 */
export async function updateUserWinStreak(userId: string): Promise<number> {
  try {
    const currentStreak = await calculateCurrentWinStreak(userId)
    
    // Update the user's win streak in the database
    await prisma.user.update({
      where: { id: userId },
      data: { winStreak: currentStreak }
    })

    return currentStreak
  } catch (error) {
    console.error('Error updating user win streak:', error)
    return 0
  }
}

/**
 * Updates win streaks for all users (useful for maintenance)
 */
export async function updateAllUserWinStreaks(): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      select: { id: true }
    })

    console.log(`Updating win streaks for ${users.length} users...`)

    for (const user of users) {
      await updateUserWinStreak(user.id)
    }

    console.log('✅ All user win streaks updated successfully')
  } catch (error) {
    console.error('Error updating all user win streaks:', error)
  }
}

/**
 * Gets detailed streak information for a user
 * @param userId - The user's ID
 * @returns Detailed streak information
 */
export async function getUserStreakDetails(userId: string): Promise<{
  currentStreak: number
  bestStreak: number
  totalPredictions: number
  totalWins: number
  totalLosses: number
  winRate: number
}> {
  try {
    const userPredictions = await prisma.userPrediction.findMany({
      where: {
        userId: userId,
        status: {
          in: ['won', 'lost']
        }
      },
      orderBy: {
        placedAt: 'desc'
      },
      select: {
        status: true,
        placedAt: true
      }
    })

    const totalPredictions = userPredictions.length
    const totalWins = userPredictions.filter(p => p.status === 'won').length
    const totalLosses = userPredictions.filter(p => p.status === 'lost').length
    const winRate = totalPredictions > 0 ? (totalWins / totalPredictions) * 100 : 0

    // Calculate current streak
    let currentStreak = 0
    for (const prediction of userPredictions) {
      if (prediction.status === 'won') {
        currentStreak++
      } else if (prediction.status === 'lost') {
        break
      }
    }

    // Calculate best streak (this is a simplified version - could be optimized)
    let bestStreak = 0
    let tempStreak = 0
    for (const prediction of userPredictions.reverse()) { // Reverse to go chronologically
      if (prediction.status === 'won') {
        tempStreak++
        bestStreak = Math.max(bestStreak, tempStreak)
      } else if (prediction.status === 'lost') {
        tempStreak = 0
      }
    }

    return {
      currentStreak,
      bestStreak,
      totalPredictions,
      totalWins,
      totalLosses,
      winRate
    }
  } catch (error) {
    console.error('Error getting user streak details:', error)
    return {
      currentStreak: 0,
      bestStreak: 0,
      totalPredictions: 0,
      totalWins: 0,
      totalLosses: 0,
      winRate: 0
    }
  }
} 