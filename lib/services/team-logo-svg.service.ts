/**
 * Team Logo SVG Service
 * Generates beautiful SVG logos with diagonal split design
 * No external API dependencies - pure CSS/SVG solution
 */

export interface TeamLogoOptions {
  teamName: string
  league?: string
  size?: number
  style?: 'match' | 'single' | 'minimal'
}

export interface TeamColors {
  primary: string
  secondary: string
  text: string
  accent: string
}

export class TeamLogoSVGService {
  private static readonly LEAGUE_COLORS: Record<string, TeamColors> = {
    'Premier League': { primary: '#1B4D3E', secondary: '#FFD700', text: '#FFFFFF', accent: '#C8102E' },
    'La Liga': { primary: '#FF0000', secondary: '#FFD700', text: '#FFFFFF', accent: '#000000' },
    'Bundesliga': { primary: '#000000', secondary: '#FF0000', text: '#FFFFFF', accent: '#FFD700' },
    'Serie A': { primary: '#0066CC', secondary: '#FFFFFF', text: '#000000', accent: '#FF0000' },
    'Ligue 1': { primary: '#1E3A8A', secondary: '#FFFFFF', text: '#000000', accent: '#FF0000' },
    'Champions League': { primary: '#1E40AF', secondary: '#FFD700', text: '#FFFFFF', accent: '#000000' },
    'Europa League': { primary: '#7C3AED', secondary: '#FFFFFF', text: '#000000', accent: '#FFD700' },
    'World Cup': { primary: '#059669', secondary: '#FFD700', text: '#FFFFFF', accent: '#000000' },
    'Euro': { primary: '#1E40AF', secondary: '#FFD700', text: '#FFFFFF', accent: '#FF0000' }
  }

  private static readonly TEAM_COLORS: Record<string, TeamColors> = {
    'Manchester United': { primary: '#DA020E', secondary: '#FFE500', text: '#FFFFFF', accent: '#000000' },
    'Liverpool': { primary: '#C8102E', secondary: '#F6EB61', text: '#FFFFFF', accent: '#000000' },
    'Arsenal': { primary: '#EF0107', secondary: '#FFFFFF', text: '#000000', accent: '#FFD700' },
    'Chelsea': { primary: '#034694', secondary: '#FFFFFF', text: '#000000', accent: '#FFD700' },
    'Manchester City': { primary: '#6CABDD', secondary: '#FFFFFF', text: '#000000', accent: '#FFD700' },
    'Tottenham': { primary: '#132257', secondary: '#FFFFFF', text: '#000000', accent: '#FFD700' },
    'Real Madrid': { primary: '#FFFFFF', secondary: '#FFD700', text: '#000000', accent: '#000000' },
    'Barcelona': { primary: '#A50044', secondary: '#004D98', text: '#FFFFFF', accent: '#FFD700' },
    'Bayern Munich': { primary: '#DC052D', secondary: '#FFFFFF', text: '#000000', accent: '#000000' },
    'Juventus': { primary: '#000000', secondary: '#FFFFFF', text: '#000000', accent: '#FFD700' },
    'AC Milan': { primary: '#FB090B', secondary: '#000000', text: '#FFFFFF', accent: '#FFFFFF' },
    'Inter Milan': { primary: '#0068A8', secondary: '#000000', text: '#FFFFFF', accent: '#FFFFFF' },
    'PSG': { primary: '#004170', secondary: '#ED1C24', text: '#FFFFFF', accent: '#FFFFFF' },
    'Atletico Madrid': { primary: '#CE1126', secondary: '#FFFFFF', text: '#000000', accent: '#000000' }
  }

  /**
   * Generate a team logo with diagonal split design
   */
  generateTeamLogo(options: TeamLogoOptions): string {
    const { teamName, league, size = 64, style = 'match' } = options
    
    if (style === 'match') {
      return this.generateMatchLogo(teamName, league, size)
    } else if (style === 'single') {
      return this.generateSingleTeamLogo(teamName, league, size)
    } else {
      return this.generateMinimalLogo(teamName, league, size)
    }
  }

