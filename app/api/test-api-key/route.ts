import { NextResponse } from "next/server"

// GET /api/test-api-key - Test if RAPIDAPI_KEY is configured
export async function GET(request: Request) {
  try {
    const apiKey = process.env.RAPIDAPI_KEY
    const nextPublicKey = process.env.NEXT_PUBLIC_RAPIDAPI_KEY
    const apiFootballKey = process.env.API_FOOTBALL_KEY
    const nextPublicApiFootballKey = process.env.NEXT_PUBLIC_API_FOOTBALL_KEY

    return NextResponse.json({
      success: true,
      environment: {
        RAPIDAPI_KEY: apiKey ? `${apiKey.substring(0, 8)}...` : 'NOT SET',
        NEXT_PUBLIC_RAPIDAPI_KEY: nextPublicKey ? `${nextPublicKey.substring(0, 8)}...` : 'NOT SET',
        API_FOOTBALL_KEY: apiFootballKey ? `${apiFootballKey.substring(0, 8)}...` : 'NOT SET',
        NEXT_PUBLIC_API_FOOTBALL_KEY: nextPublicApiFootballKey ? `${nextPublicApiFootballKey.substring(0, 8)}...` : 'NOT SET',
      },
      message: 'Environment variables check'
    })

  } catch (error) {
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to check environment variables", 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
