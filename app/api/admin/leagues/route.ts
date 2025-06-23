import prisma from '@/lib/db'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger'

// Types for league management
type LeagueInput = {
  name: string
  countryCode?: string
  sport?: string
  isActive?: boolean
  logoUrl?: string
  externalLeagueId?: string
  isDataCollectionEnabled?: boolean
  dataCollectionPriority?: number
  syncFrequency?: string
  matchLimit?: number
  isPredictionEnabled?: boolean
}

type LeagueUpdateInput = LeagueInput & {
  id: string
}

// GET /api/admin/leagues - List all leagues
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      logger.warn('GET /api/admin/leagues - Unauthorized access attempt', {
        tags: ['api', 'admin', 'leagues', 'auth']
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const leagues = await prisma.league.findMany({
      orderBy: [
        { dataCollectionPriority: 'desc' },
        { name: 'asc' }
      ],
      include: {
        _count: {
          select: {
            matches: true,
            teams: true
          }
        }
      }
    })

    logger.info('GET /api/admin/leagues - Success', {
      tags: ['api', 'admin', 'leagues'],
      data: { count: leagues.length }
    })

    return NextResponse.json(leagues)
  } catch (error) {
    logger.error('GET /api/admin/leagues - Error', {
      tags: ['api', 'admin', 'leagues'],
      error: error instanceof Error ? error : undefined
    })
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// POST /api/admin/leagues - Create new league
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data: LeagueInput = await request.json()

    // Validate required fields
    if (!data.name) {
      return NextResponse.json(
        { error: 'League name is required' },
        { status: 400 }
      )
    }

    // Check if league name already exists
    const existingLeague = await prisma.league.findUnique({
      where: { name: data.name }
    })

    if (existingLeague) {
      return NextResponse.json(
        { error: 'League with this name already exists' },
        { status: 400 }
      )
    }

    const league = await prisma.league.create({
      data: {
        name: data.name,
        countryCode: data.countryCode,
        sport: data.sport || 'football',
        isActive: data.isActive ?? true,
        logoUrl: data.logoUrl,
        externalLeagueId: data.externalLeagueId,
        isDataCollectionEnabled: data.isDataCollectionEnabled ?? true,
        dataCollectionPriority: data.dataCollectionPriority ?? 0,
        syncFrequency: data.syncFrequency || 'daily',
        matchLimit: data.matchLimit ?? 10,
        isPredictionEnabled: data.isPredictionEnabled ?? true
      }
    })

    logger.info('POST /api/admin/leagues - League created', {
      tags: ['api', 'admin', 'leagues'],
      data: { leagueId: league.id, name: league.name }
    })

    return NextResponse.json(league, { status: 201 })
  } catch (error) {
    logger.error('POST /api/admin/leagues - Error', {
      tags: ['api', 'admin', 'leagues'],
      error: error instanceof Error ? error : undefined
    })
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/leagues - Update league
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data: LeagueUpdateInput = await request.json()

    if (!data.id) {
      return NextResponse.json(
        { error: 'League ID is required' },
        { status: 400 }
      )
    }

    // Check if league exists
    const existingLeague = await prisma.league.findUnique({
      where: { id: data.id }
    })

    if (!existingLeague) {
      return NextResponse.json(
        { error: 'League not found' },
        { status: 404 }
      )
    }

    // Check if name is being changed and if it conflicts
    if (data.name && data.name !== existingLeague.name) {
      const nameConflict = await prisma.league.findUnique({
        where: { name: data.name }
      })

      if (nameConflict) {
        return NextResponse.json(
          { error: 'League with this name already exists' },
          { status: 400 }
        )
      }
    }

    const updatedLeague = await prisma.league.update({
      where: { id: data.id },
      data: {
        name: data.name,
        countryCode: data.countryCode,
        sport: data.sport,
        isActive: data.isActive,
        logoUrl: data.logoUrl,
        externalLeagueId: data.externalLeagueId,
        isDataCollectionEnabled: data.isDataCollectionEnabled,
        dataCollectionPriority: data.dataCollectionPriority,
        syncFrequency: data.syncFrequency,
        matchLimit: data.matchLimit,
        isPredictionEnabled: data.isPredictionEnabled
      }
    })

    logger.info('PUT /api/admin/leagues - League updated', {
      tags: ['api', 'admin', 'leagues'],
      data: { leagueId: updatedLeague.id, name: updatedLeague.name }
    })

    return NextResponse.json(updatedLeague)
  } catch (error) {
    logger.error('PUT /api/admin/leagues - Error', {
      tags: ['api', 'admin', 'leagues'],
      error: error instanceof Error ? error : undefined
    })
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/leagues - Delete league
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'League ID is required' },
        { status: 400 }
      )
    }

    // Check if league exists and has related data
    const league = await prisma.league.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            matches: true,
            teams: true
          }
        }
      }
    })

    if (!league) {
      return NextResponse.json(
        { error: 'League not found' },
        { status: 404 }
      )
    }

    // Check if league has related data
    if (league._count.matches > 0 || league._count.teams > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot delete league with existing matches or teams',
          details: {
            matches: league._count.matches,
            teams: league._count.teams
          }
        },
        { status: 400 }
      )
    }

    await prisma.league.delete({
      where: { id }
    })

    logger.info('DELETE /api/admin/leagues - League deleted', {
      tags: ['api', 'admin', 'leagues'],
      data: { leagueId: id, name: league.name }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('DELETE /api/admin/leagues - Error', {
      tags: ['api', 'admin', 'leagues'],
      error: error instanceof Error ? error : undefined
    })
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
} 