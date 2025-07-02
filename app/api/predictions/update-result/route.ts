import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/db"
import { updateUserWinStreak } from "@/lib/streak-calculator"
import { logger } from "@/lib/logger"

// POST /api/predictions/update-result
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { predictionId, result, homeScore, awayScore } = await request.json()

    if (!predictionId || !result) {
      return NextResponse.json({ error: 'Missing predictionId or result' }, { status: 400 })
    }

    if (!['won', 'lost', 'pending', 'void'].includes(result)) {
      return NextResponse.json({ error: 'Invalid result status' }, { status: 400 })
    }

    // Get the prediction with match data
    const prediction = await prisma.prediction.findUnique({
      where: { id: predictionId },
      include: {
        match: true,
        userPredictions: {
          select: {
            id: true,
            userId: true,
            status: true
          }
        }
      }
    })

    if (!prediction) {
      return NextResponse.json({ error: 'Prediction not found' }, { status: 404 })
    }

    // Start a transaction to update both prediction and match
    const updatedData = await prisma.$transaction(async (tx) => {
      // Update match scores if provided
      if (homeScore !== undefined && awayScore !== undefined) {
        await tx.match.update({
          where: { id: prediction.matchId },
          data: {
            homeScore: parseInt(homeScore),
            awayScore: parseInt(awayScore),
            status: 'finished'
          }
        })
      }

      // Update prediction result
      const updatedPrediction = await tx.prediction.update({
        where: { id: predictionId },
        data: {
          status: result,
          resultUpdatedAt: new Date()
        }
      })

      // Update user predictions and win streaks
      const userIdsToUpdate: string[] = []
      
      for (const userPrediction of prediction.userPredictions) {
        // Determine user prediction status based on prediction result
        let userPredictionStatus = 'pending'
        if (result === 'won') {
          userPredictionStatus = 'won'
        } else if (result === 'lost') {
          userPredictionStatus = 'lost'
        } else if (result === 'void') {
          userPredictionStatus = 'void'
        }

        // Update user prediction status
        await tx.userPrediction.update({
          where: { id: userPrediction.id },
          data: { status: userPredictionStatus }
        })

        // Collect user IDs for win streak updates
        if (!userIdsToUpdate.includes(userPrediction.userId)) {
          userIdsToUpdate.push(userPrediction.userId)
        }
      }

      return { updatedPrediction, userIdsToUpdate }
    })

    // Update win streaks for all affected users
    for (const userId of updatedData.userIdsToUpdate) {
      try {
        await updateUserWinStreak(userId)
      } catch (error) {
        logger.error('Failed to update win streak for user', {
          tags: ['api', 'predictions', 'update-result'],
          data: { userId, error: error instanceof Error ? error.message : 'Unknown error' }
        })
      }
    }

    logger.info('Prediction result updated successfully', {
      tags: ['api', 'predictions', 'update-result'],
      data: { 
        predictionId, 
        result, 
        homeScore, 
        awayScore,
        usersUpdated: updatedData.userIdsToUpdate.length
      }
    })

    return NextResponse.json({ 
      success: true, 
      prediction: updatedData.updatedPrediction,
      usersUpdated: updatedData.userIdsToUpdate.length
    })

  } catch (error) {
    logger.error('Error updating prediction result', {
      tags: ['api', 'predictions', 'update-result'],
      error: error instanceof Error ? error : undefined
    })
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
} 