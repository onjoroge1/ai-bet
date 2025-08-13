import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * POST /api/credits/claim-quiz
 * Claim credits from quiz participation
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { participationId, userId } = await request.json()

    if (!participationId) {
      return NextResponse.json({ error: 'Participation ID is required' }, { status: 400 })
    }

    // Verify the user is claiming their own credits
    if (userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Check if participation exists and belongs to the user
    const participation = await prisma.quizParticipation.findUnique({
      where: { 
        id: participationId,
        userId: session.user.id
      }
    })

    if (!participation) {
      return NextResponse.json({ error: 'Quiz participation not found' }, { status: 404 })
    }

    if (!participation.isCompleted) {
      return NextResponse.json({ error: 'Quiz participation is not completed' }, { status: 400 })
    }

    // Check if credits have already been claimed for this participation
    if (participation.creditsClaimed) {
      return NextResponse.json({ error: 'Credits already claimed for this participation' }, { status: 409 })
    }

    // Calculate credits from quiz points (50 points = 1 credit)
    const pointsEarned = participation.totalScore
    const creditsToAdd = Math.floor(pointsEarned / 50)

    if (creditsToAdd === 0) {
      return NextResponse.json({ 
        error: 'Insufficient points to claim credits',
        pointsEarned,
        requiredPoints: 50,
        message: 'You need at least 50 points to earn 1 credit'
      }, { status: 400 })
    }

    // Check weekly cooldown (can only claim once per week)
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    const lastClaim = await prisma.pointTransaction.findFirst({
      where: {
        userPoints: {
          userId: session.user.id
        },
        type: 'QUIZ_COMPLETION'
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    if (lastClaim && lastClaim.createdAt > oneWeekAgo) {
      const daysUntilNextClaim = Math.ceil((lastClaim.createdAt.getTime() - oneWeekAgo.getTime()) / (1000 * 60 * 60 * 24))
      return NextResponse.json({ 
        error: 'Weekly cooldown active',
        daysUntilNextClaim,
        message: `You can claim quiz credits again in ${daysUntilNextClaim} days`
      }, { status: 429 })
    }

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Get or create UserPoints record
      let userPoints = await tx.userPoints.findUnique({
        where: { userId: session.user.id }
      })

      if (!userPoints) {
        userPoints = await tx.userPoints.create({
          data: {
            userId: session.user.id,
            points: 0,
            totalEarned: 0
          }
        })
      }

      // Add quiz points to UserPoints
      const updatedUserPoints = await tx.userPoints.update({
        where: { id: userPoints.id },
        data: {
          points: {
            increment: pointsEarned
          },
          totalEarned: {
            increment: pointsEarned
          }
        }
      })

      // Mark participation as claimed
      await tx.quizParticipation.update({
        where: { id: participationId },
        data: {
          creditsClaimed: true,
          claimedAt: new Date()
        }
      })

      // Create transaction record
      const transaction = await tx.pointTransaction.create({
        data: {
          userPointsId: userPoints.id,
          userId: session.user.id, // Add the missing userId field
          type: 'QUIZ_COMPLETION',
          amount: pointsEarned,
          description: `Quiz completion: ${participation.correctAnswers}/${participation.questionsAnswered} correct answers`,
          metadata: {
            participationId,
            totalScore: participation.totalScore,
            correctAnswers: participation.correctAnswers,
            questionsAnswered: participation.questionsAnswered
          }
        }
      })

      return {
        userPoints: updatedUserPoints,
        transaction
      }
    })

    // Calculate current credit balance
    const currentCredits = Math.floor(result.userPoints.points / 50)
    const remainingPoints = result.userPoints.points % 50

    logger.info('Quiz credits claimed successfully', {
      tags: ['quiz', 'credits', 'claim'],
      data: {
        userId: session.user.id,
        participationId,
        pointsEarned,
        creditsAdded: creditsToAdd,
        currentCredits,
        remainingPoints
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Quiz credits claimed successfully',
      data: {
        creditsAdded: creditsToAdd,
        pointsEarned,
        currentCredits,
        remainingPoints,
        totalPoints: result.userPoints.points,
        message: `Earned ${creditsToAdd} credit${creditsToAdd !== 1 ? 's' : ''} from ${pointsEarned} quiz points`
      }
    })

  } catch (error) {
    logger.error('Error claiming quiz credits', {
      tags: ['quiz', 'credits', 'claim'],
      error: error instanceof Error ? error : undefined
    })

    return NextResponse.json(
      { error: 'Failed to claim quiz credits' },
      { status: 500 }
    )
  }
}
