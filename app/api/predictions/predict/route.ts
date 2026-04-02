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
    });

    // Get default country for pricing (try multiple countries, same as global sync)
    let defaultCountry = await prisma.country.findFirst({
      where: { 
        code: { in: ['US', 'us', 'GB', 'gb', 'CA', 'ca'] },
        isActive: true 
      },
      select: { id: true, code: true, currencyCode: true, currencySymbol: true }
    })

    // Fallback to any active country if preferred countries not found
    if (!defaultCountry) {
      console.log('[Predict API] Preferred countries not found, using first available active country');
      defaultCountry = await prisma.country.findFirst({
        where: { isActive: true },
        select: { id: true, code: true, currencyCode: true, currencySymbol: true },
        orderBy: { code: 'asc' } // Get consistent fallback
      })
    }

    if (!defaultCountry) {
      console.error('[Predict API] ❌ No active countries found in database');
      return NextResponse.json(
        { 
          error: 'System configuration error', 
          details: 'No active countries found in database. Please ensure at least one country is active.',
          failurePoint: 'country_validation'
        },
        { status: 500 }
      )
    }

    console.log(`[Predict API] Using country for pricing: ${defaultCountry.code} (${defaultCountry.currencyCode})`);

    // Check if QuickPurchase exists
    let quickPurchase = await prisma.quickPurchase.findFirst({
      where: {
        matchId: matchIdStr,
      },
    });

    // Check if predictionData is valid (not null, not empty object, not JsonNull)
    let hasValidPredictionData = false
    if (quickPurchase && quickPurchase.predictionData) {
      try {
        const jsonStr = JSON.stringify(quickPurchase.predictionData)
        hasValidPredictionData = jsonStr !== '{}' && 
                                 jsonStr !== 'null' && 
                                 jsonStr !== '[]' &&
                                 jsonStr !== '""'
      } catch {
        hasValidPredictionData = false
      }
    }

    // If QuickPurchase exists with valid predictionData, return it instead of calling backend
    if (hasValidPredictionData && quickPurchase) {
      console.log(`[Predict API] Using existing predictionData from QuickPurchase for match ${match_id}`);

      // Compute premium score if not yet computed
      if (quickPurchase.premiumScore == null && marketMatch) {
        try {
          const { calculatePremiumScore } = await import('@/lib/predictions/premium-scorer')
          const toInput = (m: any) => {
            if (!m?.pick) return null
            const conf = typeof m.confidence === 'number' ? (m.confidence <= 1 ? m.confidence * 100 : m.confidence) : 50
            return { pick: m.pick, confidence: conf }
          }
          const premiumResult = calculatePremiumScore({
            v1: toInput(marketMatch.v1Model),
            v2: toInput(marketMatch.v2Model),
            v3: toInput((marketMatch as any).v3Model),
            hasBookmakerOdds: !!(marketMatch.allBookmakers && Object.keys(marketMatch.allBookmakers as object).length > 0),
            pick: quickPurchase.predictionType || 'home',
          })
          await prisma.quickPurchase.update({
            where: { id: quickPurchase.id },
            data: { premiumScore: premiumResult.score, premiumTier: premiumResult.tier, premiumSignals: premiumResult.signals as any },
          })
          console.log(`[Predict API] ⭐ Backfilled premium score for match ${match_id}: ${premiumResult.score} (${premiumResult.tier}, ${premiumResult.stars} stars)`)
        } catch (e) {
          console.warn(`[Predict API] ⚠️ Failed to backfill premium score:`, e instanceof Error ? e.message : e)
        }
      }

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
            // predictionData will be filled after API call - omit for now
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
        const errorMessage = createError instanceof Error ? createError.message : 'Unknown error';
        console.error(`[Predict API] ❌ Failed to create QuickPurchase for match ${match_id}:`, {
          error: errorMessage,
          matchId: match_id,
          matchIdStr,
          hasMarketMatch: !!marketMatch,
          marketMatchId: marketMatch?.id,
          failurePoint: 'quickpurchase_creation'
        });
        
        return NextResponse.json(
          { 
            error: 'Failed to create QuickPurchase entry',
            details: errorMessage,
            failurePoint: 'quickpurchase_creation',
            matchId: match_id,
            fix: 'Check database connection and QuickPurchase table schema. Ensure all required fields are provided.'
          },
          { status: 500 }
        )
      }
    }

    // Only call backend API if no QuickPurchase record exists or it has no valid predictionData
    console.log(`[Predict API] No valid predictionData found for match ${match_id}, calling backend API...`);
    console.log(`[Predict API] Backend URL: ${process.env.BACKEND_URL ? '✅ Set' : '❌ Missing'}`);
    console.log(`[Predict API] Match ID: ${match_id} (string: ${matchIdStr})`);
    
    // Validate environment variables with improved error messages
    if (!process.env.BACKEND_URL) {
      console.error('[Predict API] ❌ BACKEND_URL environment variable is not set');
      return NextResponse.json(
        { 
          error: 'Backend URL not configured', 
          details: 'BACKEND_URL environment variable is missing',
          failurePoint: 'environment_validation',
          fix: 'Set BACKEND_URL environment variable in your deployment configuration'
        },
        { status: 500 }
      );
    }
    
    if (!process.env.BACKEND_API_KEY) {
      console.error('[Predict API] ❌ BACKEND_API_KEY environment variable is not set');
      return NextResponse.json(
        { 
          error: 'Backend API key not configured', 
          details: 'BACKEND_API_KEY environment variable is missing',
          failurePoint: 'environment_validation',
          fix: 'Set BACKEND_API_KEY environment variable in your deployment configuration'
        },
        { status: 500 }
      );
    }
    
    // Call backend API with timeout protection (same as global sync)
    // Try /predict first (full cascade V3→V1→V0 + additional_markets + comprehensive_analysis)
    // Fall back to /predict-v3 if /predict fails (currently has str.replace() bug)
    const baseUrl = process.env.BACKEND_URL;
    const requestStartTime = Date.now();
    const requestBody = JSON.stringify({ match_id });
    const requestHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.BACKEND_API_KEY}`,
    };

    let response: Response;
    let usedEndpoint = '/predict';

    // Try /predict first (richer payload with additional markets)
    try {
      console.log(`[Predict API] Trying primary endpoint: ${baseUrl}/predict`);
      response = await fetch(`${baseUrl}/predict`, {
        method: 'POST',
        headers: requestHeaders,
        body: requestBody,
        signal: AbortSignal.timeout(35000)
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.warn(`[Predict API] /predict returned ${response.status}, falling back to /predict-v3. Error: ${errText.slice(0, 200)}`);
        throw new Error(`/predict failed: ${response.status}`);
      }
    } catch (primaryError) {
      // Fallback to /predict-v3 (lighter, but still returns core predictions)
      usedEndpoint = '/predict-v3';
      console.log(`[Predict API] Falling back to: ${baseUrl}/predict-v3`);
      try {
        response = await fetch(`${baseUrl}/predict-v3`, {
          method: 'POST',
          headers: requestHeaders,
          body: requestBody,
          signal: AbortSignal.timeout(30000)
        });
      } catch (fallbackError) {
        const requestTime = Date.now() - requestStartTime;
        const isTimeout = fallbackError instanceof Error &&
                         (fallbackError.name === 'AbortError' || fallbackError.message.includes('timeout'));

        console.error(`[Predict API] ❌ Both /predict and /predict-v3 failed for match ${match_id}:`, {
          primaryError: primaryError instanceof Error ? primaryError.message : String(primaryError),
          fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
          isTimeout,
          requestTime: `${requestTime}ms`,
        });

        return NextResponse.json(
          {
            error: isTimeout
              ? 'Backend API request timeout'
              : 'Backend API connection failed',
            details: fallbackError instanceof Error ? fallbackError.message : 'Unknown error',
            failurePoint: isTimeout ? 'backend_timeout' : 'backend_connection',
            requestTime: `${requestTime}ms`,
            fix: 'Both /predict and /predict-v3 endpoints failed. Check backend server status.'
          },
          { status: 500 }
        );
      }
    }

    const requestTime = Date.now() - requestStartTime;
    console.log(`[Predict API] Backend API response received via ${usedEndpoint} in ${requestTime}ms`, {
      status: response.status,
      statusText: response.statusText,
      endpoint: usedEndpoint
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Predict API] ❌ Backend API error for match ${match_id}:`, {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        requestTime: `${requestTime}ms`,
        failurePoint: 'backend_api_error'
      });
      
      return NextResponse.json(
        { 
          error: 'Backend API error',
          details: `Backend responded with status ${response.status}: ${errorText}`,
          failurePoint: 'backend_api_error',
          backendStatus: response.status,
          backendStatusText: response.statusText,
          requestTime: `${requestTime}ms`
        },
        { status: response.status >= 500 ? 502 : response.status } // Return backend status or 502 for 5xx
      );
    }

    const predictionData = await response.json();
    console.log(`[Predict API] Successfully fetched prediction data for match ${match_id}`, {
      hasData: !!predictionData,
      keys: predictionData ? Object.keys(predictionData) : [],
      endpoint: usedEndpoint,
    });

    // If we used /predict-v3 (lighter response), enrich with additional data
    if (usedEndpoint === '/predict-v3' && !predictionData.analysis) {
      try {
        // Fetch betting intelligence for CLV/edge data
        const biRes = await fetch(`${baseUrl}/betting-intelligence/${match_id}`, {
          headers: { 'Authorization': `Bearer ${process.env.BACKEND_API_KEY}` },
          signal: AbortSignal.timeout(10000),
        });
        const biData = biRes.ok ? await biRes.json() : null;

        const preds = predictionData.predictions || {};
        const homeWin = preds.home_win || 0;
        const draw = preds.draw || 0;
        const awayWin = preds.away_win || 0;
        const confidence = preds.confidence || 0;
        const recBet = preds.recommended_bet || '';
        const homeTeam = predictionData.match_info?.home_team || marketMatch?.homeTeam || 'Home';
        const awayTeam = predictionData.match_info?.away_team || marketMatch?.awayTeam || 'Away';
        const league = predictionData.match_info?.league || marketMatch?.league || '';
        const bi = biData?.betting_intelligence || {};
        const bestBet = bi?.best_bet || {};

        // Generate synthetic analysis from V3 predictions + market data
        const pickSide = homeWin > awayWin ? 'home' : 'away';
        const pickTeam = pickSide === 'home' ? homeTeam : awayTeam;
        const oppTeam = pickSide === 'home' ? awayTeam : homeTeam;
        const confPct = Math.round(confidence * 100);
        const edge = bestBet?.edge ? `${Math.round(bestBet.edge * 100)}%` : null;

        predictionData.analysis = {
          ai_summary: `Our V3 Sharp model gives ${pickTeam} a ${confPct}% win probability against ${oppTeam} in ${league}.${edge ? ` The model sees a ${edge} edge vs the market.` : ''} ${recBet || ''}`.trim(),
          explanation: `This prediction is based on ${predictionData.model_info?.features_used || 'multiple'} features including odds consensus, league statistics, and match context.`,
          team_analysis: {
            home_team: {
              name: homeTeam,
              win_probability: `${Math.round(homeWin * 100)}%`,
              assessment: homeWin > 0.5 ? 'Favored based on model analysis' : 'The model suggests they face a challenge in this fixture',
            },
            away_team: {
              name: awayTeam,
              win_probability: `${Math.round(awayWin * 100)}%`,
              assessment: awayWin > 0.5 ? 'Favored based on model analysis' : 'The model suggests they face a challenge in this fixture',
            },
          },
          prediction_analysis: {
            model_assessment: `V3 Sharp LightGBM ensemble with ${confPct}% confidence`,
            value_assessment: bestBet?.recommendation || (confidence > 0.55 ? 'Model sees value in this pick' : 'Moderate confidence — proceed with caution'),
            confidence_factors: [
              `Model confidence: ${confPct}%`,
              `Win probability: ${pickTeam} ${Math.round(Math.max(homeWin, awayWin) * 100)}%`,
              `Draw probability: ${Math.round(draw * 100)}%`,
              ...(edge ? [`Edge vs market: ${edge}`] : []),
            ],
            risk_factors: [
              confidence < 0.5 ? 'Low model confidence suggests high uncertainty' : null,
              draw > 0.25 ? `Draw probability is ${Math.round(draw * 100)}% — consider draw no bet` : null,
              Math.abs(homeWin - awayWin) < 0.1 ? 'Very close probabilities — this could go either way' : null,
            ].filter(Boolean),
          },
          betting_recommendations: {
            primary_bet: bestBet?.pick || recBet || `${pickTeam} to win`,
            risk_level: confidence >= 0.6 ? 'Low-Medium' : confidence >= 0.5 ? 'Medium' : 'Medium-High',
            suggested_stake: confidence >= 0.6 ? 'Moderate (2-3% bankroll)' : 'Conservative (1-2% bankroll)',
            alternative_bets: [
              draw > 0.25 ? `Draw No Bet: ${pickTeam}` : null,
              `Double Chance: ${pickSide === 'home' ? '1X' : 'X2'}`,
            ].filter(Boolean),
          },
          risk_assessment: confidence >= 0.6 ? 'LOW' : confidence >= 0.5 ? 'MEDIUM' : 'HIGH',
        };

        // Add betting intelligence if available
        if (biData) {
          predictionData.betting_intelligence = bi;
        }

        console.log(`[Predict API] Enriched V3 response with synthetic analysis + betting intelligence`);
      } catch (enrichError) {
        console.warn(`[Predict API] Enrichment failed (non-critical):`, enrichError instanceof Error ? enrichError.message : enrichError);
      }
    }

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

      // Extract and store V3 model data on MarketMatch for reports tracking
      if (marketMatch?.id) {
        try {
          const models = predictionData.predictions?.models || []
          const finalDecision = predictionData.predictions?.final_decision || {}

          // Find V3 model in the models array
          const v3Model = models.find((m: any) =>
            m.id === 'v3_sharp' || m.id === 'v3_sharp_lgbm' || m.id?.startsWith('v3')
          )

          // Build v3Model data from either explicit model entry or top-level predictions
          const v3Data = v3Model ? {
            pick: predictionType,
            confidence: v3Model.confidence ?? confidenceScore / 100,
            probs: v3Model.predictions || {
              home: predictionData.predictions?.home_win,
              draw: predictionData.predictions?.draw,
              away: predictionData.predictions?.away_win,
            },
            source: v3Model.id || 'v3_sharp',
            conviction_tier: finalDecision.conviction_tier || null,
            models_in_agreement: finalDecision.models_in_agreement ?? null,
            selected_model: finalDecision.selected_model || null,
          } : (predictionData.predictions?.home_win != null) ? {
            // Fallback: use top-level predictions (from /predict-v3 endpoint)
            pick: predictionType,
            confidence: confidenceScore / 100,
            probs: {
              home: predictionData.predictions.home_win,
              draw: predictionData.predictions.draw ?? 0,
              away: predictionData.predictions.away_win,
            },
            source: predictionData.model_info?.type || 'v3_sharp',
            conviction_tier: finalDecision.conviction_tier || predictionData.predictions?.conviction_tier || null,
          } : null

          if (v3Data) {
            await prisma.marketMatch.update({
              where: { id: marketMatch.id },
              data: { v3Model: v3Data as any },
            })
            console.log(`[Predict API] ✅ Stored V3 model data on MarketMatch for match ${match_id}`, {
              pick: v3Data.pick,
              confidence: v3Data.confidence,
              source: v3Data.source,
            })
          }
        } catch (v3Error) {
          // Non-critical — don't fail the request
          console.warn(`[Predict API] ⚠️ Failed to store V3 model on MarketMatch for match ${match_id}:`,
            v3Error instanceof Error ? v3Error.message : v3Error
          )
        }
      }

      // ── Compute premium quality score ──
      try {
        const { calculatePremiumScore } = await import('@/lib/predictions/premium-scorer')

        // Build model inputs from MarketMatch + freshly stored V3
        const v1M = marketMatch?.v1Model as { pick?: string; confidence?: number } | null
        const v2M = marketMatch?.v2Model as { pick?: string; confidence?: number } | null
        // Use the V3 data we just extracted above, or from MarketMatch
        const v3M = (marketMatch as any)?.v3Model as { pick?: string; confidence?: number } | null

        const toModelInput = (m: { pick?: string; confidence?: number } | null) => {
          if (!m?.pick) return null
          const conf = typeof m.confidence === 'number'
            ? (m.confidence <= 1 ? m.confidence * 100 : m.confidence)
            : 50
          return { pick: m.pick, confidence: conf }
        }

        // Also try extracting from the fresh prediction response
        const predModels = predictionData.predictions?.models || []
        const v3FromPred = predModels.find((m: any) => m.id?.includes('v3'))
        const v1FromPred = predModels.find((m: any) => m.id?.includes('v1'))

        const premiumInput = {
          v1: toModelInput(v1M) || (v1FromPred ? { pick: predictionType, confidence: v1FromPred.confidence <= 1 ? v1FromPred.confidence * 100 : v1FromPred.confidence } : null),
          v2: toModelInput(v2M),
          v3: toModelInput(v3M) || (v3FromPred ? { pick: predictionType, confidence: v3FromPred.confidence <= 1 ? v3FromPred.confidence * 100 : v3FromPred.confidence } : null)
            || (predictionData.predictions?.home_win != null ? { pick: predictionType, confidence: confidenceScore } : null),
          hasBookmakerOdds: !!(marketMatch?.allBookmakers && Object.keys(marketMatch.allBookmakers as object).length > 0)
            || !!(marketMatch?.booksCount && marketMatch.booksCount > 0),
          pick: predictionType,
        }

        const premiumResult = calculatePremiumScore(premiumInput)

        await prisma.quickPurchase.update({
          where: { id: quickPurchase.id },
          data: {
            premiumScore: premiumResult.score,
            premiumTier: premiumResult.tier,
            premiumSignals: premiumResult.signals as any,
          },
        })

        console.log(`[Predict API] ⭐ Premium score for match ${match_id}: ${premiumResult.score} (${premiumResult.tier}, ${premiumResult.stars} stars)`, {
          signals: premiumResult.signals,
          modelsAgreeing: premiumResult.modelsAgreeing,
          totalModels: premiumResult.totalModels,
        })
      } catch (premiumError) {
        // Non-critical
        console.warn(`[Predict API] ⚠️ Failed to compute premium score for match ${match_id}:`,
          premiumError instanceof Error ? premiumError.message : premiumError
        )
      }
    } catch (qpError) {
      const errorMessage = qpError instanceof Error ? qpError.message : 'Unknown error';
      console.error(`[Predict API] ❌ Error updating QuickPurchase for match ${match_id}:`, {
        error: errorMessage,
        matchId: match_id,
        matchIdStr,
        quickPurchaseId: quickPurchase?.id,
        hasPredictionData: !!predictionData,
        failurePoint: 'quickpurchase_update'
      });
      
      // Return error response so frontend knows it failed
      // Still include predictionData in case frontend wants to handle it
      return NextResponse.json(
        { 
          error: 'Failed to save prediction data to database',
          details: errorMessage,
          failurePoint: 'quickpurchase_update',
          matchId: match_id,
          quickPurchaseId: quickPurchase?.id,
          predictionData: predictionData, // Still return the data in case frontend wants to handle it
          fix: 'Check database connection and QuickPurchase table. Prediction data was fetched but could not be saved.'
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('[Predict API] ❌ Unexpected error getting prediction:', {
      error: errorMessage,
      stack: errorStack,
      failurePoint: 'unexpected_error'
    });
    
    return NextResponse.json(
      { 
        error: 'Failed to get prediction',
        details: errorMessage,
        failurePoint: 'unexpected_error',
        fix: 'Check server logs for detailed error information. This is an unexpected error that occurred during request processing.'
      },
      { status: 500 }
    );
  }
} 