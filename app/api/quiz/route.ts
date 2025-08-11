import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { validateReferralCode, createReferralRecord } from '@/lib/referral-service'
import { logger } from '@/lib/logger'

/**
 * POST /api/quiz
 * Start a new quiz session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, referralCode, email, fullName, phone } = body

    if (action === 'startQuiz') {
      return await startQuiz(request, { referralCode, email, fullName, phone })
    } else if (action === 'submitQuiz') {
      return await submitQuiz(request, body)
    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      )
    }
  } catch (error) {
    logger.error('Error in quiz API', {
      tags: ['quiz', 'api'],
      error: error instanceof Error ? error : undefined
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Start a new quiz session
 */
async function startQuiz(
  request: NextRequest,
  data: { referralCode?: string; email?: string; fullName?: string; phone?: string }
) {
  try {
    const session = await getServerSession(authOptions)
    const isLoggedIn = !!session?.user?.id

    console.log('startQuiz called with:', { isLoggedIn, data, sessionUserId: session?.user?.id })

    // If user is logged in, skip the first two pages and go directly to quiz
    if (isLoggedIn) {
      console.log('Creating quiz session for logged-in user:', session.user.id)
      
      // Create a new quiz session for logged-in user
      const quizSession = await prisma.quizSession.create({
        data: {
          userId: session.user.id,
          status: 'in_progress',
          startTime: new Date(),
          currentQuestionIndex: 0,
          totalScore: 0,
          answers: [],
          referralCode: data.referralCode || null
        }
      })

      console.log('Created quiz session:', quizSession.id)

      // Get questions for the quiz - limit to 5 questions for better user experience
      const allQuestions = await prisma.quizQuestion.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          question: true,
          options: true,
          correctAnswer: true,
          points: true
        }
      })

      // Randomly select 5 questions from the available pool
      const questions = allQuestions
        .sort(() => Math.random() - 0.5) // Shuffle questions
        .slice(0, 5) // Take first 5

      const responseData = {
        success: true,
        data: {
          quizSessionId: quizSession.id,
          questions,
          skipIntro: true, // This tells the frontend to skip intro pages
          message: 'Quiz started successfully'
        }
      }

      console.log('Sending response for logged-in user:', responseData)
      return NextResponse.json(responseData)
    }

    // For non-logged-in users, handle referral code and create session
    let referralId: string | null = null
    let referrerName: string | null = null

    if (data.referralCode) {
      // Validate referral code
      const validation = await validateReferralCode(data.referralCode)
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error },
          { status: 400 }
        )
      }

      // Create referral record
      try {
        referralId = await createReferralRecord({
          referrerId: validation.referrerId!,
          referralCode: data.referralCode,
          email: data.email!,
          fullName: data.fullName,
          phone: data.phone
        })
        referrerName = validation.referrerName || null
      } catch (error) {
        if (error instanceof Error && error.message.includes('already been referred')) {
          return NextResponse.json(
            { error: error.message },
            { status: 409 }
          )
        }
        throw error
      }
    }

    // Create quiz session for non-logged-in user
    const quizSession = await prisma.quizSession.create({
      data: {
        email: data.email,
        fullName: data.fullName,
        phone: data.phone,
        status: 'in_progress',
        startTime: new Date(),
        currentQuestionIndex: 0,
        totalScore: 0,
        answers: [],
        referralCode: data.referralCode || null,
        referralId: referralId
      }
    })

    // Get questions for the quiz - limit to 5 questions for better user experience
    const allQuestions = await prisma.quizQuestion.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        question: true,
        options: true,
        correctAnswer: true,
        points: true
      }
    })

    // Randomly select 5 questions from the available pool
    const questions = allQuestions
      .sort(() => Math.random() - 0.5) // Shuffle questions
      .slice(0, 5) // Take first 5

    return NextResponse.json({
      success: true,
      data: {
        quizSessionId: quizSession.id,
        questions,
        skipIntro: false, // Non-logged-in users go through intro
        referralId,
        referrerName,
        message: 'Quiz started successfully'
      }
    })
  } catch (error) {
    logger.error('Error starting quiz', {
      tags: ['quiz', 'start'],
      error: error instanceof Error ? error : undefined
    })
    return NextResponse.json(
      { error: 'Failed to start quiz' },
      { status: 500 }
    )
  }
}

/**
 * Submit quiz answers and calculate score
 */
