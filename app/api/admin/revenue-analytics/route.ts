import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { convertToUSD } from "@/lib/exchange-rates"

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || session.user.role.toLowerCase() !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get current date and 30 days ago for comparisons
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

    // Fetch revenue data from UserPackage table
    const [currentRevenue, previousRevenue] = await Promise.all([
      // Current month revenue
      prisma.userPackage.findMany({
        where: { 
          status: "active",
          purchasedAt: { gte: thirtyDaysAgo }
        },
        select: {
          pricePaid: true,
          currencyCode: true,
          user: {
            select: {
              country: {
                select: {
                  name: true,
                  code: true
                }
              }
            }
          }
        }
      }),
      // Previous month revenue
      prisma.userPackage.findMany({
        where: { 
          status: "active",
          purchasedAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo }
        },
        select: {
          pricePaid: true,
          currencyCode: true,
          user: {
            select: {
              country: {
                select: {
                  name: true,
                  code: true
                }
              }
            }
          }
        }
      })
    ])

    // Calculate total revenue in USD
    const calculateTotalUSD = (packages: any[]) => {
      return packages.reduce((total, pkg) => {
        const price = Number(pkg.pricePaid) || 0
        const currencyCode = pkg.currencyCode || 'USD'
        return total + convertToUSD(price, currencyCode)
      }, 0)
    }

    const currentTotalUSD = calculateTotalUSD(currentRevenue)
    const previousTotalUSD = calculateTotalUSD(previousRevenue)

    // Calculate monthly growth
    const monthlyGrowth = previousTotalUSD > 0 
      ? ((currentTotalUSD - previousTotalUSD) / previousTotalUSD) * 100 
      : currentTotalUSD > 0 ? 100 : 0

    // Group by currency for breakdown
    const currencyBreakdown = currentRevenue.reduce((acc: any, pkg) => {
      const currency = pkg.currencyCode || 'USD'
      const price = Number(pkg.pricePaid) || 0
      const usdEquivalent = convertToUSD(price, currency)
      
      if (!acc[currency]) {
        acc[currency] = {
          currency,
          amount: 0,
          usdEquivalent: 0
        }
      }
      
      acc[currency].amount += price
      acc[currency].usdEquivalent += usdEquivalent
      
      return acc
    }, {})

    // Convert to array and calculate percentages
    const breakdown = Object.values(currencyBreakdown).map((item: any) => ({
      ...item,
      percentage: currentTotalUSD > 0 ? (item.usdEquivalent / currentTotalUSD) * 100 : 0
    })).sort((a: any, b: any) => b.usdEquivalent - a.usdEquivalent)

    // Group by country for top revenue countries
    const countryRevenue = currentRevenue.reduce((acc: any, pkg) => {
      const countryName = pkg.user?.country?.name || 'Unknown'
      const countryCode = pkg.user?.country?.code || 'UN'
      const price = Number(pkg.pricePaid) || 0
      const currency = pkg.currencyCode || 'USD'
      
      if (!acc[countryName]) {
        acc[countryName] = {
          country: countryName,
          revenue: 0,
          currency: currency
        }
      }
      
      acc[countryName].revenue += price
      
      return acc
    }, {})

    // Convert to array and sort by revenue
    const topCountries = Object.values(countryRevenue)
      .sort((a: any, b: any) => b.revenue - a.revenue)
      .slice(0, 10) // Top 10 countries

    const revenueData = {
      totalUSD: currentTotalUSD,
      breakdown,
      monthlyGrowth,
      topCountries
    }

    return NextResponse.json(revenueData)
  } catch (error) {
    console.error("Error fetching revenue analytics:", error)
    return NextResponse.json({ error: "Failed to fetch revenue analytics" }, { status: 500 })
  }
} 