import { NextResponse } from 'next/server';

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

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error getting prediction:', error);
    return NextResponse.json(
      { error: 'Failed to get prediction' },
      { status: 500 }
    );
  }
} 