import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('league_id') || '39';
    const limit = searchParams.get('limit') || '10';
    const excludeFinished = searchParams.get('exclude_finished') || 'true';
    const fromDate = searchParams.get('from_date');
    const toDate = searchParams.get('to_date');

    // Build query parameters
    const queryParams = new URLSearchParams({
      league_id: leagueId,
      limit: limit,
      exclude_finished: excludeFinished,
    });

    // Add optional date filters if provided
    if (fromDate) queryParams.append('from_date', fromDate);
    if (toDate) queryParams.append('to_date', toDate);

    const response = await fetch(
      `${process.env.BACKEND_URL}/matches/upcoming?${queryParams.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.BACKEND_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`);
    }

    const data = await response.json();
    
    // Return the enhanced response format directly
    return NextResponse.json({
      matches: data,
      filters: {
        league_id: leagueId,
        limit: parseInt(limit),
        exclude_finished: excludeFinished === 'true',
        from_date: fromDate,
        to_date: toDate
      }
    });
  } catch (error) {
    console.error('Error fetching upcoming matches:', error);
    return NextResponse.json(
      { error: 'Failed to fetch upcoming matches' },
      { status: 500 }
    );
  }
} 