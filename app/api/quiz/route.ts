import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get("action")
    
    switch (action) {
      case "questions":
        return await getQuizQuestions()
      case "leaderboard":
        return await getLeaderboard()
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("Quiz API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ...data } = body
    
    switch (action) {
      case "start":
        return await startQuiz(data)
      case "submit-answer":
        return await submitAnswer(data)
      case "complete":
        return await completeQuiz(data)
      case "referral":
        return await processReferral(data)
      case "claim-credits":
        return await claimQuizCredits(data)
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("Quiz API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

async function getQuizQuestions() {
  try {
    const questions = await prisma.quizQuestion.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      take: 5
    })
    
    return NextResponse.json({ questions })
  } catch (error) {
    console.error("Error fetching quiz questions:", error)
    return NextResponse.json({ error: "Failed to fetch questions" }, { status: 500 })
  }
}

async function getLeaderboard() {
  try {
    const leaderboard = await prisma.quizParticipation.findMany({
      where: { isCompleted: true },
      orderBy: { totalScore: "desc" },
      take: 10,
      select: {
        fullName: true,
        totalScore: true,
        correctAnswers: true,
        participatedAt: true
      }
    })
    
    return NextResponse.json({ leaderboard })
  } catch (error) {
    console.error("Error fetching leaderboard:", error)
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 })
  }
}

async function startQuiz(data: {
  email: string
  phone: string
  fullName: string
  bettingExperience: string
  referralCode?: string
}) {
  try {
    const session = await getServerSession(authOptions)
    
    // Check if user has already taken a quiz this week
    if (session?.user?.id) {
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
      
      const recentParticipation = await prisma.quizParticipation.findFirst({
        where: {
          userId: session.user.id,
          participatedAt: {
            gte: oneWeekAgo
          }
        }
      })
      
      if (recentParticipation) {
        const daysUntilNextQuiz = 7 - Math.floor((Date.now() - recentParticipation.participatedAt.getTime()) / (1000 * 60 * 60 * 24))
        return NextResponse.json({ 
          error: `You can only take the quiz once per week. Try again in ${daysUntilNextQuiz} days.`,
          daysUntilNextQuiz
        }, { status: 429 })
      }
    }
    
    const participation = await prisma.quizParticipation.create({
      data: {
        userId: session?.user?.id,
        email: data.email,
        phone: data.phone,
        fullName: data.fullName,
        bettingExperience: data.bettingExperience,
        referralCode: data.referralCode,
        isCompleted: false
      }
    })
    
    return NextResponse.json({ 
      participationId: participation.id,
      message: "Quiz started successfully" 
    })
  } catch (error) {
    console.error("Error starting quiz:", error)
    return NextResponse.json({ error: "Failed to start quiz" }, { status: 500 })
  }
}

async function submitAnswer(data: {
  participationId: string
  questionId: string
  selectedAnswer: string
}) {
  try {
    const question = await prisma.quizQuestion.findUnique({
      where: { id: data.questionId }
    })
    
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 })
    }
    
    const isCorrect = data.selectedAnswer === question.correctAnswer
    const pointsEarned = isCorrect ? question.points : 0
    
    const answer = await prisma.quizAnswer.create({
      data: {
        quizParticipationId: data.participationId,
        quizQuestionId: data.questionId,
        selectedAnswer: data.selectedAnswer,
        isCorrect,
        pointsEarned
      }
    })
    
    // Update participation stats
    await prisma.quizParticipation.update({
      where: { id: data.participationId },
      data: {
        questionsAnswered: { increment: 1 },
        correctAnswers: { increment: isCorrect ? 1 : 0 },
        totalScore: { increment: pointsEarned }
      }
    })
    
    return NextResponse.json({ 
      answer,
      isCorrect,
      pointsEarned,
      correctAnswer: question.correctAnswer
    })
  } catch (error) {
    console.error("Error submitting answer:", error)
    return NextResponse.json({ error: "Failed to submit answer" }, { status: 500 })
  }
}

async function completeQuiz(data: { participationId: string }) {
  try {
    const participation = await prisma.quizParticipation.update({
      where: { id: data.participationId },
      data: { isCompleted: true },
      include: {
        quizAnswers: {
          include: { quizQuestion: true }
        }
      }
    })
    
    // Calculate final stats
    const totalQuestions = participation.quizAnswers.length
    const correctAnswers = participation.quizAnswers.filter((a: { isCorrect: boolean }) => a.isCorrect).length
    const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0
    
    // Calculate bonus points based on performance
    let bonusPoints = 0
    if (accuracy >= 90) bonusPoints = 50
    else if (accuracy >= 80) bonusPoints = 30
    else if (accuracy >= 70) bonusPoints = 20
    else if (accuracy >= 60) bonusPoints = 10
    
    // Update total score with bonus
    const finalScore = participation.totalScore + bonusPoints
    await prisma.quizParticipation.update({
      where: { id: data.participationId },
      data: { 
        totalScore: finalScore
      }
    })
    
    return NextResponse.json({
      participation: { ...participation, totalScore: finalScore },
      stats: {
        totalPoints: finalScore,
        correctAnswers,
        totalQuestions,
        accuracy,
        bonusPoints
      }
    })
  } catch (error) {
    console.error("Error completing quiz:", error)
    return NextResponse.json({ error: "Failed to complete quiz" }, { status: 500 })
  }
}