async function submitQuiz(request: NextRequest, data: any) {
  try {
    const { quizSessionId, answers } = data

    // Debug logging
    console.log('submitQuiz received data:', {
      quizSessionId,
      answersType: typeof answers,
      answersIsArray: Array.isArray(answers),
      answersLength: answers?.length,
      dataKeys: Object.keys(data)
    })

    if (!quizSessionId || !answers || !Array.isArray(answers)) {
      console.error('Validation failed:', {
        hasQuizSessionId: !!quizSessionId,
        hasAnswers: !!answers,
        answersIsArray: Array.isArray(answers)
      })
      return NextResponse.json(
        { error: 'Quiz session ID and answers are required' },
        { status: 400 }
      )
    }

    // Get quiz session
    const quizSession = await prisma.quizSession.findUnique({
      where: { id: quizSessionId },
      include: { referral: true }
    })

    if (!quizSession) {
      return NextResponse.json(
        { error: 'Quiz session not found' },
        { status: 404 }
      )
    }

    if (quizSession.status !== 'in_progress') {
      return NextResponse.json(
        { error: 'Quiz session is not in progress' },
        { status: 400 }
      )
    }

    // Calculate score
    let totalScore = 0
    const scoredAnswers = answers.map((answer: any) => {
      const question = answer.question
      const isCorrect = answer.selectedAnswer === question.correctAnswer
      const points = isCorrect ? question.points : 0
      totalScore += points

      return {
        questionId: question.id,
        selectedAnswer: answer.selectedAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect,
        points
      }
    })

    // Update quiz session
    await prisma.quizSession.update({
      where: { id: quizSessionId },
      data: {
        status: 'completed',
        endTime: new Date(),
        totalScore,
        answers: scoredAnswers
      }
    })

    // Create quiz participation record if user is logged in
    let quizParticipationId: string | null = null
    if (quizSession.userId) {
      const participation = await prisma.quizParticipation.create({
        data: {
          userId: quizSession.userId,
          email: quizSession.email || '',
          fullName: quizSession.fullName || '',
          bettingExperience: 'beginner', // Default value
          totalScore,
          questionsAnswered: answers.length,
          correctAnswers: scoredAnswers.filter(a => a.isCorrect).length,
          isCompleted: true,
          referralCode: quizSession.referralCode
        }
      })
      quizParticipationId = participation.id
    }

    // Process referral if exists
    if (quizSession.referralId && quizSession.referral) {
      try {
        // Update referral with quiz participation
        await prisma.referral.update({
          where: { id: quizSession.referralId },
          data: {
            quizParticipationId,
            status: 'completed',
            completedAt: new Date()
          }
        })

        // Award points to referrer (basic reward for quiz completion)
        const pointsToAward = 10
        await prisma.user.update({
          where: { id: quizSession.referral.referrerId },
          data: {
            totalReferrals: { increment: 1 },
            totalReferralEarnings: { increment: pointsToAward }
          }
        })

        // Add points to referrer's UserPoints
        await prisma.userPoints.upsert({
          where: { userId: quizSession.referral.referrerId },
          update: {
            points: { increment: pointsToAward },
            totalEarned: { increment: pointsToAward }
          },
          create: {
            userId: quizSession.referral.referrerId,
            points: pointsToAward,
            totalEarned: pointsToAward
          }
        })

        logger.info('Referral completed via quiz', {
          tags: ['quiz', 'referral'],
          data: {
            referralId: quizSession.referralId,
            referrerId: quizSession.referral.referrerId,
            pointsAwarded: pointsToAward
          }
        })
      } catch (error) {
        logger.error('Error processing referral completion', {
          tags: ['quiz', 'referral'],
          error: error instanceof Error ? error : undefined,
          data: { referralId: quizSession.referralId }
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        totalScore,
        correctAnswers: scoredAnswers.filter(a => a.isCorrect).length,
        totalQuestions: answers.length,
        message: 'Quiz completed successfully'
      }
    })
  } catch (error) {
    logger.error('Error submitting quiz', {
      tags: ['quiz', 'submit'],
      error: error instanceof Error ? error : undefined
    })
    return NextResponse.json(
      { error: 'Failed to submit quiz' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/quiz
 * Get quiz questions (for logged-in users who want to retry)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get questions for the quiz - limit to 5 questions for better user experience
    const allQuestions = await prisma.quizQuestion.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        question: true,
        options: true,
        correctAnswer: true,
        points: true
      }
    })

    // Randomly select 5 questions from the available pool
    const questions = allQuestions
      .sort(() => Math.random() - 0.5) // Shuffle questions
      .slice(0, 5) // Take first 5

    return NextResponse.json({
      success: true,
      data: {
        questions,
        skipIntro: true
      }
    })
  } catch (error) {
    logger.error('Error fetching quiz questions', {
      tags: ['quiz', 'api'],
      error: error instanceof Error ? error : undefined
    })
    return NextResponse.json(
      { error: 'Failed to fetch quiz questions' },
      { status: 500 }
    )
  }
} 