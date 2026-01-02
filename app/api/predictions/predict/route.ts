import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { Prisma } from '@prisma/client';

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

    // Check if MarketMatch exists for this matchId (for proper linking)
    const marketMatch = await prisma.marketMatch.findUnique({
      where: { matchId: matchIdStr },
      select: {
        id: true,
        homeTeam: true,
        awayTeam: true,
        league: true,
        leagueId: true,
        kickoffDate: true,
        homeTeamLogo: true,
        awayTeamLogo: true,
        consensusOdds: true,
        v1Model: true,
        v2Model: true
      }
    });

    // Get default country for pricing (US as fallback)
    const defaultCountry = await prisma.country.findFirst({
      where: { code: 'US' }
    })

    if (!defaultCountry) {
      return NextResponse.json(
        { error: 'Default country not found', details: 'US country must exist in database' },
        { status: 500 }
      )
    }

    // Check if QuickPurchase exists
    let quickPurchase = await prisma.quickPurchase.findFirst({
      where: {
        matchId: matchIdStr,
      },
      select: {
        id: true,
        predictionData: true,
        matchData: true,
        marketMatchId: true
      }
    });

    // Check if predictionData is valid (not null, not empty object, not JsonNull)
    const hasValidPredictionData = quickPurchase?.predictionData && 
      quickPurchase.predictionData !== null &&
      quickPurchase.predictionData !== Prisma.JsonNull &&
      JSON.stringify(quickPurchase.predictionData) !== '{}' &&
      JSON.stringify(quickPurchase.predictionData) !== 'null'

    // If QuickPurchase exists with valid predictionData, return it instead of calling backend
    if (hasValidPredictionData) {
      console.log(`[Predict API] Using existing predictionData from QuickPurchase for match ${match_id}`);
      return NextResponse.json({
        success: true,
        data: quickPurchase.predictionData,
        message: 'Using existing prediction data'
      });
    }

    // If QuickPurchase doesn't exist, create it first (like global sync does)
    if (!quickPurchase) {
      console.log(`[Predict API] QuickPurchase doesn't exist for match ${match_id}, creating entry first...`);
      
      // Use MarketMatch data if available, otherwise use placeholder
      const homeTeam = marketMatch?.homeTeam || 'Home Team'
      const awayTeam = marketMatch?.awayTeam || 'Away Team'
      const league = marketMatch?.league || 'Unknown League'

      // Build matchData - use MarketMatch data if available
      const matchDataForQuickPurchase = marketMatch ? {
        match_id: Number(match_id),
        home_team: marketMatch.homeTeam,
        away_team: marketMatch.awayTeam,
        league: marketMatch.league,
        league_id: marketMatch.leagueId,
        date: marketMatch.kickoffDate.toISOString(),
        home_team_logo: marketMatch.homeTeamLogo,
        away_team_logo: marketMatch.awayTeamLogo,
        consensus_odds: marketMatch.consensusOdds,
        v1_model: marketMatch.v1Model,
        v2_model: marketMatch.v2Model,
        source: 'marketmatch_table',
        sync_timestamp: new Date().toISOString()
      } : {
        match_id: Number(match_id),
        source: 'predict_api',
        sync_timestamp: new Date().toISOString()
      }

      try {
        quickPurchase = await prisma.quickPurchase.create({
          data: {
            name: `${homeTeam} vs ${awayTeam}`,
            price: 9.99,
            originalPrice: 19.99,
            description: `AI prediction for ${homeTeam} vs ${awayTeam} in ${league}`,
            features: ['AI Analysis', 'Match Statistics', 'Risk Assessment'],
            type: 'prediction',
            iconName: 'Brain',
            colorGradientFrom: '#3B82F6',
            colorGradientTo: '#1D4ED8',
            countryId: defaultCountry.id,
            matchId: matchIdStr,
            marketMatchId: marketMatch?.id || null,
            matchData: matchDataForQuickPurchase as any,
            predictionData: null, // Will be filled after API call
            isPredictionActive: true,
            isActive: true
          },
          select: {
            id: true,
            predictionData: true,
            matchData: true,
            marketMatchId: true
          }
        })
        console.log(`[Predict API] ✅ Created QuickPurchase entry for match ${match_id} (ID: ${quickPurchase.id})`);
      } catch (createError) {
        console.error(`[Predict API] ❌ Failed to create QuickPurchase for match ${match_id}:`, createError);
        return NextResponse.json(
          { 
            error: 'Failed to create QuickPurchase entry',
            details: createError instanceof Error ? createError.message : 'Unknown error'
          },
          { status: 500 }
        )
      }
    }

    // Only call backend API if no QuickPurchase record exists or it has no valid predictionData
    console.log(`[Predict API] No valid predictionData found for match ${match_id}, calling backend API...`);
    console.log(`[Predict API] Backend URL: ${process.env.BACKEND_URL}`);
    console.log(`[Predict API] Match ID: ${match_id} (string: ${matchIdStr})`);
    
    // Validate environment variables
    if (!process.env.BACKEND_URL) {
      console.error('[Predict API] ❌ BACKEND_URL environment variable is not set');
      return NextResponse.json(
        { error: 'Backend URL not configured', details: 'BACKEND_URL environment variable is missing' },
        { status: 500 }
      );
    }
    
    if (!process.env.BACKEND_API_KEY) {
      console.error('[Predict API] ❌ BACKEND_API_KEY environment variable is not set');
      return NextResponse.json(
        { error: 'Backend API key not configured', details: 'BACKEND_API_KEY environment variable is missing' },
        { status: 500 }
      );
    }
    
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
      const errorText = await response.text();
      console.error(`[Predict API] Backend API error for match ${match_id}:`, {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`Backend responded with status: ${response.status} - ${errorText}`);
    }

    const predictionData = await response.json();
    console.log(`[Predict API] Successfully fetched prediction data for match ${match_id}`, {
      hasData: !!predictionData,
      keys: predictionData ? Object.keys(predictionData) : []
    });

    // Automatically create or update QuickPurchase entry with prediction data
    try {
      // Get match info - prefer MarketMatch data if available, otherwise use prediction data
      const matchInfo = predictionData.match_info || predictionData.match || {}
      
      // Use MarketMatch data if available (richer information), otherwise fallback to prediction data
      const homeTeam = marketMatch?.homeTeam || matchInfo.home_team || matchInfo.home?.name || 'Home Team'
      const awayTeam = marketMatch?.awayTeam || matchInfo.away_team || matchInfo.away?.name || 'Away Team'
      const league = marketMatch?.league || matchInfo.league || matchInfo.league?.name || 'Unknown League'

      // Build matchData - use MarketMatch data if available (like global-match-sync)
      const matchDataForQuickPurchase = marketMatch ? {
        match_id: Number(match_id),
        home_team: marketMatch.homeTeam,
        away_team: marketMatch.awayTeam,
        league: marketMatch.league,
        league_id: marketMatch.leagueId,
        date: marketMatch.kickoffDate.toISOString(),
        home_team_logo: marketMatch.homeTeamLogo,
        away_team_logo: marketMatch.awayTeamLogo,
        consensus_odds: marketMatch.consensusOdds,
        v1_model: marketMatch.v1Model,
        v2_model: marketMatch.v2Model,
        source: 'marketmatch_table',
        sync_timestamp: new Date().toISOString()
      } : {
        ...matchInfo,
        match_id: Number(match_id),
        source: 'predict_api',
        sync_timestamp: new Date().toISOString()
      }

      // Extract confidence score from prediction data (handle both decimal 0-1 and percentage 0-100)
      let confidenceScore = 50 // Default
      const rawConfidence = predictionData.comprehensive_analysis?.ml_prediction?.confidence || 
                            predictionData.predictions?.confidence || 
                            predictionData.analysis?.confidence
      
      if (rawConfidence !== undefined && rawConfidence !== null) {
        // If it's a decimal (0-1 range), convert to percentage
        if (typeof rawConfidence === 'number' && rawConfidence <= 1 && rawConfidence >= 0) {
          confidenceScore = rawConfidence * 100
        } else if (typeof rawConfidence === 'number') {
          confidenceScore = rawConfidence
        } else if (typeof rawConfidence === 'string') {
          // Try to parse if it's a string
          const parsed = parseFloat(rawConfidence)
          if (!isNaN(parsed)) {
            confidenceScore = parsed <= 1 ? parsed * 100 : parsed
          }
        }
      }
      
      // Ensure it's a valid number
      confidenceScore = Math.max(0, Math.min(100, Math.round(Number(confidenceScore) || 50)))

      // Determine prediction type
      const probabilities = predictionData.comprehensive_analysis?.ml_prediction?.probs ||
                          predictionData.comprehensive_analysis?.ml_prediction ||
                          predictionData.predictions?.probs || 
                          predictionData.predictions ||
                          {}
      
      let predictionType = 'unknown'
      const homeWin = probabilities.home_win || probabilities.home || 0
      const draw = probabilities.draw || 0
      const awayWin = probabilities.away_win || probabilities.away || 0
      
      if (homeWin > draw && homeWin > awayWin) {
        predictionType = 'home'
      } else if (awayWin > draw && awayWin > homeWin) {
        predictionType = 'away'
      } else {
        predictionType = 'draw'
      }

      // Extract odds and value rating from prediction data
      const odds = predictionData.odds || predictionData.comprehensive_analysis?.odds
      const valueRating = predictionData.comprehensive_analysis?.value_rating || 
                         predictionData.value_rating || 
                         'Medium'
      const analysisSummary = predictionData.comprehensive_analysis?.ai_verdict?.recommended_outcome || 
                             predictionData.analysis?.summary || null

      // Update QuickPurchase with prediction data (it was created earlier if it didn't exist)
      // Only update marketMatchId if we have a MarketMatch and QuickPurchase doesn't already have it
      const updateData: any = {
        predictionData: predictionData as any,
        matchData: matchDataForQuickPurchase as any,
        predictionType,
        confidenceScore, // Already rounded and validated above
        odds: odds?.home || (marketMatch?.consensusOdds as any)?.home || null,
        valueRating,
        analysisSummary,
        isPredictionActive: true,
        updatedAt: new Date()
      }
      
      // Only set marketMatchId if we have one and QuickPurchase doesn't already have it
      if (marketMatch?.id && !quickPurchase.marketMatchId) {
        updateData.marketMatchId = marketMatch.id
      }

      const quickPurchaseResult = await prisma.quickPurchase.update({
        where: {
          id: quickPurchase.id
        },
        data: updateData
      })

      console.log(`[Predict API] ✅ Successfully updated QuickPurchase for match ${match_id}`, {
        quickPurchaseId: quickPurchaseResult.id,
        hasPredictionData: !!quickPurchaseResult.predictionData,
        marketMatchId: quickPurchaseResult.marketMatchId,
        linkedToMarketMatch: !!marketMatch,
        confidenceScore: quickPurchaseResult.confidenceScore
      })
    } catch (qpError) {
      // Log but don't fail the request if QuickPurchase creation fails
      console.error(`[Predict API] ❌ Error creating QuickPurchase for match ${match_id}:`, qpError)
      // Return error response so frontend knows it failed
      return NextResponse.json(
        { 
          error: 'Failed to save prediction data to database',
          details: qpError instanceof Error ? qpError.message : 'Unknown error',
          predictionData: predictionData // Still return the data in case frontend wants to handle it
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: predictionData,
      message: 'Prediction data fetched and saved successfully'
    });
  } catch (error) {
    console.error('[Predict API] ❌ Error getting prediction:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get prediction',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 