import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Get query parameters
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const league = searchParams.get('league') || ''
    const status = searchParams.get('status') || ''
    const result = searchParams.get('result') || ''
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''

    // Calculate offset
    const offset = (page - 1) * limit

    // Build where clause for QuickPurchase - only show prediction type records with proper data
    const where: any = {
      type: 'prediction', // Only prediction type records
      matchData: {
        not: null // Must have match data
      },
      predictionData: {
        not: null // Must have prediction data
      },
      confidenceScore: {
        not: null,
        gt: 0 // Confidence must be greater than 0
      }
    }

    // Search filter - search in name (which contains team names) and matchData
    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: 'insensitive'
          }
        }
      ]
    }

    // League filter - will be applied in post-processing since league info is in JSON
    // Status filter - will be applied in post-processing since status info is in JSON  
    // Result filter - will be calculated and filtered in post-processing

    // Date range filter
    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) where.createdAt.gte = new Date(dateFrom)
      if (dateTo) where.createdAt.lte = new Date(dateTo)
    }

    // Get all QuickPurchase records first, then filter by match date and other criteria
    const allQuickPurchases = await prisma.quickPurchase.findMany({
      where,
      orderBy: {
        [sortBy]: sortOrder as 'asc' | 'desc'
      }
    })

    // Filter for completed matches (past date) and apply additional filters
    const filteredQuickPurchases = allQuickPurchases.filter(qp => {
      const matchData = qp.matchData as any
      
      if (!matchData || !matchData.date) return false
      
      // Only show matches that have already occurred (24 hours buffer to account for timezone issues)
      const matchDate = new Date(matchData.date)
      const now = new Date()
      const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000))
      
      if (matchDate >= oneDayAgo) return false
      
      // League filter
      if (league && matchData.league && !matchData.league.toLowerCase().includes(league.toLowerCase())) {
        return false
      }
      
      // Status filter (for this case, most matches will be "awaiting results")
      if (status && status !== 'all') {
        const matchStatus = matchData.status || matchData.status_short || 'unknown'
        const isFinished = matchData.is_finished === true || matchStatus === 'finished' || matchData.status_short === 'FT'
        
        if (status === 'finished' && !isFinished) return false
        if (status === 'cancelled' && matchStatus !== 'cancelled') return false
      }
      
      return true
    })

    // Get total count for pagination
    const totalCount = filteredQuickPurchases.length

    // Apply pagination to filtered results
    const paginatedQuickPurchases = filteredQuickPurchases.slice(offset, offset + limit)

    // Transform QuickPurchase data to match frontend expectations
    const transformedPredictions = paginatedQuickPurchases.map(qp => {
      const matchData = qp.matchData as any
      const predictionData = qp.predictionData as any
      
      // Extract team names from the QuickPurchase name (e.g., "Team A vs Team B")
      const teamNames = qp.name.split(' vs ')
      const homeTeamName = teamNames[0] || matchData?.home_team?.name || matchData?.home_team || 'Unknown Home'
      const awayTeamName = teamNames[1] || matchData?.away_team?.name || matchData?.away_team || 'Unknown Away'
      
      // Check if match is finished
      const isFinished = matchData?.is_finished === true || 
                        matchData?.status === 'finished' || 
                        matchData?.status_short === 'FT' ||
                        matchData?.status_short === 'AET' ||
                        matchData?.status_short === 'PEN'
      
      // Get scores from multiple possible locations
      const homeScore = matchData?.home_score ?? 
                       matchData?.final_score?.home ?? 
                       predictionData?.match?.home_score ?? 
                       predictionData?.final_score?.home ?? null
                       
      const awayScore = matchData?.away_score ?? 
                       matchData?.final_score?.away ?? 
                       predictionData?.match?.away_score ?? 
                       predictionData?.final_score?.away ?? null
      
      // Build final_result object for FinishedMatchStats component
      let finalResult = null
      if (isFinished && homeScore !== null && awayScore !== null && 
          typeof homeScore === 'number' && typeof awayScore === 'number') {
        const outcome = homeScore > awayScore ? 'H' : 
                       awayScore > homeScore ? 'A' : 'D'
        const outcomeText = outcome === 'H' ? 'Home Win' :
                           outcome === 'A' ? 'Away Win' : 'Draw'
        
        finalResult = {
          score: { home: homeScore, away: awayScore },
          outcome,
          outcome_text: outcomeText
        }
      }
      
      return {
        id: qp.id,
        matchId: qp.matchId, // Include matchId for navigation
        match: {
          id: qp.matchId || qp.id,
          homeTeam: {
            id: matchData?.home_team?.id || 'unknown',
            name: homeTeamName
          },
          awayTeam: {
            id: matchData?.away_team?.id || 'unknown', 
            name: awayTeamName
          },
          league: {
            id: matchData?.league?.id || 'unknown',
            name: matchData?.league?.name || matchData?.league || 'Unknown League'
          },
          matchDate: matchData?.date ? new Date(matchData.date).toISOString() : qp.createdAt.toISOString(),
          status: isFinished ? 'finished' : (matchData?.status || 'unknown'),
          homeScore,
          awayScore,
          // Include match statistics for finished matches
          statistics: matchData?.live_data?.statistics || matchData?.statistics || null,
          final_result: finalResult
        },
        predictionType: qp.predictionType || predictionData?.prediction_type || 'unknown',
        confidenceScore: qp.confidenceScore || predictionData?.confidence || 0,
        odds: qp.odds ? parseFloat(qp.odds.toString()) : (predictionData?.odds || null),
        valueRating: qp.valueRating || predictionData?.value_rating || 'Low',
        explanation: qp.analysisSummary || predictionData?.explanation || qp.description || 'No explanation available',
        status: 'active',
        isFree: false,
        isFeatured: qp.isPopular || false,
        showInDailyTips: false,
        showInWeeklySpecials: false,
        type: qp.type,
        matchesInAccumulator: 1,
        totalOdds: qp.odds || null,
        stake: null,
        potentialReturn: null,
        createdAt: qp.createdAt.toISOString(),
        resultUpdatedAt: qp.updatedAt.toISOString(),
        // Include full prediction data for FinishedMatchStats
        predictionData: predictionData || null,
        isFinished
      }
    })

    // Calculate result for each prediction
    const predictionsWithResults = transformedPredictions.map(prediction => {
      let result = 'pending'
      
      // Get match data from the original QuickPurchase record to access JSON fields
      const qp = paginatedQuickPurchases.find(q => q.id === prediction.id)
      const matchData = qp?.matchData as any
      const predictionData = qp?.predictionData as any
      
      // Check if match has finished (from JSON data)
      const isFinished = matchData?.is_finished === true || 
                        matchData?.status === 'finished' || 
                        matchData?.status_short === 'FT' ||
                        matchData?.status_short === 'AET' ||
                        matchData?.status_short === 'PEN'
      
      // Get scores from multiple possible locations in JSON
      const homeScore = matchData?.home_score ?? 
                       matchData?.final_score?.home ?? 
                       predictionData?.match?.home_score ?? 
                       predictionData?.final_score?.home ?? null
                       
      const awayScore = matchData?.away_score ?? 
                       matchData?.final_score?.away ?? 
                       predictionData?.match?.away_score ?? 
                       predictionData?.final_score?.away ?? null
      
      // Get prediction type from multiple sources
      const predType = prediction.predictionType || 
                      predictionData?.prediction_type || 
                      predictionData?.type || 
                      qp?.predictionType
      
      if (isFinished && homeScore !== null && awayScore !== null && 
          typeof homeScore === 'number' && typeof awayScore === 'number') {
        
        // Calculate result based on prediction type (actual scores available)
        switch (predType) {
          case 'home_win':
          case 'home':
          case '1':
            result = homeScore > awayScore ? 'won' : 'lost'
            break
          case 'away_win':
          case 'away':
          case '2':
            result = awayScore > homeScore ? 'won' : 'lost'
            break
          case 'draw':
          case 'X':
            result = homeScore === awayScore ? 'won' : 'lost'
            break
          case 'both_teams_to_score':
          case 'btts':
            result = homeScore > 0 && awayScore > 0 ? 'won' : 'lost'
            break
          case 'over_2.5':
          case 'over_25':
            result = (homeScore + awayScore) > 2.5 ? 'won' : 'lost'
            break
          case 'under_2.5':
          case 'under_25':
            result = (homeScore + awayScore) < 2.5 ? 'won' : 'lost'
            break
          case 'over_1.5':
            result = (homeScore + awayScore) > 1.5 ? 'won' : 'lost'
            break
          case 'under_1.5':
            result = (homeScore + awayScore) < 1.5 ? 'won' : 'lost'
            break
          default:
            result = 'pending_result' // Unknown prediction type with scores
        }
      } else if (matchData?.status === 'cancelled' || 
                matchData?.status === 'postponed' ||
                matchData?.status_short === 'CANC' ||
                matchData?.status_short === 'POSTP') {
        result = 'void'
      } else {
        // For past matches without results (which is most of them in this database)
        const matchDate = new Date(matchData?.date)
        const now = new Date()
        const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000))
        
        if (matchDate < oneDayAgo) {
          result = 'pending_result' // Past match awaiting result update
        } else {
          result = 'pending' // Recent/future match
        }
      }
      
      return {
        ...prediction,
        result
      }
    })

    // Filter by result if specified (apply after pagination since we already paginated)
    const finalPredictions = result 
      ? predictionsWithResults.filter(prediction => prediction.result === result)
      : predictionsWithResults

    return NextResponse.json({
      predictions: finalPredictions,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPrevPage: page > 1
      }
    })

  } catch (error) {
    console.error('Error fetching predictions history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch predictions history' },
      { status: 500 }
    )
  }
} 