import prisma from '@/lib/db'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger'

// GET /api/admin/leagues/[id]/stats - Get sync and prediction stats for a league
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

    // Find the league with related data
    const league = await prisma.league.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            matches: true,
            teams: true
          }
        },
        matches: {
          include: {
            _count: {
              select: {
                predictions: true
              }
            },
            homeTeam: true,
            awayTeam: true
          },
          orderBy: {
            matchDate: 'desc'
          },
          take: 10 // Get last 10 matches for recent activity
        }
      }
    })

    if (!league) {
      return NextResponse.json(
        { error: 'League not found' },
        { status: 404 }
      )
    }

    // Calculate prediction statistics
    const totalPredictions = await prisma.prediction.count({
      where: {
        match: {
          leagueId: id
        }
      }
    })

    const successfulPredictions = await prisma.prediction.count({
      where: {
        match: {
          leagueId: id
        },
        status: 'won'
      }
    })

    const pendingPredictions = await prisma.prediction.count({
      where: {
        match: {
          leagueId: id
        },
        status: 'pending'
      }
    })

    const winRate = totalPredictions > 0 ? (successfulPredictions / totalPredictions) * 100 : 0

    // Get recent sync activity
    const recentMatches = league.matches.map(match => ({
      id: match.id,
      homeTeam: (match as any).homeTeam?.name || 'Unknown',
      awayTeam: (match as any).awayTeam?.name || 'Unknown',
      matchDate: match.matchDate,
      status: match.status,
      predictionsCount: match._count.predictions
    }))

    // Calculate sync health
    const now = new Date()
    const lastSync = league.lastDataSync
    const syncFrequency = league.syncFrequency || 'daily'
    
    let syncHealth = 'unknown'
    let nextSyncDue = null
    
    if (lastSync) {
      const hoursSinceLastSync = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60)
      
      switch (syncFrequency) {
        case 'hourly':
          syncHealth = hoursSinceLastSync <= 1 ? 'healthy' : hoursSinceLastSync <= 2 ? 'warning' : 'critical'
          nextSyncDue = new Date(lastSync.getTime() + 60 * 60 * 1000)
          break
        case 'daily':
          syncHealth = hoursSinceLastSync <= 24 ? 'healthy' : hoursSinceLastSync <= 48 ? 'warning' : 'critical'
          nextSyncDue = new Date(lastSync.getTime() + 24 * 60 * 60 * 1000)
          break
        case 'weekly':
          syncHealth = hoursSinceLastSync <= 168 ? 'healthy' : hoursSinceLastSync <= 336 ? 'warning' : 'critical'
          nextSyncDue = new Date(lastSync.getTime() + 7 * 24 * 60 * 60 * 1000)
          break
        default:
          syncHealth = 'unknown'
      }
    }

    const stats = {
      league: {
        id: league.id,
        name: league.name,
        countryCode: league.countryCode,
        sport: league.sport,
        isActive: league.isActive,
        externalLeagueId: league.externalLeagueId,
        isDataCollectionEnabled: league.isDataCollectionEnabled,
        dataCollectionPriority: league.dataCollectionPriority,
        syncFrequency: league.syncFrequency,
        matchLimit: league.matchLimit,
        isPredictionEnabled: league.isPredictionEnabled,
        lastDataSync: league.lastDataSync?.toISOString() || null,
        createdAt: league.createdAt?.toISOString(),
        updatedAt: league.updatedAt?.toISOString()
      },
      counts: {
        totalMatches: league._count.matches,
        totalTeams: league._count.teams,
        totalPredictions,
        successfulPredictions,
        pendingPredictions,
        failedPredictions: totalPredictions - successfulPredictions - pendingPredictions
      },
      performance: {
        winRate: Math.round(winRate * 100) / 100,
        averagePredictionsPerMatch: league._count.matches > 0 
          ? Math.round((totalPredictions / league._count.matches) * 100) / 100 
          : 0
      },
      sync: {
        health: syncHealth,
        lastSync: league.lastDataSync?.toISOString() || null,
        nextSyncDue: nextSyncDue?.toISOString() || null,
        frequency: syncFrequency
      },
      recentActivity: {
        recentMatches,
        lastMatchDate: recentMatches.length > 0 ? recentMatches[0].matchDate?.toISOString() : null
      }
    }

    logger.info('GET /api/admin/leagues/[id]/stats - Stats retrieved', {
      tags: ['api', 'admin', 'leagues', 'stats'],
      data: { 
        leagueId: id, 
        leagueName: league.name,
        totalMatches: stats.counts.totalMatches,
        totalPredictions: stats.counts.totalPredictions
      }
    })

    return NextResponse.json(stats)

  } catch (error) {
    logger.error('GET /api/admin/leagues/[id]/stats - Error', {
      tags: ['api', 'admin', 'leagues', 'stats'],
      error: error instanceof Error ? error : undefined
    })
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
} 