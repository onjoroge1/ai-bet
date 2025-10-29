import { logger } from '@/lib/logger'

export interface TeamLogoData {
  teamId: number
  teamName: string
  logoUrl: string
  league?: string
}

export class TeamLogoService {
  private rapidApiKey: string
  private logoCache: Map<string, TeamLogoData> = new Map()
  private cacheExpiry: Map<string, number> = new Map()
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

  constructor() {
    this.rapidApiKey = process.env.RAPIDAPI_KEY || ''
  }

  /**
   * Get team logo by team ID
   */
  async getTeamLogo(teamId: number, teamName?: string): Promise<string | null> {
    const cacheKey = `team_${teamId}`
    
    // Check cache first
    if (this.isCacheValid(cacheKey)) {
      const cached = this.logoCache.get(cacheKey)
      if (cached) {
        return cached.logoUrl
      }
    }

    try {
      const logoData = await this.fetchTeamLogoFromAPI(teamId, teamName)
      if (logoData) {
        this.logoCache.set(cacheKey, logoData)
        this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_DURATION)
        return logoData.logoUrl
      }
    } catch (error) {
      logger.warn('Failed to fetch team logo', {
        tags: ['team-logo-service', 'api-error'],
        data: { teamId, teamName, error: error instanceof Error ? error.message : 'Unknown error' }
      })
    }

    return null
  }

  /**
   * Get team logo by team name (searches for team first)
   */
  async getTeamLogoByName(teamName: string, league?: string): Promise<string | null> {
    const cacheKey = `team_name_${teamName.toLowerCase()}_${league || 'any'}`
    
    // Check cache first
    if (this.isCacheValid(cacheKey)) {
      const cached = this.logoCache.get(cacheKey)
      if (cached) {
        return cached.logoUrl
      }
    }

    try {
      const teamId = await this.findTeamIdByName(teamName, league)
      if (teamId) {
        return await this.getTeamLogo(teamId, teamName)
      }
    } catch (error) {
      logger.warn('Failed to find team by name', {
        tags: ['team-logo-service', 'search-error'],
        data: { teamName, league, error: error instanceof Error ? error.message : 'Unknown error' }
      })
    }

    return null
  }

  /**
   * Fetch team logo from RapidAPI
   */
  private async fetchTeamLogoFromAPI(teamId: number, teamName?: string): Promise<TeamLogoData | null> {
    if (!this.rapidApiKey) {
      logger.warn('RapidAPI key not configured for team logos')
      return null
    }

    try {
      const response = await fetch(`https://api-football-v1.p.rapidapi.com/v3/teams?id=${teamId}`, {
        headers: {
          'X-RapidAPI-Key': this.rapidApiKey,
          'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
        }
      })

      if (!response.ok) {
        throw new Error(`RapidAPI team request failed: ${response.status}`)
      }

      const data = await response.json() as any
      
      if (data.response && data.response.length > 0) {
        const team = data.response[0]
        return {
          teamId: team.team.id,
          teamName: team.team.name,
          logoUrl: team.team.logo,
          league: team.team.country
        }
      }

      return null
    } catch (error) {
      logger.error('Error fetching team logo from API', {
        tags: ['team-logo-service', 'api-error'],
        data: { teamId, teamName, error: error instanceof Error ? error.message : 'Unknown error' }
      })
      return null
    }
  }

  /**
   * Find team ID by name
   */
  private async findTeamIdByName(teamName: string, league?: string): Promise<number | null> {
    if (!this.rapidApiKey) {
      return null
    }

    try {
      let url = `https://api-football-v1.p.rapidapi.com/v3/teams?search=${encodeURIComponent(teamName)}`
      if (league) {
        url += `&league=${league}`
      }

      const response = await fetch(url, {
        headers: {
          'X-RapidAPI-Key': this.rapidApiKey,
          'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
        }
      })

      if (!response.ok) {
        throw new Error(`RapidAPI team search request failed: ${response.status}`)
      }

      const data = await response.json() as any
      
      if (data.response && data.response.length > 0) {
        // Find the best match
        const teams = data.response
        const exactMatch = teams.find((team: any) => 
          team.team.name.toLowerCase() === teamName.toLowerCase()
        )
        
        if (exactMatch) {
          return exactMatch.team.id
        }

        // Return the first result if no exact match
        return teams[0].team.id
      }

      return null
    } catch (error) {
      logger.error('Error searching for team by name', {
        tags: ['team-logo-service', 'search-error'],
        data: { teamName, league, error: error instanceof Error ? error.message : 'Unknown error' }
      })
      return null
    }
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(cacheKey: string): boolean {
    const expiry = this.cacheExpiry.get(cacheKey)
    return expiry ? Date.now() < expiry : false
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.logoCache.clear()
    this.cacheExpiry.clear()
  }

  /**
   * Get cached team data
   */
  getCachedTeamData(teamId: number): TeamLogoData | null {
    return this.logoCache.get(`team_${teamId}`) || null
  }
}

// Singleton instance
export const teamLogoService = new TeamLogoService()