async function processReferral(data: {
  participationId: string
  friendsInvited: string[]
  referralCode: string
}) {
  try {
    // Update participation with referral info
    await prisma.quizParticipation.update({
      where: { id: data.participationId },
      data: {
        referralCode: data.referralCode
      }
    })
    
    // Calculate referral bonus points (5 points per friend invited)
    const referralBonus = data.friendsInvited.length * 5
    
    // Update participation with referral bonus
    await prisma.quizParticipation.update({
      where: { id: data.participationId },
      data: {
        totalScore: { increment: referralBonus }
      }
    })
    
    // Create referral records for invited friends
    const referrals = await Promise.all(
      data.friendsInvited.map(() =>
        prisma.referral.create({
          data: {
            referrerId: data.participationId,
            referredId: data.participationId, // Using same ID as placeholder
            referralCode: data.referralCode,
            referralType: "quiz",
            quizParticipationId: data.participationId,
            status: "pending",
            commissionAmount: 0, // Will be calculated when friend completes quiz
            pointsEarned: 0
          }
        })
      )
    )
    
    return NextResponse.json({
      referrals,
      referralBonus,
      message: "Referrals processed successfully"
    })
  } catch (error) {
    console.error("Error processing referrals:", error)
    return NextResponse.json({ error: "Failed to process referrals" }, { status: 500 })
  }
}

async function claimQuizCredits(data: { participationId: string }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }
    
    // Get the quiz participation
    const participation = await prisma.quizParticipation.findUnique({
      where: { id: data.participationId }
    })
    
    if (!participation) {
      return NextResponse.json({ error: "Quiz participation not found" }, { status: 404 })
    }
    
    if (!participation.isCompleted) {
      return NextResponse.json({ error: "Quiz must be completed before claiming credits" }, { status: 400 })
    }
    
    // Check if user has already claimed credits this week
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    
    // First get the user's UserPoints record
    const userPoints = await prisma.userPoints.findUnique({
      where: { userId: session.user.id }
    })
    
    if (userPoints) {
      const recentClaim = await prisma.pointTransaction.findFirst({
        where: {
          userPointsId: userPoints.id,
          type: "QUIZ_COMPLETION",
          createdAt: {
            gte: oneWeekAgo
          }
        }
      })
      
      if (recentClaim) {
        const daysUntilNextClaim = 7 - Math.floor((Date.now() - recentClaim.createdAt.getTime()) / (1000 * 60 * 60 * 24))
        return NextResponse.json({ 
          error: `You can only claim quiz credits once per week. Try again in ${daysUntilNextClaim} days.`,
          daysUntilNextClaim
        }, { status: 429 })
      }
    }
    
    // Convert quiz points to dashboard credits (50 points = 1 credit)
    const creditsToAdd = Math.floor(participation.totalScore / 50)
    
    if (creditsToAdd === 0) {
      return NextResponse.json({ 
        error: "You need at least 50 quiz points to claim credits. Complete more questions correctly or invite friends to earn more points.",
        pointsNeeded: 50 - participation.totalScore
      }, { status: 400 })
    }
    
    // Add credits to user's account
    const userPointsUpdate = await prisma.userPoints.upsert({
      where: { userId: session.user.id },
      update: {
        points: { increment: creditsToAdd }
      },
      create: {
        userId: session.user.id,
        points: creditsToAdd
      }
    })
    
    // Create point transaction record
    await prisma.pointTransaction.create({
      data: {
        userPointsId: userPointsUpdate.id,
        userId: session.user.id,
        amount: creditsToAdd,
        type: "QUIZ_COMPLETION",
        description: `Quiz completion bonus - ${participation.totalScore} points`,
        reference: `quiz_${participation.id}`
      }
    })
    
    return NextResponse.json({
      success: true,
      creditsAdded: creditsToAdd,
      message: "Quiz credits claimed successfully"
    })
  } catch (error) {
    console.error("Error claiming quiz credits:", error)
    return NextResponse.json({ error: "Failed to claim credits" }, { status: 500 })
  }
} 