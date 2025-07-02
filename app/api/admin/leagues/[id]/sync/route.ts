import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'
import { Prisma } from '@prisma/client'
import { z } from "zod"
import { getCountryPricing } from '@/lib/pricing-service'

// Helper function to get country-specific pricing from environment variables
function getCountrySpecificPricing(countryCode: string) {
  const config = getCountryPricing(countryCode)
  
  return {
    price: config.price,
    originalPrice: config.originalPrice,
    source: config.source
  }
}

// POST /api/admin/leagues/[id]/sync - Manual sync for a specific league
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    logger.info('Starting league sync', {
      tags: ['api', 'admin', 'leagues', 'sync'],
      data: { leagueId: id }
    })

    // Find the league
    const league = await prisma.league.findUnique({
      where: { id }
    })

    if (!league) {
      logger.error('League not found', {
        tags: ['api', 'admin', 'leagues', 'sync'],
        data: { leagueId: id }
      })
      return NextResponse.json({ error: 'League not found' }, { status: 404 })
    }

    logger.info('Found league for sync', {
      tags: ['api', 'admin', 'leagues', 'sync'],
      data: {
        leagueId: id,
        leagueName: league.name,
        externalLeagueId: league.externalLeagueId,
        isDataCollectionEnabled: league.isDataCollectionEnabled
      }
    })

    if (!league.isDataCollectionEnabled) {
      logger.warn('League data collection is disabled', {
        tags: ['api', 'admin', 'leagues', 'sync'],
        data: {
          leagueId: id,
          leagueName: league.name
        }
      })
      return NextResponse.json({ 
        error: 'Data collection is disabled for this league' 
      }, { status: 400 })
    }

    // Ensure external league ID exists
    if (!league.externalLeagueId) {
      logger.error('No external league ID configured', {
        tags: ['api', 'admin', 'leagues', 'sync'],
        data: {
          leagueId: id,
          leagueName: league.name
        }
      })
      throw new Error('No external league ID configured for this league')
    }

    // Attempt to fetch matches from external API
    try {
      const queryParams = new URLSearchParams({
        league_id: league.externalLeagueId,
        limit: league.matchLimit.toString(),
        exclude_finished: 'true'
      })

      // Call the external API directly instead of internal API to avoid authentication issues
      const apiUrl = `${process.env.BACKEND_URL}/matches/upcoming?${queryParams.toString()}`
      logger.info('Fetching matches from external API', {
        tags: ['api', 'admin', 'leagues', 'sync'],
        data: {
          leagueId: id,
          apiUrl: apiUrl,
          backendUrl: process.env.BACKEND_URL,
          hasApiKey: !!process.env.BACKEND_API_KEY,
          externalLeagueId: league.externalLeagueId,
          matchLimit: league.matchLimit,
          queryParams: queryParams.toString()
        }
      })

      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${process.env.BACKEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
      })

      logger.info('External API response received', {
        tags: ['api', 'admin', 'leagues', 'sync'],
        data: {
          leagueId: id,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error('External API error response', {
          tags: ['api', 'admin', 'leagues', 'sync'],
          data: {
            leagueId: id,
            status: response.status,
            statusText: response.statusText,
            errorText: errorText
          }
        })
        throw new Error(`External API responded with status: ${response.status}`)
      }

      const responseData = await response.json()
      
      // Extract matches from the external API response structure
      // The actual structure is: responseData.matches.matches (nested)
      const matchesData = responseData.matches?.matches || responseData.matches
      
      logger.info('Parsed matches data from external API', {
        tags: ['api', 'admin', 'leagues', 'sync'],
        data: {
          leagueId: id,
          dataType: typeof matchesData,
          isArray: Array.isArray(matchesData),
          dataKeys: responseData ? Object.keys(responseData) : 'null/undefined',
          matchesKeys: responseData.matches ? Object.keys(responseData.matches) : 'null/undefined',
          dataLength: Array.isArray(matchesData) ? matchesData.length : 'N/A',
          sampleData: Array.isArray(matchesData) && matchesData.length > 0 ? matchesData[0] : 'No data',
          fullResponse: responseData // Log the full response to see the structure
        }
      })

      // Extract matches from the response - handle different possible structures
      let matches = []
      if (Array.isArray(matchesData)) {
        // Direct array response from external API
        matches = matchesData
      } else if (matchesData && typeof matchesData === 'object') {
        // Object response - try different possible keys
        if (matchesData.matches && Array.isArray(matchesData.matches)) {
          matches = matchesData.matches
        } else if (matchesData.data && Array.isArray(matchesData.data)) {
          matches = matchesData.data
        } else if (matchesData.results && Array.isArray(matchesData.results)) {
          matches = matchesData.results
        } else {
          // Try to find any array property
          const arrayKeys = Object.keys(matchesData).filter(key => 
            Array.isArray(matchesData[key])
          )
          if (arrayKeys.length > 0) {
            matches = matchesData[arrayKeys[0]]
            logger.info('Found matches in property', {
              tags: ['api', 'admin', 'leagues', 'sync'],
              data: {
                leagueId: id,
                propertyKey: arrayKeys[0],
                matchCount: matches.length
              }
            })
          }
        }
      }

      logger.info('Extracted matches', {
        tags: ['api', 'admin', 'leagues', 'sync'],
        data: {
          leagueId: id,
          extractedMatchCount: matches.length,
          isArray: Array.isArray(matches)
        }
      })

      // Check if we have matches to process
      if (!Array.isArray(matches) || matches.length === 0) {
        logger.error('No matches found in API response', {
          tags: ['api', 'admin', 'leagues', 'sync'],
          data: {
            leagueId: id,
            actualType: typeof matches,
            actualValue: matches,
            originalResponse: responseData
          }
        })
        throw new Error('No matches found in API response')
      }

      logger.info('Processing matches', {
        tags: ['api', 'admin', 'leagues', 'sync'],
        data: {
          leagueId: id,
          matchCount: matches.length
        }
      })

      let processedMatches = 0
      let createdQuickPurchases = 0
      const updatedQuickPurchases = 0

      // Process each match
      for (const match of matches) {
        try {
          logger.debug('Processing individual match', {
            tags: ['api', 'admin', 'leagues', 'sync'],
            data: {
              leagueId: id,
              matchId: match.match_id,
              homeTeam: match.home_team,
              awayTeam: match.away_team,
              matchDate: match.date
            }
          })

          // Upsert teams using name and leagueId (unique constraint)
          const homeTeam = await prisma.team.upsert({
            where: { 
              name_leagueId: { 
                name: match.home_team, 
                leagueId: league.id 
              } 
            },
            update: { 
              name: match.home_team,
              isActive: true
            },
            create: {
              name: match.home_team,
              leagueId: league.id,
              isActive: true
            }
          })

          const awayTeam = await prisma.team.upsert({
            where: { 
              name_leagueId: { 
                name: match.away_team, 
                leagueId: league.id 
              } 
            },
            update: { 
              name: match.away_team,
              isActive: true
            },
            create: {
              name: match.away_team,
              leagueId: league.id,
              isActive: true
            }
          })

          // Create match (no upsert since no external ID field)
          const upsertedMatch = await prisma.match.create({
            data: {
              homeTeamId: homeTeam.id,
              awayTeamId: awayTeam.id,
              leagueId: league.id,
              matchDate: new Date(match.date),
              status: match.status || 'scheduled'
            }
          })

          logger.debug('Match created successfully', {
            tags: ['api', 'admin', 'leagues', 'sync'],
            data: {
              leagueId: id,
              matchId: match.match_id,
              dbMatchId: upsertedMatch.id,
              homeTeam: match.home_team,
              awayTeam: match.away_team
            }
          })

          // Get a default country for QuickPurchase creation
          const defaultCountry = await prisma.country.findFirst({
            where: { code: 'us' }
          })

          if (!defaultCountry) {
            logger.error('No default country found for QuickPurchase creation', {
              tags: ['api', 'admin', 'leagues', 'sync'],
              data: { leagueId: id }
            })
            throw new Error('No default country configured')
          }

          // Create or update QuickPurchase for this match
          const quickPurchaseData = {
            name: `${match.home_team} vs ${match.away_team}`,
            price: getCountrySpecificPricing(defaultCountry.code).price,
            originalPrice: getCountrySpecificPricing(defaultCountry.code).originalPrice,
            description: `AI prediction for ${match.home_team} vs ${match.away_team}`,
            features: ['AI Analysis', 'Match Statistics', 'Risk Assessment'],
            type: 'prediction',
            iconName: 'Brain',
            colorGradientFrom: '#3B82F6',
            colorGradientTo: '#1D4ED8',
            isUrgent: false,
            isPopular: false,
            isActive: true,
            displayOrder: 0,
            countryId: defaultCountry.id, // Use actual country ID
            matchId: match.match_id.toString(), // Store external match ID
            matchData: match, // Store full match data
            predictionData: Prisma.JsonNull, // Use Prisma.JsonNull for proper JSON null
            predictionType: null,
            confidenceScore: null,
            odds: null,
            valueRating: null,
            analysisSummary: null,
            isPredictionActive: true
          }

          // Create or update QuickPurchase using upsert
          try {
            const quickPurchase = await prisma.quickPurchase.upsert({
              where: { matchId: match.match_id.toString() },
              update: {
                name: quickPurchaseData.name,
                price: quickPurchaseData.price,
                originalPrice: quickPurchaseData.originalPrice,
                description: quickPurchaseData.description,
                features: quickPurchaseData.features,
                matchData: quickPurchaseData.matchData,
                isPredictionActive: true,
                updatedAt: new Date()
              },
              create: quickPurchaseData
            })

            logger.debug('QuickPurchase created/updated successfully', {
              tags: ['api', 'admin', 'leagues', 'sync'],
              data: {
                leagueId: id,
                matchId: match.match_id,
                quickPurchaseId: quickPurchase.id,
                action: 'created'
              }
            })

            createdQuickPurchases++

          } catch (quickPurchaseError) {
            logger.error('Error creating QuickPurchase', {
              tags: ['api', 'admin', 'leagues', 'sync'],
              data: {
                leagueId: id,
                matchId: match.match_id,
                error: quickPurchaseError instanceof Error ? quickPurchaseError.message : 'Unknown error'
              }
            })
            // Continue processing other matches even if this one fails
          }

          processedMatches++

        } catch (matchError: unknown) {
          logger.error('Error processing individual match', {
            tags: ['api', 'admin', 'leagues', 'sync'],
            data: {
              leagueId: id,
              matchId: match.match_id,
              error: matchError instanceof Error ? matchError.message : 'Unknown error'
            }
          })
        }
      }

      // Update league's last sync timestamp
      await prisma.league.update({
        where: { id: league.id },
        data: { lastDataSync: new Date() }
      })

      logger.info('League sync completed successfully', {
        tags: ['api', 'admin', 'leagues', 'sync'],
        data: {
          leagueId: id,
          leagueName: league.name,
          processedMatches: processedMatches,
          createdQuickPurchases: createdQuickPurchases,
          updatedQuickPurchases: updatedQuickPurchases
        }
      })

      return NextResponse.json({
        success: true,
        message: `Successfully synced ${processedMatches} matches`,
        data: {
          processedMatches,
          createdQuickPurchases,
          updatedQuickPurchases,
          sampleMatch: matches[0],
          responseStructure: {
            hasMatches: !!responseData.matches,
            matchesKeys: responseData.matches ? Object.keys(responseData.matches) : [],
            matchesType: typeof responseData.matches,
            matchesIsArray: Array.isArray(responseData.matches)
          }
        }
      })

    } catch (apiError: unknown) {
      logger.error('External API error', {
        tags: ['api', 'admin', 'leagues', 'sync'],
        data: {
          leagueId: id,
          error: apiError instanceof Error ? apiError.message : 'Unknown error'
        }
      })
      throw apiError
    }

  } catch (error: unknown) {
    logger.error('League sync failed', {
      tags: ['api', 'admin', 'leagues', 'sync'],
      data: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    })
    return NextResponse.json({ 
      error: 'Sync failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET /api/admin/leagues/[id]/sync - Test connection for a specific league
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    // Find the league
    const league = await prisma.league.findUnique({
      where: { id }
    })

    if (!league) {
      return NextResponse.json(
        { error: 'League not found' },
        { status: 404 }
      )
    }

    if (!league.externalLeagueId) {
      return NextResponse.json({
        success: false,
        message: 'No external ID configured',
        data: {
          leagueId: id,
          leagueName: league.name,
          externalLeagueId: null,
          connectionStatus: 'not_configured'
        }
      })
    }

    // Test connection to external API
    try {
      const queryParams = new URLSearchParams({
        league_id: league.externalLeagueId,
        limit: '1',
        exclude_finished: 'true'
      })

      const response = await fetch(
        `${process.env.BACKEND_URL}/matches/upcoming?${queryParams.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.BACKEND_API_KEY}`,
          },
        }
      )

      if (!response.ok) {
        return NextResponse.json({
          success: false,
          message: `Connection failed: ${response.status} ${response.statusText}`,
          data: {
            leagueId: id,
            leagueName: league.name,
            externalLeagueId: league.externalLeagueId,
            connectionStatus: 'failed',
            statusCode: response.status,
            statusText: response.statusText
          }
        })
      }

      const testData = await response.json()

      logger.info('GET /api/admin/leagues/[id]/sync - Connection test successful', {
        tags: ['api', 'admin', 'leagues', 'sync'],
        data: { 
          leagueId: id, 
          leagueName: league.name,
          testMatches: testData.length || 0
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Connection successful',
        data: {
          leagueId: id,
          leagueName: league.name,
          externalLeagueId: league.externalLeagueId,
          connectionStatus: 'success',
          testMatches: testData.length || 0,
          lastSync: league.lastDataSync?.toISOString() || null
        }
      })

    } catch (error) {
      logger.error('GET /api/admin/leagues/[id]/sync - Connection test failed', {
        tags: ['api', 'admin', 'leagues', 'sync'],
        error: error instanceof Error ? error : undefined,
        data: { leagueId: id, leagueName: league.name }
      })

      return NextResponse.json({
        success: false,
        message: 'Connection test failed',
        data: {
          leagueId: id,
          leagueName: league.name,
          externalLeagueId: league.externalLeagueId,
          connectionStatus: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      })
    }

  } catch (error) {
    logger.error('GET /api/admin/leagues/[id]/sync - Error', {
      tags: ['api', 'admin', 'leagues', 'sync'],
      error: error instanceof Error ? error : undefined
    })
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
} 