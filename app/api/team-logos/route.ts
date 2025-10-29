import { NextResponse } from "next/server"

// GET /api/team-logos - Fetch logos for multiple teams
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const teams = searchParams.get('teams') // Comma-separated team names

    if (!teams) {
      return NextResponse.json(
        { error: "Teams parameter is required (comma-separated)" },
        { status: 400 }
      )
    }

    const teamNames = teams.split(',').map(name => name.trim()).filter(name => name.length > 0)
    
    if (teamNames.length === 0) {
      return NextResponse.json(
        { error: "At least one team name is required" },
        { status: 400 }
      )
    }

    console.log(`Fetching logos for teams: ${teamNames.join(', ')}`)

    // Call our backend /teams endpoint for each team in parallel
    const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:8000'
    const apiKey = process.env.BACKEND_API_KEY || 'betgenius_secure_key_2024'

    const teamLogos = await Promise.all(
      teamNames.map(async (teamName) => {
        try {
          const searchParam = encodeURIComponent(teamName)
          const response = await fetch(`${backendUrl}/teams?search=${searchParam}&has_logo=true&limit=1`, {
            headers: {
              'Authorization': `Bearer ${apiKey}`
            }
          })

          if (response.ok) {
            const data = await response.json()
            
            if (data.status === 'success' && data.teams && data.teams.length > 0) {
              const team = data.teams[0]
              return {
                teamName,
                id: team.team_id,
                name: team.name,
                country: team.country,
                logo: team.logo_url,
                success: true
              }
            } else {
              return {
                teamName,
                success: false,
                error: "Team not found"
              }
            }
          } else {
            return {
              teamName,
              success: false,
              error: "Backend API error"
            }
          }
        } catch (error) {
          console.error(`Error fetching logo for ${teamName}:`, error)
          return {
            teamName,
            success: false,
            error: "Failed to fetch team logo"
          }
        }
      })
    )

    return NextResponse.json({
      teams: teamLogos,
      success: true
    })

  } catch (error) {
    console.error('Error fetching team logos:', error)
    return NextResponse.json(
      { 
        error: "Failed to fetch team logos", 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
