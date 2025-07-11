import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import { cacheManager, CacheManager } from '@/lib/cache-manager';

// GET /api/credits/claim-tip - Get claimed tips for the user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    
    const status = searchParams.get('status') || 'active';
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Create cache key based on user, status, limit, and offset
    const cacheKey = `claimed-tips:${userId}:${status}:${limit}:${offset}`;
    
    // Determine cache configuration based on status
    let cacheConfig = {
      ...CacheManager.CONFIGS.CLAIMED_TIPS,
      ttl: 300 // 5 minutes default
    };

    if (status === 'expired') {
      cacheConfig.ttl = 3600; // 1 hour for expired tips
    } else if (status === 'used') {
      cacheConfig.ttl = 1800; // 30 minutes for used tips
    } else {
      cacheConfig.ttl = 300; // 5 minutes for active tips
    }

    // Try to get from cache first
    const cachedData = await cacheManager.get(cacheKey, cacheConfig);
    if (cachedData) {
      const response = NextResponse.json(cachedData);
      
      // Set appropriate cache headers
      if (status === 'expired') {
        response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=1800');
      } else if (status === 'used') {
        response.headers.set('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=900');
      } else {
        response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=150');
      }
      
      return response;
    }

    // Build where clause based on status
    let whereClause: any = {
      userId,
      paymentMethod: 'credits'
    };

    // All claimed tips have status 'completed'
    whereClause.status = 'completed';

    // The frontend filters by expiration date, so we return all completed tips
    // and let the frontend handle the filtering based on expiresAt
    // This allows for proper active/used/expired categorization

    // Get claimed tips (purchases made with credits)
    const claimedTips = await prisma.purchase.findMany({
      where: whereClause,
      include: {
        quickPurchase: {
          include: {
            country: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      skip: offset
    });

    // Get total count for pagination
    const totalCount = await prisma.purchase.count({
      where: whereClause
    });

    // Transform data for frontend
    const transformedClaimedTips = claimedTips.map(purchase => {
      const quickPurchase = purchase.quickPurchase;
      const matchData = quickPurchase.matchData as any;
      
      return {
        id: purchase.id,
        predictionId: quickPurchase.matchId,
        creditsSpent: 1, // All credit claims cost 1 credit
        claimedAt: purchase.createdAt.toISOString(),
        expiresAt: new Date(purchase.createdAt.getTime() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from claim
        status: purchase.status,
        usedAt: purchase.status === 'completed' ? purchase.updatedAt.toISOString() : undefined,
        prediction: {
          id: quickPurchase.matchId,
          predictionType: quickPurchase.predictionType || 'unknown',
          odds: quickPurchase.odds || 0,
          confidenceScore: quickPurchase.confidenceScore || 0,
          valueRating: quickPurchase.valueRating || 'medium',
          explanation: quickPurchase.analysisSummary || '',
          match: {
            id: quickPurchase.matchId,
            homeTeam: {
              name: matchData?.home_team || 'Unknown Team'
            },
            awayTeam: {
              name: matchData?.away_team || 'Unknown Team'
            },
            league: {
              name: matchData?.league || 'Unknown League'
            },
            matchDate: matchData?.date || purchase.createdAt.toISOString()
          }
        }
      };
    });

    const responseData = {
      success: true,
      data: {
        claimedTips: transformedClaimedTips,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount
        }
      }
    };

    // Cache the result
    await cacheManager.set(cacheKey, responseData, cacheConfig);

    // Create response with appropriate caching based on status
    const response = NextResponse.json(responseData);
    
    // Set cache headers based on status
    if (status === 'expired') {
      // Expired tips rarely change, cache for 1 hour
      response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=1800');
    } else if (status === 'used') {
      // Used tips don't change much, cache for 30 minutes
      response.headers.set('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=900');
    } else {
      // Active tips change frequently, cache for 5 minutes
      response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=150');
    }

    return response;

  } catch (error) {
    console.error('Error fetching claimed tips:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch claimed tips' 
    }, { status: 500 });
  }
}

