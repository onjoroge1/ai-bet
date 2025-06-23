import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('league_id') || '39';
    const limit = searchParams.get('limit') || '10';
    const excludeFinished = searchParams.get('exclude_finished') || 'true';
    const fromDate = searchParams.get('from_date');
    const toDate = searchParams.get('to_date');

    // Build query parameters for upcoming matches
    const queryParams = new URLSearchParams({
      league_id: leagueId,
      limit: limit,
      exclude_finished: excludeFinished,
    });

    if (fromDate) queryParams.append('from_date', fromDate);
    if (toDate) queryParams.append('to_date', toDate);

    // First, get upcoming matches
    const matchesResponse = await fetch(
      `${process.env.BACKEND_URL}/matches/upcoming?${queryParams.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.BACKEND_API_KEY}`,
        },
      }
    );

    if (!matchesResponse.ok) {
      throw new Error(`Failed to fetch matches: ${matchesResponse.status}`);
    }

    const matchesData = await matchesResponse.json();

    // Then, get predictions for each match
    const matchesWithPredictions = await Promise.all(
      matchesData.map(async (match: any) => {
        try {
          const predictionResponse = await fetch(
            `${process.env.BACKEND_URL}/predict`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.BACKEND_API_KEY}`,
              },
              body: JSON.stringify({ match_id: match.match_id }),
            }
          );

          if (!predictionResponse.ok) {
            console.error(`Failed to get prediction for match ${match.match_id}`);
            return {
              ...match,
              prediction: null,
              prediction_error: 'Failed to fetch prediction'
            };
          }

          const predictionData = await predictionResponse.json();
          return {
            ...match,
            prediction: predictionData
          };
        } catch (error) {
          console.error(`Error getting prediction for match ${match.match_id}:`, error);
          return {
            ...match,
            prediction: null,
            prediction_error: 'Error fetching prediction'
          };
        }
      })
    );

    return NextResponse.json({
      matches: matchesWithPredictions,
      filters: {
        league_id: leagueId,
        limit: parseInt(limit),
        exclude_finished: excludeFinished === 'true',
        from_date: fromDate,
        to_date: toDate
      }
    });
  } catch (error) {
    console.error('Error in upcoming-with-predictions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch matches with predictions' },
      { status: 500 }
    );
  }
} 