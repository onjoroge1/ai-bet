import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { processReferralRewards } from '@/lib/referral-service'
import { logger } from '@/lib/logger'

/**
 * PUT /api/referrals/[id]/complete
 * Mark a referral as completed and process rewards
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: referralId } = params

    if (!referralId) {
      return NextResponse.json(
        { error: 'Referral ID is required' },
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
      error: error instanceof Error ? error : undefined,
      data: { referralId: params.id }
    })
    return NextResponse.json(
      { error: 'Failed to complete referral' },
      { status: 500 }
    )
  }
} 