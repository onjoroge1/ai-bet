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

    // Check if quickPurchase exists (since TimelineFeed uses QuickPurchase records)
    const quickPurchase = await prisma.quickPurchase.findUnique({
      where: { id: predictionId },
      include: {
        country: {
          select: {
            currencyCode: true,
            currencySymbol: true
          }
        }
      }
    });

    if (!quickPurchase) {
      return NextResponse.json({ error: 'Prediction not found' }, { status: 404 });
    }

    // Extract prediction data from JSON
    const matchData = quickPurchase.matchData as any;
    const predictionData = quickPurchase.predictionData as any;
    
    if (!matchData || !predictionData) {
      return NextResponse.json({ error: 'Invalid prediction data' }, { status: 400 });
    }

    // Check if user already purchased this tip (either with money or credits)
    const existingPurchase = await prisma.purchase.findFirst({
      where: {
        userId,
        quickPurchaseId: predictionId
      }
    });

    // Determine eligibility
    const hasEnoughCredits = totalCredits > 1; // More than 1 credit required
    const alreadyClaimed = !!existingPurchase;
    const isFree = predictionData.isFree || false;
    const isEligible = hasEnoughCredits && !alreadyClaimed && !isFree;

    return NextResponse.json({
      success: true,
      data: {
        isEligible,
        hasEnoughCredits,
        alreadyClaimed,
        isFree: isFree,
        currentCredits: totalCredits,
        requiredCredits: 1,
        creditBreakdown: {
          packageCredits: packageCreditsCount,
          quizCredits: quizCreditsCount,
          totalCredits: totalCredits,
          hasUnlimited
        },
        prediction: {
          id: quickPurchase.id,
          predictionType: quickPurchase.predictionType,
          odds: quickPurchase.odds,
          confidenceScore: quickPurchase.confidenceScore,
          valueRating: quickPurchase.valueRating,
          match: {
            homeTeam: matchData.home_team || matchData.homeTeam,
            awayTeam: matchData.away_team || matchData.awayTeam,
            league: matchData.league,
            matchDate: matchData.date
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