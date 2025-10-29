/**
 * API-Football Service
 * Fetches real team logos and data from API-Football
 */

export interface TeamData {
  id: number
  name: string
  logo: string
  country?: string
  league?: string
}

export interface LeagueData {
  id: number
  name: string
  logo: string
  country: string
}

export class ApiFootballService {
  private static readonly BASE_URL = 'https://api-football-v1.p.rapidapi.com/v3'
  private static readonly API_KEY = process.env.RAPIDAPI_KEY || process.env.NEXT_PUBLIC_RAPIDAPI_KEY || process.env.NEXT_PUBLIC_API_FOOTBALL_KEY || process.env.API_FOOTBALL_KEY
  private static readonly CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours
  private static teamCache: Map<string, TeamData> = new Map()
  private static leagueCache: Map<string, LeagueData> = new Map()
  private static cacheExpiry: Map<string, number> = new Map()

  /**
   * Get team logo by team name
   */
  static async getTeamLogo(teamName: string, league?: string): Promise<string | null> {
    if (!this.API_KEY) {
      console.warn('API-Football key not configured')
      return null
    }

    const cacheKey = `team_${teamName.toLowerCase()}_${league || 'any'}`
    
    // Check cache first
    if (this.isCacheValid(cacheKey)) {
      const cached = this.teamCache.get(cacheKey)
      if (cached) {
        return cached.logo
      }
    }

    try {
      // Search for team by name
      const team = await this.searchTeam(teamName, league)
      if (team) {
        // Cache the result
        this.teamCache.set(cacheKey, team)
        this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_DURATION)
        return team.logo
      }
    } catch (error) {
      console.warn('Failed to fetch team logo from API-Football:', error)
    }

    return null
  }

  /**
   * Search for teams by name (returns array)
   */
  static async searchTeams(teamName: string, league?: string): Promise<TeamData[]> {
    console.log(`[API-Football] Searching for team: ${teamName}`)
    console.log(`[API-Football] API Key available: ${!!this.API_KEY}`)
    console.log(`[API-Football] Base URL: ${this.BASE_URL}`)
    
    if (!this.API_KEY) {
      console.error('[API-Football] No API key found!')
      throw new Error('API-Football key not configured')
    }

    const searchParams = new URLSearchParams({
      search: teamName,
      ...(league && { league: league })
      // Note: season parameter cannot be used with search parameter in RapidAPI
    })

    const url = `${this.BASE_URL}/teams?${searchParams}`
    console.log(`[API-Football] Request URL: ${url}`)

    const response = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': this.API_KEY!,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
      },
      next: { revalidate: 60 * 60 * 24 } // Cache for 24 hours
    })

    console.log(`[API-Football] Response status: ${response.status}`)

    if (!response.ok) {
      const text = await response.text()
      console.error(`[API-Football] Error response: ${text}`)
      throw new Error(`API-Football RapidAPI error ${response.status}: ${text}`)
    }

    const data = await response.json() as { results: number; response: Array<{ team: TeamData }> }
    
    console.log(`[API-Football] Response data:`, JSON.stringify(data, null, 2))
    
    if (data.results > 0 && data.response && data.response.length > 0) {
      const teams = data.response
        .filter((r: any) => r?.team?.logo)
        .map((r: any) => ({
          id: r.team.id,
          name: r.team.name,
          logo: r.team.logo,
          country: r.team.country,
          league: r.team.league
        }))
      
      console.log(`[API-Football] Found ${teams.length} teams with logos`)
      return teams
    }

    console.log(`[API-Football] No teams found`)
    return []
  }

  /**
   * Search for a team by name (returns single team)
   */
  private static async searchTeam(teamName: string, league?: string): Promise<TeamData | null> {
    const searchParams = new URLSearchParams({
      search: teamName,
      ...(league && { league: league })
      // Note: season parameter cannot be used with search parameter in RapidAPI
    })

    const response = await fetch(`${this.BASE_URL}/teams?${searchParams}`, {
      headers: {
        'X-RapidAPI-Key': this.API_KEY!,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
      },
      next: { revalidate: 60 * 60 * 24 } // Cache for 24 hours
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`API-Football RapidAPI error ${response.status}: ${text}`)
    }

    const data = await response.json() as { results: number; response: Array<{ team: TeamData }> }
    
    if (data.results > 0 && data.response && data.response.length > 0) {
      const team = data.response[0].team
      return {
        id: team.id,
        name: team.name,
        logo: team.logo,
        country: team.country,
        league: league
      }
    }

    return null
  }

  /**
   * Get league logo by league name
   */
  static async getLeagueLogo(leagueName: string): Promise<string | null> {
    if (!this.API_KEY) {
      console.warn('API-Football key not configured')
      return null
    }

    const cacheKey = `league_${leagueName.toLowerCase()}`
    
    // Check cache first
    if (this.isCacheValid(cacheKey)) {
      const cached = this.leagueCache.get(cacheKey)
      if (cached) {
        return cached.logo
      }
    }

    try {
      const response = await fetch(`${this.BASE_URL}/leagues?search=${encodeURIComponent(leagueName)}`, {
        headers: {
          'X-RapidAPI-Key': this.API_KEY!,
          'X-RapidAPI-Host': 'v3.football.api-sports.io'
        }
      })

      if (!response.ok) {
        throw new Error(`API-Football request failed: ${response.status}`)
      }

      const data = await response.json() as { results: number; response: Array<{ league: LeagueData }> }
      
      if (data.results > 0 && data.response && data.response.length > 0) {
        const league = data.response[0].league
        const leagueData: LeagueData = {
          id: league.id,
          name: league.name,
          logo: league.logo,
          country: league.country
        }
        
        // Cache the result
        this.leagueCache.set(cacheKey, leagueData)
        this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_DURATION)
        return leagueData.logo
      }
    } catch (error) {
      console.warn('Failed to fetch league logo from API-Football:', error)
    }

    return null
  }

  /**
   * Check if cache is still valid
   */
  private static isCacheValid(cacheKey: string): boolean {
    const expiry = this.cacheExpiry.get(cacheKey)
    return expiry ? Date.now() < expiry : false
  }

  /**
   * Clear cache
   */
  static clearCache(): void {
    this.teamCache.clear()
    this.leagueCache.clear()
    this.cacheExpiry.clear()
  }

  /**
   * Get cached team data
   */
  static getCachedTeam(teamName: string, league?: string): TeamData | null {
    const cacheKey = `team_${teamName.toLowerCase()}_${league || 'any'}`
    return this.teamCache.get(cacheKey) || null
  }
}

// Singleton instance
export const apiFootballService = ApiFootballService



