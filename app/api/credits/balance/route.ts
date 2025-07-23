import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { cacheManager, CacheManager } from '@/lib/cache-manager';

// GET /api/credits/balance - Get user's current credit balance
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Create cache key for user's credit balance
    const cacheKey = `credit-balance:${userId}`;
    const cacheConfig = CacheManager.CONFIGS.CREDIT_BALANCE;

    // Try to get from cache first
    const cachedData = await cacheManager.get(cacheKey, cacheConfig);
    if (cachedData) {
      return NextResponse.json({
        success: true,
        data: cachedData
      });
    }

    // Get user's direct prediction credits
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        id: true, 
        predictionCredits: true
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get user's quiz points
    const userPoints = await prisma.userPoints.findUnique({
      where: { userId }
    });

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
    let packageDetails = [];

    for (const userPackage of userPackages) {
      if (userPackage.packageOffer.tipCount === -1) {
        hasUnlimited = true;
        packageDetails.push({
          id: userPackage.id,
          name: userPackage.packageOffer.name,
          tipsRemaining: '∞',
          totalTips: '∞',
          expiresAt: userPackage.expiresAt
        });
        break;
      } else {
        packageCreditsCount += userPackage.tipsRemaining;
        packageDetails.push({
          id: userPackage.id,
          name: userPackage.packageOffer.name,
          tipsRemaining: userPackage.tipsRemaining,
          totalTips: userPackage.totalTips,
          expiresAt: userPackage.expiresAt
        });
      }
    }

    // Calculate quiz credits
    const quizCreditsCount = userPoints ? Math.floor(userPoints.points / 50) : 0;

    // Calculate total unified credits (same logic as other APIs)
    const totalUnifiedCredits = hasUnlimited ? "∞" : (packageCreditsCount + quizCreditsCount);

    // Get recent credit transactions for activity
    const recentTransactions = await prisma.creditTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        type: true,
        amount: true,
        description: true,
        createdAt: true,
        metadata: true
      }
    });

    const balanceData = {
      currentCredits: totalUnifiedCredits,
      directCredits: user.predictionCredits,
      creditBreakdown: {
        packageCredits: packageCreditsCount,
        quizCredits: quizCreditsCount,
        totalCredits: totalUnifiedCredits,
        hasUnlimited
      },
      quizCredits: quizCreditsCount, // <-- Add this line for explicit quizCredits field
      packages: packageDetails,
      quizPoints: userPoints ? userPoints.points : 0,
      recentActivity: recentTransactions.map(tx => ({
        id: tx.id,
        type: tx.type,
        amount: tx.amount,
        description: tx.description,
        createdAt: tx.createdAt.toISOString(),
        metadata: tx.metadata
      })),
      lastUpdated: new Date().toISOString()
    };

    // Cache the result
    await cacheManager.set(cacheKey, balanceData, cacheConfig);

    return NextResponse.json({
      success: true,
      data: balanceData
    });

  } catch (error) {
    console.error('Error fetching credit balance:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch credit balance' 
    }, { status: 500 });
  }
} 