  /**
   * Generate a match logo with both teams (for TeamLogoGenerator)
   */
  generateMatchLogoWithTeams(homeTeam: string, awayTeam: string, league?: string, size: number = 64): string {
    const homeColors = this.getTeamColors(homeTeam, league)
    const awayColors = this.getTeamColors(awayTeam, league)
    const homeInitials = this.getTeamInitials(homeTeam)
    const awayInitials = this.getTeamInitials(awayTeam)
    
    // For full-width display, use larger dimensions
    const width = 400
    const height = 200
    
    return `
      <svg width="${width}" height="${height}" viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${homeTeam} vs ${awayTeam} match-up">
        <defs>
          <!-- Home team colors -->
          <linearGradient id="leftGrad-${homeTeam.replace(/\s+/g, '-').toLowerCase()}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${homeColors.primary}"/>
            <stop offset="100%" stop-color="${homeColors.secondary}"/>
          </linearGradient>
          <!-- Away team colors -->
          <linearGradient id="rightGrad-${awayTeam.replace(/\s+/g, '-').toLowerCase()}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${awayColors.primary}"/>
            <stop offset="100%" stop-color="${awayColors.secondary}"/>
          </linearGradient>

          <!-- Soccer ball icon -->
          <g id="iconBall-${homeTeam.replace(/\s+/g, '-').toLowerCase()}">
            <circle cx="0" cy="0" r="18" fill="none" stroke="currentColor" stroke-width="3"/>
            <polygon points="-5,-5 5,-5 8,0 0,6 -8,0" fill="currentColor"/>
            <g fill="none" stroke="currentColor" stroke-width="2">
              <path d="M-18 0 Q-7 4 0 0"/>
              <path d="M18 0 Q7 -4 0 0"/>
              <path d="M-11 14 Q0 6 11 14"/>
              <path d="M-11 -14 Q0 -6 11 -14"/>
            </g>
          </g>

          <!-- Shield icon -->
          <g id="iconShield-${awayTeam.replace(/\s+/g, '-').toLowerCase()}" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round">
            <path d="M0 -18 L22 -10 V4 C22 13 13 18 0 22 C-13 18 -22 13 -22 4 V-10 Z"/>
            <g stroke-width="3">
              <path d="M-13 -5 V6"/>
              <path d="M-4 -7 V9"/>
              <path d="M4 -7 V9"/>
              <path d="M13 -5 V6"/>
            </g>
          </g>
        </defs>

        <!-- Split background -->
        <rect x="0" y="0" width="200" height="200" fill="url(#leftGrad-${homeTeam.replace(/\s+/g, '-').toLowerCase()})"/>
        <rect x="200" y="0" width="200" height="200" fill="url(#rightGrad-${awayTeam.replace(/\s+/g, '-').toLowerCase()})"/>

        <!-- Pitch lines (very subtle) -->
        <g opacity="0.10" stroke="#fff" stroke-width="1">
          <line x1="200" y1="0" x2="200" y2="200"/>
          <circle cx="200" cy="100" r="30" fill="none"/>
          <rect x="18" y="18" width="364" height="164" rx="8" fill="none"/>
          <rect x="40" y="60" width="56" height="80" rx="4" fill="none"/>
          <rect x="304" y="60" width="56" height="80" rx="4" fill="none"/>
        </g>

        <!-- Left team -->
        <g transform="translate(100,100)">
          <g transform="translate(-44,-22)" style="color:#F5F7FA">
            <use href="#iconBall-${homeTeam.replace(/\s+/g, '-').toLowerCase()}"/>
          </g>
          <text x="-6" y="14" fill="#F5F7FA"
                font-family="Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif"
                font-size="16" font-weight="800" text-anchor="end" letter-spacing=".5">
            ${this.getShortTeamName(homeTeam)}
          </text>
        </g>

        <!-- Right team -->
        <g transform="translate(300,100)">
          <g transform="translate(44,-20)" style="color:#F5F7FA">
            <use href="#iconShield-${awayTeam.replace(/\s+/g, '-').toLowerCase()}"/>
          </g>
          <text x="6" y="14" fill="#F5F7FA"
                font-family="Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif"
                font-size="16" font-weight="800" text-anchor="start" letter-spacing=".5">
            ${this.getShortTeamName(awayTeam)}
          </text>
        </g>

        <!-- Center VS badge -->
        <g transform="translate(200,100)">
          <circle r="28" fill="rgba(0,0,0,.35)"/>
          <circle r="25" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="2"/>
          <text y="6" fill="#fff"
                font-family="Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif"
                font-size="24" font-weight="900" text-anchor="middle" letter-spacing="2">
            VS
          </text>
        </g>
      </svg>
    `
  }

