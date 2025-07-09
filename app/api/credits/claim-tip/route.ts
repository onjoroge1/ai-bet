import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';

// POST /api/credits/claim-tip - Claim a tip using credits
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { predictionId } = await request.json();

    if (!predictionId) {
      return NextResponse.json({ error: 'Prediction ID is required' }, { status: 400 });
    }

    const userId = session.user.id;

    // Check if user has enough credits (more than 1 credit required)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        id: true, 
        email: true, 
        predictionCredits: true
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // User needs more than 1 credit to claim a tip (since it costs 1 credit)
    if (user.predictionCredits <= 1) {
      return NextResponse.json({ 
        error: 'Insufficient credits',
        currentCredits: user.predictionCredits,
        requiredCredits: 1,
        message: 'You need more than 1 credit to claim a tip'
      }, { status: 400 });
    }

    // Check if prediction exists and is available
    const prediction = await prisma.prediction.findUnique({
      where: { id: predictionId },
      include: {
        match: {
          include: {
            homeTeam: true,
            awayTeam: true,
            league: true
          }
        }
      }
    });

    if (!prediction) {
      return NextResponse.json({ error: 'Prediction not found' }, { status: 404 });
    }

    // Check if user already claimed this tip
    const existingClaim = await prisma.creditTipClaim.findUnique({
      where: {
        userId_predictionId: {
          userId,
          predictionId
        }
      }
    });

    if (existingClaim) {
      return NextResponse.json({ 
        error: 'Tip already claimed',
        claimId: existingClaim.id,
        claimedAt: existingClaim.claimedAt
      }, { status: 409 });
    }

    // Calculate expiration (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Deduct credits from user
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          predictionCredits: {
            decrement: 1
          }
        },
        select: {
          id: true,
          email: true,
          predictionCredits: true
        }
      });

      // Create credit transaction record
      const creditTransaction = await tx.creditTransaction.create({
        data: {
          userId,
          amount: -1, // Negative for spent
          type: 'spent',
          source: 'tip_claim',
          description: `Claimed tip for ${prediction.match.homeTeam.name} vs ${prediction.match.awayTeam.name}`,
          metadata: {
            predictionId,
            matchId: prediction.matchId,
            predictionType: prediction.predictionType,
            odds: prediction.odds,
            confidenceScore: prediction.confidenceScore
          }
        }
      });

      // Create credit tip claim record
      const creditTipClaim = await tx.creditTipClaim.create({
        data: {
          userId,
          predictionId,
          creditsSpent: 1,
          expiresAt,
          status: 'active'
        },
        include: {
          prediction: {
            include: {
              match: {
                include: {
                  homeTeam: true,
                  awayTeam: true,
                  league: true
                }
              }
            }
          }
        }
      });

      return {
        user: updatedUser,
        creditTransaction,
        creditTipClaim
      };
    });

    // Send notification
    try {
      const { NotificationService } = await import('@/lib/notification-service');
      await NotificationService.createNotification({
        userId,
        title: 'Tip Claimed Successfully',
        message: `You've claimed a tip for ${result.creditTipClaim.prediction.match.homeTeam.name} vs ${result.creditTipClaim.prediction.match.awayTeam.name} using 1 credit.`,
        type: 'success',
        category: 'prediction',
        metadata: {
          predictionId,
          claimId: result.creditTipClaim.id,
          creditsSpent: 1,
          remainingCredits: result.user.predictionCredits
        }
      });
    } catch (error) {
      console.error('Failed to send notification:', error);
    }

    return NextResponse.json({
      success: true,
      message: 'Tip claimed successfully',
      data: {
        claimId: result.creditTipClaim.id,
        prediction: {
          id: result.creditTipClaim.prediction.id,
          predictionType: result.creditTipClaim.prediction.predictionType,
          odds: result.creditTipClaim.prediction.odds,
          confidenceScore: result.creditTipClaim.prediction.confidenceScore,
          valueRating: result.creditTipClaim.prediction.valueRating,
          explanation: result.creditTipClaim.prediction.explanation,
          match: {
            id: result.creditTipClaim.prediction.match.id,
            homeTeam: result.creditTipClaim.prediction.match.homeTeam.name,
            awayTeam: result.creditTipClaim.prediction.match.awayTeam.name,
            league: result.creditTipClaim.prediction.match.league.name,
            matchDate: result.creditTipClaim.prediction.match.matchDate
          }
        },
        creditsSpent: 1,
        remainingCredits: result.user.predictionCredits,
        expiresAt: result.creditTipClaim.expiresAt
      }
    });

  } catch (error) {
    console.error('Error claiming tip with credits:', error);
    return NextResponse.json({ 
      error: 'Failed to claim tip' 
    }, { status: 500 });
  }
}

// GET /api/credits/claim-tip - Get user's claimed tips
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'active';
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    const userId = session.user.id;

    const claimedTips = await prisma.creditTipClaim.findMany({
      where: {
        userId,
        status
      },
      include: {
        prediction: {
          include: {
            match: {
              include: {
                homeTeam: true,
                awayTeam: true,
                league: true
              }
            }
          }
        }
      },
      orderBy: {
        claimedAt: 'desc'
      },
      take: limit,
      skip: offset
    });

    const totalCount = await prisma.creditTipClaim.count({
      where: {
        userId,
        status
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        claimedTips,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount
        }
      }
    });

  } catch (error) {
    console.error('Error fetching claimed tips:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch claimed tips' 
    }, { status: 500 });
  }
} 