// POST /api/credits/claim-tip - Claim a tip using credits (unified with QuickPurchase)
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
        predictionCredits: true,
        countryId: true
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

    // Check if user already purchased this tip (either with money or credits)
    const existingPurchase = await prisma.purchase.findFirst({
      where: {
        userId,
        quickPurchase: {
          matchId: prediction.matchId
        }
      }
    });

    if (existingPurchase) {
      return NextResponse.json({ 
        error: 'Tip already purchased',
        purchaseId: existingPurchase.id,
        purchasedAt: existingPurchase.createdAt
      }, { status: 409 });
    }

    // Find or create a QuickPurchase record for this prediction
    let quickPurchase = await prisma.quickPurchase.findFirst({
      where: {
        matchId: prediction.matchId,
        isPredictionActive: true
      }
    });

    // If no QuickPurchase exists, create one from the prediction data
    if (!quickPurchase) {
      quickPurchase = await prisma.quickPurchase.create({
        data: {
          name: `AI Prediction - ${prediction.predictionType.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}`,
          price: new Prisma.Decimal(1), // 1 credit worth
          description: prediction.explanation || 'AI-powered prediction',
          features: ['AI Analysis', 'Confidence Score', 'Value Rating'],
          type: 'prediction',
          iconName: 'Brain',
          colorGradientFrom: 'from-blue-500',
          colorGradientTo: 'to-cyan-500',
          isUrgent: false,
          isPopular: false,
          isActive: true,
          displayOrder: 1,
          countryId: user.countryId || 'clx1q8b0000000000000000001', // Default country
          matchId: prediction.matchId,
          matchData: {
            home_team: prediction.match.homeTeam.name,
            away_team: prediction.match.awayTeam.name,
            league: prediction.match.league.name,
            date: prediction.match.matchDate.toISOString(),
            venue: null,
            match_importance: 'regular_season'
          },
          predictionData: {
            prediction: {
              match_info: {
                home_team: prediction.match.homeTeam.name,
                away_team: prediction.match.awayTeam.name,
                league: prediction.match.league.name,
                date: prediction.match.matchDate.toISOString(),
                venue: null,
                match_importance: 'regular_season'
              },
              comprehensive_analysis: {
                ml_prediction: {
                  confidence: prediction.confidenceScore || 60,
                  home_win: prediction.predictionType === 'home_win' ? 0.6 : 0.2,
                  away_win: prediction.predictionType === 'away_win' ? 0.6 : 0.2,
                  draw: prediction.predictionType === 'draw' ? 0.6 : 0.2,
                  model_type: 'unified_production'
                },
                ai_verdict: {
                  recommended_outcome: prediction.predictionType?.replace(/_/g, ' ') || 'unknown',
                  confidence_level: prediction.confidenceScore >= 80 ? 'High' : 
                                    prediction.confidenceScore >= 60 ? 'Medium' : 'Low',
                  probability_assessment: {
                    home: prediction.predictionType === 'home_win' ? 0.6 : 0.2,
                    away: prediction.predictionType === 'away_win' ? 0.6 : 0.2,
                    draw: prediction.predictionType === 'draw' ? 0.6 : 0.2
                  }
                },
                detailed_reasoning: {
                  form_analysis: prediction.explanation || 'AI-powered prediction analysis',
                  injury_impact: 'No significant injuries reported',
                  tactical_factors: 'Based on current form and tactical analysis',
                  historical_context: 'Historical data supports this prediction',
                  ml_model_weight: '50% of decision based on ML model'
                },
                risk_analysis: {
                  key_risks: ['Market volatility may affect odds'],
                  overall_risk: prediction.confidenceScore >= 80 ? 'Low' : 
                               prediction.confidenceScore >= 60 ? 'Medium' : 'High',
                  upset_potential: 'Standard risk level for this type of prediction'
                },
                betting_intelligence: {
                  primary_bet: `${prediction.predictionType?.replace(/_/g, ' ')} with odds around ${prediction.odds}`,
                  value_bets: [`${prediction.predictionType?.replace(/_/g, ' ')} and over 1.5 goals`],
                  avoid_bets: ['High-risk accumulator bets', 'Betting against the prediction']
                },
                confidence_breakdown: `The ${prediction.confidenceScore >= 80 ? 'high' : prediction.confidenceScore >= 60 ? 'medium' : 'low'} confidence level is based on the ML model prediction, current form analysis, and historical data. The prediction suggests a ${prediction.predictionType?.replace(/_/g, ' ')} outcome.`
              },
              additional_markets: {
                total_goals: {
                  over_1_5: 0.7,
                  under_1_5: 0.3
                },
                both_teams_score: {
                  yes: 0.6,
                  no: 0.4
                }
              },
              analysis_metadata: {
                analysis_type: 'comprehensive',
                data_sources: ['ml_model', 'historical_data', 'form_analysis'],
                ai_model: 'gpt-4o',
                processing_time: 2.5,
                ml_model_accuracy: '71.5%',
                analysis_timestamp: new Date().toISOString()
              },
              processing_time: 2.5,
              timestamp: new Date().toISOString()
            }
          },
          predictionType: prediction.predictionType,
          confidenceScore: prediction.confidenceScore,
          odds: prediction.odds,
          valueRating: prediction.valueRating,
          analysisSummary: prediction.explanation,
          isPredictionActive: true
        }
      });
    }

    // Calculate expiration (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Get current unified credit balance
      const [userPackages, userPoints] = await Promise.all([
        tx.userPackage.findMany({
          where: {
            userId: userId,
            status: "active",
            expiresAt: {
              gt: new Date()
            },
            tipsRemaining: {
              gt: 0
            }
          },
          include: {
            packageOffer: true
          },
          orderBy: {
            expiresAt: "asc" // Use packages that expire first
          }
        }),
        tx.userPoints.findUnique({
          where: { userId }
        })
      ]);

      // Calculate available credits
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

      const quizCreditsCount = userPoints ? Math.floor(userPoints.points / 50) : 0;
      const totalUnifiedCredits = hasUnlimited ? Infinity : (packageCreditsCount + quizCreditsCount);

      // Check if user has enough unified credits
      if (totalUnifiedCredits < 1) {
        throw new Error('Insufficient unified credits');
      }

      let creditDeductionSource = '';
      let updatedUser = null;

      // Deduct from package credits first
      if (packageCreditsCount > 0) {
        // Find the package with the earliest expiration that has remaining tips
        const packageToUse = userPackages.find(pkg => pkg.tipsRemaining > 0);
        if (packageToUse) {
          await tx.userPackage.update({
            where: { id: packageToUse.id },
            data: {
              tipsRemaining: {
                decrement: 1
              }
            }
          });
          creditDeductionSource = 'package';
        }
      }
      // If no package credits, deduct from quiz points
      else if (quizCreditsCount > 0 && userPoints) {
        const pointsToDeduct = 50; // 50 points = 1 credit
        if (userPoints.points >= pointsToDeduct) {
          await tx.userPoints.update({
            where: { userId },
            data: {
              points: {
                decrement: pointsToDeduct
              }
            }
          });
          creditDeductionSource = 'quiz';
        }
      }
      // Fallback to direct credits if no unified credits available
      else {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { predictionCredits: true }
        });
        
        if (!user || user.predictionCredits <= 1) {
          throw new Error('Insufficient credits');
        }

        updatedUser = await tx.user.update({
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
        creditDeductionSource = 'direct';
      }

      // Create purchase record (unified with monetary purchases)
      const purchase = await tx.purchase.create({
        data: {
          userId,
          quickPurchaseId: quickPurchase.id,
          amount: new Prisma.Decimal(0), // No monetary amount for credit purchases
          paymentMethod: 'credits',
          status: 'completed'
        }
      });

      return {
        user: updatedUser,
        purchase,
        creditDeductionSource
      };
    });

    // Get the purchase with QuickPurchase data for response
    const purchaseWithQuickPurchase = await prisma.purchase.findUnique({
      where: { id: result.purchase.id },
      include: {
        quickPurchase: {
          include: {
            country: true
          }
        }
      }
    });

    // Calculate remaining credits based on deduction source
    let remainingCredits = 0;
    let creditBreakdown = {
      packageCredits: 0,
      quizCredits: 0,
      totalCredits: 0,
      hasUnlimited: false
    };

    if (result.creditDeductionSource === 'package') {
      // Recalculate package credits after deduction
      const updatedUserPackages = await prisma.userPackage.findMany({
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

      let packageCreditsCount = 0;
      let hasUnlimited = false;

      for (const userPackage of updatedUserPackages) {
        if (userPackage.packageOffer.tipCount === -1) {
          hasUnlimited = true;
          break;
        } else {
          packageCreditsCount += userPackage.tipsRemaining;
        }
      }

      const userPoints = await prisma.userPoints.findUnique({
        where: { userId }
      });
      const quizCreditsCount = userPoints ? Math.floor(userPoints.points / 50) : 0;

      remainingCredits = hasUnlimited ? Infinity : (packageCreditsCount + quizCreditsCount);
      creditBreakdown = {
        packageCredits: packageCreditsCount,
        quizCredits: quizCreditsCount,
        totalCredits: remainingCredits,
        hasUnlimited
      };
    } else if (result.creditDeductionSource === 'quiz') {
      // Recalculate quiz credits after deduction
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

      const updatedUserPoints = await prisma.userPoints.findUnique({
        where: { userId }
      });
      const quizCreditsCount = updatedUserPoints ? Math.floor(updatedUserPoints.points / 50) : 0;

      remainingCredits = hasUnlimited ? Infinity : (packageCreditsCount + quizCreditsCount);
      creditBreakdown = {
        packageCredits: packageCreditsCount,
        quizCredits: quizCreditsCount,
        totalCredits: remainingCredits,
        hasUnlimited
      };
    } else {
      // Direct credits were used
      remainingCredits = result.user?.predictionCredits || 0;
      creditBreakdown = {
        packageCredits: 0,
        quizCredits: 0,
        totalCredits: remainingCredits,
        hasUnlimited: false
      };
    }

    // Send notification
    try {
      const { NotificationService } = await import('@/lib/notification-service');
      
      await NotificationService.createNotification({
        userId,
        title: 'Tip Claimed Successfully',
        message: `You've claimed a tip for ${prediction.match.homeTeam.name} vs ${prediction.match.awayTeam.name} using 1 credit.`,
        type: 'success',
        category: 'prediction',
        metadata: {
          predictionId,
          purchaseId: result.purchase.id,
          creditsSpent: 1,
          remainingCredits: remainingCredits,
          creditDeductionSource: result.creditDeductionSource,
          creditBreakdown
        }
      });
    } catch (error) {
      console.error('Failed to send notification:', error);
    }

    // Invalidate user's claimed tips cache to ensure fresh data
    try {
      await cacheManager.invalidatePattern(`claimed-tips:${userId}:*`);
      // Also invalidate credit balance cache
      await cacheManager.delete(`credit-balance:${userId}`, { prefix: 'credits' });
    } catch (error) {
      console.error('Failed to invalidate cache:', error);
      // Don't fail the request if cache invalidation fails
    }

    return NextResponse.json({
      success: true,
      message: 'Tip claimed successfully',
      data: {
        purchaseId: result.purchase.id,
        quickPurchase: {
          id: purchaseWithQuickPurchase?.quickPurchase.id,
          name: purchaseWithQuickPurchase?.quickPurchase.name,
          predictionType: purchaseWithQuickPurchase?.quickPurchase.predictionType,
          odds: purchaseWithQuickPurchase?.quickPurchase.odds,
          confidenceScore: purchaseWithQuickPurchase?.quickPurchase.confidenceScore,
          valueRating: purchaseWithQuickPurchase?.quickPurchase.valueRating,
          analysisSummary: purchaseWithQuickPurchase?.quickPurchase.analysisSummary,
          predictionData: purchaseWithQuickPurchase?.quickPurchase.predictionData,
          match: {
            id: prediction.match.id,
            homeTeam: prediction.match.homeTeam.name,
            awayTeam: prediction.match.awayTeam.name,
            league: prediction.match.league.name,
            matchDate: prediction.match.matchDate
          }
        },
        creditsSpent: 1,
        remainingCredits: remainingCredits,
        creditDeductionSource: result.creditDeductionSource,
        creditBreakdown,
        expiresAt: expiresAt
      }
    });

  } catch (error) {
    console.error('Error claiming tip with credits:', error);
    return NextResponse.json({ 
      error: 'Failed to claim tip' 
    }, { status: 500 });
  }
} 