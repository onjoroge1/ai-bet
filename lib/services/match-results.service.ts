import prisma from '@/lib/db'

export interface MatchResult {
  fixture: {
    id: number
    date: string
    venue: {
      name: string
      city: string
    }
    referee: string
    status: {
      short: string
      elapsed: number
    }
  }
  teams: {
    home: {
      id: number
      name: string
      logo: string
    }
    away: {
      id: number
      name: string
      logo: string
    }
  }
  goals: {
    home: number
    away: number
  }
  score: {
    halftime: {
      home: number
      away: number
    }
    fulltime: {
      home: number
      away: number
    }
  }
  league: {
    id: number
    name: string
    country: string
  }
}

export interface RapidApiResponse {
  response: MatchResult[]
}

export class MatchResultsService {
  /**
   * Fetch completed matches from RapidAPI
   */
  static async fetchCompletedMatches(): Promise<MatchResult[]> {
    const apiKey = process.env.RAPIDAPI_KEY
    if (!apiKey) {
      throw new Error('RAPIDAPI_KEY not configured')
    }

    try {
      // Get yesterday's date for completed matches
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const dateStr = yesterday.toISOString().split('T')[0]

      const response = await fetch(
        `https://v3.football.api-sports.io/fixtures?date=${dateStr}&status=FT`,
        {
          headers: {
            'X-RapidAPI-Key': apiKey,
            'X-RapidAPI-Host': 'v3.football.api-sports.io'
          }
        }
      )

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`)
      }

      const data = await response.json() as any
      return data.response || []
    } catch (error) {
      console.error('Error fetching completed matches:', error)
      throw error
    }
  }

  /**
   * Store completed matches in the database
   */
  static async storeCompletedMatches(matches: MatchResult[]): Promise<void> {
    for (const match of matches) {
      try {
        // Check if match already exists
        const existingMatch = await prisma.completedMatches.findUnique({
          where: { externalMatchId: match.fixture.id.toString() }
        })

        if (!existingMatch) {
          await prisma.completedMatches.create({
            data: {
              externalMatchId: match.fixture.id.toString(),
              homeTeam: match.teams.home.name,
              awayTeam: match.teams.away.name,
              homeScore: match.goals.home,
              awayScore: match.goals.away,
              league: match.league.name,
              matchDate: new Date(match.fixture.date),
              status: 'completed',
              minutePlayed: match.fixture.status.elapsed || 90,
              halfTimeScore: `${match.score.halftime.home}-${match.score.halftime.away}`,
              fullTimeScore: `${match.score.fulltime.home}-${match.score.fulltime.away}`,
              venue: match.fixture.venue?.name || null,
              referee: match.fixture.referee || null,
              attendance: null, // Not available in this API
              syncedToBreakingNews: false
            }
          })
        }
      } catch (error) {
        console.error(`Error storing match ${match.fixture.id}:`, error)
      }
    }
  }

  /**
   * Sync completed matches to breaking news
   */
  static async syncToBreakingNews(): Promise<void> {
    try {
      // Get unsynced completed matches from the last 24 hours
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      const unsyncedMatches = await prisma.completedMatches.findMany({
        where: {
          status: 'completed',
          syncedToBreakingNews: false,
          matchDate: {
            gte: yesterday
          }
        },
        orderBy: {
          matchDate: 'desc'
        }
      })

      for (const match of unsyncedMatches) {
        try {
          // Create breaking news for the match
          const title = `${match.homeTeam} ${match.homeScore} - ${match.awayScore} ${match.awayTeam}`
          const message = `${match.homeTeam} defeated ${match.awayTeam} ${match.homeScore}-${match.awayScore} in ${match.league}. Match completed on ${match.matchDate.toLocaleDateString()}.`

          await prisma.breakingNews.create({
            data: {
              title,
              message,
              priority: 3, // High priority for match results
              isActive: true,
              sourceType: 'match_result',
              matchId: match.id,
              autoExpire: true,
              expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
              createdBy: 'system' // System-generated breaking news
            }
          })

          // Mark as synced
          await prisma.completedMatches.update({
            where: { id: match.id },
            data: {
              syncedToBreakingNews: true,
              syncedAt: new Date()
            }
          })
        } catch (error) {
          console.error(`Error creating breaking news for match ${match.id}:`, error)
        }
      }
    } catch (error) {
      console.error('Error syncing matches to breaking news:', error)
      throw error
    }
  }

  /**
   * Clean up expired breaking news
   */
  static async cleanupExpiredNews(): Promise<void> {
    try {
      const expiredNews = await prisma.breakingNews.findMany({
        where: {
          expiresAt: {
            lte: new Date()
          },
          isActive: true
        }
      })

      for (const news of expiredNews) {
        await prisma.breakingNews.update({
          where: { id: news.id },
          data: { isActive: false }
        })
      }
    } catch (error) {
      console.error('Error cleaning up expired news:', error)
    }
  }

  /**
   * Get all completed matches with pagination
   */
  static async getCompletedMatches(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit

    const [matches, total] = await Promise.all([
      prisma.completedMatches.findMany({
        skip,
        take: limit,
        orderBy: {
          matchDate: 'desc'
        }
      }),
      prisma.completedMatches.count()
    ])

    return {
      matches,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    }
  }
}
