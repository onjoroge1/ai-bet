import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { convertToUSD, formatUSD } from "@/lib/exchange-rates"

const prisma = new PrismaClient()

export async function GET() {
  try {
    // Get current date for calculations
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Fetch all statistics in parallel
    const [
      totalPredictions,
      successfulPredictions,
      totalRevenue,
      totalCountries,
      totalWinnings,
      totalUsers,
    ] = await Promise.all([
      // Total predictions
      prisma.userPrediction.count(),

      // Successful predictions (won)
      prisma.userPrediction.count({
        where: { status: "won" }
      }),

      // Total revenue from UserPackage
      prisma.userPackage.aggregate({
        where: { status: "active" },
        _sum: { pricePaid: true }
      }),

      // Total active countries
      prisma.country.count({
        where: { isActive: true }
      }),

      // Total winnings from users
      prisma.user.aggregate({
        where: { isActive: true },
        _sum: { totalWinnings: true }
      }),

      // Total active users
      prisma.user.count({
        where: { isActive: true }
      }),
    ])

    // Calculate win rate percentage
    const winRatePercentage = totalPredictions > 0 
      ? Math.round((successfulPredictions / totalPredictions) * 100)
      : 0

    // Convert revenue to USD
    const revenueUSD = totalRevenue._sum.pricePaid 
      ? convertToUSD(Number(totalRevenue._sum.pricePaid), "USD")
      : 0

    // Convert total winnings to USD
    const winningsUSD = totalWinnings._sum.totalWinnings 
      ? convertToUSD(Number(totalWinnings._sum.totalWinnings), "USD")
      : 0

    // Format numbers for display
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount)
    }

    // Determine win rate display based on data availability
    let winRateDisplay = {
      value: "Calculating...",
      rawValue: 0,
      description: "Win rate calculation in progress"
    }

    if (totalPredictions > 0) {
      if (successfulPredictions > 0) {
        winRateDisplay = {
          value: `${winRatePercentage}%`,
          rawValue: winRatePercentage,
          description: `Based on ${totalPredictions} predictions`
        }
      } else {
        winRateDisplay = {
          value: "0%",
          rawValue: 0,
          description: "No successful predictions yet"
        }
      }
    } else {
      winRateDisplay = {
        value: "New Platform",
        rawValue: 0,
        description: "Building our prediction history"
      }
    }

    // Determine winnings display
    let winningsDisplay = {
      value: "Community Success",
      rawValue: winningsUSD,
      description: "Our community celebrates wins together"
    }

    if (winningsUSD > 0) {
      winningsDisplay = {
        value: formatCurrency(winningsUSD),
        rawValue: winningsUSD,
        description: "Total community winnings"
      }
    } else if (totalUsers > 0) {
      winningsDisplay = {
        value: `${totalUsers}+ Users`,
        rawValue: totalUsers,
        description: "Active community members"
      }
    }

    const stats = {
      winRate: winRateDisplay,
      totalWinnings: winningsDisplay,
      countries: {
        value: `${totalCountries}+`,
        rawValue: totalCountries,
        description: "Global reach with local payment methods"
      },
      totalRevenue: {
        value: revenueUSD > 0 ? formatCurrency(revenueUSD) : "Growing Platform",
        rawValue: revenueUSD,
        description: revenueUSD > 0 ? "Total platform revenue" : "Building our platform"
      }
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error("Error fetching homepage stats:", error)
    return NextResponse.json(
      { error: "Failed to fetch homepage stats" },
      { status: 500 }
    )
  }
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M+`
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K+`
  }
  return num.toString()
} 