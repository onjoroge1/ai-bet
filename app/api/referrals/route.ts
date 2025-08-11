import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { 
  generateReferralCode, 
  validateReferralCode, 
  createReferralRecord,
  getUserReferralStats,
  processReferralRewards
} from '@/lib/referral-service'
import { logger } from '@/lib/logger'

/**
 * GET /api/referrals
 * Get user's referral information and statistics
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

    const userId = session.user.id

    // Get user's referral code
    const referralCode = await prisma.referralCode.findUnique({
      where: { userId },
      select: {
        code: true,
        isActive: true,
        usageCount: true,
        maxUsage: true,
        expiresAt: true
      }
    })

    // Generate referral code if it doesn't exist
    let code = referralCode?.code
    if (!code) {
      code = await generateReferralCode(userId)
    }

    // Get referral statistics
    const stats = await getUserReferralStats(userId)

    // Get recent referrals
    const recentReferrals = await prisma.referral.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        status: true,
        createdAt: true,
        creditsEarned: true,
        pointsEarned: true,
        metadata: true
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        referralCode: code,
        isActive: referralCode?.isActive ?? true,
        usageCount: referralCode?.usageCount ?? 0,
        maxUsage: referralCode?.maxUsage,
        expiresAt: referralCode?.expiresAt,
        stats,
        recentReferrals
      }
    })
  } catch (error) {
    logger.error('Error fetching referral data', {
      tags: ['referral', 'api'],
      error: error instanceof Error ? error : undefined
    })
    return NextResponse.json(
      { error: 'Failed to fetch referral data' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/referrals
 * Create a new referral record
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { referralCode, email, fullName, phone } = body

    if (!referralCode || !email) {
      return NextResponse.json(
        { error: 'Referral code and email are required' },
        { status: 400 }
      )
    }

    // Validate referral code
    const validation = await validateReferralCode(referralCode)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    // Check if user is trying to refer themselves
    if (validation.referrerId === session.user.id) {
      return NextResponse.json(
        { error: 'You cannot refer yourself' },
        { status: 400 }
      )
    }

    // Create referral record
    const referralId = await createReferralRecord({
      referrerId: validation.referrerId!,
      referralCode,
      email,
      fullName,
      phone
    })

    logger.info('Referral record created via API', {
      tags: ['referral', 'api'],
      data: {
        referralId,
        referrerId: validation.referrerId,
        referralCode,
        email
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        referralId,
        referrerName: validation.referrerName,
        message: 'Referral record created successfully'
      }
    })
  } catch (error) {
    logger.error('Error creating referral record', {
      tags: ['referral', 'api'],
      error: error instanceof Error ? error : undefined
    })

    if (error instanceof Error && error.message.includes('already been referred')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create referral record' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/referrals/:id/complete
 * Mark a referral as completed and process rewards
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const url = new URL(request.url)
    const referralId = url.pathname.split('/').pop()

    if (!referralId) {
      return NextResponse.json(
        { error: 'Referral ID is required' },
        { status: 400 }
      )
    }

    // Check if user has permission to complete this referral
    const referral = await prisma.referral.findUnique({
      where: { id: referralId },
      select: { referrerId: true, status: true }
    })

    if (!referral) {
      return NextResponse.json(
        { error: 'Referral not found' },
        { status: 404 }
      )
    }

    if (referral.status !== 'pending') {
      return NextResponse.json(
        { error: 'Referral is already completed or expired' },
        { status: 400 }
      )
    }

    // Process referral rewards
    await processReferralRewards(referralId)

    return NextResponse.json({
      success: true,
      message: 'Referral completed successfully'
    })
  } catch (error) {
    logger.error('Error completing referral', {
      tags: ['referral', 'api'],
      error: error instanceof Error ? error : undefined
    })
    return NextResponse.json(
      { error: 'Failed to complete referral' },
      { status: 500 }
    )
  }
} 