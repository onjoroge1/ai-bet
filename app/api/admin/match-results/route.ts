import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { MatchResultsService } from '@/lib/services/match-results.service'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'fetch':
        // Fetch new matches from RapidAPI
        const matches = await MatchResultsService.fetchCompletedMatches()
        await MatchResultsService.storeCompletedMatches(matches)
        
        return NextResponse.json({
          success: true,
          message: `Fetched ${matches.length} completed matches`,
          count: matches.length
        })

      case 'sync':
        // Sync matches to breaking news
        await MatchResultsService.syncToBreakingNews()
        
        return NextResponse.json({
          success: true,
          message: 'Synced completed matches to breaking news'
        })

      case 'cleanup':
        // Clean up expired news
        await MatchResultsService.cleanupExpiredNews()
        
        return NextResponse.json({
          success: true,
          message: 'Cleaned up expired breaking news'
        })

      case 'list':
        // Get list of completed matches
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '20')
        const result = await MatchResultsService.getCompletedMatches(page, limit)
        
        return NextResponse.json(result)

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error in match results API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'manual-sync':
        // Manual sync of all actions
        const matches = await MatchResultsService.fetchCompletedMatches()
        await MatchResultsService.storeCompletedMatches(matches)
        await MatchResultsService.syncToBreakingNews()
        await MatchResultsService.cleanupExpiredNews()
        
        return NextResponse.json({
          success: true,
          message: 'Manual sync completed successfully',
          matchesFetched: matches.length
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error in match results API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
