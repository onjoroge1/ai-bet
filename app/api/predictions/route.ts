import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { Prediction, Match, Team, League } from '@prisma/client'
import { logger } from '@/lib/logger'

// Define types for better type safety
type PredictionWithRelations = Prediction & {
  match: Match & {
    homeTeam: Team
    awayTeam: Team
    league: League
  }
}

type PredictionInput = {
  match: string
  league: string
  dateTime: string
  prediction: string
  odds: string | number
  confidence: number
  analysis?: string
  valueRating?: 'Low' | 'Medium' | 'High' | 'Very High'
  isFree?: boolean
  showOnHomepage?: boolean
  showInDailyTips?: boolean
  showInWeeklySpecials?: boolean
  type?: 'single' | 'accumulator' | 'special'
  matchesInAccumulator?: any
  totalOdds?: string | number
  stake?: string | number
  potentialReturn?: string | number
  status?: string
  result?: string
}

// Helper function to validate prediction input
function validatePredictionInput(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!data.match || !data.match.includes(' vs ')) {
    errors.push('Match must be in format "Team A vs Team B"')
  }
  if (!data.league) {
    errors.push('League is required')
  }
  if (!data.dateTime || isNaN(Date.parse(data.dateTime))) {
    errors.push('Valid date and time is required')
  }
  if (!data.prediction) {
    errors.push('Prediction type is required')
  }
  if (!data.odds || isNaN(parseFloat(data.odds.toString()))) {
    errors.push('Valid odds are required')
  }
  if (!data.confidence || data.confidence < 0 || data.confidence > 100) {
    errors.push('Confidence must be between 0 and 100')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

// Helper function to create or update teams and league
async function upsertTeamsAndLeague(data: PredictionInput) {
  const [homeTeam, awayTeam] = data.match.split(' vs ').map(t => t.trim())
  
  // Create or find the league
  const league = await prisma.league.upsert({
    where: { name: data.league },
    update: {},
    create: {
      name: data.league,
      sport: 'football',
    },
  })

  // Create or find teams
  const [homeTeamRecord, awayTeamRecord] = await Promise.all([
    prisma.team.upsert({
      where: {
        name_leagueId: {
          name: homeTeam,
          leagueId: league.id,
        },
      },
      update: {},
      create: {
        name: homeTeam,
        leagueId: league.id,
      },
    }),
    prisma.team.upsert({
      where: {
        name_leagueId: {
          name: awayTeam,
          leagueId: league.id,
        },
      },
      update: {},
      create: {
        name: awayTeam,
        leagueId: league.id,
      },
    }),
  ])

  return { league, homeTeamRecord, awayTeamRecord }
}

// GET /api/predictions
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    logger.info('GET /api/predictions - Session check', { 
      tags: ['api', 'predictions'],
      data: { 
        hasSession: !!session,
        user: session?.user ? {
          id: session.user.id,
          email: session.user.email,
          role: session.user.role
        } : null
      }
    })

    if (!session?.user) {
      logger.warn('GET /api/predictions - Unauthorized: No session', {
        tags: ['api', 'predictions', 'auth']
      })
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!session.user.role || session.user.role.toLowerCase() !== 'admin') {
      logger.warn('GET /api/predictions - Unauthorized: Not admin', {
        tags: ['api', 'predictions', 'auth'],
        data: { role: session.user.role }
      })
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const predictions = await prisma.prediction.findMany({
      include: {
        match: {
          include: {
            homeTeam: true,
            awayTeam: true,
            league: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    logger.info('GET /api/predictions - Success', {
      tags: ['api', 'predictions'],
      data: { count: predictions.length }
    })

    return NextResponse.json(predictions)
  } catch (error) {
    logger.error('GET /api/predictions - Error', {
      tags: ['api', 'predictions'],
      error: error instanceof Error ? error : undefined
    })
    return new NextResponse(
      JSON.stringify({ error: 'Internal Server Error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

// POST /api/predictions
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    
    // Validate input
    const validation = validatePredictionInput(data)
    if (!validation.isValid) {
      return NextResponse.json({ error: 'Invalid input', details: validation.errors }, { status: 400 })
    }

    // Create or update teams and league
    const { league, homeTeamRecord, awayTeamRecord } = await upsertTeamsAndLeague(data)

    // Create match
    const match = await prisma.match.create({
      data: {
        homeTeamId: homeTeamRecord.id,
        awayTeamId: awayTeamRecord.id,
        leagueId: league.id,
        matchDate: new Date(data.dateTime),
        status: data.status || 'scheduled',
      },
    })

    // Create prediction
    const prediction = await prisma.prediction.create({
      data: {
        matchId: match.id,
        predictionType: data.prediction,
        confidenceScore: data.confidence,
        odds: parseFloat(data.odds.toString()),
        valueRating: data.valueRating || 'Medium',
        explanation: data.analysis,
        isFree: data.isFree ?? true,
        isFeatured: data.showOnHomepage ?? false,
        status: data.result || 'pending',
        showInDailyTips: data.showInDailyTips ?? true,
        showInWeeklySpecials: data.showInWeeklySpecials ?? false,
        type: data.type || 'single',
        matchesInAccumulator: data.matchesInAccumulator,
        totalOdds: data.totalOdds ? parseFloat(data.totalOdds.toString()) : null,
        stake: data.stake ? parseFloat(data.stake.toString()) : null,
        potentialReturn: data.potentialReturn ? parseFloat(data.potentialReturn.toString()) : null,
      },
    })

    return NextResponse.json(prediction)
  } catch (error) {
    console.error('Error creating prediction:', error)
    return NextResponse.json({ error: 'Failed to create prediction' }, { status: 500 })
  }
}

// PUT /api/predictions/:id
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { id, ...updateData } = data

    // Validate input
    const validation = validatePredictionInput(updateData)
    if (!validation.isValid) {
      return NextResponse.json({ error: 'Invalid input', details: validation.errors }, { status: 400 })
    }

    // Get existing prediction to find match ID
    const existingPrediction = await prisma.prediction.findUnique({
      where: { id },
      select: { matchId: true },
    })

    if (!existingPrediction) {
      return NextResponse.json({ error: 'Prediction not found' }, { status: 404 })
    }

    // Create or update teams and league
    const { league, homeTeamRecord, awayTeamRecord } = await upsertTeamsAndLeague(updateData)

    // Update match
    const match = await prisma.match.update({
      where: { id: existingPrediction.matchId },
      data: {
        homeTeamId: homeTeamRecord.id,
        awayTeamId: awayTeamRecord.id,
        leagueId: league.id,
        matchDate: new Date(updateData.dateTime),
        status: updateData.status || 'scheduled',
      },
    })

    // Update prediction
    const prediction = await prisma.prediction.update({
      where: { id },
      data: {
        predictionType: updateData.prediction,
        confidenceScore: updateData.confidence,
        odds: parseFloat(updateData.odds.toString()),
        valueRating: updateData.valueRating || 'Medium',
        explanation: updateData.analysis,
        isFree: updateData.isFree ?? true,
        isFeatured: updateData.showOnHomepage ?? false,
        status: updateData.result || 'pending',
        resultUpdatedAt: new Date(),
        showInDailyTips: updateData.showInDailyTips ?? true,
        showInWeeklySpecials: updateData.showInWeeklySpecials ?? false,
        type: updateData.type || 'single',
        matchesInAccumulator: updateData.matchesInAccumulator,
        totalOdds: updateData.totalOdds ? parseFloat(updateData.totalOdds.toString()) : null,
        stake: updateData.stake ? parseFloat(updateData.stake.toString()) : null,
        potentialReturn: updateData.potentialReturn ? parseFloat(updateData.potentialReturn.toString()) : null,
      },
    })

    return NextResponse.json(prediction)
  } catch (error) {
    console.error('Error updating prediction:', error)
    return NextResponse.json({ error: 'Failed to update prediction' }, { status: 500 })
  }
}

// DELETE /api/predictions/:id
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Prediction ID is required' }, { status: 400 })
    }

    // Get match ID before deleting prediction
    const prediction = await prisma.prediction.findUnique({
      where: { id },
      select: { matchId: true },
    })

    if (!prediction) {
      return NextResponse.json({ error: 'Prediction not found' }, { status: 404 })
    }

    // Delete prediction
    await prisma.prediction.delete({
      where: { id },
    })

    // Delete match if no other predictions are using it
    const remainingPredictions = await prisma.prediction.count({
      where: { matchId: prediction.matchId },
    })

    if (remainingPredictions === 0) {
      await prisma.match.delete({
        where: { id: prediction.matchId },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting prediction:', error)
    return NextResponse.json({ error: 'Failed to delete prediction' }, { status: 500 })
  }
} 