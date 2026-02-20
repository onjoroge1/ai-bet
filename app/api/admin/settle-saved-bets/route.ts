import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { Prisma } from '@prisma/client'

/**
 * GET|POST /api/admin/settle-saved-bets
 *
 * Cron job: loops over pending SavedBets whose match items have a finalResult
 * set on the QuickPurchase / Match table and settles them as won / lost / partial.
 *
 * Called by Vercel cron every 30 minutes (see vercel.json).
 */
async function handleRequest() {
  const pendingBets = await prisma.savedBet.findMany({
    where: { status: 'pending' },
    orderBy: { createdAt: 'asc' },
    take: 500,
  })

  let settled = 0
  let errors = 0

  for (const bet of pendingBets) {
    try {
      const items = bet.items as Array<{
        matchId: string
        pick: string
        odds: number
        result?: string // "won" | "lost" | "void" – filled in below
      }>

      let allSettled = true
      let allWon = true
      let anyLost = false
      let anyVoid = false

      const updatedItems = await Promise.all(
        items.map(async (item) => {
          if (item.result) return item // already settled in a previous run

          // Look up the match result in QuickPurchase (preferred) or Match
          const qp = await prisma.quickPurchase.findFirst({
            where: { matchId: item.matchId },
            select: { finalResult: true, prediction: true },
          })

          const finalResult = qp?.finalResult as string | null | undefined

          if (!finalResult) {
            allSettled = false
            return item
          }

          // Normalise the result string and compare to the stored pick
          const normResult = finalResult.trim().toLowerCase()
          const normPick = item.pick.trim().toLowerCase()

          let result: 'won' | 'lost' | 'void'
          if (normResult === 'void' || normResult === 'cancelled') {
            result = 'void'
            anyVoid = true
          } else if (normPick === normResult || normResult.includes(normPick) || normPick.includes(normResult)) {
            result = 'won'
          } else {
            result = 'lost'
            anyLost = true
            allWon = false
          }

          return { ...item, result }
        })
      )

      if (!allSettled) continue // at least one match not yet finished

      let betStatus: string
      if (anyLost) {
        betStatus = 'lost'
      } else if (allWon && !anyVoid) {
        betStatus = 'won'
      } else if (anyVoid && !anyLost) {
        betStatus = allWon ? 'won' : 'partial'
      } else {
        betStatus = 'partial'
      }

      // Calculate actual return for won bets
      let actualReturn: Prisma.Decimal | null = null
      if ((betStatus === 'won' || betStatus === 'partial') && bet.stake) {
        // For partial parlays (some void legs), recalculate odds without voided legs
        const effectiveItems = updatedItems.filter((i) => i.result !== 'void')
        const effectiveOdds = effectiveItems.reduce((acc, i) => acc * i.odds, 1)
        actualReturn = new Prisma.Decimal(Number(bet.stake) * effectiveOdds)
      }

      await prisma.savedBet.update({
        where: { id: bet.id },
        data: {
          status: betStatus,
          items: updatedItems,
          settledAt: new Date(),
          ...(actualReturn ? { actualReturn } : {}),
        },
      })

      settled++
    } catch (_err) {
      console.error(`[settle-saved-bets] Error settling bet ${bet.id}:`, _err)
      errors++
    }
  }

  return { processed: pendingBets.length, settled, errors }
}

export async function GET(_req: NextRequest) {
  const apiKey = _req.headers.get('x-api-key')
  if (apiKey !== process.env.CRON_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await handleRequest()
  return NextResponse.json(result)
}

export async function POST(_req: NextRequest) {
  const apiKey = _req.headers.get('x-api-key')
  if (apiKey !== process.env.CRON_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await handleRequest()
  return NextResponse.json(result)
}

