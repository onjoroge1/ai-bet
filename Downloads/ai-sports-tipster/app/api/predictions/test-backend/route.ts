import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Ensure BACKEND_URL is properly set
    if (!process.env.BACKEND_URL) {
      throw new Error('BACKEND_URL environment variable is not set');
    }

    // Log environment variables
    console.log('Environment check:', {
      hasBackendUrl: !!process.env.BACKEND_URL,
      hasApiKey: !!process.env.BACKEND_API_KEY,
      backendUrl: process.env.BACKEND_URL
    });

    // Test the backend connection
    const testResponse = await fetch(`${process.env.BACKEND_URL}/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.BACKEND_API_KEY}`,
      },
      body: JSON.stringify({ 
        match_id: 1351171,
        include_analysis: true 
      }),
    });

    const responseText = await testResponse.text();
    console.log('Backend test response:', {
      status: testResponse.status,
      statusText: testResponse.statusText,
      headers: Object.fromEntries(testResponse.headers.entries()),
      body: responseText
    });

    return NextResponse.json({
      status: testResponse.status,
      statusText: testResponse.statusText,
      headers: Object.fromEntries(testResponse.headers.entries()),
      body: responseText
    });
  } catch (error) {
    console.error('Test endpoint error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      backendUrl: process.env.BACKEND_URL
    });

    return NextResponse.json(
      { 
        error: 'Failed to test backend connection',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 