import { NextResponse } from "next/server"

// GET /api/team-logo - Fetch team logo from our backend API
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const teamName = searchParams.get('team')

    if (!teamName) {
      return NextResponse.json(
        { error: "Team name is required" },
        { status: 400 }
      )
    }

    console.log(`Fetching logo for team: ${teamName}`)

    // Call our backend /teams endpoint
    const backendUrl = process.env.BACKEND_API_URL || process.env.BACKEND_URL
    if (!backendUrl) {
      return NextResponse.json(
        { error: "Backend API URL not configured. Please set BACKEND_API_URL or BACKEND_URL environment variable." },
        { status: 500 }
      )
    }
    const searchParam = encodeURIComponent(teamName)
    const apiKey = process.env.BACKEND_API_KEY || process.env.NEXT_PUBLIC_MARKET_KEY || 'betgenius_secure_key_2024'
    
    const response = await fetch(`${backendUrl}/teams?search=${searchParam}&has_logo=true&limit=10`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    })

    if (!response.ok) {
      console.error(`Backend API error: ${response.status}`)
      return NextResponse.json(
        { error: "Failed to fetch team data from backend" },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    if (data.status === 'success' && data.teams && data.teams.length > 0) {
      const team = data.teams[0]
      console.log(`Found team: ${team.name} with logo: ${team.logo_url}`)
      
      return NextResponse.json({
        id: team.team_id,
        name: team.name,
        country: team.country,
        logo: team.logo_url,
        success: true
      })
    } else {
      console.log(`No team found for ${teamName}`)
      return NextResponse.json(
        { error: "Team not found" },
        { status: 404 }
      )
    }

  } catch (error) {
    console.error('Error fetching team logo:', error)
    return NextResponse.json(
      { 
        error: "Failed to fetch team logo", 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}



