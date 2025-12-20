import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger'

/**
 * Global Sync Endpoint - Syncs all available matches from /consensus/sync API
 * This solves the 94.9% data gap by ensuring all prediction-capable matches are in QuickPurchase table
 * 
 * Timeout Configuration:
 * - maxDuration: 300 seconds (5 minutes) for Vercel Pro/Enterprise
 * - runtime: nodejs (required for long-running operations)
 */
export const maxDuration = 300 // 5 minutes - allows processing ~150-200 matches
export const runtime = 'nodejs' // Use Node.js runtime for long operations

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Check admin authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 401 })
    }

    // Parse request body for optional date range
    const body = await req.json().catch(() => ({}))
    const { fromDate: requestFromDate, toDate: requestToDate, timeWindow = 'recent' } = body

    logger.info('Starting global availability sync', {
      tags: ['api', 'admin', 'global-sync'],
      data: { 
        userId: session.user.id,
        userEmail: session.user.email,
        timestamp: new Date().toISOString()
      }
    })

    // Get default country for pricing (try multiple common countries)
    let defaultCountry = await prisma.country.findFirst({
      where: { 
        code: { in: ['US', 'us', 'GB', 'gb', 'CA', 'ca'] }, // Try US, UK, Canada
        isActive: true 
      },
      select: { id: true, code: true, currencyCode: true, currencySymbol: true }
    })

    // If none of the preferred countries found, use any active country as fallback
    if (!defaultCountry) {
      logger.warn('Preferred countries not found, using first available active country', {
        tags: ['api', 'admin', 'global-sync', 'warning']
      })
      
      defaultCountry = await prisma.country.findFirst({
        where: { isActive: true },
        select: { id: true, code: true, currencyCode: true, currencySymbol: true },
        orderBy: { code: 'asc' } // Get consistent fallback
      })
    }

    if (!defaultCountry) {
      logger.error('No active countries found in database', {
        tags: ['api', 'admin', 'global-sync', 'error']
      })
      return NextResponse.json({ 
        error: 'System configuration error: No active countries found' 
      }, { status: 500 })
    }

    logger.info('Using default country for pricing', {
      tags: ['api', 'admin', 'global-sync'],
      data: { 
        countryCode: defaultCountry.code,
        currencyCode: defaultCountry.currencyCode
      }
    })

    // Step 1: Calculate date range for filtering
    let fromDate: string
    let toDate: string

    if (requestFromDate && requestToDate) {
      // Use provided date range
      fromDate = requestFromDate
      toDate = requestToDate
    } else {
      // Default: broader range (last 5 days) for better coverage of recent matches
      const fiveDaysAgo = new Date()
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)
      const today = new Date()
      
      fromDate = fiveDaysAgo.toISOString().split('T')[0] // YYYY-MM-DD format
      toDate = today.toISOString().split('T')[0]
    }
    
    logger.info('Attempting to fetch recent consensus predictions', {
      tags: ['api', 'admin', 'global-sync'],
      data: { 
        backendUrl: process.env.BACKEND_URL,
        fromDate,
        toDate,
        timeWindow: 'current_date - 1'
      }
    })

    let uniqueMatchIds: string[] = []

    try {
      // Try the new consensus endpoint first with date filtering
      const consensusUrl = `${process.env.BACKEND_URL}/consensus/sync?from_date=${fromDate}&to_date=${toDate}&limit=1000`
      
      logger.info('Calling consensus endpoint with date filter', {
        tags: ['api', 'admin', 'global-sync'],
        data: { url: consensusUrl }
      })
      
      const consensusResponse = await fetch(consensusUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.CONSENSUS_API_KEY || 'betgenius_secure_key_2024'}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(30000) // 30 second timeout
      })

      if (consensusResponse.ok) {
        const consensusData = await consensusResponse.json()
        
        if (consensusData.data && Array.isArray(consensusData.data)) {
          const consensusMatches = consensusData.data
          const matchIds = consensusMatches.map((item: any) => item.match_id.toString())
          uniqueMatchIds = [...new Set(matchIds)]

          logger.info('Successfully fetched from consensus endpoint', {
            tags: ['api', 'admin', 'global-sync'],
            data: { 
              totalConsensusRecords: consensusMatches.length,
              uniqueMatches: uniqueMatchIds.length,
              sampleMatchIds: uniqueMatchIds.slice(0, 5),
              dateRange: `${fromDate} to ${toDate}`,
              source: 'consensus_api'
            }
          })
        } else {
          throw new Error('Invalid consensus response format')
        }
      } else {
        const errorText = await consensusResponse.text()
        throw new Error(`Consensus API error: ${consensusResponse.status} - ${errorText}`)
      }
    } catch (error) {
      logger.error('Consensus endpoint failed - no fallback available', {
        tags: ['api', 'admin', 'global-sync', 'error'],
        data: { 
          error: error instanceof Error ? error.message : String(error),
          dateRange: `${fromDate} to ${toDate}`
        }
      })
      
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch from consensus endpoint',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 })
    }

    logger.info('Starting /predict calls for discovered matches', {
      tags: ['api', 'admin', 'global-sync'],
      data: { 
        totalMatches: uniqueMatchIds.length,
        sampleMatchIds: uniqueMatchIds.slice(0, 5)
      }
    })

    // Step 2: Get existing QuickPurchase records to avoid duplicates
    const existingQuickPurchases = await prisma.quickPurchase.findMany({
      where: {
        matchId: { not: null }
      },
      select: {
        matchId: true,
        id: true,
        name: true
      }
    })

    const existingMatchIds = new Set(existingQuickPurchases.map(qp => qp.matchId).filter(Boolean))
    
    logger.info('Found existing QuickPurchase records', {
      tags: ['api', 'admin', 'global-sync'],
      data: { 
        existingCount: existingMatchIds.size,
        totalDiscovered: uniqueMatchIds.length,
        newMatchesToCreate: uniqueMatchIds.length - existingMatchIds.size,
        sampleExisting: Array.from(existingMatchIds).slice(0, 5),
        sampleNew: uniqueMatchIds.filter(id => !existingMatchIds.has(id)).slice(0, 5)
      }
    })

    // Step 3: Process each match by calling /predict (same pattern as enrichment)
    let created = 0
    let existing = 0
    let errors = 0
    const errorDetails: string[] = []
    
    // Timeout protection: Stop processing before route timeout
    // Leave 60 seconds buffer for cleanup and response
    const MAX_PROCESSING_TIME = 240000 // 4 minutes (240 seconds)
    let timeoutReached = false

    // Helper function to extract prediction data (same as enrichment)
    const toValueRating = (conf: number): "Very High"|"High"|"Medium"|"Low" => {
      if (conf >= 0.6) return "Very High"
      if (conf >= 0.4) return "High"
      if (conf >= 0.25) return "Medium"
      return "Low"
    }

    const probToImpliedOdds = (pred?: {home_win?: number; draw?: number; away_win?: number}) => {
      if (!pred) return null
      const safe = (p?: number) => p && p > 0 ? +(1/p).toFixed(2) : null
      return {
        home: safe(pred.home_win),
        draw: safe(pred.draw),
        away: safe(pred.away_win),
      }
    }

    // Rate limiting helper
    const delay = (ms: number): Promise<void> => {
      return new Promise(resolve => setTimeout(resolve, ms))
    }

    for (let i = 0; i < uniqueMatchIds.length; i++) {
      // Check if we're approaching timeout
      const elapsedTime = Date.now() - startTime
      if (elapsedTime > MAX_PROCESSING_TIME) {
        timeoutReached = true
        logger.warn('⏰ Approaching timeout limit, stopping match processing', {
          tags: ['api', 'admin', 'global-sync', 'timeout'],
          data: {
            processed: i,
            total: uniqueMatchIds.length,
            created,
            existing,
            errors,
            elapsedTime: `${elapsedTime}ms`,
            remainingMatches: uniqueMatchIds.length - i
          }
        })
        break
      }
      
      const matchIdStr = uniqueMatchIds[i]
      const matchId = parseInt(matchIdStr)
      const requestStartTime = Date.now()
      
      try {
        logger.info(`🔄 Processing match ${i + 1}/${uniqueMatchIds.length} - Match ID: ${matchId}`, {
          tags: ['api', 'admin', 'global-sync'],
          data: { 
            matchId, 
            matchIdStr,
            progress: `${i + 1}/${uniqueMatchIds.length}`,
            status: 'checking'
          }
        })

        // Check if QuickPurchase already exists
        if (existingMatchIds.has(matchIdStr)) {
          existing++
          logger.info(`⏭️ SKIP: Match ID ${matchId} already exists in QuickPurchase database`, {
            tags: ['api', 'admin', 'global-sync'],
            data: { 
              matchId,
              matchIdStr,
              status: 'exists',
              progress: `${i + 1}/${uniqueMatchIds.length}`,
              summary: `Skipped ${existing} existing, ${created} created, ${errors} errors`
            }
          })
          // Small delay even for skipped matches to prevent overwhelming
          await delay(50)
          continue
        }

        // Rate limiting: Wait before each /predict call (except first one)
        // User mentioned ~500ms response time, so we add delay to prevent overwhelming
        if (i > 0) {
          await delay(300)
        }

        // Call /predict endpoint to get complete match + prediction data
        logger.info(`📡 Calling /predict API for Match ID: ${matchId}`, {
          tags: ['api', 'admin', 'global-sync'],
          data: { 
            matchId,
            matchIdStr,
            backendUrl: `${process.env.BACKEND_URL}/predict`,
            status: 'fetching',
            progress: `${i + 1}/${uniqueMatchIds.length}`
          }
        })

        const predictStartTime = Date.now()
        let predictResponse: Response
        let predictResponseTime: number
        
        try {
          // Call /predict API - await ensures we wait for response before proceeding
          predictResponse = await fetch(`${process.env.BACKEND_URL}/predict`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.BACKEND_API_KEY}`
            },
            body: JSON.stringify({
              match_id: matchId,
              include_analysis: true // Include full analysis for complete data
            }),
            signal: AbortSignal.timeout(30000) // 30 second timeout - will throw if exceeded
          })
          
          predictResponseTime = Date.now() - predictStartTime
          logger.info(`📥 Received /predict response for Match ID: ${matchId}`, {
            tags: ['api', 'admin', 'global-sync'],
            data: {
              matchId,
              matchIdStr,
              status: predictResponse.ok ? 'success' : 'failed',
              httpStatus: predictResponse.status,
              responseTime: `${predictResponseTime}ms`,
              progress: `${i + 1}/${uniqueMatchIds.length}`
            }
          })
        } catch (fetchError) {
          predictResponseTime = Date.now() - predictStartTime
          const isTimeout = fetchError instanceof Error && 
                           (fetchError.name === 'AbortError' || fetchError.message.includes('timeout'))
          
          errors++
          const errorMessage = isTimeout 
            ? `Request timeout after ${predictResponseTime}ms (30s limit exceeded)`
            : fetchError instanceof Error ? fetchError.message : String(fetchError)
          
          logger.error(`❌ FAILED: Match ID ${matchId} - /predict API call failed`, {
            tags: ['api', 'admin', 'global-sync', 'error'],
            data: { 
              matchId,
              matchIdStr,
              status: isTimeout ? 'timeout' : 'fetch_error',
              error: errorMessage,
              responseTime: `${predictResponseTime}ms`,
              progress: `${i + 1}/${uniqueMatchIds.length}`,
              summary: `${errors} errors, ${created} created, ${existing} existing`
            }
          })
          errorDetails.push(`Match ${matchId}: ${errorMessage}`)
          // Wait before processing next match even on error
          await delay(200)
          continue
        }

        if (!predictResponse.ok) {
          const errorText = await predictResponse.text()
          errors++
          logger.error(`❌ FAILED: Match ID ${matchId} - /predict API returned ${predictResponse.status}`, {
            tags: ['api', 'admin', 'global-sync', 'error'],
            data: { 
              matchId,
              matchIdStr,
              status: 'failed',
              httpStatus: predictResponse.status,
              statusText: predictResponse.statusText,
              errorText: errorText.substring(0, 200),
              responseTime: `${predictResponseTime}ms`,
              progress: `${i + 1}/${uniqueMatchIds.length}`,
              summary: `${errors} errors, ${created} created, ${existing} existing`
            }
          })
          errorDetails.push(`Match ${matchId}: /predict returned ${predictResponse.status} - ${errorText.substring(0, 100)}`)
          // Wait before processing next match even on error
          await delay(200)
          continue
        }

        // Parse response JSON - await ensures we wait for parsing to complete
        const parseStartTime = Date.now()
        let prediction: any
        try {
          prediction = await predictResponse.json()
        } catch (parseError) {
          const parseTime = Date.now() - parseStartTime
          errors++
          const parseErrorMessage = parseError instanceof Error ? parseError.message : String(parseError)
          logger.error(`❌ FAILED: Match ID ${matchId} - Failed to parse /predict response JSON`, {
            tags: ['api', 'admin', 'global-sync', 'error'],
            data: {
              matchId,
              matchIdStr,
              status: 'parse_error',
              error: parseErrorMessage,
              responseTime: `${predictResponseTime}ms`,
              parseTime: `${parseTime}ms`,
              progress: `${i + 1}/${uniqueMatchIds.length}`,
              summary: `${errors} errors, ${created} created, ${existing} existing`
            }
          })
          errorDetails.push(`Match ${matchId}: JSON parse error - ${parseErrorMessage}`)
          await delay(200)
          continue
        }
        const parseTime = Date.now() - parseStartTime

        if (!prediction || !prediction.match_info) {
          errors++
          logger.error(`❌ FAILED: Match ID ${matchId} - Invalid prediction response (missing match_info)`, {
            tags: ['api', 'admin', 'global-sync', 'error'],
            data: { 
              matchId,
              matchIdStr,
              status: 'invalid_response',
              hasPrediction: !!prediction,
              hasMatchInfo: !!prediction?.match_info,
              predictionKeys: prediction ? Object.keys(prediction) : [],
              responseTime: `${predictResponseTime}ms`,
              parseTime: `${parseTime}ms`,
              progress: `${i + 1}/${uniqueMatchIds.length}`,
              summary: `${errors} errors, ${created} created, ${existing} existing`
            }
          })
          errorDetails.push(`Match ${matchId}: Invalid prediction response - missing match_info`)
          // Wait before processing next match even on error
          await delay(200)
          continue
        }

        // Extract match information from prediction response
        const matchInfo = prediction.match_info
        const matchName = matchInfo.home_team && matchInfo.away_team
          ? `${matchInfo.home_team} vs ${matchInfo.away_team}`
          : `Match ${matchId}`

        // Extract prediction details (same logic as enrichment)
        const confidence = prediction.predictions?.confidence ?? 
                          prediction.comprehensive_analysis?.ml_prediction?.confidence ?? 
                          0
        
        const predictionType = prediction.predictions?.recommended_bet ?? 
                              prediction.comprehensive_analysis?.ai_verdict?.recommended_outcome?.toLowerCase().replace(' ', '_') ?? 
                              'no_prediction'
        
        const confidenceScore = Math.round(confidence * 100)
        const valueRating = toValueRating(confidence)
        const odds = probToImpliedOdds(prediction.predictions)
        const analysisSummary = prediction.analysis?.explanation ?? 
                               prediction.comprehensive_analysis?.ai_verdict?.confidence_level ?? 
                               'AI prediction available'

        // Create QuickPurchase record with complete data (match + prediction)
        const quickPurchaseData = {
          name: matchName,
          price: 9.99, // Default pricing - can be adjusted per country later
          originalPrice: 19.99,
          description: matchInfo.home_team && matchInfo.away_team
            ? `AI prediction for ${matchInfo.home_team} vs ${matchInfo.away_team}`
            : `AI prediction for match ${matchId}`,
          features: ['AI Analysis', 'Match Statistics', 'Risk Assessment'],
          type: 'prediction',
          iconName: 'Brain',
          colorGradientFrom: '#3B82F6',
          colorGradientTo: '#1D4ED8',
          countryId: defaultCountry.id,
          matchId: matchIdStr,
          matchData: {
            ...matchInfo,
            source: 'global_sync',
            sync_timestamp: new Date().toISOString()
          },
          predictionData: prediction, // Store complete prediction data
          predictionType: predictionType,
          confidenceScore: confidenceScore,
          odds: odds?.home || null,
          valueRating: valueRating,
          analysisSummary: analysisSummary,
          isPredictionActive: true,
          isActive: true
        }

        // Save to database
        logger.info(`💾 Saving Match ID ${matchId} to database...`, {
          tags: ['api', 'admin', 'global-sync'],
          data: {
            matchId,
            matchIdStr,
            name: matchName,
            status: 'saving',
            progress: `${i + 1}/${uniqueMatchIds.length}`
          }
        })

        const dbStartTime = Date.now()
        try {
          await prisma.quickPurchase.create({ data: quickPurchaseData })
          const dbTime = Date.now() - dbStartTime
          const totalRequestTime = Date.now() - requestStartTime
          created++

          logger.info(`✅ SUCCESS: Match ID ${matchId} created in QuickPurchase database`, {
            tags: ['api', 'admin', 'global-sync'],
            data: { 
              matchId,
              matchIdStr,
              name: matchName,
              predictionType,
              confidenceScore,
              valueRating,
              dbTime: `${dbTime}ms`,
              totalTime: `${totalRequestTime}ms`,
              progress: `${i + 1}/${uniqueMatchIds.length}`,
              summary: `${created} created, ${existing} existing, ${errors} errors`
            }
          })
        } catch (dbError) {
          const dbTime = Date.now() - dbStartTime
          const dbErrorMessage = dbError instanceof Error ? dbError.message : String(dbError)
          errors++
          logger.error(`❌ DATABASE ERROR: Failed to create QuickPurchase for Match ID ${matchId}`, {
            tags: ['api', 'admin', 'global-sync', 'error'],
            data: {
              matchId,
              matchIdStr,
              status: 'database_error',
              error: dbErrorMessage,
              dbTime: `${dbTime}ms`,
              quickPurchaseData: {
                name: quickPurchaseData.name,
                matchId: quickPurchaseData.matchId,
                hasMatchData: !!quickPurchaseData.matchData,
                hasPredictionData: !!quickPurchaseData.predictionData
              },
              progress: `${i + 1}/${uniqueMatchIds.length}`,
              summary: `${errors} errors, ${created} created, ${existing} existing`
            }
          })
          errorDetails.push(`Match ${matchId}: Database error - ${dbErrorMessage}`)
          // Wait before processing next match even on error
          await delay(200)
          continue
        }

        // Rate limiting: Wait after successful creation to prevent overwhelming
        // User mentioned ~500ms response time, so we ensure proper spacing
        await delay(500)

      } catch (error) {
        const errorTime = Date.now() - requestStartTime
        const errorMessage = error instanceof Error ? error.message : String(error)
        
        logger.error('Error processing match', {
          tags: ['api', 'admin', 'global-sync', 'error'],
          data: {
            matchId: matchIdStr,
            error: errorMessage,
            requestTime: `${errorTime}ms`
          }
        })
        
        errors++
        errorDetails.push(`Match ${matchIdStr}: ${errorMessage}`)
      }
    }

    const processingTime = Date.now() - startTime
    const totalProcessed = created + existing
    const totalAvailable = uniqueMatchIds.length
    const coverage = totalAvailable > 0 
      ? ((totalProcessed / totalAvailable) * 100).toFixed(1)
      : '0.0'

    logger.info('Global sync completed', {
      tags: ['api', 'admin', 'global-sync', 'completed'],
      data: {
        available: totalAvailable,
        created,
        existing,
        errors,
        coverage: `${coverage}%`,
        processingTimeMs: processingTime,
        processingTimeMin: (processingTime / 60000).toFixed(2),
        dateRange: `${fromDate} to ${toDate}`,
        timeoutReached: timeoutReached,
        partialSync: timeoutReached
      }
    })

    // Return comprehensive results
    return NextResponse.json({
      success: true,
      summary: {
        available: totalAvailable,
        created,
        existing,
        errors,
        totalProcessed,
        coverage: `${coverage}%`,
        processingTime: {
          milliseconds: processingTime,
          minutes: (processingTime / 60000).toFixed(2)
        },
        dateRange: `${fromDate} to ${toDate}`,
        source: 'consensus_api_with_predict'
      },
      message: timeoutReached
        ? `Sync partially completed due to timeout. ${created} new matches created, ${existing} already existed, ${errors} errors. Remaining matches will be processed on next sync.`
        : errors > 0 
        ? `Sync completed with ${errors} errors. ${created} new matches created (with full prediction data), ${existing} already existed.`
        : `Sync completed successfully! ${created} new matches created (with full prediction data), ${existing} already existed.`,
      errorDetails: errors > 0 ? errorDetails.slice(0, 10) : [], // Limit error details
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    const processingTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    logger.error('Global sync failed with unexpected error', {
      tags: ['api', 'admin', 'global-sync', 'error'],
      data: { 
        error: errorMessage,
        processingTimeMs: processingTime,
        stack: error instanceof Error ? error.stack : undefined
      }
    })

    return NextResponse.json({
      success: false,
      error: 'Global sync failed',
      details: errorMessage,
      processingTime: {
        milliseconds: processingTime,
        minutes: (processingTime / 60000).toFixed(2)
      },
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

/**
 * GET endpoint to check sync status and statistics
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current QuickPurchase statistics
    const totalQuickPurchases = await prisma.quickPurchase.count({
      where: { matchId: { not: null } }
    })

    const activeQuickPurchases = await prisma.quickPurchase.count({
      where: { 
        matchId: { not: null },
        isActive: true
      }
    })

    const withPredictionData = await prisma.quickPurchase.count({
      where: {
        matchId: { not: null },
        predictionData: { not: null }
      }
    })

    // Get latest sync info (approximate based on creation time)
    const latestQuickPurchase = await prisma.quickPurchase.findFirst({
      where: { matchId: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    })

    return NextResponse.json({
      success: true,
      statistics: {
        totalMatches: totalQuickPurchases,
        activeMatches: activeQuickPurchases,
        withPredictionData,
        withoutPredictionData: totalQuickPurchases - withPredictionData,
        lastSync: latestQuickPurchase?.createdAt || null
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    logger.error('Failed to get sync statistics', {
      tags: ['api', 'admin', 'global-sync', 'error'],
      data: { error: errorMessage }
    })

    return NextResponse.json({
      success: false,
      error: 'Failed to get sync statistics',
      details: errorMessage
    }, { status: 500 })
  }
}
