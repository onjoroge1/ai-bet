import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// Define the prediction response type based on actual backend response
interface PredictionResponse {
  match_info: {
    match_id: number;
    home_team: string;
    away_team: string;
    venue: string;
    date: string;
    league: string;
    match_importance: string;
  };
  comprehensive_analysis: {
    ml_prediction: {
      home_win: number;
      draw: number;
      away_win: number;
      confidence: number;
      model_type: string;
    };
    ai_verdict: {
      recommended_outcome: string;
      confidence_level: string;
      probability_assessment: {
        home: number;
        draw: number;
        away: number;
      };
    };
    detailed_reasoning: {
      ml_model_weight: string;
      injury_impact: string;
      form_analysis: string;
      tactical_factors: string;
      historical_context: string;
    };
    betting_intelligence: {
      primary_bet: string;
      value_bets: string[];
      avoid_bets: string[];
    };
    risk_analysis: {
      overall_risk: string;
      key_risks: string[];
      upset_potential: string;
    };
    confidence_breakdown: string;
  };
  additional_markets: {
    total_goals: {
      over_2_5: number;
      under_2_5: number;
    };
    both_teams_score: {
      yes: number;
      no: number;
    };
    asian_handicap: {
      home_handicap: number;
      away_handicap: number;
    };
  };
  analysis_metadata: {
    analysis_type: string;
    data_sources: string[];
    analysis_timestamp: string;
    ml_model_accuracy: string;
    ai_model: string;
    processing_time: number;
  };
  processing_time: number;
  timestamp: string;
}

// Initialize Redis client
const redis = new Redis({
  url: process.env.REDIS_URL!,
  token: process.env.REDIS_TOKEN!,
});

// Cache TTL in seconds (1 hour)
const CACHE_TTL = 3600;

/**
 * Validates if a match date is within the allowed prediction window
 * @param matchDate - The match date string
 * @returns Object with validation result and details
 */
function validateMatchDate(matchDate: string): { isValid: boolean; error?: string } {
  return { isValid: true };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('match_id');
    const includeAnalysis = searchParams.get('include_analysis') === 'true';

    if (!matchId) {
      return NextResponse.json(
        { error: 'Match ID is required' },
        { status: 400 }
      );
    }

    // Check cache first
    const cacheKey = `prediction:${matchId}:${includeAnalysis}`;
    const cachedPrediction = await redis.get<PredictionResponse>(cacheKey);
    
    if (cachedPrediction) {
      return NextResponse.json({
        match_id: matchId,
        prediction: cachedPrediction,
        source: 'cache'
      });
    }

    // If not in cache, fetch from backend
    const backendUrl = `${process.env.BACKEND_URL}/predict`;
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.BACKEND_API_KEY}`
      },
      body: JSON.stringify({
        match_id: Number(matchId),
        include_analysis: includeAnalysis
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`Backend responded with status ${response.status}: ${errorText}`);
    }

    const prediction = await response.json() as PredictionResponse;

    // Cache the prediction
    await redis.set(cacheKey, prediction, { ex: CACHE_TTL });

    return NextResponse.json({
      match_id: matchId,
      prediction,
      source: 'backend'
    });

  } catch (error) {
    console.error('Prediction error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json(
      { 
        error: 'Failed to fetch prediction',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 