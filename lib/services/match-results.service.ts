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
   * Fetch completed matches from RapidAPI for enabled leagues only
   */
  static async fetchCompletedMatches(): Promise<MatchResult[]> {
    const apiKey = process.env.RAPIDAPI_KEY
    if (!apiKey) {
      throw new Error('RAPIDAPI_KEY not configured')
    }

    try {
      // Get enabled leagues from database
      const enabledLeagues = await prisma.league.findMany({
        where: {
          isActive: true,
          isDataCollectionEnabled: true,
          sport: 'football',
          externalLeagueId: { not: null }
        },
        select: {
          id: true,
          name: true,
          externalLeagueId: true,
          dataCollectionPriority: true
        },
        orderBy: {
          dataCollectionPriority: 'desc'
        }
      })

      if (enabledLeagues.length === 0) {
        console.log('No enabled leagues found for data collection')
        return []
      }

      console.log(`Found ${enabledLeagues.length} enabled leagues:`, enabledLeagues.map(l => `${l.name} (ID: ${l.externalLeagueId})`))

      // Try multiple dates to find completed matches
      const dates = []
      const today = new Date()
      
      // Try today, yesterday, and 2 days ago
      for (let i = 0; i < 3; i++) {
        const date = new Date(today)
        date.setDate(date.getDate() - i)
        dates.push(date.toISOString().split('T')[0])
      }

      let allMatches: MatchResult[] = []
      
      for (const dateStr of dates) {
        console.log(`Fetching matches for date: ${dateStr}`)
        
        // Fetch matches for each enabled league
        for (const league of enabledLeagues) {
          try {
            console.log(`Fetching matches for ${league.name} (League ID: ${league.externalLeagueId})`)
            
            // First try to get completed matches for this specific league
            const response = await fetch(
              `https://api-football-v1.p.rapidapi.com/v3/fixtures?date=${dateStr}&league=${league.externalLeagueId}&status=FT`,
              {
                headers: {
                  'X-RapidAPI-Key': apiKey,
                  'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
                }
              }
            )

            if (!response.ok) {
              console.error(`API request failed for ${league.name} on ${dateStr}: ${response.status} ${response.statusText}`)
              continue
            }

            const data = await response.json() as any
            console.log(`Found ${data.response?.length || 0} completed matches for ${league.name} on ${dateStr}`)
            
            if (data.response && data.response.length > 0) {
              console.log(`Found ${data.response.length} completed matches for ${league.name} on ${dateStr}`)
              allMatches = allMatches.concat(data.response)
            } else {
              // If no completed matches, try to get any matches for this league and date
              console.log(`No completed matches for ${league.name} on ${dateStr}, trying to get any matches...`)
              try {
                const anyMatchesResponse = await fetch(
                  `https://api-football-v1.p.rapidapi.com/v3/fixtures?date=${dateStr}&league=${league.externalLeagueId}`,
                  {
                    headers: {
                      'X-RapidAPI-Key': apiKey,
                      'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
                    }
                  }
                )
                
                if (anyMatchesResponse.ok) {
                  const anyMatchesData = await anyMatchesResponse.json() as any
                  if (anyMatchesData.response && anyMatchesData.response.length > 0) {
                    console.log(`Found ${anyMatchesData.response.length} total matches for ${league.name} on ${dateStr}`)
                    console.log('Match statuses:', anyMatchesData.response.map((m: any) => m.fixture?.status?.short).filter(Boolean))
                  }
                }
              } catch (fallbackError) {
                console.error(`Fallback fetch failed for ${league.name} on ${dateStr}:`, fallbackError)
              }
            }
            
            // Add a small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100))
            
          } catch (error) {
            console.error(`Error fetching matches for ${league.name} on ${dateStr}:`, error)
            continue
          }
        }
      }

      console.log(`Total matches found: ${allMatches.length}`)
      return allMatches
      
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
              // createdBy is now optional for system-generated breaking news
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

  /**
   * Test API connection and get available data for enabled leagues
   */
  static async testApiConnection(): Promise<any> {
    const apiKey = process.env.RAPIDAPI_KEY
    if (!apiKey) {
      throw new Error('RAPIDAPI_KEY not configured')
    }

    try {
      // Get enabled leagues from database
      const enabledLeagues = await prisma.league.findMany({
        where: {
          isActive: true,
          isDataCollectionEnabled: true,
          sport: 'football',
          externalLeagueId: { not: null }
        },
        select: {
          id: true,
          name: true,
          externalLeagueId: true,
          dataCollectionPriority: true
        },
        orderBy: {
          dataCollectionPriority: 'desc'
        }
      })

      if (enabledLeagues.length === 0) {
        console.log('No enabled leagues found for data collection')
        return {
          success: false,
          error: 'No enabled leagues found'
        }
      }

      console.log(`Testing API for ${enabledLeagues.length} enabled leagues:`, enabledLeagues.map(l => `${l.name} (ID: ${l.externalLeagueId})`))

      // Test with multiple dates to see what's available
      const dates = []
      const today = new Date()
      
      // Test today, yesterday, and 2 days ago
      for (let i = 0; i < 3; i++) {
        const date = new Date(today)
        date.setDate(date.getDate() - i)
        dates.push(date.toISOString().split('T')[0])
      }

      const results = []
      
      for (const dateStr of dates) {
        console.log(`Testing API for date: ${dateStr}`)
        
        for (const league of enabledLeagues) {
          try {
            console.log(`Testing API for ${league.name} (League ID: ${league.externalLeagueId}) on ${dateStr}`)
            
            const response = await fetch(
              `https://api-football-v1.p.rapidapi.com/v3/fixtures?date=${dateStr}&league=${league.externalLeagueId}`,
              {
                headers: {
                  'X-RapidAPI-Key': apiKey,
                  'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
                }
              }
            )

            if (!response.ok) {
              console.error(`API request failed for ${league.name} on ${dateStr}: ${response.status} ${response.statusText}`)
              continue
            }

            const data = await response.json() as any
            console.log(`API Response for ${league.name} on ${dateStr}:`, JSON.stringify(data, null, 2))
            
            results.push({
              date: dateStr,
              league: league.name,
              leagueId: league.externalLeagueId,
              totalFixtures: data.response?.length || 0,
              statuses: data.response?.map((f: any) => f.fixture?.status?.short).filter(Boolean) || [],
              sampleFixture: data.response?.[0] || null,
              hasErrors: !!data.errors
            })
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100))
            
          } catch (error) {
            console.error(`Error testing API for ${league.name} on ${dateStr}:`, error)
            results.push({
              date: dateStr,
              league: league.name,
              leagueId: league.externalLeagueId,
              totalFixtures: 0,
              statuses: [],
              sampleFixture: null,
              error: error instanceof Error ? error.message : String(error)
            })
          }
        }
      }
      
      return {
        success: true,
        results,
        summary: {
          totalDates: dates.length,
          totalLeagues: enabledLeagues.length,
          datesWithFixtures: results.filter(r => r.totalFixtures > 0).length,
          totalFixtures: results.reduce((sum, r) => sum + r.totalFixtures, 0),
          leaguesWithFixtures: [...new Set(results.filter(r => r.totalFixtures > 0).map(r => r.league))].length
        }
      }
      
    } catch (error) {
      console.error('Error testing API connection:', error)
      throw error
    }
  }
}
