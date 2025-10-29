import { NextResponse } from "next/server"

// GET /api/test-rapidapi - Test direct RapidAPI call
export async function GET(request: Request) {
  try {
    const apiKey = process.env.RAPIDAPI_KEY
    
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: "RAPIDAPI_KEY not found in environment variables"
      }, { status: 400 })
    }

    console.log(`[Test] Making direct RapidAPI call with key: ${apiKey.substring(0, 8)}...`)

    const response = await fetch('https://api-football-v1.p.rapidapi.com/v3/teams?search=Arsenal', {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
      }
    })

    console.log(`[Test] RapidAPI response status: ${response.status}`)

    if (!response.ok) {
      const text = await response.text()
      console.error(`[Test] RapidAPI error: ${text}`)
      return NextResponse.json({
        success: false,
        error: `RapidAPI error ${response.status}`,
        details: text
      }, { status: response.status })
    }

    const data = await response.json()
    console.log(`[Test] RapidAPI response:`, JSON.stringify(data, null, 2))

    return NextResponse.json({
      success: true,
      data: data,
      message: 'Direct RapidAPI call successful'
    })

  } catch (error) {
    console.error('[Test] Error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to test RapidAPI", 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
