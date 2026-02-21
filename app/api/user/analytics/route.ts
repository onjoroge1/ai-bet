import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/db"
import { logger } from "@/lib/logger"

// Prevent static generation
export const dynamic = 'force-dynamic'

/**
 * GET /api/user/analytics
 * Returns aggregated betting performance data for the authenticated user,
 * computed from the SavedBet table.
 *
 * Query params:
 *  - timeframe: "week" | "month" | "year" | "all"  (default: "month")
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const timeframe = (searchParams.get("timeframe") ?? "month") as
      | "week"
      | "month"
      | "year"
      | "all"

    // Compute the cutoff date
    const now = new Date()
    let cutoff: Date | null = null
    if (timeframe === "week") {
      cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    } else if (timeframe === "month") {
      cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    } else if (timeframe === "year") {
      cutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
    }

    const whereClause = {
      userId: session.user.id,
      ...(cutoff ? { createdAt: { gte: cutoff } } : {}),
    }

    // Fetch all bets in the window
    const bets = await prisma.savedBet.findMany({
      where: whereClause,
      select: {
        id: true,
        betType: true,
        status: true,
        totalOdds: true,
        stake: true,
        potentialReturn: true,
        actualReturn: true,
        items: true,
        createdAt: true,
        settledAt: true,
      },
      orderBy: { createdAt: "desc" },
    })

    const total = bets.length
    const won = bets.filter(b => b.status === "won").length
    const lost = bets.filter(b => b.status === "lost").length
    const pending = bets.filter(b => b.status === "pending").length
    const voided = bets.filter(b => b.status === "void").length

    const totalStake = bets.reduce((acc, b) => acc + Number(b.stake ?? 0), 0)
    const totalReturn = bets
      .filter(b => b.status === "won")
      .reduce((acc, b) => acc + Number(b.actualReturn ?? 0), 0)

    const winRate = total > 0 ? Math.round((won / Math.max(won + lost, 1)) * 100) : 0
    const roi = totalStake > 0 ? ((totalReturn - totalStake) / totalStake) * 100 : 0

    // Average odds
    const settledBets = bets.filter(b => b.status !== "pending")
    const avgOdds =
      settledBets.length > 0
        ? settledBets.reduce((acc, b) => acc + Number(b.totalOdds ?? 0), 0) /
          settledBets.length
        : 0

    // Best/current streak
    let bestStreak = 0
    let currentStreak = 0
    let tempStreak = 0
    const settled = bets
      .filter(b => b.status === "won" || b.status === "lost")
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

    for (const bet of settled) {
      if (bet.status === "won") {
        tempStreak++
        bestStreak = Math.max(bestStreak, tempStreak)
      } else {
        tempStreak = 0
      }
    }
    // Current streak = trailing wins
    for (let i = settled.length - 1; i >= 0; i--) {
      if (settled[i].status === "won") currentStreak++
      else break
    }

    // Monthly breakdown (last 6 months)
    const monthlyMap: Record<string, { profit: number; bets: number; won: number }> = {}
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const key = d.toLocaleString("en-US", { month: "short" })
      monthlyMap[key] = { profit: 0, bets: 0, won: 0 }
    }
    for (const bet of bets) {
      const key = bet.createdAt.toLocaleString("en-US", { month: "short" })
      if (monthlyMap[key]) {
        monthlyMap[key].bets++
        if (bet.status === "won") {
          monthlyMap[key].won++
          monthlyMap[key].profit += Number(bet.actualReturn ?? 0) - Number(bet.stake ?? 0)
        } else if (bet.status === "lost") {
          monthlyMap[key].profit -= Number(bet.stake ?? 0)
        }
      }
    }
    const monthlyStats = Object.entries(monthlyMap).map(([month, s]) => ({
      month,
      profit: Math.round(s.profit * 100) / 100,
      bets: s.bets,
      winRate: s.bets > 0 ? Math.round((s.won / s.bets) * 100) : 0,
    }))

    // Category performance — from items JSON array
    const categoryMap: Record<string, { bets: number; won: number; profit: number }> = {}
    for (const bet of bets) {
      const items = Array.isArray(bet.items) ? bet.items : []
      for (const item of items as { market?: string }[]) {
        const cat = item.market ?? "Other"
        if (!categoryMap[cat]) categoryMap[cat] = { bets: 0, won: 0, profit: 0 }
        categoryMap[cat].bets++
        if (bet.status === "won") {
          categoryMap[cat].won++
          categoryMap[cat].profit +=
            Number(bet.actualReturn ?? 0) - Number(bet.stake ?? 0)
        } else if (bet.status === "lost") {
          categoryMap[cat].profit -= Number(bet.stake ?? 0)
        }
      }
    }
    const categoryPerformance = Object.entries(categoryMap)
      .map(([category, s]) => ({
        category,
        bets: s.bets,
        winRate: s.bets > 0 ? Math.round((s.won / s.bets) * 100) : 0,
        profit: Math.round(s.profit * 100) / 100,
      }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 8)

    // ── AI Pick Accuracy (from QuickPurchase via Purchase table) ──
    // Uses predictionData from QuickPurchase and finalResult from MarketMatch
    let aiPickStats = {
      totalPurchased: 0,
      totalSettled: 0,
      correct: 0,
      incorrect: 0,
      pending: 0,
      accuracy: 0,
    }

    try {
      const purchases = await prisma.purchase.findMany({
        where: {
          userId: session.user.id,
          status: "completed",
          ...(cutoff ? { createdAt: { gte: cutoff } } : {}),
        },
        select: {
          id: true,
          createdAt: true,
          quickPurchase: {
            select: {
              id: true,
              name: true,
              predictionData: true,
              predictionType: true,
              confidenceScore: true,
              marketMatch: {
                select: {
                  status: true,
                  finalResult: true,
                  homeTeam: true,
                  awayTeam: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      })

      aiPickStats.totalPurchased = purchases.length

      for (const purchase of purchases) {
        const qp = purchase.quickPurchase
        if (!qp?.marketMatch) continue

        const matchStatus = qp.marketMatch.status
        if (matchStatus !== "FINISHED") {
          aiPickStats.pending++
          continue
        }

        aiPickStats.totalSettled++

        // Extract AI prediction and compare with final result
        const predData = qp.predictionData as Record<string, unknown> | null
        const finalRes = qp.marketMatch.finalResult as Record<string, unknown> | null

        if (!predData || !finalRes) continue

        // Determine predicted outcome
        const aiPick =
          (predData.pick as string) ||
          (predData.prediction as string) ||
          (predData.recommended_bet as string) ||
          ""

        // Determine actual outcome from finalResult
        const outcome =
          (finalRes.outcome as string) ||
          (finalRes.outcome_text as string) ||
          ""

        if (!aiPick || !outcome) continue

        // Normalize and compare
        const normalizedPick = aiPick.toLowerCase().trim()
        const normalizedOutcome = outcome.toLowerCase().trim()

        const isCorrect =
          normalizedPick === normalizedOutcome ||
          (normalizedPick.includes("home") && normalizedOutcome.includes("home")) ||
          (normalizedPick.includes("away") && normalizedOutcome.includes("away")) ||
          (normalizedPick.includes("draw") && normalizedOutcome.includes("draw"))

        if (isCorrect) {
          aiPickStats.correct++
        } else {
          aiPickStats.incorrect++
        }
      }

      aiPickStats.accuracy =
        aiPickStats.totalSettled > 0
          ? Math.round((aiPickStats.correct / aiPickStats.totalSettled) * 100)
          : 0
    } catch (aiError) {
      logger.warn("Error computing AI pick stats", {
        tags: ["api", "user", "analytics", "ai-picks"],
        error: aiError instanceof Error ? aiError : undefined,
      })
      // Non-fatal — return analytics without AI stats
    }

    return NextResponse.json({
      summary: {
        total,
        won,
        lost,
        pending,
        voided,
        winRate,
        roi: Math.round(roi * 10) / 10,
        totalStake: Math.round(totalStake * 100) / 100,
        totalReturn: Math.round(totalReturn * 100) / 100,
        totalProfit: Math.round((totalReturn - totalStake) * 100) / 100,
        avgOdds: Math.round(avgOdds * 100) / 100,
        bestStreak,
        currentStreak,
      },
      monthlyStats,
      categoryPerformance,
      aiPickStats,
    })
  } catch (error) {
    logger.error("Error fetching user analytics", {
      tags: ["api", "user", "analytics"],
      error: error instanceof Error ? error : undefined,
    })
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 })
  }
}

