import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import prisma from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { stripe, formatAmountForStripe, getStripeCurrency } from "@/lib/stripe-server"

// POST /api/payments/create-payment-intent - Create a payment intent for purchase
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { 
      itemId, 
      itemType, // 'package' or 'tip'
      paymentMethod 
    } = body

    if (!itemId || !itemType) {
      return NextResponse.json({ error: "Item ID and type are required" }, { status: 400 })
    }

    // Get user's country and currency
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        country: {
          select: {
            code: true,
            currencyCode: true,
            currencySymbol: true
          }
        }
      }
    })

    if (!user?.country) {
      return NextResponse.json({ error: "User country not set" }, { status: 400 })
    }

    let amount: number
    let currency: string
    let description: string
    let metadata: any = {
      userId: session.user.id,
      itemType,
      itemId,
      userCountry: user.country.code
    }

    if (itemType === 'package') {
      // Get package offer with user's country pricing
      const packageOffer = await prisma.packageOffer.findUnique({
        where: { id: itemId },
        include: {
          countryPrices: {
            where: {
              countryId: user.countryId!,
              isActive: true
            }
          }
        }
      })

      if (!packageOffer || packageOffer.countryPrices.length === 0) {
        return NextResponse.json({ error: "Package not found or not available in your country" }, { status: 404 })
      }

      const countryPrice = packageOffer.countryPrices[0]
      amount = Number(countryPrice.price)
      currency = countryPrice.currencyCode
      description = `Purchase: ${packageOffer.name}`
      
      metadata.packageName = packageOffer.name
      metadata.packageType = packageOffer.packageType
      metadata.tipCount = packageOffer.tipCount
      metadata.validityDays = packageOffer.validityDays
    } else if (itemType === 'tip') {
      // Get quick purchase item
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

      if (!quickPurchase) {
        return NextResponse.json({ error: "Item not found" }, { status: 404 })
      }

      amount = Number(quickPurchase.price)
      currency = quickPurchase.country?.currencyCode || 'USD'
      description = `Purchase: ${quickPurchase.name}`
      
      metadata.itemName = quickPurchase.name
      metadata.itemType = quickPurchase.type
    } else {
      return NextResponse.json({ error: "Invalid item type" }, { status: 400 })
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: formatAmountForStripe(amount, currency),
      currency: getStripeCurrency(currency),
      description,
      metadata,
      automatic_payment_methods: {
        enabled: true,
      },
      payment_method_types: paymentMethod ? [paymentMethod] : undefined,
      receipt_email: user.email,
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      amount,
      currency,
      paymentIntentId: paymentIntent.id
    })
  } catch (error) {
    console.error("Error creating payment intent:", error)
    return NextResponse.json({ error: "Failed to create payment intent" }, { status: 500 })
  }
} 