  /**
   * Generate match logo with professional template design
   */
  private generateMatchLogo(teamName: string, league?: string, size: number = 64): string {
    const colors = this.getTeamColors(teamName, league)
    const initials = this.getTeamInitials(teamName)
    
    // Scale the template to fit the requested size
    const scale = size / 64
    const width = 120 * scale
    const height = 63 * scale
    
    return `
      <svg width="${width}" height="${height}" viewBox="0 0 120 63" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${teamName} match-up">
        <defs>
          <!-- Team colors -->
          <linearGradient id="leftGrad-${teamName.replace(/\s+/g, '')}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${colors.primary}"/>
            <stop offset="100%" stop-color="${colors.secondary}"/>
          </linearGradient>
          <linearGradient id="rightGrad-${teamName.replace(/\s+/g, '')}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${colors.accent}"/>
            <stop offset="100%" stop-color="${this.darkenColor(colors.accent, 20)}"/>
          </linearGradient>

          <!-- Subtle pitch lines -->
          <mask id="pitchMask-${teamName.replace(/\s+/g, '')}">
            <rect width="120" height="63" fill="white"/>
            <circle cx="60" cy="31.5" r="10" fill="black"/>
          </mask>

          <!-- Soccer ball icon -->
          <g id="iconBall-${teamName.replace(/\s+/g, '')}">
            <circle cx="0" cy="0" r="5.2" fill="none" stroke="currentColor" stroke-width="0.8"/>
            <polygon points="-1.2,-1.2 1.2,-1.2 2,0 0,1.6 -2,0" fill="currentColor"/>
            <g fill="none" stroke="currentColor" stroke-width="0.6">
              <path d="M-5.2 0 Q-2 1 0 0"/>
              <path d="M5.2 0 Q2 -1 0 0"/>
              <path d="M-3 4 Q0 1.8 3 4"/>
              <path d="M-3 -4 Q0 -1.8 3 -4"/>
            </g>
          </g>

          <!-- Shield icon -->
          <g id="iconShield-${teamName.replace(/\s+/g, '')}" fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round">
            <path d="M0 -5.5 L6 -3.5 L6 1 C6 3.5 3.5 5.5 0 7 C-3.5 5.5 -6 3.5 -6 1 L-6 -3.5 Z"/>
            <g stroke-width="0.8">
              <path d="M-3.8 -1.8 V1.8"/>
              <path d="M-1.2 -2.2 V2.5"/>
              <path d="M1.2 -2.2 V2.5"/>
              <path d="M3.8 -1.8 V1.8"/>
            </g>
          </g>
        </defs>

        <!-- Background split -->
        <rect x="0" y="0" width="60" height="63" fill="url(#leftGrad-${teamName.replace(/\s+/g, '')})"/>
        <rect x="60" y="0" width="60" height="63" fill="url(#rightGrad-${teamName.replace(/\s+/g, '')})"/>

        <!-- Subtle midline + pitch circle -->
        <g opacity="0.12" stroke="#FFFFFF" stroke-width="0.2" mask="url(#pitchMask-${teamName.replace(/\s+/g, '')})">
          <line x1="60" y1="0" x2="60" y2="63"/>
          <circle cx="60" cy="31.5" r="10" fill="none"/>
          <rect x="4" y="4" width="112" height="55" fill="none" rx="1.4"/>
          <rect x="8" y="16.5" width="16" height="30" fill="none" rx="1"/>
          <rect x="96" y="16.5" width="16" height="30" fill="none" rx="1"/>
        </g>

        <!-- Left team block -->
        <g transform="translate(30,31.5)">
          <g transform="translate(-17,-3)" fill="#F5F7FA">
            <g transform="translate(0,0)" style="color:#F5F7FA">
              <use href="#iconBall-${teamName.replace(/\s+/g, '')}"/>
            </g>
          </g>
          <text x="-2" y="1" fill="#F5F7FA" font-family="Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" 
                font-size="6.4" font-weight="800" text-anchor="end" letter-spacing="0.1">
            ${initials}
          </text>
        </g>

        <!-- Right team block -->
        <g transform="translate(90,31.5)">
          <g transform="translate(17,-2)" style="color:#F5F7FA">
            <use href="#iconShield-${teamName.replace(/\s+/g, '')}"/>
          </g>
          <text x="2" y="1" fill="#F5F7FA" font-family="Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" 
                font-size="6.4" font-weight="800" text-anchor="start" letter-spacing="0.1">
            ${initials}
          </text>
        </g>

        <!-- Center VS badge -->
        <g transform="translate(60,31.5)">
          <circle r="8.4" fill="rgba(0,0,0,0.25)"/>
          <circle r="7.8" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="0.2"/>
          <text y="2.2" fill="#FFFFFF" font-family="Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
                font-size="8.8" font-weight="900" text-anchor="middle" letter-spacing="0.2">VS</text>
        </g>

        <!-- Footer tag -->
        <g opacity="0.9">
          <text x="4" y="59" fill="#C7D2FE" font-family="Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" 
                font-size="2" font-weight="600" opacity="0.7">
            SnapBet AI
          </text>
        </g>
      </svg>
    `
  }

