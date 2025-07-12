import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';

// GET /api/credits/check-eligibility - Check if user can claim a tip with credits
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const predictionId = searchParams.get('predictionId');

    if (!predictionId) {
      return NextResponse.json({ error: 'Prediction ID is required' }, { status: 400 });
    }

    const userId = session.user.id;

    // Get user's unified credit balance (package credits + quiz credits)
    const [user, userPoints] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { 
          id: true, 
          predictionCredits: true
        }
      }),
      prisma.userPoints.findUnique({
        where: { userId }
      })
    ]);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get user's active packages for package credits
    const userPackages = await prisma.userPackage.findMany({
      where: {
        userId: userId,
        status: "active",
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        packageOffer: true
      }
    });

    // Calculate package credits
    let packageCreditsCount = 0;
    let hasUnlimited = false;

    for (const userPackage of userPackages) {
      if (userPackage.packageOffer.tipCount === -1) {
        hasUnlimited = true;
        break;
      } else {
        packageCreditsCount += userPackage.tipsRemaining;
      }
    }

    // Calculate quiz credits
    const quizCreditsCount = userPoints ? Math.floor(userPoints.points / 50) : 0;

    // Calculate total unified credits
    const totalCredits = hasUnlimited ? Infinity : (packageCreditsCount + quizCreditsCount);

    // Check if prediction exists
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

    // Check if user already purchased this tip (either with money or credits)
    const existingPurchase = await prisma.purchase.findFirst({
      where: {
        userId,
        quickPurchase: {
          matchId: prediction.matchId
        }
      }
    });

    // Determine eligibility
    const hasEnoughCredits = totalCredits > 1; // More than 1 credit required
    const alreadyClaimed = !!existingPurchase;
    const isEligible = hasEnoughCredits && !alreadyClaimed && !prediction.isFree;

    return NextResponse.json({
      success: true,
      data: {
        isEligible,
        hasEnoughCredits,
        alreadyClaimed,
        isFree: prediction.isFree,
        currentCredits: totalCredits,
        requiredCredits: 1,
        creditBreakdown: {
          packageCredits: packageCreditsCount,
          quizCredits: quizCreditsCount,
          totalCredits: totalCredits,
          hasUnlimited
        },
        prediction: {
          id: prediction.id,
          predictionType: prediction.predictionType,
          odds: prediction.odds,
          confidenceScore: prediction.confidenceScore,
          valueRating: prediction.valueRating,
          match: {
            homeTeam: prediction.match.homeTeam.name,
            awayTeam: prediction.match.awayTeam.name,
            league: prediction.match.league.name,
            matchDate: prediction.match.matchDate
          }
        },
        existingClaim: existingPurchase ? {
          id: existingPurchase.id,
          claimedAt: existingPurchase.createdAt,
          status: existingPurchase.status
        } : null
      }
    });

  } catch (error) {
    console.error('Error checking credit eligibility:', error);
    return NextResponse.json({ 
      error: 'Failed to check eligibility' 
    }, { status: 500 });
  }
} 