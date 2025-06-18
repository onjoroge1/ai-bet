import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

type PurchaseData = {
  userId: string
  quickPurchaseId: string
  amount: Prisma.Decimal
  paymentMethod: string
  status: string
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { itemId, paymentMethod, price, isTest } = await req.json()
    console.log("Received request:", { itemId, paymentMethod, price, isTest })

    // Parse the price string into a decimal number, removing any currency symbols, prefixes, and spaces
    const cleanPrice = price.toString()
      .replace(/[A-Za-z]/g, '') // Remove any letters (currency codes)
      .replace(/[^0-9.]/g, '') // Remove any remaining non-numeric characters except decimal point
      .trim()
    console.log("Cleaned price:", cleanPrice)

    // Validate the cleaned price is a valid decimal
    if (!/^\d+\.?\d*$/.test(cleanPrice)) {
      return NextResponse.json({ error: "Invalid price format" }, { status: 400 })
    }

    // Look up the quick purchase
    console.log("Looking up quick purchase:", itemId)
    const quickPurchase = await prisma.quickPurchase.findUnique({
      where: { id: itemId },
      include: {
        country: {
          select: {
            currencyCode: true,
            currencySymbol: true
          }
        }
      }
    })
    console.log("Quick purchase lookup result:", quickPurchase)

    if (!quickPurchase) {
      return NextResponse.json({ error: "Quick purchase not found" }, { status: 404 })
    }

    // Create purchase record
    const purchaseData: PurchaseData = {
      userId: session.user.id,
      quickPurchaseId: itemId,
      amount: new Prisma.Decimal(cleanPrice),
      paymentMethod: isTest ? 'test-payment' : paymentMethod,
      status: 'completed'
    }

    console.log("Creating purchase record with data:", purchaseData)

    const purchase = await prisma.$transaction(async (tx) => {
      const createdPurchase = await tx.purchase.create({
        data: purchaseData,
        include: {
          quickPurchase: {
            include: {
              country: {
                select: {
                  currencyCode: true,
                  currencySymbol: true
                }
              }
            }
          }
        }
      })
      return createdPurchase
    })

    console.log("Successfully created purchase record")

    return NextResponse.json({ 
      success: true, 
      purchase: {
        id: purchase.id,
        amount: purchase.amount,
        status: purchase.status,
        createdAt: purchase.createdAt,
        quickPurchase: {
          id: purchase.quickPurchase.id,
          name: purchase.quickPurchase.name,
          price: purchase.quickPurchase.price,
          description: purchase.quickPurchase.description,
          type: purchase.quickPurchase.type,
          country: {
            currencyCode: purchase.quickPurchase.country.currencyCode,
            currencySymbol: purchase.quickPurchase.country.currencySymbol
          }
        }
      },
      userEmail: session.user.email 
    })

  } catch (error) {
    console.error("Purchase error:", error)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json({ error: "A purchase with this ID already exists" }, { status: 409 })
      }
      if (error.code === 'P2003') {
        return NextResponse.json({ error: "Invalid reference to quick purchase or user" }, { status: 400 })
      }
    }
    return NextResponse.json({ error: "Payment failed" }, { status: 500 })
  }
} 