  /**
   * Generate single team logo
   */
  private generateSingleTeamLogo(teamName: string, league?: string, size: number = 64): string {
    const colors = this.getTeamColors(teamName, league)
    const initials = this.getTeamInitials(teamName)
    const leagueIcon = this.getLeagueIcon(league)
    
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="single-${teamName.replace(/\s+/g, '')}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${colors.primary};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${colors.secondary};stop-opacity:1" />
          </linearGradient>
        </defs>
        
        <!-- Background with diagonal split -->
        <path d="M 0,0 L ${size},0 L ${size*0.7},${size} L 0,${size} Z" 
              fill="url(#single-${teamName.replace(/\s+/g, '')})"/>
        <path d="M ${size},0 L ${size*0.7},${size} L ${size},${size} Z" 
              fill="${colors.accent}" opacity="0.3"/>
        
        <!-- Team initials -->
        <text x="${size/2}" y="${size/2+4}" 
              font-family="Arial, sans-serif" 
              font-size="${size/4}" 
              font-weight="bold" 
              fill="${colors.text}" 
              text-anchor="middle"
              dominant-baseline="middle">${initials}</text>
        
        <!-- League icon -->
        ${leagueIcon ? `
          <g transform="translate(${size*0.8}, ${size*0.2})">
            ${leagueIcon}
          </g>
        ` : ''}
      </svg>
    `
  }

  /**
   * Generate minimal logo
   */
  private generateMinimalLogo(teamName: string, league?: string, size: number = 64): string {
    const colors = this.getTeamColors(teamName, league)
    const initials = this.getTeamInitials(teamName)
    
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="minimal-${teamName.replace(/\s+/g, '')}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${colors.primary};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${colors.secondary};stop-opacity:1" />
          </linearGradient>
        </defs>
        
        <!-- Simple diagonal split -->
        <rect x="0" y="0" width="${size}" height="${size}" 
              fill="url(#minimal-${teamName.replace(/\s+/g, '')})"/>
        <polygon points="0,0 ${size},0 ${size*0.3},${size} 0,${size}" 
                 fill="${colors.accent}" opacity="0.2"/>
        
        <!-- Team initials -->
        <text x="${size/2}" y="${size/2+4}" 
              font-family="Arial, sans-serif" 
              font-size="${size/3}" 
              font-weight="bold" 
              fill="${colors.text}" 
              text-anchor="middle"
              dominant-baseline="middle">${initials}</text>
      </svg>
    `
  }

