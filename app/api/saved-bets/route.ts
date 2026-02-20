import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { Prisma } from '@prisma/client'

/**
 * GET /api/saved-bets
 * Returns the current user's saved bets with optional status filter.
 * Query params: status (pending | won | lost | void | partial), limit, offset
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const limit = parseInt(searchParams.get('limit') ?? '50', 10)
    const offset = parseInt(searchParams.get('offset') ?? '0', 10)

    const where: Prisma.SavedBetWhereInput = {
      userId: session.user.id,
      ...(status ? { status } : {}),
    }

    const [bets, total] = await prisma.$transaction([
      prisma.savedBet.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.savedBet.count({ where }),
    ])

    return NextResponse.json({ bets, total, limit, offset })
  } catch (error) {
    console.error('[GET /api/saved-bets]', error)
    return NextResponse.json({ error: 'Failed to fetch saved bets' }, { status: 500 })
  }
}

/**
 * POST /api/saved-bets
 * Creates a new saved bet.
 *
 * Body: {
 *   name?: string,
 *   betType: 'single' | 'parlay' | 'roundrobin',
 *   totalOdds: number,
 *   stake?: number,
 *   sportsbook?: string,
 *   notes?: string,
 *   items: Array<{
 *     matchId: string, pick: string, odds: number,
 *     league?: string, market?: string,
 *     homeTeam?: string, awayTeam?: string
 *   }>
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, betType, totalOdds, stake, sportsbook, notes, items } = body

    if (!totalOdds || !items?.length) {
      return NextResponse.json({ error: 'totalOdds and items are required' }, { status: 400 })
    }

    const potentialReturn = stake ? stake * totalOdds : null

    const savedBet = await prisma.savedBet.create({
      data: {
        userId: session.user.id,
        name: name ?? null,
        betType: betType ?? 'single',
        totalOdds: new Prisma.Decimal(totalOdds),
        stake: stake ? new Prisma.Decimal(stake) : null,
        potentialReturn: potentialReturn ? new Prisma.Decimal(potentialReturn) : null,
        sportsbook: sportsbook ?? null,
        notes: notes ?? null,
        items,
        status: 'pending',
      },
    })

    return NextResponse.json(savedBet, { status: 201 })
  } catch (error) {
    console.error('[POST /api/saved-bets]', error)
    return NextResponse.json({ error: 'Failed to save bet' }, { status: 500 })
  }
}

/**
 * PATCH /api/saved-bets
 * Updates a saved bet (stake, status, notes, actualReturn).
 *
 * Body: { id: string, stake?: number, status?: string, notes?: string, actualReturn?: number }
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, stake, status, notes, actualReturn } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    // Verify ownership
    const existing = await prisma.savedBet.findUnique({ where: { id } })
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const updated = await prisma.savedBet.update({
      where: { id },
      data: {
        ...(stake !== undefined ? { stake: new Prisma.Decimal(stake), potentialReturn: new Prisma.Decimal(stake * Number(existing.totalOdds)) } : {}),
        ...(status ? { status, ...(status !== 'pending' ? { settledAt: new Date() } : {}) } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(actualReturn !== undefined ? { actualReturn: new Prisma.Decimal(actualReturn) } : {}),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[PATCH /api/saved-bets]', error)
    return NextResponse.json({ error: 'Failed to update bet' }, { status: 500 })
  }
}

/**
 * DELETE /api/saved-bets
 * Deletes a saved bet by id.
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const existing = await prisma.savedBet.findUnique({ where: { id } })
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await prisma.savedBet.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/saved-bets]', error)
    return NextResponse.json({ error: 'Failed to delete bet' }, { status: 500 })
  }
}

