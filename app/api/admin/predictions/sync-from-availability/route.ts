import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger'

/**
 * Global Sync Endpoint - Syncs all available matches from /predict/availability API
 * This solves the 94.9% data gap by ensuring all prediction-capable matches are in QuickPurchase table
 */
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
          'Authorization': `Bearer betgenius_secure_key_2024`, // Use the exact key from your working curl
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

    // Convert match IDs to match objects by fetching details
    const availableMatches = []
    
    logger.info('Fetching match details for available matches', {
      tags: ['api', 'admin', 'global-sync'],
      data: { matchesToFetch: uniqueMatchIds.length }
    })
    
    for (const matchId of uniqueMatchIds) {
      try {
        const matchResponse = await fetch(`${process.env.BACKEND_URL}/matches/${matchId}`, {
          headers: {
            'Authorization': `Bearer ${process.env.BACKEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(10000) // 10 second timeout per match
        })

        if (matchResponse.ok) {
          const matchDetails = await matchResponse.json()
          availableMatches.push({
            match_id: matchId,
            ...matchDetails
          })
        } else {
          // Create minimal match object if details fetch fails
          availableMatches.push({
            match_id: matchId,
            home_team: `Team A`,
            away_team: `Team B`,
            date: new Date().toISOString(),
            league: 'Unknown League'
          })
        }
      } catch (error) {
        logger.warn('Failed to fetch match details', {
          tags: ['api', 'admin', 'global-sync', 'warning'],
          data: { matchId, error: error instanceof Error ? error.message : String(error) }
        })
        
        // Create minimal match object on error
        availableMatches.push({
          match_id: matchId,
          home_team: `Team A`,
          away_team: `Team B`,
          date: new Date().toISOString(),
          league: 'Unknown League'
        })
      }
      
      // Small delay to prevent overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    logger.info('Processed all available match IDs', {
      tags: ['api', 'admin', 'global-sync'],
      data: { 
        totalProcessed: availableMatches.length,
        sampleMatches: availableMatches.slice(0, 3).map(m => ({
          id: m.match_id,
          teams: `${m.home_team} vs ${m.away_team}`
        }))
      }
    })
    
    if (!Array.isArray(availableMatches)) {
      logger.error('Failed to process available matches', {
        tags: ['api', 'admin', 'global-sync', 'error'],
        data: { responseType: typeof availableMatches }
      })
      return NextResponse.json({ 
        error: 'Failed to process available matches' 
      }, { status: 500 })
    }

    logger.info('Successfully processed all available matches', {
      tags: ['api', 'admin', 'global-sync'],
      data: { 
        totalMatches: availableMatches.length,
        sampleMatches: availableMatches.slice(0, 5).map(m => ({
          id: m.match_id,
          teams: `${m.home_team} vs ${m.away_team}`
        }))
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
        sampleExisting: Array.from(existingMatchIds).slice(0, 5)
      }
    })

    // Step 3: Process each available match
    let created = 0
    let existing = 0
    let errors = 0
    const errorDetails: string[] = []

    for (const match of availableMatches) {
      try {
        const matchId = match.match_id?.toString()
        
        if (!matchId) {
          logger.warn('Skipping match with missing match_id', {
            tags: ['api', 'admin', 'global-sync', 'warning'],
            data: { match }
          })
          errors++
          errorDetails.push(`Match missing match_id: ${JSON.stringify(match)}`)
          continue
        }

        // Check if QuickPurchase already exists
        if (existingMatchIds.has(matchId)) {
          existing++
          continue
        }

        // Fetch detailed match information
        logger.debug('Fetching match details', {
          tags: ['api', 'admin', 'global-sync'],
          data: { matchId }
        })

        const matchResponse = await fetch(`${process.env.BACKEND_URL}/matches/${matchId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.BACKEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          // 30 second timeout per match
          signal: AbortSignal.timeout(30000)
        })

        if (!matchResponse.ok) {
          logger.warn('Failed to fetch match details, using basic info', {
            tags: ['api', 'admin', 'global-sync', 'warning'],
            data: { 
              matchId,
              status: matchResponse.status,
              statusText: matchResponse.statusText
            }
          })
          
          // Create basic QuickPurchase with minimal data
          await prisma.quickPurchase.create({
            data: {
              name: `Match ${matchId}`,
              price: 9.99, // Default pricing
              originalPrice: 19.99,
              description: `AI prediction for match ${matchId}`,
              features: ['AI Analysis', 'Match Statistics', 'Risk Assessment'],
              type: 'prediction',
              iconName: 'Brain',
              colorGradientFrom: '#3B82F6',
              colorGradientTo: '#1D4ED8',
              countryId: defaultCountry.id,
              matchId: matchId,
              matchData: { match_id: matchId, source: 'availability_sync' },
              isPredictionActive: true,
              isActive: true
            }
          })
          
          created++
          continue
        }

        const matchDetails = await matchResponse.json()
        
        // Create comprehensive QuickPurchase record
        const quickPurchaseData = {
          name: matchDetails.home_team && matchDetails.away_team 
            ? `${matchDetails.home_team} vs ${matchDetails.away_team}`
            : `Match ${matchId}`,
          price: 9.99, // Default pricing - can be adjusted per country later
          originalPrice: 19.99,
          description: matchDetails.home_team && matchDetails.away_team
            ? `AI prediction for ${matchDetails.home_team} vs ${matchDetails.away_team}`
            : `AI prediction for match ${matchId}`,
          features: ['AI Analysis', 'Match Statistics', 'Risk Assessment'],
          type: 'prediction',
          iconName: 'Brain',
          colorGradientFrom: '#3B82F6',
          colorGradientTo: '#1D4ED8',
          countryId: defaultCountry.id,
          matchId: matchId,
          matchData: {
            ...matchDetails,
            source: 'availability_sync',
            sync_timestamp: new Date().toISOString()
          },
          isPredictionActive: true,
          isActive: true
        }

        await prisma.quickPurchase.create({ data: quickPurchaseData })
        
        logger.debug('Created QuickPurchase record', {
          tags: ['api', 'admin', 'global-sync'],
          data: { 
            matchId,
            name: quickPurchaseData.name
          }
        })
        
        created++

        // Add small delay to prevent overwhelming the external API
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error) {
        errors++
        const errorMessage = error instanceof Error ? error.message : String(error)
        errorDetails.push(`Match ${match.match_id}: ${errorMessage}`)
        
        logger.error('Error processing match', {
          tags: ['api', 'admin', 'global-sync', 'error'],
          data: { 
            matchId: match.match_id,
            error: errorMessage
          }
        })
      }
    }

    const processingTime = Date.now() - startTime
    const totalProcessed = created + existing
    const coverage = availableMatches.length > 0 
      ? ((totalProcessed / availableMatches.length) * 100).toFixed(1)
      : '0.0'

    logger.info('Global sync completed', {
      tags: ['api', 'admin', 'global-sync', 'completed'],
      data: {
        available: availableMatches.length, // Dynamic count from actual API response
        created,
        existing,
        errors,
        coverage: `${coverage}%`,
        processingTimeMs: processingTime,
        processingTimeMin: (processingTime / 60000).toFixed(2),
        dateRange: `${fromDate} to ${toDate}`
      }
    })

    // Return comprehensive results
    return NextResponse.json({
      success: true,
      summary: {
        available: availableMatches.length, // Dynamic count from actual API response
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
        source: uniqueMatchIds.length > 0 ? 'consensus_api' : 'fallback'
      },
      message: errors > 0 
        ? `Sync completed with ${errors} errors. ${created} new matches created, ${existing} already existed.`
        : `Sync completed successfully! ${created} new matches created, ${existing} already existed.`,
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
