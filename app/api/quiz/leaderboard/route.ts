import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * GET /api/quiz/leaderboard
 * Get today's quiz leaderboard
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const includeCurrentUser = searchParams.get('includeCurrentUser') === 'true'
    const currentUserId = searchParams.get('userId')

    // Get today's date boundaries (UTC)
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

    // Fetch today's quiz participations with user data
    const todayParticipations = await prisma.quizParticipation.findMany({
      where: {
        participatedAt: {
          gte: startOfDay,
          lt: endOfDay
        },
        isCompleted: true,
        totalScore: {
          gt: 0 // Only include completed quizzes with scores
        }
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true
          }
        }
      },
      orderBy: [
        { totalScore: 'desc' },
        { correctAnswers: 'desc' },
        { participatedAt: 'asc' } // Earlier completion gets priority in case of tie
      ],
      take: limit + (includeCurrentUser ? 1 : 0) // Extra slot for current user if needed
    })

    // Process and rank the participations
    const leaderboardEntries = todayParticipations.map((participation, index) => {
      const rank = index + 1
      const displayName = participation.user?.fullName || 
                         participation.fullName || 
                         participation.email?.split('@')[0] || 
                         'Anonymous'
      
      return {
        id: participation.id,
        rank,
        name: displayName,
        score: `${participation.correctAnswers}/${participation.questionsAnswered}`,
        totalScore: participation.totalScore,
        correctAnswers: participation.correctAnswers,
        questionsAnswered: participation.questionsAnswered,
        time: formatTimeDifference(participation.participatedAt),
        credits: calculateCredits(participation.correctAnswers, participation.questionsAnswered),
        isCurrentUser: participation.userId === currentUserId,
        participatedAt: participation.participatedAt,
        userId: participation.userId
      }
    })

    // If we need to include current user and they're not in the top results
    let finalLeaderboard = leaderboardEntries
    if (includeCurrentUser && currentUserId) {
      const currentUserInTop = leaderboardEntries.some(entry => entry.userId === currentUserId)
      
      if (!currentUserInTop) {
        // Fetch current user's participation for today
        const currentUserParticipation = await prisma.quizParticipation.findFirst({
          where: {
            userId: currentUserId,
            participatedAt: {
              gte: startOfDay,
              lt: endOfDay
            },
            isCompleted: true
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                fullName: true
              }
            }
          }
        })

        if (currentUserParticipation) {
          const currentUserEntry = {
            id: currentUserParticipation.id,
            rank: 0, // Will be calculated below
            name: currentUserParticipation.user?.fullName || 
                   currentUserParticipation.fullName || 
                   currentUserParticipation.email?.split('@')[0] || 
                   'Anonymous',
            score: `${currentUserParticipation.correctAnswers}/${currentUserParticipation.questionsAnswered}`,
            totalScore: currentUserParticipation.totalScore,
            correctAnswers: currentUserParticipation.correctAnswers,
            questionsAnswered: currentUserParticipation.questionsAnswered,
            time: formatTimeDifference(currentUserParticipation.participatedAt),
            credits: calculateCredits(currentUserParticipation.correctAnswers, currentUserParticipation.questionsAnswered),
            isCurrentUser: true,
            participatedAt: currentUserParticipation.participatedAt,
            userId: currentUserParticipation.userId
          }

          // Insert current user in correct position based on score
          const insertIndex = finalLeaderboard.findIndex(entry => 
            entry.totalScore < currentUserEntry.totalScore || 
            (entry.totalScore === currentUserEntry.totalScore && entry.correctAnswers < currentUserEntry.correctAnswers)
          )

          if (insertIndex === -1) {
            finalLeaderboard.push(currentUserEntry)
          } else {
            finalLeaderboard.splice(insertIndex, 0, currentUserEntry)
          }

          // Recalculate ranks
          finalLeaderboard = finalLeaderboard.map((entry, index) => ({
            ...entry,
            rank: index + 1
          }))

          // Limit to requested size
          finalLeaderboard = finalLeaderboard.slice(0, limit)
        }
      }
    }

    // Get additional stats
    const todayStats = await prisma.quizParticipation.aggregate({
      where: {
        participatedAt: {
          gte: startOfDay,
          lt: endOfDay
        },
        isCompleted: true
      },
      _count: {
        id: true
      },
      _avg: {
        totalScore: true,
        correctAnswers: true
      }
    })

    const stats = {
      totalParticipants: todayStats._count.id,
      averageScore: Math.round((todayStats._avg.totalScore || 0) * 10) / 10,
      averageCorrect: Math.round((todayStats._avg.correctAnswers || 0) * 10) / 10
    }

    return NextResponse.json({
      success: true,
      data: {
        leaderboard: finalLeaderboard,
        stats,
        generatedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    logger.error('Error fetching quiz leaderboard', {
      tags: ['quiz', 'leaderboard', 'api'],
      error: error instanceof Error ? error : undefined
    })
    
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    )
  }
}

/**
 * Calculate credits based on quiz performance
 */
function calculateCredits(correctAnswers: number, totalQuestions: number): number {
  const percentage = (correctAnswers / totalQuestions) * 100
  
  if (percentage >= 100) return 50      // 5/5 correct
  if (percentage >= 80) return 25      // 4/5 correct
  if (percentage >= 60) return 10      // 3/5 correct
  if (percentage >= 40) return 5       // 2/5 correct
  return 0                              // 1/5 or 0/5 correct
}

/**
 * Format time difference from now
 */
function formatTimeDifference(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return 'Today'
}
