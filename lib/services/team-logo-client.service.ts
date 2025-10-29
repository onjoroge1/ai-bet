/**
 * Client-side team logo service
 * This version works in the browser and makes API calls to our backend
 */

export interface TeamLogoData {
  teamId: number
  teamName: string
  logoUrl: string
  league?: string
}

export class TeamLogoClientService {
  private logoCache: Map<string, TeamLogoData> = new Map()
  private cacheExpiry: Map<string, number> = new Map()
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

  /**
   * Get team logo by team name
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
      // For now, we'll use a fallback approach since we don't have a backend endpoint
      // In the future, we could create an API endpoint that fetches from RapidAPI
      const logoUrl = await this.generateFallbackLogo(teamName, league)
      
      if (logoUrl) {
        const logoData: TeamLogoData = {
          teamId: 0, // We don't have the actual ID
          teamName,
          logoUrl,
          league
        }
        
        this.logoCache.set(cacheKey, logoData)
        this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_DURATION)
        return logoUrl
      }
    } catch (error) {
      console.warn('Failed to get team logo:', error)
    }

    return null
  }

  /**
   * Generate a fallback logo using a logo service or placeholder
   */
  private async generateFallbackLogo(teamName: string, league?: string): Promise<string | null> {
    try {
      // Try to get logo from a free logo service
      // Using teamlogos.com or similar service
      const searchQuery = encodeURIComponent(teamName)
      const logoUrl = `https://logo.clearbit.com/${teamName.toLowerCase().replace(/\s+/g, '')}.com`
      
      // Test if the logo exists by making a HEAD request
      const response = await fetch(logoUrl, { method: 'HEAD' })
      if (response.ok) {
        return logoUrl
      }
    } catch (error) {
      // Logo service failed, continue to next fallback
    }

    // If no external logo found, return null to use initials
    return null
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
  getCachedTeamData(teamName: string, league?: string): TeamLogoData | null {
    const cacheKey = `team_name_${teamName.toLowerCase()}_${league || 'any'}`
    return this.logoCache.get(cacheKey) || null
  }
}

// Singleton instance
export const teamLogoClientService = new TeamLogoClientService()

