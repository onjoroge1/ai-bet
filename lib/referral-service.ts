import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

export interface ReferralRewards {
  referrer: {
    credits: number
    points: number
  }
  referred: {
    credits: number
    points: number
  }
}

export interface ReferralCompletionCriteria {
  minQuizScore: number
  minPredictions: number
  accountAge: number // in milliseconds
  minPackagePurchases: number
}

export const REFERRAL_REWARDS: ReferralRewards = {
  referrer: {
    credits: 50,
    points: 100
  },
  referred: {
    credits: 25,
    points: 50
  }
}

export const REFERRAL_COMPLETION_CRITERIA: ReferralCompletionCriteria = {
  minQuizScore: 70,
  minPredictions: 3,
  accountAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  minPackagePurchases: 1
}

export const REFERRAL_EXPIRATION = {
  referralExpiresIn: 30 * 24 * 60 * 60 * 1000, // 30 days
  rewardExpiresIn: 90 * 24 * 60 * 60 * 1000     // 90 days
}

/**
 * Generate a unique referral code for a user
 */
export async function generateReferralCode(userId: string): Promise<string> {
  try {
    // Check if user already has a referral code
    const existingCode = await prisma.referralCode.findUnique({
      where: { userId }
    })

    if (existingCode) {
      return existingCode.code
    }

    // Generate unique code
    let code: string
    let attempts = 0
    const maxAttempts = 10

    do {
      code = generateUniqueCode()
      attempts++
      
      if (attempts > maxAttempts) {
        throw new Error('Failed to generate unique referral code after multiple attempts')
      }
    } while (await isCodeExists(code))

    // Create referral code
    await prisma.referralCode.create({
      data: {
        userId,
        code,
        isActive: true
      }
    })

    logger.info('Referral code generated', {
      tags: ['referral', 'code-generation'],
      data: { userId, code }
    })

    return code
  } catch (error) {
    logger.error('Error generating referral code', {
      tags: ['referral', 'code-generation'],
      error: error instanceof Error ? error : undefined,
      data: { userId }
    })
    throw error
  }
}

/**
 * Generate a unique 8-character alphanumeric code
 */
function generateUniqueCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

/**
 * Check if a referral code already exists
 */
async function isCodeExists(code: string): Promise<boolean> {
  const existing = await prisma.referralCode.findUnique({
    where: { code }
  })
  return !!existing
}

/**
 * Validate a referral code
 */
export async function validateReferralCode(code: string): Promise<{
  valid: boolean
  referrerName?: string
  referrerId?: string
  error?: string
}> {
  try {
    const referralCode = await prisma.referralCode.findUnique({
      where: { 
        code, 
        isActive: true 
      },
      include: { user: true }
    })

    if (!referralCode) {
      return { 
        valid: false, 
        error: 'Invalid referral code' 
      }
    }

    // Check usage limits
    if (referralCode.maxUsage && referralCode.usageCount >= referralCode.maxUsage) {
      return { 
        valid: false, 
        error: 'Referral code usage limit reached' 
      }
    }

    // Check expiration
    if (referralCode.expiresAt && referralCode.expiresAt < new Date()) {
      return { 
        valid: false, 
        error: 'Referral code has expired' 
      }
    }

    return { 
      valid: true, 
      referrerName: referralCode.user.fullName || referralCode.user.email,
      referrerId: referralCode.userId
    }
  } catch (error) {
    logger.error('Error validating referral code', {
      tags: ['referral', 'validation'],
      error: error instanceof Error ? error : undefined,
      data: { code }
    })
    return { 
      valid: false, 
      error: 'Error validating referral code' 
    }
  }
}

/**
 * Create a referral record
 */
export async function createReferralRecord(data: {
  referrerId: string
  referralCode: string
  email: string
  fullName?: string
  phone?: string
}): Promise<string> {
  try {
    // Check if referral already exists for this email and code
    const existingReferral = await prisma.referral.findFirst({
      where: {
        referralCode: data.referralCode,
        // Remove metadata query as it's not supported in where clause
      }
    })

    if (existingReferral) {
      throw new Error('Referral already exists for this email and code')
    }

    // Create referral record
    const referral = await prisma.referral.create({
      data: {
        referrerId: data.referrerId,
        referralCode: data.referralCode,
        referralType: 'quiz',
        status: 'pending',
        metadata: {
          email: data.email,
          fullName: data.fullName,
          phone: data.phone
        }
      }
    })

    return referral.id
  } catch (error) {
    console.error('Error creating referral record:', error)
    throw error
  }
}

/**
 * Check if a user meets referral completion criteria
 */
