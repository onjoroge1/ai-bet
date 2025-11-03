import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

/**
 * Get or create prediction data for a match
 * Automatically creates/updates QuickPurchase entry when prediction data is fetched from backend
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { match_id } = body;

    if (!match_id) {
      return NextResponse.json(
        { error: 'match_id is required' },
        { status: 400 }
      );
    }

    const matchIdStr = String(match_id);

    // First, check if prediction data already exists in QuickPurchase table
    const existingQuickPurchase = await prisma.quickPurchase.findFirst({
      where: {
        matchId: matchIdStr,
        predictionData: { not: null }
      },
      select: {
        id: true,
        predictionData: true,
        matchData: true
      }
    });

    // If QuickPurchase exists with predictionData, return it instead of calling backend
    if (existingQuickPurchase?.predictionData) {
      console.log(`[Predict API] Using existing predictionData from QuickPurchase for match ${match_id}`);
      return NextResponse.json(existingQuickPurchase.predictionData);
    }

    // Only call backend API if no QuickPurchase record exists or it has no predictionData
    console.log(`[Predict API] No existing QuickPurchase found, calling backend API for match ${match_id}`);
    const response = await fetch(
      `${process.env.BACKEND_URL}/predict`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.BACKEND_API_KEY}`,
        },
        body: JSON.stringify({ match_id }),
      }
    );

    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`);
    }

    const predictionData = await response.json();

    // Automatically create or update QuickPurchase entry with prediction data
    try {
      // Get match info from prediction data or fetch separately
      const matchInfo = predictionData.match_info || predictionData.match || {}
      const homeTeam = matchInfo.home_team || matchInfo.home?.name || 'Home Team'
      const awayTeam = matchInfo.away_team || matchInfo.away?.name || 'Away Team'
      const league = matchInfo.league || matchInfo.league?.name || 'Unknown League'

      // Get default country for pricing (US as fallback)
      const defaultCountry = await prisma.country.findFirst({
        where: { code: 'US' }
      })

      if (!defaultCountry) {
        console.warn('[Predict API] No default country found, skipping QuickPurchase creation')
      } else {
        // Extract confidence score from prediction data
        const confidenceScore = predictionData.comprehensive_analysis?.ml_prediction?.confidence || 
                                predictionData.predictions?.confidence || 
                                predictionData.analysis?.confidence || 50

        // Determine prediction type
        const probabilities = predictionData.comprehensive_analysis?.ml_prediction || 
                            predictionData.predictions?.probs || {}
        let predictionType = 'unknown'
        if (probabilities.home_win > probabilities.draw && probabilities.home_win > probabilities.away_win) {
          predictionType = 'home'
        } else if (probabilities.away_win > probabilities.draw && probabilities.away_win > probabilities.home_win) {
          predictionType = 'away'
        } else {
          predictionType = 'draw'
        }

        // Create or update QuickPurchase
        await prisma.quickPurchase.upsert({
          where: {
            matchId: matchIdStr
          },
          update: {
            predictionData: predictionData as any,
            matchData: matchInfo as any,
            predictionType,
            confidenceScore: Math.round(confidenceScore),
            analysisSummary: predictionData.comprehensive_analysis?.ai_verdict?.recommended_outcome || 
                             predictionData.analysis?.summary || null,
            isPredictionActive: true,
            updatedAt: new Date()
          },
          create: {
            name: `${homeTeam} vs ${awayTeam}`,
            price: 9.99, // Default price, will be overridden by country-specific pricing
            originalPrice: 19.99,
            description: `AI prediction for ${homeTeam} vs ${awayTeam} in ${league}`,
            features: ['AI Analysis', 'Match Statistics', 'Risk Assessment'],
            type: 'prediction',
            iconName: 'Brain',
            colorGradientFrom: '#3B82F6',
            colorGradientTo: '#1D4ED8',
            countryId: defaultCountry.id,
            matchId: matchIdStr,
            matchData: matchInfo as any,
            predictionData: predictionData as any,
            predictionType,
            confidenceScore: Math.round(confidenceScore),
            analysisSummary: predictionData.comprehensive_analysis?.ai_verdict?.recommended_outcome || 
                             predictionData.analysis?.summary || null,
            isPredictionActive: true,
            isActive: true
          }
        })

        console.log(`[Predict API] Auto-created/updated QuickPurchase for match ${match_id}`)
      }
    } catch (qpError) {
      // Log but don't fail the request if QuickPurchase creation fails
      console.error(`[Predict API] Error creating QuickPurchase for match ${match_id}:`, qpError)
    }

    return NextResponse.json(predictionData);
  } catch (error) {
    console.error('Error getting prediction:', error);
    return NextResponse.json(
      { error: 'Failed to get prediction' },
      { status: 500 }
    );
  }
} 