  /**
   * Get team colors based on name and league
   */
  private getTeamColors(teamName: string, league?: string): TeamColors {
    // First try team-specific colors
    const teamKey = Object.keys(TeamLogoSVGService.TEAM_COLORS).find(key => 
      key.toLowerCase().includes(teamName.toLowerCase()) || 
      teamName.toLowerCase().includes(key.toLowerCase())
    )
    
    if (teamKey) {
      return TeamLogoSVGService.TEAM_COLORS[teamKey]
    }
    
    // Then try league-specific colors
    if (league) {
      const leagueKey = Object.keys(TeamLogoSVGService.LEAGUE_COLORS).find(key => 
        key.toLowerCase().includes(league.toLowerCase())
      )
      
      if (leagueKey) {
        return TeamLogoSVGService.LEAGUE_COLORS[leagueKey]
      }
    }
    
    // Fallback to generated colors
    return this.generateColorsFromName(teamName)
  }

  /**
   * Generate colors based on team name hash
   */
  private generateColorsFromName(teamName: string): TeamColors {
    const hash = teamName.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0)
      return a & a
    }, 0)
    
    const colorSets = [
      { primary: '#1E40AF', secondary: '#3B82F6', text: '#FFFFFF', accent: '#F59E0B' },
      { primary: '#DC2626', secondary: '#EF4444', text: '#FFFFFF', accent: '#F59E0B' },
      { primary: '#059669', secondary: '#10B981', text: '#FFFFFF', accent: '#F59E0B' },
      { primary: '#7C2D12', secondary: '#EA580C', text: '#FFFFFF', accent: '#F59E0B' },
      { primary: '#7C3AED', secondary: '#8B5CF6', text: '#FFFFFF', accent: '#F59E0B' },
      { primary: '#BE185D', secondary: '#EC4899', text: '#FFFFFF', accent: '#F59E0B' },
      { primary: '#0F766E', secondary: '#14B8A6', text: '#FFFFFF', accent: '#F59E0B' },
      { primary: '#B45309', secondary: '#F59E0B', text: '#000000', accent: '#1F2937' }
    ]
    
    return colorSets[Math.abs(hash) % colorSets.length]
  }

  /**
   * Get team initials
   */
  private getTeamInitials(teamName: string): string {
    return teamName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .slice(0, 3)
  }

  /**
   * Get shortened team name for display
   */
  private getShortTeamName(teamName: string): string {
    const shortNames: Record<string, string> = {
      'Manchester United': 'MAN UTD',
      'Manchester City': 'MAN CITY',
      'Arsenal': 'ARSENAL',
      'Chelsea': 'CHELSEA',
      'Liverpool': 'LIVERPOOL',
      'Tottenham': 'SPURS',
      'Tottenham Hotspur': 'SPURS',
      'Real Madrid': 'REAL MADRID',
      'Barcelona': 'BARCELONA',
      'Bayern Munich': 'BAYERN',
      'Juventus': 'JUVENTUS',
      'AC Milan': 'AC MILAN',
      'Inter Milan': 'INTER',
      'PSG': 'PSG',
      'Atletico Madrid': 'ATLETICO',
      'Borussia Dortmund': 'DORTMUND',
      'Sao Paulo': 'SAO PAULO',
      'Mirassol': 'MIRASSOL',
      'Flamengo': 'FLAMENGO',
      'Palmeiras': 'PALMEIRAS',
      'Corinthians': 'CORINTHIANS',
      'Santos': 'SANTOS',
      'Vasco': 'VASCO',
      'Botafogo': 'BOTAFOGO',
      'Fluminense': 'FLUMINENSE',
      'Gremio': 'GREMIO',
      'Internacional': 'INTER',
      'Athletico Paranaense': 'ATHLETICO',
      'Fortaleza': 'FORTALEZA',
      'Ceara': 'CEARA',
      'Bahia': 'BAHIA',
      'Sport': 'SPORT',
      'Nautico': 'NAUTICO',
      'Santa Cruz': 'SANTA CRUZ',
      'Recife': 'RECIFE',
      'Pernambuco': 'PERNAMBUCO',
      'Vitoria': 'VITORIA',
      'Salvador': 'SALVADOR',
      'Brasilia': 'BRASILIA',
      'Goias': 'GOIAS',
      'Cuiaba': 'CUIABA',
      'Coritiba': 'CORITIBA',
      'Parana': 'PARANA',
      'Curitiba': 'CURITIBA',
      'Londrina': 'LONDRINA',
      'Ponte Preta': 'PONTE PRETA',
      'Guarani': 'GUARANI',
      'Campinas': 'CAMPINAS',
      'Sao Caetano': 'SAO CAETANO',
      'Santo Andre': 'SANTO ANDRE',
      'Red Bull Bragantino': 'BRAGANTINO',
      'RB Bragantino': 'BRAGANTINO',
      'Red Bull': 'RED BULL',
      'Sao Bernardo': 'SAO BERNARDO',
      'Sao Jose dos Campos': 'SAO JOSE'
    }

    // Check for exact match first
    if (shortNames[teamName]) {
      return shortNames[teamName]
    }

    // Check for partial matches
    const teamKey = Object.keys(shortNames).find(key => 
      key.toLowerCase().includes(teamName.toLowerCase()) || 
      teamName.toLowerCase().includes(key.toLowerCase())
    )

    if (teamKey) {
      return shortNames[teamKey]
    }

    // For unknown teams, use a smart shortening strategy
    const words = teamName.split(' ')
    if (words.length === 1) {
      return teamName.toUpperCase().slice(0, 10)
    } else if (words.length === 2) {
      return words.map(word => word.charAt(0).toUpperCase()).join('')
    } else {
      return words.slice(0, 2).map(word => word.charAt(0).toUpperCase()).join('')
    }
  }

  /**
   * Darken a color by a percentage
   */
  private darkenColor(color: string, percent: number): string {
    // Simple color darkening - in a real implementation, you'd use a proper color library
    if (color.startsWith('#')) {
      const hex = color.slice(1)
      const num = parseInt(hex, 16)
      const amt = Math.round(2.55 * percent)
      const R = (num >> 16) - amt
      const G = (num >> 8 & 0x00FF) - amt
      const B = (num & 0x0000FF) - amt
      return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
        (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1)
    }
    return color
  }

  /**
   * Get league icon SVG
   */
  private getLeagueIcon(league?: string): string {
    if (!league) return ''
    
    const leagueIcons: Record<string, string> = {
      'Premier League': '<circle cx="0" cy="0" r="8" fill="#FFD700" stroke="#000" stroke-width="1"/>',
      'La Liga': '<rect x="-6" y="-6" width="12" height="12" fill="#FF0000" stroke="#FFD700" stroke-width="1"/>',
      'Bundesliga': '<polygon points="0,-8 -6,6 6,6" fill="#000000" stroke="#FF0000" stroke-width="1"/>',
      'Champions League': '<circle cx="0" cy="0" r="6" fill="#1E40AF" stroke="#FFD700" stroke-width="1"/>',
      'Europa League': '<rect x="-4" y="-4" width="8" height="8" fill="#7C3AED" stroke="#FFD700" stroke-width="1"/>'
    }
    
    const leagueKey = Object.keys(leagueIcons).find(key => 
      key.toLowerCase().includes(league.toLowerCase())
    )
    
    return leagueKey ? leagueIcons[leagueKey] : ''
  }
}

// Singleton instance
export const teamLogoSVGService = new TeamLogoSVGService()
