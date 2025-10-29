/**
 * API-Football Client Service
 * Client-side service for fetching team logos from API-Football
 * This version works in the browser and makes API calls to our backend
 */

export interface TeamData {
  id: number
  name: string
  logo: string
  country?: string
  league?: string
}

export class ApiFootballClientService {
  private static readonly CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours
  private static teamCache: Map<string, TeamData> = new Map()
  private static cacheExpiry: Map<string, number> = new Map()

  /**
   * Get team logo by team name
   */
  static async getTeamLogo(teamName: string, league?: string): Promise<string | null> {
    const cacheKey = `team_${teamName.toLowerCase()}_${league || 'any'}`
    
    // Check cache first
    if (this.isCacheValid(cacheKey)) {
      const cached = this.teamCache.get(cacheKey)
      if (cached) {
        return cached.logo
      }
    }

    try {
      // Call our backend API endpoint
      const response = await fetch(`/api/team-logo?team=${encodeURIComponent(teamName)}&league=${league || ''}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch team logo: ${response.status}`)
      }

      const data = await response.json() as Partial<TeamData> & { logo: string }
      
      if (data.logo) {
        const teamData: TeamData = {
          id: data.id || 0,
          name: data.name || teamName,
          logo: data.logo,
          country: data.country,
          league: league
        }
        
        // Cache the result
        this.teamCache.set(cacheKey, teamData)
        this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_DURATION)
        return data.logo
      }
    } catch (error) {
      console.warn('Failed to fetch team logo:', error)
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
export const apiFootballClientService = ApiFootballClientService