export async function validateCompletionCriteria(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        quizParticipations: true,
        userPredictions: true,
        userPackages: true
      }
    })

    if (!user) return false

    // Check account age
    const accountAge = Date.now() - user.createdAt.getTime()
    if (accountAge < REFERRAL_COMPLETION_CRITERIA.accountAge) {
      return false
    }

    // Check quiz participation with minimum score
    const hasValidQuiz = user.quizParticipations.some(
      quiz => quiz.totalScore >= REFERRAL_COMPLETION_CRITERIA.minQuizScore
    )

    // Check predictions made
    const predictionsCount = user.userPredictions.length

    // Check package purchases
    const packagePurchases = user.userPackages.length

    return hasValidQuiz && 
           predictionsCount >= REFERRAL_COMPLETION_CRITERIA.minPredictions &&
           packagePurchases >= REFERRAL_COMPLETION_CRITERIA.minPackagePurchases
  } catch (error) {
    logger.error('Error validating completion criteria', {
      tags: ['referral', 'completion-validation'],
      error: error instanceof Error ? error : undefined,
      data: { userId }
    })
    return false
  }
}

/**
 * Process referral completion and award rewards
 */
export async function processReferralRewards(referralId: string): Promise<void> {
  try {
    const referral = await prisma.referral.findUnique({
      where: { id: referralId },
      include: { referralCodeRef: true }
    })

    if (!referral || referral.status !== 'pending') {
      throw new Error('Invalid referral or already processed')
    }

    await prisma.$transaction(async (tx) => {
      // Update referral status
      await tx.referral.update({
        where: { id: referralId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          creditsEarned: REFERRAL_REWARDS.referrer.credits,
          pointsEarned: REFERRAL_REWARDS.referrer.points
        }
      })

      // Update referrer's credits and points
      await tx.user.update({
        where: { id: referral.referrerId },
        data: {
          totalCreditsEarned: {
            increment: REFERRAL_REWARDS.referrer.credits
          }
        }
      })

      // Update user points
      const userPoints = await tx.userPoints.findUnique({
        where: { userId: referral.referrerId }
      })

      if (userPoints) {
        await tx.userPoints.update({
          where: { userId: referral.referrerId },
          data: {
            points: {
              increment: REFERRAL_REWARDS.referrer.points
            }
          }
        })
      } else {
        await tx.userPoints.create({
          data: {
            userId: referral.referrerId,
            points: REFERRAL_REWARDS.referrer.points,
            totalEarned: REFERRAL_REWARDS.referrer.points,
            totalSpent: 0
          }
        })
      }

      // Update referral code usage count
      await tx.referralCode.update({
        where: { id: referral.referralCodeRef.id },
        data: { usageCount: { increment: 1 } }
      })

      // Create point transaction record
      const newUserPoints = await tx.userPoints.findUnique({
        where: { userId: referral.referrerId }
      })

      if (newUserPoints) {
        await tx.pointTransaction.create({
          data: {
            userId: referral.referrerId,
            userPointsId: newUserPoints.id,
            amount: REFERRAL_REWARDS.referrer.points,
            type: 'referral_reward',
            description: `Referral reward for ${referral.referralCode}`,
            metadata: {
              referralId: referral.id,
              referralCode: referral.referralCode
            }
          }
        })
      }

      // Create credit transaction record
      await tx.creditTransaction.create({
        data: {
          userId: referral.referrerId,
          amount: REFERRAL_REWARDS.referrer.credits,
          type: 'referral_reward',
          source: 'referral_system',
          description: `Referral reward for ${referral.referralCode}`,
          metadata: {
            referralId: referral.id,
            referralCode: referral.referralCode
          }
        }
      })
    })

    console.log(`Referral rewards processed for referral ${referralId}`)
  } catch (error) {
    console.error('Error processing referral rewards:', error)
    throw error
  }
}

/**
 * Get user's referral statistics
 */
export async function getUserReferralStats(userId: string) {
  try {
    const [totalReferrals, completedReferrals, totalEarned] = await Promise.all([
      prisma.referral.count({
        where: { referrerId: userId }
      }),
      prisma.referral.count({
        where: { referrerId: userId, status: 'completed' }
      }),
      prisma.referral.aggregate({
        where: { referrerId: userId, status: 'completed' },
        _sum: { creditsEarned: true }
      })
    ])

    const completionRate = totalReferrals > 0 ? completedReferrals / totalReferrals : 0

    return {
      totalReferrals,
      completedReferrals,
      totalEarned: totalEarned._sum.creditsEarned || 0,
      completionRate: Math.round(completionRate * 100) / 100
    }
  } catch (error) {
    console.error('Error getting user referral stats:', error)
    throw error
  }
} 